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
    // A separate quiet shore wash uses the existing generated noise buffer.
    // Slow filtering gives it a breathing tide; it is silent away from town water.
    this.waterFilter = ctx.createBiquadFilter(); this.waterFilter.type = 'bandpass';
    this.waterFilter.frequency.value = 720; this.waterFilter.Q.value = .45;
    this.waterGain = ctx.createGain(); this.waterGain.gain.value = 0;
    noise.connect(this.waterFilter); this.waterFilter.connect(this.waterGain); this.waterGain.connect(this.gain);
    const tide = ctx.createOscillator(), depth = ctx.createGain();
    tide.frequency.value = .16; depth.gain.value = 220;
    tide.connect(depth); depth.connect(this.waterFilter.frequency); tide.start();
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
    this.waterGain.gain.setTargetAtTime((mood.river ?? 0) * .40, t, 1.5);
  }
  schedule() {
    const { night, wild, cemetery } = this.mood;
    const birds = (1 - night) * (1 - wild * .85) * (1 - cemetery);
    if (Math.random() < birds) this.chirp(); else if (night > .5 && cemetery < .5) this.cricket();
    const now = this.context.currentTime;
    if (this.mood.market > .2 && night < .5 && Math.random() < .22) {
      // Restrained ceramic/woodwork ticks, not synthetic pretend dialogue.
      this.tone(740, 731, now + .4, .15, .016 * this.mood.market);
      this.tone(1110, 1096, now + .57, .12, .007 * this.mood.market);
    }
    if (this.mood.temple > .35 && now - (this.lastBell ?? -60) > 45 && Math.random() < .3) {
      this.lastBell = now;
      this.tone(392, 391, now + .5, 3.6, .025 * this.mood.temple);
      this.tone(1066, 1063, now + .5, 1.8, .007 * this.mood.temple);
    }
    this.timer = setTimeout(() => this.enabled && this.schedule(), 2500 + Math.random() * 5000 + wild * 4000);
  }
  tone(freqA, freqB, start, length, volume, type = 'sine') {
    const ctx = this.context, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freqA, start); o.frequency.exponentialRampToValueAtTime(freqB, start + length * .5);
    g.gain.setValueAtTime(0, start); g.gain.linearRampToValueAtTime(volume, start + .015); g.gain.exponentialRampToValueAtTime(.0001, start + length);
    o.connect(g); g.connect(this.gain); o.start(start); o.stop(start + length + .02);
    o.onended = () => { o.disconnect(); g.disconnect(); };
  }
  chirp() { const s = this.context.currentTime; for (let i = 0; i < 3; i++) this.tone(2100 + i * 170, 3300 + i * 80, s + i * .17, .13, .025); }
  cricket() { const s = this.context.currentTime; for (let i = 0; i < 6; i++) this.tone(4200, 4300, s + i * .09, .05, .008, 'triangle'); }
}
