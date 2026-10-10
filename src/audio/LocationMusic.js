import { musicAt } from '../data/calmMusic.js';

// Debounce region borders and allow a phrase to breathe before another fade.
export class LocationMusic {
  constructor(play, { settle = 2, dwell = 8 } = {}) {
    this.play = play; this.settle = settle; this.dwell = dwell;
    this.current = null; this.candidate = null; this.stable = 0; this.age = 0; this.mapId = null;
  }
  update(dt, location) {
    const next = musicAt(location), changedMap = this.mapId !== location.mapId;
    this.mapId = location.mapId;
    this.age += Math.max(0, dt);
    if (next === this.current) { this.candidate = null; this.stable = 0; return; }
    if (next !== this.candidate) { this.candidate = next; this.stable = 0; }
    else this.stable += Math.max(0, dt);
    if (!this.current || changedMap || this.stable >= this.settle && this.age >= this.dwell) {
      this.current = next; this.candidate = null; this.stable = 0; this.age = 0;
      this.play(next);
    }
  }
}
