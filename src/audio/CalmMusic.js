import { moodPitch } from '../data/calmMusic.js';

const hz = midi => 440 * 2 ** ((midi - 69) / 12);

// Soft synthesized voices. Nodes end naturally; a departing player closes its
// entire output after the fade so tails and vibrato cannot leak into later songs.
function note(ctx, dest, midi, time, duration, voice, gain, pan = 0) {
  if (gain <= 0) return;
  const out = ctx.createGain(), panner = ctx.createStereoPanner(); panner.pan.value = pan;
  out.connect(panner); panner.connect(dest);
  const attack = voice === 'strings' ? .8 : voice === 'flute' ? .12 : voice === 'bass' ? .25 : .012;
  const release = Math.min(duration * .4, voice === 'strings' ? 1.2 : voice === 'flute' ? .22 : .4);
  out.gain.setValueAtTime(0, time);
  out.gain.linearRampToValueAtTime(gain, time + Math.min(attack, duration * .25));
  const tail = Math.max(time + Math.min(attack, duration * .25), time + duration - release);
  if (voice === 'pluck' || voice === 'wood' || voice === 'drum') out.gain.exponentialRampToValueAtTime(Math.max(.0001, gain * .04), tail);
  else out.gain.setValueAtTime(gain, tail);
  out.gain.linearRampToValueAtTime(0, time + duration);
  const real = new Float32Array(8), imag = new Float32Array(8);
  for (let n = 1; n < imag.length; n++) imag[n] = voice === 'strings' ? .43 / n ** 1.8
    : voice === 'flute' ? [0, 1, .16, .035][n] ?? 0
    : voice === 'pluck' ? [0, 1, .23, .065][n] ?? 0 : n === 1 ? 1 : 0;
  const wave = ctx.createPeriodicWave(real, imag, { disableNormalization: true });
  const nodes = [];
  for (const detune of voice === 'strings' ? [-2.3, 1.9] : [0]) {
    const osc = ctx.createOscillator(); osc.setPeriodicWave(wave);
    osc.frequency.value = hz(midi); osc.detune.value = detune; osc.connect(out);
    if (voice === 'drum') { osc.frequency.setValueAtTime(150, time); osc.frequency.exponentialRampToValueAtTime(58, time + .18); }
    osc.start(time); osc.stop(time + duration + .01); nodes.push(osc);
    osc.onended = () => { osc.disconnect(); if (nodes.every(o => o._done || o === osc)) { out.disconnect(); panner.disconnect(); } osc._done = true; };
    if (voice === 'flute') {
      const vibrato = ctx.createOscillator(), depth = ctx.createGain();
      vibrato.frequency.value = 4.6; depth.gain.setValueAtTime(0, time); depth.gain.linearRampToValueAtTime(3.3, time + .65);
      vibrato.connect(depth); depth.connect(osc.detune); vibrato.start(time); vibrato.stop(time + duration + .01);
      vibrato.onended = () => { vibrato.disconnect(); depth.disconnect(); };
    }
  }
}

export class CalmMusicPlayer {
  constructor(ctx, dest, track) {
    this.ctx = ctx; this.track = track; this.bar = 0; this.stopped = false;
    this.out = ctx.createGain(); this.out.gain.value = 0;
    this.filter = ctx.createBiquadFilter(); this.filter.type = 'lowpass'; this.filter.frequency.value = 4300; this.filter.Q.value = .5;
    this.out.connect(this.filter); this.filter.connect(dest);
  }
  start(fade = 3) {
    this.stopped = false; this.out.gain.setTargetAtTime(this.track.gain, this.ctx.currentTime, fade / 3);
    this.next = this.ctx.currentTime + .1;
    this.schedule(); this.timer = setInterval(() => this.schedule(), 40);
  }
  stop(fade = 3) {
    if (this.stopped) return;
    this.stopped = true; clearInterval(this.timer);
    const t = this.ctx.currentTime;
    this.out.gain.cancelScheduledValues(t); this.out.gain.setTargetAtTime(0, t, fade / 3);
    // AudioContext time pauses when suspended; wall time must not cut an audible fade.
    const cleanup = () => {
      if (this.ctx.state !== 'closed' && this.ctx.currentTime < t + fade + 1) { this.cleanupTimer = setTimeout(cleanup, 500); return; }
      this.out.disconnect(); this.filter.disconnect();
    };
    this.cleanupTimer = setTimeout(cleanup, (fade + 1) * 1000);
  }
  schedule() {
    if (this.stopped || this.ctx.state !== 'running') return;
    // Skip missed bars after suspension rather than firing a backlog of notes.
    if (this.next < this.ctx.currentTime - .2) this.next = this.ctx.currentTime + .05;
    while (this.next < this.ctx.currentTime + .18) {
      this.renderBar(this.bar++, this.next); this.next += 4 * 60 / this.track.bpm;
    }
  }
  // The same score is used by live playback and the offline listening previews.
  renderBar(bar, time) {
    const tr = this.track, b = 60 / tr.bpm, index = bar % tr.chords.length;
    const chord = tr.chords[index].map(n => moodPitch(n, tr));
    for (let i = 1; i < chord.length; i++) note(this.ctx, this.out, chord[i], time, 4 * b + 1.6, 'strings', tr.strings, [-.65,-.2,.3,.7][i-1]);
    note(this.ctx, this.out, chord[0] >= 47 ? chord[0]-12 : chord[0], time, 4 * b + .6, 'bass', tr.bass);
    const plucks = tr.pulse ? [[0,1],[.5,3],[1,2],[1.5,4],[2,1],[2.5,3],[3,2],[3.5,4]]
      : tr.sparse ? [[0,1],[2.5,3]] : [[0,1],[1.5,3],[2.5,2],[3.5,4]];
    for (const [at, i] of plucks) note(this.ctx, this.out, chord[i], time + at * b, tr.pulse ? .75 : 1.7, 'pluck', tr.pluck, i % 2 ? -.4 : .4);
    if (tr.drums) for (const at of tr.boss ? [0,1.5,2,3.5] : [0,2]) note(this.ctx, this.out, 45, time + at*b, .34, 'drum', tr.drums*(at%2 ? .7 : 1));
    if (bar % 2 === 0) note(this.ctx, this.out, chord[2]+12, time + 3.5*b, 1, 'wood', tr.wood, .45);
    if (tr.bright) for (const at of [1,3]) note(this.ctx, this.out, chord[1]+12, time + at*b, .65, 'wood', tr.wood*.6, -.35);
    for (const [i, [at, pitch, len]] of tr.melody[index].entries()) {
      if (tr.sparse && i === 1) continue;
      note(this.ctx, this.out, moodPitch(pitch, tr), time + at*b, len*b*.94, 'flute', tr.flute, -.08);
    }
  }
}
