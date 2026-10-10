// Class kit skills fighting monsters (src/training/kitCombat.js, KitCaster.js)
// against the real Combat and Character, with a stand-in FX runner. No browser.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { castInfo, hitEffects, rollBlow, selfEffects, splashOf, within, inShape, monsterDefense } from '../src/training/kitCombat.js';
import { rollSkill } from '../src/training/damage.js';
import { KitCaster } from '../src/training/KitCaster.js';
import { Combat } from '../src/combat/Combat.js';
import { Character } from '../src/character/Character.js';
import { MONSTERS } from '../src/combat/data/monsters.js';
import { RULES } from '../src/combat/data/rules.js';
import { SKILL_BY_ID } from '../src/rules/data/skills.js';
import { MUAYTHAI_SKILLS } from '../src/classes/muaythai-moves.js';
import { HERBALIST_SKILLS } from '../src/classes/herbalist-moves.js';
import { HUNTER_SKILLS } from '../src/classes/hunter-moves.js';
import { WARRIOR_SKILLS } from '../src/classes/warrior-moves.js';
import { SHAMAN_SKILLS } from '../src/classes/shaman-moves.js';

const seq = values => { let i = 0; return () => values[i++ % values.length]; };
const KIT = RULES.kit;

test('every kit skill of every class gets a cost and a reach (rules entry or defaults)', () => {
  const missing = [];
  for (const list of [MUAYTHAI_SKILLS, HERBALIST_SKILLS, HUNTER_SKILLS, WARRIOR_SKILLS, SHAMAN_SKILLS]) for (const s of list) {
    if (!SKILL_BY_ID[s.id]) missing.push(s.id);
    const info = castInfo({ ...s, cd: s.cd ?? 1 });
    assert.ok(info.range >= KIT.minRange && info.range <= KIT.maxRange, `${s.id} range ${info.range}`);
    assert.ok(info.mp >= 0 && Number.isFinite(info.mp), `${s.id} mp`);
  }
  // every kit skill has a rules entry (none falls back to RULES.kit.fallbackMult)
  assert.deepEqual(missing, []);
});

test('cast info: melee reach is the minimum, ranged skills reach far, buffs need no target', () => {
  assert.equal(castInfo({ id: 'boxer_jab', cd: 2 }).range, KIT.minRange);
  assert.equal(castInfo({ id: 'boxer_jab', cd: 2 }).needsTarget, true);
  assert.equal(castInfo({ id: 'arch_quick', cd: 1.8 }).range, Math.min(KIT.maxRange, 280 / KIT.pxPerMeter));
  assert.equal(castInfo({ id: 'boxer_waikru', cd: 22 }).needsTarget, false);
  // the rules' mp / cd win (they scale with skill level); the kit's fill only skills the rules lack
  assert.equal(castInfo({ id: 'boxer_kick', mp: 7, cd: 4.5 }).mp, SKILL_BY_ID.boxer_kick.mp);
  assert.equal(castInfo({ id: 'boxer_kick', mp: 7, cd: 4.5 }).cd, SKILL_BY_ID.boxer_kick.cd / 1000);
  assert.ok(castInfo({ id: 'boxer_kick' }, 5).cd < castInfo({ id: 'boxer_kick' }, 1).cd);
  assert.equal(castInfo({ id: 'heal_zone', mp: 9, cd: 18 }).cd, SKILL_BY_ID.heal_zone.cd / 1000);
  assert.equal(castInfo({ id: 'heal_zone' }).splash.around, 'target');
  assert.equal(castInfo({ id: 'heal_pill', cd: 6 }).mp, SKILL_BY_ID.heal_pill.mp);
});

test('area skills splash: around the caster or the target', () => {
  assert.deepEqual(splashOf(SKILL_BY_ID.boxer_croc), { radius: 48 / KIT.pxPerMeter, around: 'self' });
  assert.equal(splashOf(SKILL_BY_ID.arch_rain).around, 'target');
  assert.equal(splashOf(SKILL_BY_ID.boxer_jab), null);
  const ms = [{ x: 0, z: 0, alive: true }, { x: 1, z: 0, alive: true }, { x: 5, z: 0, alive: true }, { x: .5, z: 0, alive: false }];
  assert.deepEqual(within(ms, { x: 0, z: 0 }, 2, ms[0]), [ms[1]]);
});

