// Tiny Web Audio voices for SFX recipes and music instruments (data in
// src/data/audio.js). Every node is scheduled at an exact time and stops
// itself, so nothing has to be cleaned up by hand.
let noiseBuffer = null;
function noise(ctx) {
  if (!noiseBuffer || noiseBuffer.sampleRate !== ctx.sampleRate) {
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuffer.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return noiseBuffer;
}
const ramp = (param, [a, b], t0, t1) => { param.setValueAtTime(a, t0); if (b !== a) param.exponentialRampToValueAtTime(Math.max(b, 1), t1); };

// One layer: an oscillator or noise burst, optional sweeping filter, attack/decay envelope.
export function layer(ctx, dest, { wave = 'sine', f = [440, 440], dur = .2, at = 0, a = .005, gain = .1, filter }, time, pitch = 1, volume = 1) {
  const t0 = time + at, t1 = t0 + dur;
  const src = wave === 'noise' ? Object.assign(ctx.createBufferSource(), { buffer: noise(ctx), loop: true }) : ctx.createOscillator();
  if (wave === 'noise') src.playbackRate.value = pitch;
  else { src.type = wave; ramp(src.frequency, f.map(x => x * pitch), t0, t1); }
  const env = ctx.createGain();
  env.gain.setValueAtTime(0, t0);
  env.gain.linearRampToValueAtTime(gain * volume, t0 + Math.min(a, dur * .5));
  env.gain.exponentialRampToValueAtTime(.0001, t1);
  let node = src;
  if (filter) {
    const bq = ctx.createBiquadFilter(); bq.type = filter.type; bq.Q.value = filter.q ?? 1;
    ramp(bq.frequency, filter.f.map(x => x * pitch), t0, t1);
    node.connect(bq); node = bq;
  }
  node.connect(env); env.connect(dest);
  src.start(t0, wave === 'noise' ? Math.random() * .5 : 0); src.stop(t1 + .05);
}

export function playRecipe(ctx, dest, recipe, time, { pitch = 1, volume = 1 } = {}) {
  const p = pitch * (1 + (recipe.vary ? (Math.random() * 2 - 1) * recipe.vary : 0));
  for (const l of recipe.layers) layer(ctx, dest, l, time, p, volume);
}

// ---- music instruments ------------------------------------------------------
// ระนาด: hard wooden bar — fundamental plus a bright, fast-dying overtone and a click.
export function ranat(ctx, dest, freq, time, gain = .12) {
  layer(ctx, dest, { wave: 'sine', f: [freq, freq], dur: .45, gain }, time);
  layer(ctx, dest, { wave: 'sine', f: [freq * 3.93, freq * 3.9], dur: .12, gain: gain * .35 }, time);
  layer(ctx, dest, { wave: 'noise', dur: .02, gain: gain * .25, filter: { type: 'bandpass', f: [freq * 4, freq * 4], q: 3 } }, time);
}
// ฆ้องวง: bossed gong — low fundamental with an inharmonic partial, long ring.
export function khong(ctx, dest, freq, time, gain = .14) {
  layer(ctx, dest, { wave: 'sine', f: [freq, freq * .995], dur: 1.6, a: .01, gain }, time);
  layer(ctx, dest, { wave: 'sine', f: [freq * 2.76, freq * 2.74], dur: .7, gain: gain * .3 }, time);
}
// ฉิ่ง: small cymbals — open "ฉิ่ง" rings, closed "ฉับ" chokes.
export function ching(ctx, dest, open, time, gain = .05) {
  layer(ctx, dest, { wave: 'square', f: [3150, 3150], dur: open ? .5 : .07, gain: gain * .35, filter: { type: 'highpass', f: [2500, 2500] } }, time);
  layer(ctx, dest, { wave: 'noise', dur: open ? .35 : .05, gain, filter: { type: 'highpass', f: [6000, 6000] } }, time);
}
// กลอง: hand drum — pitch-dropping body plus a skin slap.
export function klong(ctx, dest, time, gain = .25) {
  layer(ctx, dest, { wave: 'sine', f: [150, 58], dur: .3, gain }, time);
  layer(ctx, dest, { wave: 'noise', dur: .05, gain: gain * .3, filter: { type: 'lowpass', f: [900, 400] } }, time);
}
// Night drone: two detuned saws through a slow lowpass; returns a stop(time) function.
export function drone(ctx, dest, freq, time, gain = .05) {
  const out = ctx.createGain(); out.gain.setValueAtTime(0, time); out.gain.linearRampToValueAtTime(gain, time + 3);
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 380; lp.connect(out); out.connect(dest);
  const oscs = [freq, freq * 1.005, freq * 1.5].map(f => { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.connect(lp); o.start(time); return o; });
  return t => { out.gain.cancelScheduledValues(t); out.gain.setTargetAtTime(0, t, .8); oscs.forEach(o => o.stop(t + 4)); };
}

// ---- rock band ------------------------------------------------------------------
// Overdrive curve for the guitar bus (tanh-style soft clipping, `drive` 1–50).
export function distortionCurve(drive = 20, n = 1024) {
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; c[i] = Math.tanh(x * drive) / Math.tanh(drive); }
  return c;
}
// Kick: a fast pitch drop plus a beater click.
export function kick(ctx, dest, time, gain = .5) {
  layer(ctx, dest, { wave: 'sine', f: [160, 42], dur: .28, gain }, time);
  layer(ctx, dest, { wave: 'noise', dur: .015, gain: gain * .3, filter: { type: 'highpass', f: [2500, 2500] } }, time);
}
// Snare: noisy wires over a short drum body.
export function snare(ctx, dest, time, gain = .32) {
  layer(ctx, dest, { wave: 'noise', dur: .2, gain, filter: { type: 'bandpass', f: [2200, 1600], q: .7 } }, time);
  layer(ctx, dest, { wave: 'triangle', f: [200, 160], dur: .1, gain: gain * .7 }, time);
}
// Hi-hat (closed or open) and crash cymbal.
export function hat(ctx, dest, time, open = false, gain = .07) {
  layer(ctx, dest, { wave: 'noise', dur: open ? .28 : .04, gain, filter: { type: 'highpass', f: [8000, 8000] } }, time);
}
export function crash(ctx, dest, time, gain = .12) {
  layer(ctx, dest, { wave: 'noise', dur: 1.6, gain, filter: { type: 'highpass', f: [4500, 3500] } }, time);
}
// Power chord (root, fifth, octave; slightly detuned saws) into a distorted guitar bus.
// `mute` = palm-muted chug: short and darker.
export function powerChord(ctx, dest, root, time, dur, gain = .06, mute = false) {
  for (const [m, d] of [[1, 0], [1.4983, 4], [2, -5], [1, 7]]) {
    const f = root * m * 2 ** (d / 1200);
    layer(ctx, dest, { wave: 'sawtooth', f: [f, f], dur, a: .004, gain, filter: mute ? { type: 'lowpass', f: [900, 500], q: .8 } : undefined }, time);
  }
}
// Bass: saw through a lowpass with a sine sub.
export function bassNote(ctx, dest, freq, time, dur, gain = .16) {
  layer(ctx, dest, { wave: 'sawtooth', f: [freq, freq], dur, a: .005, gain: gain * .6, filter: { type: 'lowpass', f: [700, 300], q: 1.2 } }, time);
  layer(ctx, dest, { wave: 'sine', f: [freq, freq], dur, a: .005, gain }, time);
}
// Lead guitar note (square into the distorted bus) with a small bend up into pitch.
export function leadNote(ctx, dest, freq, time, dur, gain = .045) {
  layer(ctx, dest, { wave: 'square', f: [freq * .97, freq], dur, a: .01, gain }, time);
  layer(ctx, dest, { wave: 'sawtooth', f: [freq * 2 * .97, freq * 2], dur: dur * .8, a: .01, gain: gain * .35 }, time);
}
