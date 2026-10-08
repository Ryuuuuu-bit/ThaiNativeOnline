// Job levels and skill points (src/character/Character.js, progression.js) and the server's side.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Character } from '../src/character/Character.js';
import { MAX_JOB_LEVEL, JOB_EXP_RATE, jobExpToNext, MAX_SKILL_LEVEL, MAX_LEVEL } from '../src/character/data/progression.js';
import { SKILL_TREE, reqOf, fullKit } from '../src/character/data/skilltree.js';
import { KIT_PASSIVES } from '../src/rules/data/kitpassives.js';
import { KIT_SKILL_IDS } from '../src/character/data/kits.js';
import { Combatants } from '../server/combatants.js';
import { applyOp, fromSave } from '../server/progress.js';

test('base level caps at 100; every EXP gain also feeds the job level', () => {
  assert.equal(MAX_LEVEL, 100);
  const c = Character.create('ก', 'hunter');
  assert.deepEqual([c.jobLevel, c.skillPoints, c.skills], [1, 0, { arch_quick: 1 }], 'the first skill is known from the start');
  c.gainExp(jobExpToNext(1) / JOB_EXP_RATE + 1);
  assert.equal(c.jobLevel, 2); assert.equal(c.skillPoints, 1);
  c.gainExp(1e9); assert.equal(c.jobLevel, MAX_JOB_LEVEL); assert.equal(c.jobExp, 0); assert.equal(c.skillPoints, MAX_JOB_LEVEL - 1);
});

test('skills open down their line (the ones before them, then the job floor), cost a point a level and stop at the cap', () => {
  const c = new Character({ name: 'ข', classId: 'hunter', jobLevel: 6 });
  const [root, poison, pierce, hawk] = ['arch_quick', 'arch_poison', 'arch_pierce', 'arch_hawk'];
  assert.equal(c.skillPoints, 5);
  assert.match(c.skillBlock(poison), /ศรคู่ฉับไว Lv\.2/, 'the root first');
  assert.equal(c.learnSkill(root), true); assert.equal(c.skillBlock(poison), null); assert.equal(c.learnSkill(poison), true);
  assert.match(c.skillBlock(hawk), /Lv\.3/); assert.equal(c.learnSkill(root), true); assert.equal(c.skillBlock(hawk), null);
  assert.match(c.skillBlock('arch_snipe'), /Job Lv\.30/, 'the big ones keep a job floor');
  assert.equal(c.skillUnlockJob('arch_snipe'), 30);
  assert.deepEqual(c.skillOpensNext(pierce), [], 'nothing waits on ห่าศร at Lv.1');
  c.jobLevel = 50;
  for (let i = c.skillLevel(root); i < MAX_SKILL_LEVEL; i++) assert.equal(c.learnSkill(root), true);
  assert.equal(c.skillLevel(root), MAX_SKILL_LEVEL); assert.equal(c.learnSkill(root), false, 'capped');
  assert.equal(MAX_SKILL_LEVEL, 10, 'ten levels a skill: 49 points cannot fill 100 levels');
  // a reset gives every point back for gold
  c.gold = 1; assert.equal(c.resetSkills(), false, 'not enough gold');
  c.gold = c.skillResetCost; assert.equal(c.resetSkills(), true);
  assert.deepEqual([c.skillPoints, c.gold, c.skillLevel(poison)], [49, 0, 0]);
});

test('every class tree: nine skills on three lines after the root, requirements point back up the line, and a full kit fits the points', () => {
  for (const [cls, ids] of Object.entries(KIT_SKILL_IDS)) {
    const tree = SKILL_TREE[cls]; assert.ok(tree, cls);
    const onLines = tree.lines.flatMap(l => l.skills);
    assert.deepEqual([...onLines].sort(), ids.slice(1).sort(), `${cls}: every skill but the root is on one line`);
    assert.equal(new Set(onLines).size, 9, `${cls}: no skill on two lines`);
    for (const l of tree.lines) l.skills.forEach((id, i) => {
      const { req, job } = reqOf(cls, id);
      assert.ok(Object.keys(req).length && job >= 1, `${cls} ${id} has requirements`);
      for (const [k, lv] of Object.entries(req)) { assert.ok(k === ids[0] || l.skills.indexOf(k) >= 0 && l.skills.indexOf(k) < i, `${cls} ${id} needs ${k} from before it on its line`); assert.ok(lv >= 1 && lv <= MAX_SKILL_LEVEL); }
      if (i) assert.ok(job >= reqOf(cls, l.skills[i - 1]).job, `${cls} ${id}: job floors grow down the line`);
    });
    const kit = fullKit(cls, ids, 5), c = new Character({ name: 'ฉ', classId: cls, jobLevel: MAX_JOB_LEVEL, skills: kit });
    assert.deepEqual(c.skills, kit, `${cls}: a full kit at Lv.5 is tree-valid`); assert.ok(c.skillPoints >= 0, `${cls}: and affordable at Job ${MAX_JOB_LEVEL}`);
  }
});

