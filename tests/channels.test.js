// Channels that open and close with the crowd (server/channels.js), rooms in server/presence.js
// and the elite-free monster worlds of CH 2+ (server/monsters.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Channels, CHANNEL, roomOf, parseRoom } from '../server/channels.js';
import { Presence } from '../server/presence.js';
import { MonsterWorld } from '../server/monsters.js';
import { MONSTERS } from '../src/combat/data/monsters.js';

const clock = () => { let t = 1000; const now = () => t; now.add = s => { t += s; }; return now; };
const cap = CHANNEL.capDefault, full = Math.ceil(cap * CHANNEL.openAt);

test('room ids: CH 1 is the map itself', () => {
  assert.equal(roomOf('paddy', 1), 'paddy'); assert.equal(roomOf('paddy', 3), 'paddy#3');
  assert.deepEqual(parseRoom('paddy#3'), { map: 'paddy', ch: 3 }); assert.deepEqual(parseRoom('city'), { map: 'city', ch: 1 });
});

test('players fill CH 1; the next channel opens only when every open one is nearly full', () => {
  const C = new Channels({ now: clock() });
  assert.equal(C.pick('paddy', {}), 1);
  assert.equal(C.pick('paddy', { 1: full - 1 }), 1);
  assert.equal(C.pick('paddy', { 1: full }), 2, 'CH 2 opens');
  assert.equal(C.pick('paddy', { 1: full, 2: 3 }), 2);
  assert.equal(C.pick('paddy', { 1: full - 2, 2: 3 }), 1, 'back to CH 1 when it has room: people stay together');
  assert.equal(C.cap('city'), CHANNEL.cap.city, 'the city holds more');
  assert.equal(C.pick('city', { 1: full }), 1);
  // never more than the limit
  const counts = {};
  for (let i = 1; i <= CHANNEL.max + 2; i++) { const ch = C.pick('deep_forest', counts); counts[ch] = cap; }
  assert.equal(C.list('deep_forest', counts).length, CHANNEL.max);
});

test('a quiet channel is announced, then closed; its players are moved out', () => {
  const now = clock(), C = new Channels({ now });
  C.pick('paddy', { 1: full });   // CH 2 open
  assert.deepEqual(C.update('paddy', { 1: 20, 2: 2 }), { warn: [], evict: [] });
  now.add(CHANNEL.closeAfter - 1);
  assert.deepEqual(C.update('paddy', { 1: 20, 2: 2 }).warn, []);
  now.add(2);
  assert.deepEqual(C.update('paddy', { 1: 20, 2: 2 }).warn, [2], 'warned');
  assert.equal(C.pick('paddy', { 1: full, 2: 2 }), 3, 'a closing channel takes no one new');
  assert.ok(C.list('paddy', { 1: 20, 2: 2 }).find(c => c.ch === 2).closing);
  now.add(CHANNEL.warn);
  assert.deepEqual(C.update('paddy', { 1: 20, 2: 2 }).evict, [2]);
  assert.deepEqual(C.update('paddy', { 1: 20, 2: 1 }).evict, [2], 'still someone (in a fight)');
  C.update('paddy', { 1: 22, 2: 0 });
  assert.ok(!C.chans('paddy').has(2), 'gone once empty');
});

test('a channel that fills up again is not closed; an empty one goes quietly', () => {
  const now = clock(), C = new Channels({ now });
  C.pick('paddy', { 1: full });
  C.update('paddy', { 2: 2 }); now.add(CHANNEL.closeAfter / 2);
  C.update('paddy', { 2: 20 }); now.add(CHANNEL.closeAfter / 2 + 5);
  assert.deepEqual(C.update('paddy', { 2: 2 }).warn, [], 'the quiet spell started over');
  now.add(CHANNEL.closeAfter + 1); C.update('paddy', { 2: 0 });
  assert.ok(!C.chans('paddy').has(2));
  assert.ok(C.chans('paddy').has(1), 'CH 1 never closes');
});

test('switching: out of a fight, alive, once a minute, into an open channel with room', () => {
  const now = clock(), C = new Channels({ now });
  C.pick('paddy', { 1: full });
  const ok = { from: 1 };
  assert.equal(C.canSwitch('paddy', 2, { 1: full, 2: 1 }, ok), null);
  assert.equal(C.canSwitch('paddy', 1, {}, ok), 'same');
  assert.equal(C.canSwitch('paddy', 5, {}, ok), 'closed');
  assert.equal(C.canSwitch('paddy', 2, {}, { ...ok, fighting: true }), 'fighting');
  assert.equal(C.canSwitch('paddy', 2, {}, { ...ok, dead: true }), 'dead');
  assert.equal(C.canSwitch('paddy', 2, {}, { ...ok, lastAt: now() - 10 }), 'cooldown');
  assert.equal(C.canSwitch('paddy', 2, { 2: cap }, ok), 'full');
});

test('presence groups players by room; channel counts per map', () => {
  const P = new Presence({ now: () => 0 }), a = {}, b = {}, c = {};
  P.join(a, { name: 'a', map: 'paddy' });
  const rb = P.join(b, { name: 'b', map: 'paddy', x: 0, z: -122 }, 2);   // by the warp back to the city
  assert.equal(rb.room, 'paddy#2'); assert.equal(rb.roster.length, 0, 'CH 1 players are not in CH 2');
  P.join(c, { name: 'c', map: 'paddy' }, 2);
  assert.deepEqual(P.counts('paddy'), { 1: 1, 2: 2 });
  const r = P.setChannel(a, 2);
  assert.deepEqual([r.left, r.room, r.roster.length], ['paddy', 'paddy#2', 2]);
  assert.equal(P.inMap('paddy').length, 0);
  const m = P.changeMap(b, { map: 'city', x: 0, z: -99 }, 1);
  assert.deepEqual([m.left, m.room], ['paddy#2', 'city']);
  assert.equal(P.anim(b, { clip: 'jab' }).map, 'city');
});

test('CH 2+ has the same monsters minus the elites and bosses', () => {
  for (const map of ['paddy', 'deep_forest', 'wat_rang']) {
    const one = new MonsterWorld(map), two = new MonsterWorld(map, { elites: false });
    const big = w => w.monsters.filter(m => MONSTERS[m.type].elite || MONSTERS[m.type].boss).length;
    assert.ok(big(one) > 0, `${map} has elites on CH 1`); assert.equal(big(two), 0);
    assert.equal(two.monsters.length, one.monsters.length - big(one));
  }
});
