import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Character } from '../src/character/Character.js';
import { Emitter } from '../src/character/Emitter.js';
import { attachNetProgress } from '../src/net/NetProgress.js';
import { Combatants } from '../server/combatants.js';
import { fromSave, reconcileSave, applyOp } from '../server/progress.js';
import { rateLimiter } from '../server/presence.js';
import { rejectRateLimitedStatOp } from '../server/statOps.js';
import { SaveSlot } from '../src/core/SaveSlot.js';

const hero = () => new Character({ name: 'StatQA', classId: 'shaman', level: 100, points: 297 });
const online = (c, authenticated = false, sync = true) => {
  const net = new Emitter(); net.online = true; net.messages = [];
  net.send = m => net.messages.push(m); attachNetProgress(net, c, null, { authenticated });
  if (sync) net.emit('sync', { c: { ...c.toJSON(), ack: 0 } });
  return net;
};

test('a 297-point build is one atomic op under the unchanged rate limit and survives authoritative save/load', () => {
  const c = hero(), cs = new Combatants({ now: () => 0 });
  cs.load(1, c.toJSON(), { account: 'qa', slot: 0 });
  const net = online(c), plan = { int: 180, dex: 100, vit: 17 };
  let changes = 0; c.on('change', () => changes++);
  assert.ok(c.allocateMany(plan)); assert.equal(changes, 1);
  assert.deepEqual(net.messages, [{ t: 'op', n: 1, op: 'alloc_batch', add: plan }]);
  const allow = rateLimiter(() => 0);
  // Presence and other traffic leave room for the one bulk operation.
  for (let i = 0; i < 20; i++) assert.ok(allow());
  assert.ok(allow()); assert.ok(cs.op(1, net.messages[0]));
  assert.equal(cs.me(1).ack, 1); assert.equal(cs.me(1).points, 0);
  assert.deepEqual(cs.me(1).alloc, c.alloc); assert.ok(cs.get(1).dirty);
  const stored = reconcileSave({ 'tno.character.v1': JSON.stringify(hero()) }, cs.me(1));
  const loaded = fromSave(JSON.parse(stored['tno.character.v1']));
  assert.deepEqual(loaded.alloc, c.alloc); assert.equal(loaded.points, 0);
  const restarted = new Combatants(); restarted.load(2, loaded.toJSON(), { account: 'qa', slot: 0 });
  assert.deepEqual(restarted.me(2).alloc, c.alloc);
  const old = rateLimiter(() => 0); let dropped = 0;
  for (let i = 0; i < 297; i++) if (!old()) dropped++;
  assert.equal(dropped, 257, 'the previous per-point plan dropped most of the allocations');
});

test('invalid or overbudget plans are refused atomically without changing vitals or points', () => {
  const c = hero(), before = JSON.stringify(c);
  for (const plan of [null, [], {}, { int: -1 }, { int: 1.5 }, { gold: 1 }, { int: 298 }, { int: 0 }, { int: 1, dex: Infinity }, { int: Number.MAX_SAFE_INTEGER, dex: 1 }]) {
    assert.equal(c.allocateMany(plan), false); assert.equal(JSON.stringify(c), before);
    assert.equal(applyOp(c, { op: 'alloc_batch', add: plan }), false); assert.equal(JSON.stringify(c), before);
  }
  const cs = new Combatants(); cs.load(1, c.toJSON(), { account: 'qa', slot: 0 }); cs.get(1).c.hp = 0;
  assert.equal(cs.op(1, { op: 'alloc_batch', add: { int: 5 } }), false);
  assert.equal(cs.get(1).c.points, 297);
});

test('authenticated allocation waits for initial sync and reconnect; guests still allocate and save through their slot', t => {
  const c = hero(), net = online(c, true, false); let warnings = 0;
  c.on('stat-connection', () => warnings++);
  assert.equal(c.allocate('int'), false); assert.equal(c.allocateMany({ int: 200 }), false);
  assert.equal(c.resetStats(), false); assert.equal(c.points, 297); assert.equal(net.messages.length, 0);
  net.emit('sync', { c: { ...c.toJSON(), ack: 0 } });
  assert.ok(c.allocate('int')); assert.equal(net.messages.length, 1);
  const accepted = JSON.parse(JSON.stringify(c));
  net.online = false; net.emit('status', false);
  assert.equal(c.allocateMany({ dex: 50 }), false); assert.equal(c.allocate('vit'), false);
  assert.equal(c.resetStats(), false); assert.equal(c.points, 296); assert.equal(warnings, 6);
  net.online = true; assert.equal(c.allocate('int'), false);
  net.emit('sync', { c: { ...accepted, ack: 0 } }); assert.ok(c.allocateMany({ int: 2 }));
  assert.deepEqual(net.messages.at(-1), { t: 'op', n: 1, op: 'alloc_batch', add: { int: 2 } });

  const prior = Object.getOwnPropertyDescriptor(globalThis, 'localStorage'), prefix = SaveSlot.prefix, data = new Map();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: k => data.get(k) ?? null, setItem: (k,v) => data.set(k,v) } });
  t.after(() => { SaveSlot.use(prefix); if (prior) Object.defineProperty(globalThis, 'localStorage', prior); else delete globalThis.localStorage; });
  SaveSlot.use('guest-stat-qa:');
  const guest = hero(), guestNet = online(guest, false, false); guestNet.online = false;
  assert.ok(guest.allocateMany({ int: 297 })); guest.save();
  assert.deepEqual(Character.load().alloc, guest.alloc); assert.equal(Character.load().points, 0);
  assert.ok(data.has('guest-stat-qa:tno.character.v1')); assert.equal(guestNet.messages.length, 0);
});

test('rapid single clicks rejected by the limiter acknowledge without granting stats and reconcile the prediction', () => {
  const c = hero(), net = online(c), cs = new Combatants(); cs.load(1, c.toJSON(), { account: 'qa', slot: 0 });
  const allow = rateLimiter(() => 0); let refused = 0;
  for (let i = 0; i < 100; i++) c.allocate('int');
  for (const msg of net.messages) {
    if (allow()) assert.ok(cs.op(1, msg));
    else { assert.ok(rejectRateLimitedStatOp(cs.get(1), msg)); refused++; }
  }
  assert.equal(refused, 60); assert.equal(cs.me(1).ack, 100);
  assert.equal(cs.me(1).alloc.int, 40); assert.equal(cs.me(1).points, 257);
  let warnings = 0; c.on('stat-refused', () => warnings++);
  net.emit('sync', { c: cs.me(1), statRefused: true });
  assert.deepEqual(c.alloc, cs.me(1).alloc); assert.equal(c.points, 257); assert.equal(warnings, 1);
  assert.equal(rejectRateLimitedStatOp(cs.get(1), { t: 'op', n: 101, op: 'buy' }), false);
  assert.equal(rejectRateLimitedStatOp(cs.get(1), { t: 'op', n: 100, op: 'alloc' }), false);
  assert.equal(rejectRateLimitedStatOp({ ack: 0 }, { t: 'op', n: 1, op: 'alloc' }), false);
  assert.equal(cs.me(1).alloc.int, 40);
});
