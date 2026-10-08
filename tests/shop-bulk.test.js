import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Character } from '../src/character/Character.js';
import { Emitter } from '../src/character/Emitter.js';
import { buy, sellPrice } from '../src/shop/ShopSystem.js';
import { SaleBasket } from '../src/shop/SaleBasket.js';
import { attachNetProgress } from '../src/net/NetProgress.js';
import { Combatants } from '../server/combatants.js';
import { rateLimiter } from '../server/presence.js';
import { applyOp } from '../server/progress.js';
import { shopSpot } from '../src/data/shopSites.js';

const hero = () => new Character({ name: 'QA', classId: 'warrior', gold: 20000 });
const online = c => {
  const net = new Emitter(); net.online = true; net.messages = [];
  net.send = m => net.messages.push(m); attachNetProgress(net, c);
  net.emit('sync', { c: { ...c.toJSON(), ack: 0 } }); return net;
};

test('9999 items across a basket: one op, inventory event and authoritative replay under the 40/s budget', () => {
  const c = hero(); c.addItem('potion_s', 9000); c.addItem('ash', 999);
  const cs = new Combatants({ now: () => 0 }); cs.load(1, c.toJSON(), { account: 'qa', slot: 0 });
  const net = online(c), initialGold = c.gold;
  let renders = 0; c.on('inventory', () => renders++);
  const lines = c.inventory.flatMap((s, index) => s ? [{ index, qty: s.qty }] : []);
  const gold = c.sellBatch(lines);
  assert.equal(gold, 9000 * sellPrice('potion_s') + 999 * sellPrice('ash'));
  assert.equal(renders, 1); assert.equal(net.messages.length, 1);
  const allow = rateLimiter(() => 0), pos = shopSpot('general');
  assert.ok(allow()); assert.ok(cs.op(1, net.messages[0], pos));
  assert.equal(cs.me(1).gold, initialGold + gold);
  assert.deepEqual(cs.me(1).inventory, c.inventory); assert.equal(cs.me(1).ack, 1);
  assert.ok(allow(), 'budget still available for movement/heartbeat');
  // The old per-unit flow exhausts the same unchanged budget in a single stack.
  const old = rateLimiter(() => 0); let dropped = 0;
  for (let i = 0; i < 9999; i++) if (!old()) dropped++;
  assert.equal(dropped, 9959);
});

test('bulk sale refuses invalid or stale baskets atomically and checks shop proximity and life', () => {
  const c = hero(); c.addItem('potion_s', 100); c.addItem('ash', 20);
  const before = JSON.stringify(c.toJSON());
  for (const lines of [[], [null], [{ index: 0, qty: 101 }], [{ index: 0, qty: -1 }], [{ index: 0, qty: 1.5 }], [{ index: 0, qty: 1 }, { index: 0, qty: 1 }], [{ index: 0, qty: 1 }, { index: 99, qty: 1 }]]) {
    assert.equal(c.sellBatch(lines), 0); assert.equal(JSON.stringify(c.toJSON()), before);
  }
  assert.equal(applyOp(c, { op: 'sell_batch', lines: [{ index: 0, id: 'ash', qty: 1 }] }), false);
  assert.equal(JSON.stringify(c.toJSON()), before);
  const cs = new Combatants({ now: () => 0 }); cs.load(1, c.toJSON(), { account: 'qa', slot: 0 });
  const op = { op: 'sell_batch', lines: [{ index: 0, id: 'potion_s', qty: 100 }] };
  assert.equal(cs.op(1, op, { map: 'city', x: 900, z: 900 }), false);
  cs.get(1).c.hp = 0; assert.equal(cs.op(1, op, shopSpot('general')), false);
});

test('gear identity is preserved; a batch cannot substitute another enhancement', () => {
  const c = hero(); c.addItem('krabi', 1);
  const i = c.inventory.findIndex(Boolean); c.inventory[i].plus = 3;
  const id = c.inventory[i].id;
  assert.equal(applyOp(c, { op: 'sell_batch', lines: [{ index: i, id, qty: 1 }] }), false);
  assert.ok(c.inventory[i]);
  c.inventory[i].cards = ['card_boar'];
  assert.equal(applyOp(c, { op: 'sell_batch', lines: [{ index: i, id, qty: 1, plus: 3 }] }), false);
  assert.ok(applyOp(c, { op: 'sell_batch', lines: [{ index: i, id, qty: 1, plus: 3, cards: ['card_boar'] }] }));
});

test('bulk purchase is one network op and refuses unavailable capacity without partial payment', () => {
  const c = hero(), net = online(c); let events = 0; c.on('inventory', () => events++);
  assert.ok(buy(c, 'general', 'potion_s', 999).ok);
  assert.equal(net.messages.length, 1); assert.equal(net.messages[0].qty, 999); assert.equal(events, 1);
  const before = JSON.stringify(c.toJSON());
  assert.equal(buy(c, 'general', 'potion_s', 999).ok, true);
  assert.equal(buy(c, 'general', 'potion_s', 999).ok, false);
  const full = hero(); full.inventory.fill({ id: 'ash', qty: 1 });
  const snapshot = JSON.stringify(full.toJSON());
  assert.equal(buy(full, 'general', 'potion_s', 10).ok, false);
  assert.equal(JSON.stringify(full.toJSON()), snapshot);
  assert.notEqual(JSON.stringify(c.toJSON()), before);
});

test('basket drops changed or replaced items rather than selling whatever occupies the old index', () => {
  const c = hero(); c.addItem('potion_s', 100); const b = new SaleBasket(c);
  b.set(0, 25); assert.equal(b.total(), 25 * sellPrice('potion_s'));
  c.inventory[0] = { id: 'ash', qty: 100 };
  assert.deepEqual(b.lines(), []);
  b.set(0, 10); c.inventory[0].qty--;
  assert.deepEqual(b.lines(), []);
});

test('stale sync replies do not create a resync storm while newer actions are pending', () => {
  const c = hero(), net = online(c), old = { ...c.toJSON(), ack: 0 };
  buy(c, 'general', 'potion_s', 10);
  for (let i = 0; i < 100; i++) net.emit('sync', { c: old });
  assert.equal(net.messages.length, 1);
  net.emit('me', { ack: 1, hp: c.hp, mp: c.mp });
  net.emit('me', { ack: 1, hp: c.hp, mp: c.mp });
  assert.equal(net.messages.filter(m => m.t === 'resync').length, 1);
});
