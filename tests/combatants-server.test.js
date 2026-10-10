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
import { fullKit } from '../src/character/data/skilltree.js';
// every kit skill learnt at Lv.1 (job level 50 has the points)
const sheet = (classId, level = 10) => ({ ...Character.create('ทดสอบ', classId).toJSON(), level, jobLevel: 50, skills: fullKit(classId, KIT_SKILL_IDS[classId] ?? []) });
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
  assert.equal(c.level, 100, 'the level cap'); assert.equal(c.equipment.weapon, null);
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
  assert.equal(cs.cast(1, 'arch_snipe').why, 'casting', 'a cast bar first (arch_snipe has a cast time)');
  cs.casting(1, 'arch_snipe'); now.add(1);
  assert.equal(cs.cast(1, 'arch_snipe').ok, true);
  assert.equal(cs.cast(1, 'arch_snipe').why, 'cooldown');
  let n = 0; for (let i = 0; i < 50; i++) n += cs.blow(1, w, players, { id: m.id, skill: 'arch_snipe' }).filter(e => e.t === 'mh').length;
  assert.ok(n > 0 && n <= 7, `blows per cast are bounded (${n})`);
  now.add(CAST_WINDOW + 1);
  const cd = castInfo(KITS.hunter.find(k => k.id === 'arch_snipe'), 1).cd;
  now.add(cd);
  cs.casting(1, 'arch_snipe'); now.add(1);
  assert.equal(cs.cast(1, 'arch_snipe').ok, true, 'ready again after its cooldown');
});

test('an effect the server lands is announced to the map (md)', () => {
  const { cs, p, now } = setup('warrior'), w = boars(), m = w.monsters[0];
  m.x = 1; m.z = 0; m.maxHp = m.hp = 1e6;
  cs.load(1, { ...cs.get(1).c.toJSON(), jobLevel: 50, skills: { sword_twin: 5, sword_thrust: 5 }, evo: { sword_thrust: 'B' } }, { account: 'x', slot: 0 });
  assert.equal(cs.cast(1, 'sword_thrust').ok, true);
  let md = []; for (let i = 0; i < 6 && !md.length; i++) md = cs.blow(1, w, [p], { id: m.id, skill: 'sword_thrust' }).filter(e => e.t === 'md');
  assert.equal(md[0]?.id, m.id); assert.ok(md[0].d.stun && md[0].d.secs > 0 && md[0].d.label);
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
  assert.ok(v1.length >= 3, 'the line caught the row'); assert.equal(v2.length, 0, 'the single primary and line cannot repeat');
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

test('a modified client gains nothing: blows per monster are capped, MP must be there, old cast starts and the fallen do not cast', () => {
  const { now, cs, p } = setup('warrior'), w = boars(3, 2), players = [p];
  const c = cs.get(1).c; c.mp = 999;
  const skill = KITS.warrior.find(k => !castInfo(k, 1).cast) ?? KITS.warrior[0];
  const info = castInfo(skill, 1), per = Math.max(skill.hits?.length ?? 0, 1) + 1;
  assert.ok(cs.cast(1, skill.id).ok);
  let n = 0; for (let i = 0; i < 30; i++) n += hits(cs.blow(1, w, players, { id: w.monsters[0].id, skill: skill.id })).filter(e => e.id === w.monsters[0].id).length;
  assert.ok(n <= per, `${n} blows on one boar from one cast (at most ${per})`);
  // MP: a cast costs what it costs, a quarter of slack at most
  now.add(60); const costly = KITS.warrior.map(k => [k, castInfo(k, 1)]).filter(([, i]) => i.mp >= 8 && !i.cast)[0];
  cs.get(1).persist = { account: 'a', slot: 0 };   // a signed-in character pays MP on the server
  if (costly) { c.mp = 0; assert.equal(cs.cast(1, costly[0].id).why, 'mp', 'no casting at 0 MP'); }
  // a cast bar started long ago is not a cast now
  const { cs: cs2, now: now2 } = setup('shaman'); cs2.get(1).c.mp = 999;
  const bar = KITS.shaman.find(k => castInfo(k, 1).cast > .5);
  cs2.casting(1, bar.id); now2.add(castInfo(bar, 1).cast * 3 + 10);
  assert.equal(cs2.cast(1, bar.id).why, 'casting', 'stale start');
  cs2.casting(1, 'nonsense'); assert.equal(cs2.get(1).casting.has('nonsense'), false, 'only own kit skills are remembered');
  // dead: no casting at all
  c.hp = 0; assert.equal(cs.cast(1, skill.id).why, 'dead');
});

test('the dog bites at its own pace and pounces by the rules, not by the browser', () => {
  const { now, cs, p } = setup('hunter'), w = boars(), m = w.monsters[0], players = [p];
  m.x = 4; cs.get(1).c.hp = cs.get(1).c.maxHp;
  let bites = 0;
  for (let i = 0; i < 100; i++) { now.add(.1); bites += hits(cs.blow(1, w, players, { id: m.id, skill: 'pet', pounce: 1 })).length; }
  assert.ok(bites <= 10 + 2, `${bites} bites in 10 s`);   // 1.3 s each, two saved up
});


test('hybrid tether keeps all twelve authoritative ticks beyond the default six-second window', () => {
  const { cs, now, p } = setup('herbalist'), w = boars(), m = w.monsters[0];
  assert.equal(cs.cast(1, 'heal_vine').ok, true);
  const cast = cs.get(1).casts.at(-1);
  assert.equal(cast.perTarget, 12);
  assert.ok(cast.window > CAST_WINDOW);
  now.add(6.1);
  for (let i = 0; i < 12; i++) assert.equal(hits(cs.blow(1, w, [p], { id: m.id, skill: 'heal_vine' })).length, 1);
  assert.equal(cs.blow(1, w, [p], { id: m.id, skill: 'heal_vine' }).length, 0);
  cs.get(1).c.skills.heal_tiger = 1;
  cs.casting(1, 'heal_tiger'); now.add(3);
  assert.equal(cs.cast(1, 'heal_tiger').ok, true);
  assert.equal(cs.get(1).casts.at(-1).left, 0, 'support opens no damage budget');
});
