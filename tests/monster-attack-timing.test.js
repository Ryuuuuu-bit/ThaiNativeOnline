import test from 'node:test';
import assert from 'node:assert/strict';
import { Combat, Monster } from '../src/combat/Combat.js';
import { Character } from '../src/character/Character.js';
import { Emitter } from '../src/character/Emitter.js';
import { MonsterWorld } from '../server/monsters.js';
import { Combatants } from '../server/combatants.js';
import { attachNetCombat } from '../src/net/NetCombat.js';
import { monsterAttackImpact, beginMonsterStrike, tickMonsterStrike, acceptMonsterStrike, releaseMonsterStrike } from '../src/combat/monsterAttackTiming.js';

const impact = 13 / 24;
const offline = (type = 'tani') => {
  const c = Character.create('TimingQA', 'warrior'); c.hp = 10000; c.evadeChance = () => 0;
  const p = { x: 1, z: 0 }, combat = new Combat(c, { playerPos: () => p, canStand: () => true });
  const m = new Monster(type, { type, x: 0, z: 0, radius: 0, active: ['day'], count: 1 }, 0, 0);
  m.state = 'chase'; combat.monsters.push(m);
  return { c, p, combat, m };
};
const online = () => {
  const f = offline(), net = new Emitter(); net.send = () => {}; net.online = true;
  const nc = attachNetCombat(net, { game: { combat: f.combat, character: f.c }, clock: { paused: true } });
  const info = { id: 7, type: 'tani', x: 0, z: 0, hp: 9000, st: 2, generation: 1 };
  net.emit('mlist', { m: [info] });
  return { ...f, net, nc, m: nc.monster(7), info };
};
const server = (type = 'tani') => {
  const w = new MonsterWorld('test', { zones: [{ type, x: 0, z: 0, radius: 0, count: 1, active: ['day'] }], random: () => .5 });
  const m = w.monsters[0]; w.spawn(m);
  const p = { id: 1, x: 1, z: 0, lv: 20 }; m.state = 'chase'; m.target = 1;
  return { w, m, p };
};

test('pure strike clock releases once at contact, default metadata remains zero', () => {
  assert.equal(monsterAttackImpact('tani'), impact); assert.equal(monsterAttackImpact('boar'), 0);
  const m = { type: 'tani' }; beginMonsterStrike(m);
  assert.equal(tickMonsterStrike(m, impact - .001), null);
  assert.ok(tickMonsterStrike(m, .001)); assert.equal(tickMonsterStrike(m, 10), null);
});

test('offline HP and hit/status events wait for press, cooldown starts at gather', () => {
  const { c, p, combat, m } = offline(); let starts = 0, hits = 0;
  combat.on('monster-attack', () => starts++); combat.on('player-hit', () => hits++);
  const hp = c.hp, mp = c.mp; combat.monsterAttack(m); const cooldown = m.attackTimer;
  assert.equal(starts, 1); assert.equal(c.hp, hp); assert.equal(c.mp, mp);
  combat.updateMonster(m, impact - .001, p); assert.equal(c.hp, hp); assert.equal(hits, 0);
  combat.updateMonster(m, .001, p); assert.ok(c.hp < hp); assert.equal(hits, 1); assert.equal(starts, 1);
  assert.ok(Math.abs(m.attackTimer - (cooldown - impact)) < 1e-8);
  combat.updateMonster(m, .001, p); assert.equal(hits, 1);
});

for (const reason of ['walkout', 'player death', 'monster death', 'despawn', 'stun', 'map leave']) {
  test(`offline ${reason} cancels the reserved blow without HP loss`, () => {
    const { c, p, combat, m } = offline(); const hp = c.hp; let cancelled = 0;
    combat.on('monster-attack-cancel', () => cancelled++); combat.monsterAttack(m);
    if (reason === 'walkout') p.x = 30;
    if (reason === 'player death') c.hp = 0;
    if (reason === 'monster death') m.hp = 0;
    if (reason === 'despawn') { m.hp = 0; m.state = 'dormant'; m.respawnTimer = 100; }
    if (reason === 'stun') m.debuffs.push({ stun: true, remaining: 10 });
    if (reason === 'map leave') combat.cancelMonsterAttacks();
    combat.updateMonster(m, impact, p);
    assert.equal(c.hp, reason === 'player death' ? 0 : hp); assert.equal(cancelled, 1); assert.equal(m.strike, null);
  });
}

