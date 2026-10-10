// Sound data (src/data/audio.js) is complete and well-formed, without a browser.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SFX, SFX_EVENTS, KIT_CAST_SFX, MUSIC, MUSIC_FOR, AUDIO_DEFAULTS } from '../src/data/audio.js';
import { AVATARS } from '../src/data/training.js';

const WAVES = new Set(['sine', 'triangle', 'square', 'sawtooth', 'noise']);

test('every SFX recipe has valid layers (or a sample file)', () => {
  for (const [id, r] of Object.entries(SFX)) {
    if (r.file) { assert.equal(typeof r.file, 'string', id); continue; }
    assert.ok(r.layers?.length, `${id} has layers`);
    for (const l of r.layers) {
      assert.ok(WAVES.has(l.wave), `${id}: wave ${l.wave}`);
      assert.ok(l.dur > 0 && l.dur <= 3, `${id}: dur`);
      assert.ok(l.gain > 0 && l.gain <= 1, `${id}: gain`);
      if (l.wave !== 'noise') assert.ok(l.f?.length === 2 && l.f.every(f => f > 0), `${id}: pitch`);
      if (l.filter) assert.ok(['lowpass', 'highpass', 'bandpass'].includes(l.filter.type) && l.filter.f.every(f => f > 0), `${id}: filter`);
    }
  }
});

test('events, kits and places point at sounds and tracks that exist', () => {
  for (const [event, id] of Object.entries(SFX_EVENTS)) assert.ok(SFX[id], `${event} → ${id}`);
  for (const kit of Object.values(AVATARS).map(a => a.skills).filter(Boolean)) assert.ok(SFX[KIT_CAST_SFX[kit]], `cast sound for ${kit}`);
  for (const [place, id] of Object.entries(MUSIC_FOR)) assert.ok(MUSIC[id], `${place} → ${id}`);
  for (const id of ['ui_click', 'ui_confirm', 'step', 'hit', 'hit_crit', 'miss', 'kill', 'whoosh']) assert.ok(SFX[id], id);
});

test('music tracks have a valid tempo and a score or legacy pattern', () => {
  for (const [id, t] of Object.entries(MUSIC)) {
    assert.ok(t.bpm >= 40 && t.bpm <= 160, `${id} bpm`);
    if (t.style === 'calm') {
      assert.equal(t.chords.length, 16, `${id} harmonic cycle`);
      assert.equal(t.melody.length, t.chords.length, `${id} melody cycle`);
      assert.ok(t.chords.every(c => c.length >= 3 && c.every(n => Number.isInteger(n) && n > 20 && n < 100)), `${id} pitches`);
      assert.ok(t.melody.every(b => b.every(([at,n,len]) => at >= 0 && at < 4 && Number.isInteger(n) && len > 0)), `${id} note timing`);
      continue;
    }
    assert.ok(t.root > 50 && t.scale.length >= 5 && t.scale[0] === 0, `${id} scale`);
    if (t.style === 'rock') {
      const p = { rhythm: t.riff.rhythm, bass: t.riff.bass, ...t.drums };
      for (const [k, v] of Object.entries(p)) assert.equal(v.length, 16, `${id} ${k}`);
      assert.ok(/^[Xx.]+$/.test(t.riff.rhythm) && /^[x.]+$/.test(t.riff.bass) && /^[x.]+$/.test(t.drums.kick) && /^[x.]+$/.test(t.drums.snare) && /^[xo.]+$/.test(t.drums.hat), `${id} pattern symbols`);
      assert.ok(t.riff.chords.length && t.riff.chords.every(Number.isInteger), `${id} chords`);
    } else {
      assert.equal(t.ching.length, 16, `${id} ching`); assert.equal(t.drum.length, 16, `${id} drum`);
      assert.ok(/^[oc.]+$/.test(t.ching) && /^[x.]+$/.test(t.drum), `${id} pattern symbols`);
      assert.ok(16 % t.bass.every === 0 && t.bass.degrees.every(d => Number.isInteger(d)), `${id} bass`);
    }
  }
});

test('default volumes are between 0 and 1', () => {
  for (const k of ['master', 'music', 'sfx', 'ambience']) assert.ok(AUDIO_DEFAULTS[k] >= 0 && AUDIO_DEFAULTS[k] <= 1, k);
});
