import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Character } from '../src/character/Character.js';
import { Combatants } from '../server/combatants.js';
import { applyOp } from '../server/progress.js';

const sheet = () => new Character({ name: 'ทดสอบ', classId: 'warrior', jobLevel: 12, gold: 1000, skills: { sword_twin: 5, sword_thrust: 3, sword_t_mastery: 3 } });
test('paths use current Job fee, preserve first choice and reject repeated payment', () => {
  const c = sheet();
  assert.equal(c.chooseEvo('sword_twin', 'A'), true);
  assert.equal(c.gold, 1000);
  assert.equal(c.evoCost('sword_twin', 'B'), 120);
  assert.equal(c.chooseEvo('sword_twin', 'B'), true);
  assert.equal(c.gold, 880);
  assert.equal(c.chooseEvo('sword_twin', 'B'), false);
  assert.equal(c.gold, 880);
  c.jobLevel = 20; c.gold = 199;
  assert.equal(c.chooseEvo('sword_twin', 'A'), false);
  assert.equal(c.gold, 199);
});
test('passive choices affect actual stats, clamp health and persist within class', () => {
  const c = sheet(); c.jobLevel = 20; c.skills.sword_t_mastery = 5; const base = c.passiveBonus;
  assert.equal(c.chooseEvo('sword_t_mastery', 'A'), true);
  assert.notDeepEqual(c.passiveBonus, base);
  assert.equal(new Character(c.toJSON()).evo.sword_t_mastery, 'A');
  c.hp = c.maxHp; c.mp = c.maxMp;
  assert.equal(c.chooseEvo('sword_t_mastery', 'B'), true);
  assert.ok(c.hp <= c.maxHp && c.mp <= c.maxMp);
  assert.equal(c.chooseEvo('mage_akom', 'A'), false);
});
test('server cannot choose paths without trusted safe combat context', () => {
  const c = sheet();
  const op = { op: 'evo', id: 'sword_twin', pick: 'A' };
  assert.equal(applyOp(c, op), false);
  assert.equal(applyOp(c, op, null, null, { fighting: true }), false);
  assert.equal(applyOp(c, op, null, null, { fighting: false, busy: true }), false);
  assert.equal(applyOp(c, op, null, null, { fighting: false, busy: false }), true);
});
test('server rejects combat, active casts and buffs, retaining cooldowns without changing gold or timers', () => {
  let time = 0; const cs = new Combatants({ now: () => time });
  cs.load(1, sheet().toJSON(), { account: 'test', slot: 0 });
  const state = cs.get(1), op = { op: 'evo', id: 'sword_twin', pick: 'A' };
  cs.touch(1); assert.equal(cs.op(1, op), false);
  time = 100; state.cds.set('sword_twin', 1000);
  assert.equal(cs.op(1, op), true); assert.equal(state.cds.get('sword_twin'), 1000); op.pick = 'B';
  time = 111; state.casting.set('sword_twin', time);
  assert.equal(cs.op(1, op), false); state.casting.clear();
  state.c.buffs.push({ id: 'test', duration: 10 });
  assert.equal(cs.op(1, op), false); state.c.buffs = [];
  state.variantEffectsUntil = time + 20; assert.equal(cs.op(1, op), false); state.variantEffectsUntil = 0;
  state.casts.push({ at: time, left: 1 });
  assert.equal(cs.op(1, op), false); time += 100;
  assert.equal(cs.op(1, op), true); assert.equal(state.c.gold, 880);
  assert.equal(state.cds.get('sword_twin'), 1000);
  const switchOp = { ...op, pick: 'A' };
  assert.equal(cs.op(1, switchOp), true); assert.equal(state.c.gold, 760);
  assert.equal(cs.op(1, switchOp), false); assert.equal(state.c.gold, 760);
});
test('guest path choice uses the same fight guard', () => {
  const c = sheet(); c.evoContext = () => ({ fighting: true });
  assert.equal(c.chooseEvo('sword_twin', 'A'), false);
  c.evoContext = () => ({ fighting: false, busy: true });
  assert.equal(c.chooseEvo('sword_twin', 'A'), false);
  c.evoContext = () => ({ fighting: false, busy: false });
  assert.equal(c.chooseEvo('sword_twin', 'A'), true);
});
