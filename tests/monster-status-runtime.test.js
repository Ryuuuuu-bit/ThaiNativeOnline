import test from 'node:test';
import assert from 'node:assert/strict';
import { Character } from '../src/character/Character.js';
import { Emitter } from '../src/character/Emitter.js';
import { Combat, Monster } from '../src/combat/Combat.js';
import { MONSTERS } from '../src/combat/data/monsters.js';
import { SKILLS } from '../src/combat/data/skills.js';
import { effectiveDefense, monsterAttackMul } from '../src/combat/statusEffects.js';
import { MonsterWorld } from '../server/monsters.js';
import { attachNetCombat } from '../src/net/NetCombat.js';
import { applyEffects } from '../src/rules/effects.js';

function local(classId = 'warrior', type = 'soldier') {
  const c = Character.create('ทดสอบ', classId); c.level = 100; c.hp = c.maxHp; c.mp = c.maxMp;
  const p = { x: 0, z: 0 };
  const combat = new Combat(c, { playerPos: () => p, canStand: () => true });
  const m = new Monster(type, { radius: 0, active: ['day'] }, .5, 0);
  m.hp = m.maxHp = 100000; combat.monsters.push(m);
  return { c, combat, m, p };
}
function server(type = 'soldier') {
  const world = new MonsterWorld('test', { random: () => .5,
    zones: [{ type, x: 0, z: 0, radius: 0, count: 1, active: ['day'] }] });
  const m = world.monsters[0]; world.spawn(m); return { world, m };
}

test('defense/weakness use the strongest live instance effect, cap 60%, and leave definitions unchanged', () => {
  const definition = MONSTERS.soldier, before = structuredClone(definition);
  const monster = { def: definition, debuffs: [
    { remaining: 4, armorBreak: .2, weak: .15 },
    { remaining: 1, armorBreak: .4, weak: .3 },
    { remaining: 0, armorBreak: 1, weak: 1 },
    { remaining: -1, armorBreak: 1, weak: 1 },
    { remaining: 1, armorBreak: NaN, weak: Infinity },
  ] };
  const instanceBefore = structuredClone(monster);
  assert.deepEqual(effectiveDefense(monster), { def: definition.def * .6, eva: definition.eva ?? 0 });
  assert.equal(monsterAttackMul(monster), .7);
  assert.deepEqual(effectiveDefense(definition), { def: definition.def, eva: definition.eva ?? 0 });
  assert.deepEqual(monster, instanceBefore, 'Reads must not rewrite live effects');
  monster.debuffs.push({ remaining: 1, armorBreak: .95, weak: .99 });
  assert.equal(effectiveDefense(monster).def, definition.def * .4);
  assert.equal(monsterAttackMul(monster), .4);
  monster.debuffs.forEach(d => { d.remaining = 0; });
  assert.deepEqual(effectiveDefense(monster), effectiveDefense(definition));
  assert.equal(monsterAttackMul(monster), 1);
  assert.deepEqual(definition, before, 'Shared MONSTERS content stays immutable');
});

test('local debuffs expire independently; the weaker effect resumes after the strongest expires', () => {
  const { combat, m, p } = local();
  combat.debuff(m, { id: 'light', duration: 3, armorBreak: .2, weak: .1 });
  combat.debuff(m, { id: 'heavy', duration: 1, armorBreak: .5, weak: .4 });
  assert.equal(effectiveDefense(m).def, m.def.def * .5); assert.equal(monsterAttackMul(m), .6);
  combat.updateMonster(m, 1, p);
  assert.equal(effectiveDefense(m).def, m.def.def * .8); assert.equal(monsterAttackMul(m), .9);
  combat.updateMonster(m, 2, p);
  assert.equal(effectiveDefense(m).def, m.def.def); assert.equal(monsterAttackMul(m), 1);
});

