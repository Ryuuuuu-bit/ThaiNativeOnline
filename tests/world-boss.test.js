// World boss (src/combat/data/worldBoss.js, server/monsters.js): the ghost sisters of เรือนหอร้าง
// rise once a night with HP set by the players online, share a red thread, rise again unless both
// fall in time, pay everyone who did their share, and fade at dawn.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MonsterWorld } from '../server/monsters.js';
import { MONSTERS } from '../src/combat/data/monsters.js';
import { WORLD_BOSS, worldBossHp } from '../src/combat/data/worldBoss.js';
import { MAPS } from '../src/world/maps.js';

const players = [{ id: 1, x: -10, z: -900, lv: 12, dead: false }, { id: 2, x: -9, z: -900, lv: 10, dead: false }, { id: 3, x: -8, z: -900, lv: 9, dead: false }];
function risen(online = 3) {
  const w = new MonsterWorld('ruen_ho', { random: () => .5 }); w.online = () => online;
  for (let i = 0; i < 40; i++) w.update(.1, players, 'night');
  return { w, red: w.monsters.find(m => m.type === 'ghost_red'), black: w.monsters.find(m => m.type === 'ghost_black') };
}

test('the room is a night-only instance and the sisters only rise at night', () => {
  assert.ok(MAPS.ruen_ho.nightOnly && MAPS.ruen_ho.instance);
  const w = new MonsterWorld('ruen_ho', { random: () => .5 }); w.online = () => 1;
  for (let i = 0; i < 40; i++) w.update(.1, players, 'day');
  assert.ok(w.monsters.length === 2 && w.monsters.every(m => m.hp === 0));
  for (let i = 0; i < 40; i++) w.update(.1, players, 'night');
  assert.ok(w.monsters.every(m => m.hp > 0));
});

test('HP is one share per player online, locked when they rise', () => {
  const { red, black } = risen(3);
  assert.equal(red.maxHp, worldBossHp(MONSTERS.ghost_red.hp, 3)); assert.equal(red.maxHp, MONSTERS.ghost_red.hp * 3);
  assert.equal(black.maxHp, MONSTERS.ghost_black.hp * 3);
  assert.equal(worldBossHp(1000, 0), 1000); assert.equal(worldBossHp(1000, 500), 1000 * WORLD_BOSS.cap);
});

test('the red thread: close together they take half damage; apart, full', () => {
  const { w, red, black } = risen();
  black.x = red.x + 1; black.z = red.z;
  const hp = red.hp; w.damage(red, 1, 1000, {}, players, true); assert.equal(hp - red.hp, 1000 * WORLD_BOSS.link.taken);
  black.x = red.x + WORLD_BOSS.link.range + 5;
  const hp2 = red.hp; w.damage(red, 1, 1000, {}, players, true); assert.equal(hp2 - red.hp, 1000);
});

test('one sister down: the other has its seconds, or the fallen one rises again', () => {
  const { w, red, black } = risen();
  black.x = red.x + 20;
  const ev = w.damage(red, 1, red.hp, {}, players, true);
  assert.ok(ev.some(e => e.t === 'wb' && e.state === 'fall'));
  assert.ok(!ev.some(e => e.t === 'kill'), 'no pay until both are down');
  const back = [];
  for (let i = 0; i < (WORLD_BOSS.revive + 1) * 10; i++) back.push(...w.update(.1, players, 'night'));
  assert.ok(back.some(e => e.t === 'wb' && e.state === 'rise'));
  assert.equal(red.hp, Math.round(red.maxHp * WORLD_BOSS.reviveHp));
});

test('both down within the time: everyone with a share is paid, then nothing rises again that night', () => {
  const { w, red, black } = risen();
  black.x = red.x + 20;
  w.damage(red, 3, 3000, {}, players, true); w.damage(red, 2, 3000, {}, players, true); w.damage(red, 1, red.hp - 100, {}, players, true);
  w.update(.1, players, 'night');
  w.damage(black, 1, black.hp, {}, players, true);   // red not dead yet: black falls first
  const ev = w.damage(red, 2, red.hp, {}, players, true);  // ...and red within the time: the round is won
  const kills = ev.filter(e => e.t === 'kill');
  assert.equal(kills.length, 3, 'everyone with a share is paid, not only the top damager');
  assert.ok(kills.every(k => k.exp > 0 && k.gold > 0));
  const down = ev.find(e => e.t === 'wb' && e.state === 'down'); assert.equal(down.mvp, 1);
  for (let i = 0; i < 300; i++) w.update(.1, players, 'night');
  assert.ok(w.monsters.every(m => m.hp === 0), 'one round a night');
});

