import * as THREE from 'three';
import { COMPACT_CITY, compactCityCanStand, compactCityHeightAt } from './compact-city.js';
import { Collision } from './Collision.js';
import { portalPillars } from './portal-layout.js';
import { windUniforms } from './shaders.js';
import { buildCityArt } from './compact-city-render/buildCityArt.js';

// Compact city has its own flat land and southern river. Never sample CityMap's
// legacy canal, occupancy, water or procedural landscape at these coordinates.
export async function buildCompactCityWorld(scene, map, progress = () => {}) {
  const start = performance.now(), bounds = COMPACT_CITY.bounds;
  const root = new THREE.Group(); root.name = 'map:compact-city';
  const collision = new Collision(8);
  for (const b of COMPACT_CITY.buildings) collision.addBox(b.x, b.z, b.w, b.d);
  for (const portal of map.portals ?? []) {
    for (const p of portalPillars(map, portal)) collision.addCircle(p.x, p.z, p.r);
  }
  let art, grassGeometry, grassMaterial, disposed = false;
  const dispose = () => {
    if (disposed) return { geometries: 0, materials: 0, textures: 0 };
    disposed = true;
    root.removeFromParent();
    // These allocations happen after art is ready; a terrain/settings failure
    // must release them as well as the completed render batches.
    try { return art?.dispose() ?? { geometries: 0, materials: 0, textures: 0 }; }
    finally {
      grassGeometry?.dispose(); grassMaterial?.dispose();
      collision.shapes.clear(); collision.decks.clear();
    }
  };
  try {
    progress('กำลังก่อเมืองนครที่ถูกลืมเลือน…');
    art = await buildCityArt(root, progress);
  const rect = { minX: -90, maxX: 90, minZ: -82, maxZ: 96 };
  const width = rect.maxX - rect.minX, height = rect.maxZ - rect.minZ;
  const terrain = {
    rect, area: rect, x0: rect.minX, z0: rect.minZ, w: width, h: height,
    gw: width + 1, gh: height + 1,
    heights: new Float32Array((width + 1) * (height + 1)),
    deep: new Float32Array((width + 1) * (height + 1)),
    shallow: new Uint8Array((width + 1) * (height + 1)),
    height: compactCityHeightAt,
    isDeep: (x, z) => Number.isFinite(x) && z > bounds.maxZ + .6,
    isShallow: () => false,
    inside: (x, z) => x >= rect.minX && x <= rect.maxX && z >= rect.minZ && z <= rect.maxZ,
  };
  const data = new Uint8Array(width * height * 4);
  for (let j = 0; j < height; j++) for (let i = 0; i < width; i++) {
    const x = rect.minX + i + .5, z = rect.minZ + j + .5;
    const paved = COMPACT_CITY.roads.some(r => Math.abs(x-r.x) <= r.w/2 && Math.abs(z-r.z) <= r.d/2)
      || Math.abs(x) < 14.2 && Math.abs(z) < 14.2
      || COMPACT_CITY.buildings.some(b => Math.abs(x-b.x) < b.w/2+1 && Math.abs(z-b.z) < b.d/2+1);
    const k = (j * width + i) * 4;
    data[k] = paved ? 0 : 140; data[k+1] = 80; data[k+2] = 12; data[k+3] = 255;
  }
  for (let j = 0; j <= height; j++) for (let i = 0; i <= width; i++) {
    const k = j * (width+1) + i;
    terrain.deep[k] = terrain.isDeep(rect.minX+i, rect.minZ+j) ? 1 : 0;
  }
  // Settings code writes instanceCount unconditionally. This detached zero-vertex
  // field accepts the setting without drawing nonexistent grass over paving.
  grassGeometry = new THREE.InstancedBufferGeometry();
  grassGeometry.setAttribute('position', new THREE.Float32BufferAttribute([], 3));
  grassGeometry.instanceCount = 0;
  grassMaterial = new THREE.MeshBasicMaterial();
  const grass = { mesh: new THREE.Mesh(grassGeometry, grassMaterial), update() {} };
  const atmosphere = { enabled: true, setEnabled(value) { this.enabled = !!value; }, update() {} };
  // Commit only after the complete World contract has been allocated.
  scene.add(root);
  return {
    map, root, ground: art.ground, terrain, mask: { area: rect, width, height, data },
    collision, grass, atmosphere, water: art.water, boats: null, animals: null,
    spots: {}, footprints: COMPACT_CITY.buildings.map(b => ({ ...b, rot: 0, paint: b.kind === 'temple' || b.kind === 'chedi' ? 'stone' : 'earth' })),
    market: [],
    stats: { map: map.id, ...art.stats, houses: 2, forestTrees: 0, buildMs: Math.round(performance.now()-start) },
    contains(x, z) { return Number.isFinite(x) && Number.isFinite(z) && x >= bounds.minX && x <= bounds.maxX && z >= bounds.minZ && z <= bounds.maxZ; },
    canStand(x, z, pad = .28) { return compactCityCanStand(x,z,pad) && !collision.blocked(x,z,pad); },
    heightAt: compactCityHeightAt,
    speedAt: () => 1,
    update(t, dt, focus, env) { if (!disposed) { windUniforms.uTime.value = t; art.update(t, dt, focus, env); } },
    dispose,
  };
  } catch (error) {
    dispose();
    throw error;
  }
}
