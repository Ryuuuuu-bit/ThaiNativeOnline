import test from 'node:test';
import assert from 'node:assert/strict';
import { Character } from '../src/character/Character.js';
import { Combat, Monster } from '../src/combat/Combat.js';
import { SKILLS } from '../src/combat/data/skills.js';
import { MONSTERS } from '../src/combat/data/monsters.js';
import { Combatants } from '../server/combatants.js';
import { MonsterWorld } from '../server/monsters.js';
import { KitCaster } from '../src/training/KitCaster.js';
import { hitEffects, rollBlow, monsterDefense } from '../src/training/kitCombat.js';
import { CARD_ITEMS } from '../src/character/data/cards.js';
import { Emitter } from '../src/character/Emitter.js';
import { attachNetCombat } from '../src/net/NetCombat.js';
import { attachNetProgress } from '../src/net/NetProgress.js';
import { KIT_SKILL_IDS } from '../src/character/data/kits.js';
import { fullKit } from '../src/character/data/skilltree.js';

function wearer(types, classId = 'warrior') {
  const c = Character.create('ทดสอบ', classId); c.level = 100;
  c.equipment.armor = 'bamboo_grave_armor'; c.equipment.charm = c.equipment.charm2 = 'bia_kae';
  for (const slot of Object.keys(c.cards)) c.cards[slot] = [];
  for (const type of types) {
    const card = CARD_ITEMS[`card_${type}`];
    c.cards[card.slot === 'charm' && c.cards.charm.length ? 'charm2' : card.slot].push(`card_${type}`);
  }
  c.hp = c.maxHp; c.mp = c.maxMp; return c;
}

const zone = type => ({ type, x: 0, z: 0, radius: 0, count: 1, active: ['day'] });
function pair(types, cls = 'warrior', type = 'boar') {
  const c = wearer(types, cls), p = { id: 1, x: 0, z: 0, lv: 100 };
  const combat = new Combat(c, { playerPos: () => p, canStand: () => true });
  const m = new Monster(type, zone(type), .5, 0); m.hp = m.maxHp = 1e6; combat.monsters.push(m);
  let time = 0;
  const cs = new Combatants({ now: () => time, random: () => .9 });
  assert.equal(cs.load(1, c.toJSON(), { account: 'owner', slot: 0 }), true);
  const sc = cs.get(1).c;
  const world = new MonsterWorld('test', { zones: [zone(type)], random: () => .9 });
  world.update(.1, [], 'day');
  const sm = world.monsters[0]; sm.hp = sm.maxHp = 1e6;
  return { c, sc, combat, m, cs, world, sm, p, setTime: t => { time = t; } };
}

function guest(types, cls = 'warrior') {
  const o = pair(types, cls); o.cs.drop(1);
  assert.ok(o.cs.set(1, o.c.toJSON(), cls)); o.sc = o.cs.get(1).c;
  const net = new Emitter(), sent = []; net.online = true; net.send = msg => sent.push(msg);
  const remote = attachNetCombat(net, { game: { character: o.c, combat: o.combat }, clock: { paused: true } });
  net.emit('welcome', { you: 1 }); net.emit('mlist', { m: [o.world.info(o.sm)] });
  return { ...o, net, sent, remote, local: remote.monster(o.sm.id) };
}

test('offline basics, real kit strike and server land share capped outgoing damage after race bonuses', t => {
  t.mock.method(Math, 'random', () => .9);
  const o = pair(['bamboo_grave_3', 'demon_rift_3'], 'shaman', 'winyan');
  o.c.cards.weapon = o.sc.cards.weapon = ['card_pray'];
  const expected = Math.round(100 * 1.1 * 1.3);
  let amount; o.combat.on('hit', e => { amount = e.amount; });
  o.combat.damageMonster(o.m, 100); assert.equal(amount, expected);
  const ev = o.cs.land(o.world, [o.p], o.sm, 1, { hit: true, dmg: 100 }, false);
  assert.equal(ev[0].amount, expected);
  const caster = Object.create(KitCaster.prototype);
  Object.assign(caster, { combat: o.combat, affected: new Set(), eid: id => id });
  caster.strike(o.m, { hit: true, crit: false, dmg: 100 }, 'mage_akom');
  assert.equal(amount, expected, 'the actual kit callback receives the multiplier exactly once');
  const r = o.combat.rollPlayerDamage(SKILLS.bolt, o.m);
  o.combat.hitMonster(o.m, SKILLS.bolt);
  assert.equal(amount, Math.round(r.dmg * 1.1 * 1.3));
  const server = o.cs.blow(1, o.world, [o.p], { id: o.sm.id, skill: 'basic' });
  assert.equal(server.find(e => e.t === 'mh').amount, amount);
});

test('real hunter pet attacks share outgoing cards and never trigger Pop healing', t => {
  t.mock.method(Math, 'random', () => .9); t.mock.method(Date, 'now', () => 0);
  const o = pair(['pop', 'demon_rift_3'], 'hunter');
  o.c.hp = o.c.maxHp / 2; o.sc.hp = o.sc.maxHp / 2;
  const hp = o.c.hp, serverHp = o.sc.hp;
  Object.assign(o.combat.pet, { placed: true, x: o.m.x, z: o.m.z, attackTimer: 0 });
  o.combat.target = o.m; o.combat.combatTimer = 10;
  let bite; o.combat.on('pet-bite', e => { bite = e.amount; });
  o.combat.updatePet(0, o.p);
  const ev = o.cs.blow(1, o.world, [o.p], { id: o.sm.id, skill: 'pet' });
  assert.equal(ev.find(e => e.t === 'mh').amount, bite);
  assert.equal(o.c.hp, hp); assert.equal(o.sc.hp, serverHp);
});

