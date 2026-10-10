import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { gltfLoader } from '../src/core/gltf.js';

test('hunter companion body preserves the quadruped animator contract and valid skin', async () => {
  const bytes = await readFile(new URL('../public/models/hunter-dog.glb', import.meta.url));
  assert.ok(bytes.length < 1200000, 'companion download budget');
  // Native browser captures separately verify the real embedded texture.
  const loader = gltfLoader().register(parser => {
    // WebP extensions call loadTextureImage directly, before ordinary plugin
    // fallbacks. Stub only image decoding; keep the native geometry/skin path.
    parser.loadTextureImage = () => Promise.resolve(new THREE.Texture());
    return { name: 'QA_TEXTURES', loadTexture: () => Promise.resolve(new THREE.Texture()) };
  });
  const gltf = await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  const meshes = [];
  gltf.scene.traverse(node => { if (node.isMesh) meshes.push(node); });
  assert.equal(meshes.length, 1, 'one reusable companion body');
  const body = meshes[0];
  assert.ok(body.isSkinnedMesh, 'not a static substitute');
  assert.ok(!Array.isArray(body.material), 'production glow controller expects one material');
  assert.ok(body.material.isMeshStandardMaterial);
  assert.ok(body.geometry.index.count / 3 <= 12000, 'companion triangle budget');
  assert.equal(body.skeleton.bones.length, 38);
  const names = new Set(body.skeleton.bones.map(bone => bone.name.replace(/:/g, '')));
  for (const end of [0, 1]) for (const side of ['Left', 'Right']) for (const joint of [0, 1, 2, 3]) {
    assert.ok(names.has(`tripo${end}_${side}_Limb_${joint}`), 'complete canine limb chain');
  }
  for (const name of ['tripo::Spine_0', 'tripo::Spine_4', 'tripo::Spine_6', 'tripo::Spine_7',
    'tripo::Head_0', 'bone_2', 'tripo::Tail_0', 'bone_14', 'bone_15']) assert.ok(names.has(name.replace(/:/g, '')), name);

  const { position, skinIndex, skinWeight } = body.geometry.attributes;
  assert.equal(position.count, skinIndex.count);
  assert.equal(position.count, skinWeight.count);
  gltf.scene.updateMatrixWorld(true); body.skeleton.update();
  const rest = new THREE.Vector3(), posed = new THREE.Vector3(), world = new THREE.Vector3();
  const bounds = new THREE.Box3();
  for (let vertex = 0; vertex < position.count; vertex++) {
    let sum = 0;
    for (let influence = 0; influence < 4; influence++) {
      const weight = skinWeight.getComponent(vertex, influence), joint = skinIndex.getComponent(vertex, influence);
      assert.ok(Number.isFinite(weight) && weight >= 0 && weight <= 1, 'finite nonnegative weights');
      assert.ok(Number.isInteger(joint) && joint >= 0 && joint < body.skeleton.bones.length, 'existing joint index');
      sum += weight;
    }
    assert.ok(Math.abs(sum - 1) < .002, 'every vertex has normalized influences');
    rest.fromBufferAttribute(position, vertex);
    body.getVertexPosition(vertex, posed);
    assert.ok(posed.toArray().every(Number.isFinite), 'finite rest deformation');
    // Compare in metres: quantized source positions can use a large local range.
    rest.applyMatrix4(body.matrixWorld); world.copy(posed).applyMatrix4(body.matrixWorld);
    assert.ok(rest.distanceTo(world) < .001, 'inverse binds reproduce the exported rest surface');
    bounds.expandByPoint(world);
  }
  assert.ok(bounds.min.y >= -.025 && bounds.max.y < 1.4, 'grounded canonical companion scale');
  assert.ok(bounds.getSize(new THREE.Vector3()).z > .5, 'body has a readable forward extent');
});
