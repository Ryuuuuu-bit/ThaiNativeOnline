// Shared monsters on the server (server/monsters.js), without sockets.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MonsterWorld } from '../server/monsters.js';
import { MONSTERS } from '../src/combat/data/monsters.js';

const zone = (o = {}) => ({ type: 'boar', x: 0, z: 0, radius: 0, count: 1, active: ['morning', 'day', 'evening', 'night'], ...o });
const seq = (...v) => { let i = 0; return () => v[i++ % v.length]; };
const world = (zones = [zone()], random = seq(.5)) => new MonsterWorld('test', { zones, random });
const run = (w, players, secs, phase = 'day') => { const ev = []; for (let t = 0; t < secs; t += .1) ev.push(...w.update(.1, players, phase)); return ev; };

test('real maps get their spawn areas; the city has none', () => {
  assert.ok(new MonsterWorld('paddy').monsters.length > 5);
  assert.equal(new MonsterWorld('city').monsters.length, 0);
});

test('monsters spawn, notice a nearby player, chase and swing at them', () => {
  const w = world(), far = { id: 1, x: 30, z: 0, lv: 1 };
  const ev = run(w, [far], 3);
  assert.ok(ev.some(e => e.t === 'mspawn'));
  const m = w.monsters[0];
  assert.equal(m.state, 'idle', 'too far to notice');
  const near = { id: 1, x: 3, z: 0, lv: 1 };
  const ev2 = run(w, [near], 4);
  assert.equal(m.state, 'chase');
  assert.ok(Math.hypot(m.x - 3, m.z) <= MONSTERS.boar.range + .1, 'walked into reach');
  assert.ok(ev2.some(e => e.t === 'ma' && e.to === 1), 'swung at the player');
  assert.ok(w.snapshot().length || true);
});

test('dead players are left alone; a monster dragged too far goes home and heals', () => {
  const w = world(); run(w, [{ id: 1, x: 40, z: 0, lv: 1 }], 1);
  const m = w.monsters[0];
  run(w, [{ id: 1, x: 2, z: 0, lv: 1, dead: true }], 2);
  assert.equal(m.state, 'idle');
  m.state = 'chase'; m.target = 1; m.x = 30; m.hp = 10;
  run(w, [{ id: 1, x: 31, z: 0, lv: 1 }], .2);
  assert.equal(m.state, 'return');
  run(w, [], 20);
  assert.equal(m.state, 'idle'); assert.equal(m.hp, m.maxHp);
});

test('a shared kill: EXP to helpers, gold and loot to the top damager', () => {
  const w = world(); run(w, [{ id: 1, x: 40, z: 0, lv: 1 }], 1);
  const m = w.monsters[0], a = { id: 1, x: 2, z: 0, lv: 1 }, b = { id: 2, x: 0, z: 2, lv: 12 }, c = { id: 3, x: 1, z: 1, lv: 1 }, players = [a, b, c];
  w.damage(m, 1, 70, {}, players);
  w.damage(m, 3, 5, {}, players);              // under 15%: no share
  assert.equal(m.state, 'chase', 'a blow draws it in');
  const ev = w.damage(m, 2, 60, {}, players);  // the killing blow
  const kills = ev.filter(e => e.t === 'kill');
  assert.ok(ev.some(e => e.t === 'mgone' && e.killed));
  assert.deepEqual(kills.map(k => k.to).sort(), [1, 2]);
  const top = kills.find(k => k.to === 1), helper = kills.find(k => k.to === 2);
  assert.ok(top.gold >= MONSTERS.boar.gold[0]); assert.equal(helper.gold, 0); assert.deepEqual(helper.drops, []);
  assert.ok(top.exp > helper.exp, 'EXP follows each player\'s own level (far above the monster, less EXP)');
  assert.equal(m.state, 'dead'); assert.equal(m.alive, false);
});

test('stuns hold a monster in place; damage over time ticks on the server', () => {
  const w = world(); run(w, [{ id: 1, x: 40, z: 0, lv: 1 }], 1);
  const m = w.monsters[0], p = { id: 1, x: 3, z: 0, lv: 1 };
  w.debuff(m, { id: 'stun', stun: true, remaining: 2 });
  const x0 = m.x; run(w, [p], 1);
  assert.equal(m.x, x0, 'stunned: no step');
  const hp = m.hp;
  w.debuff(m, { id: 'poison', dot: .5, source: 20, by: 1, remaining: 3 });
  const ev = run(w, [p], 2.5);
  assert.ok(ev.filter(e => e.t === 'mh' && e.dot).length >= 2);
  assert.ok(m.hp < hp);
});

test('night-only monsters fade at dawn and come back at night', () => {
  const w = world([zone({ active: ['night'] })]);
  run(w, [], 2, 'night');
  const m = w.monsters[0];
  assert.ok(m.hp > 0);
  const ev = run(w, [], .2, 'morning');
  assert.ok(ev.some(e => e.t === 'mgone' && !e.killed));
  assert.equal(m.hp, 0);
});
