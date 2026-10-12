import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COMPACT_CITY, compactCityCanStand } from '../src/world/compact-city.js';
import { COMPACT_CITY_SPOTS } from '../src/data/compactCityNpcs.js';
import { NPCS } from '../src/data/npcs.js';
import { CONTACT_PHASES, contactSitesFor } from '../src/data/npcContact.js';
import { SPOT_SITES, SHOP_APPROACHES, nearNpc, nearShop } from '../src/data/shopSites.js';
import { HALLS } from '../src/data/halls.js';
import { TRAINING } from '../src/data/training.js';
import { MAPS, portalAt, npcHome, npcMap } from '../src/world/maps.js';
import { WARP_SERVICES, WARP_DESTINATIONS, WARP_RANGE } from '../src/data/warpServices.js';
import { stashWhy } from '../server/stash.js';
import { Collision } from '../src/world/Collision.js';
import { portalPillars } from '../src/world/portal-layout.js';
import { findPath, clearLine } from '../src/core/GridPath.js';
import { NavGraph } from '../src/npc/NavGraph.js';
import { navigation } from '../server/navigation.js';

// Mirrors the production city's collision construction, including portal pillars.
// This is navigation evidence only; browser QA checks the actual built World.
const collision = new Collision(8);
for (const b of COMPACT_CITY.buildings) collision.addBox(b.x,b.z,b.w,b.d);
for (const p of MAPS.city.portals) for (const s of portalPillars(MAPS.city,p)) collision.addCircle(s.x,s.z,s.r);
const canStand = (x,z,pad=.28) => compactCityCanStand(x,z,pad) && !collision.blocked(x,z,pad);
function reachable(goal,label) {
  assert.ok(canStand(goal.x,goal.z),`${label}: blocked endpoint ${goal.x},${goal.z}`);
  const path=findPath(canStand,COMPACT_CITY.spawn,goal,{ margin:24 });
  assert.ok(path,`${label}: no path from spawn`);
  let at=COMPACT_CITY.spawn;
  for (const next of path) { assert.ok(clearLine(canStand,at.x,at.z,next.x,next.z),`${label}: blocked path segment`); at=next; }
  assert.deepEqual(at,{x:goal.x,z:goal.z});
}

test('server and compact client collision agree across the city, building edges and portal pillars', () => {
  const server=navigation('city');
  for (const pad of [.28,.35,.6]) {
    for (let z=-65;z<=65;z+=1) for(let x=-73;x<=73;x+=1) assert.equal(server.canStand(x,z,pad),canStand(x,z,pad),`${x},${z},pad=${pad}`);
    for (const b of COMPACT_CITY.buildings) for (const offset of [-.01,0,.01]) {
      const x=b.x+b.w/2+pad+offset,z=b.z;
      assert.equal(server.canStand(x,z,pad),canStand(x,z,pad),`${b.id} edge ${offset}`);
    }
  }
});

test('every outdoor NPC schedule anchor in every phase is reachable and authorizes its actual city contact', () => {
  let checked=0;
  for (const npc of NPCS) for(const phase of CONTACT_PHASES) for(const site of contactSitesFor(npc,phase,SPOT_SITES).filter(s=>s.map==='city')) {
    reachable(site,`${npc.id}/${phase}`);
    assert.ok(nearNpc(npc.id,'city',site.x,site.z,phase));
    if(npc.shopType) assert.ok(nearShop(npc.shopType,'city',site.x,site.z,phase));
    checked++;
  }
  assert.ok(checked>100,'full city roster is exercised, not only the service subset');
});

test('six class contacts, four training dummies and all service approaches remain reachable', () => {
  assert.deepEqual(HALLS.map(h=>h.classId).sort(),['assassin','herbalist','hunter','muaythai','shaman','warrior']);
  for(const h of HALLS) {
    reachable(h.master,h.id); reachable(h.door,`${h.id}/door`);
    assert.ok(NPCS.some(n=>CONTACT_PHASES.some(p=>contactSitesFor(n,p,SPOT_SITES).some(s=>s.map==='city' && s.x===h.master.x && s.z===h.master.z))),`${h.id}: master NPC missing`);
  }
  assert.equal(TRAINING.dummy.spots.length,4);
  assert.equal(new Set(TRAINING.dummy.spots.map(JSON.stringify)).size,4);
  for(const [x,z] of TRAINING.dummy.spots) reachable({x,z},`dummy ${x},${z}`);
  for(const [shop,id] of Object.entries(SHOP_APPROACHES)) {
    const at=COMPACT_CITY_SPOTS[id]; assert.ok(at,id);reachable(at,id);
    assert.ok(nearShop(shop,'city',at.x,at.z,'day'),`${shop}: approach cannot authorize service`);
  }
  for(const site of WARP_SERVICES.filter(s=>s.map==='city')) reachable(site,site.id);
  for(const destination of WARP_DESTINATIONS.filter(s=>s.map==='city')) reachable(destination,destination.id);
  for(const p of MAPS.city.portals) reachable(p.at,p.id);
  const arrival=MAPS.paddy.portals.find(p=>p.to==='city').arrive;
  reachable(arrival,'paddy return');assert.equal(portalAt(MAPS.city,arrival.x,arrival.z),null,'return must not bounce');
});

