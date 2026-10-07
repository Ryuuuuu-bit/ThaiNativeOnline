// AUTO settings logic (src/ui/autoSettings.js): potions, target priority, cast order.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_AUTO, normalizeAuto, loadAuto, autoPotion, autoRest, pickTarget, castOrder } from '../src/ui/autoSettings.js';

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

test('rest: sit once HP or MP is under its line, stand once both are back up', () => {
  const s = normalizeAuto({ restHp: 30, restMp: 20, restTo: 90 });
  assert.equal(autoRest(s, .5, .5), false);
  assert.equal(autoRest(s, .25, .5), true); assert.equal(autoRest(s, .5, .1), true);
  assert.equal(autoRest(s, .6, .95, true), true, 'keeps sitting until HP is at 90%');
  assert.equal(autoRest(s, .95, .92, true), false);
  assert.equal(autoRest(normalizeAuto({ restHp: 0, restMp: 0 }), .05, .05), false, 'off');
});
