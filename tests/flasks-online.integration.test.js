import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createServer} from 'node:net';
import {WebSocket} from 'ws';

test('actual HTTP/WS preserves flask charges and typed hotbar, rejects forged flask equip', {timeout:20000}, async t => {
  const probe=createServer();probe.listen(0,'127.0.0.1');await once(probe,'listening');const port=probe.address().port;await new Promise(r=>probe.close(r));
  const child=spawn(process.execPath,['--input-type=module','-e',`
    import {Combatants} from './server/combatants.js';
    const load=Combatants.prototype.load;
    Combatants.prototype.load=function(...args){const ok=load.apply(this,args);if(ok){const c=this.get(args[0]).c;c.level=20;c.hp=1;c.mp=1;c.addItem('flask_hp_2');}return ok;};
    await import('./server/index.js');
  `],{cwd:new URL('../',import.meta.url),env:{...process.env,PORT:String(port),DATABASE_URL:'',GM_ID:'',GM_PASSWORD:'',ADMIN_IDS:''},stdio:['ignore','pipe','pipe']});
  let logs='';child.stdout.on('data',d=>logs+=d);child.stderr.on('data',d=>logs+=d);let ws;
  t.after(()=>{ws?.terminate();if(child.exitCode===null)child.kill();});
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));for(let i=0;i<200&&!logs.includes('ThaiNative Online on');i++)await sleep(20);assert.match(logs,/ThaiNative Online on/);
  const api=async(path,token,method='GET',body)=>{const r=await fetch(`http://127.0.0.1:${port}${path}`,{method,headers:{'content-type':'application/json',...(token?{authorization:`Bearer ${token}`}:{})},...(body?{body:JSON.stringify(body)}:{})});assert.ok(r.ok,`${path}: ${r.status}`);return r.json();};
  const auth=await api('/api/register',null,'POST',{id:'flaskqatest',password:'fixture-secret'});
  await api('/api/slots/0',auth.token,'PUT',{data:{'tno.character.v1':JSON.stringify({name:'FlaskQA',classId:'warrior',level:20})}});
  ws=new WebSocket(`ws://127.0.0.1:${port}/ws`);const messages=[];ws.on('message',raw=>messages.push(JSON.parse(raw)));await once(ws,'open');
  const wait=async predicate=>{for(let i=0;i<700;i++){const at=messages.findIndex(predicate);if(at>=0)return messages.splice(at,1)[0];await sleep(5);}throw Error('WS timeout '+JSON.stringify(messages)+logs);};
  const send=m=>ws.send(JSON.stringify(m));send({t:'hello',name:'FlaskQA',cls:'warrior',map:'city',x:0,z:0,token:auth.token,slot:0});await wait(m=>m.t==='welcome');await wait(m=>m.t==='position');
  let c=(await wait(m=>m.t==='sync')).c;const original=c.flasks.hp.flask.iid;assert.equal(c.flasks.hp.flask.charges,40);
  send({t:'op',n:1,op:'flask_use',kind:'hp',charges:999,recovery:99999});c=(await wait(m=>m.t==='sync'&&m.c.ack===1)).c;assert.equal(c.flasks.hp.flask.charges,30);assert.ok(c.hp>1&&c.hp<99999);
  send({t:'op',n:2,op:'flask_use',kind:'hp'});c=(await wait(m=>m.t==='sync'&&m.c.ack===2)).c;assert.equal(c.flasks.hp.flask.charges,30,'immediate repeated request cannot waste cooldown charge');
  send({t:'op',n:3,op:'flask_equip',iid:'00000000-0000-4000-8000-999999999999',flask:{charges:999}});c=(await wait(m=>m.t==='sync'&&m.c.ack===3)).c;assert.equal(c.flasks.hp.flask.iid,original);
  const next=c.inventory.find(s=>s?.id==='flask_hp_2');assert.ok(next);send({t:'op',n:4,op:'flask_equip',iid:next.flask.iid,flask:{charges:999}});c=(await wait(m=>m.t==='sync'&&m.c.ack===4)).c;assert.equal(c.flasks.hp.flask.iid,next.flask.iid);assert.equal(c.flasks.hp.flask.charges,40);
  const order=[{kind:'item',id:'potion_s'},null,{kind:'item',id:'ether'}];send({t:'op',n:5,op:'hotbar_order',order});await wait(m=>m.t==='me'&&m.ack>=5);send({t:'resync'});c=(await wait(m=>m.t==='sync'&&m.c.ack>=5)).c;assert.deepEqual(c.hotbar.slice(0,3),order);
  ws.close();await once(ws,'close');await sleep(100);
  const slots=await api('/api/slots',auth.token);const saved=JSON.parse(slots.slots[0].data['tno.character.v1']);assert.equal(saved.flasks.hp.flask.iid,next.flask.iid);assert.deepEqual(saved.hotbar.slice(0,3),order);
  assert.doesNotMatch(logs,/unhandled|message .*Error/);
});