test('all nine outgoing abilities affect actual offline and server hits only against their intended targets', () => {
  const cases = [
    ['buffalo', 'boar', 'winyan', 1.12],
    ['takian', 'pop', 'boar', 1.12],
    ['bamboo_grave_3', 'winyan', 'boar', 1.18],
    ['sunken_city_3', 'wraith', 'boar', 1.18],
    ['giant_valley_3', 'pop', 'buffalo', 1.18],
    ['himmapan_3', 'krahang', 'boar', 1.18],
    ['fallen_city_3', 'winyan', 'boar', 1.18],
    ['dusk_fort_3', 'boar', 'boar', 1.15],
    ['demon_rift_3', 'boar', 'boar', 1.25],
  ];
  for (const [card, yes, no, mul] of cases) {
    // Two actual sockets prove duplicate abilities cannot double the bonus.
    const o = pair([card, card], 'warrior', yes);
    if (card === 'dusk_fort_3') o.c.hp = o.sc.hp = o.c.maxHp * .5;
    let amount; o.combat.on('hit', e => { amount = e.amount; });
    const strike = expected => {
      o.combat.damageMonster(o.m, 100);
      assert.equal(amount, expected, `${card}: offline`);
      const ev = o.cs.land(o.world, [o.p], o.sm, 1, { hit: true, dmg: 100 }, false);
      assert.equal(ev.find(e => e.t === 'mh').amount, expected, `${card}: server`);
    };
    strike(Math.round(100 * mul));
    o.m.def = o.sm.def = MONSTERS[no];
    if (card === 'dusk_fort_3') o.c.hp = o.sc.hp = o.c.maxHp * .5 + .001;
    strike(card === 'demon_rift_3' ? 125 : 100);
    const slots = CARD_ITEMS[`card_${card}`].slot === 'armor' ? ['armor'] : ['charm', 'charm2'];
    for (const slot of slots) { assert.ok(o.c.unequip(slot)); assert.ok(o.sc.unequip(slot)); }
    strike(100);
  }
});

test('Pop emits offline heal feedback and updates signed vitals once, bounding lethal overkill to removed HP', t => {
  t.mock.method(Date, 'now', () => 0);
  const o = pair(['pop']); o.c.hp = o.c.maxHp / 2; o.sc.hp = o.sc.maxHp / 2;
  o.m.hp = o.sm.hp = 63;
  const hp = o.c.hp, shp = o.sc.hp, feedback = [];
  o.combat.on('heal', e => feedback.push(e.amount));
  o.cs.get(1).dirty = false;
  o.combat.damageMonster(o.m, 100000);
  o.cs.land(o.world, [o.p], o.sm, 1, { hit: true, dmg: 100000 }, false);
  assert.equal(o.c.hp, hp + 2); assert.equal(o.sc.hp, shp + 2);
  assert.deepEqual(feedback, [2]); assert.equal(o.cs.get(1).dirty, true);
  assert.equal(o.cs.effects(1).hp, Math.round(o.sc.hp)); assert.equal(o.cs.me(1).hp, o.sc.hp);
  assert.equal(o.combat.bossCardProcs.hitReadyAt, 2);
  o.combat.damageMonster(o.m, 100000); assert.deepEqual(feedback, [2], 'already-dead target is inert');
});

test('existing me and skill-state messages reconcile signed Pop/Pusom vitals without local or repeated procs', t => {
  t.mock.method(globalThis, 'setTimeout', () => 0);
  const o = pair(['pop', 'pusom']); o.sc.hp = o.sc.maxHp / 2; o.sc.mp = 0; o.sm.hp = 63;
  const net = new Emitter(); net.online = true; net.send = () => {};
  attachNetCombat(net, { game: { character: o.c, combat: o.combat }, clock: { paused: true } });
  attachNetProgress(net, o.c);
  net.emit('sync', { c: o.cs.me(1) });
  net.emit('mlist', { m: [o.world.info(o.sm)] });
  assert.equal(o.combat.serverOwned, true); assert.equal(o.combat.remote, true);
  const hp = o.c.hp;
  const events = o.cs.land(o.world, [o.p], o.sm, 1, { hit: true, dmg: 100000 }, false);
  for (const e of events) {
    if (e.t === 'kill') o.cs.reward(e.to, e);
    net.emit(e.t, e);
  }
  assert.equal(o.sc.hp, hp + 2); assert.equal(o.sc.mp, Math.floor(o.sc.maxMp * .02));
  assert.equal(o.c.hp, hp, 'signed confirmed-hit feedback does not predict lifesteal');
  assert.equal(o.c.mp, 0, 'signed kill feedback does not predict SP');
  const state = o.cs.effects(1), snapshot = { hp: state.hp, mp: state.mp, ack: 0, state };
  net.emit('me', snapshot);
  assert.equal(o.c.hp, state.hp); assert.equal(o.c.mp, state.mp);
  net.emit('me', snapshot); net.emit('skill-state', { state });
  assert.equal(o.c.hp, state.hp); assert.equal(o.c.mp, state.mp, 'repeated snapshots adopt vitals instead of granting SP again');
  assert.equal(o.combat.bossCardProcs.hitReadyAt, -Infinity);
  assert.equal(o.combat.bossCardProcs.killReadyAt, -Infinity);
});

test('miss, DoT, absent sockets, signed client prediction and dead wearer cannot heal', t => {
  t.mock.method(Date, 'now', () => 0);
  const o = pair(['pop']); o.c.hp = o.c.maxHp / 2;
  const hp = o.c.hp;
  o.combat.damageMonster(o.m, 100, { miss: true }); assert.equal(o.c.hp, hp);
  o.combat.damageMonster(o.m, 100, { dot: true }); assert.equal(o.c.hp, hp);
  o.c.cards.armor = []; o.combat.damageMonster(o.m, 100); assert.equal(o.c.hp, hp);
  o.c.cards.armor = ['card_pop']; o.combat.serverOwned = true;
  o.combat.damageMonster(o.m, 100); assert.equal(o.c.hp, hp);
  o.combat.serverOwned = false; o.c.hp = 0;
  o.combat.damageMonster(o.m, 100); assert.equal(o.c.hp, 0);
});

test('lifesteal cooldown survives real unequip/re-equip and another Combat on the same Character', t => {
  let time = 0; t.mock.method(Date, 'now', () => time * 1000);
  const o = pair(['pop']); o.c.hp = o.c.maxHp / 2;
  const hp = o.c.hp;
  o.combat.damageMonster(o.m, 100); assert.equal(o.c.hp, hp + 3);
  o.c.unequip('armor');
  const index = o.c.inventory.findIndex(s => s?.id === 'bamboo_grave_armor'); assert.ok(o.c.equip(index));
  const other = new Combat(o.c, o.combat.world); other.monsters.push(o.m);
  assert.equal(other.bossCardProcs, o.combat.bossCardProcs);
  time = 1; other.damageMonster(o.m, 100); assert.equal(o.c.hp, hp + 3);
  time = 2; other.damageMonster(o.m, 100); assert.equal(o.c.hp, hp + 6);
});

