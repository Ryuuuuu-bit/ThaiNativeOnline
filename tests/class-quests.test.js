import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Character } from '../src/character/Character.js';
import { Emitter } from '../src/character/Emitter.js';
import { CLASSES } from '../src/character/data/classes.js';
import { KIT_SKILL_IDS } from '../src/character/data/kits.js';
import { ITEMS } from '../src/character/data/items.js';
import { MASTERIES, cleanMasteries, masteryBonus } from '../src/character/data/masteries.js';
import { CLASS_QUESTS, CLASS_MASTERS } from '../src/data/quests.js';
import { HUNTING_GROUNDS } from '../src/data/hunting.js';
import { SHOP_SITES, SHOP_RANGE } from '../src/data/shopSites.js';
import { MONSTERS } from '../src/combat/data/monsters.js';
import { Combat } from '../src/combat/Combat.js';
import { LOOT } from '../src/combat/data/loot.js';
import { QuestSystem } from '../src/quest/QuestSystem.js';
import { describeObjective, requirementText, rewardText, lockedReason, escapeQuestText } from '../src/quest/questPresentation.js';
import { CLASS_MASTER_SITES, nearQuestNpc, applyQuestOp, reconcileQuestMasteries, recordQuestCast, recordQuestSkillHit } from '../server/class-quests.js';
import { Combatants } from '../server/combatants.js';
import { MonsterWorld } from '../server/monsters.js';
import { questsFor, applyOp, reconcileSave } from '../server/progress.js';

const hero = (classId = 'warrior', opts = {}) => new Character({ name:'ClassQuestTest', classId, level:20, jobLevel:12, ...opts });
const quest = (classId, stage) => CLASS_QUESTS.find(q => q.classId === classId && q.stage === stage);
const system = (c, opts = {}) => { const q = new QuestSystem(CLASS_QUESTS, { storage:null, ...opts }); q.attach(c, null); return q; };
const doneIntro = (q, cls) => { q.state[quest(cls, 'intro').id] = { status:'done' }; };
const talkSite = npc => Object.values(SHOP_SITES).flat().find(s => s.npc === npc);
const satisfy = (q, def, c) => {
  for (const o of def.objectives) {
    if (o.kill) for (let i = 0; i < o.count; i++) q.onKill(o.kill);
    if (o.talk) q.onTalk(o.talk);
    if (o.collect) c.addItem(o.collect, o.count + 1);
    if (o.practice) for (let i = 0; i < o.count; i++) q.onPracticeCast(o.practice[0]);
    if (o.combo) { q.onVerifiedSkillHit(o.combo.skills[0], 100); q.onVerifiedSkillHit(o.combo.skills[1], 101); }
  }
};

test('all six lessons are reachable ordinary hunts with real materials and attainable training skills', () => {
  assert.equal(CLASS_QUESTS.length, 12);
  assert.equal(new Set(CLASS_QUESTS.map(q => q.id)).size, 12);
  for (const cls of Object.keys(CLASSES)) {
    const intro = quest(cls, 'intro'), advanced = quest(cls, 'advanced');
    assert.ok(intro && advanced);
    for (const q of [intro, advanced]) {
      const target = q.objectives.find(o => o.kill).kill;
      assert.ok(MONSTERS[target].level <= q.minLevel);
      assert.ok(!MONSTERS[target].boss && !MONSTERS[target].elite);
      assert.ok(HUNTING_GROUNDS.some(h => h.roster.some(r => r.type === target)), `${target} has a real hunt`);
      const material = q.objectives.find(o => o.collect).collect;
      assert.ok(LOOT[MONSTERS[target].loot].some(([id, chance]) => id === material && chance > 0), `${material} drops from the ordinary target`);
      for (const [id] of q.rewards.items) assert.ok(ITEMS[id] && !ITEMS[id].retired);
    }
    if (cls !== 'assassin') {
      const c = hero(cls), [root, follow] = advanced.objectives.find(o => o.combo).combo.skills;
      assert.equal(c.skillLevel(root), 1);
      const { req } = c.skillReqs(follow);
      while (c.skillLevel(root) < req[root]) assert.ok(c.learnSkill(root));
      assert.ok(c.learnSkill(follow), `${cls}: follow-up fits advanced Job 12`);
    }
  }
});

