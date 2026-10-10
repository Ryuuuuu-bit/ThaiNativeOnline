import { createFlask } from '../src/character/data/flasks.js';
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
  assert.ok(gearScore(caster, 'palm_book') > gearScore(caster, 'iron_dap'));
  assert.ok(gearScore(fighter, 'iron_dap') > gearScore(fighter, 'palm_book'));
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

 test('reusable flasks belong to equipment and sort individually before consumables, HP before MP',()=>{
  for(const id of ['flask_hp_1','flask_mp_1']){
    assert.ok(inTab('equip',id));assert.equal(inTab('use',id),false);assert.equal(inTab('material',id),false);
  }
  const hp=createFlask('flask_hp_1'), second=createFlask('flask_hp_1'),mp=createFlask('flask_mp_1');hp.flask.charges=0;second.flask.charges=13;
  const sorted=sortedInventory([{id:'potion_s',qty:3},mp,hp,second,null]);
  assert.deepEqual(sorted.map(x=>x?.id??null),['flask_hp_1','flask_hp_1','flask_mp_1','potion_s',null]);
  assert.deepEqual(sorted.slice(0,2).map(x=>x.flask.charges),[0,13]);
  assert.equal(new Set(sorted.slice(0,3).map(x=>x.flask.iid)).size,3);
  sorted[0].flask.charges=40;assert.equal(hp.flask.charges,0);
 });