test('signed Pop cooldown survives server gear operations and rejects misses and unequipped hits', () => {
  const o = pair(['pop']); o.sc.hp = o.sc.maxHp / 2;
  const hp = o.sc.hp, state = o.cs.get(1).bossCardProcs;
  const land = hit => o.cs.land(o.world, [o.p], o.sm, 1, { hit, dmg: 100 }, false);
  land(false); assert.equal(o.sc.hp, hp); assert.equal(state.hitReadyAt, -Infinity);
  land(true); assert.equal(o.sc.hp, hp + 3);
  assert.ok(o.cs.op(1, { op: 'unequip', slot: 'armor' }));
  o.setTime(3); land(true); assert.equal(o.sc.hp, hp + 3, 'unused sockets cannot heal');
  assert.ok(o.cs.op(1, { op: 'equip', id: 'bamboo_grave_armor', cards: ['card_pop'] }));
  assert.equal(o.cs.get(1).bossCardProcs, state, 'gear operation never replaces cooldown state');
  land(true); assert.equal(o.sc.hp, hp + 6);
  assert.ok(o.cs.op(1, { op: 'unequip', slot: 'armor' }));
  assert.ok(o.cs.op(1, { op: 'equip', id: 'bamboo_grave_armor', cards: ['card_pop'] }));
  o.setTime(4); land(true); assert.equal(o.sc.hp, hp + 6, 'swapping gear cannot evade a running cooldown');
  o.setTime(5); land(true); assert.equal(o.sc.hp, hp + 9);
});

test('legacy and kit DoTs inherit one captured outgoing boost even when Pop crosses an HP threshold', t => {
  t.mock.method(Math, 'random', () => .9); t.mock.method(Date, 'now', () => 0);
  const o = pair(['pop', 'dusk_fort_3'], 'assassin');
  o.c.hp = o.c.maxHp * .5; o.sc.hp = o.sc.maxHp * .5;
  const cast = { struck: new Map(), perTarget: 2, hit: new Set(), kit: false, skill: 'venom' };
  const roll = o.combat.rollPlayerDamage(SKILLS.venom, o.m);
  o.combat.hitMonster(o.m, SKILLS.venom);
  o.cs.strike(o.world, [o.p], o.sm, 1, { ...roll }, cast, false);
  const source = roll.dmg * 1.15;
  assert.equal(o.m.debuffs[0].source, source); assert.equal(o.sm.debuffs[0].source, source);
  assert.ok(o.c.hp > o.c.maxHp * .5 && o.sc.hp > o.sc.maxHp * .5, 'Pop moves both wearers across the outgoing threshold');
  const expected = Math.round(source * .4); let dot;
  o.combat.on('hit', e => { if (e.dot) dot = e.amount; });
  o.combat.updateMonster(o.m, 1, o.p);
  assert.equal(dot, expected);
  assert.equal(o.world.update(1, [o.p], 'day').find(e => e.dot).amount, expected);
  const k = pair(['demon_rift_3'], 'hunter');
  k.combat.damageMonster(k.m, 100);
  for (const d of hitEffects('arch_poison', 100)) k.combat.debuff(k.m, d);
  const kitCast = { struck: new Map(), perTarget: 1, hit: new Set(), kit: true, eff: 'arch_poison' };
  k.cs.strike(k.world, [k.p], k.sm, 1, { hit: true, dmg: 100 }, kitCast, false);
  assert.equal(k.m.debuffs.find(d => d.dot).source, 125);
  assert.equal(k.sm.debuffs.find(d => d.dot).source, 125);
});

test('normal and telegraph incoming damage use HP before the hit; guests apply cards once and signed results are final', t => {
  t.mock.method(Math, 'random', () => .9);
  for (const types of [['chalawan'], ['sealed_mine_3'], ['demon_rift_3'], ['chalawan', 'demon_rift_3']]) {
    const o = pair(types); const share = types.includes('sealed_mine_3') ? .8 : .4;
    o.c.hp = o.c.maxHp * share; o.sc.hp = o.sc.maxHp * share;
    const def = { ...MONSTERS.boar, atk: 200, acc: 999 }, power = 1.5;
    o.m.def = def;
    let amount; o.combat.on('player-hit', e => { amount = e.amount; });
    const mul = types.includes('sealed_mine_3') ? .9 : types.includes('chalawan') ? .85 * (types.includes('demon_rift_3') ? 1.1 : 1) : 1.1;
    const expected = Math.round(Math.max(1, (200 * power * 1.12 - o.c.defense * .4) * (1 - o.c.resist(def)) * mul));
    o.combat.remote = true;
    o.combat.monsterAttack(o.m, null, { power, skill: 'boss-test' });
    const result = o.cs.swing(1, def, power, { skill: true });
    assert.equal(amount, expected); assert.equal(result.dmg, expected);
    o.c.hp = o.c.maxHp * share; o.combat.serverOwned = true;
    o.combat.monsterAttack(o.m, result, { power, skill: 'boss-test' });
    assert.equal(o.c.hp, result.hp); assert.equal(amount, result.dmg, 'server result is not reduced or amplified again');
  }
});

test('Pusom server proc accepts only the actual loot owner receipt, once, including DoT kills', () => {
  const o = pair(['pusom']);
  const second = wearer(['pusom']); assert.ok(o.cs.load(2, second.toJSON(), { account: 'other', slot: 0 }));
  const c2 = o.cs.get(2).c; o.sc.mp = c2.mp = 0;
  const players = [o.p, { id: 2, x: 0, z: 0, lv: 100 }]; o.sm.hp = 200;
  o.cs.land(o.world, players, o.sm, 2, { hit: true, dmg: 160 }, false);
  const kills = o.cs.land(o.world, players, o.sm, 1, { hit: true, dmg: 100 }, false).filter(e => e.t === 'kill');
  const owner = kills.find(e => e.to === 2), helper = kills.find(e => e.to === 1);
  assert.ok(owner && helper);
  assert.equal(owner.killSeq, 1); assert.ok(!Object.hasOwn(helper, 'killSeq'), 'helper shares never receive owner receipts');
  o.cs.reward(2, { ...owner }); assert.equal(c2.mp, 0, 'cloned receipt is not authenticated');
  o.cs.reward(1, owner); o.cs.reward(1, helper); assert.equal(o.sc.mp, 0, 'helper and mismatched owner cannot proc');
  o.cs.reward(2, owner); const mp = Math.floor(c2.maxMp * .02); assert.equal(c2.mp, mp);
  o.setTime(6); o.cs.reward(2, owner); assert.equal(c2.mp, mp, 'replay after cooldown still cannot proc');
  o.sm.hp = 2; o.sm.state = 'chase'; o.sm.contrib = new Map();
  o.world.debuff(o.sm, { id: 'poison', dot: 1, source: 10, remaining: 3, by: 2 });
  const dotKills = o.world.update(1, players, 'day').filter(e => e.t === 'kill');
  const dotOwner = dotKills.find(e => e.to === 2); assert.ok(dotOwner);
  assert.equal(dotOwner.killSeq, 2);
  o.cs.reward(2, dotOwner); assert.equal(c2.mp, mp * 2, 'actual later DoT kill has a fresh receipt');
  const phantom = o.world.damage(o.sm, 2, 10, {}, players, false).find(e => e.t === 'kill');
  assert.ok(!Object.hasOwn(phantom, 'killSeq'), 'already-dead damage cannot mint a receipt');
  o.setTime(12); o.cs.reward(2, phantom); assert.equal(c2.mp, mp * 2, 'already-dead damage never makes a qualifying receipt');
});

