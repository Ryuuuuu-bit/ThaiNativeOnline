// Ambience synthesized locally (no downloads) on the ambience bus of src/audio/Sound.js: wind,
// birds by day, crickets at night. Birds fall silent deeper in the forest and
// a low drone replaces them near the cemetery.
export class AudioAmbience {
  constructor() { this.enabled = false; this.mood = { night: 0, wild: 0, cemetery: 0 }; }
  // Builds the ambience on the shared audio engine (src/audio/Sound.js) and starts it.
  start(ctx, dest) {
    if (this.context || !ctx || !dest) return;
    this.context = ctx;
    this.gain = ctx.createGain(); this.gain.gain.value = 0; this.gain.connect(dest);
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate), data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * .25;
    const noise = ctx.createBufferSource(); noise.buffer = buffer; noise.loop = true;
    this.windFilter = ctx.createBiquadFilter(); this.windFilter.type = 'lowpass'; this.windFilter.frequency.value = 550;
    noise.connect(this.windFilter); this.windFilter.connect(this.gain); noise.start();
    this.drone = ctx.createOscillator(); this.drone.type = 'sine'; this.drone.frequency.value = 62;
    this.droneGain = ctx.createGain(); this.droneGain.gain.value = 0; this.drone.connect(this.droneGain); this.droneGain.connect(this.gain); this.drone.start();
    this.enabled = true;
    this.gain.gain.setTargetAtTime(.32, ctx.currentTime, .8);
    this.setMood(this.mood); this.schedule();
  }
  setMood(mood) {
    this.mood = mood;
    if (!this.context) return;
    const t = this.context.currentTime;
    this.windFilter.frequency.setTargetAtTime(550 - mood.wild * 250, t, 1);
    this.droneGain.gain.setTargetAtTime(mood.cemetery * .05 * (.5 + mood.night), t, 1.5);
  }
  schedule() {
    const { night, wild, cemetery } = this.mood;
    const birds = (1 - night) * (1 - wild * .85) * (1 - cemetery);
    if (Math.random() < birds) this.chirp(); else if (night > .5 && cemetery < .5) this.cricket();
    this.timer = setTimeout(() => this.enabled && this.schedule(), 2500 + Math.random() * 5000 + wild * 4000);
  }
  tone(freqA, freqB, start, length, volume, type = 'sine') {
    const ctx = this.context, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freqA, start); o.frequency.exponentialRampToValueAtTime(freqB, start + length * .5);
    g.gain.setValueAtTime(0, start); g.gain.linearRampToValueAtTime(volume, start + .015); g.gain.exponentialRampToValueAtTime(.0001, start + length);
    o.connect(g); g.connect(this.gain); o.start(start); o.stop(start + length + .02);
  }
  chirp() { const s = this.context.currentTime; for (let i = 0; i < 3; i++) this.tone(2100 + i * 170, 3300 + i * 80, s + i * .17, .13, .025); }
  cricket() { const s = this.context.currentTime; for (let i = 0; i < 6; i++) this.tone(4200, 4300, s + i * .09, .05, .008, 'triangle'); }
}
