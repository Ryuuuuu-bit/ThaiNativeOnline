import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NetFair, fairIsOpen } from '../src/fair/NetFair.js';
import { DICE_SYMBOLS, targetAt } from '../src/fair/fairRules.js';

function harness(sendOverride) {
  let clock=0, serial=0;
  const sent=[], context={hour:18,map:'city',online:true,authenticated:true};
  const net=new NetFair({context:()=>context,send:m=>{sent.push(m);return sendOverride?.(m);},
    uuid:()=>`00000000-0000-4000-8000-${String(++serial).padStart(12,'0')}`,now:()=>clock});
  const answer=(fields={})=>net.receive({t:'fair_result',request:net.pending?.request,ok:true,...fields});
  const round=(shots=0)=>({id:'opaque',game:'dolls',seed:123,stake:20,shots,shotIndex:shots,hits:0,elapsedMs:clock,remainingMs:20000-clock});
  return {net,sent,context,answer,round,tick:ms=>{clock+=ms;net.update(ms/1000);}};
}

test('fair UI boundaries use canonical hours and string dice symbols',()=>{
  for(const [hour,on]of [[16.499,false],[16.5,true],[23.9,true],[0,true],[4.999,true],[5,false],[24,false],[NaN,false]])assert.equal(fairIsOpen(hour),on);
  for(const symbol of DICE_SYMBOLS){const h=harness();assert.equal(h.net.start('dice','dice',50,symbol),true);assert.equal(h.sent[0].symbol,symbol);}
  assert.equal(harness().net.start('dice','dice',50,0),false);
});
test('confirmation sends one fresh request with no client score or clock',()=>{
  const h=harness();assert.ok(h.net.start('dolls','dolls',20));assert.equal(h.net.start('dolls','dolls',20),false);
  assert.deepEqual(Object.keys(h.sent[0]).sort(),['action','game','request','stake','t']);
  h.answer({round:h.round()});assert.equal(h.net.result,null);assert.equal(h.net.shot(.4,.5),true);assert.notEqual(h.sent[0].request,h.sent[1].request);
  assert.equal(h.net.shot(.4,.5),false);
});
test('invalid game, stakes, coordinates, guests and offline never transmit',()=>{
  const h=harness();for(const stake of [0,21,'20',Infinity])assert.equal(h.net.start('dolls','dolls',stake),false);
  assert.equal(h.net.start('bad','balloon',20),false);
  h.context.authenticated=false;assert.equal(h.net.start('dolls','dolls',20),false);
  h.context.authenticated=true;h.context.online=false;assert.equal(h.net.start('dolls','dolls',20),false);
  assert.equal(h.sent.length,0);
});
test('targets predict from server elapsed/index and shots respect cadence and deadline',()=>{
  const h=harness();h.net.start('dolls','dolls',20);h.answer({round:h.round()});
  h.tick(250);assert.deepEqual(h.net.target,targetAt('dolls',123,0,250));
  assert.equal(h.net.shot(.4,.5),true);h.answer({round:h.round(1),result:{hit:false}});
  assert.equal(h.net.result,null);h.tick(499);assert.equal(h.net.shot(.4,.5),false);h.tick(1);assert.ok(h.net.shot(.4,.5));
  h.answer({round:h.round(2)});h.tick(20000);assert.equal(h.net.target,null);assert.equal(h.net.shot(.4,.5),false);
});
test('late/duplicate or unrelated messages cannot settle a pending action',()=>{
  const h=harness();h.net.start('dice','dice',20,'fish');const request=h.net.pending.request;
  assert.equal(h.net.receive({t:'fair_result',request:'unrelated',ok:true,result:{net:500}}),false);
  assert.ok(h.net.pending);h.answer({round:null,result:{game:'dice',gross:40,net:20}});
  assert.equal(h.net.receive({t:'fair_result',request,ok:true,result:{net:500}}),false);assert.equal(h.net.result.net,20);
});
test('timeout preserves uncertainty and status recovers only on the same connection',()=>{
  const h=harness();h.net.start('dice','dice',20,'fish');h.tick(9000);assert.ok(h.net.pending);assert.match(h.net.message,/ล่าช้า/);
  assert.ok(h.net.status());assert.equal(h.net.status(),false);
  const request=h.net.probe.request;h.net.receive({t:'fair_result',request,ok:true,round:null,result:{game:'dice',gross:0,net:-20}});
  assert.equal(h.net.busy,false);assert.equal(h.net.result.net,-20);assert.equal(h.sent.length,2);
});
test('connection loss clears a potentially committed dice round and never replays',()=>{
  const h=harness();h.net.start('dice','dice',100,'crab');const old=h.net.pending.request;
  h.context.online=false;h.net.disconnected();assert.equal(h.net.pending,null);assert.equal(h.net.round,null);
  assert.match(h.net.message,/ผลรอบก่อนอาจบันทึกแล้ว/);h.context.online=true;
  assert.equal(h.net.status(),false);assert.equal(h.net.start('dice','dice',100,'crab'),false);h.tick(30000);
  assert.equal(h.sent.length,1);assert.equal(h.net.receive({t:'fair_result',request:old,ok:true,result:{gross:400}}),false);
  h.net.synced();assert.equal(h.sent.length,1);assert.equal(h.net.start('dice','dice',20,'fish'),true);
});
test('unknown final skill shot also clears on disconnect and needs balance sync',()=>{
  const h=harness();h.net.start('dolls','dolls',20);h.answer({round:h.round(4)});h.net.shot(.5,.5);
  h.net.disconnected();assert.equal(h.net.round,null);assert.equal(h.net.result,null);assert.equal(h.net.awaitingSync,true);
  assert.equal(h.net.start('dolls','dolls',20),false);assert.equal(h.sent.length,2);
});
test('close queues one cancellation after a free start; rejected cancel does not loop',()=>{
  const h=harness();h.net.start('dolls','dolls',20);h.net.cancel();assert.equal(h.sent.length,1);
  h.answer({round:h.round()});assert.equal(h.sent.length,2);assert.equal(h.sent[1].action,'cancel');
  h.answer({ok:false,why:'round_missing'});assert.equal(h.sent.length,2);assert.equal(h.net.round,null);
});
test('ambiguous send failure remains pending and does not replay',()=>{
  const h=harness(()=>{throw Error('network');});h.net.start('dice','dice',20,'fish');h.tick(50000);
  assert.ok(h.net.pending);assert.equal(h.net.start('dice','dice',20,'fish'),false);assert.equal(h.sent.length,1);
});
test('server alone determines net result; completion cooldown prevents autoplay',()=>{
  const h=harness();h.net.start('dolls','dolls',20);h.answer({round:h.round(4)});h.net.shot(.5,.5);
  h.answer({round:null,result:{game:'dolls',hits:3,stake:20,gross:10,net:-10,receipt:'server-receipt'}});
  assert.equal(h.net.result.net,-10);assert.equal(h.net.start('dolls','dolls',20),false);
  h.tick(3000);assert.equal(h.sent.length,2);assert.ok(h.net.start('dolls','dolls',20));
});