test('offline kill recovery requires a real death and live wearer; repeat and phantom kills do not proc', t => {
  let time = 0; t.mock.method(Date, 'now', () => time * 1000); t.mock.method(Math, 'random', () => .9);
  const o = pair(['pusom']); o.c.mp = 0;
  o.combat.kill(o.m); assert.equal(o.c.mp, 0, 'calling kill on a live mob grants no ability');
  o.m.hp = 20; o.m.state = 'idle'; o.combat.damageMonster(o.m, 100);
  const amount = Math.floor(o.c.maxMp * .02); assert.equal(o.c.mp, amount);
  time = 6; o.combat.kill(o.m); assert.equal(o.c.mp, amount);
  o.m.hp = 1; o.m.state = 'idle'; o.c.hp = 0;
  o.combat.damageMonster(o.m, 10); assert.equal(o.c.mp, amount); assert.equal(o.c.hp, 0);
});

test('zero-reward deaths cannot grant Pusom SP offline or on the signed server', t => {
  t.mock.method(Math, 'random', () => .9);
  const o = pair(['pusom']); o.c.mp = o.sc.mp = 0; o.m.hp = o.sm.hp = 20;
  o.m.def = o.sm.def = { ...MONSTERS.boar, exp: 0, gold: [0, 0], loot: 'none' };
  o.combat.damageMonster(o.m, 100);
  for (const e of o.cs.land(o.world, [o.p], o.sm, 1, { hit: true, dmg: 100 }, false)) if (e.t === 'kill') o.cs.reward(e.to, e);
  assert.equal(o.c.mp, 0); assert.equal(o.sc.mp, 0);
});

test('PvP retains its existing basic damage and receives no boss ability or lifesteal', () => {
  const o = pair(['pop', 'demon_rift_3']); o.sc.hp = o.sc.maxHp / 2;
  const target = Character.create('Target', 'warrior'); target.level = 100; target.hp = target.maxHp;
  assert.ok(o.cs.load(2, target.toJSON(), { account: 'target', slot: 0 }));
  const hp = o.sc.hp;
  const first = o.cs.pvpBasic(1, 2); assert.ok(first);
  o.sc.cards.charm = [];
  const second = o.cs.pvpBasic(1, 2); assert.ok(second);
  assert.equal(first.amount, second.amount, 'rift conditional outgoing boost is PvE-only');
  assert.equal(o.sc.hp, hp); assert.equal(o.cs.get(1).bossCardProcs.hitReadyAt, -Infinity);
});

test('guest confirmed server hits heal exact removed HP despite stale mt snapshots; kill SP is once per life', t => {
  let time = 0; t.mock.method(Date, 'now', () => time * 1000); t.mock.method(globalThis, 'setTimeout', () => 0);
  const o = guest(['pop', 'pusom']); o.c.hp = o.c.maxHp / 2; o.c.mp = 0;
  o.sm.hp = 63; const hp = o.c.hp, serverHp = o.sc.hp, serverMp = o.sc.mp, feedback = [];
  o.combat.on('heal', e => feedback.push(e.amount));
  const events = o.cs.land(o.world, [o.p], o.sm, 1, { hit: true, dmg: 100000 }, false);
  const hit = events.find(e => e.t === 'mh'), kill = events.find(e => e.t === 'kill');
  assert.equal(hit.amount, 100000); assert.equal(hit.removed, 63);
  assert.equal(hit.hitSeq, 1);
  assert.equal(kill.killSeq, 1);
  o.net.emit('mt', { m: [[o.sm.id, 0, 0, 0, 0, 4, 0]] });
  for (const e of events) o.net.emit(e.t, e);
  assert.equal(o.c.hp, hp + 2); assert.deepEqual(feedback, [2]);
  const mp = Math.floor(o.c.maxMp * .02); assert.equal(o.c.mp, mp);
  assert.equal(o.sc.hp, serverHp); assert.equal(o.sc.mp, serverMp, 'guest vitals stay browser-owned');
  time = 6; o.net.emit('kill', { ...kill }); assert.equal(o.c.mp, mp, 'duplicate receipt cannot proc after cooldown');
  for (const event of ['mspawn', 'mlist']) {
    o.sm.hp = 20; o.sm.state = 'idle';
    const info = o.world.info(o.sm);
    o.net.emit(event, event === 'mspawn' ? { m: info } : { m: [info] });
    assert.equal(o.remote.monster(o.sm.id), o.local, 'same server ID reuses the actual monster');
    time += 6;
    for (const e of o.cs.land(o.world, [o.p], o.sm, 1, { hit: true, dmg: 100 }, false)) o.net.emit(e.t, e);
  }
  assert.equal(o.c.mp, mp * 3, 'both actual respawn signals admit a fresh receipt');
  o.net.emit('status', false); o.net.emit('mgone', { id: o.sm.id, killed: true });
  o.net.emit('kill', kill); assert.equal(o.c.mp, mp * 3, 'disconnected receipts are inert');
  o.net.online = true; o.net.emit('welcome', { you: 1 });
  o.sm.hp = 20; o.sm.state = 'idle'; o.net.emit('mlist', { m: [o.world.info(o.sm)] });
  time += 6;
  for (const e of o.cs.land(o.world, [o.p], o.sm, 1, { hit: true, dmg: 100 }, false)) o.net.emit(e.t, e);
  assert.equal(o.c.mp, mp * 4, 'welcome resets life receipts while preserving character cooldowns');
});

