import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { randomUUID } from 'node:crypto';
import { WebSocket } from 'ws';
import { FAIR_SITES } from '../src/fair/fairSites.js';
import { skillFee, dicePayout, DICE_SYMBOLS } from '../src/fair/fairRules.js';

// Actual index HTTP/WS handlers, isolated MemoryStore, no staging database or
// dotenv reads. Only the fair receipt clock is controlled in the child; gameplay
// time, gold, random draws, authentication, navigation and persistence stay real.
async function fixture(t,{hour=21,game='balloons',location,gold=1000,holdCommit=false}={}) {
  const probe=createServer();probe.listen(0,'127.0.0.1');await once(probe,'listening');
  const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
  const site=FAIR_SITES.find(s=>s.id===game);
  const at=location??{map:'city',...site.approach};
  const config={hour,at,gold,holdCommit};
  const bootstrap=`
    process.loadEnvFile=()=>{};
    const config=${JSON.stringify(config)};
    import { MemoryStore } from './server/store.js';
    import { Character } from './src/character/Character.js';
    import { MAPS } from './src/world/maps.js';
    import { TempleFairService } from './server/temple-fair.js';
    const create=MemoryStore.prototype.createAccount;
    MemoryStore.prototype.createAccount=async function(...args){
      const ok=await create.apply(this,args);
      if(ok&&['fairqa','fairpeer'].includes(args[0])){
        const c=Character.create(args[0]==='fairpeer'?'FairPeer':'FairQA','hunter');c.gold=config.gold;
        await this.putSlot(args[0],0,{'tno.character.v1':JSON.stringify(c.toJSON()),
          'tno.location.v1':JSON.stringify({...config.at,facing:Math.PI,
            ...(config.at.map==='city'?{layoutRevision:MAPS.city.layoutRevision}:{})})});
      }return ok;
    };
    let fairNow=100000,releaseCommit;
    const transfer=MemoryStore.prototype.transferTrade;
    MemoryStore.prototype.transferTrade=async function(...args){
      if(config.holdCommit){config.holdCommit=false;
        await new Promise(resolve=>{releaseCommit=resolve;process.send({type:'commitHeld'});});
      }return transfer.apply(this,args);
    };
    const handle=TempleFairService.prototype.handle;
    TempleFairService.prototype.handle=function(...args){this.now=()=>fairNow;return handle.apply(this,args);};
    process.on('message',m=>{if(m?.type==='advance'){fairNow+=m.ms;process.send({type:'advanced',id:m.id});}
      if(m?.type==='releaseCommit')releaseCommit?.();});
    process.argv.push('--hour='+config.hour);
    await import('./server/index.js');
  `;
  const child=spawn(process.execPath,['--input-type=module','-e',bootstrap],{
    cwd:new URL('../',import.meta.url),env:{...process.env,PORT:String(port),DATABASE_URL:'',
      GM_ID:'',GM_PASSWORD:'',ADMIN_IDS:'',GOOGLE_CLIENT_ID:''},stdio:['ignore','pipe','pipe','ipc'],
  });
  let logs='';child.stdout.on('data',d=>logs+=d);child.stderr.on('data',d=>logs+=d);
  const sockets=[];
  t.after(async()=>{
    for(const ws of sockets)if(ws.readyState!==WebSocket.CLOSED)ws.terminate();
    if(child.exitCode===null){const exit=once(child,'exit');child.kill();await exit;}
  });
  for(let i=0;i<150&&!logs.includes('ThaiNative Online on');i++)await new Promise(r=>setTimeout(r,20));
  assert.match(logs,/ThaiNative Online on/,'isolated server startup');
  const base=`http://127.0.0.1:${port}`;
  const auth=await(await fetch(base+'/api/register',{method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({id:'fairqa',password:'testsecret'})})).json();assert.ok(auth.ok);
  let commitHeld=false;child.on('message',m=>{if(m?.type==='commitHeld')commitHeld=true;});
  async function connect(signedIn=true,peer=false){
    const credentials=peer?await(await fetch(base+'/api/register',{method:'POST',headers:{'content-type':'application/json'},
      body:JSON.stringify({id:'fairpeer',password:'testsecret'})})).json():auth;
    assert.ok(credentials.ok);
    const ws=new WebSocket(`ws://127.0.0.1:${port}/ws`),messages=[];sockets.push(ws);
    ws.on('message',d=>messages.push(JSON.parse(d)));await once(ws,'open');
    const send=m=>ws.send(JSON.stringify(m));
    const wait=async pred=>{
      for(let i=0;i<300;i++){
        const at=messages.findIndex(pred);if(at>=0)return messages.splice(at,1)[0];
        await new Promise(r=>setTimeout(r,10));
      }throw Error('fair WS timeout: '+logs);
    };
    send({t:'hello',...(signedIn?{token:credentials.token,slot:0}:{name:'FairGuest'}),...at});
    const welcome=await wait(m=>m.t==='welcome');
    // guests keep a browser-local character: the server sends them no character sync
    const initial=signedIn?(await wait(m=>m.t==='sync')).c:null;
    const fair=async(payload,request=randomUUID())=>{send({t:'fair',request,...payload});return wait(m=>m.t==='fair_result'&&m.request===request);};
    const sync=async()=>{messages.splice(0,messages.length,...messages.filter(m=>m.t!=='sync'));send({t:'resync'});return(await wait(m=>m.t==='sync')).c;};
    const close=async()=>{const closed=once(ws,'close');ws.close();await closed;};
    return{ws,send,wait,id:welcome.you,initial,fair,sync,close};
  }
  const advance=async ms=>{
    const id=randomUUID();const ack=new Promise(resolve=>{
      const listener=m=>{if(m?.type==='advanced'&&m.id===id){child.off('message',listener);resolve();}};
      child.on('message',listener);
    });child.send({type:'advance',ms,id});await ack;
  };
  const waitCommit=async()=>{for(let i=0;i<300&&!commitHeld;i++)await new Promise(r=>setTimeout(r,10));assert.ok(commitHeld,'fair commit reached isolated storage barrier');};
  return{connect,advance,waitCommit,releaseCommit:()=>child.send({type:'releaseCommit'}),logs:()=>logs};
}

