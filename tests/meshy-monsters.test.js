import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { gltfLoader } from '../src/core/gltf.js';

for (const type of ['boar', 'fowl', 'crab', 'cobra', 'monkey', 'dhole', 'phibpa', 'buffalo', 'kongkoi', 'monitor', 'pray', 'khamot', 'winyan', 'takian', 'headless','pret','krahang','krasue','phitaihong','soldier','pusom']) test(`Meshy ${type}: candidate has embedded textures, valid geometry and a reproducible hash`, async () => {
  const base = new URL('../tools/monster-models/meshy/', import.meta.url);
  const bytes = await fs.readFile(new URL(`${type}.glb`, base));
  const report = JSON.parse(await fs.readFile(new URL(`${type}-prepared.json`, base)));
  const provenance = JSON.parse(await fs.readFile(new URL(`${type}-provenance.json`, base)));
  assert.equal(bytes.readUInt32LE(0), 0x46546c67);
  assert.equal(bytes.readUInt32LE(8), bytes.length);
  assert.ok(bytes.length < 1800000, 'small review download');
  assert.equal(createHash('sha256').update(bytes).digest('hex'), report.sha256);
  assert.equal(provenance.status, 'SUCCEEDED');
  assert.equal(createHash('sha256').update(await fs.readFile(new URL(provenance.reference, base))).digest('hex'), provenance.referenceSha256);
  const json = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)));
  assert.ok(json.extensionsRequired.includes('EXT_meshopt_compression'));
  assert.ok(json.images.length >= 1);
  for (const image of json.images) {
    assert.ok(Number.isInteger(image.bufferView), 'textures must ship embedded');
    assert.ok(!image.uri, 'no expiring URLs or runtime external dependencies');
  }
  assert.ok(report.textures.every(t => Math.max(...t.size) <= 1024));
  // Pixel decoding is tested in the real browser; this test checks all geometry.
  const loader = gltfLoader().register(() => ({ name: 'QA_TEXTURES', loadTexture: () => Promise.resolve(new THREE.Texture()) }));
  const gltf = await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  assert.equal(gltf.animations.length, 0, 'static candidates must not masquerade as animated game assets');
  const meshes = [];
  gltf.scene.traverse(o => { assert.ok(!o.isLight && !o.isCamera); if (o.isMesh) meshes.push(o); });
  assert.equal(meshes.length, 1, 'one material draw per creature');
  let triangles = 0;
  for (const mesh of meshes) {
    assert.ok(!mesh.isSkinnedMesh);
    for (const name of ['position', 'normal', 'uv']) {
      const attribute = mesh.geometry.getAttribute(name);
      assert.ok(attribute, `missing ${name}`);
      assert.ok(Array.from(attribute.array).every(Number.isFinite));
    }
    const p = mesh.geometry.getAttribute('position'), index = mesh.geometry.index;
    assert.ok(index);
    assert.ok(Array.from(index.array).every(i => i >= 0 && i < p.count));
    triangles += index.count / 3;
    const bounds = new THREE.Box3().setFromObject(gltf.scene), size = bounds.getSize(new THREE.Vector3());
    assert.ok(size.toArray().every(n => n > .01 && n < 3), 'bounded natural-sized source geometry');
    if(type==='krasue')assert.ok(size.z>size.y*.20,'Krasue must be a volumetric head and hanging cluster, not a flat relief');
    assert.ok(Math.abs(bounds.min.y) < .001, 'ground pivot');
  }
  assert.equal(triangles, report.triangles);
  assert.ok(triangles > 1000 && triangles < 15000);
});
