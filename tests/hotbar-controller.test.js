import {useAutoFlask} from '../src/character/ui/autoFlasks.js';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {bindingController} from '../src/character/ui/hotbarController.js';
import {instanceQuality} from '../src/character/itemPresentation.js';
import {ITEMS} from '../src/character/data/items.js';

function fixture() {
  const casts=[], uses=[];
  const base={slots:[{id:'a',name:'A',cd:3},{id:'b',name:'B',cd:5}],cast:(i,q)=>{casts.push([i,q]);return true;},cooldown:i=>[i+1,5],usable:()=>true,active:i=>i===1,level:()=>2,busy:false};
  const c={hotbarBindings:[{kind:'skill',id:'b'},null,{kind:'item',id:'potion_s'},{kind:'skill',id:'b'}],inventory:[null,{id:'potion_s',qty:2}],alive:true,count:id=>c.inventory.filter(s=>s?.id===id).reduce((n,s)=>n+s.qty,0),useAt:i=>{uses.push(i);return true;}};
  return {c,base,casts,uses,ctl:bindingController(base,c)};
}
test('typed hotbar resolves skill IDs to base indexes, shares cooldown for duplicates',()=>{
 const {ctl,casts}=fixture(); assert.equal(ctl.slots[0].name,'B');assert.equal(ctl.cast(0),true);assert.deepEqual(casts,[[1,false]]);assert.deepEqual(ctl.cooldown(0),ctl.cooldown(3));assert.equal(ctl.active(3),true);assert.equal(ctl.usable(1),false);assert.equal(ctl.cast(1),false);
});
test('items resolve after bag rearrangement and never cast through AUTO',()=>{
 const {ctl,c,uses}=fixture();assert.equal(ctl.cast(2,true),false);assert.deepEqual(uses,[]);assert.equal(ctl.cast(2),true);assert.deepEqual(uses,[1]);c.inventory=[{id:'potion_s',qty:1},null];assert.equal(ctl.cast(2),true);assert.deepEqual(uses,[1,0]);c.inventory=[];assert.equal(ctl.cast(2),false);assert.equal(ctl.usable(2),false);
});
test('flask presentation reports instance charges, tier and recovery',()=>{
 const id='flask_hp_1',d=ITEMS[id];assert.match(instanceQuality({id,flask:{charges:10}}),new RegExp(`10/${d.flask.maxCharges}`));assert.match(instanceQuality({id,flask:{charges:10}}),/ขั้น 1/);
});

test('AUTO falls through unavailable HP flask to low MP and reports only successful recovery',()=>{
  const calls=[],c={alive:true,hp:10,maxHp:100,mp:5,maxMp:100,useFlask:kind=>{calls.push(kind);return kind==='mp';}};
  const cfg={hpPotion:70,mpPotion:50};
  assert.equal(useAutoFlask(c,cfg),'mp');assert.deepEqual(calls,['hp','mp']);
  calls.length=0;c.useFlask=kind=>{calls.push(kind);return false;};
  assert.equal(useAutoFlask(c,cfg),null);assert.deepEqual(calls,['hp','mp']);
  calls.length=0;c.useFlask=kind=>{calls.push(kind);return true;};
  assert.equal(useAutoFlask(c,cfg),'hp');assert.deepEqual(calls,['hp']);
});
test('AUTO flask recovery respects disabled thresholds, healthy MP and dead characters',()=>{
  const calls=[],c={alive:true,hp:10,maxHp:100,mp:60,maxMp:100,useFlask:kind=>{calls.push(kind);return false;}};
  assert.equal(useAutoFlask(c,{hpPotion:70,mpPotion:50}),null);assert.deepEqual(calls,['hp']);
  calls.length=0;assert.equal(useAutoFlask(c,{hpPotion:0,mpPotion:0}),null);assert.deepEqual(calls,[]);
  c.alive=false;assert.equal(useAutoFlask(c,{hpPotion:70,mpPotion:70}),null);assert.deepEqual(calls,[]);
});
