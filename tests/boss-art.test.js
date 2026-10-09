import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { MAP_BOSSES, BOSS_SKILLS } from '../src/combat/data/boss-skills.js';
import { inBossSkill } from '../src/combat/bossSkills.js';
import { BOSS_ART, makeBossSkillVFX } from '../src/combat/BossSkillVFX.js';
import { BossTelegraphs } from '../src/combat/BossTelegraphs.js';
import { disposeCombatModel, markCachedCombatGeometry } from '../src/combat/CombatResources.js';

const height=(x,z)=>x*.06-z*.025;
test('a model release frees shared body resources and separate instance buffers exactly once',()=>{
  const group=new THREE.Group(),geometry=new THREE.BoxGeometry(),material=new THREE.MeshStandardMaterial();
  const instances=new THREE.InstancedMesh(geometry,material,4);group.add(instances,new THREE.Mesh(geometry,material));
  const resources=[geometry,material,instances],counts=[0,0,0];
  resources.forEach((r,i)=>r.addEventListener('dispose',()=>counts[i]++));
  disposeCombatModel(group);assert.deepEqual(counts,[1,1,1]);
});
test('model cleanup frees each owned bone texture once without disposing cached colour textures',()=>{
  const group=new THREE.Group(),skeleton=new THREE.Skeleton([new THREE.Bone()]);skeleton.computeBoneTexture();
  const texture=new THREE.Texture(),geometry=new THREE.BoxGeometry(),material=new THREE.MeshStandardMaterial({map:texture});
  for(let i=0;i<2;i++){const mesh=new THREE.SkinnedMesh(geometry,material);mesh.bind(skeleton);group.add(mesh);}
  let bones=0,colours=0;skeleton.boneTexture.addEventListener('dispose',()=>bones++);texture.addEventListener('dispose',()=>colours++);
  disposeCombatModel(group);assert.equal(bones,1);assert.equal(colours,0);
});

test('releasing skinned clones preserves cached geometry and live neighbour resources',()=>{
  const source=new THREE.Group(),geometry=new THREE.BoxGeometry(),texture=new THREE.Texture();
  const material=new THREE.MeshStandardMaterial({map:texture,emissiveMap:texture});
  const bone=new THREE.Bone(),mesh=new THREE.SkinnedMesh(geometry,material);
  mesh.add(bone);mesh.bind(new THREE.Skeleton([bone]));source.add(mesh);
  markCachedCombatGeometry(source);
  const first=cloneSkinned(source),second=cloneSkinned(source);
  const a=first.children[0],b=second.children[0];
  a.material=a.material.clone();b.material=b.material.clone();
  a.skeleton.computeBoneTexture();b.skeleton.computeBoneTexture();
  assert.equal(a.geometry,geometry);assert.equal(b.geometry,geometry);
  assert.notEqual(a.skeleton,b.skeleton);
  const ownedGeometry=new THREE.BoxGeometry(),ownedMaterial=new THREE.MeshStandardMaterial();
  first.add(new THREE.Mesh(ownedGeometry,ownedMaterial));
  // Multiple surfaces in one view may share its owned material and skeleton.
  const extra=new THREE.SkinnedMesh(geometry,[a.material,a.material]);extra.bind(a.skeleton);first.add(extra);
  const resources=[geometry,texture,material,a.material,a.skeleton.boneTexture,b.material,b.skeleton.boneTexture,ownedGeometry,ownedMaterial];
  const counts=resources.map(()=>0);
  resources.forEach((resource,i)=>resource.addEventListener('dispose',()=>counts[i]++));
  let aSkeletonCalls=0,bSkeletonCalls=0;
  const releaseA=a.skeleton.dispose.bind(a.skeleton),releaseB=b.skeleton.dispose.bind(b.skeleton);
  a.skeleton.dispose=()=>{aSkeletonCalls++;releaseA();};b.skeleton.dispose=()=>{bSkeletonCalls++;releaseB();};
  disposeCombatModel(first);
  assert.deepEqual(counts,[0,0,0,1,1,0,0,1,1]);
  assert.equal(aSkeletonCalls,1);assert.equal(bSkeletonCalls,0);
  assert.equal(b.geometry,geometry);assert.equal(b.material.map,texture);
  assert.notEqual(b.skeleton.boneTexture,null);
  disposeCombatModel(second);
  assert.deepEqual(counts,[0,0,0,1,1,1,1,1,1]);assert.equal(bSkeletonCalls,1);
});

