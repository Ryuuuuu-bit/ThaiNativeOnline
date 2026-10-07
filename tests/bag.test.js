// Bag panel helpers (src/character/bag.js): tabs, search, better/worse arrows, auto-sort.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inTab, compareToWorn, gearScore, matchesSearch, sortedInventory, sortBag } from '../src/character/bag.js';

const fighter = { job: 'boxer' }, caster = { job: 'mage' };

test('tabs sort items by type', () => {
  assert.ok(inTab('equip', 'iron_dap') && !inTab('equip', 'potion_s'));
  assert.ok(inTab('use', 'potion_s') && inTab('use', 'ether'));
  assert.ok(inTab('material', 'hide') && !inTab('material', 'potion_s'));
  assert.ok(inTab('all', 'hide') && inTab('nonsense', 'hide'));
});

test('search matches item names', () => {
  assert.ok(matchesSearch('potion_s', 'ยาหม้อ'));
  assert.ok(!matchesSearch('hide', 'ยาหม้อ'));
  assert.ok(matchesSearch('hide', '  '));
});

test('gear is weighed for the class: casters want MATK, fighters ATK', () => {
  assert.ok(gearScore(caster, 'bone_wand') > gearScore(caster, 'iron_dap'));
  assert.ok(gearScore(fighter, 'iron_dap') > gearScore(fighter, 'bone_wand'));
});

test('arrows compare with what is worn in the same slot', () => {
  const c = { cls: fighter, equipment: { weapon: 'wood_sword', armor: 'hide_armor' } };
  assert.equal(compareToWorn(c, 'iron_dap'), 1);
  assert.equal(compareToWorn(c, 'cloth_vest'), -1);
  assert.equal(compareToWorn(c, 'krabi'), 0);          // same bonus as the worn practice sword
  assert.equal(compareToWorn(c, 'takrut'), 1);         // empty charm slot
  assert.equal(compareToWorn(c, 'potion_s'), 0);       // not gear
});

test('auto-sort: gear first by slot and rarity, stacks merged, empties last, same length', () => {
  const inv = [null, { id: 'hide', qty: 2 }, { id: 'potion_s', qty: 3 }, { id: 'cloth_vest', qty: 1 }, { id: 'hide', qty: 5 }, null, { id: 'iron_dap', qty: 1 }, { id: 'wood_sword', qty: 1 }];
  const out = sortedInventory(inv);
  assert.equal(out.length, inv.length);
  assert.deepEqual(out.filter(Boolean).map(s => s.id), ['iron_dap', 'wood_sword', 'cloth_vest', 'potion_s', 'hide']);
  assert.equal(out.find(s => s?.id === 'hide').qty, 7);
  assert.deepEqual(out.slice(5), [null, null, null]);
  // nothing gained or lost
  const total = a => a.reduce((n, s) => n + (s?.qty ?? 0), 0);
  assert.equal(total(out), total(inv));
});

test('sortBag reorders the character and tells the UI', () => {
  let told = 0;
  const c = { inventory: [null, { id: 'potion_s', qty: 1 }], emit: e => { if (e === 'inventory') told++; } };
  sortBag(c);
  assert.deepEqual(c.inventory, [{ id: 'potion_s', qty: 1 }, null]);
  assert.equal(told, 1);
});