test('guest Pop rejects other players, pets, DoT, misses and invalid removed fields; cooldown survives swapping', t => {
  let time = 0; t.mock.method(Date, 'now', () => time * 1000); t.mock.method(globalThis, 'setTimeout', () => 0);
  const o = guest(['pop', 'pop']); o.c.hp = o.c.maxHp / 2; const hp = o.c.hp;
  let hitSeq = 0;
  const receipt = extra => ({ id: o.sm.id, by: 1, amount: 100, removed: 100, hitSeq: ++hitSeq, ...extra });
  for (const extra of [
    { by: 2 }, { pet: true }, { dot: true }, { miss: true }, { removed: 0 },
    { removed: -1 }, { removed: NaN }, { removed: Infinity }, { removed: undefined }, { removed: o.local.maxHp + 1 },
  ]) { time += 3; o.net.emit('mh', receipt(extra)); assert.equal(o.c.hp, hp); }
  const event = receipt();
  o.net.emit('mh', event); assert.equal(o.c.hp, hp + 3, 'duplicate sockets grant one proc');
  assert.ok(o.c.unequip('armor'));
  const index = o.c.inventory.findIndex(s => s?.id === 'bamboo_grave_armor'); assert.ok(o.c.equip(index));
  time += 1; o.net.emit('mh', event); assert.equal(o.c.hp, hp + 3);
  time += 1; o.net.emit('mh', { ...event }); assert.equal(o.c.hp, hp + 3, 'replay stays inert after cooldown');
  o.net.emit('mh', receipt()); assert.equal(o.c.hp, hp + 6, 'same damage with a new receipt heals');
  time += 3; o.c.hp = 0; o.net.emit('mh', receipt()); assert.equal(o.c.hp, 0);
});

test('server hit receipts are per character session, monotonic across worlds and gear sheets, and never client-issued', () => {
  const o = guest(['pop']);
  const land = (world = o.world, m = o.sm, id = 1, hit = true) =>
    o.cs.land(world, [o.p, { ...o.p, id: 2 }], m, id, { hit, dmg: 100 }, false).find(e => e.t === 'mh');
  const first = land(); assert.equal(first.hitSeq, 1);
  assert.ok(o.cs.set(1, o.c.toJSON(), o.c.classId));
  assert.equal(land().hitSeq, 2, 'a guest gear sheet retains its session sequence');
  const otherWorld = new MonsterWorld('other', { zones: [zone('boar')], random: () => .9 }); otherWorld.update(.1, [], 'day');
  const otherMonster = otherWorld.monsters[0]; otherMonster.hp = otherMonster.maxHp = 1e6;
  assert.equal(land(otherWorld, otherMonster).hitSeq, 3, 'world changes retain the character sequence');
  assert.equal(land(otherWorld, otherMonster, 1, false).hitSeq, 4, 'miss receipts also get consumed once');
  const packet = { id: o.sm.id, skill: 'basic', hitSeq: 999999 };
  assert.equal(o.cs.blow(1, o.world, [o.p], packet).find(e => e.t === 'mh').hitSeq, 5);
  assert.ok(o.cs.load(2, o.c.toJSON(), { account: 'signed', slot: 0 }));
  assert.equal(land(o.world, o.sm, 2).hitSeq, 1, 'another signed character has its own harmless sequence');
  assert.equal(land().hitSeq, 6);
  assert.ok(!Object.hasOwn(o.cs.me(2), 'hitSeq'), 'receipt counter is transient');
  o.cs.drop(1); assert.ok(o.cs.set(1, o.c.toJSON(), o.c.classId));
  assert.equal(land().hitSeq, 1, 'a new server character session starts a fresh sequence');
});

test('guest own-hit receipt replays are inert after cooldown; equal genuine hits with new sequences still heal', t => {
  let time = 0; t.mock.method(Date, 'now', () => time * 1000); t.mock.method(globalThis, 'setTimeout', () => 0);
  const o = guest(['pop']); o.c.hp = o.c.maxHp / 2; const hp = o.c.hp;
  const hit = () => o.cs.land(o.world, [o.p], o.sm, 1, { hit: true, dmg: 100 }, false).find(e => e.t === 'mh');
  const first = hit();
  for (const hitSeq of [undefined, 0, -1, .5, '1', NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])
    o.net.emit('mh', { ...first, hitSeq });
  o.net.emit('mh', { ...first, by: 2, hitSeq: 999999 });
  assert.equal(o.c.hp, hp, 'invalid receipts and another player cannot heal or consume own sequence');
  o.net.emit('mh', first); assert.equal(o.c.hp, hp + 3);
  const monsterHp = o.local.hp;
  time = 3; o.net.emit('mh', { ...first });
  assert.equal(o.c.hp, hp + 3); assert.equal(o.local.hp, monsterHp, 'replay has no second hit or healing');
  const second = hit(); assert.equal(second.amount, first.amount); assert.equal(second.removed, first.removed);
  assert.ok(second.hitSeq > first.hitSeq);
  o.net.emit('mh', second); assert.equal(o.c.hp, hp + 6);
  time = 6; o.net.emit('mh', { ...first }); o.net.emit('mh', { ...second }); assert.equal(o.c.hp, hp + 6);
});

test('guest hit receipts are consumed before full/dead/no-card/cooldown and hit eligibility checks', t => {
  let time = 0; t.mock.method(Date, 'now', () => time * 1000); t.mock.method(globalThis, 'setTimeout', () => 0);
  for (const blocked of ['full', 'dead', 'no-card', 'cooldown', 'miss', 'pet', 'dot', 'removed', 'unknown-monster']) {
    time = 0;
    const o = guest(['pop']); o.c.hp = o.c.maxHp / 2;
    const cards = [...o.c.cards.armor];
    const hit = () => o.cs.land(o.world, [o.p], o.sm, 1, { hit: true, dmg: 100 }, false).find(e => e.t === 'mh');
    if (blocked === 'cooldown') { o.net.emit('mh', hit()); time = 1; }
    const event = hit();
    if (blocked === 'full') o.c.hp = o.c.maxHp;
    if (blocked === 'dead') o.c.hp = 0;
    if (blocked === 'no-card') o.c.cards.armor = [];
    const originalHp = o.c.hp;
    const message = { ...event, ...(blocked === 'miss' ? { miss: true } : {}), ...(blocked === 'pet' ? { pet: true } : {}),
      ...(blocked === 'dot' ? { dot: true } : {}), ...(blocked === 'removed' ? { removed: Infinity } : {}),
      ...(blocked === 'unknown-monster' ? { id: 9999 } : {}) };
    o.net.emit('mh', message); assert.equal(o.c.hp, originalHp, blocked);
    o.c.cards.armor = cards; o.c.hp = o.c.maxHp / 2; const hp = o.c.hp;
    time += 3;
    o.net.emit('mh', { ...event }); assert.equal(o.c.hp, hp, `${blocked}: late eligibility cannot reuse the receipt`);
    o.net.emit('mh', hit()); assert.equal(o.c.hp, hp + 3, `${blocked}: the next genuine hit is eligible`);
  }
});

