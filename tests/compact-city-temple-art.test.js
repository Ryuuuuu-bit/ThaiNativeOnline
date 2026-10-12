import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

// Materials are procedural canvas maps; geometry checks do not need a browser.
const context=new Proxy({}, {
  get:(o,k)=>k.includes('Gradient')?()=>({addColorStop(){}}):o[k]??(()=>{}),
  set:(o,k,v)=>(o[k]=v,true),
});
globalThis.document={createElement:()=>({getContext:()=>context})};
const {buildCityTemple}=await import('../src/world/compact-city-render/buildCityTemple.js');
const {thaiRoof}=await import('../src/world/Architecture.js');
const {COMPACT_CITY,compactCityCanStand}=await import('../src/world/compact-city.js');

function helpers() {
  const allocated=new Set(),geo=g=>(allocated.add(g),g);
  const mat=(color,extra={})=>new THREE.MeshStandardMaterial({color,...extra});
  const BOX=geo(new THREE.BoxGeometry(1,1,1)),CYL=geo(new THREE.CylinderGeometry(1,1,1,10));
  const BALL=geo(new THREE.IcosahedronGeometry(1,1));
  const mesh=(p,g,m,x,y,z,sx,sy,sz)=>{
    const o=new THREE.Mesh(g,m);o.position.set(x,y,z);o.scale.set(sx,sy,sz);p.add(o);return o;
  };
  const box=(p,m,x,y,z,w,h,d)=>mesh(p,BOX,m,x,y,z,w,h,d);
  const cyl=(p,m,x,y,z,r,h)=>mesh(p,CYL,m,x,y,z,r,h,r);
  const ball=(p,m,x,y,z,w,h,d)=>mesh(p,BALL,m,x,y,z,w,h,d);
  const beam=(p,m,a,b,r)=>{
    const u=new THREE.Vector3(...a),v=new THREE.Vector3(...b),delta=v.clone().sub(u);
    const o=cyl(p,m,0,0,0,r,delta.length());o.position.copy(u.add(v).multiplyScalar(.5));
    o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());return o;
  };
  const copied=new Map();
  const kitRoof=(p,options)=>{
    const roof=thaiRoof(p,options);
    roof.traverse(o=>{if(o.isMesh){if(!copied.has(o.geometry))copied.set(o.geometry,geo(o.geometry.clone()));o.geometry=copied.get(o.geometry);}});
    return roof;
  };
  const M=Object.fromEntries(Object.entries({wood:'#684c33',dark:'#3e3830',brick:'#927456',jade:'#49775c',window:'#b78b50'}).map(([k,v])=>[k,mat(v)]));
  return {mat,geo,box,cyl,beam,ball,kitRoof,roofM:{wood:M.wood},M,allocated};
}
function inspect(root,allocated) {
  let triangles=0;const signature=[];
  root.updateMatrixWorld(true);root.traverse(o=>{
    if(!o.isMesh)return;
    assert(allocated.has(o.geometry),'every geometry uses tracked primitive/geo/kitRoof helpers');
    const p=o.geometry.getAttribute('position');assert(p.array.every(Number.isFinite));
    triangles+=(o.geometry.index?.count??p.count)/3;
    signature.push([p.count,o.geometry.index?.count,o.material.color.getHex(),o.matrixWorld.elements]);
  });
  return {triangles,signature};
}

