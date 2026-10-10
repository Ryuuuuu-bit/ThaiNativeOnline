import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Character } from '../src/character/Character.js';
import { INVENTORY_SIZE } from '../src/character/inventoryCapacity.js';
import { fromSave, reconcileSave, applyOp } from '../server/progress.js';
import { Combatants } from '../server/combatants.js';
import { Accounts } from '../server/accounts.js';
import { MemoryStore } from '../server/store.js';
import { swap } from '../server/trades.js';
import { ITEMS } from '../src/character/data/items.js';
import { sortBag } from '../src/character/bag.js';

const hero = () => Character.create('BagQA', 'warrior');
const save = c => ({ 'tno.character.v1': JSON.stringify(c) });
const filled = () => Array.from({ length: INVENTORY_SIZE }, () => ({ id: 'ash', qty: 1 }));

test('new bags have 500 slots; a 24-slot save expands without moving items or changing weight', () => {
  const fresh = hero(); assert.equal(fresh.inventory.length, 500);
  const old = fresh.toJSON(); old.inventory = Array(24).fill(null);
  old.inventory[0] = { id: 'ash', qty: 7 };
  old.inventory[23] = { id: 'iron_dap', qty: 1, plus: 3, cards: ['card_boar'], locked: true };
  const c = new Character(old);
  assert.equal(c.inventory.length, 500);
  assert.deepEqual(c.inventory.slice(0, 24), old.inventory);
  assert.ok(c.inventory.slice(24).every(s => s === null));
  assert.equal(c.weight, fresh.weight + ITEMS.ash.weight * 7 + ITEMS.iron_dap.weight);
  assert.equal(c.maxWeight, fresh.maxWeight);
  assert.deepEqual(new Character(c.toJSON()).inventory, c.inventory);
});

test('larger legacy inventories retain cells after slot 499 through server loading and saves', () => {
  const raw = hero().toJSON(); raw.inventory = Array(523).fill(null);
  raw.inventory[522] = { id: 'iron_dap', qty: 1, plus: 4, locked: true };
  const c = fromSave(raw);
  assert.equal(c.inventory.length, 523);
  assert.deepEqual(c.inventory[522], raw.inventory[522]);
  const persisted = JSON.parse(reconcileSave(save(raw), c.toJSON())['tno.character.v1']);
  assert.equal(persisted.inventory.length, 523);
  assert.deepEqual(persisted.inventory[522], raw.inventory[522]);
  sortBag(c); assert.equal(c.inventory.length, 523);
  assert.ok(c.inventory.some(s => s?.id === 'iron_dap' && s.plus === 4 && s.locked));
});

test('offline account save reconciliation expands the stored bag and never trusts client loot', async () => {
  const store = new MemoryStore(), accounts = new Accounts(store);
  const raw = hero().toJSON(); raw.inventory = Array(24).fill(null); raw.inventory[23] = { id: 'ash', qty: 9 };
  await store.putSlot('bagqa', 0, save(raw));
  const forged = { ...raw, inventory: filled(), gold: 999999 };
  assert.ok((await accounts.save('bagqa', 0, save(forged))).ok);
  const restored = await accounts.character('bagqa', 0);
  assert.equal(restored.inventory.length, 500);
  assert.deepEqual(restored.inventory[23], raw.inventory[23]);
  assert.equal(restored.inventory.filter(Boolean).length, 1);
  assert.equal(restored.gold, raw.gold);
  const full = { ...raw, inventory: filled() };
  assert.equal(accounts.check(save(full)), null, '500 occupied cells pass the existing save validator');
});

test('authoritative kill rewards use slot 499 and full bags still refuse another gear item', () => {
  const cs = new Combatants(); cs.load(1, hero().toJSON(), { account: 'bagqa', slot: 0 });
  const c = cs.get(1).c; c.inventory = filled(); c.inventory[499] = null;
  const drop = { id: 'iron_dap', qty: 1 };
  assert.equal(cs.reward(1, { exp: 0, gold: 0, drops: [drop] }).lost, undefined);
  assert.deepEqual(c.inventory[499], drop);
  assert.deepEqual(cs.reward(1, { exp: 0, gold: 0, drops: [drop] }).lost, [drop]);
  assert.equal(c.inventory.length, 500);
});

test('trade copies preserve 500-slot capacity and still enforce full bags and weight', () => {
  const a = hero(), b = hero(); a.inventory.fill(null); a.inventory[499] = { id: 'iron_dap', qty: 1 };
  b.inventory = filled(); b.inventory[499] = null;
  const offer = { items: [{ id: 'iron_dap', qty: 1 }], gold: 0 }, empty = { items: [], gold: 0 };
  assert.ok(swap(a, b, offer, empty).ok);
  assert.equal(a.inventory[499], null); assert.equal(b.inventory[499].id, 'iron_dap');
  a.inventory[499] = { id: 'iron_dap', qty: 1 };
  const before = JSON.stringify([a.toJSON(), b.toJSON()]);
  assert.equal(swap(a, b, offer, empty).why, 'room_b');
  assert.equal(JSON.stringify([a.toJSON(), b.toJSON()]), before);
  b.inventory.fill(null); b.inventory[0] = { id: 'ash', qty: Math.ceil(b.maxWeight / ITEMS.ash.weight) + 1 };
  assert.equal(swap(a, b, offer, empty).why, 'room_b', 'empty slots do not bypass weight');
});

test('500-row bulk sale validates atomically, credits once and rejects duplicate/stale/locked rows', () => {
  const c = hero(); c.inventory = filled();
  const lines = c.inventory.map((s, index) => ({ index, id: s.id, qty: 1 }));
  const before = JSON.stringify(c.toJSON());
  assert.equal(applyOp(c, { op: 'sell_batch', lines: [...lines.slice(0, 499), lines[0]] }), false);
  assert.equal(JSON.stringify(c.toJSON()), before);
  assert.equal(applyOp(c, { op: 'sell_batch', lines: [...lines.slice(0, 499), { ...lines[499], id: 'iron_dap' }] }), false);
  c.inventory[499].locked = true;
  assert.equal(applyOp(c, { op: 'sell_batch', lines }), false);
  assert.equal(c.inventory.filter(Boolean).length, 500);
  delete c.inventory[499].locked;
  let events = 0; c.on('inventory', () => events++);
  const gold = c.gold;
  assert.equal(applyOp(c, { op: 'sell_batch', lines }), true);
  assert.equal(c.gold, gold + 500 * Math.max(1, Math.floor(ITEMS.ash.price / 2)));
  assert.equal(events, 1); assert.equal(c.inventory.filter(Boolean).length, 0);
  assert.equal(applyOp(c, { op: 'sell_batch', lines }), false);
});
