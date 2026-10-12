import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COMPACT_CITY, compactCityCanStand } from '../src/world/compact-city.js';
import { cityPavedAt, cityStreetSurfaceAt } from '../src/world/compact-city-streets.js';
import { findPath, clearLine } from '../src/core/GridPath.js';
import { COMPACT_CITY_SPOTS } from '../src/data/compactCityNpcs.js';
import { SHOP_APPROACHES, SHOP_SITES } from '../src/data/shopSites.js';
import { WARP_SERVICES, WARP_DESTINATIONS } from '../src/data/warpServices.js';
import { MAPS, arrivalsOn } from '../src/world/maps.js';

test('painted city streets connect every public destination without crossing a building or grass gap', () => {
  const onStreet=(x,z)=>compactCityCanStand(x,z,.35)&&cityPavedAt(x,z);
  const goals=[
    ...COMPACT_CITY.pois,
    ...Object.entries(SHOP_APPROACHES).map(([id,anchor])=>({...COMPACT_CITY_SPOTS[anchor],id:`approach:${id}`})),
    ...Object.entries(SHOP_SITES).flatMap(([id,sites])=>sites.filter(s=>s.map==='city').map(s=>({...s,id:`shop:${id}`}))),
    ...WARP_SERVICES.filter(s=>s.map==='city'),
    ...WARP_DESTINATIONS.filter(s=>s.map==='city'),
    {...MAPS.city.spawn,id:'spawn'},
    ...MAPS.city.respawn.map(([x,z],i)=>({x,z,id:`respawn:${i}`})),
    ...arrivalsOn('city').map((p,i)=>({...p,id:`portal-arrival:${i}`})),
  ];
  for(const poi of goals) {
    assert.ok(onStreet(poi.x,poi.z),`${poi.id}: no paved approach`);
    const path=findPath(onStreet,COMPACT_CITY.spawn,poi,{step:.5,margin:24});
    assert.ok(path,`${poi.id}: painted street is disconnected`);
    let prev=COMPACT_CITY.spawn;
    for(const next of path){assert.ok(clearLine(onStreet,prev.x,prev.z,next.x,next.z),`${poi.id}: cuts across a gap`);prev=next;}
  }
});

test('road junctions stay continuous and existing plaza, pier and buildings keep their own surfaces', () => {
  assert.equal(cityStreetSurfaceAt(0,-32),'cobble');
  assert.equal(cityStreetSurfaceAt(36,0),'cobble');
  assert.equal(cityStreetSurfaceAt(4,-28),'walk');
  assert.equal(cityStreetSurfaceAt(0,0),null);
  assert.equal(cityStreetSurfaceAt(0,59),null);
  for(const b of COMPACT_CITY.buildings)assert.equal(cityStreetSurfaceAt(b.x,b.z),null,b.id);
});

test('inhabited infill has paved front courts without consuming NPC interaction space', () => {
  const onStreet=(x,z)=>compactCityCanStand(x,z,.35)&&cityPavedAt(x,z);
  for(const b of COMPACT_CITY.buildings.filter(b=>b.kind==='infill')) {
    const [dx,dz]=({east:[1,0],west:[-1,0],north:[0,-1],south:[0,1]})[b.front];
    const goal={x:b.x+dx*(b.w/2+1.8),z:b.z+dz*(b.d/2+1.8)};
    assert.ok(onStreet(goal.x,goal.z),`${b.id}: blocked or unpaved threshold`);
    assert.ok(findPath(onStreet,COMPACT_CITY.spawn,goal,{step:.5,margin:24}),`${b.id}: front court disconnected from street`);
  }
});
