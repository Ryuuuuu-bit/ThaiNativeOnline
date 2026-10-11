import test from 'node:test';
import assert from 'node:assert/strict';
import {cameraRelativeArrow,questGuidance} from '../src/quest/questGuidance.js';
const basis={forward:{x:0,z:-1},right:{x:1,z:0},upScale:1};
const position={x:0,z:0};
const objective={step:{map:'city',x:10,z:0,near:1,name:'ครู'},text:'คุย',reason:''};
const state={objective,position,map:'city',cameraBasis:basis};
test('arrow follows camera rotation, all quadrants and pitch projection rather than world north',()=>{
  for(const [to,angle] of [[{x:0,z:-10},0],[{x:10,z:0},90],[{x:0,z:10},180],[{x:-10,z:0},-90]])assert.equal(cameraRelativeArrow(position,to,basis),angle);
  assert.equal(cameraRelativeArrow(position,{x:10,z:0},{forward:{x:1,z:0},right:{x:0,z:1}}),0);
  assert.ok(Math.abs(cameraRelativeArrow(position,{x:10,z:-10},{...basis,upScale:.5})-63.43494882292201)<1e-9);
  assert.equal(cameraRelativeArrow(position,position,basis),null);
  assert.equal(cameraRelativeArrow(position,{x:NaN,z:1},basis),null);
});
test('idle guidance measures the current real step and clearly labels straight distance',()=>{
  const r=questGuidance(state);assert.equal(r.distance,10);assert.equal(r.distanceKind,'direct');assert.equal(r.label,'ระยะตรง 10 วา');assert.equal(r.arrow,90);
});
test('walking points along the collision path and sums only remaining segments',()=>{
  const route=[{x:0,z:-5},{x:10,z:-5},{x:10,z:0}];
  const r=questGuidance({...state,walking:true,route});assert.equal(r.arrow,0);assert.equal(r.distance,20);assert.equal(r.distanceKind,'path');assert.equal(r.label,'ตามทาง 20 วา');
  const after=questGuidance({...state,position:{x:0,z:-5},walking:true,route:route.slice(1)});assert.equal(after.distance,15);assert.equal(after.arrow,90);
  assert.equal(questGuidance({...state,walking:false,route}).distance,10);
});
test('cross-map direction and distance target the next portal, never remote destination coordinates',()=>{
  const r=questGuidance({...state,objective:{...objective,crossMap:true,destination:{map:'field',x:999,z:999}}});
  assert.equal(r.distance,10);assert.equal(r.arrow,90);assert.match(r.status,/ไปประตู.*ข้ามแล้วกดเดินต่อ/);
  const arrived=questGuidance({...state,position:{x:10,z:0},objective:{...objective,crossMap:true}});assert.equal(arrived.arrow,null);assert.match(arrived.status,/ถึงประตู.*แผนที่ถัดไป/);
});
test('arrival stays manual and does not claim a nearby target while a detour remains',()=>{
  const arrived=questGuidance({...state,position:{x:9,z:0}});assert.ok(arrived.arrived);assert.match(arrived.status,/ด้วยตนเอง/);assert.equal(arrived.arrow,null);
  const detour=questGuidance({...state,position:{x:9,z:0},walking:true,route:[{x:0,z:-5},{x:10,z:0}]});assert.equal(detour.arrived,false);
});
test('live NPC unavailability, invalid path and blocked route never present misleading direction',()=>{
  const unavailable=questGuidance({...state,objective:{...objective,reason:'ครูพักในอาคาร'}});assert.equal(unavailable.arrow,null);assert.equal(unavailable.distance,null);assert.equal(unavailable.status,'ครูพักในอาคาร');
  const wrongMap=questGuidance({...state,map:'field'});assert.equal(wrongMap.distance,null);
  const invalid=questGuidance({...state,walking:true,route:[{x:NaN,z:0}]});assert.equal(invalid.distanceKind,'direct');
  const blocked=questGuidance({...state,message:'เส้นทางถูกกีดขวาง · เดินอ้อม'});assert.match(blocked.status,/กีดขวาง/);
});
