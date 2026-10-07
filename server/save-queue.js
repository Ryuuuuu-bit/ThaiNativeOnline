// Per-character FIFO. Failed writes stay at the head and retry; later snapshots
// cannot overtake them. Different characters can save concurrently.
export class SaveQueue {
  constructor({ retryMs = 500, maxRetryMs = 10000, onError = () => {} } = {}) {
    Object.assign(this, { retryMs, maxRetryMs, onError }); this.queues = new Map();
  }
  run(key, write, { snapshot = false } = {}) {
    let q = this.queues.get(key);
    if (!q) { q = { jobs: [], running: false, failures: 0, timer: null }; this.queues.set(key, q); }
    const tail = q.jobs.at(-1);
    // Merge only consecutive waiting snapshots, never across an API save/delete.
    if (snapshot && tail?.snapshot && q.jobs.length > 1) { tail.write = write; return tail.result; }
    const job = { write, snapshot };
    const result = new Promise((resolve, reject) => Object.assign(job, { resolve, reject }));
    job.result = result; q.jobs.push(job);
    this.pump(key, q); return result;
  }
  async pump(key, q) {
    if (q.running || q.timer || !q.jobs.length) return;
    q.running = true;
    try {
      const result = await q.jobs[0].write();
      q.jobs.shift().resolve(result); q.failures = 0;
    } catch (error) {
      try { this.onError(error, key); } catch { /* reporting must not discard a write */ } q.failures++;
      q.timer = setTimeout(() => { q.timer = null; this.pump(key, q); }, Math.min(this.maxRetryMs, this.retryMs * 2 ** Math.min(q.failures - 1, 8)));
      q.timer.unref?.();
    } finally {
      q.running = false;
      if (!q.jobs.length) this.queues.delete(key);
      else if (!q.timer) this.pump(key, q);
    }
  }
  get pending() { return [...this.queues.values()].reduce((n, q) => n + q.jobs.length, 0); }
  async wait(key = null, timeoutMs = 10000) {
    const end = Date.now() + timeoutMs;
    while (key === null ? this.pending : this.queues.has(key)) {
      if (Date.now() >= end) throw new Error('Save queue timeout');
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }
}