test('real authenticated fair WS: five receipt-timed shots debit once, replay and reconnect preserve gold', {timeout:20000},async t=>{
  const f=await fixture(t),p=await f.connect();assert.equal(p.initial.gold,1000);
  const start=await p.fair({action:'start',game:'balloons',stake:100,seed:0,hits:5,gross:999999});
  assert.ok(start.ok,JSON.stringify(start));assert.equal(start.round.shots,0);
  assert.equal((await p.sync()).gold,1000,'start is free');
  const round=start.round.id;
  const shot={action:'shot',round,x:0,y:0,hits:5,elapsedMs:19000,seed:0,payout:999999};
  const firstId=randomUUID(),first=await p.fair(shot,firstId);
  assert.ok(first.ok);assert.equal(first.round.shots,1);assert.equal(first.round.hits,0);
  assert.deepEqual(await p.fair(shot,firstId),first,'accepted shot replay never advances');
  const early=await p.fair(shot);assert.equal(early.ok,false);assert.equal(early.why,'shot_rate');
  let final,finalId;
  for(let i=1;i<5;i++){
    await f.advance(500);finalId=randomUUID();final=await p.fair(shot,finalId);assert.ok(final.ok,JSON.stringify(final));
    if(i<4){assert.equal(final.round.shots,i+1);assert.equal((await p.sync()).gold,1000);}
  }
  assert.equal(final.result.shots,5);assert.equal(final.result.hits,0);
  assert.equal(final.result.net,-skillFee(100,0));assert.equal((await p.sync()).gold,900);
  assert.deepEqual(await p.fair(shot,finalId),final,'completion replay never debits twice');
  assert.equal((await p.fair(shot)).ok,false,'sixth shot cannot settle another fee');
  await p.close();const rejoined=await f.connect();assert.equal(rejoined.initial.gold,900);
  assert.deepEqual(await rejoined.fair(shot,finalId),final,'lost completion acknowledgement is recoverable after reconnect');
  assert.equal((await rejoined.sync()).gold,900);
  assert.doesNotMatch(f.logs(),/unhandled|message .*Error/);
});

test('real authenticated fair WS: dice use server faces and durable request replay across reconnect', {timeout:15000},async t=>{
  const f=await fixture(t,{game:'dice'}),p=await f.connect(),request=randomUUID();
  const payload={action:'start',game:'dice',stake:20,symbol:'gourd',faces:['gourd','gourd','gourd'],gross:999999};
  const result=await p.fair(payload,request);assert.ok(result.ok,JSON.stringify(result));
  assert.equal(result.result.faces.length,3);assert.ok(result.result.faces.every(n=>DICE_SYMBOLS.includes(n)));
  const gross=dicePayout(20,'gourd',result.result.faces);
  assert.equal(result.result.gross,gross);assert.equal(result.result.net,gross-20);
  const balance=1000+gross-20;assert.equal((await p.sync()).gold,balance);
  assert.deepEqual(await p.fair(payload,request),result);
  const changed=await p.fair({...payload,stake:50},request);assert.equal(changed.ok,false);assert.equal(changed.why,'request_reused');
  await p.close();const rejoined=await f.connect();assert.equal(rejoined.initial.gold,balance);
  assert.deepEqual(await rejoined.fair(payload,request),result,'same durable outcome, no reroll or second settlement');
  assert.equal((await rejoined.sync()).gold,balance);
});

