import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createServer} from 'node:net';
import {WebSocket} from 'ws';

test('real HTTP/WS: duel consent, recall, party map warp and graceful shutdown', {timeout:25000}, async t=>{
  const probe=createServer();probe.listen(0,'127.0.0.1');await once(probe,'listening');const port=probe.address().port;await new Promise(r=>probe.close(r));
  // IPC emits the real signal handler on Windows, where child.kill is an abrupt termination.
  const child=spawn(process.execPath,['--input-type=module','-e',"await import('./server/index.js'); process.on('message', s => { if(s==='SIGTERM')process.emit(s); });"],{cwd:new URL('../',import.meta.url),env:{...process.env,PORT:String(port),DATABASE_URL:''},stdio:['ignore','pipe','pipe','ipc']});
  let logs='';child.stdout.on('data',d=>logs+=d);child.stderr.on('data',d=>logs+=d);
  t.after(()=>{if(child.exitCode===null)child.kill();});
  const base=`http://127.0.0.1:${port}`;
  for(let i=0;i<100;i++){if(logs.includes('ThaiNative Online on'))break;await new Promise(r=>setTimeout(r,30));}
  assert.match(logs,/ThaiNative Online on/);
  const api=async(path,token,method='GET',body)=>{const r=await fetch(base+path,{method,headers:{'content-type':'application/json',...(token?{authorization:`Bearer ${token}`}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,...await r.json()};};
  async function player(n){
    const auth=await api('/api/register',null,'POST',{id:`qatest${n}`,password:'testsecret'});assert.ok(auth.ok);
    const saved=await api('/api/slots/0',auth.token,'PUT',{data:{'tno.character.v1':JSON.stringify({name:`QA${n}`,classId:'muaythai',gender:'male'})}});assert.ok(saved.ok);
    const ws=new WebSocket(`ws://127.0.0.1:${port}/ws`),msgs=[];ws.on('message',d=>msgs.push(JSON.parse(d)));await once(ws,'open');
    const send=m=>ws.send(JSON.stringify(m));
    const wait=async pred=>{for(let i=0;i<200;i++){const at=msgs.findIndex(pred);if(at>=0)return msgs.splice(at,1)[0];await new Promise(r=>setTimeout(r,10));}throw Error('Message timeout '+logs);};
    send({t:'hello',token:auth.token,slot:0,map:'paddy',x:n,z:-130});const welcome=await wait(m=>m.t==='welcome');
    return {ws,msgs,send,wait,id:welcome.you,token:auth.token};
  }
  const a=await player(1),b=await player(2);t.after(()=>{a.ws.terminate();b.ws.terminate();});
  a.send({t:'pvp_hit',id:b.id});assert.equal((await a.wait(m=>m.t==='pvp_no')).why,'level');   // free PK opens at Lv 20
  a.send({t:'duel_request',id:b.id});assert.equal((await b.wait(m=>m.t==='duel_invite')).from,a.id);
  b.send({t:'duel_answer',from:a.id,ok:true});await a.wait(m=>m.t==='duel_start');await b.wait(m=>m.t==='duel_start');
  a.send({t:'pvp_hit',id:b.id,amount:999999});const hit=await b.wait(m=>m.t==='pvp_hit');assert.ok(hit.amount>=0&&hit.amount<999999||hit.miss);
  a.send({t:'recall'});assert.equal((await a.wait(m=>m.t==='recall_no')).why,'busy');
  a.send({t:'duel_cancel'});assert.equal((await b.wait(m=>m.t==='duel_end')).winner,b.id);
  a.send({t:'pinv',id:b.id});await b.wait(m=>m.t==='pinv');b.send({t:'pans',from:a.id,ok:true});await a.wait(m=>m.t==='party'&&m.id);
  await new Promise(r=>setTimeout(r,10100));
  a.send({t:'recall'});assert.equal((await a.wait(m=>m.t==='position'&&m.map==='city')).z,52);
  b.send({t:'party_warp'});assert.equal((await b.wait(m=>m.t==='position'&&m.map==='city')).z,52);
  b.send({t:'pvp_hit',id:a.id});assert.equal((await b.wait(m=>m.t==='pvp_no')).why,'safe');
  const del=await api('/api/slots/0',a.token,'DELETE');assert.equal(del.status,409);
  const exited=once(child,'exit');child.send('SIGTERM');await a.wait(m=>m.t==='shutdown');assert.equal((await exited)[0],0);
  assert.doesNotMatch(logs,/unhandled|message .*Error|Shutdown failed/);
});