test('class, base/job floor and prerequisite protect acceptance and hand-in; other classes are hidden', () => {
  for (const cls of Object.keys(CLASSES)) {
    const c = hero(cls, { level:4, jobLevel:2 }), q = system(c), intro = quest(cls, 'intro'), advanced = quest(cls, 'advanced');
    assert.equal(q.accept(intro.id), false);
    c.level = 5; assert.equal(q.accept(intro.id), false, 'job floor still applies');
    c.jobLevel = 3; assert.equal(q.accept(intro.id), true);
    assert.equal(q.accept(advanced.id), false);
    for (const other of Object.keys(CLASSES).filter(k => k !== cls)) {
      assert.deepEqual(q.offers(CLASS_MASTERS[other]), []); assert.deepEqual(q.locked(CLASS_MASTERS[other]), []);
      assert.equal(q.accept(quest(other, 'intro').id), false);
      q.state[quest(other, 'advanced').id] = { status:'active', kills:{}, talked:[] };
      assert.equal(q.complete(quest(other, 'advanced').id), false);
    }
    assert.equal(q.isComplete('unknown'), false);
    doneIntro(q, cls); c.level = 20; c.jobLevel = 11; assert.equal(q.accept(advanced.id), false);
    c.jobLevel = 12; assert.equal(q.accept(advanced.id), true);
  }
});

for (const cls of Object.keys(CLASSES)) test(`${cls}: introduction and advanced rewards consume exact materials and pay once`, () => {
  const c = hero(cls), q = system(c), intro = quest(cls, 'intro'), advanced = quest(cls, 'advanced');
  const skills = structuredClone(c.skills);
  q.onKill(intro.objectives.find(o => o.kill).kill); q.onTalk(intro.objectives.find(o => o.talk).talk);
  assert.equal(q.accept(intro.id), true);
  assert.equal(q.objectiveProgress(intro, intro.objectives.find(o => o.kill)).have, 0, 'old kills are not credited');
  assert.equal(q.complete(intro.id), false);
  satisfy(q, intro, c); assert.equal(q.complete(intro.id), true); assert.equal(q.complete(intro.id), false);
  const mat = intro.objectives.find(o => o.collect).collect;
  assert.equal(c.count(mat), 1); assert.deepEqual(c.masteries, {});
  assert.equal(q.accept(advanced.id), true); satisfy(q, advanced, c);
  const before = structuredClone(c.toJSON()); assert.equal(q.complete(advanced.id), true);
  assert.equal(c.gold, before.gold + 350); assert.equal(c.count('potion_m'), (before.inventory.find(s => s?.id === 'potion_m')?.qty ?? 0) + 3);
  assert.deepEqual(c.masteries, { [`school_${cls}`]:true });
  const paid = c.toJSON(); assert.equal(q.complete(advanced.id), false); assert.deepEqual(c.toJSON(), paid);
  assert.deepEqual(c.skills, skills, 'existing skills are not gated or changed');
  const restored = questsFor(new Character(c.toJSON()), JSON.stringify(q.state));
  assert.equal(restored.status(advanced.id), 'done'); assert.equal(restored.complete(advanced.id), false);
});

test('invalid mastery bindings pay nothing; unknown/cross-class/non-boolean flags add no bonus', () => {
  const c = hero('warrior');
  for (const id of ['school_hunter', 'fake', '__proto__']) {
    const def = { ...quest('warrior','advanced'), objectives:[], rewards:{gold:999, mastery:id} };
    const q = new QuestSystem([def], {storage:null}); q.attach(c,null); q.state[def.requires[0]] = {status:'done'};
    assert.equal(q.accept(def.id), true); const before = c.toJSON(); assert.equal(q.complete(def.id), false); assert.deepEqual(c.toJSON(), before);
  }
  assert.deepEqual(cleanMasteries('warrior', { school_warrior:true, school_hunter:true, unknown:true }), { school_warrior:true });
  for (const input of [[], null, { school_warrior:1 }, Object.create({school_warrior:true})]) assert.deepEqual(masteryBonus('warrior',input), {});
  assert.deepEqual(masteryBonus('warrior', {school_warrior:true}), {hp:30});
  for (const cls of Object.keys(CLASSES)) {
    const bonus = masteryBonus(cls, Object.fromEntries(Object.keys(MASTERIES).map(id => [id,true])));
    assert.equal(Object.keys(bonus).length,1); assert.ok(Object.values(bonus)[0] <= 30);
  }
});