test('zero-marker offline monster retains immediate damage', () => {
  const { c, combat, m } = offline('boar'); const hp = c.hp;
  combat.monsterAttack(m); assert.ok(c.hp < hp); assert.equal(m.strike, undefined);
});

test('server emits gather with identity then exactly one authoritative ma at contact', () => {
  const { w, m, p } = server(); const start = w.update(.01, [p], 'day');
  const cue = start.find(e => e.t === 'mstrike'); assert.ok(cue); assert.equal(cue.remaining, impact);
  assert.ok(!start.some(e => e.t === 'ma')); const cooldown = m.attackTimer;
  assert.ok(!w.update(impact - .001, [p], 'day').some(e => e.t === 'ma'));
  const hits = w.update(.001, [p], 'day').filter(e => e.t === 'ma'); assert.equal(hits.length, 1);
  assert.equal(hits[0].attackId, cue.attackId); assert.equal(hits[0].generation, cue.generation);
  assert.ok(Math.abs(m.attackTimer - (cooldown - impact)) < 1e-8);
  assert.ok(!w.update(.001, [p], 'day').some(e => e.t === 'ma'));
});

for (const reason of ['walkout', 'dead target', 'left map', 'retarget', 'monster death', 'despawn', 'stun']) {
  test(`server ${reason} cancels before releasing authoritative damage`, () => {
    const { w, m, p } = server(); w.update(.01, [p], 'day'); let players = [p];
    if (reason === 'walkout') p.x = 30;
    if (reason === 'dead target') p.dead = true;
    if (reason === 'left map') players = [];
    if (reason === 'retarget') m.target = 2;
    if (reason === 'monster death') m.hp = 0;
    if (reason === 'despawn') { m.hp = 0; m.state = 'dormant'; m.respawn = 100; }
    if (reason === 'stun') m.debuffs.push({ stun: true, remaining: 10 });
    const ev = w.update(impact, players, 'day'); assert.ok(!ev.some(e => e.t === 'ma'));
    assert.ok(ev.some(e => e.t === 'mstrike' && e.stage === 'cancel'));
  });
}

test('zero-marker server keeps existing immediate ma packet', () => {
  const { w, p } = server('boar'); const ev = w.update(.01, [p], 'day');
  assert.equal(ev.filter(e => e.t === 'ma').length, 1); assert.ok(!ev.some(e => e.t === 'mstrike'));
});

test('network start never mutates HP and duplicate/lost/reordered packets do not repeat damage', () => {
  const { net, m, c, combat } = online(); let cues = 0, hits = 0;
  combat.on('monster-attack', () => cues++); combat.on('player-hit', () => hits++);
  const cue = { id: 7, generation: 1, attackId: 1, remaining: .2, stage: 'windup' };
  const hp = c.hp; net.emit('mstrike', cue); net.emit('mstrike', cue); assert.equal(cues, 1); assert.equal(c.hp, hp);
  const result = { id: 7, generation: 1, attackId: 1, res: { hp: 9000, dmg: 1000, mp: 20 } };
  net.emit('ma', result); net.emit('ma', result); net.emit('mstrike', cue);
  assert.equal(hits, 1); assert.equal(c.hp, 9000); assert.equal(cues, 1); assert.equal(m.strike, null);
  net.emit('ma', { ...result, attackId: 2, res: { hp: 8900, dmg: 100, mp: 20 } });
  assert.equal(hits, 2); assert.equal(c.hp, 8900); assert.equal(cues, 1, 'lost start must not replay gather');
  net.emit('mstrike', { ...cue, attackId: 2 }); assert.equal(cues, 1);
});

