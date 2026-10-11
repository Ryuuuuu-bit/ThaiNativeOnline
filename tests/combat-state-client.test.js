import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Character } from '../src/character/Character.js';
import { Emitter } from '../src/character/Emitter.js';
import { Combat } from '../src/combat/Combat.js';
import { attachNetCombat } from '../src/net/NetCombat.js';
import { attachNetProgress } from '../src/net/NetProgress.js';
import { applyCombatState, applyAid } from '../src/net/combatState.js';

function game() {
  const net = new Emitter(); net.online = true; net.send = () => {};
  const character = Character.create('สถานะ', 'warrior');
  const combat = new Combat(character, { playerPos: () => ({ x: 0, z: 0 }), canStand: () => true });
  const wrapper = { game: { character, combat } };
  attachNetCombat(net, wrapper); attachNetProgress(net, character);
  return { net, character, combat };
}

test('combat state clones active effects, clamps owned vitals and leaves guest vitals local', () => {
  const c = Character.create('สถานะ', 'warrior'); c.hp = 10; c.mp = 5;
  const buff = { id: 'speed', speed: .3, remaining: 2 };
  applyCombatState(c, { owned: false, hp: 999, mp: 999, buffs: [buff, { id: 'gone', remaining: 0 }] });
  assert.equal(c.hp, 10); assert.equal(c.mp, 5); assert.equal(c.buffs.length, 1);
  c.tick(.1, true); assert.equal(buff.remaining, 2);
  applyCombatState(c, { owned: true, hp: 1e9, mp: 1e9 });
  assert.equal(c.hp, c.maxHp); assert.equal(c.mp, c.maxMp);
});

test('combat state refreshes independently while an inventory operation awaits its acknowledgement', () => {
  const { net, character: c } = game();
  net.emit('sync', { c: { ...c.toJSON(), ack: 0 } });
  c.allocate('str');
  net.emit('me', { ack: 0, hp: 12, mp: 8, state: { owned: true, hp: 12, mp: 8, buffs: [{ id: 'protection', undying: true, remaining: 3 }] } });
  assert.equal(c.hp, 12); assert.equal(c.mp, 8); assert.equal(c.undying, true);
  net.emit('skill-state', { state: { owned: true, hp: 12, mp: 8, buffs: [] } });
  assert.equal(c.undying, false, 'a rejected/past effect cannot leave a predicted buff active');
});

test('missed hit/revive messages recover their gameplay lifecycle through the next authoritative snapshot', () => {
  const { net, character: c, combat } = game(); let deaths = 0, revivals = 0;
  combat.on('player-death', () => deaths++); combat.on('player-revived', () => revivals++);
  c.addBuff({ id: 'stale_protection', duration: 10, undying: true });
  net.emit('me', { state: { owned: true, hp: 0, mp: 0, buffs: [] } });
  net.emit('me', { state: { owned: true, hp: 0, mp: 0, buffs: [] } });
  assert.equal(c.alive, false); assert.equal(deaths, 1); assert.equal(c.undying, false);
  net.emit('me', { state: { owned: true, hp: 40, mp: 10, buffs: [{ id: 'revive', remaining: 5, undying: true }] } });
  assert.equal(revivals, 1); assert.equal(c.hp, 40); assert.equal(c.undying, true);
});

test('guest self healing waits for acceptance and refuses leave no heal or buff', () => {
  const { net, character: c } = game(); c.hp = 10;
  net.emit('skill-state', { state: { owned: false, buffs: [] } });
  assert.equal(c.hp, 10);
  net.emit('skill-state', { state: { owned: false, buffs: [] }, self: { hp: 30 } });
  assert.equal(c.hp, 40);
  net.emit('skill-state', { state: { owned: false, buffs: [] } });
  assert.equal(c.hp, 40);
});

test('ordinary guest snapshots preserve local poison and only an explicit cleanse removes it', () => {
  const { character: c, combat } = game();
  c.addBuff({ id: 'poison', duration: 10, poison: 3 });
  c.addBuff({ id: 'kit_old', duration: 10, def: .2 });
  combat.slowUntil = 10;
  applyCombatState(c, { owned: false, buffs: [] });
  assert.deepEqual(c.buffs.map(b => b.id), ['poison']); assert.equal(combat.slowUntil, 10);
  applyCombatState(c, { owned: false, buffs: [{ id: 'kit_tiger', remaining: 5, speed: .25 }] }, { cleanse: true });
  assert.deepEqual(c.buffs.map(b => b.id), ['kit_tiger']); assert.equal(combat.slowUntil, 0);
});

test('guest revival restores its ratio once and then grants protection without an extra heal/MP payout', () => {
  const { character: c, combat } = game(); c.fall();
  const result = applyAid(c, { revive: .4, heal: .4, hp: 30, mp: .3, buff: { id: 'revive', duration: 10, undying: true } }, ratio => combat.reviveHere(ratio));
  assert.equal(result.revived, true); assert.equal(result.heal, 0);
  assert.equal(c.hp, Math.round(c.maxHp * .4)); assert.equal(c.mp, Math.round(c.maxMp * .4)); assert.equal(c.undying, true);
});

test('signed-in revival adopts exact server state while ordinary aid heals a living guest once', () => {
  const { character: c, combat } = game(); c.fall();
  applyAid(c, { revive: .4, heal: .4, amount: 0, state: { owned: true, hp: 53, mp: 2, buffs: [{ id: 'revive', remaining: 10, undying: true }] } }, ratio => combat.reviveHere(ratio));
  assert.equal(c.hp, 53); assert.equal(c.mp, 2); assert.equal(c.undying, true);
  assert.equal(applyAid(c, { hp: 30 }).heal, 30); assert.equal(c.hp, 83);
});
