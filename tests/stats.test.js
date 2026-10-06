// Six base stats and rules-derived combat stats on the city Character.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Character } from '../src/character/Character.js';
import { CLASSES, STATS, POINTS_PER_LEVEL } from '../src/character/data/classes.js';
import { JOBS } from '../src/rules/data/classes.js';
import { computeDerived } from '../src/rules/stats.js';

const hero = (classId = 'muaythai', opts = {}) => new Character({ name: 'ทดสอบ', classId, ...opts });
const raise = (c, key, n) => { c.points += n; for (let i = 0; i < n; i++) c.allocate(key); };

test('every class has all six stats, a rules job and sane derived stats', () => {
  assert.deepEqual(STATS, ['str', 'agi', 'vit', 'int', 'dex', 'luk']);
  for (const [id, cls] of Object.entries(CLASSES)) {
    for (const k of STATS) assert.ok(Number.isFinite(cls.base[k]) && Number.isFinite(cls.growth[k]), `${id}.${k}`);
    assert.ok(JOBS[cls.job], `${id} job ${cls.job}`);
    const c = Character.create('t', id);
    for (const v of [c.maxHp, c.maxMp, c.patk, c.matk, c.defense, c.accuracy]) assert.ok(v > 0, `${id} derived`);
    assert.ok(c.critChance > 0 && c.critChance < .75 && c.critDamage >= 1.5, `${id} crit`);
  }
});

test('derived stats are the rules formulas', () => {
  const c = Character.create('t', 'herbalist');   // wears the herb staff (MATK +4, INT +1)
  const s = Object.fromEntries(STATS.map(k => [k.toUpperCase(), c.stat(k)]));
  const want = computeDerived(s, JOBS.healer, 1, { matk: 4 });
  assert.equal(c.maxHp, want.maxHp);
  assert.equal(c.matk, want.matk);
  assert.equal(c.attack, c.matk, 'spell classes attack with MATK');
  assert.equal(hero('warrior').attack, hero('warrior').patk);
});

test('each stat raises what the sheet says', () => {
  const pairs = [['str', c => c.patk], ['str', c => c.maxWeight], ['vit', c => c.maxHp], ['vit', c => c.defense],
    ['int', c => c.matk], ['int', c => c.maxMp], ['dex', c => c.accuracy], ['dex', c => c.cooldownCut],
    ['agi', c => c.evasion], ['agi', c => c.attackSpeed], ['luk', c => c.critChance], ['luk', c => c.critDamage]];
  for (const [key, read] of pairs) {
    const c = hero(), before = read(c);
    raise(c, key, 10);
    assert.ok(read(c) > before, `${key} → ${read}`);
  }
  const archer = hero('hunter'), atk = archer.patk;
  raise(archer, 'dex', 10);
  assert.ok(archer.patk > atk, 'ranged ATK follows DEX');
});

test('levels grant points and growth; reset refunds all six', () => {
  const c = hero();
  c.gainExp(c.expNeeded);
  assert.equal(c.level, 2);
  assert.equal(c.points, POINTS_PER_LEVEL);
  assert.equal(c.stat('str'), CLASSES.muaythai.base.str + CLASSES.muaythai.growth.str);
  raise(c, 'luk', 2); raise(c, 'dex', 1);
  c.resetStats();
  assert.equal(c.points, POINTS_PER_LEVEL + 3);
  assert.ok(STATS.every(k => c.alloc[k] === 0));
});

test('old four-stat saves load with DEX and LUK at zero and HP within the cap', () => {
  const c = hero('muaythai', { alloc: { str: 2, agi: 1, int: 0, vit: 0 }, hp: 99999, mp: 99999 });
  assert.equal(c.alloc.dex, 0); assert.equal(c.alloc.luk, 0); assert.equal(c.alloc.str, 2);
  assert.equal(c.hp, c.maxHp); assert.equal(c.mp, c.maxMp);
});

test('buffs: attack, guard and smoke still apply', () => {
  const c = hero(), atk = c.attack, def = c.defense, evade = c.evadeChance(100);
  c.addBuff({ id: 'waikru', atk: .3, duration: 5 });
  c.addBuff({ id: 'guard', def: .5, duration: 5 });
  c.addBuff({ id: 'smoke', dodge: .3, duration: 5 });
  assert.ok(c.attack > atk && c.defense >= def && c.evadeChance(100) > evade);
});
