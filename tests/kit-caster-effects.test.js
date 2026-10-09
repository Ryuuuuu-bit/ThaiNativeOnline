import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Character } from '../src/character/Character.js';
import { Combat } from '../src/combat/Combat.js';
import { KitCaster } from '../src/training/KitCaster.js';
import { HERBALIST_SKILLS } from '../src/classes/herbalist-moves.js';

function setup({ online = false, practice = false } = {}) {
  const c = Character.create('หมอยา', 'herbalist'); c.jobLevel = 50;
  c.skills = { heal_vine: 1, heal_pill: 1, heal_tiger: 1 };
  const player = { group: new THREE.Group() }; player.position = player.group.position;
  const combat = new Combat(c, { playerPos: () => player.position, canStand: () => true });
  combat.remote = online;
  const dummy = { pos: new THREE.Vector3() }, casts = [];
  const caster = new KitCaster({ character: c, player, combat,
    kit: { skills: HERBALIST_SKILLS }, fx: { toLocal: v => v.clone(), toWorld: v => v.clone() },
    stats: () => ({ ...c.derived, matk: c.matk, patk: c.patk }),
    nearDummy: () => practice, dummy: () => practice ? dummy : null,
    dummyDefense: () => ({ def: 0, eva: 0 }),
    runnerFactory: () => ({ busy: false, cast: id => { casts.push(id); return true; } }),
  });
  return { c, combat, caster, casts, index: id => caster.slots.findIndex(s => s.id === id) };
}

test('offline vines self-cast without chasing a selected enemy, heal on time and stop on death', () => {
  const { c, combat, caster, index } = setup(); c.hp = 10;
  combat.target = { alive: true, x: 25, z: 0 };
  assert.equal(caster.cast(index('heal_vine')), true);
  assert.equal(caster.pending, null); assert.equal(c.hp, 10);
  caster.update(.49); assert.equal(c.hp, 10);
  caster.update(.01); assert.ok(c.hp > 10);
  c.fall(); caster.update(.5); assert.equal(c.hp, 0); assert.equal(caster.tether, null);
});

test('online self effects await acceptance and cannot start a parallel local tether', () => {
  const { c, combat, caster, index } = setup({ online: true }); c.hp = 10;
  const sent = []; combat.on('kit-cast', e => sent.push(e));
  assert.equal(caster.cast(index('heal_vine')), true);
  caster.update(2); assert.equal(c.hp, 10); assert.equal(caster.tether, null);
  assert.equal(caster.cast(index('heal_tiger')), true); assert.equal(c.buffs.length, 0);
  assert.deepEqual(sent.map(e => e.id), ['heal_vine', 'heal_tiger']);
});

test('dummy practice grants neither live healing/buffs nor a free tether', () => {
  const { c, caster, index } = setup({ practice: true }); c.hp = 10; c.mp = 0;
  assert.equal(caster.cast(index('heal_vine')), true);
  assert.equal(caster.cast(index('heal_tiger')), true);
  caster.update(2);
  assert.equal(c.hp, 10); assert.equal(c.mp, 0); assert.equal(c.buffs.length, 0); assert.equal(caster.tether, null);
});

test('AUTO does not waste a vine at full HP but still heals a wounded party member', () => {
  const { c, combat, caster, index } = setup({ online: true }); combat.combatTimer = 3;
  assert.equal(caster.cast(index('heal_vine'), true), false);
  const sent = []; combat.on('kit-cast', e => sent.push(e));
  combat.allies = () => [{ id: 2, alive: true, x: 1, z: 0, hp: 10, maxHp: 100 }];
  assert.equal(caster.cast(index('heal_vine'), true), true);
  assert.equal(sent[0].ally, 2); assert.equal(c.hp, c.maxHp); assert.equal(caster.tether, null);
});
