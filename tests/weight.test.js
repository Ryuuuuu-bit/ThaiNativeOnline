// Bag weight: items weigh something, STR raises the limit, overweight refuses pickups.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Character } from '../src/character/Character.js';
import { ITEMS } from '../src/character/data/items.js';
import { CARRY } from '../src/character/data/progression.js';
import { buy } from '../src/shop/ShopSystem.js';

const hero = (opts = {}) => new Character({ name: 'ทดสอบ', classId: 'muaythai', ...opts });

test('every item has a weight', () => {
  for (const [id, d] of Object.entries(ITEMS)) assert.ok(Number.isSafeInteger(d.weight) && d.weight >= 0, `${id} weight`);
});

test('weight counts bag stacks and equipped items; STR raises the limit', () => {
  const c = Character.create('ทดสอบ', 'muaythai');
  const expected = ITEMS.hand_wrap.weight + ITEMS.potion_s.weight * 5 + ITEMS.ether.weight * 2;
  assert.equal(c.weight, expected);
  assert.equal(c.maxWeight, CARRY.base + c.stat('str') * CARRY.perStr);
  const before = c.maxWeight;
  c.points = 1; c.allocate('str');
  assert.equal(c.maxWeight, before + CARRY.perStr);
  assert.equal(c.heavy, false);
});

test('overweight keeps what fits and refuses the rest', () => {
  const c = hero(), w = ITEMS.hide.weight;
  const fit = Math.floor(c.maxWeight / w);
  const events = []; c.on('overweight', id => events.push(id));
  assert.equal(c.addItem('hide', fit + 5), false);
  assert.equal(c.count('hide'), fit);
  assert.deepEqual(events, ['hide']);
  assert.equal(c.addItem('hide', 1), false);
  assert.equal(c.count('hide'), fit);
});

test('a heavy bag stops natural regeneration', () => {
  const c = hero();
  c.addItem('hide', Math.ceil(c.maxWeight * CARRY.heavy / ITEMS.hide.weight));
  assert.ok(c.heavy);
  c.hp = 10; c.tick(1.1, false);
  assert.equal(c.hp, 10);
  c.removeAt(c.inventory.findIndex(s => s?.id === 'hide'), c.count('hide'));
  c.tick(1.1, false);
  assert.ok(c.hp > 10);
});

test('shops refuse weighted goods that exceed capacity without charging gold', () => {
  const c = hero({ gold: 1000 });
  c.addItem('hide', Math.floor(c.maxWeight / ITEMS.hide.weight));
  const gold = c.gold, r = buy(c, 'enhance', 'sacred_ore');
  assert.equal(r.ok, false);
  assert.equal(c.gold, gold);
});

test('recovery supplies can be bought at the weight limit and do not increase weight', () => {
  const c = hero({ gold: 1000 });
  c.addItem('hide', c.maxWeight);
  const before = c.weight;
  for (const id of ['potion_s', 'potion_m', 'ether']) {
    assert.equal(ITEMS[id].weight, 0);
    const gold = c.gold;
    assert.equal(buy(c, 'general', id).ok, true);
    assert.equal(c.gold, gold - ITEMS[id].price);
  }
  assert.equal(c.weight, before);
});

test('a farming load leaves regeneration headroom for a low-STR starter', () => {
  const c = Character.create('ทดสอบ', 'shaman');
  for (const id of ['hide', 'tusk', 'ash', 'croc_scale']) assert.equal(c.addItem(id, 100), true);
  assert.equal(c.addItem('sacred_ore', 20), true);
  assert.equal(c.addItem('potion_m', 100), true);
  assert.ok(c.weight < c.maxWeight * CARRY.heavy);
  assert.equal(c.heavy, false);
});

test('weightless recovery supplies still require a bag slot', () => {
  const c = hero({ gold: 1000 });
  c.inventory.fill({ id: 'hand_wrap', qty: 1 });
  const gold = c.gold;
  assert.equal(buy(c, 'general', 'potion_m').ok, false);
  assert.equal(c.gold, gold);
});
