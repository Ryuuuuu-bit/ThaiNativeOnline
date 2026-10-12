import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { applyCityFoliageWind, attachCityFoliageShadows } from '../src/world/compact-city-render/cityFoliageWind.js';
import { buildCityWater, createCityWaterMaterial } from '../src/world/compact-city-render/buildCityWater.js';
import { patchMaterial, windUniforms } from '../src/world/shaders.js';
import { COMPACT_CITY, compactCityCanStand } from '../src/world/compact-city.js';
import { MAPS } from '../src/world/maps.js';
import { waterSurfaces } from '../src/world/water-surfaces.js';
import { waterSurfaceFor } from '../src/world/water-navigation.js';

// Exercise Three's actual shader templates and controller contracts without a
// GPU. Browser compilation/visual correctness are separate main-owned checks.
function shader(material, kind = 'standard') {
  const source = THREE.ShaderLib[kind];
  const result = { uniforms: {}, vertexShader: source.vertexShader, fragmentShader: source.fragmentShader };
  material.onBeforeCompile(result, {});
  return result;
}
function disposalCount(resource) {
  let count = 0;
  resource.addEventListener('dispose', () => count++);
  return () => count;
}
function foliageScene(fade = true) {
  const root = new THREE.Group(), geometry = new THREE.BoxGeometry();
  const material = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide });
  patchMaterial(material, { fade }); applyCityFoliageWind(material, { fade });
  const ordinary = new THREE.Mesh(geometry, material), instanced = new THREE.InstancedMesh(geometry, material, 2);
  ordinary.castShadow = instanced.castShadow = true;
  instanced.setMatrixAt(0, new THREE.Matrix4().makeScale(2, 3, 2));
  instanced.setMatrixAt(1, new THREE.Matrix4().makeTranslation(4, 0, 2));
  const unshadowed = new THREE.Mesh(geometry, material);
  root.add(ordinary, instanced, unshadowed);
  return { root, geometry, material, ordinary, instanced, unshadowed };
}

