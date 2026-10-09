import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ITEMS } from '../src/character/data/items.js';
import { CLASSES, START_ITEMS, WEAPON_KINDS } from '../src/character/data/classes.js';
import { Character } from '../src/character/Character.js';
import { Combatants } from '../server/combatants.js';
import { REFINE_MAX, REFINE_RATE, REFINE_MILESTONES, refinable, refineBonus, refineCost } from '../src/character/data/refine.js';

const value = (d, n) => Object.values(refineBonus(d, n) ?? { value: 0 })[0];

test('milestones reward difficulty: rare weapon +15/+42/+99, with larger high-tier gains', () => {
  assert.deepEqual(REFINE_MILESTONES, [4, 7, 10]);
  assert.deepEqual(REFINE_MILESTONES.map(n => value(ITEMS.iron_dap, n)), [15, 42, 99]);
  assert.deepEqual(REFINE_MILESTONES.map(n => value(ITEMS.demon_rift_sword, n)), [27, 76, 179]);
  const gains = Array.from({ length: 10 }, (_, i) => value(ITEMS.iron_dap, i + 1) - value(ITEMS.iron_dap, i));
  assert.deepEqual(gains, [3, 3, 3, 6, 6, 9, 12, 15, 18, 24]);
  assert.deepEqual(REFINE_RATE, [1, 1, 1, 1, 1, .6, .5, .4, .3, .2, .1]);
  for (let n = 0; n < REFINE_MAX; n++) {
    assert.deepEqual(refineCost(ITEMS.iron_dap, n), { to: n + 1, gold: 100 * (n + 1), ore: 'sacred_ore', rate: REFINE_RATE[n + 1], risky: n >= 4 });
    assert.equal(refineCost(ITEMS.hide_armor, n).ore, 'gold_leaf');
  }
});

test('all six weapon kinds scale from starter to Lv90 while keeping ATK/MATK identity', () => {
  assert.equal(Object.keys(CLASSES).length, 6);
  for (const cls of Object.keys(CLASSES)) {
    const starter = ITEMS[START_ITEMS[cls][0]], kind = WEAPON_KINDS[cls][0];
    const tiers = Object.values(ITEMS).filter(d => !d.retired && d.slot === 'weapon' && d.weapon === kind);
    const late = tiers.find(d => d.minLevel === 90), key = CLASSES[cls].magic ? 'matk' : 'atk';
    assert.ok(late, `${cls}: Lv90 weapon exists`);
    for (const d of tiers) {
      for (let n = 1; n <= REFINE_MAX; n++) {
        const bonus = refineBonus(d, n);
        assert.deepEqual(Object.keys(bonus), [key], `${cls}: correct primary stat`);
        assert.ok(bonus[key] > value(d, n - 1));
        const original = { common: 2, rare: 3, epic: 5 }[d.rarity] ?? 2;
        assert.ok(bonus[key] >= n * original, `${d.name} +${n}: no bonus regression`);
        assert.ok(bonus[key] <= Math.max(33 * original, Math.ceil(d.bonus[key] * 1.32)), 'bounded +10 reward');
      }
    }
    for (const n of REFINE_MILESTONES) assert.ok(value(late, n) > value(starter, n), `${cls} +${n}: stronger gear retains value`);
  }
});

test('armor, head, cape and shoes keep DEF only, scale across every expedition and cap at +10', () => {
  const gear = Object.values(ITEMS).filter(d => !d.retired && refinable(d) && d.slot !== 'weapon');
  assert.deepEqual([...new Set(gear.map(d => d.slot))].sort(), ['armor', 'cape', 'head', 'shoes']);
  assert.deepEqual(REFINE_MILESTONES.map(n => value(ITEMS.cloth_vest, n)), [5, 14, 33]);
  assert.deepEqual(REFINE_MILESTONES.map(n => value(ITEMS.demon_rift_armor, n)), [9, 24, 57]);
  for (const d of gear) for (let n = 1; n <= REFINE_MAX; n++) {
    const bonus = refineBonus(d, n);
    assert.deepEqual(Object.keys(bonus), ['def']);
    assert.ok(bonus.def > value(d, n - 1), `${d.name} +${n}: strictly increasing`);
    assert.ok(bonus.def >= n, 'at least the previous bonus');
    assert.ok(bonus.def <= Math.max(33, Math.ceil((d.bonus?.def ?? 0) * .825)), 'bounded +10 reward');
  }
  const armor = gear.filter(d => d.slot === 'armor').sort((a, b) => (a.bonus.def ?? 0) - (b.bonus.def ?? 0));
  for (let i = 1; i < armor.length; i++) for (const n of REFINE_MILESTONES) assert.ok(value(armor[i], n) >= value(armor[i - 1], n), 'armor tiers never invert');
});

