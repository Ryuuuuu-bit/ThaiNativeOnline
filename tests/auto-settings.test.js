// AUTO settings logic (src/ui/autoSettings.js): potions, target priority, cast order.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_AUTO, normalizeAuto, loadAuto, autoPotion, pickTarget, castOrder, skillSequence, nextAfter, huntList, wantedTypes } from '../src/ui/autoSettings.js';
import { locateAutoTarget } from '../server/autoTargets.js';

test('settings are clamped and fall back to defaults (no storage in node)', () => {
  assert.deepEqual(loadAuto(), normalizeAuto(DEFAULT_AUTO));
  const s = normalizeAuto({ hpPotion: 150, mpPotion: -5, range: 'moon', off: [1, 'x', 3] });
  assert.equal(normalizeAuto({}).basic, true); assert.equal(normalizeAuto({ basic: false }).basic, false);
  assert.equal(s.hpPotion, 90); assert.equal(s.mpPotion, 0); assert.equal(s.range, 'mid'); assert.deepEqual(s.off, [1, 3]);
});

test('potions: HP first, then MP, 0 turns a kind off', () => {
  const s = normalizeAuto({ hpPotion: 40, mpPotion: 25 });
  assert.equal(autoPotion(s, .3, .1), 'hp');
  assert.equal(autoPotion(s, .5, .1), 'mp');
  assert.equal(autoPotion(s, .5, .5), null);
  assert.equal(autoPotion(normalizeAuto({ hpPotion: 0, mpPotion: 0 }), .05, .05), null);
});

test('targets: the ones hitting us, then the nearest (elites a little nearer), within range', () => {
  const me = { x: 0, z: 0 }, s = normalizeAuto({ range: 'mid' }), now = 100000;
  const near = { alive: true, x: 2, z: 0, state: 'idle', def: {} };
  const elite = { alive: true, x: 4, z: 0, state: 'idle', def: { elite: true } };
  const farElite = { alive: true, x: 9, z: 0, state: 'idle', def: { elite: true } };
  const hitter = { alive: true, x: 9, z: 1, state: 'chase', def: {}, swungAtMe: now - 1000 };
  const chasingSomeoneElse = { alive: true, x: 1, z: 1, state: 'chase', def: {} };
  const far = { alive: true, x: 30, z: 0, state: 'chase', def: { boss: true } };
  const dead = { alive: false, x: 1, z: 0, state: 'chase', def: {} };
  const all = [near, elite, farElite, hitter, far, dead];
  assert.equal(pickTarget(all, me, s, null, now), hitter);
  assert.equal(pickTarget([near, farElite, hitter], me, s, null, now + 6000), near, 'an old swing no longer counts; the nearest wins');
  assert.equal(pickTarget([near, elite], me, s, null, now), elite, 'an elite counts 3 m nearer');
  assert.equal(pickTarget([near, farElite], me, s, null, now), near, 'but not from across the field');
  assert.equal(pickTarget([near, chasingSomeoneElse], me, s, null, now), chasingSomeoneElse, 'chasing someone else is just distance');
  assert.equal(pickTarget([far], me, s, null, now), null);
  assert.equal(pickTarget([near, elite], me, s, near, now), near, 'keeps a live current target');
  assert.equal(pickTarget([near, hitter], me, s, near, now), hitter, 'unless something else is hitting us');
  const walkingTo = { alive: true, x: 9, z: 0, state: 'idle', def: {} }, closer = { alive: true, x: 0, z: 7.5, state: 'idle', def: {} };
  assert.equal(pickTarget([walkingTo, near], me, s, walkingTo, now, 2), near, 'one still being walked to gives way to a much nearer one');
  assert.equal(pickTarget([walkingTo, closer], me, s, walkingTo, now, 2), walkingTo, 'but not for a metre or two');
  assert.equal(pickTarget([walkingTo, near], me, s, walkingTo, now, 10), walkingTo, 'a target in attack range is kept');
  const blocked = { ...near, unreachableAt: now - 1000 };
  assert.equal(pickTarget([blocked, walkingTo], me, s, blocked, now, 2), walkingTo, 'one with no way to it is skipped');
  assert.equal(pickTarget([blocked, walkingTo], me, s, null, now + 10000, 2), blocked, 'for a while');
});

