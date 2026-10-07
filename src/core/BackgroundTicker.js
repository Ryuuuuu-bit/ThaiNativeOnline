// Keeps the game running while its tab is hidden (another tab or window in front).
// A hidden tab gets no animation frames, and its own timers are slowed to once a second or
// less; a worker's timers are not, so a tiny worker sends the beat and the page steps the game
// (no drawing). The player stays connected and in the world: AUTO keeps fighting, potions
// keep being drunk, the server keeps its say.
//
//   const t = new BackgroundTicker(ms => game.backgroundStep(ms)); t.start(); t.stop();
const BEAT_MS = 100;
const SOURCE = `let id = null; onmessage = e => { clearInterval(id); id = e.data ? setInterval(() => postMessage(0), e.data) : null; };`;

export class BackgroundTicker {
  constructor(step) {
    this.step = step; this.worker = null; this.running = false;
    try {
      this.worker = new Worker(URL.createObjectURL(new Blob([SOURCE], { type: 'text/javascript' })));
      this.worker.onmessage = () => this.beat();
    } catch { this.worker = null; }   // no workers: fall back to the page's own (slowed) timer
  }
  start() {
    if (this.running) return;
    this.running = true;
    if (this.worker) this.worker.postMessage(BEAT_MS); else this.timer = setInterval(() => this.beat(), BEAT_MS);
  }
  stop() {
    if (!this.running) return;
    this.running = false;
    if (this.worker) this.worker.postMessage(0); else clearInterval(this.timer);
  }
  beat() { if (this.running) this.step(performance.now()); }
}