test('invalid levels never produce stats or an invalid attempt; excess saved integers cap safely', () => {
  for (const n of [undefined, null, -10, -1, .5, 1.5, NaN, Infinity, -Infinity, '4', {}, []]) {
    assert.equal(refineBonus(ITEMS.iron_dap, n), null, String(n));
    if (n !== undefined) assert.equal(refineCost(ITEMS.iron_dap, n), null, String(n));
  }
  for (const n of [11, 99, Number.MAX_SAFE_INTEGER]) {
    assert.deepEqual(refineBonus(ITEMS.iron_dap, n), refineBonus(ITEMS.iron_dap, REFINE_MAX));
    assert.equal(refineCost(ITEMS.iron_dap, n), null);
  }
  assert.equal(refineBonus(ITEMS.takrut, 10), null);
  assert.equal(refineBonus(ITEMS.potion_s, 10), null);
  assert.equal(refineBonus(undefined, 10), null);
  assert.deepEqual(refineBonus({ type: 'equip', slot: 'weapon', bonus: { atk: NaN } }, 10), { atk: 66 });
  assert.deepEqual(refineBonus({ type: 'equip', slot: 'armor', bonus: { def: Infinity } }, 10), { def: 33 });
});

test('old saves adopt bonuses without rewriting IDs, cards, refinement, or bag instances; server matches all classes', () => {
  for (const cls of Object.keys(CLASSES)) {
    const weapon = `demon_rift_${WEAPON_KINDS[cls][0]}`, key = CLASSES[cls].magic ? 'matk' : 'atk';
    const old = { ...Character.create('QA', cls).toJSON(), level: 100, equipment: { weapon, armor: 'demon_rift_armor' }, cards: { weapon: ['card_boar'], armor: ['card_croc'] }, refine: { weapon: 7, armor: 4 }, inventory: [{ id: weapon, qty: 1, plus: 10, cards: ['card_boar'] }, ...Array(23).fill(null)] };
    const c = new Character(old), before = new Character({ ...c.toJSON(), refine: { weapon: 0, armor: 0 } });
    assert.equal(c.equipBonus(key) - before.equipBonus(key), refineBonus(ITEMS[weapon], 7)[key]);
    assert.equal(c.defense - before.defense, refineBonus(ITEMS.demon_rift_armor, 4).def);
    assert.deepEqual(c.inventory[0], old.inventory[0]);
    assert.equal(c.refine.weapon, 7); assert.equal(c.refine.armor, 4);
    assert.deepEqual(c.cards.weapon, old.cards.weapon); assert.deepEqual(c.cards.armor, old.cards.armor);
    const roundTrip = new Character(JSON.parse(JSON.stringify(c.toJSON())));
    assert.deepEqual(roundTrip.toJSON(), c.toJSON(), `${cls}: idempotent save`);
    c.unequip('weapon');
    const wornCopy = c.inventory.findIndex(s => s?.id === weapon && s.plus === 7);
    assert.ok(wornCopy >= 0); assert.deepEqual(c.inventory[wornCopy].cards, ['card_boar']);
    c.equip(wornCopy); assert.equal(c.refine.weapon, 7); assert.deepEqual(c.cards.weapon, ['card_boar']);
    const cs = new Combatants({ now: () => 100 }); cs.load(1, c.toJSON(), { account: 'qa', slot: 0 });
    assert.deepEqual(cs.get(1).c.derived, c.derived, `${cls}: shared server/client stats`);
    assert.deepEqual(cs.get(1).c.inventory, c.inventory);
  }
});