test('cast order skips switched-off slots and puts survival skills first when HP is low', () => {
  const slots = [{}, { survival: true }, {}, {}];
  const s = normalizeAuto({ off: [2], survive: 45 });
  assert.deepEqual(castOrder(slots, s, .9, 0), [0, 1, 3]);
  assert.deepEqual(castOrder(slots, s, .9, 3), [3, 0, 1]);
  assert.deepEqual(castOrder(slots, s, .3, 0), [1, 0, 3]);
});

test('rest settings are gone: normalizeAuto keeps no rest lines', () => {
  const s = normalizeAuto({ restHp: 30, restMp: 20, restTo: 90 });
  assert.equal('restHp' in s || 'restTo' in s, false);
});

test('skill order: the player order comes first, cycle takes turns down it, priority always starts at the top', () => {
  const slots = [{}, {}, { survival: true }, {}, { type: 'item' }];
  const s = normalizeAuto({ order: [3, 0, 3, 'x'], off: [1], survive: 45 });
  assert.deepEqual(s.order, [3, 0]);
  assert.deepEqual(skillSequence(slots, s), [3, 0, 2], 'ordered ones, then the rest in bar order; off and items skipped');
  assert.deepEqual(castOrder(slots, s, .9, 3), [3, 0, 2]);
  assert.deepEqual(castOrder(slots, s, .9, nextAfter(slots, s, 3)), [0, 2, 3], 'cycle: after 3 comes 0');
  assert.equal(nextAfter(slots, s, 2), 3, 'and after the last, back to the top');
  const p = { ...s, mode: 'priority' };
  assert.deepEqual(castOrder(slots, p, .9, nextAfter(slots, p, 3)), [3, 0, 2], 'priority: the top one first every time');
  assert.deepEqual(castOrder(slots, p, .3, 0), [2, 3, 0], 'survival skills still lead when HP is low');
  assert.equal(normalizeAuto({ mode: 'random' }).mode, 'cycle');
});

test('hunt list: per map monster types, empty means every monster, attackers are still fought back', () => {
  const paddy = huntList('paddy');
  assert.ok(paddy.length >= 2 && paddy.some(m => m.type === 'boar'));
  assert.ok(paddy.every((m, i) => !i || paddy[i - 1].level <= m.level), 'weakest first');
  assert.deepEqual(huntList('city'), [], 'the city spawns nothing');
  const s = normalizeAuto({ mobs: { paddy: ['monkey', 'monkey', 'nope'], deep_forest: [] , bad: 'x' } });
  assert.deepEqual(s.mobs, { paddy: ['monkey'] });
  assert.equal(wantedTypes(s, 'deep_forest'), null);
  const me = { x: 0, z: 0, map: 'paddy' }, now = 100000;
  const boar = { x: 1, z: 0, alive: true, type: 'boar' }, monkey = { x: 5, z: 0, alive: true, type: 'monkey' };
  assert.equal(pickTarget([boar, monkey], me, s, null, now), monkey, 'only the listed type is hunted');
  assert.equal(pickTarget([boar], me, s, null, now), null);
  assert.equal(pickTarget([boar], me, s, boar, now), null, 'an unlisted current target is dropped');
  const hitter = { ...boar, swungAtMe: now - 1000 };
  assert.equal(pickTarget([hitter, monkey], me, s, null, now), hitter, 'one hitting us is fought back');
  assert.equal(pickTarget([hitter, monkey], me, { ...s, attackers: false }, null, now), monkey);
  assert.equal(pickTarget([boar, monkey], { ...me, map: 'deep_forest' }, s, null, now), boar, 'another map has its own list (all)');
});

test('server auto target honours the hunt list', () => {
  const ms = [{ id: 1, type: 'boar', hp: 9, x: 1, z: 0 }, { id: 2, type: 'monkey', hp: 9, x: 9, z: 0 }, { id: 3, type: 'boar', hp: 9, x: 2, z: 0, target: 7 }];
  const world = { monsters: ms, info: m => m.id }, me = { id: 7, x: 0, z: 0 };
  assert.equal(locateAutoTarget(world, me, { mobs: ['monkey'] }), 3, 'the boar attacking us still comes first');
  assert.equal(locateAutoTarget(world, me, { mobs: ['monkey'], attackers: false }), 2);
  assert.equal(locateAutoTarget(world, me, { mobs: [] }), 3);
  assert.equal(locateAutoTarget(world, me, { mobs: ['monkey'], attackers: false, exclude: [2] }), null);
});