test('dawn: whatever stands fades, and the next night they rise again', () => {
  const { w } = risen();
  const ev = w.update(.1, players, 'morning');
  assert.equal(ev.filter(e => e.t === 'mgone').length, 2);
  assert.ok(w.monsters.every(m => m.hp === 0));
  for (let i = 0; i < 40; i++) w.update(.1, players, 'night');
  assert.ok(w.monsters.every(m => m.hp > 0));
});

test('below 30% HP a sister goes berserk: news to everyone, faster and harder swings', () => {
  const { w, red, black } = risen();
  black.x = red.x + 20;
  w.damage(red, 1, Math.ceil(red.maxHp * (1 - WORLD_BOSS.rage.at)) + 10, {}, players, true);
  const ev = w.update(.1, players, 'night');
  assert.ok(ev.some(e => e.t === 'wb' && e.state === 'rage' && e.type === 'ghost_red'));
  assert.ok(red.enraged && !black.enraged);
  assert.ok(!w.update(.1, players, 'night').some(e => e.state === 'rage'), 'announced once');
});

test('the boss rises at the tier of the players on its map (as the old Rahu): level, HP and swing power', async () => {
  const { worldBossTier, WORLD_BOSS_TIERS } = await import('../src/combat/data/worldBoss.js');
  assert.equal(worldBossTier([]).lv, 12); assert.equal(worldBossTier([10, 8]).lv, 12);
  assert.equal(worldBossTier([99, 99, 99]).lv, 99); assert.equal(worldBossTier([99, 1, 1, 1, 1]).n, 1, 'the five highest, averaged');
  const hi = players.map(p => ({ ...p, lv: 99 }));
  const w = new MonsterWorld('ruen_ho', { random: () => .5 }); w.online = () => 1;
  for (let i = 0; i < 40; i++) w.update(.1, hi, 'night');
  const red = w.monsters.find(m => m.type === 'ghost_red'), top = WORLD_BOSS_TIERS.at(-1);
  assert.equal(red.tier.lv, 99); assert.equal(red.maxHp, MONSTERS.ghost_red.hp * top.hp); assert.equal(w.info(red).lv, 99);
});

test('skills: warned on the floor, then a share of max HP for whoever still stands in the mark', async () => {
  const { WORLD_BOSS_SKILLS } = await import('../src/combat/data/worldBoss.js');
  const { w, red, black } = risen();
  black.x = red.x + 30;
  const me = { id: 1, x: red.x + 1, z: red.z, lv: 12 }, away = { id: 2, x: red.x + 30, z: red.z + 30, lv: 12 };
  w.aggro(red, 1);
  const ev = [];
  for (let i = 0; i < 40 && !ev.some(e => e.t === 'wbcast' && e.id === red.id); i++) ev.push(...w.update(.1, [me, away], 'night'));
  const cast = ev.find(e => e.t === 'wbcast' && e.id === red.id);
  assert.ok(cast && cast.spots.length && cast.warn > 0, 'a warned cast');
  const skill = WORLD_BOSS_SKILLS.ghost_red.find(s => s.id === cast.skill);
  me.x = cast.spots[0].x; me.z = cast.spots[0].z;   // stays in the mark
  const after = [];
  for (let i = 0; i < Math.ceil(cast.warn / .1) + 2; i++) after.push(...w.update(.1, [me, away], 'night'));
  assert.ok(after.some(e => e.t === 'wbfx' && e.skill === cast.skill));
  const hit = after.find(e => e.t === 'wbhit' && e.to === 1 && !e.dot);
  assert.ok(hit && Math.abs(hit.pct - skill.pct) < 1e-9, 'a share of max HP');
  assert.ok(!after.some(e => e.t === 'wbhit' && e.to === 2), 'out of the mark: no hit');
});
