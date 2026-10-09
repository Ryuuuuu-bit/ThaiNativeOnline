// Production HTTP/WS signed-in quest authority. Only stored fixture progress is
// seeded; quest handlers, class gates, rewards, reconciliation and saving are real.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { WebSocket } from 'ws';
import { CLASS_MASTERS } from '../src/data/quests.js';
import { HALLS } from '../src/data/halls.js';

test('signed-in HTTP/WS: forged quest counts/rewards/masteries fail, valid hand-in pays once and survives save/rejoin', {timeout:20000}, async t => {
  const probe = createServer(); probe.listen(0,'127.0.0.1'); await once(probe,'listening');
  const port = probe.address().port; await new Promise(r => probe.close(r));
  const bootstrap = `
    import {MemoryStore} from './server/store.js';
    import {Character} from './src/character/Character.js';
    import {HALLS} from './src/data/halls.js';
    const create = MemoryStore.prototype.createAccount;
    MemoryStore.prototype.createAccount = async function(...args) {
      const ok = await create.apply(this,args), id = args[0];
      if (ok && ['questready','questearned','questlow','questwrong','questfar'].includes(id)) {
        const cls = id === 'questwrong' ? 'hunter' : 'warrior';
        const c = new Character({name:id,classId:cls,level:id==='questlow'?4:20,jobLevel:id==='questlow'?2:12,
          masteries:{school_warrior:true,school_hunter:true,unknown:true}});
        c.addItem('croc_scale',3);
        const q = id==='questlow' || id==='questwrong' ? {} : {
          class_warrior_intro:{status:'done'},
          class_warrior_advanced:{status:'active',kills:{kumphi:6},talked:['marsh_trader'],
            combo:{done:id==='questearned',hits:{}}}
        };
        const door = HALLS.find(h=>h.classId==='warrior').door;
        const location = {map:'city',x:id==='questfar'?0:door.x,z:id==='questfar'?52:door.z,facing:0};
        this.slots.set(id,new Map([[0,{data:{'tno.character.v1':JSON.stringify(c),
          'tno.quests.v1':JSON.stringify(q),'tno.location.v1':JSON.stringify(location)},updated:1}]]));
        await this.init();
      }
      return ok;
    };
    await import('./server/index.js');
  `;
  const child = spawn(process.execPath,['--input-type=module','-e',bootstrap],{
    cwd:new URL('../',import.meta.url), env:{...process.env,PORT:String(port),DATABASE_URL:'',GM_ID:'',GM_PASSWORD:'',ADMIN_IDS:''},
    stdio:['ignore','pipe','pipe'],
  });
  let logs = ''; child.stdout.on('data',d=>logs+=d); child.stderr.on('data',d=>logs+=d);
  const clients = [], sleep = ms => new Promise(r=>setTimeout(r,ms));
  t.after(()=>{for(const ws of clients)ws.terminate(); if(child.exitCode===null)child.kill();});
  for(let i=0;i<150&&!logs.includes('ThaiNative Online on');i++)await sleep(20);
  assert.match(logs,/ThaiNative Online on/);
  const api = async (path,token,method='GET',body) => {
    const r = await fetch(`http://127.0.0.1:${port}${path}`,{method,headers:{'content-type':'application/json',...(token?{authorization:`Bearer ${token}`}:{})},...(body?{body:JSON.stringify(body)}:{})});
    assert.ok(r.ok,`${method} ${path}: ${r.status}`); return r.json();
  };
  const connect = async (account, token) => {
    if(!token){const auth=await api('/api/register',null,'POST',{id:account,password:'class-quest-test'});assert.ok(auth.ok);token=auth.token;}
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`), messages=[];clients.push(ws);
    ws.on('message',d=>messages.push(JSON.parse(d)));await once(ws,'open');
    const wait = async predicate => {
      const end = Date.now()+2500;
      while(Date.now()<end){const i=messages.findIndex(predicate);if(i>=0)return messages.splice(i,1)[0];await sleep(5);}
      throw Error(`Quest WS timeout: ${JSON.stringify(messages.slice(-5))} ${logs}`);
    };
    const send = m=>ws.send(JSON.stringify(m));
    const door = HALLS.find(h=>h.classId==='warrior').door;
    send({t:'hello',token,slot:0,name:'forged',cls:'shaman',lv:100,map:'city',...door});
    await wait(m=>m.t==='welcome');const initial=(await wait(m=>m.t==='sync')).c;
    let n=initial.ack;
    const op = async msg => {send({t:'op',...msg,n:++n});return (await wait(m=>m.t==='sync'&&m.c.ack>=n)).c;};
    return {ws,token,initial,send,wait,op};
  };
  const ready = await connect('questready');assert.equal(ready.initial.classId,'warrior');
  assert.deepEqual(ready.initial.masteries,{},'load strips flags without matching completed lessons');
  const forged = await ready.op({op:'quest_complete',id:'class_warrior_advanced',combo:{done:true},kills:{kumphi:999},
    rewards:{gold:999999,mastery:'school_warrior'},classId:'warrior'});
  assert.equal(forged.quests.class_warrior_advanced.status,'active');assert.equal(forged.quests.class_warrior_advanced.combo.done,false);
  assert.equal(forged.gold,ready.initial.gold);assert.deepEqual(forged.masteries,{});
  for(const op of ['quest_hit','quest_cast','mastery_grant']) {
    const denied=await ready.op({op,skill:'sword_thrust',hit:true,dmg:999,count:999,mastery:'school_warrior'});
    assert.equal(denied.quests.class_warrior_advanced.combo.done,false);assert.deepEqual(denied.masteries,{});
  }
  const remoteTalk = await ready.op({op:'talk',npc:'marsh_trader',map:'klong',x:20.5,z:-626});
  assert.equal(remoteTalk.gold,ready.initial.gold);
  const low = await connect('questlow'), wrong = await connect('questwrong'), far = await connect('questfar');
  for(const p of [low,wrong,far]) {
    const denied=await p.op({op:'quest_accept',id:'class_warrior_intro',npc:CLASS_MASTERS.warrior,classId:'warrior',level:100,jobLevel:50,x:104,z:62});
    assert.equal(denied.quests.class_warrior_intro?.status,p.initial.quests.class_warrior_intro?.status);
    assert.deepEqual(denied.masteries,{});
  }
  const earned = await connect('questearned'), before = earned.initial;
  const paid = await earned.op({op:'quest_complete',id:'class_warrior_advanced',rewards:{gold:999999,mastery:'school_hunter'}});
  assert.equal(paid.gold,before.gold+350);assert.equal(paid.quests.class_warrior_advanced.status,'done');
  assert.deepEqual(paid.masteries,{school_warrior:true});
  assert.equal(paid.inventory.find(s=>s?.id==='croc_scale').qty,1);
  const again = await earned.op({op:'quest_complete',id:'class_warrior_advanced'});
  assert.equal(again.gold,paid.gold);assert.deepEqual(again.inventory,paid.inventory);
  // The API save cannot replace authoritative counters, inventory or flags.
  assert.ok((await api('/api/slots/0',earned.token,'PUT',{data:{
    'tno.character.v1':JSON.stringify({...paid,gold:999999,masteries:{school_hunter:true}}),
    'tno.quests.v1':'{"class_warrior_advanced":{"status":"active","combo":{"done":true}}}',
  }})).ok);
  const stored=(await api('/api/slots',earned.token)).slots.find(s=>s.slot===0).data;
  assert.equal(JSON.parse(stored['tno.character.v1']).gold,paid.gold);
  assert.deepEqual(JSON.parse(stored['tno.character.v1']).masteries,{school_warrior:true});
  assert.equal(JSON.parse(stored['tno.quests.v1']).class_warrior_advanced.status,'done');
  const closed=once(earned.ws,'close');earned.ws.close();await closed;
  const rejoined=await connect('questearned',earned.token);
  assert.deepEqual(rejoined.initial.masteries,{school_warrior:true});assert.equal(rejoined.initial.gold,paid.gold);
  assert.equal(rejoined.initial.quests.class_warrior_advanced.status,'done');
  assert.doesNotMatch(logs,/unhandled|message .*Error|Character save failed/);
});
