import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Character } from '../src/character/Character.js';
import { QuestSystem } from '../src/quest/QuestSystem.js';
import { questObjective, questNpcDestination } from '../src/quest/questNavigation.js';
import { QuestNavigator } from '../src/quest/QuestNavigator.js';
import { BESTIARY } from '../src/data/bestiary.js';
import { MAPS } from '../src/world/maps.js';

function active(objectives) {
  const def = { id:'route-test', title:'Route', giver:'master_muay', objectives, rewards:{} };
  const quests = new QuestSystem([def], {storage:null});
  quests.attach(new Character({name:'Navigator',classId:'muaythai',level:20}),null);
  quests.state[def.id] = {status:'active',kills:{},talked:[]};
  return quests;
}
const city = {map:'city',phase:'day',position:{x:0,z:0}};
test('NPC routing uses live positions and indoor state, and respects class-master night schedules', () => {
  assert.equal(questNpcDestination('master_muay',{...city,phase:'night'}).destination, undefined);
  assert.ok(questNpcDestination('master_muay',city).destination);
  assert.ok(questNpcDestination('master_shaman',{...city,phase:'night'}).destination);
  const live = {id:'master_muay',x:123,z:456,indoors:false};
  assert.equal(questNpcDestination(live.id,{...city,npcs:[live]}).destination.x,123);
  assert.match(questNpcDestination(live.id,{...city,npcs:[{...live,indoors:true}]}).reason,/พัก/);
});
test('routing is read-only, switches unmet objective and then points to manual hand-in', () => {
  const q=active([{talk:'master_muay'},{kill:'fowl',count:2}]),before=JSON.stringify(q.state);
  assert.equal(questObjective(q,null,city).step.npcId,'master_muay');
  assert.equal(JSON.stringify(q.state),before);
  q.onTalk('master_muay'); const kill=questObjective(q,null,city);
  assert.equal(kill.destination.monsterId,'fowl'); assert.equal(kill.progress.have,0);
  assert.ok(kill.step.portalId); assert.equal(kill.step.map,'city'); assert.ok(kill.crossMap);
  q.onKill('fowl');q.onKill('fowl');
  const done=questObjective(q,null,city);assert.ok(done.complete);assert.equal(done.step.npcId,'master_muay');
  assert.equal(q.status('route-test'),'active');
});
test('supply routing uses real ordinary loot sources and only reachable phase-eligible maps', () => {
  for(const item of ['hide','ash','croc_scale']) for(const phase of ['day','night']) {
    const q=active([{collect:item,count:2}]),r=questObjective(q,null,{...city,phase});
    assert.ok(r.destination,`${item} ${phase}`);const m=BESTIARY.find(m=>m.id===r.destination.monsterId);
    assert.ok(!m.boss&&!m.elite);assert.ok(m.drops.some(d=>d.id===item&&d.chance>0));
    assert.ok(!MAPS[r.destination.map].nightOnly||phase==='night');assert.ok(r.step);
  }
});
test('collect progress excludes locked supplies and unknown/manual objectives never invent coordinates', () => {
  const q=active([{collect:'hide',count:2}]);q.character.addItem('hide',2);q.character.inventory.find(s=>s?.id==='hide').locked=true;
  assert.equal(questObjective(q,null,city).progress.have,0);
  for(const objective of [{practice:['boxer_jab'],count:2,hint:'ฝึกระหว่างต่อสู้'},{combo:{skills:['a','b'],seconds:12},count:2},{kill:'missing',count:1}]) {
    const r=questObjective(active([objective]),null,city);assert.ok(r.reason);assert.equal(r.step,undefined);
  }
});
function navigator() {
  let target={key:'q:active:0',step:{map:'city',x:10,z:20},reason:''},walks=0,stops=0,blocked=false;
  const nav=new QuestNavigator({resolve:()=>target,walk:()=>{walks++;return !blocked;},stop:()=>stops++});
  return {nav,set:value=>target=value,block:()=>blocked=true,counts:()=>({walks,stops}),tick:(extra={})=>nav.update({map:'city',alive:true,blocked:false,walking:true,position:{x:0,z:0},...extra})};
}
test('navigation is explicit, reports blocked paths and never starts from pin/update',()=>{
  const n=navigator();n.nav.pin('q');n.tick();assert.equal(n.counts().walks,0);
  n.block();assert.equal(n.nav.start(),false);assert.equal(n.nav.active,null);assert.match(n.nav.message,/กีดขวาง/);
});
test('walking cancels rather than resumes on map/death/modal/logout/untrack/manual/changed objective',()=>{
  for(const extra of [{map:'fields'},{alive:false},{blocked:true},{connected:false}]) {
    const n=navigator();assert.ok(n.nav.start());n.tick(extra);assert.equal(n.nav.active,null);assert.equal(n.counts().stops,1);n.tick();assert.equal(n.counts().walks,1);
  }
  for(const action of ['cancel','untrack']) {const n=navigator();n.nav.start();n.nav[action]();assert.equal(n.nav.active,null);assert.equal(n.counts().stops,1);}
  const n=navigator();n.nav.start();n.set({key:'q:active:1',step:{map:'city',x:10,z:20}});n.tick();assert.equal(n.nav.active,null);
});
test('stable objective keys still cancel when schedules, portal steps or destination availability change',()=>{
  for(const target of [{key:'q:active:0',reason:'NPC indoors'}, {key:'q:active:0',step:{map:'city',x:99,z:20}}, {key:'q:active:0',step:{map:'city',x:10,z:20,portalId:'new'}}]) {
    const n=navigator();n.nav.start();n.set(target);n.tick();assert.equal(n.nav.active,null);assert.match(n.nav.message,/เป้าหมายเปลี่ยน/);
  }
});
test('arrival stops locomotion without completing or continuing across a portal',()=>{
  const n=navigator();n.nav.start();n.tick({walking:false,position:{x:10,z:20}});assert.equal(n.nav.active,null);assert.match(n.nav.message,/ด้วยตนเอง/);assert.equal(n.counts().walks,1);
});
