import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createServer} from 'node:net';
import {WebSocket} from 'ws';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

test('HTTP/WS: PK mode acknowledgement, OFF victim, combat lock, travel/rejoin reset and OFF duels', {timeout:30000},async t=>{
  const probe=createServer();probe.listen(0,'127.0.0.1');await once(probe,'listening');const port=probe.address().port;await new Promise(r=>probe.close(r));
  const bootstrap=`
    import {MemoryStore} from './server/store.js';
    import {Character} from './src/character/Character.js';
    import {KARMA} from './src/data/karma.js';
    const create=MemoryStore.prototype.createAccount;
    MemoryStore.prototype.createAccount=async function(...args){
      const ok=await create.apply(this,args);
      if(ok){const c=Character.create(args[0],'warrior');c.level=args[0]==='pklow'?KARMA.freeLevel-1:KARMA.freeLevel;c.hp=c.maxHp;
        const map=args[0]==='pkcity'?'city':'paddy', x={pkfirst:0,pksecond:1,pklow:2,pkcity:0}[args[0]]??0;
        this.slots.set(args[0],new Map([[0,{data:{'tno.character.v1':JSON.stringify(c),'tno.location.v1':JSON.stringify({map,x,z:map==='city'?52:-130,facing:Math.PI})},updated:1}]]));await this.init();}
      return ok;
    };await import('./server/index.js');`;
  const child=spawn(process.execPath,['--input-type=module','-e',bootstrap],{cwd:new URL('../',import.meta.url),env:{...process.env,PORT:String(port),DATABASE_URL:'',GM_ID:'',GM_PASSWORD:''},stdio:['ignore','pipe','pipe']});
  let logs='';child.stdout.on('data',d=>logs+=d);child.stderr.on('data',d=>logs+=d);
  const sockets=[];t.after(()=>{sockets.forEach(s=>s.terminate());if(child.exitCode===null)child.kill();});
  for(let i=0;i<100&&!logs.includes('ThaiNative Online on');i++)await sleep(30);assert.match(logs,/ThaiNative Online on/);
  const base=`http://127.0.0.1:${port}`;
  const register=async id=>{const r=await fetch(base+'/api/register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id,password:'testsecret'})});const auth=await r.json();assert.ok(auth.ok);return auth.token;};
  const connect=async(token,x=0,map='paddy')=>{
    const ws=new WebSocket(`ws://127.0.0.1:${port}/ws`),msgs=[];sockets.push(ws);ws.on('message',d=>msgs.push(JSON.parse(d)));await once(ws,'open');
    const send=m=>ws.send(JSON.stringify(m));
    const wait=async pred=>{for(let i=0;i<300;i++){const at=msgs.findIndex(pred);if(at>=0)return msgs.splice(at,1)[0];await sleep(10);}throw Error('WS timeout '+logs);};
    send({t:'hello',token,slot:0,map,x,z:map==='city'?52:-130});const welcome=await wait(m=>m.t==='welcome');
    const initial=await wait(m=>m.t==='pvp_state'&&m.id===welcome.you);assert.equal(initial.mode,false);
    return {ws,msgs,send,wait,id:welcome.you,mode:async on=>{send({t:'pvp_mode',on});return wait(m=>m.t==='pvp_mode');}};
  };
  const ta=await register('pkfirst'),tb=await register('pksecond'),tl=await register('pklow'),tc=await register('pkcity');
  const a=await connect(ta),b=await connect(tb,1),low=await connect(tl,2),city=await connect(tc,0,'city'),guest=await connect(null,3);
  assert.equal((await low.mode(true)).why,'level');assert.equal((await city.mode(true)).why,'safe');assert.equal((await guest.mode(true)).why,'guest');
  a.send({t:'pvp_hit',id:b.id,on:true});assert.equal((await a.wait(m=>m.t==='pvp_no')).why,'mode');
  assert.equal((await a.mode(true)).on,true);
  a.send({t:'map',map:'city'});await a.wait(m=>m.t==='welcome');a.send({t:'pvp_mode',query:true});assert.equal((await a.wait(m=>m.t==='pvp_mode')).on,false);
  a.send({t:'map',map:'paddy'});await a.wait(m=>m.t==='welcome');assert.equal((await a.mode(true)).on,true);
  a.send({t:'pvp_hit',id:b.id});const hit=await b.wait(m=>m.t==='pvp_hit'&&m.from===a.id);assert.equal(hit.id,b.id);
  assert.equal((await b.wait(m=>m.t==='pvp_state'&&m.id===b.id&&m.wait>0)).mode,false,'OFF victim still receives hit');
  const locked=await a.mode(false);assert.equal(locked.why,'busy');assert.equal(locked.on,true);
  assert.equal((await b.mode(true)).on,true,'OFF victim can enable during incoming combat');
  await sleep(10100);assert.equal((await a.mode(false)).on,false);assert.equal((await b.mode(false)).on,false);
  a.send({t:'duel_request',id:b.id});await b.wait(m=>m.t==='duel_invite');b.send({t:'duel_answer',from:a.id,ok:true});await a.wait(m=>m.t==='duel_start');await b.wait(m=>m.t==='duel_start');
  a.send({t:'pvp_hit',id:b.id});await b.wait(m=>m.t==='pvp_hit'&&m.from===a.id);
  a.ws.close();await once(a.ws,'close');const rejoined=await connect(ta);
  rejoined.send({t:'pvp_mode',query:true});assert.equal((await rejoined.wait(m=>m.t==='pvp_mode')).on,false);
  assert.doesNotMatch(logs,/unhandled|message .*Error/);
});