test('real fair WS: disconnect interrupts an unfinished skill round for zero charge', {timeout:15000},async t=>{
  const f=await fixture(t,{game:'dolls'}),p=await f.connect();
  const started=await p.fair({action:'start',game:'dolls',stake:100});assert.ok(started.ok,JSON.stringify(started));
  assert.ok((await p.fair({action:'shot',round:started.round.id,x:0,y:0})).ok);
  await p.close();const rejoined=await f.connect();assert.equal(rejoined.initial.gold,1000);
  const status=await rejoined.fair({action:'status'});assert.ok(status.ok);assert.equal(status.round,null);
  assert.equal((await rejoined.fair({action:'shot',round:started.round.id,x:0,y:0})).ok,false);
  assert.equal((await rejoined.sync()).gold,1000);
});

test('real fair WS: server deadline defeats forged elapsed time and leaves unfinished rounds uncharged', {timeout:15000},async t=>{
  const f=await fixture(t),p=await f.connect();
  const started=await p.fair({action:'start',game:'balloons',stake:100});assert.ok(started.ok,JSON.stringify(started));
  await f.advance(20000);
  const expired=await p.fair({action:'shot',round:started.round.id,x:0,y:0,elapsedMs:0,remainingMs:20000});
  assert.equal(expired.ok,false,'exclusive server deadline cannot be reset by client clock');
  const status=await p.fair({action:'status'});assert.ok(status.ok);assert.equal(status.round,null);
  assert.equal((await p.sync()).gold,1000);
});

test('real fair WS: signed-in opening boundaries, map, proximity, collision and affordability fail closed', {timeout:30000},async t=>{
  const site=FAIR_SITES.find(s=>s.id==='dice');
  const cases=[
    {name:'day',hour:12,why:'closed'},
    {name:'dawn',hour:5,why:'closed'},
    {name:'dusk',hour:16.5,ok:true},
    {name:'night',hour:0,ok:true},
    {name:'guest',signedIn:false,why:'auth'},
    {name:'wrong map',location:{map:'paddy',x:0,z:-130},why:'range'},
    {name:'outside range',location:{map:'city',x:site.approach.x+5,z:site.approach.z},why:'range'},
    {name:'inside solid stall',location:{map:'city',x:site.x,z:site.z},why:'range'},
    {name:'unaffordable full stake',gold:19,why:'gold'},
  ];
  for(const c of cases)await t.test(c.name,async sub=>{
    const f=await fixture(sub,{game:'dice',...c}),p=await f.connect(c.signedIn!==false);
    const result=await p.fair({action:'start',game:'dice',stake:20,symbol:'gourd',hour:21});
    assert.equal(result.ok,!!c.ok,JSON.stringify(result));if(!c.ok)assert.equal(result.why,c.why);
    if(c.signedIn!==false&&!c.ok)assert.equal((await p.sync()).gold,c.gold??1000);
  });
});

test('real fair commit blocks vault access and incoming trade while replay stays on the pending settlement', {timeout:15000},async t=>{
  const f=await fixture(t,{game:'dice',holdCommit:true}),p=await f.connect(),peer=await f.connect(true,true);
  const request=randomUUID(),payload={t:'fair',request,action:'start',game:'dice',stake:20,symbol:'fish'};
  p.send(payload);await f.waitCommit();
  p.send({t:'stash_open',npc:'warp_city_market',request:randomUUID()});
  const vault=await p.wait(m=>m.t==='stash_result');assert.equal(vault.ok,false);assert.equal(vault.why,'busy');
  peer.send({t:'treq',id:p.id});assert.equal((await peer.wait(m=>m.t==='tno')).why,'busy');
  // Another fair packet passes the index's global busy gate and is rejected by
  // the service; an identical request attaches to the already pending receipt.
  p.send({...payload,request:randomUUID()});
  assert.equal((await p.wait(m=>m.t==='fair_result'&&m.request!==request)).why,'busy');
  p.send(payload);f.releaseCommit();
  const first=await p.wait(m=>m.t==='fair_result'&&m.request===request);
  const duplicate=await p.wait(m=>m.t==='fair_result'&&m.request===request);
  assert.ok(first.ok,JSON.stringify(first));assert.deepEqual(duplicate,first);
  assert.equal((await p.sync()).gold,1000+first.result.net);
  // Same keeper outside a pending commit returns the normal range rejection,
  // proving this fixture reached the actual busy authorization path above.
  p.send({t:'stash_open',npc:'warp_city_market',request:randomUUID()});
  assert.equal((await p.wait(m=>m.t==='stash_result')).why,'far');
  peer.send({t:'treq',id:p.id});await p.wait(m=>m.t==='treq'&&m.from===peer.id);
  assert.equal((await peer.sync()).gold,1000);
});
