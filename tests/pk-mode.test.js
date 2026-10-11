import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Pvp} from '../server/pvp.js';
import {PkMode} from '../src/net/PkMode.js';
import {KARMA} from '../src/data/karma.js';
const hero=(id,extra={})=>({id,lv:KARMA.freeLevel,signed:true,map:'paddy',room:'paddy',x:id,z:-130,...extra});

test('PK attacker intent defaults OFF; enabling never requires victim consent or shields victim',()=>{
  const p=new Pvp(),a=hero(1),b=hero(2);
  assert.equal(p.view(1).mode,false);assert.equal(p.canAttack(a,b),'mode');
  assert.equal(p.setMode(a,true),null);assert.equal(p.view(2).mode,false);
  assert.equal(p.canAttack(a,b),null);assert.equal(p.canAttack(b,a),'mode');
  assert.equal(p.open(b),true);assert.equal(p.setMode(a,false),null);assert.equal(p.open(a),true);
  assert.equal(p.canAttack(a,b),'mode');
});

test('PK enabling keeps safe, guest, level, death, trade and duel restrictions server-owned',()=>{
  const p=new Pvp(),a=hero(1),b=hero(2);
  for(const [extra,why]of [[{signed:false},'guest'],[{map:'city'},'safe'],[{lv:KARMA.freeLevel-1},'level'],[{dead:true},'dead'],[{trade:true},'busy']]){
    assert.equal(p.setMode(hero(1,extra),true),why);assert.equal(p.view(1).mode,false);
  }
  assert.equal(p.setMode(a,'true'),'invalid');assert.equal(p.request(a,b),null);assert.ok(p.accept(b,a).duel);
  assert.equal(p.setMode(a,true),'busy');assert.equal(p.canAttack(a,b),null,'accepted duel works with both modes OFF');
});

test('OFF victim may enable for self-defence while combat lock prevents disabling; travel/rejoin reset',()=>{
  let now=0;const p=new Pvp({now:()=>now}),a=hero(1),b=hero(2);
  p.setMode(a,true);p.touch(1,2);
  assert.equal(p.setMode({...b,busy:true},true),null,'incoming attacks must not prevent enabling');
  assert.equal(p.canAttack(b,a),null);assert.equal(p.setMode(a,false),'busy');assert.equal(p.view(1).mode,true);
  now=10;assert.equal(p.setMode(a,false),null);p.setMode(a,true);p.resetMode(1);
  assert.equal(p.view(1).mode,false);p.setMode(a,true);p.leave(1);assert.equal(p.view(1).mode,false);
});

test('client PK only changes from confirmation; pending timeout queries unknown state, reconnect resets',()=>{
  const p=new PkMode();assert.equal(p.request(),null);p.reset(true);assert.equal(p.request(),null);
  p.sync(false);assert.equal(p.request(),true);assert.equal(p.on,false);assert.equal(p.request(),null);
  p.sync(false);assert.equal(p.pending,false,'server refusal preserves OFF');
  p.request();assert.equal(p.update(4.9),false);assert.equal(p.update(.1),true);
  assert.equal(p.known,false);assert.equal(p.request(),null);p.sync(true);assert.equal(p.on,true);
  assert.equal(p.request(),false);assert.equal(p.on,true,'OFF request is not applied optimistically');
  p.reset(false);assert.equal(p.on,false);assert.equal(p.pending,false);assert.equal(p.online,false);
});