test('respawn generation rejects old identity and reconnect resumes remaining time', () => {
  const { net, m, c, info, combat } = online(); let cues = 0;
  combat.on('monster-attack', () => cues++);
  net.emit('mstrike', { id: 7, stage: 'windup', generation: 1, attackId: 1, remaining: impact });
  net.emit('mgone', { id: 7 }); net.emit('mspawn', { m: { ...info, generation: 2 } });
  const hp = c.hp; net.emit('ma', { id: 7, generation: 1, attackId: 1, res: { hp: 1, dmg: 9999 } }); assert.equal(c.hp, hp);
  net.emit('mlist', { m: [{ ...info, generation: 2, strike: { generation: 2, attackId: 1, remaining: .2 } }] });
  assert.equal(m.strike.remaining, .2); assert.equal(cues, 2);
});

test('cancel tombstone rejects a reordered gather and old release', () => {
  const { net, c, combat } = online(); let cues = 0; combat.on('monster-attack', () => cues++);
  net.emit('mstrike', { id: 7, stage: 'cancel', generation: 1, attackId: 4 });
  net.emit('mstrike', { id: 7, stage: 'windup', generation: 1, attackId: 4, remaining: impact });
  const hp = c.hp; net.emit('ma', { id: 7, generation: 1, attackId: 4, res: { hp: 1, dmg: 9999 } });
  assert.equal(c.hp, hp); assert.equal(cues, 0);
});

test('authoritative HP remains unchanged until ma and a trade freeze suppresses the release', () => {
  const { w, p } = server(), cs = new Combatants({ now: () => 0, random: () => .5 });
  const c = Character.create('ServerQA', 'warrior'); cs.load(1, c.toJSON(), { account: 'qa', slot: 0 });
  const live = cs.get(1), hp = live.c.hp;
  const apply = events => events.filter(e => e.t === 'ma').forEach(e => cs.swing(e.to, w.byId(e.id).def, e.power));
  apply(w.update(.01, [p], 'day')); assert.equal(live.c.hp, hp);
  apply(w.update(impact - .001, [p], 'day')); assert.equal(live.c.hp, hp);
  live.tradeBusy = true; apply(w.update(.001, [p], 'day')); assert.equal(live.c.hp, hp);
});

test('a newer start survives an older first release while duplicate results are rejected', () => {
  const m = { type: 'tani' };
  assert.ok(acceptMonsterStrike(m, { generation: 1, attackId: 2, remaining: impact }));
  assert.ok(releaseMonsterStrike(m, 1, 1)); assert.equal(m.strike.attackId, 2);
  assert.equal(releaseMonsterStrike(m, 1, 1), false);
});

test('repeated reconnect snapshot seeks the same pending strike without losing its reservation', () => {
  const { net, m, info } = online();
  const strike = { generation: 1, attackId: 1, remaining: .3 };
  net.emit('mlist', { m: [{ ...info, strike }] });
  net.emit('mlist', { m: [{ ...info, strike: { ...strike, remaining: .1 } }] });
  assert.equal(m.strike.remaining, .1);
});

test('server damage applies at release and later swings retain the original cooldown cadence', () => {
  const { w, p, m } = server(), cs = new Combatants({ now: () => 0, random: () => .5 });
  const c = Character.create('PressQA', 'warrior'); cs.load(1, c.toJSON(), { account: 'qa', slot: 0 });
  const hp = cs.get(1).c.hp;
  w.update(.01, [p], 'day'); const cooldown = m.attackTimer;
  const release = w.update(impact, [p], 'day').find(e => e.t === 'ma');
  assert.ok(release); const result = cs.swing(1, m.def, release.power); assert.ok(result);
  assert.ok(cs.get(1).c.hp < hp);
  const next = w.update(cooldown - impact + .000001, [p], 'day');
  assert.equal(next.filter(e => e.t === 'mstrike' && e.stage === 'windup').length, 1);
  assert.ok(!next.some(e => e.t === 'ma'));
  const coarse = w.update(20, [p], 'day'); assert.equal(coarse.filter(e => e.t === 'ma').length, 1);
});

test('pure helper reserves once and rejects invalid identity/time packets', () => {
  const m = { type: 'tani' }, first = beginMonsterStrike(m);
  assert.equal(beginMonsterStrike(m), first); assert.equal(m.strikeSequence, 1);
  for (const packet of [{ generation: 1, attackId: 0, remaining: 1 }, { generation: 1, attackId: 2, remaining: NaN }, { generation: -1, attackId: 2, remaining: 1 }]) {
    assert.equal(acceptMonsterStrike(m, packet), false);
  }
});

