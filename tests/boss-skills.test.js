import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MonsterWorld } from '../server/monsters.js';
import { Combat, Monster } from '../src/combat/Combat.js';
import { Character } from '../src/character/Character.js';
import { BOSS_SKILLS, MAP_BOSSES } from '../src/combat/data/boss-skills.js';
import { inBossSkill, tickBossSkills, resetBossSkills } from '../src/combat/bossSkills.js';
import { combatSpawns } from '../src/data/spawns.js';
import { mapOf, MAPS } from '../src/world/maps.js';
import { Combatants } from '../server/combatants.js';
import { attachNetCombat } from '../src/net/NetCombat.js';
import { Emitter } from '../src/character/Emitter.js';
import { BossTelegraphs } from '../src/combat/BossTelegraphs.js';
import * as THREE from 'three';

const setup = (type = 'bamboo_grave_3', navigation = null) => {
  const w = new MonsterWorld('test', { random: () => .5, navigation, zones: [{ type, x: 0, z: 0, radius: 0, count: 1 }] });
  const m = w.monsters[0]; w.spawn(m); m.state = 'chase'; m.target = 1; m.skillCooldown = 0;
  return { w, m, p: { id: 1, x: 0, z: 4, lv: m.def.level } };
};
const run = (w, p, seconds) => { const ev = []; for (let i = 0; i < Math.ceil(seconds / .1); i++) ev.push(...w.update(.1, p)); return ev; };

test('every hunting map has a real primary boss encounter with two themed skills', () => {
  const zones = combatSpawns();
  for (const map of Object.values(MAPS).filter(m => !m.safe && !m.instance)) {   // an instance (the world boss room) has its own rules: tests/world-boss.test.js
    const type = MAP_BOSSES[map.id]; assert.ok(type, map.id);
    const encounters = zones.filter(z => z.type === type && mapOf(z.x, z.z) === map.id);
    assert.equal(encounters.length, 1, map.id);
    assert.equal(encounters[0].count, 1, map.id);
    assert.ok(encounters[0].active.includes('night'), map.id);
    const skills = BOSS_SKILLS[type]; assert.equal(skills.length, 2, type);
    assert.notEqual(skills[0].id, skills[1].id);
    for (const s of skills) { assert.ok(s.windup >= 1.8 && s.cooldown >= 8); assert.ok(s.power <= 1.5); }
  }
});

test('boss warnings lock target positions, stop movement and only hit living players still inside at impact', () => {
  const { w, m, p } = setup();
  const start = w.update(.1, [p]); assert.equal(start.filter(e => e.stage === 'windup').length, 1);
  assert.equal(start.filter(e => e.t === 'ma').length, 0);
  const cast = { ...m.skillCast }, before = { x: m.x, z: m.z };
  p.x = 15;
  const stay = { id: 2, x: cast.x, z: cast.z, lv: 30 }, dead = { ...stay, id: 3, dead: true };
  const windup = run(w, [p, stay, dead], cast.windup - .2);
  assert.equal(windup.filter(e => e.t === 'ma').length, 0);
  assert.deepEqual({ x: m.x, z: m.z }, before);
  assert.equal(m.skillCast.x, cast.x, 'aim never follows the dodging player');
  const impact = run(w, [p, stay, dead], .4);
  assert.equal(impact.filter(e => e.stage === 'impact').length, 1);
  assert.deepEqual(impact.filter(e => e.t === 'ma').map(e => e.to), [2]);
  assert.equal(m.skillCast, null);
  assert.equal(run(w, [p, stay], .5).filter(e => e.t === 'ma').length, 0, 'recovery prevents a stacked basic swing');
});

