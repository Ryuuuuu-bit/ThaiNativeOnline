// Skill evolution A/B, cast times and casting gear (src/rules/data/evolutions.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EVOLUTIONS, EVO_LEVEL, EVO_SWITCH_GOLD, CAST_MS, evoId, evoOf } from '../src/rules/data/evolutions.js';
import { SKILL_BY_ID } from '../src/rules/data/skills.js';
import { castInfo, hitEffects, selfEffects, splashOf } from '../src/training/kitCombat.js';
import { KIT_MOVES, KIT_SKILL_IDS } from '../src/character/data/kits.js';
import { Character, CDR_MAX, CAST_MAX } from '../src/character/Character.js';
import { Combatants } from '../server/combatants.js';
import { MonsterWorld } from '../server/monsters.js';
import { applyOp, fromSave } from '../server/progress.js';

const all = cls => Object.fromEntries(KIT_SKILL_IDS[cls].map(id => [id, EVO_LEVEL]));
const kitOf = id => Object.values(KIT_MOVES).flat().find(k => k.id === id);

test('every class has paths, each path is a real, different rules skill', () => {
  for (const cls of Object.keys(KIT_MOVES)) assert.ok(KIT_SKILL_IDS[cls].filter(id => EVOLUTIONS[id]).length >= 3, `${cls} has 3+ evolving skills`);
  for (const [id, paths] of Object.entries(EVOLUTIONS)) {
    assert.ok(kitOf(id), `${id} is a kit skill`);
    const a = SKILL_BY_ID[evoId(id, 'A')], b = SKILL_BY_ID[evoId(id, 'B')];
    assert.ok(a && b && a.nameTh === paths.A.name && evoOf(evoId(id, 'B')) === paths.B);
    assert.notDeepEqual({ ...a, id: 0, evo: 0, nameTh: 0 }, { ...b, id: 0, evo: 0, nameTh: 0 }, `${id}: A and B differ`);
  }
  for (const id of Object.keys(CAST_MS)) assert.ok(SKILL_BY_ID[id]?.castMs > 0, id);
});

test('paths change what the rules read: area, chain, effects, buffs, cast time', () => {
  const kick = kitOf('boxer_kick');
  assert.equal(castInfo(kick).splash, null);
  assert.deepEqual(castInfo({ ...kick, id: 'boxer_kick@B' }).splash, { radius: 2.5, around: 'target' });
  assert.ok(castInfo({ ...kitOf('boxer_croc'), id: 'boxer_croc@A' }).splash.radius > castInfo(kitOf('boxer_croc')).splash.radius);
  assert.deepEqual(splashOf(SKILL_BY_ID['arch_poison@B']), { chain: 3, radius: 4 });
  assert.equal(hitEffects('boxer_kick@A', 100).find(d => d.stun).duration, 1.5);
  assert.ok(hitEffects('mage_curse@B', 100).some(d => d.slow === .6));
  assert.equal(selfEffects('heal_tiger@B', 1, 10).buff.atk, .2);
  assert.ok(castInfo({ ...kitOf('mage_kalp'), id: 'mage_kalp@A' }).cast < castInfo(kitOf('mage_kalp')).cast);
  assert.equal(castInfo(kitOf('boxer_jab')).cast, 0, 'melee stays instant');
});

test('a path opens at skill Lv.5: free the first time, gold to switch, kept through a reset', () => {
  const c = Character.create('ทดสอบ', 'muaythai'); c.jobLevel = 50; c.gold = 1000;
  assert.equal(c.chooseEvo('boxer_kick', 'A'), false, 'not learnt to Lv.5 yet');
  c.skills = all('muaythai');
  assert.equal(c.skillVariant('boxer_kick'), 'boxer_kick');
  assert.equal(c.chooseEvo('boxer_kick', 'A'), true); assert.equal(c.gold, 1000);
  assert.equal(c.skillVariant('boxer_kick'), 'boxer_kick@A');
  assert.equal(c.chooseEvo('boxer_kick', 'A'), false, 'already on it');
  assert.equal(c.chooseEvo('boxer_kick', 'B'), true); assert.equal(c.gold, 1000 - EVO_SWITCH_GOLD);
  assert.equal(c.chooseEvo('boxer_jab', 'A'), false, 'no paths');
  c.skills.boxer_kick = 4; assert.equal(c.skillVariant('boxer_kick'), 'boxer_kick', 'below Lv.5 the path rests');
  const back = new Character(JSON.parse(JSON.stringify(c)));
  assert.deepEqual(back.evo, { boxer_kick: 'B' });
  assert.deepEqual(new Character({ ...c.toJSON(), evo: { boxer_kick: 'C', sword_twin: 'A' } }).evo, {}, 'unknown paths and other classes\' skills are dropped');
  // replayed on the server
  const s = fromSave({ ...c.toJSON(), skills: all('muaythai'), gold: 0 });
  assert.equal(applyOp(s, { op: 'evo', id: 'boxer_croc', pick: 'B' }), true);
  assert.equal(applyOp(s, { op: 'evo', id: 'boxer_croc', pick: 'A' }), false, 'no gold to switch');
  assert.equal(applyOp(s, { op: 'evo', id: 'boxer_croc', pick: 'X' }), false);
});

