import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Character } from '../src/character/Character.js';
import { QuestSystem } from '../src/quest/QuestSystem.js';
import { newcomerJourney, newcomerDestination } from '../src/quest/newcomerJourney.js';
import { QUESTS, NEWCOMER_QUESTS } from '../src/data/quests.js';
import { NEWCOMER_GUIDE } from '../src/data/newcomer-guide.js';
import { NPCS } from '../src/data/npcs.js';
import { SPOT_SITES } from '../src/data/shopSites.js';
import { questsFor } from '../server/progress.js';
import { applyQuestOp } from '../server/class-quests.js';
import { Combatants } from '../server/combatants.js';
import { MONSTERS } from '../src/combat/data/monsters.js';
import { ITEMS } from '../src/character/data/items.js';

export function questSite(id) {
  const npc = NPCS.find(n => n.id === id);
  for (const activity of Object.values(npc?.schedule ?? {})) {
    const at = activity.at;
    if (at && typeof at === 'object') return { map: npc.map ?? 'city', x: at.x, z: at.z };
    if (typeof at === 'string' && SPOT_SITES[at]) { const [map,x,z] = SPOT_SITES[at]; return {map,x,z}; }
  }
  throw Error(`No authoritative site for ${id}`);
}
const hero = classId => new Character({name:'Newcomer',classId,level:20,jobLevel:12});

test('newcomer content references real all-day contacts, objective targets, rewards and supported panels', () => {
  const ids=new Set(QUESTS.map(q=>q.id));
  for(const q of NEWCOMER_QUESTS) {
    for(const id of [q.giver,q.turnIn??q.giver,...q.objectives.filter(o=>o.talk).map(o=>o.talk)]) {
      const n=NPCS.find(n=>n.id===id);assert.ok(n,id);
      for(const phase of ['morning','day','evening','night'])assert.equal(n.schedule[phase]?.do,'stay',`${id} ${phase}`);
    }
    for(const id of q.requires??[])assert.ok(ids.has(id));
    for(const o of q.objectives){if(o.kill)assert.ok(MONSTERS[o.kill]);if(o.collect)assert.ok(ITEMS[o.collect]);}
    for(const [id] of q.rewards.items)assert.ok(ITEMS[id]&&!ITEMS[id].retired);
  }
  for(const step of NEWCOMER_GUIDE) {
    for(const id of step.questIds)assert.ok(ids.has(id));
    for(const a of step.actions)assert.ok(['quests','bag','sheet','skills','map','bestiary'].includes(a.panel));
  }
});

test('guest shared chain counts accepted kills/talks, consumes materials, pays once and reloads', () => {
  let saved = '{}'; const storage = {getItem:()=>saved,setItem:(_,value)=>{saved=value;}};
  const c = hero('shaman'), q = new QuestSystem(QUESTS,{storage}); q.attach(c,null);
  for (const def of NEWCOMER_QUESTS) {
    for (const o of def.objectives) { if(o.talk) q.onTalk(o.talk); if(o.kill) q.onKill(o.kill); }
    assert.equal(q.status(def.id),'none'); assert.ok(q.accept(def.id));
    assert.deepEqual(q.state[def.id].kills,{}); assert.deepEqual(q.state[def.id].talked,[]);
    for(const o of def.objectives) {
      if(o.talk)q.onTalk(o.talk);
      if(o.kill)for(let i=0;i<o.count+2;i++)q.onKill(o.kill);
      if(o.collect)c.addItem(o.collect,o.count);
    }
    assert.ok(q.isComplete(def.id)); const before=c.gold;
    assert.ok(q.complete(def.id)); assert.equal(c.gold,before+def.rewards.gold);
    const after=c.toJSON(); assert.equal(q.complete(def.id),false); assert.deepEqual(c.toJSON(),after);
  }
  const restored=new QuestSystem(QUESTS,{storage});restored.attach(c,null);
  assert.ok(NEWCOMER_QUESTS.every(d=>restored.status(d.id)==='done'));
});

test('shared authoritative operations reject forged counters and wrong proximity across all classes', () => {
  const first=NEWCOMER_QUESTS[0];
  for(const cls of ['muaythai','warrior','hunter','shaman','herbalist','assassin']) {
    const c=hero(cls),q=questsFor(c),site=questSite(first.giver);
    assert.equal(applyQuestOp(c,{op:'quest_accept',id:first.id,x:site.x,z:site.z},q,{...site,x:site.x+100}),false);
    assert.ok(applyQuestOp(c,{op:'quest_accept',id:first.id,kills:{crab:999}},q,site));
    const before=c.gold;
    assert.equal(applyQuestOp(c,{op:'quest_complete',id:first.id,talked:first.objectives.map(o=>o.talk)},q,questSite(q.turnInOf(first))),false);
    assert.equal(c.gold,before);
    for(const o of first.objectives)if(o.talk)assert.ok(applyQuestOp(c,{op:'talk',npc:o.talk},q,questSite(o.talk)));
    assert.ok(applyQuestOp(c,{op:'quest_complete',id:first.id,rewards:{gold:999999}},q,questSite(q.turnInOf(first))));
    assert.equal(c.gold,before+first.rewards.gold);
  }
});

test('server kill reward updates shared objectives only after acceptance and persists progress', () => {
  const cs=new Combatants();cs.load(1,hero('warrior').toJSON(),{account:'newcomer',slot:0});
  const s=cs.get(1),def=NEWCOMER_QUESTS.find(q=>q.objectives.some(o=>o.kill)),kill=def.objectives.find(o=>o.kill);
  cs.reward(1,{type:kill.kill,exp:0,gold:0,items:[]});assert.equal(s.quests.status(def.id),'none');
  for(const id of def.requires)s.quests.state[id]={status:'done'};
  assert.ok(s.quests.accept(def.id));
  cs.reward(1,{type:kill.kill,exp:0,gold:0,items:[]});
  assert.equal(s.quests.objectiveProgress(def,kill).have,1);
  const reload=questsFor(s.c,s.quests.json());assert.equal(reload.objectiveProgress(def,kill).have,1);
});

test('journal recommends unfinished shared entry on old saves and resolves own class lessons', () => {
  const c=hero('warrior'),q=questsFor(c);
  c.jobLevel=2;
  q.state.class_warrior_intro={status:'done'};
  assert.equal(newcomerJourney(q,NEWCOMER_GUIDE).quest.id,NEWCOMER_QUESTS[0].id);
  for(const d of NEWCOMER_QUESTS)q.state[d.id]={status:'done'};
  c.jobLevel=12;
  assert.equal(newcomerJourney(q,NEWCOMER_GUIDE).quest.id,'class_warrior_advanced');
  assert.equal(newcomerDestination(q,NEWCOMER_GUIDE).npcId,'master_sword');
  assert.equal(newcomerDestination(q,NEWCOMER_GUIDE).map,'city');
  assert.equal(q.status('class_warrior_intro'),'done');
  q.state.class_warrior_advanced={status:'done'};
  assert.equal(newcomerJourney(q,NEWCOMER_GUIDE).milestones.find(s=>s.classStage==='advanced').done,true);
});
