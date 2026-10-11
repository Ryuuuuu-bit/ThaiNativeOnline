// Real HTTP/WebSocket handlers and MemoryStore; fixture accounts provide only
// positions/previous completed quests, never claimed reward progress.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { WebSocket } from 'ws';
import { NEWCOMER_QUESTS } from '../src/data/quests.js';
import { NPCS } from '../src/data/npcs.js';
import { WARP_DESTINATIONS } from '../src/data/warpServices.js';

test('signed-in newcomer HTTP/WS: nearby acceptance/talk/claim, forgery rejection, payout once, save/rejoin', {timeout:20000}, async t => {
  const probe=createServer();probe.listen(0,'127.0.0.1');await once(probe,'listening');
  const port=probe.address().port;await new Promise(r=>probe.close(r));
  const bootstrap=`
    import {MemoryStore} from './server/store.js';
    import {Character} from './src/character/Character.js';
    import {NEWCOMER_QUESTS} from './src/data/quests.js';
    import {NPCS} from './src/data/npcs.js';
    import {SPOT_SITES} from './src/data/shopSites.js';
    const site=id=>{const n=NPCS.find(n=>n.id===id);for(const a of Object.values(n.schedule)){if(typeof a.at==='object')return {map:n.map??'city',x:a.at.x,z:a.at.z,facing:0};if(SPOT_SITES[a.at]){const [map,x,z]=SPOT_SITES[a.at];return {map,x,z,facing:0};}}};
    const create=MemoryStore.prototype.createAccount;
    MemoryStore.prototype.createAccount=async function(...args){
      const ok=await create.apply(this,args),id=args[0];
      if(ok&&id.startsWith('newcomer')){
        const first=NEWCOMER_QUESTS[0],last=NEWCOMER_QUESTS.at(-1);
        const q=id==='newcomerreturn'?Object.fromEntries(NEWCOMER_QUESTS.slice(0,-1).map(q=>[q.id,{status:'done'}])):{};
        const c=new Character({name:id,classId:'shaman',level:id==='newcomerreturn'?20:1,jobLevel:12});
        const location=site(id==='newcomerreturn'?last.giver:first.giver);
        this.slots.set(id,new Map([[0,{data:{'tno.character.v1':JSON.stringify(c),'tno.quests.v1':JSON.stringify(q),'tno.location.v1':JSON.stringify(location)},updated:1}]]));
        await this.init();
      }return ok;
    };await import('./server/index.js');`;
  const child=spawn(process.execPath,['--input-type=module','-e',bootstrap],{cwd:new URL('../',import.meta.url),env:{...process.env,PORT:String(port),DATABASE_URL:'',GM_ID:'',GM_PASSWORD:'',ADMIN_IDS:''},stdio:['ignore','pipe','pipe']});
  let logs='';child.stdout.on('data',d=>logs+=d);child.stderr.on('data',d=>logs+=d);
  const clients=[],sleep=ms=>new Promise(r=>setTimeout(r,ms));
  t.after(()=>{for(const ws of clients)ws.terminate();if(child.exitCode===null)child.kill();});
  for(let i=0;i<150&&!logs.includes('ThaiNative Online on');i++)await sleep(20);
  assert.match(logs,/ThaiNative Online on/);
  const api=async(path,token,method='GET',body)=>{
    const r=await fetch(`http://127.0.0.1:${port}${path}`,{method,headers:{'content-type':'application/json',...(token?{authorization:`Bearer ${token}`}:{})},...(body?{body:JSON.stringify(body)}:{})});
    assert.ok(r.ok,`${path}: ${r.status}`);return r.json();
  };
  const connect=async(account,token)=>{
    if(!token)token=(await api('/api/register',null,'POST',{id:account,password:'newcomer-test-password'})).token;
    const ws=new WebSocket(`ws://127.0.0.1:${port}/ws`),messages=[];clients.push(ws);
    ws.on('message',d=>messages.push(JSON.parse(d)));await once(ws,'open');
    const wait=async pred=>{const end=Date.now()+2500;while(Date.now()<end){const i=messages.findIndex(pred);if(i>=0)return messages.splice(i,1)[0];await sleep(5);}throw Error(`WS timeout ${JSON.stringify(messages.slice(-5))} ${logs}`);};
    const npc=NPCS.find(n=>n.id===(account==='newcomerreturn'?NEWCOMER_QUESTS.at(-1).giver:NEWCOMER_QUESTS[0].giver));
    const at=npc.schedule.day.at;
    const send=m=>ws.send(JSON.stringify(m));send({t:'hello',token,slot:0,map:npc.map??'city',x:at.x,z:at.z,lv:100});
    await wait(m=>m.t==='welcome');const initial=(await wait(m=>m.t==='sync')).c;
    let n=initial.ack;
    const op=async msg=>{send({t:'op',...msg,n:++n});return(await wait(m=>m.t==='sync'&&m.c.ack>=n)).c;};
    return {ws,token,initial,op,send,wait};
  };
  const first=NEWCOMER_QUESTS[0],p=await connect('newcomerstart');
  const accepted=await p.op({op:'quest_accept',id:first.id,kills:{crab:999},talked:first.objectives.map(o=>o.talk)});
  assert.equal(accepted.quests[first.id].status,'active');assert.deepEqual(accepted.quests[first.id].talked,[]);
  const denied=await p.op({op:'talk',npc:first.objectives[0].talk,map:'paddy',x:0,z:-125});
  assert.deepEqual(denied.quests[first.id].talked,[]);
  const refused=await p.op({op:'quest_complete',id:first.id,rewards:{gold:99999}});
  assert.equal(refused.gold,p.initial.gold);assert.equal(refused.quests[first.id].status,'active');
  // Final quest starts by its giver in another map. Talk to the giver never
  // supplies the required forest talk, even if the client claims its coordinates.
  const last=NEWCOMER_QUESTS.at(-1),r=await connect('newcomerreturn');
  assert.equal((await r.op({op:'quest_accept',id:last.id})).quests[last.id].status,'active');
  assert.deepEqual((await r.op({op:'talk',npc:last.objectives[0].talk,map:'deep_forest',x:-2.4,z:-317})).quests[last.id].talked,[]);
  // Same-map first paddy work can be accepted/claimed after an authoritative
  // service warp. This traverses production travel checks and real quest talks.
  const destination=WARP_DESTINATIONS.find(d=>d.map==='paddy');
  p.send({t:'service_warp',npc:first.giver,destination:destination.id});
  await p.wait(m=>m.t==='position'&&m.reason==='service_warp');
  const talked=await p.op({op:'talk',npc:first.objectives[0].talk});
  assert.ok(talked.quests[first.id].talked.includes(first.objectives[0].talk));
  const paid=await p.op({op:'quest_complete',id:first.id});
  assert.equal(paid.quests[first.id].status,'done');assert.equal(paid.gold,p.initial.gold+first.rewards.gold);
  const again=await p.op({op:'quest_complete',id:first.id});assert.equal(again.gold,paid.gold);assert.deepEqual(again.inventory,paid.inventory);
  assert.ok((await api('/api/slots/0',p.token,'PUT',{data:{'tno.character.v1':JSON.stringify({...paid,gold:99999}),'tno.quests.v1':'{}'}})).ok);
  const stored=(await api('/api/slots',p.token)).slots.find(s=>s.slot===0).data;
  assert.equal(JSON.parse(stored['tno.character.v1']).gold,paid.gold);assert.equal(JSON.parse(stored['tno.quests.v1'])[first.id].status,'done');
  const closed=once(p.ws,'close');p.ws.close();await closed;
  const rejoined=await connect('newcomerstart',p.token);assert.equal(rejoined.initial.gold,paid.gold);assert.equal(rejoined.initial.quests[first.id].status,'done');
  assert.doesNotMatch(logs,/unhandled|Character save failed/);
});