test('independent geometry copies and instance buffers remain owned despite a cached source',()=>{
  const cached=new THREE.Group(),geometry=new THREE.BoxGeometry(),material=new THREE.MeshStandardMaterial();
  cached.add(new THREE.Mesh(geometry,material));markCachedCombatGeometry(cached);
  const ownedCopy=geometry.clone(),ownedMaterial=material.clone(),group=new THREE.Group();
  const instances=new THREE.InstancedMesh(geometry,ownedMaterial,2);
  group.add(instances,new THREE.Mesh(ownedCopy,ownedMaterial));
  const resources=[geometry,ownedCopy,ownedMaterial,instances],counts=[0,0,0,0];
  resources.forEach((resource,i)=>resource.addEventListener('dispose',()=>counts[i]++));
  disposeCombatModel(group);assert.deepEqual(counts,[0,1,1,1]);
});
test('all twelve primary bosses have themed art for both attacks; ordinary mobs opt out',()=>{
  assert.equal(Object.keys(MAP_BOSSES).length,12);
  for(const type of Object.values(MAP_BOSSES)) {
    assert.ok(BOSS_ART[type],type);
    for(const skill of BOSS_SKILLS[type])for(const stage of ['windup','impact']) {
      const g=makeBossSkillVFX(type,{...skill,x:10,z:-8,facing:.65},stage,height);
      assert.equal(g.userData.bossType,type);assert.ok(g.children.length<=2);
      assert.equal(g.children.filter(o=>o.isLight).length,0);
    }
  }
  assert.equal(makeBossSkillVFX('croc',{},'impact',height),null);
});

test('warning decoration follows terrain and never enters a ring safe centre or exceeds a cone',()=>{
  for(const type of Object.values(MAP_BOSSES))for(const skill of BOSS_SKILLS[type]) {
    const cast={...skill,x:10,z:-8,facing:.65};
    const g=makeBossSkillVFX(type,cast,'windup',height),pos=g.children[0].geometry.attributes.position;
    assert.ok(pos.count>0,`${type}/${skill.id}`);
    for(let i=0;i<pos.count;i++) {
      assert.ok(inBossSkill(cast,{x:pos.getX(i),z:pos.getZ(i)}),`${type}/${skill.id} outside at ${i}`);
      assert.ok(Math.abs(pos.getY(i)-height(pos.getX(i),pos.getZ(i))-.155)<.00001);
    }
    // Every point on the line, not just its endpoints, must stay in the footprint.
    for(let i=0;i<pos.count;i+=2)for(let k=0;k<=10;k++)assert.ok(inBossSkill(cast,{x:THREE.MathUtils.lerp(pos.getX(i),pos.getX(i+1),k/10),z:THREE.MathUtils.lerp(pos.getZ(i),pos.getZ(i+1),k/10)}));
  }
});

test('impact anchors and animated mesh geometry stay within advertised attacks; clocks never change cast data',()=>{
  const matrix=new THREE.Matrix4(),world=new THREE.Vector3();
  for(const type of Object.values(MAP_BOSSES))for(const skill of BOSS_SKILLS[type]) {
    const cast={...skill,x:10,z:-8,facing:.65},before=JSON.stringify(cast);
    const g=makeBossSkillVFX(type,cast,'impact',height),mesh=g.children[1];
    for(const k of [0,.2,.5,.8,1]) {
      g.userData.update(k);g.updateMatrixWorld(true);
      assert.equal(JSON.stringify(cast),before);
      assert.ok(mesh.material.opacity>=0&&mesh.material.opacity<=1);
      const pos=mesh.geometry.attributes.position;
      for(let n=0;n<(mesh.isInstancedMesh?mesh.count:1);n++) {
        if(mesh.isInstancedMesh)mesh.getMatrixAt(n,matrix);else matrix.identity();
        matrix.premultiply(mesh.matrixWorld);
        for(let i=0;i<pos.count;i++) {
          world.fromBufferAttribute(pos,i).applyMatrix4(matrix);
          assert.ok(Number.isFinite(world.y));
          assert.ok(inBossSkill(cast,world),`${type}/${skill.id} k=${k} n=${n} outside`);
        }
      }
    }
  }
});

test('themed effects cancel / clear / expire with their authoritative marker and free GPU resources once',()=>{
  const root=new THREE.Group(),view=new BossTelegraphs(root,height);
  const cast={...BOSS_SKILLS.demon_rift_3[1],x:2,z:3,facing:0,serial:1};
  view.event({monster:{id:1,type:'demon_rift_3'},stage:'impact',cast});
  const item=view.items.get(1),disposed=new Map();
  item.group.traverse(o=>{
    for(const resource of [o.isInstancedMesh?o:null,o.geometry,o.material].filter(Boolean))if(!disposed.has(resource)) {
      disposed.set(resource,0);resource.addEventListener('dispose',()=>disposed.set(resource,disposed.get(resource)+1));
    }
  });
  view.event({monster:{id:1,type:'demon_rift_3'},stage:'cancel',cast:{...cast,serial:2}});
  assert.equal(view.items.size,1,'an older/newer unrelated cast cannot cancel this serial');
  view.event({monster:{id:1,type:'demon_rift_3'},stage:'cancel',cast});
  view.clear();assert.equal(root.children.length,0);
  for(const count of disposed.values())assert.equal(count,1);
  view.event({monster:{id:1,type:'demon_rift_3'},stage:'impact',cast});view.update(.5,{x:2,z:3});
  assert.equal(view.items.size,0);assert.equal(root.children.length,0);
});