test('normal, magic and real pet blows read current armor break instead of the shared definition', t => {
  t.mock.method(Math, 'random', () => .5);
  const { c, combat, m, p } = local('hunter');
  Object.defineProperties(c, { patk: { value: 1000 }, matk: { value: 1000 } });
  const physical = combat.rollPlayerDamage(SKILLS.slash, m).dmg;
  const magical = combat.rollPlayerDamage(SKILLS.bolt, m).dmg;
  let bite; combat.on('pet-bite', e => { bite = e.amount; });
  combat.target = m; combat.combatTimer = 10;
  Object.assign(combat.pet, { placed: true, x: m.x, z: m.z, attackTimer: 0 });
  combat.updatePet(0, p); const normalBite = bite;
  combat.debuff(m, { id: 'break', duration: 1, armorBreak: .6 });
  assert.ok(combat.rollPlayerDamage(SKILLS.slash, m).dmg > physical);
  assert.ok(combat.rollPlayerDamage(SKILLS.bolt, m).dmg > magical);
  combat.pet.attackTimer = 0; combat.updatePet(0, p); assert.ok(bite > normalBite);
  combat.updateMonster(m, 1, p);
  assert.equal(combat.rollPlayerDamage(SKILLS.slash, m).dmg, physical);
  combat.pet.attackTimer = 0; combat.updatePet(0, p); assert.equal(bite, normalBite);
  assert.equal(m.def, MONSTERS.soldier);
});

test('weak lowers offline normal and boss-skill damage; authoritative results are not weakened twice', t => {
  t.mock.method(Math, 'random', () => .5);
  for (const type of ['soldier', 'bamboo_grave_3']) {
    const { c, combat, m } = local('warrior', type);
    Object.defineProperty(c, 'defense', { value: 0 }); // Keep both blows above the one-damage floor.
    const fx = m.def.boss ? { skill: 'qa', power: 1.5 } : null;
    let amount; combat.on('player-hit', e => { amount = e.amount; });
    const hp = c.maxHp; c.hp = hp; combat.monsterAttack(m, null, fx); const normal = amount;
    c.hp = hp; combat.debuff(m, { id: 'weak', duration: 10, weak: .5 });
    combat.monsterAttack(m, null, fx); assert.ok(amount < normal, `${type}: weakness actually lowers the blow`);
    c.hp = hp; combat.monsterAttack(m, { hp: hp - 20, dmg: 20 }, fx);
    assert.equal(amount, 20); assert.equal(c.hp, hp - 20, 'Server HP/damage remain authoritative');
    m.debuffs[0].remaining = 0; c.hp = hp; combat.monsterAttack(m, null, fx); assert.equal(amount, normal);
  }
});

test('resolved lethal swing overrides stale local undying and completes death lifecycle exactly once', () => {
  const { c, combat, m } = local();
  c.hp = 80; c.sitting = true;
  c.addBuff({ id: 'stale-undying', duration: 30, undying: true });
  c.addBuff({ id: 'stale-poison', duration: 30, poison: 3 });
  combat.target = m; combat.autoAttack = true; combat.pending = { skillId: 'slash', target: m };
  m.state = 'chase';
  const events = [];
  c.on('change', () => events.push(['change', c.hp]));
  c.on('damaged', amount => events.push(['damaged', amount]));
  c.on('death', () => events.push(['death', c.hp]));
  combat.on('player-hit', e => events.push(['player-hit', e.amount]));
  combat.on('player-death', monster => events.push(['player-death', monster.id]));
  assert.equal(c.undying, true);
  combat.monsterAttack(m, { hp: 0, dmg: 17, mp: 4, dead: true });
  assert.equal(c.hp, 0); assert.equal(c.mp, 4); assert.equal(c.alive, false);
  assert.deepEqual(c.buffs, []); assert.equal(c.sitting, false);
  assert.equal(combat.autoAttack, false); assert.equal(combat.pending, null); assert.equal(combat.target, null);
  assert.equal(m.state, 'return');
  assert.deepEqual(events, [['change', 0], ['damaged', 17], ['death', 0], ['player-hit', 17], ['player-death', m.id]]);
  // A repeated already-resolved death must not count another death / reopen its lifecycle.
  combat.monsterAttack(m, { hp: 0, dmg: 0, dead: true });
  assert.equal(events.filter(([name]) => name === 'death').length, 1);
  assert.equal(events.filter(([name]) => name === 'player-death').length, 1);
});