test('guest receipt history survives monster/world snapshots and resets for a new session on welcome', t => {
  let time = 0; t.mock.method(Date, 'now', () => time * 1000); t.mock.method(globalThis, 'setTimeout', () => 0);
  const o = guest(['pop']); o.c.hp = o.c.maxHp / 2; const hp = o.c.hp;
  const hit = () => o.cs.land(o.world, [o.p], o.sm, 1, { hit: true, dmg: 100 }, false).find(e => e.t === 'mh');
  const first = hit(); o.net.emit('mh', first); assert.equal(o.c.hp, hp + 3);
  time = 3;
  o.net.emit('mspawn', { m: o.world.info(o.sm) }); o.net.emit('mlist', { m: [o.world.info(o.sm)] });
  o.net.emit('mh', { ...first }); assert.equal(o.c.hp, hp + 3, 'monster life/list changes cannot reset hit receipts');
  const second = hit(); o.net.emit('mh', second); assert.equal(o.c.hp, hp + 6);
  time = 6; o.net.online = false; o.net.emit('status', false);
  o.net.emit('mh', hit()); assert.equal(o.c.hp, hp + 6, 'disconnected hits cannot heal');
  o.cs.drop(1); assert.ok(o.cs.set(1, o.c.toJSON(), o.c.classId));
  o.net.online = true; o.net.emit('welcome', { you: 1 }); o.net.emit('mlist', { m: [o.world.info(o.sm)] });
  const newSession = hit(); assert.equal(newSession.hitSeq, 1);
  o.net.emit('mh', newSession); assert.equal(o.c.hp, hp + 9, 'new session may start at sequence one');
  time = 9; o.net.emit('mh', { ...newSession }); assert.equal(o.c.hp, hp + 9);
});

test('same-player map/channel welcomes preserve hit receipts; a genuinely new player ID resets them', t => {
  let time = 0; t.mock.method(Date, 'now', () => time * 1000); t.mock.method(globalThis, 'setTimeout', () => 0);
  const o = guest(['pop']); o.c.hp = o.c.maxHp / 2; const hp = o.c.hp;
  const hit = id => o.cs.land(o.world, [{ ...o.p, id }], o.sm, id, { hit: true, dmg: 100 }, false).find(e => e.t === 'mh');
  const first = hit(1); o.net.emit('mh', first); assert.equal(o.c.hp, hp + 3);
  let previous = first;
  for (const ch of [1, 2, 1]) {
    time += 3;
    o.net.emit('welcome', { you: 1, ch }); o.net.emit('mlist', { m: [o.world.info(o.sm)] });
    const monster = o.remote.monster(o.sm.id), monsterHp = monster.hp;
    o.net.emit('mh', { ...first }); o.net.emit('mh', { ...previous });
    assert.equal(o.c.hp, hp + previous.hitSeq * 3, 'same-session welcome cannot admit earlier receipts after cooldown');
    assert.equal(monster.hp, monsterHp, 'replayed hit cannot change the refreshed monster');
    const fresh = hit(1); assert.equal(fresh.hitSeq, previous.hitSeq + 1);
    assert.equal(fresh.amount, first.amount); o.net.emit('mh', fresh);
    assert.equal(o.c.hp, hp + fresh.hitSeq * 3, 'a fresh equal-damage receipt still heals');
    previous = fresh;
  }
  time += 3; assert.ok(o.cs.set(2, o.c.toJSON(), o.c.classId));
  o.net.emit('welcome', { you: 2 }); o.net.emit('mlist', { m: [o.world.info(o.sm)] });
  o.net.emit('mh', { ...previous }); const before = o.c.hp;
  const newIdentity = hit(2); assert.equal(newIdentity.hitSeq, 1);
  o.net.emit('mh', newIdentity); assert.equal(o.c.hp, before + 3, 'new identity gets its own sequence namespace');
});

test('guest Pusom rejects live, helper, unknown and consumed deaths, and requires a live socket wearer', t => {
  let time = 0; t.mock.method(Date, 'now', () => time * 1000); t.mock.method(globalThis, 'setTimeout', () => 0);
  const o = guest(['pusom']); o.c.mp = 0;
  let killSeq = 0;
  const receipt = extra => ({ id: o.sm.id, type: o.sm.type, to: 1, exp: 0, gold: 1, drops: [], killSeq: ++killSeq, ...extra });
  const kill = receipt();
  o.net.emit('kill', kill); assert.equal(o.c.mp, 0, 'no actual death boundary');
  o.net.emit('mgone', { id: o.sm.id, killed: false }); o.net.emit('kill', kill); assert.equal(o.c.mp, 0, 'despawn is not a kill');
  const spawn = () => o.net.emit('mspawn', { m: { ...o.world.info(o.sm), hp: 100, st: 1 } });
  spawn(); o.net.emit('mgone', { id: o.sm.id, killed: true });
  const helper = receipt();
  o.net.emit('kill', { ...helper, to: 2 }); assert.equal(o.c.mp, 0);
  o.net.emit('kill', { ...helper, gold: 0 }); assert.equal(o.c.mp, 0, 'EXP-only helper has no proc');
  time = 6; o.net.emit('kill', helper); assert.equal(o.c.mp, 0, 'altering a consumed receipt cannot grant a proc');
  o.net.emit('kill', receipt({ id: 9999 })); assert.equal(o.c.mp, 0);
  spawn(); o.net.emit('mgone', { id: o.sm.id, killed: true });
  const unequipped = receipt();
  assert.ok(o.c.unequip('charm')); o.net.emit('kill', unequipped); assert.equal(o.c.mp, 0);
  const index = o.c.inventory.findIndex(s => s?.id === 'bia_kae' && s.cards?.includes('card_pusom')); assert.ok(o.c.equip(index));
  time = 12; o.net.emit('kill', unequipped); assert.equal(o.c.mp, 0, 'equipping after the receipt cannot grant a proc');
  spawn(); o.net.emit('mgone', { id: o.sm.id, killed: true }); o.c.hp = 0;
  o.net.emit('kill', receipt()); assert.equal(o.c.mp, 0); assert.equal(o.c.hp, 0);
  o.c.hp = o.c.maxHp; spawn(); o.net.emit('mgone', { id: o.sm.id, killed: true });
  o.net.emit('kill', receipt({ gold: 0, drops: [{ id: 'tooth', qty: 1 }] }));
  assert.equal(o.c.mp, Math.floor(o.c.maxMp * .02), 'an actual item-owner receipt qualifies without gold');
});

