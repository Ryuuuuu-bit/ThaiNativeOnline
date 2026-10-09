import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EXPEDITIONS} from '../src/world/expeditions.js';
import {MAPS,MAP_IDS,resolveLocation} from '../src/world/maps.js';
import {Presence} from '../server/presence.js';
import {MonsterWorld} from '../server/monsters.js';
import {monsterInterest} from '../server/interest.js';
import {navigation} from '../server/navigation.js';
import {HUNTING_GROUNDS,huntingFor} from '../src/data/hunting.js';
import {MONSTERS} from '../src/combat/data/monsters.js';
import {LOOT} from '../src/combat/data/loot.js';
import {ITEMS} from '../src/character/data/items.js';
import {Character} from '../src/character/Character.js';
import {MAX_LEVEL,expToNext} from '../src/character/data/progression.js';
import {nearShop} from '../src/data/shopSites.js';
import {createRng} from '../src/world/rng.js';

test('level 100 is reachable and capped in the playable character model',()=>{
 const c=new Character({name:'test',classId:'hunter',level:99});c.gainExp(expToNext(99));assert.equal(MAX_LEVEL,100);assert.equal(c.level,100);c.gainExp(1e12);assert.equal(c.level,100);assert.equal(c.exp,0);
});
test('every level from 1 to 100 has an ordinary farm monster',()=>{
 const levels=HUNTING_GROUNDS.flatMap(c=>c.roster.map(r=>MONSTERS[r.type].level));
 for(let lv=1;lv<=100;lv++)assert.ok(levels.some(m=>Math.abs(m-lv)<=3),`no on-level hunt for ${lv}`);
 for(const [id,n] of Object.entries({paddy:8,deep_forest:10,wat_rang:10,klong:12}))assert.equal(huntingFor(id).length,n);
 for(const e of EXPEDITIONS){assert.equal(huntingFor(e.id).length,12);assert.equal(new Set(huntingFor(e.id).map(c=>c.loop)).size,3);}
});
test('server accepts every expedition room, valid exits and saved positions',()=>{
 for(const map of Object.values(MAPS))for(const gate of map.portals){
  const p=new Presence(),ws={};const r=p.join(ws,{name:'QA',cls:'hunter',lv:100,map:map.id,x:gate.at.x,z:gate.at.z});assert.equal(r.map,map.id);
  const change=p.changeMap(ws,{map:gate.to,...gate.arrive});assert.equal(change?.map,gate.to,gate.id);
  assert.equal(resolveLocation({map:gate.to,...gate.arrive}).map,gate.to);
 }
 assert.equal(MAP_IDS.length,14);
});
test('expedition suppliers and all drops are recognized by the authoritative economy',()=>{
 for(const e of EXPEDITIONS){assert.ok(nearShop(`supplies_${e.id}`,e.id,18,e.top-24));assert.ok(!nearShop(`supplies_${e.id}`,e.id,18,e.top-90));
  for(let i=0;i<4;i++){const m=MONSTERS[`${e.id}_${i}`];assert.ok(m);for(const [item] of LOOT[m.loot])assert.ok(ITEMS[item],item);}
 }
 const c=new Character({name:'QA',classId:'hunter',level:1});c.addItem('demon_rift_bow');const idx=c.inventory.findIndex(i=>i?.id==='demon_rift_bow');assert.equal(c.equip(idx),false);c.level=100;assert.equal(c.equip(idx),true);
});
test('interest sends entering monsters once, excludes distant rows and refreshes on re-entry',()=>{
 const m={id:1,x:0,z:0,f:0,hp:100,state:'idle'},far={...m,id:2,x:200};
 let s=monsterInterest([m,far],[],{x:0,z:0});assert.deepEqual(s.rows.map(r=>r[0]),[1]);assert.equal(monsterInterest([m,far],[],{x:0,z:0},s.visible).rows.length,0);
 s=monsterInterest([m,far],[],{x:200,z:0},s.visible);assert.deepEqual(s.rows.map(r=>r[0]),[2]);s=monsterInterest([m,far],[],{x:0,z:0},s.visible);assert.deepEqual(s.rows.map(r=>r[0]),[1]);
});
test('idle AI sleeps far away but wakes immediately near an eligible player',()=>{
 const w=new MonsterWorld('demon_rift',{idleRadius:96,random:createRng(19),navigation:navigation('demon_rift')});w.update(3,[],'day');
 const m=w.monsters.find(m=>m.alive&&!m.def.boss),before={x:m.x,z:m.z};for(let i=0;i<40;i++)w.update(.1,[{id:1,x:0,z:-2584,lv:100}],'day');
 // A separately controlled far idle monster must not wander while outside interest.
 m.x=95;m.z=-2710;m.home={x:m.x,z:m.z};m.state='idle';m.wanderTimer=0;const pos=[m.x,m.z];w.update(.1,[],'day');assert.deepEqual([m.x,m.z],pos);
 w.update(.1,[{id:2,x:m.x+1,z:m.z,lv:m.def.level}],'day');assert.equal(m.state,'chase');
});
