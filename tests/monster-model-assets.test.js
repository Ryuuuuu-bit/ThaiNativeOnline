import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { gltfLoader } from '../src/core/gltf.js';   // the game's loader (meshopt decoder: the models are gltfpack-ed)
import { MONSTER_MODELS } from '../src/combat/MonsterModels.js';

for (const type of Object.keys(MONSTER_MODELS)) test(`${type}: exported skin, clips, loop seams and animated bounds are valid`, async () => {
  const data = await readFile(new URL(`../public/models/monsters/${type}.glb`, import.meta.url));
  assert.equal(data.readUInt32LE(0), 0x46546c67);
  assert.equal(data.readUInt32LE(8), data.length);
  const gltf = await gltfLoader().parseAsync(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength), '');
  assert.deepEqual(gltf.animations.map(c => c.name).sort(), ['attack','die','hurt','idle','walk']);
  const meshes = []; gltf.scene.traverse(o => { if (o.isMesh) meshes.push(o); assert.ok(!o.isCamera && !o.isLight, 'studio objects must not ship'); });
  assert.ok(meshes.length <= 11, 'consolidate meshes by material');
  let triangles=0;
  for (const mesh of meshes) {
    assert.ok(mesh.isSkinnedMesh);
    const weights=mesh.geometry.getAttribute('skinWeight');
    for(let i=0;i<weights.count;i++) assert.ok(Math.abs(weights.getX(i)+weights.getY(i)+weights.getZ(i)+weights.getW(i)-1)<1e-4);
    triangles+=(mesh.geometry.index?.count ?? mesh.geometry.getAttribute('position').count)/3;
  }
  assert.ok(triangles>1000 && triangles<15000);
  const mixer = new THREE.AnimationMixer(gltf.scene), point = new THREE.Vector3();
  for (const clip of gltf.animations) {
    assert.ok(clip.duration>0);
    for (const track of clip.tracks) {
      assert.ok(Array.from(track.values).every(Number.isFinite));
      if (clip.name==='idle' || clip.name==='walk') {
        const n=track.getValueSize();
        for(let i=0;i<n;i++) assert.ok(Math.abs(track.values[i]-track.values[track.values.length-n+i])<1e-4, `${clip.name} must loop without a pose jump`);
      }
    }
    mixer.stopAllAction();mixer.clipAction(clip).setLoop(THREE.LoopOnce,1).reset().play();
    for(const fraction of [0,.25,.5,.75,.99]) {
      mixer.setTime(clip.duration*fraction);gltf.scene.updateMatrixWorld(true);
      for(const mesh of meshes) {
        mesh.skeleton.update();const count=mesh.geometry.getAttribute('position').count;
        for(let i=0;i<count;i+=Math.max(1,Math.floor(count/60))) {
          mesh.getVertexPosition(i,point);mesh.localToWorld(point);
          assert.ok(point.toArray().every(Number.isFinite));
          assert.ok(point.length()<8, 'bad bind matrices or animation must not explode the mesh');
        }
      }
    }
  }
});