test('foliage color, depth and distance passes share instanced world deformation and fade uniforms', () => {
  for (const fade of [false, true]) {
    const f = foliageScene(fade), controller = attachCityFoliageShadows(f.root);
    try {
      assert.equal(controller.meshes, 2); assert.equal(controller.materials, 2);
      assert.equal(f.ordinary.customDepthMaterial, f.instanced.customDepthMaterial);
      assert.equal(f.ordinary.customDistanceMaterial, f.instanced.customDistanceMaterial);
      assert.equal(f.unshadowed.customDepthMaterial, undefined);
      const programs = [shader(f.material), shader(f.ordinary.customDepthMaterial, 'depth'),
        shader(f.ordinary.customDistanceMaterial, 'distance')];
      const displacement = program => program.vertexShader.match(/vec3 cityWindPosition[\s\S]*?#include <project_vertex>/)?.[0];
      assert.ok(displacement(programs[0]), 'surface deformation is installed');
      for (const program of programs) {
        assert.equal(displacement(program), displacement(programs[0]), 'shadow deformation must match visible foliage');
        assert.equal(program.uniforms.uCityWindTime, windUniforms.uTime);
        assert.equal(program.uniforms.uCityWindStrength, windUniforms.uWind);
        assert.match(program.vertexShader, /modelMatrix \* instanceMatrix/);
        assert.match(program.vertexShader, /dot\(delta, basis\[0\]\) \/ max\(dot\(basis\[0\], basis\[0\]\)/);
        assert.equal(program.fragmentShader.includes('if (hide >'), fade, 'shadow and color use the same canopy fade');
      }
      for (const m of [f.ordinary.customDepthMaterial, f.ordinary.customDistanceMaterial]) assert.equal(m.side, f.material.side);
      const key = f.material.customProgramCacheKey(), hook = f.material.onBeforeCompile;
      applyCityFoliageWind(f.material, { fade });
      assert.equal(f.material.onBeforeCompile, hook); assert.equal(f.material.customProgramCacheKey(), key);
    } finally { controller.dispose(); f.geometry.dispose(); f.material.dispose(); f.instanced.dispose(); }
  }
});

test('foliage controller restores previous bindings and disposes only resources it owns, once', () => {
  for (const external of [false, true]) {
    const f = foliageScene(), prior = new THREE.MeshDepthMaterial(), owned = [];
    f.ordinary.customDepthMaterial = prior;
    const borrowedCount = disposalCount(f.material), priorCount = disposalCount(prior);
    const before = { time: windUniforms.uTime.value, wind: windUniforms.uWind.value };
    const controller = attachCityFoliageShadows(f.root, external ? { ownMaterial: m => owned.push(m) } : {});
    const materials = [f.ordinary.customDepthMaterial, f.ordinary.customDistanceMaterial];
    const counts = materials.map(disposalCount);
    controller.dispose(); controller.dispose();
    assert.equal(f.ordinary.customDepthMaterial, prior);
    assert.equal(f.instanced.customDepthMaterial, undefined);
    assert.deepEqual(counts.map(read => read()), external ? [0, 0] : [1, 1]);
    assert.equal(borrowedCount(), 0); assert.equal(priorCount(), 0);
    assert.deepEqual({ time: windUniforms.uTime.value, wind: windUniforms.uWind.value }, before);
    if (external) { assert.deepEqual(owned, materials); owned.forEach(m => m.dispose()); }
    f.geometry.dispose(); f.material.dispose(); prior.dispose(); f.instanced.dispose();
  }
});

test('foliage attachment failure restores completed bindings and releases standalone shadow resources', () => {
  const f = foliageScene(); let shadows, counts;
  f.root.traverse = callback => {
    callback(f.ordinary);
    shadows = [f.ordinary.customDepthMaterial, f.ordinary.customDistanceMaterial]; counts = shadows.map(disposalCount);
    throw new Error('injected traversal failure');
  };
  assert.throws(() => attachCityFoliageShadows(f.root), /injected traversal failure/);
  assert.equal(f.ordinary.customDepthMaterial, undefined);
  assert.equal(f.ordinary.customDistanceMaterial, undefined);
  assert.deepEqual(counts.map(read => read()), [1, 1]);
  f.geometry.dispose(); f.material.dispose(); f.instanced.dispose();
});

test('river and fountain keep independent wet uniforms and bounded ripple sources without per-frame geometry changes', () => {
  const root = new THREE.Group(), river = buildCityWater({ root }), fountain = createCityWaterMaterial({ mode: 'fountain' });
  try {
    const programs = [shader(river.material), shader(fountain.material)];
    assert.notEqual(river.material.customProgramCacheKey(), fountain.material.customProgramCacheKey());
    assert.notEqual(river.uniforms.uCityWaterTime, fountain.uniforms.uCityWaterTime);
    assert.ok(fountain.uniforms.uCityWaterRipples.value.every(v => v.w === 0));
    for (const program of programs) {
      assert.match(program.fragmentShader, /cityWaterNormal/);
      assert.match(program.fragmentShader, /normal = normalize\(mat3\(viewMatrix\) \* cityWaterNormal\)/);
      assert.match(program.vertexShader, /instanceMatrix \* cityWaterLocal/);
    }
    const position = river.mesh.geometry.attributes.position, indices = river.mesh.geometry.index;
    const bytes = [...position.array], uniforms = river.uniforms.uCityWaterRipples.value;
    river.setRipples([{ x: 1, z: 2, radius: 999, strength: 999 }, { x: NaN, z: 2, radius: 2, strength: 1 }]);
    assert.deepEqual(uniforms[0].toArray(), [1, 2, 12, .035]);
    assert.ok(uniforms.slice(1).every(v => v.w === 0));
    for (let i = 0; i < 120; i++) river.update(i, .1, null, Object.freeze({ night: i % 2 ? 10 : -10 }));
    assert.equal(river.uniforms.uCityWaterTime.value, 119); assert.equal(river.uniforms.uCityWaterNight.value, 1);
    river.update(NaN, .1, null, { night: NaN });
    assert.equal(river.uniforms.uCityWaterTime.value, 119); assert.equal(river.uniforms.uCityWaterNight.value, 1);
    assert.equal(river.mesh.geometry.attributes.position, position); assert.equal(river.mesh.geometry.index, indices);
    assert.deepEqual([...position.array], bytes); assert.equal(river.uniforms.uCityWaterRipples.value, uniforms);
    assert.equal(root.children.length, 1); assert.equal(river.material.transparent, false); assert.equal(river.material.map, null);
  } finally { river.dispose(); fountain.dispose(); }
});

test('water disposal respects factory ownership, detaches its surface and stops uniform updates', () => {
  for (const external of [false, true]) {
    const root = new THREE.Group(), owned = [];
    const options = external ? { mat: (color, extra) => { const m = new THREE.MeshStandardMaterial({ color, ...extra }); owned.push(m); return m; },
      geo: g => { owned.push(g); return g; } } : {};
    const river = buildCityWater({ root, ...options }), resources = [river.material, river.mesh.geometry];
    const counts = resources.map(disposalCount);
    river.update(3, .1, null, { night: .5 }); river.dispose(); river.dispose();
    river.update(100, .1, null, { night: 1 }); river.setRipples([]);
    assert.equal(root.children.length, 0); assert.equal(river.uniforms.uCityWaterTime.value, 3);
    assert.equal(river.uniforms.uCityWaterNight.value, .5);
    assert.deepEqual(counts.map(read => read()), external ? [0, 0] : [1, 1]);
    if (external) { assert.deepEqual(owned, resources); owned.forEach(r => r.dispose()); }
  }
});

test('water attachment failure releases standalone allocations and leaves externally owned resources for the build disposer', () => {
  for (const external of [false, true]) {
    const root = new THREE.Group(), owned = []; let resources, counts;
    root.add = mesh => { resources = [mesh.material, mesh.geometry]; counts = resources.map(disposalCount); throw new Error('injected water attachment failure'); };
    const options = external ? { mat: (color, extra) => { const m = new THREE.MeshStandardMaterial({ color, ...extra }); owned.push(m); return m; },
      geo: g => { owned.push(g); return g; } } : {};
    assert.throws(() => buildCityWater({ root, ...options }), /injected water attachment failure/);
    assert.deepEqual(counts.map(read => read()), external ? [0, 0] : [1, 1]);
    assert.equal(root.children.length, 0);
    if (external) { assert.deepEqual(owned, resources); owned.forEach(r => r.dispose()); }
  }
});

test('animated city water leaves canonical reservations and static navigation water topology unchanged', () => {
  const canonical = JSON.stringify(COMPACT_CITY), points = [];
  for (let z = -65; z <= 65; z += 2) for (let x = -73; x <= 73; x += 2) points.push([x, z]);
  const standing = points.map(([x, z]) => compactCityCanStand(x, z));
  const snapshots = Object.values(MAPS).map(map => {
    const surface = waterSurfaceFor(map.view, !map.expedition);
    const queries = [map.spawn, ...points.slice(0, 100).map(([x, z]) => ({ x, z }))];
    return { map, surface, queries, heights: queries.map(p => surface.heightAt(p.x, p.z)),
      topology: JSON.stringify(waterSurfaces(map.view)) };
  });
  const water = buildCityWater({ root: new THREE.Group() });
  for (let i = 0; i < 100; i++) water.update(i, .1, null, { night: i / 100 });
  water.dispose();
  assert.equal(JSON.stringify(COMPACT_CITY), canonical);
  assert.deepEqual(points.map(([x, z]) => compactCityCanStand(x, z)), standing);
  for (const { map, surface, queries, heights, topology } of snapshots) {
    assert.equal(JSON.stringify(waterSurfaces(map.view)), topology, map.id);
    assert.deepEqual(queries.map(p => surface.heightAt(p.x, p.z)), heights, map.id);
  }
});
