import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Character } from '../src/character/Character.js';
import { Combatants } from '../server/combatants.js';
import { KIT_SKILL_IDS } from '../src/character/data/kits.js';
import { fullKit } from '../src/character/data/skilltree.js';
import { selfEffects, castInfo } from '../src/training/kitCombat.js';
import { applyCombatState } from '../src/net/combatState.js';

function setup() {
  let time = 0;
  const cs = new Combatants({ now: () => time, random: () => .5 });
  for (const [id, cls] of [[1, 'herbalist'], [2, 'warrior']]) {
    const data = { ...Character.create('ผู้เล่น' + id, cls).toJSON(), level: 60, jobLevel: 50, skills: fullKit(cls, KIT_SKILL_IDS[cls]) };
    assert.ok(cs.load(id, data, { account: 'effect-test-' + id, slot: 0 }));
    cs.get(id).c.hp = 100; cs.get(id).c.mp = cs.get(id).c.maxMp;
  }
  const players = [{ id: 1, room: 'city:1', x: 0, z: 0 }, { id: 2, room: 'city:1', x: 5, z: 0 }];
  return { cs, players, advance(dt) { time += dt; return cs.tick(dt, false, players, () => true); } };
}

test('online vines tick on one friend, gain the proximity bonus and cancel when the friend leaves range', () => {
  const { cs, players, advance } = setup();
  const source = cs.get(1).c, target = cs.get(2).c;
  const support = cs.cast(1, 'heal_vine', { ally: true }).support;
  assert.equal(source.hp, 100); assert.equal(target.hp, 100);
  assert.ok(cs.tether(1, 2, 'heal_vine', support.tether, players[0].room));
  assert.deepEqual(advance(.49), []);
  const far = advance(.01); assert.equal(far[0].heal, support.tether.amount);
  players[1].x = 2;
  const near = advance(.5); assert.equal(near[0].heal, Math.round(support.tether.amount * 1.5));
  assert.equal(source.rec.healOut, far[0].heal + near[0].heal);
  players[1].x = 20;
  assert.deepEqual(advance(.5), []); assert.equal(cs.tethers.size, 0);
  assert.ok(cs.get(2).dirty);
});

test('vines stop on death, map/channel changes, party departure and disconnect', () => {
  for (const condition of ['death', 'room', 'party', 'disconnect']) {
    const { cs, players } = setup();
    const e = selfEffects('heal_vine', 1, 0, 1000).tether;
    assert.ok(cs.tether(1, 2, 'heal_vine', e, 'city:1'));
    if (condition === 'death') cs.get(1).c.fall();
    if (condition === 'room') players[1].room = 'city:2';
    if (condition === 'disconnect') cs.drop(2);
    assert.deepEqual(cs.tick(.5, false, players, () => condition !== 'party'), []);
    assert.equal(cs.tethers.size, 0, condition);
  }
});

test('a live empty roster cancels self vines, while pure callers can omit positions', () => {
  const { cs } = setup();
  const effect = selfEffects('heal_vine', 1, 0, 1000).tether;
  cs.tether(1, 1, 'heal_vine', effect);
  assert.deepEqual(cs.tick(.5, false, []), []);
  assert.equal(cs.tethers.size, 0);
  cs.tether(1, 1, 'heal_vine', effect);
  assert.equal(cs.tick(.5, false)[0].heal, 90);
});

test('guest vines use server timing/range without overwriting browser vitals', () => {
  const cs = new Combatants();
  const data = { ...Character.create('ผู้มาเยือน', 'herbalist').toJSON(), jobLevel: 50, skills: fullKit('herbalist', KIT_SKILL_IDS.herbalist) };
  cs.set(1, data, 'herbalist');
  const c = cs.get(1).c, hp = c.hp;
  const { self } = cs.cast(1, 'heal_vine');
  assert.ok(self.tether);
  const roster = [{ id: 1, room: 'city:1', x: 0, z: 52, dead: false }];
  assert.equal(cs.tick(.49, false, roster).length, 0);
  assert.ok(cs.tick(.01, false, roster)[0].heal > 0);
  assert.equal(c.hp, hp);
  roster[0].dead = true;
  assert.deepEqual(cs.tick(.5, false, roster), []);
  assert.equal(cs.tethers.size, 0);
});

test('guest death clears server buffs and links, and a later sheet cannot resurrect the guest', () => {
  const cs = new Combatants();
  const data = { ...Character.create('ผู้มาเยือน', 'warrior').toJSON(), jobLevel: 50, skills: fullKit('warrior', KIT_SKILL_IDS.warrior) };
  cs.set(1, data, 'warrior'); assert.ok(cs.cast(1, 'sword_guard').ok);
  cs.tether(1, 1, 'heal_vine', selfEffects('heal_vine', 1, 0, 100).tether);
  cs.fall(1); assert.equal(cs.tethers.size, 0); assert.deepEqual(cs.effects(1).buffs, []);
  cs.set(1, data, 'warrior'); assert.equal(cs.cast(1, 'sword_guard').why, 'dead');
  cs.get(1).c.revive(.4); assert.deepEqual(cs.effects(1).buffs, []);
});

test('the current kit refuses legacy buff aliases, while ordinary basic attacks remain a separate route', () => {
  const { cs } = setup();
  assert.equal(cs.cast(2, 'guard').why, 'not_yours');
  assert.equal(cs.cast(2, 'rally').why, 'not_yours');
  assert.ok(cs.cast(2, 'sword_guard').ok);
});

test('reviving a friend preserves the timed death protection, including authoritative state on the client', () => {
  const { cs, advance } = setup();
  const c = cs.get(2).c; c.fall();
  const protection = selfEffects('heal_khwan', 1, 100, 1000).buff;
  assert.ok(cs.aid(2, { revive: .4, buff: protection }).revived);
  const local = Character.create('เพื่อน', 'warrior');
  applyCombatState(local, cs.effects(2));
  assert.equal(local.undying, true);
  c.damage(c.maxHp * 10); assert.equal(c.hp, 1);
  advance(10.1);
  c.damage(c.maxHp * 10); assert.equal(c.alive, false);
  applyCombatState(local, cs.effects(2));
  assert.equal(local.alive, false); assert.equal(local.buffs.length, 0);
});

test('a high-level buff expires before its real cooldown and rejected casts cannot refresh it', () => {
  let time = 0;
  const cs = new Combatants({ now: () => time });
  const data = { ...Character.create('พราน', 'hunter').toJSON(), level: 100, jobLevel: 50, skills: { arch_quick: 5, arch_hawk: 10 } };
  cs.load(1, data, { account: 'buff-test', slot: 0 });
  const c = cs.get(1).c; assert.ok(cs.cast(1, 'arch_hawk').ok);
  const buff = c.buffs[0], cooldown = castInfo({ id: 'arch_hawk' }, 10).cd * (1 - c.cooldownCut);
  assert.ok(buff.duration <= cooldown * .8);
  time = buff.duration + .01; cs.tick(time, false);
  assert.equal(c.buffs.length, 0);
  assert.equal(cs.cast(1, 'arch_hawk').why, 'cooldown');
  time = cooldown + .01; assert.ok(cs.cast(1, 'arch_hawk').ok);
});
