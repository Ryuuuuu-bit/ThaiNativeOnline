import { test } from 'node:test';
import assert from 'node:assert/strict';
import { skillHitSchedule } from '../../src/rules/skillHits.js';
import { KIT_MOVES } from '../../src/character/data/kits.js';

const kitOf = id => Object.values(KIT_MOVES).flat().find(s => s.id === id);

test('focused volleys and repeated waves preserve mechanical blows across paths', () => {
  for (const [id, count] of Object.entries({ arch_quick: 2, arch_rain: 3, arch_meteor: 6, mage_akom: 3, mage_kalp: 4, mage_storm: 5 })) {
    for (const suffix of ['', '@A', '@B']) {
      const schedule = skillHitSchedule(kitOf(id), id + suffix);
      assert.equal(schedule.length, count, id + suffix);
      assert.ok(schedule.every((t, i) => Number.isFinite(t) && t >= 0 && (!i || t >= schedule[i - 1])));
    }
  }
});

test('fan projectiles do not multiply primary damage and support skills never attack', () => {
  for (const suffix of ['', '@A', '@B']) {
    assert.equal(skillHitSchedule(kitOf('mage_ghostfire'), 'mage_ghostfire' + suffix).length, 1);
    for (const id of ['mage_shield', 'mage_holy', 'mage_meditate']) {
      assert.deepEqual(skillHitSchedule(kitOf(id), id + suffix), [], id + suffix);
    }
  }
});

test('hybrid tether ticks and alternating enemy bounces retain their offensive cadence', () => {
  for (const suffix of ['', '@A', '@B']) {
    const vine = skillHitSchedule(kitOf('heal_vine'), 'heal_vine' + suffix);
    assert.equal(vine.length, 12);
    assert.ok(Math.abs(vine[1] - vine[0] - .5) < 1e-9);
    const pill = skillHitSchedule(kitOf('heal_pill'), 'heal_pill' + suffix);
    assert.equal(pill.length, 3);
    assert.ok(Math.abs(pill[1] - pill[0] - .76) < 1e-9);
  }
});
