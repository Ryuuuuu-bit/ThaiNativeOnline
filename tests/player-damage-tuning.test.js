import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PLAYER_DAMAGE_MULT, computeDerived, rollDamage } from '../src/rules/stats.js';
import { JOBS } from '../src/rules/data/classes.js';
import { Character } from '../src/character/Character.js';
import { SKILLS as LEGACY } from '../src/combat/data/skills.js';
import { RULES } from '../src/combat/data/rules.js';
import { rollSkill } from '../src/training/damage.js';
import { healPower, selfEffects } from '../src/training/kitCombat.js';

const sequence = values => {
  let i = 0;
  return () => {
    assert.ok(i < values.length, 'damage tuning must not add random draws');
    return values[i++];
  };
};
const rolls = (kind, crit = false, mob = false) => sequence(kind === 'magic' && !mob ? [.5, crit ? 0 : .99] : [0, .5, crit ? 0 : .99]);
const attacker = Object.freeze({ patk: 100.4, matk: 140.2, accuracy: 90, critRate: .25, critDmg: 1.7 });
const defender = Object.freeze({ def: 27.3, eva: 0 });

// Fixed results include armor subtraction, critical scaling and a single final rounding.
for (const [kind, normal, critical, mobNormal, mobCritical] of [
  ['physical', 149, 253, 124, 211],
  ['magic', 222, 378, 185, 315],
  ['best', 214, 364, 178, 303],
]) {
  test(`${kind} player hits gain 20% after armor and critical scaling`, () => {
    assert.equal(PLAYER_DAMAGE_MULT, 1.2);
    assert.deepEqual(rollDamage(attacker, defender, kind, 1.37, rolls(kind)), { hit: true, crit: false, dmg: normal });
    assert.deepEqual(rollDamage(attacker, defender, kind, 1.37, rolls(kind, true)), { hit: true, crit: true, dmg: critical });
  });
  test(`${kind} mob-marked normal and critical rolls retain their original damage`, () => {
    const mob = Object.freeze({ ...attacker, mob: true });
    assert.deepEqual(rollDamage(mob, defender, kind, 1.37, rolls(kind, false, true)), { hit: true, crit: false, dmg: mobNormal });
    assert.deepEqual(rollDamage(mob, defender, kind, 1.37, rolls(kind, true, true)), { hit: true, crit: true, dmg: mobCritical });
  });
}

test('player scaling happens before final rounding and keeps the minimum-hit floor', () => {
  const atk = { ...attacker, patk: 21.49 };
  assert.equal(rollDamage(atk, { def: 40 }, 'physical', 1, rolls('physical')).dmg, 2, '1.49 × 1.2 rounds to two; rounding the old damage first would give one');
  assert.equal(rollDamage({ ...atk, mob: true }, { def: 40 }, 'physical', 1, rolls('physical')).dmg, 1);
  assert.equal(rollDamage(attacker, { def: 10000 }, 'physical', 1, rolls('physical')).dmg, 1);
});

test('misses stay zero, player magic still always hits, and monster magic remains avoidable', () => {
  const lowAccuracy = { ...attacker, accuracy: 0 }, evasive = { def: 0, eva: 100 };
  assert.deepEqual(rollDamage(lowAccuracy, evasive, 'physical', 1, sequence([.99])), { hit: false, crit: false, dmg: 0 });
  assert.deepEqual(rollDamage({ ...lowAccuracy, mob: true }, evasive, 'magic', 1, sequence([.99])), { hit: false, crit: false, dmg: 0 });
  assert.equal(rollDamage(lowAccuracy, evasive, 'magic', 1, rolls('magic')).hit, true);
  assert.equal(rollDamage(attacker, defender, 'physical', 1, sequence([0, .5, .249])).crit, true);
  assert.equal(rollDamage(attacker, defender, 'physical', 1, sequence([0, .5, .251])).crit, false);
});

test('rollSkill applies the modifier once and preserves an explicit mob marker', () => {
  assert.deepEqual(rollSkill(attacker, defender, 'boxer_kick', 1, rolls('physical')), { hit: true, crit: false, dmg: 261 });
  assert.deepEqual(rollSkill({ ...attacker, mob: true }, defender, 'boxer_kick', 1, rolls('physical')), { hit: true, crit: false, dmg: 217 });
  assert.deepEqual(rollSkill(attacker, defender, 'boxer_kick', 1, rolls('physical', true)), { hit: true, crit: true, dmg: 443 });
  assert.deepEqual(rollSkill(attacker, defender, 'boxer_waikru'), { hit: true, crit: false, dmg: 0 });
});

