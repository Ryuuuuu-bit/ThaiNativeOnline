import test from 'node:test';
import assert from 'node:assert/strict';
import { rollLootDrops, keptLootDrops } from '../src/combat/lootDrops.js';
import { LOOT } from '../src/combat/data/loot.js';
import { MONSTERS } from '../src/combat/data/monsters.js';
import { ITEMS } from '../src/character/data/items.js';
import { cleanRoll } from '../src/character/data/affixes.js';
import { Character } from '../src/character/Character.js';
import { MonsterWorld } from '../server/monsters.js';
import { Combatants, sane } from '../server/combatants.js';
import { applyOp, fromSave, reconcileSave } from '../server/progress.js';
import { cleanOffer, offerWhy, swap, Trades } from '../server/trades.js';
import { emptyStash, stashIdentity, cleanStashMove, planStashMove } from '../src/data/stash.js';
import { shopSpot } from '../src/data/shopSites.js';

const iid = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const roll = n => ({ v:1, iid:iid(n), level:1, rarity:'magic', affixes:[{id:'vital',tier:1,value:20}] });
const item = n => ({id:'cloth_vest',qty:1,roll:roll(n)});
const hero = (...items) => {const c=Character.create('Affix','warrior'); c.inventory=Array(24).fill(null);items.forEach((s,i)=>c.inventory[i]=s);return c;};
const randomPool = def => {let n=0;const skip=(LOOT[def.loot]??[]).length;return ()=>n++<skip?.999:n===skip+1?0:n===skip+2?.5:n===skip+3?.8:.2;};

