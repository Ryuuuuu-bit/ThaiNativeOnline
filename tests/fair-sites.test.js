import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { FAIR_SITES, FAIR_RANGE, fairIsOpen } from '../src/fair/fairSites.js';
import { COMPACT_CITY, compactCityCanStand } from '../src/world/compact-city.js';
import { CITY_STREETS } from '../src/world/compact-city-streets.js';
import { buildTempleFair } from '../src/world/compact-city-render/buildTempleFair.js';
import { COMPACT_CITY_SPOTS } from '../src/data/compactCityNpcs.js';
import { isFairOpen } from '../src/fair/fairRules.js';

const intersects=(a,b,pad=0)=>Math.abs(a.x-b.x)<(a.w+b.w)/2+pad&&Math.abs(a.z-b.z)<(a.d+b.d)/2+pad;
test('fair reservations avoid buildings and streets; contacts clear temple services and connect to the west lane',()=>{
  assert.deepEqual(FAIR_SITES.map(s=>s.id),['balloons','dolls','dice']);
  assert.equal(FAIR_RANGE,4);
  const others=COMPACT_CITY.buildings.filter(b=>b.kind!=='fair');
  const services=[...COMPACT_CITY.pois,{x:-43,z:-29},{x:-40,z:-29}];
  for(const site of FAIR_SITES) {
    assert(others.every(b=>!intersects(site,b,.28)),`${site.id} building overlap`);
    assert(CITY_STREETS.every(r=>!intersects(site,r,.28)),`${site.id} street overlap`);
    assert(FAIR_SITES.every(other=>other===site||!intersects(site,other,.28)));
    const a=site.approach;assert(compactCityCanStand(a.x,a.z,.6),'exterior contact walkable');
    assert(Math.hypot(a.x-site.x,a.z-site.z)<=FAIR_RANGE,'contact within shared range');
    assert(services.every(s=>Math.hypot(a.x-s.x,a.z-s.z)>FAIR_RANGE),'contact separated from old services');
    for(const [id,s]of Object.entries(COMPACT_CITY_SPOTS))assert(
      Math.abs(s.x-site.x)>=site.w/2+.6||Math.abs(s.z-site.z)>=site.d/2+.6,
      `${site.id} reservation preserves NPC anchor ${id}`);
    // Clear south court joins the western lane without cutting the kuti or a
    // fair box. This checks the complete pedestrian connector, not endpoints.
    for(let i=0;i<=60;i++) {
      const x=-36+(a.x+36)*i/60,z=a.z;
      assert(compactCityCanStand(x,z,.35),'court connector walkable');
      assert(FAIR_SITES.every(s=>Math.abs(x-s.x)>=s.w/2+.35||Math.abs(z-s.z)>=s.d/2+.35));
    }
  }
});

test('fair opens at 16:30 and closes at 05:00 across midnight',()=>{
  assert.equal(fairIsOpen,isFairOpen,'shared export is canonical rule identity');
  for(const h of[16.5,18,23.99,0,4.99])assert(fairIsOpen(h));
  for(const h of[5,12,16.49,40.5,-1,24,NaN,Infinity,undefined])assert(!fairIsOpen(h));
});

test('fair geometry stays inside each reservation, batches cheaply and disposes all owned resources',()=>{
  const source=buildTempleFair({batch:false});
  for(const site of FAIR_SITES) {
    const bounds=new THREE.Box3().setFromObject(source.root.getObjectByName(`fair:${site.id}`));
    assert(bounds.min.x>=site.x-site.w/2&&bounds.max.x<=site.x+site.w/2);
    assert(bounds.min.z>=site.z-site.d/2&&bounds.max.z<=site.z+site.d/2);
  }
  assert.equal(source.stats.fairLanterns,9);assert.equal(source.stats.fairBalloons,15);
  assert.equal(source.stats.fairDolls,8);assert.equal(source.stats.fairSymbols,6);
  source.dispose();
  const fair=buildTempleFair();assert(fair.stats.fairDrawCalls<=24,'material batching budget');
  const resources=new Set();fair.root.traverse(o=>{if(o.isMesh){resources.add(o.geometry);resources.add(o.material);}});
  const released=new Set();for(const resource of resources)resource.addEventListener('dispose',()=>released.add(resource));
  fair.setPhase(21,1);assert(fair.root.userData.fairOpen);
  assert([...resources].some(r=>r.isMaterial&&r.emissiveIntensity>1));
  fair.setPhase(12,1);assert(!fair.root.userData.fairOpen);
  assert([...resources].filter(r=>r.isMaterial&&r.emissive.getHex()!==0).every(r=>r.emissiveIntensity===0));
  fair.dispose();fair.dispose();assert.equal(released.size,resources.size,'owned batch materials and geometry released exactly once');
});

test('injected fair shares lantern identity and allocator ownership with production city',()=>{
  const geometries=new Set(),materials=new Set();
  const geo=g=>(geometries.add(g),g),mat=(color,extra={})=>{const m=new THREE.MeshStandardMaterial({color,...extra});materials.add(m);return m;};
  const lantern=mat('#ffe3a7',{emissive:'#ffb664',emissiveIntensity:1.4}),parent=new THREE.Group();
  const fair=buildTempleFair({root:parent,geo,mat,M:{lantern}});
  assert(fair.root.parent===parent);assert.equal(fair.root.children[0].name,'temple-fair-sources');
  let usesLantern=0;
  fair.root.traverse(o=>{if(o.isMesh){assert(geometries.has(o.geometry));assert(materials.has(o.material));if(o.material===lantern)usesLantern++;}});
  assert.equal(usesLantern,9,'exposed lamp bodies use original city clock material');
  fair.setPhase(12,0);assert.equal(lantern.emissiveIntensity,1.4,'phase does not alter borrowed city material');
  let releases=0;for(const resource of [...geometries,...materials])resource.addEventListener('dispose',()=>releases++);
  fair.dispose();assert.equal(releases,0,'caller owns all injected allocations');
});