test('saves: old ones get a job level from their base level; impossible skills are dropped', () => {
  const old = new Character({ name: 'ค', classId: 'warrior', level: 20 });
  assert.ok(old.jobLevel > 10 && old.jobLevel < 20); assert.equal(old.skillPoints, old.jobLevel - 1);
  const ids = old.kitSkills, cheat = new Character({ name: 'ง', classId: 'warrior', jobLevel: 3, skills: Object.fromEntries(ids.map(id => [id, 5])) });
  assert.ok(cheat.skillPoints >= 0, 'never more points spent than the job level gives');
  assert.equal(cheat.skillLevel(ids[9]), 0, 'a skill with a Job 30 floor is not kept at Job 3');
  const orphan = new Character({ name: 'จ', classId: 'warrior', jobLevel: 50, skills: { sword_twin: 1, sword_pikat: 3 } });
  assert.equal(orphan.skillLevel('sword_pikat'), 0, 'a skill without the ones before it on its line is forgotten (an old save)');
  assert.deepEqual(JSON.parse(JSON.stringify(cheat)).skills, cheat.skills, 'skills are saved');
});

test('server: an unlearnt skill cannot be cast; learning is replayed; levels raise the numbers', () => {
  const cs = new Combatants({ now: () => 0 });
  cs.load(1, Character.create('จ', 'hunter').toJSON(), { account: 'a', slot: 0 });
  const c = cs.get(1).c;
  assert.equal(cs.cast(1, 'arch_poison').why, 'not_learnt');
  c.jobLevel = 3;
  assert.equal(cs.op(1, { op: 'learn', id: 'arch_poison' }), false, 'the root must reach Lv.2 first');
  assert.equal(cs.op(1, { op: 'learn', id: 'arch_quick' }), true);
  assert.equal(cs.op(1, { op: 'learn', id: 'arch_poison' }), true);
  assert.equal(cs.op(1, { op: 'learn', id: 'arch_snipe' }), false, 'not open yet');
  assert.equal(cs.cast(1, 'arch_poison').ok, true);
  const s = fromSave(c.toJSON()); assert.equal(s.skillLevel('arch_poison'), 1);
  assert.equal(applyOp(s, { op: 'skill_reset' }), false, 'reset costs gold');
  s.gold = s.skillResetCost; assert.equal(applyOp(s, { op: 'skill_reset' }), true);
});

test('tree passives: one on each line, open at the line\'s first skill Lv.3, never on the hotbar, and they add to the stats', () => {
  for (const [cls, ids] of Object.entries(KIT_SKILL_IDS)) for (const l of SKILL_TREE[cls].lines) {
    assert.ok(KIT_PASSIVES[l.passive]?.cls === cls, `${cls} ${l.name} has its passive`);
    assert.deepEqual(reqOf(cls, l.passive).req, { [l.skills[0]]: 3 }, `${cls} ${l.passive} waits on ${l.skills[0]} Lv.3`);
    assert.ok(!ids.includes(l.passive), 'not a hotbar skill');
  }
  const c = new Character({ name: 'ช', classId: 'warrior', jobLevel: 20, skills: { sword_twin: 3, sword_guard: 3 } });
  const before = c.derived;
  assert.equal(c.skillBlock('sword_t_hide'), null); assert.equal(c.learnSkill('sword_t_hide'), true); assert.equal(c.learnSkill('sword_t_hide'), true);
  assert.ok(c.derived.maxHp > before.maxHp && c.derived.def === before.def + 2, 'หนังเหนียว Lv.2: more HP, +2 DEF');
  assert.match(c.skillBlock('sword_t_mastery'), /แทงทะลวง Lv\.3/);
  const h = new Character({ name: 'ซ', classId: 'hunter', jobLevel: 20, skills: { arch_quick: 3, arch_poison: 3, arch_t_bond: 5 } });
  assert.equal(h.petBiteMul, 1.2, 'สายใยคู่หู Lv.5: the dog bites 20% harder');
  const d = new Character({ name: 'ฌ', classId: 'herbalist', jobLevel: 20, skills: { heal_vine: 3, heal_mist: 3, heal_t_recipe: 4 } });
  assert.equal(d.healPow, 1.1, 'ตำรับโอสถ Lv.4: heals 10% stronger');
  // a saved passive without its line is dropped like any skill
  const o = new Character({ name: 'ญ', classId: 'shaman', jobLevel: 20, skills: { mage_akom: 1, mage_t_fire: 3 } });
  assert.equal(o.skillLevel('mage_t_fire'), 0);
});
