import { SFX, MUSIC, AUDIO_DEFAULTS } from '../data/audio.js';
import { playRecipe } from './synth.js';
import { MusicPlayer } from './Music.js';
import { CalmMusicPlayer } from './CalmMusic.js';

// The game's one audio engine: a single AudioContext with master → music /
// sfx / ambience buses. Browsers only allow sound after a user gesture, so
// the context is created on the first click or key press; music asked for
// before that starts then. Volumes and mute are remembered per browser.
//
//   Sound.sfx('hit', { pitch, volume, delay })   Sound.music('rock_day')
//   Sound.set('music', .4)                Sound.setMuted(true)
//   Sound.ambienceBus → node for src/core/AudioAmbience.js
const KEY = 'tno.audio.v1', THROTTLE_MS = 35;
const load = () => { try { return { ...AUDIO_DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }; } catch { return { ...AUDIO_DEFAULTS }; } };

class SoundEngine {
  constructor() {
    this.settings = load(); this.ctx = null; this.track = null; this.player = null; this.last = {}; this.samples = {}; this.listeners = new Set();
    if (typeof window === 'undefined') return;
    const unlock = () => { this.unlock(); };
    for (const n of ['pointerdown', 'keydown', 'touchstart']) window.addEventListener(n, unlock, { capture: true, passive: true });
  }
  get ready() { return !!this.ctx && this.ctx.state === 'running'; }
  unlock() {
    if (!this.ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = this.ctx = new Ctx();
      this.master = ctx.createGain(); this.master.connect(ctx.destination);
      const bus = () => { const g = ctx.createGain(); g.connect(this.master); return g; };
      this.buses = { music: bus(), sfx: bus(), ambience: bus() };
      // A little room for the music: one feedback echo.
      const delay = ctx.createDelay(1); delay.delayTime.value = .32;
      const fb = ctx.createGain(); fb.gain.value = .22; const wet = ctx.createGain(); wet.gain.value = .18;
      this.musicIn = ctx.createGain(); this.musicIn.connect(this.buses.music); this.musicIn.connect(delay);
      delay.connect(fb); fb.connect(delay); delay.connect(wet); wet.connect(this.buses.music);
      this.apply();
      for (const fn of this.listeners) fn(this);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    if (this.track && !this.player) this.startTrack();
  }
  // Called once the engine exists (immediately if it already does).
  onReady(fn) { if (this.ctx) fn(this); else this.listeners.add(fn); }
  get ambienceBus() { return this.buses?.ambience ?? null; }

  apply() {
    if (!this.ctx) return;
    const s = this.settings, t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(s.muted ? 0 : s.master, t, .05);
    for (const k of ['music', 'sfx', 'ambience']) this.buses[k].gain.setTargetAtTime(s[k], t, .05);
  }
  save() { try { localStorage.setItem(KEY, JSON.stringify(this.settings)); } catch { /* storage unavailable */ } }
  set(key, value) { this.settings[key] = value; this.apply(); this.save(); }
  setMuted(muted) { this.set('muted', muted); }
  get muted() { return this.settings.muted; }

  sfx(id, opts = {}) {
    if (!this.ready || this.settings.muted) return;
    const recipe = SFX[id];
    if (!recipe) return;
    // The same sound landing many times at one moment (an AoE) plays once; `delay` (s) schedules ahead.
    const delay = opts.delay ?? 0, when = performance.now() + delay * 1000;
    if (Math.abs(when - (this.last[id] ?? -1e9)) < THROTTLE_MS) return;
    this.last[id] = when;
    if (recipe.file) return this.playFile(recipe, opts);
    playRecipe(this.ctx, this.buses.sfx, recipe, this.ctx.currentTime + delay, opts);
  }
  async playFile({ file, gain = 1 }, { volume = 1 } = {}) {
    const buffer = this.samples[file] ??= fetch(`${import.meta.env.BASE_URL}${file}`).then(r => r.arrayBuffer()).then(b => this.ctx.decodeAudioData(b)).catch(() => null);
    const decoded = await buffer;
    if (!decoded) return;
    const src = this.ctx.createBufferSource(), g = this.ctx.createGain();
    src.buffer = decoded; g.gain.value = gain * volume; src.connect(g); g.connect(this.buses.sfx); src.start();
  }

  // Crossfades to a MUSIC track; null stops the music.
  music(id) {
    if (id === this.track) return;
    this.track = id;
    this.player?.stop(); this.player = null;
    if (id && this.ctx) this.startTrack();
  }
  startTrack() {
    const track = MUSIC[this.track];
    if (!track || !this.ctx) return;
    const Player = track.style === 'calm' ? CalmMusicPlayer : MusicPlayer;
    this.player = new Player(this.ctx, this.musicIn, track); this.player.start();
  }
}

export const Sound = new SoundEngine();