test('future-generation cancel rejects reordered spawn windup and does not cancel a later serial', () => {
  const { net, m, info, combat } = online(); let cues = 0; combat.on('monster-attack', () => cues++);
  net.emit('mstrike', { id: 7, stage: 'cancel', generation: 2, attackId: 1 });
  net.emit('mspawn', { m: { ...info, generation: 2 } });
  net.emit('mstrike', { id: 7, stage: 'windup', generation: 2, attackId: 1, remaining: impact });
  assert.equal(cues, 0);
  net.emit('mstrike', { id: 7, stage: 'windup', generation: 2, attackId: 2, remaining: impact });
  net.emit('mstrike', { id: 7, stage: 'cancel', generation: 2, attackId: 1 });
  assert.equal(m.strike.attackId, 2); assert.equal(cues, 1);
});

test('Phong hungry grasp uses the approved half-second marker and releases offline HP exactly once', () => {
  assert.equal(monsterAttackImpact('phong'), .5);
  const { c, p, combat, m } = offline('phong'); const hp = c.hp; let hits = 0, starts = 0;
  combat.on('player-hit', () => hits++); combat.on('monster-attack', () => starts++);
  combat.monsterAttack(m); const cooldown = m.attackTimer;
  assert.equal(m.strike.remaining, .5); assert.equal(c.hp, hp);
  combat.updateMonster(m, .499, p); assert.equal(c.hp, hp); assert.equal(hits, 0);
  combat.updateMonster(m, .001, p); assert.ok(c.hp < hp); assert.equal(hits, 1); assert.equal(starts, 1);
  assert.ok(Math.abs(m.attackTimer - (cooldown - .5)) < 1e-8);
  combat.updateMonster(m, .001, p); assert.equal(hits, 1);
});

test('Phong server reserves its shared strike and releases one ma at half a second', () => {
  const { w, m, p } = server('phong');
  const start = w.update(.01, [p], 'day'), cue = start.find(e => e.t === 'mstrike');
  assert.equal(cue.remaining, .5); assert.ok(!start.some(e => e.t === 'ma'));
  const cooldown = m.attackTimer;
  assert.ok(!w.update(.499, [p], 'day').some(e => e.t === 'ma'));
  const hits = w.update(.001, [p], 'day').filter(e => e.t === 'ma');
  assert.equal(hits.length, 1); assert.equal(hits[0].attackId, cue.attackId); assert.equal(hits[0].generation, cue.generation);
  assert.ok(Math.abs(m.attackTimer - (cooldown - .5)) < 1e-8);
  assert.ok(!w.update(.001, [p], 'day').some(e => e.t === 'ma'));
});

for (const reason of ['walkout', 'death', 'stun', 'map leave']) {
  test(`Phong shared lifecycle cancels offline and server ${reason} before grasp contact`, () => {
    const local = offline('phong'), remote = server('phong');
    const hp = local.c.hp; let cancelled = 0;
    local.combat.on('monster-attack-cancel', () => cancelled++);
    local.combat.monsterAttack(local.m); remote.w.update(.01, [remote.p], 'day');
    let players = [remote.p];
    if (reason === 'walkout') { local.p.x = 10; remote.p.x = 10; }
    if (reason === 'death') { local.c.hp = 0; remote.p.dead = true; }
    if (reason === 'stun') {
      local.m.debuffs.push({ stun: true, remaining: 10 }); remote.m.debuffs.push({ stun: true, remaining: 10 });
    }
    if (reason === 'map leave') { local.combat.cancelMonsterAttacks(); players = []; }
    local.combat.updateMonster(local.m, .5, local.p);
    const events = remote.w.update(.5, players, 'day');
    assert.equal(local.c.hp, reason === 'death' ? 0 : hp); assert.equal(cancelled, 1);
    assert.equal(local.m.strike, null); assert.equal(remote.m.strike, null);
    assert.ok(!events.some(e => e.t === 'ma'));
    assert.ok(events.some(e => e.t === 'mstrike' && e.stage === 'cancel'));
  });
}
