// Training-ground damage (src/training/damage.js) against the rules, without a browser.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { boxerDerived, skillMult, rollSkill } from '../src/training/damage.js';
import { TRAINING } from '../src/data/training.js';
import { MUAYTHAI_SKILLS } from '../src/forest/muaythai-moves.js';

const { stats, level } = TRAINING.fighter;
const d = boxerDerived(stats, level);
// rng sequence: [hit roll, variance roll, crit roll]
const seq = values => { let i = 0; return () => values[i++ % values.length]; };

test('every hotbar skill exists in the rules; only buffs deal no damage', () => {
  const buffs = new Set(['boxer_waikru', 'boxer_drum', 'boxer_iron']);
  for (const s of MUAYTHAI_SKILLS) {
    const mult = skillMult(s.id);
    if (buffs.has(s.id)) assert.equal(mult, null, s.id);
    else assert.ok(mult > 0, `${s.id} has a damage multiplier`);
  }
});

test('a plain hit is patk × mult (mid variance, no armour, no crit)', () => {
  const r = rollSkill(d, { def: 0, eva: 0 }, 'boxer_kick', 1, seq([0, .5, .99]));
  assert.deepEqual(r, { hit: true, crit: false, dmg: Math.round(d.patk * 2.0) });
});

test('a crit multiplies by critDmg; armour subtracts half of DEF', () => {
  const crit = rollSkill(d, { def: 0, eva: 0 }, 'boxer_jab', 1, seq([0, .5, 0]));
  assert.equal(crit.crit, true);
  assert.equal(crit.dmg, Math.round(d.patk * .9 * d.critDmg));
  const armoured = rollSkill(d, { def: 40, eva: 0 }, 'boxer_kick', 1, seq([0, .5, .99]));
  assert.equal(armoured.dmg, Math.round(d.patk * 2.0 - 20));
});

test('evasion can make a blow miss', () => {
  const r = rollSkill(d, { def: 0, eva: 500 }, 'boxer_jab', 1, seq([.99]));
  assert.deepEqual(r, { hit: false, crit: false, dmg: 0 });
});

test('skill level raises the multiplier 15% per level', () => {
  assert.equal(skillMult('boxer_ngouy', 1), 4);
  assert.equal(skillMult('boxer_ngouy', 5), +(4 * 1.6).toFixed(3));
});

test('buffs roll a harmless zero', () => {
  assert.deepEqual(rollSkill(d, { def: 0, eva: 0 }, 'boxer_waikru'), { hit: true, crit: false, dmg: 0 });
});
