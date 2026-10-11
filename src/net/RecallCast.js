export class RecallCast {
  constructor() { this.clear(); }
  get busy() { return this.pending || this.active; }
  request() {
    if (this.busy) return false;
    this.pending = true; this.wait = 0;
    return true;
  }
  start({ duration = 5, remaining = duration } = {}) {
    if (!Number.isFinite(duration) || duration <= 0 || !Number.isFinite(remaining)) return false;
    const bounded = Math.max(0, Math.min(duration, remaining));
    this.remaining = this.active ? Math.min(this.remaining, bounded) : bounded;
    this.duration = duration; this.pending = false; this.active = true;
    return true;
  }
  cancel() {
    if (!this.busy || this.cancelling) return false;
    this.cancelling = true;
    return true;
  }
  update(dt) {
    if (this.pending && (this.wait += dt) >= 3) { this.clear(); return 'timeout'; }
    if (this.active) this.remaining = Math.max(0, this.remaining - dt);
    // Only an authoritative cancellation or teleport can complete the cast.
    return null;
  }
  clear() {
    this.pending = false; this.active = false; this.cancelling = false;
    this.duration = 5; this.remaining = 0; this.wait = 0;
  }
}
