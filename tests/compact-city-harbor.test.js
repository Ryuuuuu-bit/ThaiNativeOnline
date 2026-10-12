import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildCityHarbor } from '../src/world/compact-city-render/buildCityHarbor.js';
import { StaticBatcher } from '../src/world/Batching.js';
import { COMPACT_CITY } from '../src/world/compact-city.js';

const context=new Proxy({}, {get:(o,k)=>String(k).includes('Gradient')?()=>({addColorStop(){}}):o[k]??(()=>{}),set:(o,k,v)=>(o[k]=v,true)});
globalThis.document={createElement:()=>({getContext:()=>context})};
const { thaiRoof }=await import('../src/world/Architecture.js');

function harness(failBatch=0) {
  const root=new THREE.Group(),staticRoot=new THREE.Group(),roots=new Set([root,staticRoot]),resources=new Set(),sourceBounds=[];
  const ownRoot=g=>(roots.add(g),g),geo=g=>(resources.add(g),g);
  const mat=(color,extra={})=>{const m=new THREE.MeshStandardMaterial({color,...extra});resources.add(m);return m;};
  const M=Object.fromEntries(['wood','timber','dark','brick','rim','cream','path','gold','clay','leaf','leafLight','roof','lantern'].map(k=>[k,mat('#987456')]));
  const roofM={wood:M.wood,timber:M.timber,gold:M.gold};
  const cube=geo(new THREE.BoxGeometry(1,1,1)),cylinder=geo(new THREE.CylinderGeometry(1,1,1,10)),sphere=geo(new THREE.SphereGeometry(1,8,6));
  const add=(p,g,m,x,y,z,sx,sy,sz)=>{const o=new THREE.Mesh(g,m);o.position.set(x,y,z);o.scale.set(sx,sy,sz);o.castShadow=true;p.add(o);return o;};
  const box=(p,m,x,y,z,w,h,d)=>add(p,cube,m,x,y,z,w,h,d);
  const cyl=(p,m,x,y,z,r,h)=>add(p,cylinder,m,x,y,z,r,h,r);
  const ball=(p,m,x,y,z,rx,ry,rz)=>add(p,sphere,m,x,y,z,rx,ry,rz);
  const beam=(p,m,a,b,r)=>{const u=new THREE.Vector3(...a),v=new THREE.Vector3(...b),delta=v.clone().sub(u);const mid=u.add(v).multiplyScalar(.5);const mesh=cyl(p,m,...mid.toArray(),r,delta.length());mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());return mesh;};
  const ground=(m,x,y,z,w,h,d)=>{const o=box(staticRoot,m,x,y+h/2,z,w,.001,d);o.userData.harborGround=true;o.castShadow=false;return o;};
  const crate=(p,x,y,z,s=1)=>box(p,M.timber,x,y+s*.45,z,s,s*.9,s*.85);
  const pot=(p,x,y,z,s=1)=>cyl(p,M.clay,x,y+.32*s,z,.34*s,.58*s);
  const lanternAt=(p,x,y,z,r,h)=>cyl(p,M.lantern,x,y,z,r,h);
  const kitRoof=(p,options,paint)=>{const roof=thaiRoof(p,options);roof.traverse(o=>{if(o.isMesh){o.geometry=geo(o.geometry.clone());o.material=paint;}});return roof;};
  let batchCalls=0;
  const assemble=async(source,target)=>{
    batchCalls++;source.updateMatrixWorld(true);sourceBounds.push(new THREE.Box3().setFromObject(source));
    if(batchCalls===failBatch)throw new Error('injected harbor batching failure');
    const batch=new StaticBatcher();batch.addObject(source,true);const merged=await batch.buildAsync(target);
    target.traverse(o=>{if(o.geometry)resources.add(o.geometry);});return {merged};
  };
  let disposed=false;
  const dispose=()=>{if(disposed)return 0;disposed=true;for(const g of roots)g.traverse(o=>{if(o.geometry)resources.add(o.geometry);});for(const r of resources)r.dispose();for(const g of roots)g.clear();return resources.size;};
  const api={root,staticRoot,ownRoot,mat,geo,box,cyl,beam,ball,ground,lanternAt,pot,crate,kitRoof,roofM,M,assemble};
  return {api,root,staticRoot,roots,resources,sourceBounds,dispose,get batchCalls(){return batchCalls;}};
}

test('harbor preserves named boat anchors and batches each craft exactly once',async()=>{
  const h=harness();try {
    const result=await buildCityHarbor(h.api);
    assert.equal(h.batchCalls,2);assert.equal(result.boats.length,2);
    assert.deepEqual(result.boats.map(b=>b.group.name),['city-moored-junk','city-cargo-sampan']);
    assert.deepEqual(result.boats.map(b=>b.group.position.toArray()),[[-20,-.28,75],[-10,-.28,70]]);
    assert.equal(result.stats.harborBoatBatches,2);assert.equal(result.stats.harborSalas,1);
    assert(result.stats.harborSourceMeshes<1000,'bounded source mesh budget');
    assert(result.stats.harborBounds.min.every(Number.isFinite));assert(result.stats.harborBounds.max.every(Number.isFinite));
    assert(result.stats.harborBounds.min[0]>=-73);assert(result.stats.harborBounds.max[0]<=73);
    assert(result.stats.harborBounds.max[2]<90);
  }finally{h.dispose();}
});

