import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { gltfLoader } from '../src/core/gltf.js';

test('Meshy warrior review candidate has a valid humanoid skin and native locomotion', async () => {
  const bytes = await readFile(new URL('../tools/warrior-anims/meshy/warrior-meshy-preview.glb', import.meta.url));
  assert.ok(bytes.length < 1700000, 'review download budget');
  const loader = gltfLoader().register(() => ({ name: 'QA_TEXTURES', loadTexture: () => Promise.resolve(new THREE.Texture()) }));
  const gltf = await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  const meshes = []; gltf.scene.traverse(o => { if (o.isMesh) meshes.push(o); });
  assert.equal(meshes.length, 1);
  const mesh = meshes[0]; assert.ok(mesh.isSkinnedMesh);
  assert.equal(mesh.skeleton.bones.length, 24);
  assert.ok(mesh.geometry.index.count / 3 < 25000);
  const hips = mesh.skeleton.bones.find(b => b.name === 'Hips'); assert.ok(hips);
  assert.deepEqual(gltf.animations.map(c => c.name).sort(), ['idle', 'run', 'walk']);
  const mixer = new THREE.AnimationMixer(gltf.scene), v = new THREE.Vector3(), center = new THREE.Vector3();
  for (const clip of gltf.animations) {
    assert.ok(clip.duration > 0);
    mixer.stopAllAction(); mixer.clipAction(clip).setLoop(THREE.LoopOnce, 1).reset().play();
    for (let t = 0; t < clip.duration; t += 1 / 30) {
      mixer.setTime(t); gltf.scene.updateMatrixWorld(true); mesh.skeleton.update(); hips.getWorldPosition(center);
      for (let i = 0; i < mesh.geometry.attributes.position.count; i += 47) {
        mesh.getVertexPosition(i, v); mesh.localToWorld(v);
        assert.ok(v.toArray().every(Number.isFinite) && v.distanceTo(center) < 2, `${clip.name}: invalid deformation`);
      }
    }
  }
});
