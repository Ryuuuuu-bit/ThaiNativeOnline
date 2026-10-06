import { ranat, khong, ching, klong, drone, kick, snare, hat, crash, powerChord, bassNote, leadNote, distortionCurve } from './synth.js';

// Generative music for one track (MUSIC in src/data/audio.js) on a 16-step bar,
// scheduled a little ahead of time. Two styles:
//   'thai'  ระนาด phrases, ฆ้องวง bass, ฉิ่ง and กลอง patterns
//   'rock'  distorted power-chord riff, bass, drum kit, and a pentatonic lead
// A melody phrase is generated, then played twice before a new one, so the
// music has a shape instead of being pure noodling.
const LOOKAHEAD = .15, TICK_MS = 30;

export class MusicPlayer {
  constructor(ctx, dest, track) {
    this.ctx = ctx; this.track = track; this.rock = track.style === 'rock';
    this.out = ctx.createGain(); this.out.gain.value = 0; this.out.connect(dest);
    this.step = 0; this.bar = 0; this.phrase = []; this.degree = 0;
    if (this.rock) {
      // Guitar rig: overdrive → cabinet-ish band limit → level.
      const drive = ctx.createWaveShaper(); drive.curve = distortionCurve(track.drive ?? 18); drive.oversample = '2x';
      const lo = ctx.createBiquadFilter(); lo.type = 'lowpass'; lo.frequency.value = 3800;
      const hi = ctx.createBiquadFilter(); hi.type = 'highpass'; hi.frequency.value = 90;
      const level = ctx.createGain(); level.gain.value = .32;
      this.guitar = ctx.createGain(); this.guitar.connect(drive); drive.connect(lo); lo.connect(hi); hi.connect(level); level.connect(this.out);
    }
  }
  start(fade = 2) {
    const t = this.ctx.currentTime;
    this.out.gain.setTargetAtTime(this.track.gain ?? .5, t, fade / 3);
    this.next = t + .1;
    if (this.track.drone) this.stopDrone = drone(this.ctx, this.out, this.track.root / 2, t);
    this.timer = setInterval(() => this.schedule(), TICK_MS);
  }
  stop(fade = 2) {
    const t = this.ctx.currentTime;
    this.out.gain.cancelScheduledValues(t); this.out.gain.setTargetAtTime(0, t, fade / 3);
    this.stopDrone?.(t);
    setTimeout(() => { clearInterval(this.timer); this.out.disconnect(); }, fade * 1000 + 500);
  }
  freq(degree, octave = 0) {
    const s = this.track.scale, n = s.length, o = Math.floor(degree / n) + octave, i = ((degree % n) + n) % n;
    return this.track.root * 2 ** (o + s[i] / 12);
  }
  // A two-bar melody (one entry per 8th note): a bounded random walk with rests.
  makePhrase() {
    const { density, range } = this.track.melody, notes = [];
    for (let i = 0; i < 16; i++) {
      if (Math.random() > density && i % 4) { notes.push(null); continue; }
      this.degree = Math.max(0, Math.min(range, this.degree + [-2, -1, -1, 1, 1, 2, 0][Math.floor(Math.random() * 7)]));
      notes.push(this.degree);
    }
    notes[15] = 0; // resolve home at the phrase end
    return notes;
  }
  schedule() {
    const sixteenth = 60 / this.track.bpm / 4;
    while (this.next < this.ctx.currentTime + LOOKAHEAD) {
      const s = this.step % 16;
      if (s === 0) { if (this.bar % 4 === 0) this.phrase = this.makePhrase(); this.bar++; }
      if (this.rock) this.rockStep(this.next, s, sixteenth); else this.thaiStep(this.next, s);
      this.step++; this.next += sixteenth;
    }
  }
  thaiStep(t, s) {
    const { melody, bass, ching: chingPat, drum } = this.track;
    if (s % 2 === 0) {
      const note = this.phrase[((this.bar - 1) % 2) * 8 + s / 2];
      if (note != null) ranat(this.ctx, this.out, this.freq(note, melody.octave), t, .11);
    }
    if (s % bass.every === 0) khong(this.ctx, this.out, this.freq(bass.degrees[(s / bass.every + this.bar) % bass.degrees.length], -1), t, .13);
    const c = chingPat[s]; if (c === 'o' || c === 'c') ching(this.ctx, this.out, c === 'o', t);
    if (drum[s] === 'x') klong(this.ctx, this.out, t);
  }
  // Riff symbols: X = accented open chord held until the next hit, x = palm-muted chug.
  rockStep(t, s, sixteenth) {
    const { riff, drums, melody, lead } = this.track, ctx = this.ctx;
    const chord = riff.chords[(this.bar - 1) % riff.chords.length], root = this.freq(chord, riff.octave ?? -1);
    if (s === 0 && (this.bar - 1) % 4 === 0) crash(ctx, this.out, t);
    if (drums.kick[s] === 'x') kick(ctx, this.out, t);
    if (drums.snare[s] === 'x') snare(ctx, this.out, t);
    const h = drums.hat[s]; if (h === 'x' || h === 'o') hat(ctx, this.out, t, h === 'o');
    const r = riff.rhythm[s];
    if (r === 'X' || r === 'x') {
      let len = 1; while (r === 'X' && s + len < 16 && riff.rhythm[s + len] === '.') len++;
      powerChord(ctx, this.guitar, root, t, r === 'X' ? sixteenth * len * .95 : sixteenth * .7, r === 'X' ? .07 : .06, r === 'x');
    }
    if (riff.bass?.[s] === 'x') bassNote(ctx, this.out, root / 2, t, sixteenth * 1.8);
    // The lead plays its phrase every other 4-bar section, so the riff gets room.
    if (lead && s % 2 === 0 && Math.floor((this.bar - 1) / 4) % 2 === 1) {
      const note = this.phrase[((this.bar - 1) % 2) * 8 + s / 2];
      if (note != null) leadNote(ctx, this.guitar, this.freq(note, melody.octave), t, sixteenth * 1.9);
    }
  }
}