test('a blow against a monster uses its DEF and EVA (same formula as the dummy)', () => {
  const c = Character.create('ทดสอบ', 'muaythai'), d = { ...c.derived, patk: c.patk, matk: c.matk, critRate: c.critChance };
  const boar = monsterDefense(MONSTERS.boar);
  const r = rollBlow(d, boar, 'boxer_kick', 1, seq([0, .5, .99]));
  assert.deepEqual(r, rollSkill(d, boar, 'boxer_kick', 1, seq([0, .5, .99])));
  assert.equal(r.dmg, Math.round(Math.max(1, d.patk * SKILL_BY_ID.boxer_kick.mult - MONSTERS.boar.def * .5)));
  // a buff with no damage multiplier still strikes at the fallback multiplier
  const f = rollBlow(d, boar, 'boxer_waikru', 1, seq([0, .5, .99]));
  assert.equal(f.dmg, Math.round(Math.max(1, d.patk * KIT.fallbackMult - MONSTERS.boar.def * .5)));
});

test('rules effects become Combat debuffs and Character buffs', () => {
  const e = hitEffects('boxer_elbow', 40);
  assert.deepEqual(e.map(x => x.id).sort(), ['bleed', 'stun']);
  const bleed = e.find(x => x.id === 'bleed');
  assert.equal(bleed.source, 40); assert.ok(bleed.dot > 0 && bleed.duration > 0);
  const w = selfEffects('boxer_iron', 1, 20);
  assert.ok(w.buff.atk > 0 && w.buff.def > 0 && w.buff.duration > 0 && w.heal > 0);
  assert.equal(selfEffects('boxer_jab'), null);
});

// ---- KitCaster with the real Combat ----------------------------------------------
// A stand-in runner that behaves like the FX runners: every listed hit time asks
// damage(id) and hurts / misses the target it was built with (here, at once).
function fakeRunner(target, damage, hits) {
  const R = { busy: false, range: 12, current: null, casts: [] };
  R.cast = id => {
    R.current = id; R.casts.push(id);
    for (let i = 0; i < (hits[id] ?? 1); i++) {
      const r = damage(id);
      if (!r || !r.dmg) target.hurt(50, false);
      else if (!r.hit) target.miss();
      else target.hurt(r.dmg, r.crit, .1, null, true);
    }
    return 1;
  };
  R.update = () => {};
  return R;
}
function setup({ boarAt = { x: 0, z: 2 } } = {}) {
  const character = Character.create('ทดสอบ', 'muaythai');
  character.jobLevel = 50; for (const id of character.kitSkills) character.skills[id] = 1;   // every skill learnt
  const player = { group: new THREE.Group() }; player.position = player.group.position;
  const walks = [];
  const combat = new Combat(character, { canStand: () => true, playerPos: () => player.position, moveTo: (x, z) => walks.push([x, z]), stop() {} },
    [{ type: 'boar', x: boarAt.x, z: boarAt.z, radius: 0, count: 1 }]);
  combat.update(0);   // spawns the boar
  const fx = { K: 1, root: { position: { y: 0 } }, toLocal: v => v.clone(), addTask() {} };
  const kit = { skills: MUAYTHAI_SKILLS.map(s => ({ ...s, cd: s.cooldown })) };
  const events = [];
  for (const n of ['hit', 'miss', 'kill', 'fail']) combat.on(n, e => events.push([n, e]));
  const caster = new KitCaster({
    kit, fx, player, combat, character, canStand: () => true, skillLevel: 1,
    stats: () => ({ ...character.derived, patk: character.patk, matk: character.matk, critRate: character.critChance, accuracy: 999 }),
    dummy: () => null, nearDummy: () => false, dummyDefense: () => ({ def: 0, eva: 0 }), dummyRange: 12,
    runnerFactory: (t, damage) => fakeRunner(t, damage, { boxer_jab: 3 }),
  });
  return { character, combat, caster, events, walks, player, boar: combat.monsters[0] };
}

test('a kit skill hits the combat target with rules damage, costs MP and starts its cooldown', () => {
  const { character, combat, caster, events, boar } = setup();
  combat.setTarget(boar);
  const mp = character.mp, hp = boar.hp;
  assert.equal(caster.cast(0), true);   // หมัดแย็บ: three blows
  caster.update(1);
  const hits = events.filter(([n]) => n === 'hit'), misses = events.filter(([n]) => n === 'miss');
  assert.equal(hits.length + misses.length, 3, 'three blows (a roll may miss)');
  assert.equal(boar.hp, Math.max(0, hp - hits.reduce((n, [, e]) => n + e.amount, 0)));
  assert.equal(character.mp, mp - caster.slots[0].mp);
  assert.ok(caster.cooldown(0)[0] > 0);
  assert.equal(caster.cast(0), false, 'on cooldown');
  assert.ok(['chase', 'dead'].includes(boar.state), 'aggro or killed');
});