test('cone angles wrap correctly and ring centre is safe', () => {
  const cone = { shape: 'cone', x: 0, z: 0, facing: Math.PI - .1, radius: 7, angle: Math.PI / 2 };
  assert.ok(inBossSkill(cone, { x: -.1, z: -5 }));
  assert.equal(inBossSkill(cone, { x: 5, z: 0 }), false);
  assert.equal(inBossSkill(cone, { x: 0, z: 8 }), false);
  const ring = { shape: 'ring', x: 1, z: 2, radius: 8, innerRadius: 3 };
  assert.equal(inBossSkill(ring, { x: 1, z: 2 }), false);
  assert.ok(inBossSkill(ring, { x: 1, z: 6 }));
  assert.equal(inBossSkill(ring, { x: 1, z: 11 }), false);
});

test('all primary bosses execute both skills and resolve the warned area for the party', () => {
  for (const type of Object.values(MAP_BOSSES)) for (let index = 0; index < 2; index++) {
    const { w, m, p } = setup(type); m.skillIndex = index;
    p.z = 2;
    const warned = w.update(.1, [p]).find(e => e.stage === 'windup');
    assert.ok(warned, `${type}/${index}`);
    const cast = warned.cast;
    const ally = { id: 2, lv: 100, x: cast.x, z: cast.z + (cast.shape === 'ring' ? (cast.radius + cast.innerRadius) / 2 : 0) };
    const safe = { id: 3, lv: 100, x: cast.x + cast.radius + 1, z: cast.z };
    const events = run(w, [p, ally, safe], cast.windup + .2);
    assert.equal(events.filter(e => e.stage === 'impact').length, 1, `${type}/${index}`);
    assert.ok(events.some(e => e.skill === cast.id && e.to === 2), `${type}/${index} party member in danger`);
    assert.equal(events.some(e => e.skill && e.to === 3), false, `${type}/${index} outside safe`);
  }
});

test('stun, target leaving and leash cancel warnings without landing the skill', () => {
  for (const reason of ['stun', 'leave', 'leash']) {
    const { w, m, p } = setup(); w.update(.1, [p]);
    if (reason === 'stun') w.debuff(m, { id: 'test', stun: true, remaining: 5 });
    if (reason === 'leash') m.x = 20;
    const events = w.update(.1, reason === 'leave' ? [] : [p]);
    assert.ok(events.some(e => e.stage === 'cancel'), reason);
    assert.equal(events.filter(e => e.skill || e.stage === 'impact').length, 0);
    assert.equal(m.skillCast, null);
  }
});

test('boss death cancels and respawn resets skill cadence; late arrivals get remaining warning', () => {
  const { w, m, p } = setup(); w.update(.1, [p]); w.update(.4, [p]);
  assert.ok(w.list()[0].skillCast.remaining < BOSS_SKILLS[m.type][0].windup);
  const death = w.damage(m, p.id, m.maxHp, {}, [p]);
  assert.ok(death.some(e => e.stage === 'cancel'));
  assert.equal(w.update(3, [p]).filter(e => e.stage === 'impact').length, 0);
  w.spawn(m); assert.equal(m.skillCast, null); assert.equal(m.skillCooldown, 3); assert.equal(m.skillIndex, 0);
});

test('phase two changes cadence but never shortens dodge warning or adds hidden heavy hits', () => {
  const { m, p } = setup();
  for (const hp of [m.maxHp, m.maxHp / 2]) {
    resetBossSkills(m); m.hp = hp; m.skillCooldown = 0;
    tickBossSkills(m, .1, p, [p]);
    assert.equal(m.skillCast.windup, BOSS_SKILLS[m.type][0].windup);
    assert.equal(m.skillCast.power, BOSS_SKILLS[m.type][0].power);
    assert.equal(m.skillCooldown, BOSS_SKILLS[m.type][0].cooldown * (hp <= m.maxHp / 2 ? .8 : 1));
  }
});

test('boss cannot start a skill through a blocking obstacle', () => {
  const { w, m, p } = setup('bamboo_grave_3', { canStand: () => true, clear: () => false });
  run(w, [p], 5); assert.equal(m.skillCast, null);
});