test('guest death/kill replay after same-player welcome cannot restore SP, while real same-ID respawns get fresh receipts', t => {
  let time = 0; t.mock.method(Date, 'now', () => time * 1000); t.mock.method(globalThis, 'setTimeout', () => 0);
  const o = guest(['pusom']); o.c.mp = 0; o.sm.hp = 20;
  const kill = () => o.cs.land(o.world, [o.p], o.sm, 1, { hit: true, dmg: 2e6 }, false);
  const events = kill(), owner = events.find(e => e.t === 'kill'), death = events.find(e => e.t === 'mgone' && e.killed);
  assert.equal(owner.killSeq, 1); assert.ok(death);
  for (const e of events) o.net.emit(e.t, e);
  const mp = Math.floor(o.c.maxMp * .02), gold = o.c.gold; assert.equal(o.c.mp, mp);
  time = 6;
  o.net.emit('welcome', { you: 1, ch: 2 }); o.net.emit('mlist', { m: [o.world.info(o.sm)] });
  o.net.emit('mgone', { ...death }); o.net.emit('kill', { ...owner });
  assert.equal(o.c.mp, mp, 'replaying both original death and owner receipt after cooldown is inert');
  assert.equal(o.c.gold, gold, 'consumed owner receipt also cannot replay its reward');
  const spawned = o.world.update(o.sm.respawn + .01, [], 'day').find(e => e.t === 'mspawn');
  assert.equal(spawned?.m.id, o.sm.id, 'the real MonsterWorld respawns the same server ID');
  o.net.emit('mspawn', spawned);
  o.net.emit('mgone', { ...death }); o.net.emit('kill', { ...owner }); assert.equal(o.c.mp, mp);
  const secondEvents = kill(), secondOwner = secondEvents.find(e => e.t === 'kill');
  assert.equal(secondOwner.killSeq, 2);
  for (const e of secondEvents) o.net.emit(e.t, e);
  assert.equal(o.c.mp, mp * 2, 'a genuine new death receipt can restore SP');
  time = 12;
  o.net.emit('welcome', { you: 1 }); o.net.emit('mlist', { m: [o.world.info(o.sm)] });
  for (const e of secondEvents) o.net.emit(e.t, { ...e });
  assert.equal(o.c.mp, mp * 2, 'welcome preserves both hit and kill high-water marks');
});

test('server kill sequence is independent of hits, crosses worlds and gear changes, and belongs only to real loot owners', t => {
  t.mock.method(globalThis, 'setTimeout', () => 0);
  const o = guest(['pusom']);
  for (let i = 0; i < 3; i++) o.cs.land(o.world, [o.p], o.sm, 1, { hit: true, dmg: 1 }, false);
  o.sm.hp = 20;
  const first = o.cs.land(o.world, [o.p], o.sm, 1, { hit: true, dmg: 100 }, false);
  assert.equal(first.find(e => e.t === 'mh').hitSeq, 4); assert.equal(first.find(e => e.t === 'kill').killSeq, 1);
  assert.ok(o.cs.set(1, o.c.toJSON(), o.c.classId));
  const world = new MonsterWorld('other', { zones: [zone('boar')], random: () => .9 }); world.update(2, [], 'day');
  const m = world.monsters[0]; m.hp = 20;
  assert.equal(o.cs.land(world, [o.p], m, 1, { hit: true, dmg: 100 }, false).find(e => e.t === 'kill').killSeq, 2);
  assert.ok(o.cs.load(2, o.c.toJSON(), { account: 'signed', slot: 0 }));
  const players = [o.p, { ...o.p, id: 2 }]; assert.ok(world.spawn(m)); m.hp = 200;
  o.cs.land(world, players, m, 2, { hit: true, dmg: 160 }, false);
  const shares = o.cs.land(world, players, m, 1, { hit: true, dmg: 100 }, false).filter(e => e.t === 'kill');
  assert.equal(shares.find(e => e.to === 2).killSeq, 1);
  assert.ok(!Object.hasOwn(shares.find(e => e.to === 1), 'killSeq'), 'EXP helper has no receipt and does not increment its owner sequence');
  assert.equal(o.cs.get(1).killSeq, 2); assert.equal(o.cs.get(2).killSeq, 1);
  assert.ok(!Object.hasOwn(o.cs.me(2), 'killSeq'), 'counter is not saved');
  const phantom = world.damage(m, 2, 100, {}, players, false).filter(e => e.t === 'kill');
  assert.ok(phantom.every(e => !Object.hasOwn(e, 'killSeq'))); assert.equal(o.cs.get(2).killSeq, 1);
  o.cs.drop(1); assert.ok(o.cs.set(1, o.c.toJSON(), o.c.classId)); assert.ok(world.spawn(m)); m.hp = 20;
  assert.equal(o.cs.land(world, [o.p], m, 1, { hit: true, dmg: 100 }, false).find(e => e.t === 'kill').killSeq, 1);
});

test('guest owner kill receipts are consumed before full/dead/no-card/cooldown and unknown-life checks', t => {
  let time = 0; t.mock.method(Date, 'now', () => time * 1000); t.mock.method(globalThis, 'setTimeout', () => 0);
  for (const blocked of ['full', 'dead', 'no-card', 'cooldown', 'unknown-monster']) {
    time = 0; const o = guest(['pusom']); o.c.mp = 0;
    const kill = () => {
      assert.ok(o.world.spawn(o.sm)); o.sm.hp = 20; o.net.emit('mspawn', { m: o.world.info(o.sm) });
      return o.cs.land(o.world, [o.p], o.sm, 1, { hit: true, dmg: 100 }, false);
    };
    if (blocked === 'cooldown') { for (const e of kill()) o.net.emit(e.t, e); time = 1; }
    const events = kill(), owner = events.find(e => e.t === 'kill');
    if (blocked === 'full') o.c.mp = o.c.maxMp;
    if (blocked === 'dead') o.c.hp = 0;
    if (blocked === 'no-card') assert.ok(o.c.unequip('charm'));
    const before = o.c.mp;
    for (const e of events) o.net.emit(e.t, e === owner && blocked === 'unknown-monster' ? { ...e, id: 9999 } : e);
    assert.equal(o.c.mp, before, blocked);
    if (blocked === 'no-card') {
      const index = o.c.inventory.findIndex(s => s?.id === 'bia_kae' && s.cards?.includes('card_pusom')); assert.ok(o.c.equip(index));
    }
    o.c.hp = o.c.maxHp; o.c.mp = 0; time += 6;
    o.net.emit('kill', { ...owner }); assert.equal(o.c.mp, 0, `${blocked}: replay cannot become eligible later`);
    for (const e of kill()) o.net.emit(e.t, e);
    assert.equal(o.c.mp, Math.floor(o.c.maxMp * .02), `${blocked}: a new genuine receipt can proc`);
  }
});

