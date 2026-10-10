import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { WebSocket } from 'ws';
const probe=createServer();probe.listen(0,'127.0.0.1');await once(probe,'listening');
const port=probe.address().port;await new Promise(r=>probe.close(r));
const bootstrap=`import{MemoryStore}from'./server/store.js';import{Character}from'./src/character/Character.js';
const create=MemoryStore.prototype.createAccount;MemoryStore.prototype.createAccount=async function(...args){const ok=await create.apply(this,args);if(ok&&args[0]==='pathsmoke'){const c=new Character({name:'ทดสอบ',classId:'warrior',jobLevel:12,gold:1000,skills:{sword_twin:5}});this.slots.set(args[0],new Map([[0,{data:{'tno.character.v1':JSON.stringify(c),'tno.location.v1':JSON.stringify({map:'city',x:4,z:150,facing:0})},updated:1}]]));await this.init();}return ok;};await import('./server/index.js');`;
const child=spawn(process.execPath,['--input-type=module','-e',bootstrap],{cwd:process.cwd(),env:{...process.env,PORT:String(port),DATABASE_URL:'',GM_ID:'',GM_PASSWORD:'',ADMIN_IDS:''},stdio:['ignore','pipe','pipe']});
let logs='';child.stdout.on('data',d=>logs+=d);child.stderr.on('data',d=>logs+=d);
const clients=[],sleep=ms=>new Promise(r=>setTimeout(r,ms));
const api=async(path,token,method='GET',body)=>{const r=await fetch(`http://127.0.0.1:${port}${path}`,{method,headers:{'content-type':'application/json',...(token?{authorization:`Bearer ${token}`}:{})},...(body?{body:JSON.stringify(body)}:{})});assert.ok(r.ok);return r.json();};
const connect=async token=>{const ws=new WebSocket(`ws://127.0.0.1:${port}/ws`),messages=[];clients.push(ws);ws.on('message',d=>messages.push(JSON.parse(d)));await once(ws,'open');const wait=async pred=>{const end=Date.now()+2500;while(Date.now()<end){const i=messages.findIndex(pred);if(i>=0)return messages.splice(i,1)[0];await sleep(5);}throw Error('WS timeout '+JSON.stringify(messages.map(m=>({t:m.t,ack:m.c?.ack,evo:m.c?.evo,gold:m.c?.gold}))));};const send=m=>ws.send(JSON.stringify(m));send({t:'hello',token,slot:0,map:'city',x:4,z:150});await wait(m=>m.t==='welcome');const initial=(await wait(m=>m.t==='sync')).c;let n=initial.ack ?? 0;const op=async msg=>{send({t:'op',...msg,n:++n});send({t:'resync'});return(await wait(m=>m.t==='sync'&&m.c.ack>=n)).c;};return{ws,initial,op};};
try{
for(let i=0;i<150&&!logs.includes('ThaiNative Online on');i++)await sleep(20);assert.match(logs,/ThaiNative Online on/);
const token=(await api('/api/register',null,'POST',{id:'pathsmoke',password:'skill-path-test-password'})).token;
const p=await connect(token);assert.equal(p.initial.gold,1000);
let c=await p.op({op:'evo',id:'sword_twin',pick:'A'});assert.equal(c.evo.sword_twin,'A');assert.equal(c.gold,1000);
c=await p.op({op:'evo',id:'sword_twin',pick:'B'});assert.equal(c.evo.sword_twin,'B');assert.equal(c.gold,880);
c=await p.op({op:'evo',id:'sword_twin',pick:'B'});assert.equal(c.gold,880);
c=await p.op({op:'evo',id:'mage_akom',pick:'A'});assert.equal(c.gold,880);assert.equal(c.evo.mage_akom,undefined);
await api('/api/slots/0',token,'PUT',{data:{'tno.character.v1':JSON.stringify({...c,gold:99999,evo:{sword_twin:'A'}})}});
const stored=(await api('/api/slots',token)).slots.find(s=>s.slot===0).data;const sheet=JSON.parse(stored['tno.character.v1']);assert.equal(sheet.gold,880);assert.equal(sheet.evo.sword_twin,'B');
const closed=once(p.ws,'close');p.ws.close();await closed;const rejoined=await connect(token);assert.equal(rejoined.initial.gold,880);assert.equal(rejoined.initial.evo.sword_twin,'B');
console.log(JSON.stringify({checks:12,passed:12,failed:0,transport:'real HTTP/WebSocket MemoryStore',first:1000,afterSwitch:880,fee:120,rejoined:true}));
}finally{for(const ws of clients)ws.terminate();if(child.exitCode===null)child.kill();}
