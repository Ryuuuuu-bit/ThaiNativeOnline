// Server-rolled damage (server/combatants.js): the browser names the skill, the server rolls.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Combatants, KITS, sane, CAST_WINDOW } from '../server/combatants.js';
import { MonsterWorld } from '../server/monsters.js';
import { Character } from '../src/character/Character.js';
import { castInfo } from '../src/training/kitCombat.js';

const clock = () => { let t = 0; const now = () => t; now.add = s => { t += s; }; return now; };
const zone = (o = {}) => ({ type: 'boar', x: 0, z: 0, radius: 0, count: 1, active: ['morning', 'day', 'evening', 'night'], ...o });
const boars = (n = 1, spread = 0) => {
  const w = new MonsterWorld('test', { zones: Array.from({ length: n }, (_, i) => zone({ x: i * spread })), random: () => .5 });
  for (let t = 0; t < 3; t += .1) w.update(.1, [], 'day');
  for (const m of w.monsters) { m.maxHp = m.hp = 1e6; }   // tough enough to count blows on
  return w;
};
import { KIT_SKILL_IDS } from '../src/character/data/kits.js';
// every kit skill learnt at Lv.1 (job level 50 has the points)
const sheet = (classId, level = 10) => ({ ...Character.create('ทดสอบ', classId).toJSON(), level, jobLevel: 50, skills: Object.fromEntries((KIT_SKILL_IDS[classId] ?? []).map(id => [id, 1])) });
const setup = (classId = 'hunter', o = {}) => {
  const now = clock(), cs = new Combatants({ now, random: () => .3 });
  assert.equal(cs.set(1, sheet(classId), classId), true);
  return { now, cs, p: { id: 1, x: 3, z: 0, lv: 10 }, ...o };
};
const hits = ev => ev.filter(e => e.t === 'mh' && !e.miss);

test('character sheets: unknown classes and over-spent stat points are refused', () => {
  assert.equal(sane({ level: 5 }, 'dragon'), null);
  assert.equal(sane({ level: 2, alloc: { str: 500 } }, 'warrior'), null);
  const c = sane({ level: 999, alloc: { str: 3 }, equipment: { weapon: 'no_such_sword' } }, 'warrior');
  assert.equal(c.level, 150); assert.equal(c.equipment.weapon, null);
});

test('basic attacks: rolled here from the sheet, no faster than the attack speed allows, in reach', () => {
  const { now, cs, p } = setup('warrior'), w = boars(), m = w.monsters[0], players = [p];
  m.x = 4; m.z = 0;
  const first = hits(cs.blow(1, w, players, { id: m.id, skill: 'basic' }));
  assert.equal(first.length, 1); assert.ok(first[0].amount > 0 && first[0].amount < 500, 'a level-10 warrior-sized blow');
  // two saved up for lag, then the bucket is empty
  cs.blow(1, w, players, { id: m.id, skill: 'basic' });
  assert.deepEqual(cs.blow(1, w, players, { id: m.id, skill: 'basic' }), [], 'too fast');
  now.add(1.2);
  assert.equal(hits(cs.blow(1, w, players, { id: m.id, skill: 'basic' })).length, 1);
  m.x = 40; now.add(2);
  assert.deepEqual(cs.blow(1, w, players, { id: m.id, skill: 'basic' }), [], 'out of reach');
});

test('skills: only your own kit, cooldowns hold, a cast allows only so many blows', () => {
  const { now, cs, p } = setup('hunter'), w = boars(), m = w.monsters[0], players = [p];
  m.x = 6; m.z = 0;
  assert.equal(cs.cast(1, 'boxer_jab').ok, false, 'another class\'s skill');
  assert.deepEqual(cs.blow(1, w, players, { id: m.id, skill: 'arch_snipe' }), [], 'no cast, no blow');
  assert.equal(cs.cast(1, 'arch_snipe').ok, true);
  assert.equal(cs.cast(1, 'arch_snipe').why, 'cooldown');
  let n = 0; for (let i = 0; i < 50; i++) n += cs.blow(1, w, players, { id: m.id, skill: 'arch_snipe' }).length;
  assert.ok(n > 0 && n <= 7, `blows per cast are bounded (${n})`);
  now.add(CAST_WINDOW + 1);
  const cd = castInfo(KITS.hunter.find(k => k.id === 'arch_snipe'), 1).cd;
  now.add(cd);
  assert.equal(cs.cast(1, 'arch_snipe').ok, true, 'ready again after its cooldown');
});

test('area skills: the server finds who else is caught; effects land once per cast', () => {
  const { cs, p } = setup('hunter'), w = boars(4, 1.5), players = [p];
  const [a, ...rest] = w.monsters;
  for (const [i, m] of w.monsters.entries()) { m.x = 6 + i * 1.2; m.z = 0; }
  cs.cast(1, 'arch_rain');   // a circle around the target
  const ev = cs.blow(1, w, players, { id: a.id, skill: 'arch_rain' });
  const struck = new Set(hits(ev).map(e => e.id));
  assert.ok(struck.has(a.id) && rest.some(m => struck.has(m.id)), 'neighbours hit too');
  // a piercing volley: everyone on the line, each once per cast
  cs.cast(1, 'arch_volley');
  const v1 = hits(cs.blow(1, w, players, { id: a.id, skill: 'arch_volley' }));
  const v2 = hits(cs.blow(1, w, players, { id: a.id, skill: 'arch_volley' }));
  assert.ok(v1.length >= 3, 'the line caught the row'); assert.equal(v2.length, 1, 'the line does not repeat');
  // a poison arrow leaves damage over time on the monster
  cs.cast(1, 'arch_poison');
  cs.blow(1, w, players, { id: a.id, skill: 'arch_poison' });
  assert.ok(a.debuffs.some(d => d.dot > 0 && d.by === 1));
});

test('buffs from a cast raise the next rolls, and run out', () => {
  const { cs } = setup('muaythai'), c = cs.get(1).c;
  const before = c.patk;
  assert.equal(cs.cast(1, 'boxer_waikru').ok, true);
  assert.ok(c.patk > before, 'ไหว้ครู raises ATK');
  for (let t = 0; t < 60; t += .1) cs.tick(.1, false);
  assert.equal(c.patk, before);
});

test('the dog bites only for hunters, at its own pace', () => {
  const w = boars(), m = w.monsters[0];
  m.x = 4; m.z = 0;
  const war = setup('warrior');
  assert.deepEqual(war.cs.blow(1, w, [war.p], { id: m.id, skill: 'pet' }), []);
  const h = setup('hunter');
  const ev = h.cs.blow(1, w, [h.p], { id: m.id, skill: 'pet' });
  assert.ok(ev.some(e => e.t === 'mh' && (e.pet || e.miss)));
  h.cs.blow(1, w, [h.p], { id: m.id, skill: 'pet' });
  assert.deepEqual(h.cs.blow(1, w, [h.p], { id: m.id, skill: 'pet' }), [], 'too fast');
});
