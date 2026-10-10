import {test} from 'node:test';
import assert from 'node:assert/strict';
import {MAPS} from '../src/world/maps.js';
import {expeditionTrails,nearExpeditionTrail,EXPEDITION_TRAIL_CLEARANCE} from '../src/world/expedition-trails.js';
import {polylineDistance} from '../src/world/CityMap.js';
import {huntingFor} from '../src/data/hunting.js';

test('all eight expedition maps reserve their painted loop outlines and connectors',()=>{
 for(const map of Object.values(MAPS).filter(m=>m.expedition)){
  const trails=expeditionTrails(map);assert.equal(trails.length,6);
  for(const trail of trails)for(const [x,z] of trail.points)assert.equal(nearExpeditionTrail(x,z,trails),true,`${map.id}/${trail.id}`);
  for(const x of [-93,-59,-17,17,59,93])assert.equal(nearExpeditionTrail(x,map.top-120,trails),true);
  assert.equal(nearExpeditionTrail(105,map.top-120,trails),false);
 }
});

test('camp lantern pillars clear the full walking band including rounded corners',()=>{
 for(const map of Object.values(MAPS).filter(m=>m.expedition)){
  const trails=expeditionTrails(map);
  for(const camp of huntingFor(map.id))for(const side of [-1,1]){
   const x=camp.x+side*13.5,z=camp.z-8;
   const distance=Math.min(...trails.map(t=>polylineDistance(x,z,t.points)));
   assert.ok(distance>2.2+.6+.28,`${map.id}/${camp.id} pillar distance ${distance}`);
  }
 }
});

test('reservation includes body and largest collider without clearing distant forest',()=>{
 assert.ok(EXPEDITION_TRAIL_CLEARANCE > 2.2+2.8*1.6+.28);
 const map=MAPS.bamboo_grave,trails=expeditionTrails(map);
 assert.equal(nearExpeditionTrail(93+6.9,map.top-120,trails),true);
 assert.equal(nearExpeditionTrail(93+7.1,map.top-120,trails),false);
});
