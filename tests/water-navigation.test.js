import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { buildWater } from '../src/world/Water.js';
import { waterSurfaces } from '../src/world/water-surfaces.js';
import { waterSurfaceFor, waterAllowsStanding, WADE } from '../src/world/water-navigation.js';
import { TerrainData } from '../src/world/Terrain.js';
import { MAPS } from '../src/world/maps.js';
import { BOUNDS, WATER_Y, waterAt, POND, NONGS, riverBank } from '../src/world/CityMap.js';
import { navigation } from '../server/navigation.js';

const surface = waterSurfaceFor(BOUNDS), terrain = new TerrainData(BOUNDS);
const hash = a => createHash('sha256').update(Buffer.from(a.buffer, a.byteOffset, a.byteLength)).digest('hex');

test('shared water topology preserves every original rendered buffer across all maps', () => {
  const baseline = JSON.parse(readFileSync(new URL('./water-geometry-baseline.json', import.meta.url)));
  for (const map of Object.values(MAPS)) {
    if (map.expedition) { assert.deepEqual(baseline[map.id], []); continue; }
    const water = buildWater(new THREE.Scene(), map.view);
    const actual = water.meshes.map(({ geometry: g }) => ({
      vertices: g.attributes.position.count, indices: g.index.count,
      positions: hash(g.attributes.position.array), shore: hash(g.attributes.aShore.array), index: hash(g.index.array),
    }));
    assert.deepEqual(actual, baseline[map.id], map.id);
    water.dispose();
  }
});

test('local triangle index finds every rendered centroid at its actual surface height', () => {
  let checked = 0;
  for (const { positions: p, indices } of waterSurfaces(BOUNDS)) {
    for (let i = 0; i < indices.length; i += 3) {
      const ids = indices.slice(i, i + 3).map(n => n * 3);
      const x = ids.reduce((s, n) => s + p[n], 0) / 3;
      const y = ids.reduce((s, n) => s + p[n + 1], 0) / 3;
      const z = ids.reduce((s, n) => s + p[n + 2], 0) / 3;
      assert.ok(surface.heightAt(x, z) >= y - 1e-7, `${x},${z}`);
      checked++;
    }
  }
  assert.ok(checked > 20000);
});

test('all former north forest trail points and other dry depressions allow standing', () => {
  let low = 0;
  for (let i = 0; i <= 100; i++) for (const [x, z] of [
    [-4 + 15 * i / 100, -414 - 20 * i / 100], [11 - 2.5 * i / 100, -434 - 5 * i / 100],
  ]) {
    assert.equal(surface.heightAt(x, z), null);
    assert.equal(waterAllowsStanding(terrain, surface, x, z), true);
    if (terrain.height(x, z) < WATER_Y - WADE) low++;
  }
  assert.ok(low > 80);
  for (const [x, z] of [[10.5, -429], [27, -548], [8.5, -450]]) {
    assert.equal(surface.heightAt(x, z), null);
    assert.equal(waterAllowsStanding(terrain, surface, x, z), true);
  }
});

test('visible fringes outside deep masks still enforce their actual water depth', () => {
  const points = [[-20, -408], [-20, -404.25], [0, riverBank(0) - .5],
    [POND.x + POND.rx + .2, POND.z], [NONGS[0].x + NONGS[0].rx * 1.08, NONGS[0].z], [-92, -200]];
  for (const [x, z] of points) {
    const y = surface.heightAt(x, z);
    assert.notEqual(y, null, `${x},${z} must detect rendered water`);
    assert.equal(terrain.isDeep(x, z), false);
    const fake = { isDeep: () => false, height: () => y - WADE - .001 };
    assert.equal(waterAllowsStanding(fake, surface, x, z), false);
    fake.height = () => y - WADE + .001;
    assert.equal(waterAllowsStanding(fake, surface, x, z), true);
  }
  assert.equal(waterAt(-20, -404.25), 0);
  assert.equal(waterAllowsStanding(terrain, surface, -20, -404.25), false);
  assert.equal(waterAllowsStanding(terrain, surface, -20, -408), true, 'real stream fringe is only 3 cm deep');
});

test('polygon pond corners and finite stream ends do not grow analytical water beyond rendered geometry', () => {
  const a = Math.PI / 28;
  // Inside an ideal ellipse, but outside the first edge of the actual 28-gon.
  const x = POND.x + Math.cos(a) * (POND.rx + .6) * .997;
  const z = POND.z + Math.sin(a) * (POND.rz + .6) * .997;
  assert.equal(surface.heightAt(x, z), null);
  assert.equal(surface.heightAt(-136, -392), null, 'ribbon end has no capsule extension');
});

test('deep-water masks cannot be bypassed by high ground and invalid inputs are rejected', () => {
  for (const [x, z] of [[0, 190], [42, -80], [-20, -406], [0, -689]]) {
    assert.equal(terrain.isDeep(x, z), true);
    assert.equal(waterAllowsStanding(terrain, surface, x, z), false);
    assert.equal(waterAllowsStanding({ isDeep: () => true, height: () => 20 }, surface, x, z), false);
  }
  for (const [x, z] of [[NaN, 0], [0, Infinity]]) {
    assert.equal(surface.heightAt(x, z), null);
    assert.equal(waterAllowsStanding(terrain, surface, x, z), false);
  }
});

test('expedition views contain no city water and remain dry at negative terrain heights', () => {
  for (const map of Object.values(MAPS).filter(m => m.expedition)) {
    const s = waterSurfaceFor(map.view, false), t = new TerrainData(map.view);
    assert.equal(s.heightAt(map.spawn.x, map.spawn.z), null);
    assert.equal(waterAllowsStanding(t, s, map.spawn.x, map.spawn.z), true);
    assert.equal(waterAllowsStanding({ isDeep: () => false, height: () => -50 }, s, map.spawn.x, map.spawn.z), true);
  }
});

test('authoritative navigation admits dry regressions and bridge decks but rejects deep water and boundaries', () => {
  for (const [map, x, z] of [['deep_forest', 10.5, -429], ['wat_rang', 27, -548],
    ['deep_forest', -4, -405], ['city', 0, -10]]) {
    assert.equal(navigation(map).canStand(x, z), true, `${map} ${x},${z}`);
  }
  for (const [map, x, z] of [['deep_forest', -20, -404.25], ['city', 0, 190],
    ['city', 1000, 0], ['deep_forest', 0, -1000]]) {
    assert.equal(navigation(map).canStand(x, z), false, `${map} ${x},${z}`);
  }
  for (const map of Object.values(MAPS)) {
    assert.equal(navigation(map.id).canStand(map.spawn.x, map.spawn.z), true, map.id);
  }
});
