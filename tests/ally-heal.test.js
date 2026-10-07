// A heal aimed at one friend (src/training/kitCombat.js allyHeal, server/combatants.js cast).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allyHeal, supportOf, ALLY_FOCUS } from '../src/training/kitCombat.js';
import { Combatants } from '../server/combatants.js';
import { Character } from '../src/character/Character.js';

test('the vine and the bouncing pill aim at one friend; area and party skills do not', () => {
  assert.ok(allyHeal('heal_vine') && allyHeal('heal_pill'));
  for (const id of ['heal_mortar', 'heal_mist', 'heal_khwan', 'heal_zone']) assert.equal(allyHeal(id), false, id);
  assert.ok(ALLY_FOCUS > 1);
});

test('a heal sent to a friend skips the caster and says single; without one it heals the caster as before', () => {
  let t = 0; const cs = new Combatants({ now: () => t });
  cs.load(1, { ...Character.create('หมอ', 'herbalist').toJSON(), jobLevel: 10, skills: { heal_vine: 1 } }, { account: 'a', slot: 0 });
  const c = cs.get(1).c; c.mp = 999; c.hp = 10;
  const r = cs.cast(1, 'heal_vine', { ally: true });
  assert.ok(r.ok && r.single && r.support.hp > 0, r.why);
  assert.equal(c.hp, 10, 'the caster is not healed');
  t += 60;
  const r2 = cs.cast(1, 'heal_vine');
  assert.ok(r2.ok && !r2.single); assert.ok(c.hp > 10, 'the caster heals itself');
  assert.ok(supportOf('heal_vine', 1, 10, 100).hp > 0, 'the heal a friend gets grows with MATK');
});