test('resolved surviving swing preserves exact fractional server HP and server damage events', () => {
  const { c, combat, m } = local(); c.hp = 1;
  c.addBuff({ id: 'stale-undying', duration: 30, undying: true });
  const events = [];
  c.on('damaged', amount => events.push(['damaged', amount]));
  c.on('death', () => events.push(['death']));
  combat.on('player-hit', e => events.push(['player-hit', e.amount]));
  combat.on('player-death', () => events.push(['player-death']));
  combat.monsterAttack(m, { hp: 7.25, dmg: 20, mp: 9, dead: false });
  assert.equal(c.hp, 7.25); assert.equal(c.mp, 9); assert.equal(c.alive, true);
  assert.deepEqual(events, [['damaged', 20], ['player-hit', 20]]);
  assert.equal(c.undying, true, 'Surviving results do not remove buffs awaiting their own authoritative sync');
});

test('server dodge reconciles supplied HP and MP without hit effects or damage, and supports the old no-HP shape', () => {
  const { c, combat, m } = local('warrior', 'cobra'); c.hp = 5;
  const events = [];
  c.on('change', () => events.push('change')); c.on('damaged', () => events.push('damaged'));
  combat.on('dodge', () => events.push('dodge')); combat.on('player-hit', () => events.push('hit'));
  combat.monsterAttack(m, { dodge: true, hp: 13.75, mp: 8 });
  assert.equal(c.hp, 13.75); assert.equal(c.mp, 8);
  assert.deepEqual(events, ['change', 'dodge']); assert.deepEqual(c.buffs, [], 'Dodged cobra cannot apply poison');
  combat.monsterAttack(m, { dodge: true });
  assert.equal(c.hp, 13.75); assert.deepEqual(events, ['change', 'dodge', 'dodge']);
});

test('offline lethal swings still honor live undying, then kill normally once protection expires', t => {
  t.mock.method(Math, 'random', () => .5);
  const { c, combat, m } = local(); c.hp = 10;
  c.addBuff({ id: 'undying', duration: 2, undying: true });
  let deaths = 0, damage;
  combat.on('player-death', () => { deaths++; }); combat.on('player-hit', e => { damage = e.amount; });
  combat.monsterAttack(m, null, { skill: 'qa', power: 1000 });
  assert.equal(c.hp, 1); assert.equal(damage, 9); assert.equal(deaths, 0); assert.equal(c.undying, true);
  c.buffs[0].remaining = 0;
  combat.monsterAttack(m, null, { skill: 'qa', power: 1000 });
  assert.equal(c.hp, 0); assert.equal(damage, 1); assert.equal(deaths, 1); assert.deepEqual(c.buffs, []);
});

test('remote guest server-adjusted power applies weakness once; offline normal/boss rolls retain local weakness', t => {
  t.mock.method(Math, 'random', () => .5);
  for (const type of ['soldier', 'bamboo_grave_3']) {
    const { c, combat, m } = local('warrior', type); Object.defineProperty(c, 'defense', { value: 0 });
    const power = m.def.boss ? 1.5 : 1, skill = m.def.boss ? 'qa' : undefined;
    let amount; combat.on('player-hit', e => { amount = e.amount; });
    c.hp = c.maxHp; combat.monsterAttack(m, null, { power, skill }); const normal = amount;
    combat.debuff(m, { id: 'weak', duration: 10, weak: .5 });
    c.hp = c.maxHp; combat.monsterAttack(m, null, { power, skill }); const offline = amount;
    assert.ok(offline < normal);
    combat.remote = true; c.hp = c.maxHp;
    combat.monsterAttack(m, null, { power: power * .5, skill });
    assert.equal(amount, offline, `${type}: already adjusted guest power must not get another 50% reduction`);
    if (!m.def.boss) {
      c.hp = c.maxHp; combat.monsterAttack(m, null, {});
      assert.equal(amount, offline, 'Without server-supplied power, local weakness still applies');
    }
  }
});