test('guest kill receipt validation ignores another owner and resets only on disconnect or new identity', t => {
  let time = 0; t.mock.method(Date, 'now', () => time * 1000); t.mock.method(globalThis, 'setTimeout', () => 0);
  const o = guest(['pusom']); o.c.mp = 0; o.sm.hp = 20;
  const kill = id => o.cs.land(o.world, [{ ...o.p, id }], o.sm, id, { hit: true, dmg: 100 }, false);
  const events = kill(1), owner = events.find(e => e.t === 'kill');
  for (const e of events.filter(e => e.t !== 'kill')) o.net.emit(e.t, e);
  for (const killSeq of [undefined, 0, -1, .5, '1', NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])
    o.net.emit('kill', { ...owner, killSeq });
  o.net.emit('kill', { ...owner, to: 2, killSeq: 999999 }); assert.equal(o.c.mp, 0);
  o.net.emit('kill', owner); const mp = Math.floor(o.c.maxMp * .02); assert.equal(o.c.mp, mp);
  time = 6; o.net.online = false; o.net.emit('status', false); o.net.emit('kill', { ...owner }); assert.equal(o.c.mp, mp);
  o.cs.drop(1); assert.ok(o.cs.set(1, o.c.toJSON(), o.c.classId));
  assert.ok(o.world.spawn(o.sm)); o.sm.hp = 20;
  o.net.online = true; o.net.emit('welcome', { you: 1 }); o.net.emit('mlist', { m: [o.world.info(o.sm)] });
  const next = kill(1); assert.equal(next.find(e => e.t === 'kill').killSeq, 1);
  for (const e of next) o.net.emit(e.t, e); assert.equal(o.c.mp, mp * 2);
  time = 12; assert.ok(o.cs.set(2, o.c.toJSON(), o.c.classId)); assert.ok(o.world.spawn(o.sm)); o.sm.hp = 20;
  o.net.emit('welcome', { you: 2 }); o.net.emit('mlist', { m: [o.world.info(o.sm)] });
  const other = kill(2); assert.equal(other.find(e => e.t === 'kill').killSeq, 1);
  for (const e of other) o.net.emit(e.t, e); assert.equal(o.c.mp, mp * 3);
  time = 18; o.net.emit('kill', { ...other.find(e => e.t === 'kill') }); assert.equal(o.c.mp, mp * 3);
});

test('guest blow carries bounded HP context through server basics, pets, kits and inherited DoT without changing stats', t => {
  t.mock.method(Math, 'random', () => .9); t.mock.method(globalThis, 'setTimeout', () => 0);
  for (const [cls, skill] of [['assassin', 'basic'], ['hunter', 'pet'], ['hunter', 'arch_poison']]) {
    const o = guest(['dusk_fort_3'], cls); o.c.hp = o.c.maxHp * .5;
    if (skill === 'arch_poison') {
      o.c.jobLevel = 50; o.c.skills = fullKit(cls, KIT_SKILL_IDS[cls]);
      assert.ok(o.cs.set(1, o.c.toJSON(), cls)); o.sc = o.cs.get(1).c;
      assert.equal(o.cs.cast(1, skill).ok, true);
    }
    const serverHp = o.sc.hp;
    o.combat.damageMonster(o.local, 1e99, { skill });
    const packet = o.sent.at(-1); assert.equal(packet.hpFraction, .5); assert.equal(packet.amount, undefined);
    const low = o.cs.blow(1, o.world, [o.p], packet).find(e => e.t === 'mh'); assert.ok(low);
    o.c.hp = o.c.maxHp; o.combat.damageMonster(o.local, 1, { skill });
    assert.equal(o.sent.at(-1).hpFraction, 1);
    const high = o.cs.blow(1, o.world, [o.p], o.sent.at(-1)).find(e => e.t === 'mh'); assert.ok(high);
    assert.equal(low.amount, Math.round(high.amount * 1.15), `${skill}: only the conditional multiplier changes`);
    assert.equal(o.sc.hp, serverHp, 'context cannot change server guest HP');
    if (skill === 'arch_poison') {
      const raw = rollBlow(o.cs.stats(o.sc), monsterDefense(o.sm), skill, o.sc.skillLevel(skill), () => .9).dmg;
      assert.equal(o.sm.debuffs.find(d => d.dot).source, raw * 1.15, 'first hit captures one boost for later ticks');
    }
    o.c.hp = o.c.maxHp * 2; o.combat.damageMonster(o.local, 1, { skill }); assert.equal(o.sent.at(-1).hpFraction, 1);
    o.c.hp = -1; o.combat.damageMonster(o.local, 1, { skill }); assert.equal(o.sent.at(-1).hpFraction, 0);
  }
});

test('signed blow omits and ignores guest HP claims while malformed guest fractions cannot alter vitals', t => {
  t.mock.method(globalThis, 'setTimeout', () => 0);
  const signed = pair(['dusk_fort_3']);
  const first = signed.cs.blow(1, signed.world, [signed.p], { id: signed.sm.id, skill: 'basic', hpFraction: .1 }).find(e => e.t === 'mh');
  const second = signed.cs.blow(1, signed.world, [signed.p], { id: signed.sm.id, skill: 'basic', hpFraction: 1 }).find(e => e.t === 'mh');
  assert.equal(first.amount, second.amount, 'a signed client cannot claim a low-HP bonus');
  const o = guest(['dusk_fort_3']); o.net.emit('sync', {}); o.c.hp = o.c.maxHp * .1;
  o.combat.damageMonster(o.local, 1, { skill: 'basic' }); assert.ok(!Object.hasOwn(o.sent.at(-1), 'hpFraction'));
  for (const hpFraction of [NaN, Infinity, '.1', -100, 1e99]) {
    const g = guest(['dusk_fort_3']); const hp = g.sc.hp;
    const bad = g.cs.blow(1, g.world, [g.p], { id: g.sm.id, skill: 'basic', hpFraction }).find(e => e.t === 'mh');
    const normal = g.cs.blow(1, g.world, [g.p], { id: g.sm.id, skill: 'basic' }).find(e => e.t === 'mh');
    assert.equal(bad.amount, normal.amount); assert.equal(g.sc.hp, hp);
  }
});

test('an owned me snapshot disables guest procs even when the initial sync was missed', t => {
  t.mock.method(globalThis, 'setTimeout', () => 0);
  const o = guest(['pop', 'pusom']); o.c.hp = o.c.maxHp / 2; o.c.mp = 0;
  const hp = o.c.hp;
  o.net.emit('me', { state: { owned: true, hp, mp: 0, buffs: [] } });
  assert.equal(o.combat.serverOwned, true);
  o.net.emit('mh', { id: o.sm.id, by: 1, amount: 100, removed: 100 }); assert.equal(o.c.hp, hp);
  o.net.emit('mgone', { id: o.sm.id, killed: true });
  o.net.emit('kill', { id: o.sm.id, type: o.sm.type, to: 1, exp: 0, gold: 1, drops: [] });
  assert.equal(o.c.mp, 0);
});