test('every species has at most one additional equipment drop; legacy rows still roll separately',()=>{
 for(const def of Object.values(MONSTERS)) {
  const drops=rollLootDrops({...def,loot:'missing'},{random:(()=>{let n=0;return()=>n++===0?0:.2;})(),uuid:()=>iid(1)});
  assert.equal(drops.length,1);assert.equal(ITEMS[drops[0].id].type,'equip');assert.equal(drops[0].qty,1);
 }
 const def={...MONSTERS.boar};const drops=rollLootDrops(def,{random:()=>0,uuid:()=>iid(1)});
 assert.equal(drops.length,(LOOT[def.loot]??[]).length+1);
 for(const [id,,min] of LOOT[def.loot]) assert.ok(drops.some(d=>d.id===id&&d.qty===min));
});
test('generated pool affixes carry monster level and server UUID exactly once',()=>{
 const def=MONSTERS.boar;let ids=0;const drops=rollLootDrops(def,{random:randomPool(def),uuid:()=>iid(++ids)});
 assert.equal(drops.length,1);assert.ok(cleanRoll(drops[0].id,drops[0].roll));assert.equal(drops[0].roll.level,def.level);assert.equal(ids,1);
});
test('legacy equipment drops receive rolls too, without rerolling materials',()=>{
 const rows=LOOT.beast;let n=0, ids=0;const drops=rollLootDrops({...MONSTERS.boar,loot:'beast'}, {random:()=>n++<rows.length*2+2?0:.8,uuid:()=>iid(++ids)});
 for(const d of drops.filter(d=>ITEMS[d.id].type==='equip')) assert.ok(cleanRoll(d.id,d.roll));
 assert.ok(drops.some(d=>ITEMS[d.id].type==='material'&&!d.roll));assert.equal(ids,drops.filter(d=>d.roll).length);
});
test('pool probability scales by world-boss rank multiplier and clamps at one',()=>{
 const def={...MONSTERS.boar,loot:'missing',boss:true};let n=0;
 assert.equal(rollLootDrops(def,{random:()=>n++===0?.9:.2,multiplier:2}).length,1);
 assert.equal(rollLootDrops(def,{random:()=>.9,multiplier:1}).length,0);
 assert.equal(rollLootDrops(def,{random:()=>0,multiplier:0}).length,0);
});
test('actual authoritative MonsterWorld rewards tag owned drops and preserve top ownership',()=>{
 const w=new MonsterWorld('test',{zones:[{type:'boar',x:0,z:0,count:1}],random:()=>.5}); const m=w.monsters[0];m.contrib=new Map([[1,80],[2,20]]);w.r=randomPool(m.def);
 const events=w.rewards(m,[{id:1,lv:1,x:0,z:0},{id:2,lv:1,x:0,z:0}],false);const top=events.find(e=>e.to===1),other=events.find(e=>e.to===2);
 assert.equal(top.drops.length,1);assert.ok(cleanRoll(top.drops[0].id,top.drops[0].roll));assert.deepEqual(other.drops,[]);
});
test('rewardState keeps exact immutable rolled item, and duplicate identity is lost',()=>{
 const cs=new Combatants(); const c=hero(); const state={c,quests:{onKill(){}},dirty:false}; const d=item(1);
 assert.deepEqual(cs.rewardState(state,1,{drops:[d]}),{});assert.deepEqual(c.inventory[0],d);
 assert.deepEqual(cs.rewardState(state,1,{drops:[d]}).lost,[d]);assert.equal(c.inventory.filter(Boolean).length,1);
});
test('lost drop matching uses iid and consumes only one common stack occurrence',()=>{
 const a=item(1),b=item(2),common={id:'cloth_vest',qty:1};assert.deepEqual(keptLootDrops([a,b],[a]),[b]);assert.deepEqual(keptLootDrops([common,common],[common]),[common]);
});
test('fromSave and authoritative reconciliation preserve exact roll and reject browser replacement',()=>{
 const c=hero(item(1));c.equip(0);const truth=c.toJSON(); const loaded=fromSave(truth);assert.deepEqual(loaded.gearRolls.armor,roll(1));
 const sent={...truth,gearRolls:{armor:roll(2)}}; const result=reconcileSave({'tno.character.v1':JSON.stringify(sent)},truth);
 assert.deepEqual(JSON.parse(result['tno.character.v1']).gearRolls.armor,roll(1));
 const fresh=JSON.parse(reconcileSave({'tno.character.v1':JSON.stringify(sent)},null)['tno.character.v1']);assert.ok(!Object.values(fresh.gearRolls).some(Boolean));
});
test('guest sheets do not grant forged rolled bonuses or refinement',()=>{
 const data=hero().toJSON();data.gearRolls={armor:roll(1)};data.refine={armor:10};const c=sane(data,'warrior'); assert.ok(!Object.values(c.gearRolls).some(Boolean));assert.equal(c.refine.armor,0);
});
test('bag operations reject missing/wrong iid and select exact duplicate base',()=>{
 const c=hero(item(1),item(2));assert.equal(applyOp(c,{op:'equip',id:'cloth_vest'}),false);assert.equal(applyOp(c,{op:'equip',id:'cloth_vest',iid:iid(3)}),false);
 assert.equal(applyOp(c,{op:'equip',id:'cloth_vest',iid:iid(2),roll:roll(3)}),true);assert.equal(c.gearRolls.armor.iid,iid(2));assert.equal(c.inventory[0].roll.iid,iid(1));
 assert.equal(applyOp(c,{op:'unequip',slot:'armor'}),false);assert.equal(applyOp(c,{op:'unequip',slot:'armor',iid:iid(2)}),true);
});
test('trade offers discard affix payloads and reject missing, wrong or duplicate iid',()=>{
 const c=hero(item(1),item(2));const plain=cleanOffer({items:[{id:'cloth_vest',qty:1,roll:roll(3)}]});assert.ok(!plain.items[0].roll);assert.equal(offerWhy(c,plain),'missing');
 const good=cleanOffer({items:[{id:'cloth_vest',qty:1,iid:iid(2),roll:roll(3)}]});assert.equal(offerWhy(c,good),null);assert.ok(!good.items[0].roll);
 assert.equal(offerWhy(c,{items:[good.items[0],good.items[0]],gold:0}),'missing');assert.equal(cleanOffer({items:[{id:'cloth_vest',iid:'forged'}]}),null);
});
test('trade server display and transfer retain original roll; stale replay cannot transfer again',()=>{
 const a=hero(item(1)),b=hero();const t=new Trades();t.request(1,2);t.accept(2,1);const request={items:[{id:'cloth_vest',qty:1,iid:iid(1),roll:roll(2)}],gold:0};assert.equal(t.offer(1,request,a),true);
 const owned=t.of(1).offer[1];assert.deepEqual(owned.items[0].roll,roll(1));assert.equal(swap(a,b,owned,{items:[],gold:0}).ok,true);assert.deepEqual(b.inventory[0],item(1));assert.equal(swap(a,b,owned,{items:[],gold:0}).ok,false);
});
test('stash uses vault UID separately from iid, rejecting changed instance and retaining metadata',()=>{
 const c=hero(item(1),item(2));const move={request:'request_001',revision:0,action:'deposit',index:0,qty:1,expected:stashIdentity(item(1))};const clean=cleanStashMove({...move,expected:{...move.expected,roll:roll(3)}});assert.ok(!clean.expected.roll);assert.equal(clean.expected.iid,iid(1));
 const wrong=planStashMove(c.toJSON(),emptyStash(),{...clean,expected:stashIdentity(item(2))},()=>iid(9));assert.equal(wrong.why,'item_changed');
 const dep=planStashMove(c.toJSON(),emptyStash(),clean,()=>iid(9));assert.equal(dep.stash.slots[0].uid,iid(9));assert.equal(dep.stash.slots[0].roll.iid,iid(1));
 const wd=planStashMove({...c.toJSON(),inventory:dep.inventory},dep.stash,{request:'request_002',revision:1,action:'withdraw',uid:iid(9),qty:1},()=>iid(10));assert.equal(wd.ok,true);assert.deepEqual(wd.inventory[0],item(1));
 const replay=planStashMove({...c.toJSON(),inventory:wd.inventory},wd.stash,{revision:1,action:'withdraw',uid:iid(9),qty:1},()=>iid(10));assert.equal(replay.why,'stale');
});
test('authoritative refinement refuses iid ambiguity, preserves successful roll and destroys broken piece',()=>{
 const c=hero(item(1),item(2));c.gold=100000;c.addItem('gold_leaf',100);const cs=new Combatants({now:()=>100,random:()=>0});const state={c,persist:{},ack:0,fightAt:0,quests:{}};cs.list.set(1,state);const at=shopSpot('enhance');
 assert.equal(cs.op(1,{op:'refine',id:'cloth_vest'},{...at}),false);
 assert.equal(cs.op(1,{op:'refine',id:'cloth_vest',iid:iid(2)},{...at}),true);assert.equal(c.inventory[1].plus,1);assert.deepEqual(c.inventory[1].roll,roll(2));assert.equal(c.inventory[0].plus,undefined);
 c.inventory[1].plus=4;cs.r=()=>.99;assert.equal(cs.op(1,{op:'refine',id:'cloth_vest',plus:4,iid:iid(2)},{...at}),true);assert.equal(c.inventory[1],null);assert.equal(c.inventory[0].roll.iid,iid(1));
});
import { Emitter } from '../src/character/Emitter.js';
import { attachNetProgress } from '../src/net/NetProgress.js';
import { attachNetCombat } from '../src/net/NetCombat.js';
import { Combat } from '../src/combat/Combat.js';
const netFor = c => {const net=new Emitter();net.online=true;net.messages=[];net.send=m=>net.messages.push(m);attachNetProgress(net,c);net.emit('sync',{c:{...c.toJSON(),ack:0}});return net;};
test('NetProgress sync adopts server rolls and serializes references without affix values',()=>{
 const c=hero(item(1),item(2)),net=netFor(c);assert.equal(c.equip(1),true);const msg=net.messages.at(-1);assert.equal(msg.iid,iid(2));assert.ok(!msg.roll&&!msg.affixes);
 const server=hero(item(1));server.gearRolls.armor=roll(2);net.emit('sync',{c:{...server.toJSON(),ack:1}});assert.deepEqual(c.gearRolls.armor,roll(2));assert.deepEqual(c.inventory[0].roll,roll(1));
 c.refineGear('armor');assert.equal(net.messages.at(-1).iid,iid(2));assert.ok(!net.messages.at(-1).roll);
});
test('NetProgress strip and bag card targets retain exact iid',()=>{
 const c=hero({...item(1),cards:['card_boar']},item(2));const net=netFor(c);c.stripCards(0);assert.equal(net.messages.at(-1).iid,iid(1));assert.ok(!net.messages.at(-1).roll);
});
test('NetCombat retains received server rolls and loses only the identified instance',()=>{
 const c=hero(),combat=new Combat(c,{playerPos:()=>({x:0,z:0}),canStand:()=>true}),net=new Emitter();net.online=true;net.send=()=>{};
 attachNetCombat(net,{game:{combat,character:c},clock:{paused:true}});net.emit('kill',{id:1,exp:0,gold:0,drops:[item(1),item(2)],lost:[item(1)]});assert.deepEqual(c.inventory.filter(Boolean),[item(2)]);
});
test('late refinement feedback for another identical base iid cannot resolve the current attempt',()=>{
 const c=hero(item(1),item(2));c.gold=10000;const net=netFor(c),results=[];c.on('refined',r=>results.push(r));c.refineGear(1);
 net.emit('refined',{ok:true,item:'cloth_vest',to:1,outcome:'up',iid:iid(1)});assert.equal(results.length,0);
 net.emit('refined',{ok:true,item:'cloth_vest',to:1,outcome:'up',iid:iid(2)});assert.equal(results.length,1);
});
import { equipmentPool, equipmentLootLevel } from '../src/combat/data/equipment-loot.js';
test('actual scaled world bosses select the effective high/low level pool without changing legacy tables',()=>{
 const legacyBefore=JSON.stringify(LOOT.ghost_sisters);
 for (const level of [12,99]) {
  const w=new MonsterWorld('test',{zones:[{type:'ghost_red',x:0,z:0,count:1}],random:()=>.5});
  const m=w.monsters[0];m.tier={lv:level,hp:1};m.contrib=new Map([[1,100]]);
  const pool=equipmentPool({...m.def,level});
  const target=level===99?pool.find(x=>equipmentLootLevel(x.id)>=85):pool.at(-1);
  assert.ok(target);const total=pool.reduce((n,x)=>n+x.weight,0),index=pool.indexOf(target);
  const pick=(pool.slice(0,index).reduce((n,x)=>n+x.weight,0)+target.weight/2)/total;
  // Boss rewards draw gold first, then independent legacy rows (including guaranteed quantities).
  const beforePool=1+LOOT[m.def.loot].reduce((n,[,chance])=>n+1+(chance===1?1:0),0);
  let n=0;w.r=()=>{const draw=n++;return draw<beforePool?.999:draw===beforePool?0:draw===beforePool+1?pick:0;};
  const reward=w.worldBossRewards([m],[{id:1,lv:level,x:0,z:0}],false).find(e=>e.t==='kill');
  const equipment=reward.drops.filter(d=>ITEMS[d.id]?.type==='equip');
  assert.equal(equipment.at(-1).id,target.id);
  if(level===99) assert.ok(equipmentLootLevel(equipment.at(-1).id)>=85);
  else assert.ok(equipmentLootLevel(equipment.at(-1).id)<=12);
  assert.equal(m.def.level,12);
 }
 assert.equal(JSON.stringify(LOOT.ghost_sisters),legacyBefore);
});
test('legacy worn-card aliases keep exact rolled identity checks on the actual target slot',()=>{
 for(const alias of [1,true,'worn','weapon']) {
  const c=hero();c.gearRolls.weapon=roll(1);c.addItem('card_boar',1);
  assert.equal(applyOp(c,{op:'card',id:'card_boar',worn:alias}),false);
  assert.equal(applyOp(c,{op:'card',id:'card_boar',worn:alias,iid:iid(2)}),false);
  assert.equal(applyOp(c,{op:'card',id:'card_boar',worn:alias,iid:iid(1)}),true);
  assert.deepEqual(c.cards.weapon,['card_boar']);assert.equal(c.gearRolls.weapon.iid,iid(1));
 }
 const armor=hero();armor.gearRolls.armor=roll(2);armor.addItem('card_pop',1);
 assert.equal(applyOp(armor,{op:'card',id:'card_pop',worn:1,iid:iid(2)}),true);assert.deepEqual(armor.cards.armor,['card_pop']);
 const c=hero();c.gearRolls.weapon=roll(3);c.addItem('card_boar',1);const net=netFor(c);
 assert.equal(c.insertCard(c.inventory.findIndex(s=>s?.id==='card_boar'),'worn'),true);assert.equal(net.messages.at(-1).iid,iid(3));assert.ok(!net.messages.at(-1).roll);
});
