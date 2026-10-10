// The music sequencer and SFX voices against a recording fake AudioContext, without a browser.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MUSIC, SFX } from '../src/data/audio.js';
import { MusicPlayer } from '../src/audio/Music.js';
import { CalmMusicPlayer } from '../src/audio/CalmMusic.js';
import { playRecipe } from '../src/audio/synth.js';

// Records every scheduled value and start; fails on NaN/negative times or pitches.
function fakeContext(now = 0) {
  const log = { starts: [], freqs: [], bad: [], disconnects: 0 };
  const check = (what, v) => { if (!Number.isFinite(v)) log.bad.push(`${what}=${v}`); };
  const param = name => ({
    value: 0,
    setValueAtTime(v, t) { check(name, v); check('t', t); if (name === 'freq') log.freqs.push(v); },
    linearRampToValueAtTime(v, t) { check(name, v); check('t', t); },
    exponentialRampToValueAtTime(v, t) { check(name, v); check('t', t); if (v <= 0) log.bad.push(`exp ramp to ${v}`); },
    setTargetAtTime(v, t) { check(name, v); check('t', t); }, cancelScheduledValues() {},
  });
  const node = extra => ({ connect() {}, disconnect() { log.disconnects++; }, ...extra });
  const ctx = {
    sampleRate: 22050, currentTime: now, state: 'running', destination: node(),
    createGain: () => node({ gain: param('gain') }),
    createWaveShaper: () => node({ curve: null, oversample: 'none' }),
    createBiquadFilter: () => node({ type: '', Q: param('q'), frequency: param('filter') }),
    createOscillator: () => node({ type: '', frequency: param('freq'), detune: param('detune'), setPeriodicWave() {}, start(t) { check('start', t); log.starts.push(t); }, stop() {} }),
    createStereoPanner: () => node({pan:param('pan')}),
    createPeriodicWave: (real, imag) => { for(const n of [...real,...imag]) check('partial',n); return {}; },
    createBufferSource: () => node({ buffer: null, loop: false, playbackRate: param('rate'), start(t) { check('start', t); log.starts.push(t); }, stop() {} }),
    createBuffer: (ch, len) => ({ sampleRate: 22050, getChannelData: () => new Float32Array(len) }),
  };
  return { ctx, log };
}

test('legacy rock and thai tracks schedule a steady stream of valid notes', () => {
  for (const [id, track] of Object.entries(MUSIC)) {
    if (track.style === 'calm') continue;
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

test('calm tracks schedule valid scored voices and skip a suspended backlog', () => {
  for(const [id,track] of Object.entries(MUSIC)) {
    if(track.style !== 'calm') continue;
    const {ctx,log}=fakeContext(), player=new CalmMusicPlayer(ctx,ctx.destination,track);
    player.next=0; ctx.state='suspended'; player.schedule(); assert.equal(log.starts.length,0);
    ctx.state='running'; ctx.currentTime=8; player.schedule();
    assert.equal(player.bar,1,`${id}: one bar, no backlog`);
    assert.ok(log.starts.length>=10); assert.ok(log.starts.every(t=>t>=8)); assert.deepEqual(log.bad,[]);
    const count=log.starts.length; player.stopped=true;ctx.currentTime=20;player.schedule();assert.equal(log.starts.length,count);
  }
});

test('calm cleanup waits for the audible fade in audio time, then disconnects its graph', t => {
  t.mock.timers.enable({apis:['setTimeout']});
  const {ctx,log}=fakeContext(), player=new CalmMusicPlayer(ctx,ctx.destination,MUSIC.calm_river);
  player.stop(); assert.equal(player.stopped,true);
  ctx.state='suspended'; t.mock.timers.tick(4000); assert.equal(log.disconnects,0);
  ctx.state='running';ctx.currentTime=5;t.mock.timers.tick(500);assert.equal(log.disconnects,2);
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