test('locked hand-in materials and whole reward baskets cannot destroy items or pay partial rewards', () => {
  const c = hero(), q = system(c), def = quest('warrior','intro');
  assert.ok(q.accept(def.id)); satisfy(q,def,c);
  c.inventory.find(s => s?.id === 'ash').locked = true;
  const locked = c.toJSON(); assert.equal(q.complete(def.id),false); assert.deepEqual(c.toJSON(),locked);
  c.inventory.find(s => s?.id === 'ash').locked = false;
  // No potion/ether stack exists. Both individually fit one empty slot, together neither can be lost.
  c.inventory = Array.from({length:24}, (_,i) => i === 23 ? null : {id:'ash',qty:1});
  const full = c.toJSON(); assert.equal(q.complete(def.id),false); assert.deepEqual(c.toJSON(),full);
  c.inventory[22] = null; assert.equal(q.complete(def.id),true);
  assert.equal(c.count('potion_s'),3); assert.equal(c.count('ether'),1);
});

test('online prediction defers grants and drills; local guests use validated non-dummy class events', () => {
  const c = hero(), q = system(c,{deferMastery:true}), def = quest('warrior','advanced');
  doneIntro(q,'warrior'); q.accept(def.id); satisfy(q,def,c); assert.ok(q.complete(def.id)); assert.deepEqual(c.masteries,{});
  const guest = hero(), combat = new Emitter(); combat.combatTimer = 6;
  const local = new QuestSystem(CLASS_QUESTS,{storage:null}); local.attach(guest,combat);
  const intro = quest('warrior','intro'); local.accept(intro.id);
  combat.emit('kit-fx',{id:'sword_twin'}); assert.equal(local.state[intro.id].casts.sword_twin,undefined, 'dummy visual event has no credit');
  combat.emit('kit-cast',{id:'sword_twin'}); assert.equal(local.state[intro.id].casts.sword_twin,1);
  local.deferPractice = true; combat.emit('kit-cast',{id:'sword_twin'}); assert.equal(local.state[intro.id].casts.sword_twin,1);
});

test('NPC authority rejects forged locations/counts/rewards, wrong map, far/dead and unknown ids', () => {
  const c = hero(), q = system(c), def = quest('warrior','intro'), site = CLASS_MASTER_SITES[def.giver];
  assert.ok(nearQuestNpc(def.giver,site)); assert.ok(!nearQuestNpc(def.giver,{...site,x:site.x+SHOP_RANGE+.01}));
  for (const at of [null,{...site,map:'klong'},{...site,x:NaN},{...site,z:site.z+SHOP_RANGE+1}]) {
    assert.equal(applyQuestOp(c,{op:'quest_accept',id:def.id,map:site.map,x:site.x,z:site.z},q,at),false);
  }
  assert.equal(applyQuestOp(c,{op:'quest_accept',id:'constructor'},q,site),false);
  assert.equal(applyQuestOp(c,{op:'quest_accept',id:def.id,progress:{kills:{phibpa:999}},rewards:{mastery:'school_warrior'}},q,site),true);
  assert.equal(applyQuestOp(c,{op:'quest_complete',id:def.id,kills:999,casts:999,combo:{done:true}},q,site),false);
  assert.deepEqual(q.state[def.id].kills,{}); assert.deepEqual(c.masteries,{});
  const talk = def.objectives.find(o => o.talk).talk, at = talkSite(talk);
  assert.ok(at); assert.equal(applyQuestOp(c,{op:'talk',npc:talk},q,site),false);
  assert.equal(applyQuestOp(c,{op:'talk',npc:talk},q,at),true);
  assert.equal(applyQuestOp(c,{op:'talk',npc:'__proto__'},q,at),false);
  c.hp = 0; assert.equal(applyQuestOp(c,{op:'talk',npc:talk},q,at),false);
  for (const op of ['quest_kill','quest_cast','quest_hit','mastery_grant']) {
    assert.equal(applyQuestOp(c,{op},q,site),null); assert.equal(applyOp(c,{op},q,site),false);
  }
});