test('offline combat uses the same fixed aim and cancellable warning', () => {
  const c = Character.create('test', 'warrior'), p = { x: 0, z: 4 };
  const combat = new Combat(c, { playerPos: () => p, canStand: () => true });
  const m = new Monster('bamboo_grave_3', { radius: 0 }, 0, 0); combat.monsters.push(m); m.state = 'chase'; m.skillCooldown = 0;
  const stages = []; combat.on('boss-skill', e => stages.push(e.stage));
  combat.updateMonster(m, .1, p); assert.equal(stages[0], 'windup');
  p.x = 15; const hp = c.hp;
  for (let t = 0; t < 2.2; t += .1) combat.updateMonster(m, .1, p);
  assert.ok(stages.includes('impact')); assert.equal(c.hp, hp);
  m.skillCooldown = 0; m.skillRecovery = 0; p.x = 0;
  combat.updateMonster(m, .1, p); combat.debuff(m, { id: 'stun', duration: 5, stun: true });
  combat.updateMonster(m, .1, p); assert.equal(stages.at(-1), 'cancel');
});

test('special damage uses the advertised multiplier without a random elite heavy roll', () => {
  const c = Character.create('test', 'warrior'); c.level = 100;
  const cs = new Combatants({ random: () => .5 });
  cs.set(1, c.toJSON(), 'warrior'); cs.get(1).persist = { account: 'test', slot: 0 };
  // This sequence would trigger an elite heavy swing if the special attack
  // accidentally consulted the third random value.
  let calls = 0; cs.r = () => ++calls <= 2 ? .5 : 0;
  const actual = cs.get(1).c, hp = actual.hp;
  const def = { atk: 30, level: 1, elite: true, race: 'beast', element: 'earth' };
  const result = cs.swing(1, def, 1.5, { skill: true });
  const expected = Math.round(Math.max(1, (45 - actual.defense * .4) * (1 - actual.resist(def))));
  assert.equal(result.dmg, expected); assert.equal(actual.hp, hp - expected); assert.equal(calls, 2);
});

test('network bridge restores an in-progress warning and clears on map list / disconnect', () => {
  const net = new Emitter(); net.send = () => {}; net.online = true;
  const c = Character.create('test', 'warrior');
  const combat = new Combat(c, { playerPos: () => ({ x: 0, z: 0 }), canStand: () => true });
  const game = { game: { combat, character: c }, clock: { paused: true } };
  attachNetCombat(net, game);
  const events = []; let clears = 0;
  combat.on('boss-skill', e => events.push(e)); combat.on('boss-skills-clear', () => clears++);
  const { w, m, p } = setup(); w.update(.1, [p]); w.update(.5, [p]);
  net.emit('mlist', { m: w.list() });
  assert.equal(events.length, 1); assert.equal(events[0].cast.remaining, m.skillCast.remaining);
  net.emit('mskill', { id: m.id, stage: 'cancel', cast: { ...m.skillCast } });
  assert.equal(events.at(-1).stage, 'cancel'); assert.equal(combat.monsters[0].skillCast, null);
  net.emit('status', false); assert.equal(clears, 2);
});

test('telegraph surface follows terrain, preserves the safe inner ring, expires and frees geometry', () => {
  const root = new THREE.Group(), height = (x, z) => x * .05 + z * .1;
  const view = new BossTelegraphs(root, height);
  const cast = { ...BOSS_SKILLS.demon_rift_3[1], x: 2, z: 3, serial: 1 };
  view.event({ monster: { id: 1 }, stage: 'impact', cast });
  const item = view.items.get(1), vertices = item.fill.geometry.attributes.position;
  for (let i = 0; i < vertices.count; i++) {
    const x = vertices.getX(i), y = vertices.getY(i), z = vertices.getZ(i);
    assert.ok(Math.abs(y - height(x, z) - .12) < .00001);
    assert.ok(Math.hypot(x - cast.x, z - cast.z) >= cast.innerRadius - .00001);
  }
  let disposed = false; item.fill.geometry.addEventListener('dispose', () => disposed = true);
  view.update(.5, { x: 2, z: 3 });
  assert.equal(view.items.size, 0); assert.equal(root.children.length, 0); assert.ok(disposed);
});