test('server md round-trip preserves armor/weak strengths and halves boss duration exactly once', () => {
  for (const type of ['soldier', 'bamboo_grave_3']) {
    const { world, m } = server(type), expected = m.def.boss ? 4 : 8;
    const input = { id: 'status', duration: 8, remaining: 8, armorBreak: .35, weak: .25, label: 'อ่อนแรง' };
    const event = world.debuff(m, input);
    assert.equal(input.remaining, 8, 'Application does not mutate the caller effect');
    assert.equal(m.debuffs[0].remaining, expected); assert.equal(event.d.secs, expected);
    assert.equal(event.d.armorBreak, .35); assert.equal(event.d.weak, .25);
    const { c, combat } = local();
    const net = new Emitter(); net.online = true; net.send = () => {};
    const remote = attachNetCombat(net, { game: { combat, character: c }, clock: { paused: true } });
    net.emit('mlist', { m: [world.info(m)] }); net.emit('md', event);
    const copy = remote.monster(m.id);
    assert.equal(copy.debuffs[0].remaining, expected, 'Receiving already adjusted md never halves again');
    assert.deepEqual(effectiveDefense(copy), effectiveDefense(m)); assert.equal(monsterAttackMul(copy), .75);
    world.update(expected, [], 'day');
    assert.equal(monsterAttackMul(m), 1); assert.equal(effectiveDefense(m).def, m.def.def);
  }
});

test('local/server bosses share control duration resistance and preserve the existing DoT tick duration', () => {
  const { combat, m } = local('warrior', 'bamboo_grave_3'), { world, m: other } = server('bamboo_grave_3');
  for (const effect of [
    { id: 'stun', stun: true, duration: 6 }, { id: 'slow', slow: .4, duration: 6 },
    { id: 'armor', armorBreak: .3, duration: 6 }, { id: 'weak', weak: .2, duration: 6 },
    { id: 'poison', dot: .1, source: 5, duration: 6 },
  ]) {
    const before = structuredClone(effect); combat.debuff(m, effect);
    const event = world.debuff(other, { ...effect, remaining: effect.duration });
    const expected = effect.dot ? 6 : 3;
    assert.equal(m.debuffs.find(d => d.id === effect.id).remaining, expected);
    assert.equal(event.d.secs, expected); assert.deepEqual(effect, before);
  }
});

test('kit classes reject legacy non-basics before spending resources; basics and assassin fallback still work', t => {
  t.mock.method(Math, 'random', () => .5);
  const { c, combat, m } = local(); const before = { mp: c.mp, hp: c.hp };
  let casts = 0; combat.on('cast', () => { casts++; });
  assert.ok(c.kitSkills.length);
  assert.equal(combat.execute('guard', null), false);
  assert.equal(combat.execute('whirl', m), false);
  assert.deepEqual({ mp: c.mp, hp: c.hp }, before);
  assert.equal(combat.gcd, 0); assert.equal(casts, 0); assert.deepEqual(c.cooldowns, {});
  assert.equal(combat.useSkill('guard').ok, false);
  const hp = m.hp; combat.execute('slash', m); assert.ok(m.hp < hp); assert.equal(casts, 1);
  const fallback = local('assassin'); assert.equal(fallback.c.kitSkills.length, 0);
  fallback.combat.execute('smoke', null);
  assert.ok(fallback.c.buffs.some(b => b.id === 'smoke'));
  assert.equal(fallback.c.mp, fallback.c.maxMp - SKILLS.smoke.mp);
});

test('real cleanse clears external player rule conditions and negative buffs without cleansing monsters', () => {
  const { c, combat, m } = local();
  c.addBuff({ id: 'positive', duration: 5, atk: .2 }); c.addBuff({ id: 'poison', duration: 5, poison: 1 });
  combat.debuff(m, { id: 'weak', duration: 5, weak: .2 });
  applyEffects(combat, { stun: { ms: 500 }, slow: { ms: 500, pct: .4 }, weak: { ms: 500, pct: .3 },
    poison: { ticks: 2, every: 100, ratio: .1 } }, 10, 0);
  let cleansed = 0; combat.on('cleansed', () => { cleansed++; });
  c.addBuff({ id: 'clean', duration: 1, cleanse: 1 });
  assert.equal(combat.stunUntil, 0); assert.equal(combat.slowUntil, 0); assert.equal(combat.slowPct, 0);
  assert.equal(combat.weakUntil, 0); assert.equal(combat.weakPct, 0); assert.equal(combat.dots, null);
  assert.equal(cleansed, 1); assert.ok(c.buffs.some(b => b.id === 'positive'));
  assert.ok(!c.buffs.some(b => b.id === 'poison')); assert.equal(monsterAttackMul(m), .8);
});