// All six Character classes, including Assassin's legacy-only skill path. Naked Lv100,
// DEF40, neutral variance: derived stats remain the same while outgoing hits increase.
const classCases = [
  { id: 'muaythai', skill: 'boxer_kick', basic: 1336, damage: 4563, base: [2744, 432, 1259, 153, .111] },
  { id: 'warrior', skill: 'sword_thrust', basic: 1488, damage: 5964, base: [4238, 427, 1260, 153, .112] },
  { id: 'hunter', skill: 'arch_poison', basic: 971, damage: 2865, base: [2441, 437, 829, 153, .4485] },
  { id: 'shaman', skill: 'mage_akom', basic: 2879, damage: 2477, base: [2152, 2421, 202, 2095, .166] },
  { id: 'herbalist', skill: 'heal_pill', basic: 1816, damage: 3124, base: [2912, 2025, 200, 1523, .159] },
  { id: 'assassin', skill: 'shadow', basic: 555, damage: 3069, base: [2083, 432, 643, 153, .407] },
];
for (const row of classCases) test(`${row.id} basic and characteristic skill receive the shared tuning`, () => {
  const c = new Character({ name: 'ทดสอบ', classId: row.id, level: 100 });
  const before = c.toJSON(), derived = c.derived;
  assert.deepEqual([c.maxHp, c.maxMp, c.patk, c.matk], row.base.slice(0, 4));
  assert.ok(Math.abs(c.critChance - row.base[4]) < 1e-12);
  const atk = { ...derived, patk: c.patk, matk: c.matk, critRate: c.critChance };
  const basic = LEGACY[c.cls.skills.find(id => LEGACY[id]?.basic)], kind = basic.scale === 'int' ? 'magic' : 'physical';
  assert.deepEqual(rollDamage(atk, { def: 40, eva: 0 }, kind, basic.power, rolls(kind)), { hit: true, crit: false, dmg: row.basic });
  const legacy = LEGACY[row.skill];
  const result = legacy
    ? rollDamage({ ...atk, critRate: legacy.alwaysCrit ? 1 : atk.critRate }, { def: 40, eva: 0 }, kind, legacy.power, rolls(kind))
    : rollSkill(atk, { def: 40, eva: 0 }, row.skill, 5, rolls(kind));
  assert.deepEqual(result, { hit: true, crit: !!legacy?.alwaysCrit, dmg: row.damage });
  assert.deepEqual(c.derived, derived);
  assert.deepEqual(c.toJSON(), before, 'rolling attacks changes no HP, MP or persisted character state');
});

test('Hunter pet basic, pounce and critical bites gain the same single damage modifier', () => {
  const c = new Character({ name: 'ทดสอบ', classId: 'hunter', level: 100 }), def = { def: 40, eva: 0 };
  assert.equal(rollDamage(c.derived, def, 'physical', RULES.petBite * c.petBiteMul, rolls('physical')).dmg, 424);
  assert.equal(rollDamage(c.derived, def, 'physical', RULES.petBite * c.petBiteMul * 1.5, rolls('physical')).dmg, 647);
  assert.deepEqual(rollDamage(c.derived, def, 'physical', RULES.petBite * c.petBiteMul, rolls('physical', true)), { hit: true, crit: true, dmg: 748 });
});

test('derived HP, MP, ATK, critical chance and healing retain their pre-tuning values', () => {
  const d = computeDerived({ STR: 10, AGI: 20, VIT: 30, INT: 40, DEX: 50, LUK: 60 }, JOBS.healer, 100, { healMul: .25 });
  assert.deepEqual(d, { maxHp: 1445, maxMp: 757, patk: 237, matk: 288, accuracy: 155, critRate: .27999999999999997, critDmg: 1.8, def: 20, eva: 24, aspd: .06, castRed: .06, healPow: 1.25 });
  assert.equal(healPower('heal_pill', 5, d.matk), 399);
  assert.equal(selfEffects('heal_pill', 5, d.def, d.matk, d.healPow).hp, 499);
  assert.deepEqual(rollSkill(d, { def: 0, eva: 0 }, 'heal_vine'), { hit: true, crit: false, dmg: 0 });
});
