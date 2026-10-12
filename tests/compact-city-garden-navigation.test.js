import test from 'node:test';
import assert from 'node:assert/strict';
import { CITY_NEIGHBORHOODS } from '../src/world/compact-city-neighborhoods.js';
import { COMPACT_CITY, CITY_LAYOUT_REVISION, compactCityCanStand } from '../src/world/compact-city.js';
import { cityPavedAt } from '../src/world/compact-city-streets.js';
import { NPCS } from '../src/data/npcs.js';
import { COMPACT_CITY_SPOTS } from '../src/data/compactCityNpcs.js';
import { CONTACT_PHASES, contactSitesFor } from '../src/data/npcContact.js';
import { SPOT_SITES } from '../src/data/shopSites.js';
import { presentationActivityFor } from '../src/npc/NPCPresentationActivity.js';
import { NavGraph } from '../src/npc/NavGraph.js';
import { findPath, clearLine } from '../src/core/GridPath.js';
import { MAPS, resolveLocation } from '../src/world/maps.js';
import { loginPosition } from '../server/login-state.js';

const qaGardenIds=['garden_quay_w','garden_quay_e','garden_home_banana','garden_fisher_banana_w',
  'garden_fisher_banana_e','garden_east_banana','garden_gate_banana_w','garden_gate_banana_e'];
const qaGardens=qaGardenIds.map(id=>{const g=CITY_NEIGHBORHOODS.find(b=>b.id===id);assert.ok(g,id);return g;});
const qaStand=(x,z)=>compactCityCanStand(x,z,.35);
const qaPaved=(x,z)=>qaStand(x,z)&&cityPavedAt(x,z);
function qaReachable(can,goal,label) {
  assert.ok(can(goal.x,goal.z),`${label}: blocked ${goal.x},${goal.z}`);
  const path=findPath(can,COMPACT_CITY.spawn,goal,{step:.5,margin:24});
  assert.ok(path,`${label}: disconnected`);
  let prev=COMPACT_CITY.spawn;
  for(const next of path){assert.ok(clearLine(can,prev.x,prev.z,next.x,next.z),`${label}: unsafe ${JSON.stringify(prev)} -> ${JSON.stringify(next)}`);prev=next;}
  assert.deepEqual(prev,{x:goal.x,z:goal.z});
}
test('garden reservations clear structures, every phase contact and actual presentation stops',()=>{
  for(const g of qaGardens) {
    assert.equal(COMPACT_CITY.buildings.find(b=>b.id===g.id),g);
    for(const b of COMPACT_CITY.buildings.filter(b=>b!==g)) {
      const dx=Math.abs(g.x-b.x)-(g.w+b.w)/2,dz=Math.abs(g.z-b.z)-(g.d+b.d)/2;
      assert.ok(Math.max(dx,dz)>=.7,`${g.id}/${b.id}: two .35m body clearances missing (${dx},${dz})`);
    }
  }
  let contacts=0;
  for(const npc of NPCS)for(const phase of CONTACT_PHASES) {
    for(const site of contactSitesFor(npc,phase,SPOT_SITES).filter(s=>s.map==='city')){qaReachable(qaStand,site,`${npc.id}/${phase}`);contacts++;}
    const a=presentationActivityFor(npc,phase);
    if(npc.map!=='city'||a.do==='home')continue;
    const anchors=a.do==='stay'?[a.at]:a.stops.map(s=>typeof s==='string'?s:s.at);
    for(const anchor of anchors) {
      const site=typeof anchor==='string'?COMPACT_CITY_SPOTS[anchor]:anchor;
      if(typeof anchor==='string'&&!site){assert.ok(SPOT_SITES[anchor],`${npc.id}: unknown stop ${anchor}`);continue;}
      qaReachable(qaStand,site,`${npc.id}/${phase}/presentation`);
    }
  }
  assert.ok(contacts>100);
});
test('garden pockets preserve graph edges and paved residential approaches beside new pockets',()=>{
  const graph=NavGraph.fromCompactCity({spots:COMPACT_CITY_SPOTS,canStand:compactCityCanStand});
  for(const id of Object.keys(COMPACT_CITY_SPOTS))assert.ok(graph.findPath('center',id),`${id}: disconnected`);
  for(const n of graph.nodes.values())for(const e of n.edges){const to=graph.nodes.get(e.to);assert.ok(clearLine(qaStand,n.x,n.z,to.x,to.z),`${n.id}->${to.id}`);}
  for(const b of COMPACT_CITY.buildings.filter(b=>b.kind==='infill'||b.kind==='house')) {
    const [dx,dz]=({east:[1,0],west:[-1,0],north:[0,-1],south:[0,1]})[b.front];
    const at={x:b.x+dx*(b.w/2+1.8),z:b.z+dz*(b.d/2+1.8)};
    // Distant frontage behavior belongs to the existing streets suite.
    if(!qaGardens.some(g=>Math.hypot(g.x-at.x,g.z-at.z)<20))continue;
    qaReachable(qaPaved,at,`${b.id}/front court`);
    if(b.id==='homes')for(const offset of [-5,5])qaReachable(qaPaved,{x:at.x+offset,z:at.z},`${b.id}/gate ${offset}`);
  }
  for(const poi of COMPACT_CITY.pois)qaReachable(qaPaved,poi,poi.id);
});
test('blocked current-revision garden saves reset locally and on login without modifying stored rows',()=>{
  // Baked collision awaits the coordinated export; inject canonical navigation.
  const nav=map=>({canStand:(x,z)=>map==='city'&&compactCityCanStand(x,z)});
  for(const g of qaGardens)for(const [x,z]of[[g.x,g.z],[g.x+g.w/2-.01,g.z]]) {
    const saved={map:'city',x,z,facing:.7,layoutRevision:CITY_LAYOUT_REVISION},before=structuredClone(saved);
    assert.deepEqual(resolveLocation(saved),{map:'city',...MAPS.city.spawn,layoutRevision:CITY_LAYOUT_REVISION});
    assert.deepEqual(loginPosition(saved,nav),{map:'city',x:COMPACT_CITY.spawn.x,z:COMPACT_CITY.spawn.z,f:MAPS.city.spawn.facing});
    assert.deepEqual(saved,before);
  }
});
