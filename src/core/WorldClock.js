// World time foundation. `rate` is game minutes per real second, so by default
// a full day takes 24 real minutes. Systems subscribe to phase changes.
export const PHASES = ['morning', 'day', 'evening', 'night'];
export const PHASE_NAMES = { morning: 'เช้า', day: 'กลางวัน', evening: 'เย็น', night: 'กลางคืน' };
export const PHASE_HOURS = { morning: 7, day: 12.5, evening: 17.8, night: 22 };

export function phaseOf(hour) {
  if (hour >= 5 && hour < 10) return 'morning';
  if (hour >= 10 && hour < 16.5) return 'day';
  if (hour >= 16.5 && hour < 19.5) return 'evening';
  return 'night';
}

export class WorldClock {
  constructor({ hour = 7.5, minutesPerSecond = 1 } = {}) {
    this.hour = hour; this.rate = minutesPerSecond; this.paused = false; this.day = 1;
    this.phase = phaseOf(hour); this.listeners = [];
  }
  set(hour) { this.hour = ((hour % 24) + 24) % 24; this.check(); }
  update(dt) {
    if (!this.paused) {
      this.hour += dt * this.rate / 60;
      if (this.hour >= 24) { this.hour -= 24; this.day++; }
    }
    this.check();
  }
  check() {
    const phase = phaseOf(this.hour);
    if (phase === this.phase) return;
    const previous = this.phase; this.phase = phase;
    for (const listener of this.listeners) listener(phase, previous);
  }
  // Returns an unsubscribe function (used when a map's NPCs are disposed).
  onPhase(listener) { this.listeners.push(listener); return () => { const i = this.listeners.indexOf(listener); if (i >= 0) this.listeners.splice(i, 1); }; }
  get label() {
    const h = Math.floor(this.hour), m = Math.floor((this.hour - h) * 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
}