test('server completion reconciliation removes forged flags and backfills only matching earned lessons', () => {
  const c = hero(), q = system(c), def = quest('warrior','advanced');
  c.masteries = {school_warrior:true,school_hunter:true,unknown:true};
  assert.ok(reconcileQuestMasteries(c,q)); assert.deepEqual(c.masteries,{});
  doneIntro(q,'warrior'); q.state[def.id] = {status:'active'}; reconcileQuestMasteries(c,q); assert.deepEqual(c.masteries,{});
  q.state[def.id].status = 'done'; assert.ok(reconcileQuestMasteries(c,q)); assert.deepEqual(c.masteries,{school_warrior:true});
  assert.equal(reconcileQuestMasteries(c,q),false);
  const sent = {'tno.character.v1':JSON.stringify({...c.toJSON(),masteries:{school_hunter:true,unknown:true}}),'tno.quests.v1':'{"forged":{"status":"done"}}'};
  const saved = reconcileSave(sent,c.toJSON(),JSON.stringify(q.state));
  assert.deepEqual(JSON.parse(saved['tno.character.v1']).masteries,{school_warrior:true}); assert.equal(saved['tno.quests.v1'],JSON.stringify(q.state));
  assert.deepEqual(JSON.parse(reconcileSave(sent,null)['tno.character.v1']).masteries,{});
});

test('server kill rewards and accepted casts count; unlearned, failed, outside-combat and replayed casts do not', () => {
  let now = 100; const cs = new Combatants({now:()=>now}); cs.load(1,hero().toJSON(),{account:'quest-unit',slot:0});
  const s = cs.get(1), q = s.quests, def = quest('warrior','intro');
  assert.ok(applyQuestOp(s.c,{op:'quest_accept',id:def.id},q,CLASS_MASTER_SITES[def.giver]));
  assert.equal(cs.cast(1,'sword_twin').ok,true); assert.equal(recordQuestCast(cs,1,'sword_twin',now),false, 'must be fighting already');
  cs.touch(1); assert.equal(cs.cast(1,'sword_thrust').why,'not_learnt'); assert.equal(cs.cast(1,'boxer_jab').why,'not_yours');
  const o = def.objectives.find(o => o.practice);
  assert.equal(q.objectiveProgress(def,o).have,0);
  now += 30; cs.touch(1); s.c.mp = 0; assert.equal(cs.cast(1,'sword_twin').why,'mp'); assert.equal(recordQuestCast(cs,1,'sword_twin',now),false);
  for (let i = 0; i < 3; i++) {
    now += 30; cs.touch(1); s.c.mp = s.c.maxMp;
    assert.equal(cs.cast(1,'sword_twin').ok,true); recordQuestCast(cs,1,'sword_twin',now);
    assert.equal(recordQuestCast(cs,1,'sword_twin',now),false,'same actual cast is counted once');
    assert.equal(cs.cast(1,'sword_twin').why,'cooldown');
  }
  assert.equal(q.objectiveProgress(def,o).have,3);
  cs.reward(1,{type:'phibpa',exp:0,gold:0,drops:[{id:'ash',qty:2}]});
  assert.equal(q.state[def.id].kills.phibpa,1); assert.equal(s.c.count('ash'),2);
});

test('actual server skill blows: once per cast, two different skills, live targets, misses and range gates', () => {
  let now = 100; const cs = new Combatants({now:()=>now,random:()=>.2});
  cs.load(1,hero('warrior',{skills:{sword_twin:3,sword_thrust:1}}).toJSON(),{account:'quest-hit',slot:0});
  const s = cs.get(1), q = s.quests, def = quest('warrior','advanced'); doneIntro(q,'warrior'); q.accept(def.id);
  const w = new MonsterWorld('test',{zones:[{type:'boar',x:1,z:0,radius:0,count:2}],random:()=>.2});
  for (const m of w.monsters) { w.spawn(m); m.maxHp = m.hp = 1e6; }
  const p = [{id:1,x:0,z:0}];
  const blow = (skill,target = w.monsters[0]) => cs.blow(1,w,p,{skill,id:target.id});
  assert.deepEqual(blow('sword_thrust'),[],'client hit without a cast is rejected');
  assert.ok(cs.cast(1,'sword_twin').ok);
  const cast = s.casts.at(-1);
  assert.equal(recordQuestSkillHit(cs,1,cast,{hp:1},{hit:false,dmg:100}),false);
  assert.equal(recordQuestSkillHit(cs,1,cast,{hp:1},{hit:true,dmg:0}),false);
  assert.equal(recordQuestSkillHit(cs,1,cast,{hp:0},{hit:true,dmg:100}),false);
  assert.ok(blow('sword_twin').some(e => e.t === 'mh' && e.amount > 0));
  const first = structuredClone(q.state[def.id].combo);
  blow('sword_twin'); assert.deepEqual(q.state[def.id].combo,first,'extra hits/AoE cannot refresh one cast');
  assert.equal(q.objectiveProgress(def,def.objectives.find(o => o.combo)).have,0);
  now += 1; s.c.mp = s.c.maxMp; assert.ok(cs.cast(1,'sword_thrust').ok);
  w.monsters[1].x = 100; assert.deepEqual(blow('sword_thrust',w.monsters[1]),[]); assert.equal(q.state[def.id].combo.done,false);
  w.monsters[1].x = 1; assert.ok(blow('sword_thrust',w.monsters[1]).some(e => e.t === 'mh' && e.amount > 0));
  assert.equal(q.state[def.id].combo.done,true,'different valid targets are allowed');
  assert.ok(s.dirty); assert.ok(s.questPracticeChanged);
});

