import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildCityStreetGardens } from '../src/world/compact-city-render/buildCityStreetGardens.js';
import { CITY_NEIGHBORHOODS } from '../src/world/compact-city-neighborhoods.js';
function helpers() {
  const allocations=new Set(),materials=new Set();
  const geo=g=>(allocations.add(g),g),mat=(color,extra={})=>{const m=new THREE.MeshStandardMaterial({color,...extra});materials.add(m);return m;};
  const cube=geo(new THREE.BoxGeometry(1,1,1)),cylinder=geo(new THREE.CylinderGeometry(1,1,1,10)),sphere=geo(new THREE.IcosahedronGeometry(1,1));
  const mesh=(p,g,m,x,y,z,sx,sy,sz)=>{const o=new THREE.Mesh(g,m);o.position.set(x,y,z);o.scale.set(sx,sy,sz);p.add(o);return o;};
  const box=(p,m,x,y,z,w,h,d)=>mesh(p,cube,m,x,y,z,w,h,d);
  const cyl=(p,m,x,y,z,r,h)=>mesh(p,cylinder,m,x,y,z,r,h,r);
  const ball=(p,m,x,y,z,w,h,d)=>mesh(p,sphere,m,x,y,z,w,h,d);
  const beam=(p,m,a,b,r)=>{const u=new THREE.Vector3(...a),v=new THREE.Vector3(...b),delta=v.clone().sub(u),o=cyl(p,m,0,0,0,r,delta.length());o.position.copy(u.add(v).multiplyScalar(.5));o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());return o;};
  const M=new Proxy({}, {get:(o,k)=>o[k]??(o[k]=mat('#886644'))});
  return {mat,geo,box,cyl,ball,beam,M,allocations,materials};
}
const plots=CITY_NEIGHBORHOODS.filter(b=>['banana','riverside'].includes(b.variant));
function inspect(root,b,h) {
  root.updateMatrixWorld(true);const signature=[];
  root.traverse(o=>{
    if(!o.isMesh)return;
    assert(h.allocations.has(o.geometry),'all new geometry is owned by caller');
    assert(h.materials.has(o.material),'all new materials are owned by caller');
    const p=o.geometry.attributes.position;assert(p.array.every(Number.isFinite));
    o.geometry.computeBoundingBox();
    const bounds=o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);
    if(o.userData.cityLandscapeCanopy) {
      assert(bounds.min.y>=2.6,`${b.id} low overhanging canopy`);
      assert(o.material.userData.cityFoliageWind,'banana foliage borrows existing wind');
    }else {
      assert(bounds.min.x>=b.x-b.w/2-.001&&bounds.max.x<=b.x+b.w/2+.001,`${b.id} X reservation`);
      assert(bounds.min.z>=b.z-b.d/2-.001&&bounds.max.z<=b.z+b.d/2+.001,`${b.id} Z reservation`);
    }
    signature.push([o.name,p.count,o.material.color.getHex(),o.matrixWorld.elements]);
  });
  return signature;
}

test('compact banana and riverside compositions keep hard geometry in all eight reservations and canopy above clearance',()=>{
  assert.equal(plots.length,8);
  for(const original of plots)for(const front of['north','south','east','west']) {
    const b={...original,front},h=helpers(),root=new THREE.Group();
    const stats=buildCityStreetGardens({root,CITY:{buildings:[b]},...h});inspect(root,b,h);
    assert(stats.vegetableBeds>=1);assert(stats.gardenJars>=1);
    if(b.variant==='banana'){assert.equal(stats.bananaClumps,1);assert.equal(stats.bananaStalks,3);assert.equal(stats.bananaLeaves,15);assert.equal(stats.bananaBunches,1);}
    else {assert.equal(stats.gardenBenches,1);assert.equal(stats.gardenJars,2);}
  }
});