test('compact NPC graph connects every anchor without crossing collision', () => {
  const graph=NavGraph.fromCompactCity({ spots:COMPACT_CITY_SPOTS,canStand });
  for(const id of Object.keys(COMPACT_CITY_SPOTS)) {
    assert.ok(graph.findPath('center',id),`${id}: disconnected`);
  }
  for(const node of graph.nodes.values()) for(const edge of node.edges) {
    const to=graph.nodes.get(edge.to);
    assert.ok(clearLine((x,z)=>canStand(x,z,.35),node.x,node.z,to.x,to.z),`${node.id}->${to.id}: crosses collision`);
  }
});

test('outer gate guards keep their home on paddy after city node migration', () => {
  for(const id of ['guard_gate_w','guard_gate_e']) {
    const npc=NPCS.find(n=>n.id===id),home=npcHome(npc);
    assert.equal(npcMap(npc),'paddy');
    assert.ok(home&&navigation('paddy').canStand(...home),`${id}: home must remain on its resident map`);
  }
});

test('compact class yards contain the entire reserved hall footprint and exterior door', () => {
  for(const h of HALLS) {
    const b=COMPACT_CITY.buildings.find(b=>b.id===h.id);
    for(const [x,z] of [[b.x-b.w/2,b.z-b.d/2],[b.x+b.w/2,b.z+b.d/2],[h.door.x,h.door.z]]) {
      assert.ok(Math.abs(x-h.yard.x)<=h.yard.rx+.01&&Math.abs(z-h.yard.z)<=h.yard.rz+.01,`${h.id}: yard excludes ${x},${z}`);
    }
  }
});

test('depot and warp POIs resolve to the one real storage keeper and authorize storage within its actual range', () => {
  const depot=COMPACT_CITY.pois.find(p=>p.id==='stash'),warp=COMPACT_CITY.pois.find(p=>p.id==='warp');
  assert.equal(depot.npcId,'warp_city_market');
  assert.equal(warp.npcId,depot.npcId);
  const matches=NPCS.filter(n=>n.id===depot.npcId);
  assert.equal(matches.length,1,'reuse the existing keeper without a duplicate NPC');
  const npc=matches[0],keeper=WARP_SERVICES.find(s=>s.npcId===npc.id);
  assert.ok(npc.storageService);assert.equal(npc.interactionRadius,WARP_RANGE);
  assert.deepEqual([keeper.map,keeper.x,keeper.z,keeper.link],['city',17,12,'stash']);
  const state={c:{alive:true},persist:{account:'compactdepotqa'}};
  const player={account:'compactdepotqa',map:'city',x:depot.x,z:depot.z};
  for(const poi of [depot,warp]) {
    reachable(poi,poi.id);
    assert.equal(stashWhy({...player,x:poi.x,z:poi.z},state,poi.npcId),null,`${poi.id}: server storage authorization`);
    for(const phase of CONTACT_PHASES) {
      const sites=contactSitesFor(npc,phase,SPOT_SITES);
      assert.ok(sites.some(s=>s.map==='city'&&s.x===poi.x&&s.z===poi.z),`${poi.id}/${phase}: actual outdoor keeper`);
    }
  }
  const arrival=WARP_DESTINATIONS.find(d=>d.id===keeper.arrivalId);
  assert.deepEqual([arrival.x,arrival.z],[14,12]);
  assert.equal(stashWhy({...player,x:arrival.x,z:arrival.z},state,npc.id),null,'arrival is within usable storage range');
  assert.equal(stashWhy({...player,x:keeper.x-WARP_RANGE},state,npc.id),null,'exact range boundary remains authorized');
  assert.equal(stashWhy({...player,x:keeper.x-WARP_RANGE-.001},state,npc.id),'far','outside actual storage range fails');
  assert.equal(stashWhy({...player,map:'paddy'},state,npc.id),'map');
});