test('offline guest combo witnesses actual production damage once per cast; remote/dummy/miss effects do not count', () => {
  const c = hero(), combat = new Combat(c, { playerPos: () => ({ x: 0, z: 0 }), canStand: () => true });
  const a = {hp:1000,get alive(){return this.hp>0;},def:MONSTERS.boar,x:1,z:0}, b = {hp:1000,get alive(){return this.hp>0;},def:MONSTERS.boar,x:2,z:0};
  Object.assign(combat,{character:c,remote:false,monsters:[a,b],combatTimer:6,aggro:()=>{},kill:()=>{}});
  const q = new QuestSystem(CLASS_QUESTS,{storage:null}); q.attach(c,combat);
  const def = quest('warrior','advanced'); doneIntro(q,'warrior'); q.accept(def.id);
  combat.emit('kit-fx',{id:'sword_twin'}); combat.damageMonster(a,10,{skill:'sword_twin'});
  assert.equal(q.state[def.id].combo,undefined,'visual cast without actual non-dummy release does not qualify');
  combat.emit('kit-cast',{id:'sword_twin'}); combat.damageMonster(a,0,{miss:true,skill:'sword_twin'});
  assert.equal(q.state[def.id].combo,undefined);
  combat.damageMonster(a,10,{skill:'sword_twin'}); const first = structuredClone(q.state[def.id].combo);
  combat.damageMonster(b,10,{skill:'sword_twin'}); assert.deepEqual(q.state[def.id].combo,first);
  combat.emit('kit-cast',{id:'sword_thrust'}); combat.remote = true; combat.damageMonster(b,10,{skill:'sword_thrust'});
  assert.equal(q.state[def.id].combo.done,false);
  combat.remote = false; combat.damageMonster(b,10,{skill:'sword_thrust'}); assert.equal(q.state[def.id].combo.done,true);
});

test('combo timing requires distinct skills within 12 seconds and ignores backwards/invalid time', () => {
  const q = system(hero()), def = quest('warrior','advanced'); doneIntro(q,'warrior'); q.accept(def.id);
  assert.equal(q.onVerifiedSkillHit('boxer_jab',100),false);
  assert.equal(q.onVerifiedSkillHit('sword_twin',NaN),false);
  q.onVerifiedSkillHit('sword_twin',100); q.onVerifiedSkillHit('sword_twin',101); assert.equal(q.state[def.id].combo.done,false);
  assert.equal(q.onVerifiedSkillHit('sword_thrust',99),false);
  q.onVerifiedSkillHit('sword_thrust',113.01); assert.equal(q.state[def.id].combo.done,false,'previous hit expired');
  q.onVerifiedSkillHit('sword_twin',125.01); assert.equal(q.state[def.id].combo.done,true,'inclusive 12 second boundary');
});

test('beginners see real skill names, level/job/prerequisite and permanent reward text', () => {
  const c = hero('warrior',{level:1,jobLevel:1}), q = system(c), def = quest('warrior','advanced');
  const combo = describeObjective(def.objectives.find(o => o.combo));
  assert.match(combo,/ฟันดาบคู่.*แทงทะลวง.*12/);
  assert.match(requirementText(def,q.defs),/นักรบ.*Lv 20.*Job 12.*ดาบอาสา/);
  assert.match(lockedReason(def,q),/Lv 20.*Job 12.*ส่งเควส/);
  assert.match(rewardText(def.rewards),/วิชาสำนัก.*HP สูงสุด \+30.*ไม่ใช้แต้มสกิล/);
  assert.equal(escapeQuestText('<img title="x">'),'&lt;img title=&quot;x&quot;&gt;');
});