test('killing a monster with kit skills goes through the combat kill path (EXP, gold)', () => {
  const { character, combat, caster, events, boar } = setup();
  combat.setTarget(boar);
  character.mp = 999;
  const exp = character.exp, gold = character.gold;
  for (let i = 0; i < 10 && boar.alive; i++) { caster.cd.clear(); caster.cast(1); caster.update(2); }
  assert.equal(boar.alive, false);
  const kill = events.find(([n]) => n === 'kill');
  assert.ok(kill, 'kill event');
  assert.ok(character.exp > exp || character.level > 1);
  assert.ok(character.gold >= gold + MONSTERS.boar.gold[0]);
  assert.equal(combat.target, null);
});

test('out of range: the player walks in, then the skill fires; nothing near: a failure message', () => {
  const far = setup({ boarAt: { x: 0, z: 9 } });
  far.combat.setTarget(far.boar);
  assert.equal(far.caster.cast(0), true);
  assert.equal(far.caster.active(0), true);
  far.caster.update(.1);
  assert.ok(far.walks.length > 0, 'walks toward the boar');
  far.player.position.set(0, 0, 8);
  far.caster.update(.1);
  far.caster.update(1);
  assert.equal(far.caster.active(0), false);
  assert.ok(far.events.some(([n]) => n === 'hit' || n === 'miss'));

  const none = setup({ boarAt: { x: 60, z: 60 } });
  assert.equal(none.caster.cast(0), false);
  assert.ok(none.events.some(([n, e]) => n === 'fail' && /เป้าหมาย/.test(e)));
  // a self buff still casts with nothing around
  assert.equal(none.caster.cast(3), true);   // ไหว้ครู
  assert.ok(none.character.buffs.some(b => b.id === 'kit_boxer_waikru'));
});

test('area skills also hit monsters around the caster', () => {
  const { combat, caster, events, character } = setup({ boarAt: { x: 0, z: 1.5 } });
  const second = new (combat.monsters[0].constructor)('boar', combat.monsters[0].spawn, .8, 1.5);
  combat.monsters.push(second);
  combat.setTarget(combat.monsters[0]);
  character.mp = 999;
  // the blow on the target must land (a miss splashes nobody): pin the dice for this cast
  const random = Math.random; Math.random = () => .5;
  try { caster.cast(2); caster.update(2); } finally { Math.random = random; }   // จระเข้ฟาดหาง
  const struck = new Set(events.filter(([n]) => n === 'hit' || n === 'miss').map(([, e]) => e.monster));
  assert.equal(struck.size, 2);
});

test('piercing shots hit a line, spread volleys a fan, from the caster toward the target', () => {
  const line = splashOf(SKILL_BY_ID.arch_volley), fan = splashOf(SKILL_BY_ID.mage_ghostfire);
  assert.ok(line.line && line.length > 5); assert.ok(fan.cone && fan.angle > .5);
  assert.equal(splashOf(SKILL_BY_ID.arch_quick), null);           // two arrows into one target
  const me = { x: 0, z: 0 }, target = { x: 0, z: 4, alive: true };
  const behind = { x: .5, z: 8, alive: true }, beside = { x: 2, z: 4, alive: true }, back = { x: 0, z: -3, alive: true };
  const ms = [target, behind, beside, back];
  assert.deepEqual(inShape(ms, me, target, line, target), [behind]);
  assert.deepEqual(inShape(ms, me, target, fan, target), [beside, behind]);
});


test('gameplay hits survive silent FX, and late visual callbacks cannot damage a rebound target', () => {
  const { caster, combat, boar, events } = setup();
  boar.hp = 10000;
  const second = new boar.constructor('boar', boar.spawn, .8, 1.5);
  second.hp = 10000; combat.monsters.push(second);
  caster.runner.cast = id => { caster.runner.current = id; return true; };
  combat.setTarget(boar); caster.cast(0);
  combat.setTarget(second); caster.cast(1);
  const random = Math.random; Math.random = () => .5;
  try { caster.update(2); } finally { Math.random = random; }
  const hits = events.filter(([n]) => n === 'hit');
  assert.equal(hits.filter(([, e]) => e.monster === boar).length, 3);
  assert.equal(hits.filter(([, e]) => e.monster === second).length, 1);
  const hp = second.hp;
  caster.proxy.hurt(9999, false, .1, null, true);
  assert.equal(second.hp, hp, 'late FX is cosmetic');
});

test('a target leaving skill reach before its hit takes no damage', () => {
  const { caster, combat, boar, events } = setup();
  combat.setTarget(boar); caster.cast(0); boar.z = 30;
  caster.update(2);
  assert.equal(events.filter(([n]) => n === 'hit').length, 0);
  assert.equal(caster.hitCasts.length, 0);
});