test('the server rolls with the path: its effects land on the monster', () => {
  let t = 0; const cs = new Combatants({ now: () => t, random: () => .3 });
  cs.load(1, { ...Character.create('ทดสอบ', 'warrior').toJSON(), level: 10, jobLevel: 50, skills: all('warrior'), evo: { sword_thrust: 'B' } }, { account: 'a', slot: 0 });
  const w = new MonsterWorld('test', { zones: [{ type: 'boar', x: 0, z: 0, radius: 0, count: 1, active: ['day'] }], random: () => .5 });
  for (let k = 0; k < 3; k += .1) w.update(.1, [], 'day');
  const m = w.monsters[0]; m.maxHp = m.hp = 1e6; m.x = 3; m.z = 0;
  assert.equal(cs.cast(1, 'sword_thrust').ok, true);
  cs.blow(1, w, [{ id: 1, x: 0, z: 0 }], { id: m.id, skill: 'sword_thrust' });
  assert.equal(m.debuffs.find(d => d.stun)?.remaining, 1.5, 'แทงตรึง holds 1.5 s');
  // a chain: arch_poison@B jumps to the neighbours
  const h = new Combatants({ now: () => t, random: () => .3 });
  h.load(2, { ...Character.create('ทดสอบ', 'hunter').toJSON(), level: 10, jobLevel: 50, skills: all('hunter'), evo: { arch_poison: 'B' } }, { account: 'b', slot: 0 });
  const w2 = new MonsterWorld('test', { zones: [0, 1, 2, 3].map(i => ({ type: 'boar', x: 6 + i, z: 0, radius: 0, count: 1, active: ['day'] })), random: () => .5 });
  for (let k = 0; k < 3; k += .1) w2.update(.1, [], 'day');
  for (const [i, o] of w2.monsters.entries()) { o.maxHp = o.hp = 1e6; o.x = 6 + i; o.z = 0; }
  assert.equal(h.cast(2, 'arch_poison').ok, true);
  const ev = h.blow(2, w2, [{ id: 2, x: 0, z: 0 }], { id: w2.monsters[0].id, skill: 'arch_poison' });
  assert.equal(new Set(ev.filter(e => e.t === 'mh' && !e.miss).map(e => e.id)).size, 4, 'the target and three more');
});

test('casting gear: cooldown cut and cast speed are capped; mpCost makes skills dearer', () => {
  const c = Character.create('ทดสอบ', 'shaman');
  const cdr = c.cooldownCut, cast = c.castSpeed;
  for (const id of ['prakam', 'bia_kae', 'pha_yant']) { c.addItem(id); c.equip(c.inventory.findIndex(s => s?.id === id)); }
  assert.ok(c.cooldownCut > cdr && c.castSpeed >= cast + .25 - 1e-9);
  assert.equal(c.mpCostMul, 1.1);
  c.alloc.dex = 500;
  assert.equal(c.castSpeed, CAST_MAX); assert.ok(c.cooldownCut <= CDR_MAX);
  // a cast too quick for its bar is refused by the server
  let t = 0; const cs = new Combatants({ now: () => t });
  cs.load(1, { ...Character.create('ทดสอบ', 'shaman').toJSON(), jobLevel: 50, skills: all('shaman') }, { account: 'a', slot: 0 });
  cs.get(1).c.mp = 999;
  assert.equal(cs.cast(1, 'mage_kalp').why, 'casting');
  cs.casting(1, 'mage_kalp'); t += .2;
  assert.equal(cs.cast(1, 'mage_kalp').why, 'casting', 'too soon');
  t += 1; assert.equal(cs.cast(1, 'mage_kalp').ok, true);
  assert.equal(cs.cast(1, 'mage_yant').ok, true, 'no cast time, no bar');
});
