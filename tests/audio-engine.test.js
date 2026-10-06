// The music sequencer and SFX voices against a recording fake AudioContext, without a browser.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MUSIC, SFX } from '../src/data/audio.js';
import { MusicPlayer } from '../src/audio/Music.js';
import { playRecipe } from '../src/audio/synth.js';

// Records every scheduled value and start; fails on NaN/negative times or pitches.
function fakeContext(now = 0) {
  const log = { starts: [], freqs: [], bad: [] };
  const check = (what, v) => { if (!Number.isFinite(v)) log.bad.push(`${what}=${v}`); };
  const param = name => ({
    value: 0,
    setValueAtTime(v, t) { check(name, v); check('t', t); if (name === 'freq') log.freqs.push(v); },
    linearRampToValueAtTime(v, t) { check(name, v); check('t', t); },
    exponentialRampToValueAtTime(v, t) { check(name, v); check('t', t); if (v <= 0) log.bad.push(`exp ramp to ${v}`); },
    setTargetAtTime(v, t) { check(name, v); check('t', t); }, cancelScheduledValues() {},
  });
  const node = extra => ({ connect() {}, disconnect() {}, ...extra });
  const ctx = {
    sampleRate: 22050, currentTime: now, destination: node(),
    createGain: () => node({ gain: param('gain') }),
    createWaveShaper: () => node({ curve: null, oversample: 'none' }),
    createBiquadFilter: () => node({ type: '', Q: param('q'), frequency: param('filter') }),
    createOscillator: () => node({ type: '', frequency: param('freq'), start(t) { check('start', t); log.starts.push(t); }, stop() {} }),
    createBufferSource: () => node({ buffer: null, loop: false, playbackRate: param('rate'), start(t) { check('start', t); log.starts.push(t); }, stop() {} }),
    createBuffer: (ch, len) => ({ sampleRate: 22050, getChannelData: () => new Float32Array(len) }),
  };
  return { ctx, log };
}

test('each track (rock and thai) schedules a steady stream of valid notes', () => {
  for (const [id, track] of Object.entries(MUSIC)) {
    const { ctx, log } = fakeContext();
    const player = new MusicPlayer(ctx, ctx.destination, track);
    player.next = 0;
    ctx.currentTime = 8; // schedule() fills everything up to now + lookahead
    player.schedule();
    const sixteenth = 60 / track.bpm / 4, steps = Math.round(8.15 / sixteenth);
    assert.deepEqual(log.bad, [], `${id}: invalid values`);
    assert.ok(player.step >= steps - 1, `${id}: ${player.step} steps for ${steps}`);
    assert.ok(log.starts.length > steps / 2, `${id}: ${log.starts.length} voices`);
    assert.ok(log.freqs.every(f => f > 20 && f < 20000), `${id}: audible pitches`);
    assert.ok(Math.max(...log.starts) <= 8.2, `${id}: nothing scheduled past the lookahead`);
  }
});

test('phrases stay inside the melody range and resolve home', () => {
  const player = new MusicPlayer(fakeContext().ctx, null, MUSIC.day);
  for (let i = 0; i < 50; i++) {
    const p = player.makePhrase();
    assert.equal(p.length, 16);
    assert.equal(p[15], 0);
    assert.ok(p.every(n => n === null || (n >= 0 && n <= MUSIC.day.melody.range)));
  }
});

test('every SFX recipe schedules valid voices', () => {
  for (const [id, recipe] of Object.entries(SFX)) {
    if (recipe.file) continue;
    const { ctx, log } = fakeContext(1);
    playRecipe(ctx, ctx.destination, recipe, 1);
    assert.deepEqual(log.bad, [], `${id}: invalid values`);
    assert.equal(log.starts.length, recipe.layers.length, `${id}: one voice per layer`);
  }
});