test('banana blades have broad folded silhouettes; original shared geometry and seeded grouping are repeatable',()=>{
  const b=plots.find(b=>b.variant==='banana'),runs=[];
  for(let i=0;i<2;i++) {
    const h=helpers(),root=new THREE.Group();buildCityStreetGardens({root,CITY:{buildings:[b]},...h});
    runs.push(inspect(root,b,h));
    const leaves=[];root.traverse(o=>{if(o.name==='banana-folded-leaf')leaves.push(o);});
    assert.equal(new Set(leaves.map(o=>o.geometry)).size,1,'one shared banana blade geometry');
    const geometry=leaves[0].geometry,p=geometry.attributes.position;
    geometry.computeBoundingBox();assert(geometry.boundingBox.max.z-geometry.boundingBox.min.z>=.45,'broad banana lamina');
    assert(p.getY(16)>p.getY(15),'raised central fold gives painted-light separation');
    assert(p.getY(30)<-.4,'long banana blades visibly droop at the tip');
    assert(Math.abs(p.getZ(24))>.20,'blade stays broad near the end instead of a pointed palm feather');
    const stalks=[];root.traverse(o=>{if(o.name==='banana-pseudostem')stalks.push(o.scale.y);});
    assert(Math.max(...stalks)-Math.min(...stalks)>.75,'mature stalk heights have distinct layered silhouettes');
    const shoot=root.getObjectByName('banana-young-shoot');assert(shoot);
    assert(new THREE.Box3().setFromObject(shoot).max.y<1.7,'young shoot is visibly below mature canopy');
    const bunch=root.getObjectByName('hanging-banana-bunch');assert(bunch);
    assert.equal(bunch.children.filter(o=>o.geometry.type==='TubeGeometry').length,12,'three hanging hands of curved fruit');
  }
  assert.deepEqual(runs[0],runs[1],'seeded layout repeats exactly');
});

test('riverside resting bench sits entirely on a paved pad with separate planted clusters',()=>{
  for(const b of plots.filter(b=>b.variant==='riverside')) {
    const h=helpers(),root=new THREE.Group(),stats=buildCityStreetGardens({root,CITY:{buildings:[b]},...h});
    root.updateMatrixWorld(true);
    const bench=new THREE.Box3().setFromObject(root.getObjectByName('garden-resting-bench'));
    const pad=new THREE.Box3().setFromObject(root.getObjectByName('garden-seat-pad'));
    assert(pad.min.x<=bench.min.x&&pad.max.x>=bench.max.x,'pad spans full bench width');
    assert(pad.min.z<=bench.min.z&&pad.max.z>=bench.max.z,'pad supports bench feet and approach');
    const north=b.z-b.d/2;
    assert(bench.min.z-north>=.20&&bench.min.z-north<=.35,'seat front reachable from outside solid north boundary');
    assert(pad.min.z-north<.20,'under-seat pad joins external approach at the north edge');
    assert.equal(stats.gardenSeatPads,1);assert(stats.gardenGroundcovers>=2);
    const vegetables=new THREE.Box3().setFromObject(root.getObjectByName('garden-vegetables'));
    assert(!pad.intersectsBox(vegetables),'vegetable bed stays outside the seating pad');
  }
});

test('landscape integrates garden variants and preserves ownership and riverside tree clearance',async()=>{
  const context=new Proxy({}, {get:(o,k)=>String(k).includes('Gradient')?()=>({addColorStop(){}}):o[k]??(()=>{}),set:(o,k,v)=>(o[k]=v,true)});
  globalThis.document={createElement:()=>({getContext:()=>context})};
  const {buildCityLandscape}=await import('../src/world/compact-city-render/buildCityLandscape.js');
  for(const b of plots) {
    const root=new THREE.Group(),h=helpers(),authoredTextures=new Set();
    const CITY={buildings:[b],bounds:{minX:-72,maxX:72,minZ:-64,maxZ:64}};
    const {stats,groundTexture}=buildCityLandscape({root,CITY,authoredTextures,...h});
    assert(authoredTextures.has(groundTexture));assert.equal(stats.landscapeVariants[b.variant],1);
    root.updateMatrixWorld(true);
    // Background groves deliberately sit outside the playable area. Garden
    // tree branches and canopies are identified by proximity to this lot.
    root.traverse(o=>{
      if(!o.isMesh||o.parent.name.startsWith('street-garden:')||o.position.distanceTo(new THREE.Vector3(b.x,0,b.z))>12)return;
      o.geometry.computeBoundingBox();const bounds=o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);
      if(o.userData.cityLandscapeCanopy)assert(bounds.min.y>=2.6,'shade canopy clearance');
      else {
        assert(bounds.min.x>=b.x-b.w/2-.001&&bounds.max.x<=b.x+b.w/2+.001,'garden hard X bounds');
        assert(bounds.min.z>=b.z-b.d/2-.001&&bounds.max.z<=b.z+b.d/2+.001,'garden hard Z bounds');
        if(b.variant==='riverside'&&bounds.max.y>.15) {
          const inOpening=bounds.min.x<b.x+1.30&&bounds.max.x>b.x-1.30;
          const atNorth=bounds.min.z<b.z-b.d/2+.20;
          assert(!(inOpening&&atNorth),'north 2.6m approach opening has no upright edging');
        }
      }
    });
  }
});
