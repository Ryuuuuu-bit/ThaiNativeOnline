import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitExp, PARTY_LV_GAP, PARTY_EXP_BONUS } from '../../src/rules/exp.js';
import { mobExp } from '../../src/rules/stats.js';

/** players: id → { level, party?, dead?, sameMap?, expMul? } · parties: key → ids */
const world = (players, parties = {}) => ({ player: (id) => players[id], members: (k) => parties[k] || [] });

test('constants match the original PARTY settings', () => {
  assert.equal(PARTY_LV_GAP, 15); assert.equal(PARTY_EXP_BONUS, 0.1);
});

test('solo killer gets mobExp(base) for their level', () => {
  const out = splitExp({ dmgBy: new Map([['a', 500]]), level: 10 }, 'a', 100, world({ a: { level: 10 } }));
  assert.deepEqual(out.get('a'), { exp: Math.round(mobExp(100, 10, 10)), bonus: 0 });
  assert.equal(out.size, 1);
});

test('unparty contributors split by damage share; killer with no damage counts as 1', () => {
  const out = splitExp({ dmgBy: { a: 300, b: 100, c: 0 }, level: 10 }, 'a', 400, world({ a: { level: 10 }, b: { level: 10 }, c: { level: 10 } }));
  assert.equal(out.get('a').exp, Math.round(mobExp(300, 10, 10)));
  assert.equal(out.get('b').exp, Math.round(mobExp(100, 10, 10)));
  assert.equal(out.has('c'), false, 'zero damage → nothing');
  const k = splitExp({ dmgBy: new Map([['b', 99]]), level: 5 }, 'k', 100, world({ b: { level: 5 }, k: { level: 5 } }));
  assert.equal(k.get('k').exp, Math.round(mobExp(1, 5, 5))); assert.equal(k.get('b').exp, Math.round(mobExp(99, 5, 5)));
});

test('contributors off the map or gone are dropped; expMul blessing applies per player', () => {
  const out = splitExp({ dmgBy: { a: 100, b: 100, g: 100 }, level: 10 }, 'a', 300, world({ a: { level: 10, expMul: 1.15 }, b: { level: 10, sameMap: false } }));
  assert.equal(out.get('a').exp, Math.round(mobExp(300 * 1.15, 10, 10)), 'only a remains: whole pot');
  assert.ok(!out.has('b') && !out.has('g'));
});

test('party: pooled, +10% per extra member on the map, equal split, bonus in %', () => {
  const players = { a: { level: 20, party: 'P' }, b: { level: 22, party: 'P' }, c: { level: 25, party: 'P' }, d: { level: 20, party: 'P', dead: true } };
  const out = splitExp({ dmgBy: { a: 600, b: 400 }, level: 22 }, 'a', 1000, world(players, { P: ['a', 'b', 'c', 'd'] }));
  const each = 1000 * 1.2 / 3;
  for (const [id, lv] of [['a', 20], ['b', 22], ['c', 25]]) assert.deepEqual(out.get(id), { exp: Math.round(mobExp(each, lv, 22)), bonus: 20 });
  assert.ok(!out.has('d'), 'dead member gets nothing');
});

test('party: level gap > 15 → no sharing, own damage share only, no bonus', () => {
  const players = { a: { level: 10, party: 'P' }, b: { level: 26, party: 'P' } };
  const out = splitExp({ dmgBy: { a: 100 }, level: 10 }, 'a', 100, world(players, { P: ['a', 'b'] }));
  assert.deepEqual(out.get('a'), { exp: Math.round(mobExp(100, 10, 10)), bonus: 0 });
  assert.ok(!out.has('b'));
  players.b.level = 25;   // gap 15 → shared
  const ok = splitExp({ dmgBy: { a: 100 }, level: 10 }, 'a', 100, world(players, { P: ['a', 'b'] }));
  assert.equal(ok.get('b').bonus, 10);
});

test('party alone on the map (< 2 present) behaves like solo', () => {
  const players = { a: { level: 10, party: 'P' }, b: { level: 10, party: 'P', sameMap: false } };
  const out = splitExp({ dmgBy: { a: 50 }, level: 10 }, 'a', 100, world(players, { P: ['a', 'b'] }));
  assert.deepEqual(out.get('a'), { exp: Math.round(mobExp(100, 10, 10)), bonus: 0 });
});

test('boss flag uses the boss EXP cap', () => {
  const w = world({ a: { level: 10 } });
  assert.equal(splitExp({ dmgBy: { a: 1 }, level: 12, boss: true }, 'a', 1e9, w).get('a').exp, Math.round(mobExp(1e9, 10, 12, true)));
  assert.ok(splitExp({ dmgBy: { a: 1 }, level: 12 }, 'a', 1e9, w).get('a').exp < splitExp({ dmgBy: { a: 1 }, level: 12, boss: true }, 'a', 1e9, w).get('a').exp);
});
