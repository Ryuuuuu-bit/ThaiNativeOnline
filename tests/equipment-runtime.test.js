import test from 'node:test';
import assert from 'node:assert/strict';
import { Character } from '../src/character/Character.js';
import { createFlask, instanceId } from '../src/character/data/flasks.js';
import { applyOp, fromSave, reconcileSave } from '../server/progress.js';
import { Combatants } from '../server/combatants.js';
import { cleanOffer, swap } from '../server/trades.js';
import { planStashMove, stashIdentity, emptyStash } from '../src/data/stash.js';
import { SHOP_SITES } from '../src/data/shopSites.js';
import { locateAutoTarget } from '../server/autoTargets.js';
import { pickTarget, normalizeAuto, castOrder } from '../src/ui/autoSettings.js';
import { ACTIONS } from '../src/core/InputManager.js';
import { MONSTERS } from '../src/combat/data/monsters.js';
import { rollLootDrops, keptLootDrops } from '../src/combat/lootDrops.js';

const char = () => new Character({ name: 'ทดสอบ', classId: 'muaythai', level: 20, inventory: Array(60).fill(null), flaskVersion: 1 });
const uuid = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const flask = (n, charges = 20) => ({ ...createFlask('flask_hp_1', { uuid: () => uuid(n) }), flask: { v: 1, iid: uuid(n), charges } });

test('server uses owned flask identity and ignores client charge/recovery claims', () => {
  const c = char(); c.addInstance(flask(1)); c.addInstance(flask(2, 3));
  assert.equal(applyOp(c, {op:'flask_equip',iid:uuid(9)}), false);
  assert.equal(applyOp(c, {op:'flask_equip',iid:uuid(2),flask:{charges:999}}), true);
  assert.equal(c.flasks.hp.flask.charges, 3);
  c.hp = 1; assert.equal(applyOp(c,{op:'flask_use',kind:'hp',charges:999}),false);
  assert.equal(applyOp(c,{op:'flask_unequip',kind:'hp',iid:uuid(1)}),false);
  assert.equal(applyOp(c,{op:'flask_unequip',kind:'hp',iid:uuid(2)}),true);
});
test('refill only at city herbalist using actual server position, no save refill', () => {
  const cs = new Combatants({now:()=>100}); const c = char(); c.flasks.hp = flask(3,0);
  cs.load('p',c.toJSON(),{account:'a',slot:0});
  assert.equal(cs.op('p',{op:'flask_refill',map:'city'}, {map:'paddy',x:10.3,z:65}),false);
  assert.equal(cs.op('p',{op:'flask_refill'}, {map:'city',x:500,z:500}),false);
  assert.equal(cs.op('p',{op:'flask_refill'},SHOP_SITES.herbalist.find(site=>site.map==='city')),true);
  const owned = cs.get('p').c; assert.equal(owned.flasks.hp.flask.charges,40);
  owned.flasks.hp.flask.charges=7;
  assert.equal(fromSave(owned.toJSON()).flasks.hp.flask.charges,7);
  const data = {'tno.character.v1':JSON.stringify({...owned.toJSON(),flasks:{hp:flask(3,40)}})};
  assert.equal(JSON.parse(reconcileSave(data,owned.toJSON())['tno.character.v1']).flasks.hp.flask.charges,7);
});
test('credited kill fills worn flask exactly once per reward and bounded by capacity', () => {
  const cs = new Combatants(); const c = char(); c.flasks.hp=flask(4,0);
  cs.load('p',c.toJSON(),{account:'a',slot:0});
  for (const [type,def] of Object.entries(MONSTERS).filter(([,d])=>d.boss).slice(0,5)) cs.reward('p',{type,gold:0,exp:0,drops:[]});
  assert.equal(cs.get('p').c.flasks.hp.flask.charges,40);
});
test('trade preserves exact flask charge state and requires iid', () => {
  const a=char(),b=char(); a.addInstance(flask(5,11)); a.addInstance(flask(6,1));
  assert.equal(swap(a,b,cleanOffer({items:[{id:'flask_hp_1',qty:1}],gold:0}),{items:[],gold:0}).ok,false);
  assert.equal(swap(a,b,cleanOffer({items:[{id:'flask_hp_1',qty:1,iid:uuid(5),flask:{charges:40}}],gold:0}),{items:[],gold:0}).ok,true);
  assert.equal(b.inventory.find(s=>instanceId(s)===uuid(5)).flask.charges,11);
  assert.equal(a.inventory.find(s=>instanceId(s)===uuid(6)).flask.charges,1);
});
test('stash never stacks flask instances and preserves charges through withdrawal', () => {
  const c=char();c.addInstance(flask(7,2));const vault=emptyStash();
  const deposit=planStashMove(c.toJSON(),vault,{revision:0,action:'deposit',index:0,qty:1,expected:stashIdentity(c.inventory[0])},()=> 'stored_flask');
  assert.equal(deposit.ok,true);assert.equal(deposit.stash.slots[0].flask.charges,2);
  const withdraw=planStashMove({...c.toJSON(),inventory:deposit.inventory},deposit.stash,{revision:1,action:'withdraw',qty:1,uid:'stored_flask'},()=> 'unused');
  assert.equal(withdraw.ok,true);assert.equal(withdraw.inventory.find(s=>instanceId(s)===uuid(7)).flask.charges,2);
  assert.equal(planStashMove(c.toJSON(),vault,{revision:0,action:'deposit',index:0,qty:1,expected:{...stashIdentity(c.inventory[0]),iid:uuid(9)}},()=> 'stored_flask').ok,false);
});
test('whole map locator accepts actual world and excludes dead/unreachable candidates', () => {
  const world={monsters:[{id:1,x:2,z:0,hp:0,state:'dead'},{id:2,x:200,z:0,hp:10,state:'idle',def:{}},{id:3,x:10,z:0,hp:10,state:'idle',def:{}}],info:m=>({id:m.id})};
  assert.deepEqual(locateAutoTarget(world,{id:'p',x:0,z:0},{exclude:[3]}),{id:2});
  assert.equal(locateAutoTarget(world,{id:'p',x:0,z:0,dead:true}),null);
  const target={alive:true,state:'idle',x:8,z:0,map:'paddy'};
  assert.equal(pickTarget([target],{x:0,z:0,map:'paddy'},normalizeAuto({range:'near'}),target),null);
  assert.equal(pickTarget([target],{x:0,z:0,map:'city'},normalizeAuto({range:'map'})),null);
  assert.deepEqual(castOrder([null,{type:'item'},{type:'skill'}],normalizeAuto(),1),[2]);
  assert.equal(ACTIONS.KeyE,undefined);assert.equal(ACTIONS.KeyR,undefined);assert.equal(ACTIONS.KeyF,'interact');assert.equal(ACTIONS.Home,'resetCamera');
});
test('boss bonus flask roll is capped at one with authentic state; lost filtering uses iid', () => {
  const [type,def]=Object.entries(MONSTERS).find(([,d])=>d.boss);let n=20;
  const drops=rollLootDrops({...def,type},{random:()=>0,uuid:()=>uuid(++n)});
  const fs=drops.filter(d=>d.flask);assert.equal(fs.length,1);assert.equal(fs[0].flask.charges,50);
  assert.equal(keptLootDrops([flask(30),flask(31)],[flask(30)]).length,1);
  assert.equal(instanceId(keptLootDrops([flask(30),flask(31)],[flask(30)])[0]),uuid(31));
});