test('grand temple and chedi remain inside canonical reservations with stable LOD silhouettes',()=>{
  for(const b of COMPACT_CITY.buildings.filter(b=>['temple','chedi'].includes(b.kind))) {
    const h=helpers(),high=new THREE.Group(),low=new THREE.Group();
    const stats=buildCityTemple({b,high,low,...h});
    for(const bounds of Object.values(stats.bounds)) {
      assert(bounds.min[0]>=b.x-b.w/2);assert(bounds.max[0]<=b.x+b.w/2);
      assert(bounds.min[2]>=b.z-b.d/2);assert(bounds.max[2]<=b.z+b.d/2);
    }
    assert.deepEqual(stats.bounds.high,stats.bounds.low,'distant LOD preserves overall silhouette');
    assert(stats.highHeight>=(b.kind==='temple'?16:14));
    assert(stats.lowMeshes<stats.highMeshes);
    const hi=inspect(high,h.allocated),lo=inspect(low,h.allocated);
    assert(lo.triangles<hi.triangles*.85,'LOD removes meaningful geometry cost');
    if(b.kind==='temple') {
      assert.equal(stats.roofTiers,3);
      assert(compactCityCanStand(-52,-31,.28),'canonical abbot contact stays available');
      assert(stats.bounds.high.max[2]<=-34,'terrace and naga stop before the abbot approach');
    }
  }
});

test('LOD retains green and orange tiled roofs, world UVs and locally tracked original ornaments',()=>{
  const b=COMPACT_CITY.buildings.find(b=>b.kind==='temple'),h=helpers();
  const high=new THREE.Group(),low=new THREE.Group();buildCityTemple({b,high,low,...h});
  const maps=root=>{
    const colors=new Set();root.traverse(o=>{if(o.isMesh&&o.material.map){colors.add(o.material.color.getHexString());const uv=o.geometry.getAttribute('uv');assert(uv);assert(uv.array.every(Number.isFinite));}});return [...colors].sort();
  };
  assert.deepEqual(maps(high),maps(low));assert(maps(high).includes('58745c'));assert(maps(high).includes('c97a3c'));
  const first=inspect(high,h.allocated).signature;
  const second=helpers(),again=new THREE.Group();buildCityTemple({b,high:again,low:new THREE.Group(),...second});
  assert.deepEqual(inspect(again,second.allocated).signature,first,'repeated builds have identical original geometry');
});

test('sacred construction honors front orientation without introducing footprint overhang',()=>{
  const canonical=COMPACT_CITY.buildings.find(b=>b.kind==='temple');
  for(const front of['east','west','north','south']) {
    const h=helpers(),b={...canonical,front};
    const stats=buildCityTemple({b,high:new THREE.Group(),low:new THREE.Group(),...h});
    assert(stats.bounds.high.min[0]>=b.x-b.w/2);assert(stats.bounds.high.max[0]<=b.x+b.w/2);
    assert(stats.bounds.high.min[2]>=b.z-b.d/2);assert(stats.bounds.high.max[2]<=b.z+b.d/2);
  }
});

test('ceremonial south gable and gateway columns fit the abbot gameplay crop at zoom 2',()=>{
  const b=COMPACT_CITY.buildings.find(b=>b.kind==='temple'),h=helpers(),high=new THREE.Group();
  buildCityTemple({b,high,low:new THREE.Group(),...h});high.updateMatrixWorld(true);
  const target=new THREE.Vector3(-52,0,-31),camera=new THREE.OrthographicCamera(-6.5*16/9,6.5*16/9,6.5,-6.5,.1,200);
  camera.position.copy(target).add(new THREE.Vector3(15,23,22));camera.lookAt(target);camera.updateMatrixWorld(true);
  const gable=high.getObjectByName('temple-entry-front-gable');
  // Project real vertices: a bounding-box corner combines the tall center
  // chofa with the far eave, producing an imaginary point above the pediment.
  gable.traverse(o=>{if(o.isMesh) {
    const positions=o.geometry.getAttribute('position');
    for(let i=0;i<positions.count;i++) {
      const projected=new THREE.Vector3().fromBufferAttribute(positions,i).applyMatrix4(o.matrixWorld).project(camera);
      assert(Math.abs(projected.x)<=1&&Math.abs(projected.y)<=1,`carved gable stays inside gameplay crop: ${projected.toArray()}`);
    }
  }});
  for(const x of[-2.89,2.89])for(const y of[.20,3.53]) {
    const projected=new THREE.Vector3(b.x+x,y,b.z+7.12).project(camera);
    assert(Math.abs(projected.x)<=1&&Math.abs(projected.y)<=1,'gateway column stays visible beside the stair approach');
  }
});
