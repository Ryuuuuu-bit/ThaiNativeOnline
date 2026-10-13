// The royal elephants (Tripo GLB) that replace the kit's stucco pair on the north avenue.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { COMPACT_CITY as CITY, compactCityCanStand } from '../src/world/compact-city.js';
import { AYUTTHAYA_PLACEMENTS } from '../src/world/compact-city-render/buildCityAyutthaya.js';
import { buildCityElephants, ROYAL_ELEPHANT } from '../src/world/compact-city-render/buildCityElephants.js';

const yards = CITY.buildings.filter(b => b.kind === 'kit' && b.variant === 'elephant');

test('the royal elephant model is packed for the meshopt loader and phone-sized', () => {
  const raw = readFileSync(new URL(`../public${ROYAL_ELEPHANT.url}`, import.meta.url));
  assert.equal(raw.subarray(0, 4).toString(), 'glTF');
  const json = JSON.parse(raw.subarray(20, 20 + raw.readUInt32LE(12)).toString());
  assert.ok(json.extensionsUsed.includes('EXT_meshopt_compression'), 'packed (src/core/gltf.js decodes meshopt)');
  assert.ok(raw.length < 600_000, `download ${raw.length} bytes`);
  assert.ok(json.images.length >= 1, 'textured');
});

test('two royal elephants face the avenue from their reservations; the kit no longer draws stucco ones', async () => {
  assert.deepEqual(yards.map(y => y.id).sort(), ['kit_elephant_e', 'kit_elephant_w']);
  assert.equal(AYUTTHAYA_PLACEMENTS(CITY).filter(p => p.piece === 'elephant').length, 0);
  // A stand-in body with the Tripo model's proportions (front toward +z) and its physical material.
  const scene = new THREE.Group(), material = new THREE.MeshPhysicalMaterial();
  const stand = new THREE.Mesh(new THREE.BoxGeometry(.6, .73, 1), material); stand.position.y = .365; scene.add(stand);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(.1, .1, .1), material); nose.name = 'nose'; nose.position.set(0, .4, .55); scene.add(nose);
  const built = await buildCityElephants({ city: CITY, load: async () => ({ scene }) });
  const root = new THREE.Group(); root.add(built.root); root.updateMatrixWorld(true);
  assert.equal(built.stats.royalElephants, 2);
  for (const yard of yards) {
    const g = built.root.getObjectByName(`city-model:${yard.id}`), body = g.getObjectByName('city-model-body');
    const box = new THREE.Box3().setFromObject(body);
    assert.ok(box.min.x >= yard.x - yard.w / 2 && box.max.x <= yard.x + yard.w / 2, `${yard.id} x ${box.min.x.toFixed(2)}…${box.max.x.toFixed(2)}`);
    assert.ok(box.min.z >= yard.z - yard.d / 2 && box.max.z <= yard.z + yard.d / 2, `${yard.id} z ${box.min.z.toFixed(2)}…${box.max.z.toFixed(2)}`);
    assert.ok(Math.abs(box.min.y - ROYAL_ELEPHANT.plinth) < 1e-6, 'stands on its plinth');
    assert.ok(box.max.y - box.min.y > 2 && box.max.y - box.min.y <= ROYAL_ELEPHANT.height + 1e-6, `height ${box.max.y - box.min.y}`);
    const tip = body.getObjectByName('nose').getWorldPosition(new THREE.Vector3());
    assert.ok(Math.sign(tip.x - yard.x) === Math.sign(-yard.x), `${yard.id} faces the avenue`);
    assert.equal(compactCityCanStand(yard.x, yard.z), false, `${yard.id} stays solid`);
  }
  let physical = 0; built.root.traverse(o => { if (o.isMesh && o.material.isMeshPhysicalMaterial) physical++; });
  assert.equal(physical, 0, 'physical material downgraded');
  built.dispose(); assert.equal(built.root.parent, null);
});
