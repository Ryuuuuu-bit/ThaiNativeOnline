import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

const ctx=new Proxy({}, {get:(o,k)=>String(k).includes('Gradient')?()=>({addColorStop(){}}):o[k]??(()=>{}),set:(o,k,v)=>(o[k]=v,true)});
globalThis.document={createElement:()=>({getContext:()=>ctx})};
const {buildCityNeighborhoods,buildCityCourtyardEdges}=await import('../src/world/compact-city-render/buildCityNeighborhoods.js');
const {COMPACT_CITY}=await import('../src/world/compact-city.js');
const {thaiRoof}=await import('../src/world/Architecture.js');

function context() {
  const allocations=new Set(),geo=g=>(allocations.add(g),g);
  const mat=(color,extra={})=>new THREE.MeshStandardMaterial({color,...extra});
  const BOX=geo(new THREE.BoxGeometry(1,1,1)),CYL=geo(new THREE.CylinderGeometry(1,1,1,10)),BALL=geo(new THREE.IcosahedronGeometry(1,1));
  const primitive=(p,g,m,x,y,z,sx,sy,sz)=>{const o=new THREE.Mesh(g,m);o.position.set(x,y,z);o.scale.set(sx,sy,sz);p.add(o);return o;};
  const box=(p,m,x,y,z,w,h,d,ry=0)=>{const o=primitive(p,BOX,m,x,y,z,w,h,d);o.rotation.y=ry;return o;};
  const cyl=(p,m,x,y,z,r,h)=>primitive(p,CYL,m,x,y,z,r,h,r);
  const ball=(p,m,x,y,z,w,h,d)=>primitive(p,BALL,m,x,y,z,w,h,d);
  const beam=(p,m,a,b,r)=>{const u=new THREE.Vector3(...a),v=new THREE.Vector3(...b),delta=v.clone().sub(u),o=cyl(p,m,0,0,0,r,delta.length());o.position.copy(u.add(v).multiplyScalar(.5));o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());return o;};
  const M=new Proxy({}, {get:(o,k)=>o[k]??(o[k]=mat('#997755'))});
  const roofM=new Proxy({}, {get:(o,k)=>o[k]??(o[k]=mat('#997755'))});
  const copied=new Map();
  const kitRoof=(p,opts)=>{const r=thaiRoof(p,opts);r.traverse(o=>{if(o.isMesh){if(!copied.has(o.geometry))copied.set(o.geometry,geo(o.geometry.clone()));o.geometry=copied.get(o.geometry);}});return r;};
  const pot=(p,x,y,z,s)=>cyl(p,M.timber,x,y+.35*s,z,.30*s,.70*s);
  const crate=(p,x,y,z,s)=>box(p,M.wood,x,y+s/2,z,s,s,s);
  const lanternAt=(p,x,y,z,r,h)=>cyl(p,M.gold,x,y,z,r,h);
  return {geo,mat,box,cyl,ball,beam,M,roofM,kitRoof,pot,crate,lanternAt,allocations};
}
function checkLot(root,b,allocations) {
  root.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(root);
  assert(bounds.min.x>=b.x-b.w/2-.001,`${b.id} west`);
  assert(bounds.max.x<=b.x+b.w/2+.001,`${b.id} east`);
  assert(bounds.min.z>=b.z-b.d/2-.001,`${b.id} north`);
  assert(bounds.max.z<=b.z+b.d/2+.001,`${b.id} south`);
  const fence=root.getObjectByName('residential-boundary');assert(fence,`${b.id} boundary`);
  const gate=fence.userData.gate;
  const openings=fence.userData.gateOpenings;
  for(const opening of openings)assert(opening.right-opening.left>=1.8,`${b.id} generous gate`);
  if(openings.length===1)assert(gate.doorX-.50>gate.left&&gate.doorX+.50<gate.right,`${b.id} stair alignment`);
  const inverse=fence.matrixWorld.clone().invert();
  fence.traverse(o=>{
    if(!o.isMesh)return;
    assert(allocations.has(o.geometry),'tracked shared fence geometry');
    o.geometry.computeBoundingBox();
    const local=o.geometry.boundingBox.clone().applyMatrix4(inverse.clone().multiply(o.matrixWorld));
    assert(local.max.y<=1.181,'low boundary leaves gameplay sightlines clear');
    // Actual geometry, not a snapshot or segment-count assertion: no upright
    // fence piece may enter the full entrance interval at the front edge.
    const atFront=local.max.z>gate.front-.20&&local.min.z<gate.front+.20;
    for(const opening of openings) {
      const acrossGate=local.max.x>opening.left&&local.min.x<opening.right;
      assert(!(acrossGate&&atFront),`${b.id} fence obstructs gate`);
    }
  });
  return fence.userData.fenceStyle;
}

