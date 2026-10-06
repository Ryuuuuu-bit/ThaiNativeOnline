// Every class skill has its own sounds (SKILL_SFX in src/data/audio.js), without a browser.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SFX, SKILL_SFX } from '../src/data/audio.js';
import { MUAYTHAI_SKILLS } from '../src/classes/muaythai-moves.js';
import { HERBALIST_SKILLS } from '../src/classes/herbalist-moves.js';
import { HUNTER_SKILLS } from '../src/classes/hunter-moves.js';

const SKILLS = [...MUAYTHAI_SKILLS, ...HERBALIST_SKILLS, ...HUNTER_SKILLS];

test('all thirty skills have a signature sound that exists', () => {
  assert.equal(SKILLS.length, 30);
  for (const s of SKILLS) {
    const entry = SKILL_SFX[s.id];
    assert.ok(entry, `${s.id} (${s.name}) has sounds`);
    assert.ok(SFX[entry.cast], `${s.id}: cast sound ${entry.cast}`);
    if (entry.hit) assert.ok(SFX[entry.hit], `${s.id}: hit sound ${entry.hit}`);
  }
});

test('skills that land blows have a blow sound; pure buffs may not', () => {
  for (const s of SKILLS) if (s.hits?.length) assert.ok(SKILL_SFX[s.id].hit, `${s.id} lands ${s.hits.length} blow(s) but has no hit sound`);
});

test('no SKILL_SFX entry points at a skill that does not exist', () => {
  const ids = new Set(SKILLS.map(s => s.id));
  for (const id of Object.keys(SKILL_SFX)) assert.ok(ids.has(id), `${id} is not a class skill`);
});

test('signature sounds differ within each class', () => {
  for (const list of [MUAYTHAI_SKILLS, HERBALIST_SKILLS]) {
    const casts = list.map(s => SKILL_SFX[s.id].cast);
    assert.ok(new Set(casts).size >= list.length - 1, `at most one shared signature: ${casts.join(', ')}`);
  }
});