test('uprights stay offshore or inside existing cargo lots; apron stays flat and readable',async()=>{
  const h=harness();try {
    await buildCityHarbor(h.api);const lots=COMPACT_CITY.buildings.filter(b=>['warehouse','fishmarket'].includes(b.id));
    for(const root of [h.staticRoot,h.root]){root.updateMatrixWorld(true);root.traverse(o=>{
      if(!o.isMesh)return;const bounds=new THREE.Box3().setFromObject(o);
      assert(o.geometry.attributes.position.array.every(Number.isFinite));
      if(o.userData.harborGround){assert(bounds.max.y>=.07&&bounds.max.y<=.10);assert(bounds.min.z>=54);assert(bounds.max.z<=64.01);return;}
      assert(bounds.min.z>=64.65-.0001||lots.some(b=>bounds.min.x>=b.x-b.w/2-.0001&&bounds.max.x<=b.x+b.w/2+.0001&&bounds.min.z>=b.z-b.d/2-.0001&&bounds.max.z<=b.z+b.d/2+.0001),'unreserved harbor upright '+JSON.stringify(bounds));
      if(bounds.min.x<5.3&&bounds.max.x>-5.3&&bounds.min.z<83)assert(bounds.max.y<1.2,'central view stays open');
    });}
    assert(h.staticRoot.getObjectByName('city-harbor-closed-berths'));
  }finally{h.dispose();}
});

test('boat motion envelope remains beyond walk boundary and hulls are tapered with outward normals',async()=>{
  const h=harness();try {
    const {boats}=await buildCityHarbor(h.api);
    for(const {group,phase}of boats)for(const t of [0,2,5,9,16]) {
      group.position.y=-.28+Math.sin(t*.72+phase)*.052;
      group.rotation.z=Math.sin(t*.47+phase)*.009;group.rotation.x=Math.sin(t*.61+phase)*.007;
      group.updateMatrixWorld(true);assert(new THREE.Box3().setFromObject(group).min.z>=64.65);
    }
    const strips=[...h.resources].filter(g=>g.isBufferGeometry&&g.attributes.position?.count===42&&g.index?.count===120);
    const strip=strips[0];
    assert(strip,'authored curved hull strip exists');
    const p=strip.attributes.position,n=strip.attributes.normal;
    assert(Math.abs(p.getX(0))<Math.abs(p.getX(20))*.2,'bow tapers instead of box hull');
    assert(n.getX(20)<0,'port hull normals face outwards');assert(p.getY(0)>p.getY(20),'bow rises');
    assert(strips[5].attributes.normal.getX(20)>0,'starboard hull normals face outwards');
    assert(strips[2].attributes.normal.getY(20)<0,'keel underside normals face downwards');
    const caps=[...h.resources].filter(g=>g.isBufferGeometry&&g.attributes.position?.count===4&&g.index?.count===6);
    const bow=caps.find(g=>Math.abs(g.attributes.position.getZ(0)+7)<.001);
    const stern=caps.find(g=>Math.abs(g.attributes.position.getZ(0)-7)<.001);
    assert(bow.attributes.normal.getZ(0)<0,'bow cap faces forward');
    assert(stern.attributes.normal.getZ(0)>0,'stern cap faces aft');
    assert(strip.attributes.uv.count===p.count,'plank maps retain UVs');
  }finally{h.dispose();}
});

test('failure during second boat assembly leaves all allocations reachable by parent cleanup',async()=>{
  const h=harness(2);await assert.rejects(buildCityHarbor(h.api),/injected harbor batching failure/);
  assert.equal(h.batchCalls,2);assert.equal(h.roots.size,6);
  let released=0;for(const r of h.resources)r.addEventListener('dispose',()=>released++);
  const count=h.dispose();assert.equal(released,count);assert.equal(h.dispose(),0);
  for(const g of h.roots)assert.equal(g.children.length,0);
});

test('sala rests on four submerged pilings and a closed connector reaches the quay',async()=>{
  const h=harness();try {
    const {stats}=await buildCityHarbor(h.api);
    const sala=h.staticRoot.getObjectByName('city-harbor-waiting-sala');
    const pilings=sala.children.filter(o=>o.isMesh&&Math.abs(o.position.y+1.1)<.0001);
    assert.equal(pilings.length,4);sala.updateMatrixWorld(true);
    for(const p of pilings){const b=new THREE.Box3().setFromObject(p);assert(b.min.y<-.32);assert(b.max.y>=.19);}
    const harbor=h.staticRoot.getObjectByName('city-harbor-quay');
    const connector=harbor.children.find(o=>o.isMesh&&o.position.x===24&&o.position.z===66.8);
    assert(connector);const b=new THREE.Box3().setFromObject(connector);
    assert(Math.abs(b.min.z-65.2)<.0001);assert(b.max.z>=68.1);
    assert.equal(stats.harborSalaPilings,4);assert.equal(stats.harborConnectors,1);
  }finally{h.dispose();}
});
