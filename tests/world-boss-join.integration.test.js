// เรือนหอร้าง has no door on the map: the world boss news button sends `wbjoin` (server/index.js),
// which warps the player there at night and refuses by day.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createServer} from 'node:net';
import {WebSocket} from 'ws';

async function server(t, hour) {
  const probe=createServer();probe.listen(0,'127.0.0.1');await once(probe,'listening');const port=probe.address().port;await new Promise(r=>probe.close(r));
  const child=spawn(process.execPath,['--input-type=module','-e',"await import('./server/index.js');",'--',`--hour=${hour}`],{cwd:new URL('../',import.meta.url),env:{...process.env,PORT:String(port),DATABASE_URL:''},stdio:['ignore','pipe','pipe']});
  let logs='';child.stdout.on('data',d=>logs+=d);child.stderr.on('data',d=>logs+=d);
  t.after(()=>{if(child.exitCode===null)child.kill();});
  for(let i=0;i<300&&!logs.includes('ThaiNative Online on');i++)await new Promise(r=>setTimeout(r,30));
  assert.match(logs,/ThaiNative Online on/);
  const api=async(path,token,method='GET',body)=>{const r=await fetch(`http://127.0.0.1:${port}${path}`,{method,headers:{'content-type':'application/json',...(token?{authorization:`Bearer ${token}`}:{})},...(body?{body:JSON.stringify(body)}:{})});return r.json();};
  const auth=await api('/api/register',null,'POST',{id:'qawb1',password:'testsecret'});assert.ok(auth.ok);
  assert.ok((await api('/api/slots/0',auth.token,'PUT',{data:{'tno.character.v1':JSON.stringify({name:'QAwb',classId:'muaythai',gender:'male'})}})).ok);
  const ws=new WebSocket(`ws://127.0.0.1:${port}/ws`),msgs=[];ws.on('message',d=>msgs.push(JSON.parse(d)));await once(ws,'open');
  t.after(()=>ws.terminate());
  const send=m=>ws.send(JSON.stringify(m));
  const wait=async pred=>{for(let i=0;i<1000;i++){const at=msgs.findIndex(pred);if(at>=0)return msgs.splice(at,1)[0];await new Promise(r=>setTimeout(r,10));}throw Error('Message timeout');};
  send({t:'hello',token:auth.token,slot:0,map:'paddy',x:0,z:-130});await wait(m=>m.t==='welcome');
  return {send,wait};
}

test('world boss: the news button warps to เรือนหอร้าง at night', {timeout:25000}, async t=>{
  const a=await server(t,21);
  a.send({t:'wbjoin'});
  const at=await a.wait(m=>(m.t==='position'&&m.map==='ruen_ho')||m.t==='recall_no'||(m.t==='wbnews'&&m.state==='closed'));   // the welcome's own position and the night's news come first
  assert.equal(at.map,'ruen_ho');
});

test('world boss: by day the way in is closed', {timeout:25000}, async t=>{
  const a=await server(t,10);
  a.send({t:'wbjoin'});
  assert.equal((await a.wait(m=>m.t==='wbnews')).state,'closed');
});
