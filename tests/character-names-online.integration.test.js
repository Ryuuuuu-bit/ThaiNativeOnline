import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createServer} from 'node:net';
import {WebSocket} from 'ws';

test('HTTP/WS: reserve names, recover legacy duplicates for free, distinguish guests', {timeout:15000},async t=>{
  const probe=createServer();probe.listen(0,'127.0.0.1');await once(probe,'listening');const port=probe.address().port;await new Promise(r=>probe.close(r));
  const bootstrap=`
    import {MemoryStore} from './server/store.js';
    import {Character} from './src/character/Character.js';
    const create=MemoryStore.prototype.createAccount;
    MemoryStore.prototype.createAccount=async function(...args){
      const ok=await create.apply(this,args);
      if(ok&&args[0]==='legacyqa'){
        const c=Character.create('RYUU','warrior');c.level=55;c.gold=4321;c.addItem('ash',17);
        this.slots.set(args[0],new Map([[0,{data:{'tno.character.v1':JSON.stringify(c),'tno.quests.v1':'{"progress":7}'},updated:1}]]));
        await this.init();
      }
      return ok;
    };
    await import('./server/index.js');`;
  const child=spawn(process.execPath,['--input-type=module','-e',bootstrap],{cwd:new URL('../',import.meta.url),env:{...process.env,PORT:String(port),DATABASE_URL:'',GM_ID:'',GM_PASSWORD:''},stdio:['ignore','pipe','pipe']});
  let logs='';child.stdout.on('data',d=>logs+=d);child.stderr.on('data',d=>logs+=d);
  const sockets=[];t.after(()=>{sockets.forEach(s=>s.terminate());if(child.exitCode===null)child.kill();});
  for(let i=0;i<100&&!logs.includes('ThaiNative Online on');i++)await new Promise(r=>setTimeout(r,30));
  assert.match(logs,/ThaiNative Online on/);
  const base=`http://127.0.0.1:${port}`;
  const api=async(path,token,method='GET',body)=>{const r=await fetch(base+path,{method,headers:{'content-type':'application/json',...(token?{authorization:`Bearer ${token}`}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,...await r.json()};};
  const register=async id=>{const r=await api('/api/register',null,'POST',{id,password:'testsecret'});assert.ok(r.ok);return r.token;};
  const save=(token,slot,name)=>api(`/api/slots/${slot}`,token,'PUT',{data:{'tno.character.v1':JSON.stringify({name,classId:'warrior'})}});
  const older=await register('keeperqa');assert.ok((await save(older,0,'Ryuu')).ok);
  const newer=await register('legacyqa'),other=await register('otherqa');
  const before=(await api('/api/slots',newer)).slots[0];assert.ok(before.needsRename);
  const connect=async hello=>{
    const ws=new WebSocket(`ws://127.0.0.1:${port}/ws`),msgs=[];sockets.push(ws);ws.on('message',d=>msgs.push(JSON.parse(d)));await once(ws,'open');
    const wait=async pred=>{for(let i=0;i<200;i++){const m=msgs.find(pred);if(m)return m;await new Promise(r=>setTimeout(r,10));}throw Error('WS timeout '+logs);};
    ws.send(JSON.stringify({t:'hello',map:'city',x:0,z:52,...hello}));return {ws,msgs,wait};
  };
  const blocked=await connect({token:newer,slot:0,name:'forged'});
  assert.equal((await blocked.wait(m=>m.t==='kicked')).code,'rename_required');assert.ok(!blocked.msgs.some(m=>m.t==='welcome'));
  const collision=await Promise.all([save(older,1,'Hero'),save(other,1,' ＨＥＲＯ ')]);
  assert.equal(collision.filter(r=>r.ok).length,1);assert.equal(collision.find(r=>!r.ok).status,409);
  assert.equal(collision.find(r=>!r.ok).code,'name_taken');
  assert.equal((await save(other,2,'bad\u200bname')).code,'bad_name');
  assert.ok((await save(other,2,'ชื่อใหม่')).ok,'rejected name does not wedge its save queue');
  assert.equal((await api('/api/slots/0/name',newer,'POST',{name:'ryuu'})).status,409);
  assert.deepEqual((await api('/api/slots',newer)).slots[0].data,before.data);
  assert.ok((await api('/api/slots/0/name',newer,'POST',{name:'นักรบใหม่'})).ok);
  const after=(await api('/api/slots',newer)).slots[0];assert.equal(after.needsRename,false);
  assert.deepEqual(JSON.parse(after.data['tno.character.v1']),{...JSON.parse(before.data['tno.character.v1']),name:'นักรบใหม่'});
  assert.equal(after.data['tno.quests.v1'],before.data['tno.quests.v1']);
  const restored=await connect({token:newer,slot:0,name:'forged'});
  assert.equal((await restored.wait(m=>m.t==='welcome')).name,'นักรบใหม่');
  assert.equal((await api('/api/slots/0/name',newer,'POST',{name:'อีกชื่อ'})).status,409,'live identity cannot change');
  const ga=await connect({name:'Ryuu',guest:false}),gb=await connect({name:'Ryuu',guest:false});
  const wa=await ga.wait(m=>m.t==='welcome'),wb=await gb.wait(m=>m.t==='welcome');
  assert.match(wa.name,/ \[G\d+\]$/);assert.notEqual(wa.name,wb.name);assert.notEqual(wa.name,'Ryuu');
  assert.doesNotMatch(logs,/Character save failed|unhandled|message .*Error/);
});
