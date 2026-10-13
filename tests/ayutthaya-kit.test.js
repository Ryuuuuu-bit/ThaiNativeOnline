// The Ayutthaya kit (tools/city-kit/ayutthaya_kit.py → public/models/city/ayutthaya-kit.glb) and
// where buildCityAyutthaya.js puts its pieces on the north avenue.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { gltfLoader } from '../src/core/gltf.js';
import { COMPACT_CITY as CITY, compactCityCanStand, COMPACT_CITY_NODES } from '../src/world/compact-city.js';
import { findPath } from '../src/core/GridPath.js';
import { KIT_PIECES, kitFromGltf, AYUTTHAYA_PLACEMENTS, buildCityAyutthaya } from '../src/world/compact-city-render/buildCityAyutthaya.js';

const PALETTE = ['brick', 'brickRed', 'rim', 'cream', 'gold', 'wood', 'dark', 'timber', 'roof', 'roofDark', 'jade', 'red', 'clay', 'leaf', 'leafDark', 'leafLight', 'lantern', 'cloth', 'bark'];
async function kit() {
  const bytes = await readFile(new URL('../public/models/city/ayutthaya-kit.glb', import.meta.url));
  assert.ok(bytes.length < 200000, `download budget: ${bytes.length}`);
  return kitFromGltf(await gltfLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), ''));
}
const bounds = piece => new THREE.Box3().setFromObject(piece);

test('the kit holds every piece, standing on its origin, in palette materials, within a triangle budget', async () => {
  const pieces = await kit();
  assert.deepEqual([...pieces.keys()].sort(), [...KIT_PIECES].sort());
  let triangles = 0;
  for (const [name, piece] of pieces) {
    const b = bounds(piece);
    assert.ok(Math.abs(b.min.y) < .05, `${name} stands on the ground (${b.min.y})`);
    assert.ok(Math.abs((b.min.x + b.max.x) / 2) < 1.2 && Math.abs((b.min.z + b.max.z) / 2) < 1.2, `${name} is centred on its origin`);
    for (const part of piece.children) {
      assert.ok(PALETTE.includes(part.name), `${name}: material ${part.name} is in the palette`);
      const g = part.geometry;
      assert.ok(g.attributes.position.array instanceof Float32Array && g.attributes.uv && g.attributes.normal, `${name}: plain float geometry with UVs`);
      assert.ok(Array.from(g.attributes.position.array).every(Number.isFinite));
      triangles += (g.index ? g.index.count : g.attributes.position.count) / 3;
    }
  }
  assert.ok(triangles < 12000, `kit triangles ${triangles}`);
});

test('inside the walls every piece sits in a kit reservation; the perimeter stays beyond the walk boundary', async () => {
  const pieces = await kit(), placements = AYUTTHAYA_PLACEMENTS(CITY), b = CITY.bounds;
  const reservations = CITY.buildings.filter(r => r.kind === 'kit');
  assert.ok(reservations.length >= 10 && placements.length > 100);
  for (const p of placements) {
    const inside = p.x > b.minX && p.x < b.maxX && p.z > b.minZ && p.z < b.maxZ;
    if (inside) {
      assert.ok(reservations.some(r => Math.abs(p.x - r.x) <= r.w / 2 + .5 && Math.abs(p.z - r.z) <= r.d / 2 + .5), `${p.piece} at ${p.x}, ${p.z} is reserved`);
      assert.equal(compactCityCanStand(p.x, p.z), false, `${p.piece} at ${p.x}, ${p.z} blocks walking`);
    } else {
      // a perimeter piece, turned and scaled as placed, never reaches into the walk area
      const box = bounds(pieces.get(p.piece)).applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(p.x, 0, p.z),
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.ry), new THREE.Vector3(p.sx * p.s, p.s, p.s)));
      const reaches = box.max.z > b.minZ + .2 && box.min.z < b.maxZ && box.max.x > b.minX + .2 && box.min.x < b.maxX - .2;
      assert.ok(!reaches, `${p.piece} at ${p.x}, ${p.z} stays outside the walk area (${box.min.x.toFixed(1)}…${box.max.x.toFixed(1)}, ${box.min.z.toFixed(1)}…${box.max.z.toFixed(1)})`);
    }
  }
  // the gate spans the avenue's end and the walls close the north side on both sides of it
  assert.ok(placements.some(p => p.piece === 'gate' && p.x === 0));
  assert.equal(placements.filter(p => p.piece === 'bastion').length, 2);
});

test('the avenue stays open: every junction stands clear and the plaza still reaches the north gate', () => {
  for (const [id, [x, z]] of Object.entries(COMPACT_CITY_NODES)) assert.ok(compactCityCanStand(x, z, .35), id);
  for (const r of CITY.buildings.filter(b => b.kind === 'kit')) {
    const others = CITY.buildings.filter(o => o !== r && Math.abs(o.x - r.x) < (o.w + r.w) / 2 && Math.abs(o.z - r.z) < (o.d + r.d) / 2);
    assert.deepEqual(others.map(o => o.id), [], `${r.id} overlaps nothing`);
  }
  for (const goal of [{ x: 0, z: -59 }, { x: -12, z: -24 }, { x: 12, z: -24 }, { x: 15, z: -39 }, { x: -16, z: -39 }])
    assert.ok(findPath((x, z) => compactCityCanStand(x, z, .35), CITY.spawn, goal, { step: .5, margin: 30 }), `route to ${goal.x}, ${goal.z}`);
});

test('the pieces take the town materials and only allocate what they add', async () => {
  const pieces = await kit(), root = new THREE.Group(), lightRoot = new THREE.Group();
  const M = Object.fromEntries(PALETTE.filter(k => !['brickRed', 'cloth', 'bark'].includes(k)).concat(['ochre']).map(k => [k, new THREE.MeshStandardMaterial({ name: k })]));
  const made = [];
  const built = buildCityAyutthaya({ root, lightRoot, kit: pieces, M, mat: (c, o) => { const m = new THREE.MeshStandardMaterial({ color: c, ...o }); made.push(m); return m; }, city: CITY });
  const stats = built.stats;
  assert.equal(made.length, 1, 'one extra material (the gate brick)');
  const used = new Set(); root.traverse(o => { if (o.isMesh) used.add(o.material); });
  for (const m of used) assert.ok(Object.values(M).includes(m) || made.includes(m));
  assert.equal(stats.pieces.gate, 1); assert.equal(stats.pieces.shophouse, 6); assert.equal(stats.pieces.elephant, undefined, 'the royal elephants are the Tripo model (buildCityElephants.js)');
  assert.equal(stats.placements, AYUTTHAYA_PLACEMENTS(CITY).length);
  // every lamp, shophouse lantern and gate lantern glows at night: a halo and a pool of light
  const lamps = stats.pieces.lamp, expected = lamps + stats.pieces.shophouse + 2;
  assert.equal(stats.lights, expected, `lights ${stats.lights}`);
  for (const l of built.lights) assert.ok(l.at.y > 1.8 && l.at.y < 4.2, `a lantern hangs at ${l.at.y.toFixed(2)} m`);
  const halos = lightRoot.getObjectByName('ayutthaya-lantern-halos'), poolMesh = lightRoot.getObjectByName('ayutthaya-light-pools');
  assert.ok(halos && poolMesh);
  built.update(0); assert.equal(halos.visible, false); assert.equal(poolMesh.visible, false);
  built.update(1); assert.equal(halos.visible, true); assert.ok(poolMesh.material.opacity > .3);
});
