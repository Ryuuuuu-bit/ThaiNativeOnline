// Training-ground damage (src/training/damage.js) against the rules, without a browser.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { boxerDerived, jobDerived, skillMult, rollSkill } from '../src/training/damage.js';
import { TRAINING } from '../src/data/training.js';
import { MUAYTHAI_SKILLS } from '../src/classes/muaythai-moves.js';
import { SKILL_BY_ID } from '../src/rules/data/skills.js';
import { PLAYER_DAMAGE_MULT } from '../src/rules/stats.js';

const M = id => SKILL_BY_ID[id].mult;   // Lv1 multiplier from the rules table

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

test('a plain hit is patk × mult × player damage tuning (mid variance, no armour, no crit)', () => {
  const r = rollSkill(d, { def: 0, eva: 0 }, 'boxer_kick', 1, seq([0, .5, .99]));
  assert.deepEqual(r, { hit: true, crit: false, dmg: Math.round(d.patk * M('boxer_kick') * PLAYER_DAMAGE_MULT) });
});

test('a crit multiplies by critDmg; armour subtracts half of DEF', () => {
  const crit = rollSkill(d, { def: 0, eva: 0 }, 'boxer_jab', 1, seq([0, .5, 0]));
  assert.equal(crit.crit, true);
  assert.equal(crit.dmg, Math.round(d.patk * M('boxer_jab') * d.critDmg * PLAYER_DAMAGE_MULT));
  const armoured = rollSkill(d, { def: 40, eva: 0 }, 'boxer_kick', 1, seq([0, .5, .99]));
  assert.equal(armoured.dmg, Math.round((d.patk * M('boxer_kick') - 20) * PLAYER_DAMAGE_MULT));
});

test('evasion can make a blow miss', () => {
  const r = rollSkill(d, { def: 0, eva: 500 }, 'boxer_jab', 1, seq([.99]));
  assert.deepEqual(r, { hit: false, crit: false, dmg: 0 });
});

test('skill level raises the multiplier 8% per level (Lv.10 = ×1.72)', () => {
  assert.equal(skillMult('boxer_ngouy', 1), M('boxer_ngouy'));
  assert.equal(skillMult('boxer_ngouy', 5), +(M('boxer_ngouy') * 1.32).toFixed(3));
  assert.equal(skillMult('boxer_ngouy', 10), +(M('boxer_ngouy') * 1.72).toFixed(3));
});

test('buffs roll a harmless zero', () => {
  assert.deepEqual(rollSkill(d, { def: 0, eva: 0 }, 'boxer_waikru'), { hit: true, crit: false, dmg: 0 });
});

test('the herbalist is playable: model, ten-skill kit and a healer trainee', async () => {
  const { AVATARS, classReady } = await import('../src/data/training.js');
  const { HERBALIST_SKILLS } = await import('../src/classes/herbalist-moves.js');
  assert.ok(classReady('muaythai') && classReady('herbalist'));
  assert.equal(AVATARS.herbalist.skills, 'herbalist');
  assert.equal(AVATARS.herbalist.job, 'healer');
  assert.equal(HERBALIST_SKILLS.length, 10);
  assert.deepEqual(HERBALIST_SKILLS.map(s => s.key), ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0']);
  const f = TRAINING.fighter, healer = jobDerived('healer', f.byJob.healer, f.level);
  assert.ok(healer.matk > d.matk, 'the herbalist trains on INT');
});
