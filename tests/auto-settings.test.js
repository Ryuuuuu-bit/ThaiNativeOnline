// AUTO settings logic (src/ui/autoSettings.js): potions, target priority, cast order.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_AUTO, normalizeAuto, loadAuto, autoPotion, pickTarget, castOrder } from '../src/ui/autoSettings.js';

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

test('targets: attackers, then elites, then nearest, within range', () => {
  const me = { x: 0, z: 0 }, s = normalizeAuto({ range: 'mid' });
  const near = { alive: true, x: 2, z: 0, state: 'idle', def: {} };
  const elite = { alive: true, x: 6, z: 0, state: 'idle', def: { elite: true } };
  const hitter = { alive: true, x: 9, z: 0, state: 'chase', def: {} };
  const far = { alive: true, x: 30, z: 0, state: 'chase', def: { boss: true } };
  const dead = { alive: false, x: 1, z: 0, state: 'chase', def: {} };
  const all = [near, elite, hitter, far, dead];
  assert.equal(pickTarget(all, me, s), hitter);
  assert.equal(pickTarget(all, me, { ...s, attackers: false }), elite);
  assert.equal(pickTarget(all, me, { ...s, attackers: false, elites: false }), near);
  assert.equal(pickTarget([far], me, s), null);
  assert.equal(pickTarget(all, me, s, near), near);     // keeps a live current target
});

test('cast order skips switched-off slots and puts survival skills first when HP is low', () => {
  const slots = [{}, { survival: true }, {}, {}];
  const s = normalizeAuto({ off: [2], survive: 45 });
  assert.deepEqual(castOrder(slots, s, .9, 0), [0, 1, 3]);
  assert.deepEqual(castOrder(slots, s, .9, 3), [3, 0, 1]);
  assert.deepEqual(castOrder(slots, s, .3, 0), [1, 0, 3]);
});
