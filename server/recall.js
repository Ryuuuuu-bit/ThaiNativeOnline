export const RECALL_COOLDOWN = 30;
export const RECALL_CAST_SECONDS = 5;
export function recallWhy(p, { fighting = false, duel = false, trade = false, now = Date.now() / 1000 } = {}) {
  if (!p) return 'offline';
  if (p.dead) return 'dead';
  if (p.map === 'city') return 'city';
  if (fighting || duel || trade) return 'busy';
  if (now - (p.recallAt ?? -Infinity) < RECALL_COOLDOWN) return 'cooldown';
  return null;
}

// Only the server clock completes a recall. Requests carry no client timing.
export class RecallCasts {
  constructor(now = () => performance.now() / 1000) { this.now = now; this.pending = new Map(); }
  start(id, p) {
    let cast = this.pending.get(id);
    if (!cast) {
      cast = { started: this.now(), map: p.map, room: p.room, x: p.x, z: p.z };
      this.pending.set(id, cast);
    }
    return { duration: RECALL_CAST_SECONDS, remaining: Math.max(0, RECALL_CAST_SECONDS - (this.now() - cast.started)) };
  }
  cancel(id) { return this.pending.delete(id); }
  update(id, p, why = null) {
    const cast = this.pending.get(id); if (!cast) return null;
    if (!p) why = 'offline';
    else if (p.map !== cast.map || p.room !== cast.room || Math.hypot(p.x - cast.x, p.z - cast.z) > .01) why = 'moved';
    if (why) { this.cancel(id); return { cancelled: true, why }; }
    if (this.now() - cast.started < RECALL_CAST_SECONDS) return null;
    this.cancel(id); return { complete: true };
  }
}
