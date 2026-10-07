// Server-owned progress (server/progress.js and the signed-in side of server/combatants.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyOp, fromSave, reconcileSave } from '../server/progress.js';
import { Combatants } from '../server/combatants.js';
import { Character } from '../src/character/Character.js';

const hero = (classId = 'hunter', o = {}) => ({ ...Character.create('ทดสอบ', classId).toJSON(), ...o });

test('saves from storage: unknown items are dropped, a bad class is refused', () => {
  assert.equal(fromSave({ name: 'x', classId: 'dragon' }), null);
  const c = fromSave(hero('warrior', { inventory: [{ id: 'nope', qty: 3 }, { id: 'potion_s', qty: 2 }], equipment: { weapon: 'fake' } }));
  assert.deepEqual(c.inventory.filter(Boolean), [{ id: 'potion_s', qty: 2 }]);
  assert.equal(c.equipment.weapon, null);
});

test('actions are replayed with the game\'s own rules; impossible ones are refused', () => {
  const c = fromSave(hero('hunter', { gold: 40 }));
  assert.equal(applyOp(c, { op: 'buy', shop: 'general', id: 'potion_m' }), true);
  assert.equal(c.gold, 10);
  assert.equal(applyOp(c, { op: 'buy', shop: 'general', id: 'potion_m' }), false, 'not enough gold');
  assert.equal(applyOp(c, { op: 'buy', shop: 'general', id: 'krabi' }), false, 'not sold there');
  const potions = c.count('potion_s');
  c.hp = 10;
  assert.equal(applyOp(c, { op: 'use', id: 'potion_s' }), true); assert.equal(c.count('potion_s'), potions - 1);
  assert.equal(applyOp(c, { op: 'use', id: 'takrut' }), false, 'not in the bag');
  assert.equal(applyOp(c, { op: 'sell', id: 'ether' }), true); assert.equal(c.gold, 17);
  assert.equal(applyOp(c, { op: 'unequip', slot: 'armor' }), true);
  assert.equal(applyOp(c, { op: 'equip', id: 'cloth_vest' }), true); assert.equal(c.equipment.armor, 'cloth_vest');
  assert.equal(applyOp(c, { op: 'alloc', key: 'str' }), false, 'no points at level 1');
  c.points = 1; assert.equal(applyOp(c, { op: 'alloc', key: 'agi' }), true); assert.equal(c.alloc.agi, 1);
  assert.equal(applyOp(c, { op: 'alloc', key: '__proto__' }), false);
  assert.equal(applyOp(c, { op: 'gold', amount: 1e9 }), false, 'no such action');
});

test('a save keeps the browser\'s other keys but the server\'s character', () => {
  const server = hero('shaman', { level: 9, gold: 77 });
  const sent = { 'tno.character.v1': JSON.stringify({ ...server, level: 99, gold: 1e9, hp: 33 }), 'tno.quests.v1': '{"q":1}' };
  const out = reconcileSave(sent, server), c = JSON.parse(out['tno.character.v1']);
  assert.deepEqual([c.level, c.gold, c.hp], [9, 77, 33]);
  assert.equal(out['tno.quests.v1'], '{"q":1}');
  const fresh = JSON.parse(reconcileSave(sent, null)['tno.character.v1']);
  assert.deepEqual([fresh.level, fresh.gold, fresh.classId], [1, 20, 'shaman'], 'a new slot starts fresh');
});

test('signed-in characters: kill rewards, MP for casts, the browser\'s sheet ignored', () => {
  const cs = new Combatants({ now: () => 0 });
  assert.equal(cs.load(1, hero('hunter'), { account: 'ryuu', slot: 0 }), true);
  assert.equal(cs.live('ryuu', 0), cs.get(1)); assert.equal(cs.live('ryuu', 1), null);
  assert.equal(cs.set(1, hero('hunter', { level: 150 }), 'hunter'), false, '`ch` cannot replace it');
  const c = cs.get(1).c, exp = c.expNeeded;
  const up = cs.reward(1, { exp, gold: 5, drops: [{ id: 'hide', qty: 2 }] });
  assert.equal(up.level, 2); assert.equal(c.gold, 25); assert.equal(c.count('hide'), 2); assert.equal(cs.get(1).dirty, true);
  c.mp = 0;
  assert.equal(cs.cast(1, 'arch_meteor').why, 'mp');
  c.mp = c.maxMp; const before = c.mp;
  assert.equal(cs.cast(1, 'arch_meteor').ok, true); assert.ok(c.mp < before, 'paid');
  cs.respawn(1); assert.equal(c.gold, 23, 'a death costs 10% of the gold');
  assert.equal(cs.op(1, { op: 'buy', shop: 'general', id: 'potion_s' }), true);
  assert.equal(cs.me(1).ack, 1); assert.equal(cs.me(1).gold, 13);
  // guests are left as before
  cs.set(2, hero('warrior'), 'warrior'); assert.deepEqual(cs.reward(2, { exp: 999, gold: 9 }), {}); assert.equal(cs.me(2), null);
});
