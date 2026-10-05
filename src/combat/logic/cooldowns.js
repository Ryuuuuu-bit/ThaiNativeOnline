// Cooldown tracker driven by tick(dt) so it stays deterministic and testable.

export function createCooldownTracker() {
  let now = 0;
  const entries = new Map(); // id -> { end, duration }
  return {
    tick(dt) { now += dt; },
    now() { return now; },
    start(id, duration) {
      if (duration > 0) entries.set(id, { end: now + duration, duration });
      else entries.delete(id);
    },
    remaining(id) {
      const entry = entries.get(id);
      return entry ? Math.max(0, entry.end - now) : 0;
    },
    duration(id) { return entries.get(id)?.duration ?? 0; },
    /** 0 = ready, 1 = just started. */
    fraction(id) {
      const entry = entries.get(id);
      return entry && entry.duration > 0 ? Math.max(0, entry.end - now) / entry.duration : 0;
    },
    ready(id) { return this.remaining(id) <= 0; },
    reset(id) { if (id === undefined) entries.clear(); else entries.delete(id); },
  };
}
