import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {navigation,collisionSourceHash} from '../server/navigation.js';
import {collisionSourceHash as sourceHash} from '../tools/collision-source-hash.js';
import {Presence} from '../server/presence.js';
import {MAPS} from '../src/world/maps.js';
import {Pvp} from '../server/pvp.js';
import {KARMA,SIN_RANKS,MERIT_RANKS,settleKill,karmaRank,karmaTier,shopMarkup} from '../src/data/karma.js';
import {buy,buyPrice,stockOf} from '../src/shop/ShopSystem.js';
import {SHOPS} from '../src/data/shops.js';
import {ITEMS} from '../src/character/data/items.js';
import {Combatants} from '../server/combatants.js';
import {Character} from '../src/character/Character.js';
import {SaveQueue} from '../server/save-queue.js';
import {Accounts} from '../server/accounts.js';
import {MemoryStore} from '../server/store.js';
import {createShutdown} from '../server/shutdown.js';
import {recallWhy} from '../server/recall.js';
import {MonsterWorld} from '../server/monsters.js';
import {PartyFollow} from '../src/net/PartyFollow.js';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const hero=(id,lv=1)=>({id,lv,signed:true,map:'paddy',room:'paddy',x:id,z:-130});

test('baked collisions match current world sources and every spawn is safe',()=>{
  assert.equal(collisionSourceHash,sourceHash(),'Run tools/export-collision.cjs after world changes');
  for(const [id,m]of Object.entries(MAPS))assert.ok(navigation(id).canStand(m.spawn.x,m.spawn.z),id);
});
test('server refuses tunnelling through a real tree even with legal speed credit',()=>{
  const data=JSON.parse(readFileSync(new URL('../server/data/collision.json',import.meta.url),'utf8'));
  let found;
  const nav=navigation('paddy');
  for(const s of data.maps.paddy.shapes.filter(s=>s.t===0&&s.r<2)){
    const a={x:s.x-s.r-.6,z:s.z},b={x:s.x+s.r+.6,z:s.z};
    if(nav.canStand(a.x,a.z)&&nav.canStand(b.x,b.z)){found={a,b};break;}
  }
  assert.ok(found); assert.equal(nav.clear(found.a,found.b),false);
  const P=new Presence({navigation,now:()=>1}); P.join('a',{map:'paddy',...found.a});
  assert.equal(P.move('a',{...found.b}),false); assert.equal(P.players.get('a').x,found.a.x);
  assert.equal(nav.canStand(Infinity,0),false);assert.equal(nav.canStand(3000,3000),false);
  assert.equal(nav.clear(found.a,{x:NaN,z:0}),false);
});
test('monster movement respects swept collision and spawn never enters blocked ground',()=>{
  const nav={canStand:(x,z)=>x<=0,clear:(a,b)=>b.x<=0};
  const w=new MonsterWorld('paddy',{navigation:nav,zones:[],random:()=>.5});
  const m=w.make({type:'boar',x:1,z:-130,radius:3});assert.ok(w.spawn(m));assert.ok(m.x<=0);
  Object.assign(m,{x:0,z:0});w.step(m,{x:10,z:0},10,1);assert.equal(m.x,0);
});
test('duels require a fresh acceptance; city, guests and unrelated players are protected',()=>{
  let t=0;const p=new Pvp({now:()=>t}),a=hero(1),b=hero(2),c=hero(3);
  assert.equal(p.canAttack(a,b),'level');assert.equal(p.accept(b,a).why,'expired');
  assert.equal(p.request(a,{...b,map:'city',room:'paddy'}),'safe');
  assert.equal(p.request(a,{...b,signed:false}),'guest');
  assert.equal(p.request(a,b),null);assert.ok(p.accept(b,a).duel);
  assert.equal(p.canAttack(a,b),null);assert.equal(p.canAttack(a,c),'duel');
  t=181;assert.equal(p.sweep(id=>id===1?a:b)[0].why,'timeout');assert.equal(p.canAttack(a,b),'level');
});
test('free PK opens at Lv 20 outside the city, protects lower levels and spares party members',()=>{
  let t=0;const p=new Pvp({now:()=>t}),a=hero(1,20),b=hero(2,35),low=hero(3,19);
  assert.equal(p.canAttack(a,b),null);assert.equal(p.canAttack(b,a),null);
  assert.equal(p.canAttack(a,low),'protected');assert.equal(p.canAttack(low,a),'level');
  assert.equal(p.canAttack({...a,map:'city',room:'city'},{...b,map:'city',room:'city'}),'safe');
  assert.equal(p.canAttack({...a,signed:false},b),'guest');
  assert.equal(p.canAttack({...a,party:1},{...b,party:1}),'party');
  assert.equal(p.open(a),true);assert.equal(p.open(low),false);assert.equal(p.open({...a,map:'city'}),false);
  // whoever strikes first may be answered in self-defence for a minute
  p.touch(1,2);assert.equal(p.provoked(1,2),true);assert.equal(p.provoked(2,1),false);
  t=61;p.sweep(()=>null);assert.equal(p.provoked(1,2),false);
});
test('บาป บุญ: murder, justice and self-defence; lifetime points; ten ranks a side; shop markup; PK titles',()=>{
  assert.deepEqual(settleKill({victimSin:0}),{kind:'murder',sin:KARMA.sinPerMurder,merit:0});
  assert.equal(settleKill({victimSin:0,provoked:true}).kind,'defense');
  const j=settleKill({victimSin:200});assert.equal(j.kind,'justice');assert.equal(j.merit,Math.round(KARMA.meritBase+200*KARMA.meritShare));
  assert.equal(settleKill({victimSin:999999}).merit,Math.round(KARMA.meritBase+KARMA.meritSinCap*KARMA.meritShare));   // capped per kill
  assert.equal(settleKill({victimSin:KARMA.redAt-1}).kind,'murder');
  assert.equal(settleKill({victimSin:KARMA.redAt,provoked:true}).kind,'justice');   // a หัวแดง who struck first is still justice
  assert.equal(karmaTier(0),'');assert.equal(karmaTier(1),'stain');assert.equal(karmaTier(KARMA.redAt),'red');
  assert.equal(SIN_RANKS.length,10);assert.equal(MERIT_RANKS.length,10);
  assert.equal(karmaRank({sin:0,merit:0}),null);assert.equal(karmaRank({merit:500}).name,'หลวง');
  assert.equal(karmaRank({sin:150,merit:5000}).kind,'merit');assert.equal(karmaRank({sin:3000,merit:400}).kind,'sin');   // the higher rank shows, sin on a tie
  assert.equal(karmaRank({sin:50000}).name,'จ้าวนรกอเวจี');assert.equal(karmaRank({merit:50000}).name,'ตำนานผู้พิทักษ์ธรรม');
  assert.equal(shopMarkup(0),0);assert.equal(shopMarkup(1),.01);assert.equal(shopMarkup(1e9),KARMA.maxMarkup);
  const shopper=Character.create('shop','muaythai');shopper.rec.sin=50000;shopper.gold=1e6;
  assert.equal(ITEMS.potion_s.price,10);assert.equal(buyPrice(shopper,'potion_s'),11);shopper.rec.sin=1;assert.equal(buyPrice(shopper,'potion_s'),11);shopper.rec.sin=0;assert.equal(buyPrice(shopper,'potion_s'),10);shopper.rec.sin=50000;
  const before=shopper.gold;assert.ok(buy(shopper,Object.keys(SHOPS).find(k=>stockOf(k).includes('potion_s')),'potion_s',1).ok);assert.equal(before-shopper.gold,11);
  const c=Character.create('test','muaythai');c.note('sin',3);c.noteKill('boar');assert.equal(c.rec.sin,3);   // monsters never touch บาป
  c.note('pkKill');c.note('redKill');c.note('duelWin');c.note('merit',1000);c.checkTitles();
  for(const id of ['pk1','redhunt1','duel1','merit1000'])assert.ok(c.titles.includes(id),id);
  const back=new Character(c.toJSON());assert.equal(back.rec.sin,3);assert.equal(back.rec.merit,1000);
});
test('duel knockout leaves one HP without rewards and shares PvE basic rate limits',()=>{
  const cs=new Combatants({now:()=>0,random:()=>.5});
  for(const id of [1,2])cs.load(id,Character.create('test','muaythai').toJSON(),{account:'test'+id,slot:0});
  const a=cs.get(1),b=cs.get(2);b.c.hp=1;const gold=b.c.gold,exp=a.c.exp;
  const r=cs.pvpBasic(1,2,{knockout:true});assert.ok(r.won);assert.equal(b.c.hp,1);assert.equal(b.c.gold,gold);assert.equal(a.c.exp,exp);
  cs.pvpBasic(1,2);assert.equal(cs.pvpBasic(1,2),null);assert.equal(b.dirty,true);
});
test('save queue retries in order and other characters are not blocked',async()=>{
  const q=new SaveQueue({retryMs:5,maxRetryMs:5}),out=[];let tries=0;
  const first=q.run('a',async()=>{if(++tries<3)throw Error('offline');out.push(1);});
  const next=q.run('a',()=>out.push(2));await q.run('b',()=>out.push('b'));
  await q.wait();await Promise.all([first,next]);assert.deepEqual(out,['b',1,2]);assert.equal(tries,3);
});
test('waiting snapshots coalesce without crossing API save barriers',async()=>{
  const q=new SaveQueue(),out=[];let release;
  const held=q.run('a',()=>new Promise(r=>release=r));
  const s=q.run('a',()=>out.push(1),{snapshot:true});q.run('a',()=>out.push(2),{snapshot:true});
  const api=q.run('a',()=>out.push('api'));
  const final=q.run('a',()=>out.push(3),{snapshot:true});q.run('a',()=>out.push(4),{snapshot:true});
  release();await Promise.all([held,s,api,final]);assert.deepEqual(out,[2,'api',4]);
});
test('accounts retry captured final state and API saves cannot overwrite server progress',async()=>{
  const store=new MemoryStore(),A=new Accounts(store),c=Character.create('test','hunter').toJSON();
  await A.save('test',0,{'tno.character.v1':JSON.stringify(c)});
  A.writes.retryMs=5;let fail=true;const put=store.putSlot.bind(store);store.putSlot=async(...args)=>{if(fail){fail=false;throw Error('temporary');}return put(...args);};
  const loc={map:'paddy',x:0,z:-130,facing:3};
  c.gold=123;const flush=A.putCharacter('test',0,c,null,loc);c.gold=999;loc.z=999;
  const api=A.save('test',0,{'tno.character.v1':JSON.stringify(c),'tno.location.v1':JSON.stringify({map:'paddy'})});
  await Promise.all([flush,api]);assert.equal((await A.character('test',0)).gold,123);
  // The later API request owns its other keys; another server snapshot restores the authoritative position.
  await A.putCharacter('test',0,{...c,gold:123},null,{map:'paddy',x:0,z:-130,facing:3});
  assert.equal(JSON.parse((await store.listSlots('test'))[0].data['tno.location.v1']).z,-130);
});
test('shutdown freezes, snapshots and waits for retries before closing; signals share one run',async()=>{
  const q=new SaveQueue({retryMs:5}),out=[];let tries=0;
  const shutdown=createShutdown({quiesce:()=>out.push('freeze'),save:()=>{q.run('a',()=>{if(!tries++)throw Error('temporary');out.push('saved');});},drain:ms=>q.wait(null,ms),close:()=>out.push('close')});
  await Promise.all([shutdown(),shutdown()]);assert.deepEqual(out,['freeze','saved','close']);
});
test('shutdown deadline fails visibly rather than claiming success',async()=>{
  let closed=false;const f=createShutdown({quiesce(){},save(){},drain:()=>new Promise(()=>{}),close:()=>closed=true,timeoutMs:15});
  await assert.rejects(f(),/deadline/);assert.equal(closed,false);
});
test('recall refuses death, combat, trade, duels and cooldown',()=>{
  const p=hero(1);assert.equal(recallWhy(p),null);assert.equal(recallWhy({...p,map:'city'}),'city');
  assert.equal(recallWhy({...p,dead:true}),'dead');for(const key of ['fighting','trade','duel'])assert.equal(recallWhy(p,{[key]:true}),'busy');
  assert.equal(recallWhy({...p,recallAt:10},{now:20}),'cooldown');
});
test('party follow routes toward the leader, stops on manual input and never teleports between maps',()=>{
  const inputs={},events={},moves=[];let stopped=0;
  const party={leader:2,members:[{id:1,map:'paddy',ch:1},{id:2,map:'paddy',ch:1,x:10,z:0}]};
  const game={input:{on:(k,f)=>inputs[k]=f},game:{character:{alive:true},combat:{on:(k,f)=>events[k]=f}},maps:{},player:{position:{x:0,z:0}},stopWalk:()=>stopped++,walkTo:(x,z)=>{moves.push({x,z});return true;}};
  const follow=new PartyFollow(game,()=>party,()=>1);follow.toggle();assert.equal(follow.active,true);assert.equal(moves[0].x,8);
  inputs.move();assert.equal(follow.active,false);assert.equal(stopped,1);
  party.members[1].map='city';follow.toggle();assert.equal(follow.active,false);assert.equal(moves.length,1);
});
