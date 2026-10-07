// Job levels and skill points (src/character/Character.js, progression.js) and the server's side.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Character } from '../src/character/Character.js';
import { MAX_JOB_LEVEL, JOB_EXP_RATE, jobExpToNext, MAX_SKILL_LEVEL, SKILL_UNLOCK_JOB, MAX_LEVEL } from '../src/character/data/progression.js';
import { Combatants } from '../server/combatants.js';
import { applyOp, fromSave } from '../server/progress.js';

test('base level caps at 99; every EXP gain also feeds the job level', () => {
  assert.equal(MAX_LEVEL, 99);
  const c = Character.create('ก', 'hunter');
  assert.deepEqual([c.jobLevel, c.skillPoints, c.skills], [1, 0, { arch_quick: 1 }], 'the first skill is known from the start');
  c.gainExp(jobExpToNext(1) / JOB_EXP_RATE + 1);
  assert.equal(c.jobLevel, 2); assert.equal(c.skillPoints, 1);
  c.gainExp(1e9); assert.equal(c.jobLevel, MAX_JOB_LEVEL); assert.equal(c.jobExp, 0); assert.equal(c.skillPoints, MAX_JOB_LEVEL - 1);
});

test('skills open at their job level, cost a point a level and stop at the cap', () => {
  const c = new Character({ name: 'ข', classId: 'hunter', jobLevel: 6 });
  const [, second, third, fourth] = c.kitSkills;
  assert.equal(c.skillPoints, 5);
  assert.equal(c.skillUnlockJob(fourth), SKILL_UNLOCK_JOB[3]);
  assert.match(c.skillBlock(fourth), /Job Lv\.8/);
  for (let i = 0; i < MAX_SKILL_LEVEL; i++) assert.equal(c.learnSkill(second), true);
  assert.equal(c.skillLevel(second), MAX_SKILL_LEVEL); assert.equal(c.learnSkill(second), false, 'capped');
  assert.equal(c.skillPoints, 0); assert.equal(c.learnSkill(third), false, 'no points left');
  // a reset gives every point back for gold
  c.gold = 1; assert.equal(c.resetSkills(), false, 'not enough gold');
  c.gold = c.skillResetCost; assert.equal(c.resetSkills(), true);
  assert.deepEqual([c.skillPoints, c.gold, c.skillLevel(second)], [5, 0, 0]);
});

test('saves: old ones get a job level from their base level; impossible skills are dropped', () => {
  const old = new Character({ name: 'ค', classId: 'warrior', level: 20 });
  assert.ok(old.jobLevel > 10 && old.jobLevel < 20); assert.equal(old.skillPoints, old.jobLevel - 1);
  const ids = old.kitSkills, cheat = new Character({ name: 'ง', classId: 'warrior', jobLevel: 3, skills: Object.fromEntries(ids.map(id => [id, 5])) });
  assert.ok(cheat.skillPoints >= 0, 'never more points spent than the job level gives');
  assert.equal(cheat.skillLevel(ids[9]), 0, 'a skill that opens at Job 50 is not kept at Job 3');
  assert.deepEqual(JSON.parse(JSON.stringify(cheat)).skills, cheat.skills, 'skills are saved');
});

test('server: an unlearnt skill cannot be cast; learning is replayed; levels raise the numbers', () => {
  const cs = new Combatants({ now: () => 0 });
  cs.load(1, Character.create('จ', 'hunter').toJSON(), { account: 'a', slot: 0 });
  const c = cs.get(1).c;
  assert.equal(cs.cast(1, 'arch_poison').why, 'not_learnt');
  c.jobLevel = 3;
  assert.equal(cs.op(1, { op: 'learn', id: 'arch_poison' }), true);
  assert.equal(cs.op(1, { op: 'learn', id: 'arch_snipe' }), false, 'not open yet');
  assert.equal(cs.cast(1, 'arch_poison').ok, true);
  const s = fromSave(c.toJSON()); assert.equal(s.skillLevel('arch_poison'), 1);
  assert.equal(applyOp(s, { op: 'skill_reset' }), false, 'reset costs gold');
  s.gold = s.skillResetCost; assert.equal(applyOp(s, { op: 'skill_reset' }), true);
});