test('infill boundaries stay in canonical lots with clear offset stairs in every front orientation',()=>{
  const styles=new Set();
  for(const original of COMPACT_CITY.buildings.filter(b=>b.kind==='infill'))for(const front of['north','south','east','west']) {
    const b={...original,front},h=context(),root=new THREE.Group();
    const stats=buildCityNeighborhoods({root,CITY:{buildings:[b]},...h});
    assert.equal(stats.fenceLots,1);assert.equal(stats.gatePosts,2);
    styles.add(checkLot(root,b,h.allocations));
  }
  assert(styles.has('bamboo')&&styles.has('plaster')&&styles.has('timber'));
  const h=context(),root=new THREE.Group(),stats=buildCityNeighborhoods({root,CITY:COMPACT_CITY,...h});
  assert.equal(stats.fenceLots,16);assert.equal(stats.gatePosts,32);assert(stats.fenceStyles.slat>0);
});

test('existing homes have visible front returns and two clear compound stair gates; service frontages get no new fences',()=>{
  for(const b of COMPACT_CITY.buildings.filter(b=>b.kind==='house')) {
    const h=context(),root=new THREE.Group(),stats=buildCityCourtyardEdges({root,CITY:{buildings:[b]},...h});
    assert.equal(stats.fenceLots,1);assert.equal(stats.fenceSegments,b.id==='homes'?7:6);
    assert.equal(stats.gatePosts,b.id==='homes'?4:2);
    checkLot(root,b,h.allocations);
    const gate=root.getObjectByName('residential-boundary').userData.gate;
    assert(gate.right-gate.left>=b.w*.60,'compound opening reaches both house approaches');
    if(b.id==='homes') {
      // Existing compoundHome uses two offset entrances and unequal stair widths.
      const bodyW=b.w/2-.8;
      const stairs=[{left:-b.w/4-bodyW*.15-.675,right:-b.w/4-bodyW*.15+.675},
        {left:b.w/4+bodyW*.18-.65,right:b.w/4+bodyW*.18+.65}];
      const fence=root.getObjectByName('residential-boundary'),openings=fence.userData.gateOpenings;
      assert.equal(openings.length,2);
      const inverse=fence.matrixWorld.clone().invert();
      for(const [i,stair]of stairs.entries()) {
        assert(stair.left>openings[i].left&&stair.right<openings[i].right,'gate surrounds actual stair mouth');
        fence.traverse(o=>{
          if(!o.isMesh)return;o.geometry.computeBoundingBox();
          const aabb=o.geometry.boundingBox.clone().applyMatrix4(inverse.clone().multiply(o.matrixWorld));
          const overlapsStair=aabb.max.x>stair.left&&aabb.min.x<stair.right;
          const atFront=aabb.max.z>gate.front-.20&&aabb.min.z<gate.front+.20;
          assert(!(overlapsStair&&atFront),'actual fence AABB leaves each stair mouth clear');
        });
      }
      const central=fence.getObjectByName('residential-central-front-span');assert(central);
      const centralBounds=new THREE.Box3().setFromObject(central);
      assert(centralBounds.max.x-centralBounds.min.x>=6.5,'substantial street-facing plaster span');
      assert(centralBounds.max.y<=1.181,'central span remains low');
    }
  }
  const h=context(),root=new THREE.Group();
  const buildings=COMPACT_CITY.buildings.filter(b=>['forge','pharmacy','general','storage'].includes(b.id));
  const stats=buildCityCourtyardEdges({root,CITY:{buildings},...h});
  assert.equal(stats.fenceLots,0);assert.equal(root.getObjectByName('residential-boundary'),undefined);
});
