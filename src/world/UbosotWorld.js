import * as THREE from 'three';
import { Collision } from './Collision.js';
import { Atmosphere } from './Atmosphere.js';
import { mergeObject } from './Batching.js';
import { disposeResources } from './ResourceLifecycle.js';
import { gltfLoader } from '../core/gltf.js';
import { versioned } from '../core/version.js';
import { UBOSOT, UBOSOT_WALK, UBOSOT_PILLARS, UBOSOT_PROPS, UBOSOT_RUG, UBOSOT_DOOR, ubosotColliders } from './ubosot.js';

// ภายในอุโบสถ (map 'ubosot', src/world/ubosot.js): a lacquered ordination hall, built on its
// own like the expedition maps. Teak floor and a red runner from the door to the prayer rug,
// red-and-gold pillars, painted murals on the tall west and north walls, low east and south
// walls for the camera, rows of always-lit candles and incense smoke. The presiding Buddha,
// offering table, kneeling disciples, siamsi stand and merit box are Tripo GLBs
// (public/models/temple). Colliders come from ubosot.js, never from the GLBs, so the baked
// server collision does not depend on a download.
//
//   buildUbosotWorld(scene, map, { load? }) → Promise<world>  (World.js contract)
//     load(url) → { scene } replaces the network loader (tests, review pages).
const { x: X, z: Z } = UBOSOT;
const WALL_H = 5.6, LOW_H = 1.05;

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
// จิตรกรรมฝาผนัง: ochre ground, a gold band of thepphanom (praying deities) above a
// register of chedis, trees and processions, framed by a red lotus border.
function muralTexture(seed) {
  let s = seed; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  return canvasTexture(512, 256, (g, w, h) => {
    g.fillStyle = '#b9763d'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#7e2a1e'; g.fillRect(0, 0, w, 18); g.fillRect(0, h - 22, w, 22);
    g.fillStyle = '#d8a945'; for (let x = 6; x < w; x += 16) { g.beginPath(); g.arc(x, 9, 5, Math.PI, 0); g.fill(); g.beginPath(); g.arc(x + 8, h - 11, 6, 0, Math.PI); g.fill(); }
    // gold deity band
    g.fillStyle = '#e2bd5c';
    for (let x = 20; x < w; x += 34) {
      g.beginPath(); g.moveTo(x, 70); g.lineTo(x - 9, 46); g.lineTo(x, 26); g.lineTo(x + 9, 46); g.closePath(); g.fill();
      g.beginPath(); g.arc(x, 52, 6, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = '#5e3a22'; g.fillRect(0, 74, w, 3);
    // lower register: chedis, trees, little figures
    for (let i = 0; i < 9; i++) {
      const x = 24 + i * 56 + rnd() * 10, base = 210;
      if (i % 3 === 0) { // chedi
        g.fillStyle = '#f0e2c0'; g.beginPath(); g.moveTo(x - 16, base); g.lineTo(x + 16, base); g.lineTo(x + 9, base - 34); g.lineTo(x, base - 78); g.lineTo(x - 9, base - 34); g.closePath(); g.fill();
        g.fillStyle = '#d4a548'; g.fillRect(x - 2, base - 92, 4, 16);
      } else if (i % 3 === 1) { // tree
        g.fillStyle = '#4a3a24'; g.fillRect(x - 3, base - 46, 6, 46);
        g.fillStyle = '#4f6f3f'; for (let k = 0; k < 5; k++) { g.beginPath(); g.arc(x + (rnd() - .5) * 30, base - 60 - rnd() * 30, 14 + rnd() * 6, 0, Math.PI * 2); g.fill(); }
      } else { // procession figures
        for (let k = 0; k < 3; k++) {
          const fx = x - 14 + k * 14;
          g.fillStyle = ['#7d2b20', '#2f4c6b', '#d0a24a'][k]; g.beginPath(); g.moveTo(fx - 5, base); g.lineTo(fx + 5, base); g.lineTo(fx, base - 26); g.closePath(); g.fill();
          g.fillStyle = '#e9c9a0'; g.beginPath(); g.arc(fx, base - 30, 4, 0, Math.PI * 2); g.fill();
        }
      }
    }
    g.fillStyle = 'rgba(70,30,10,.18)'; for (let i = 0; i < 60; i++) g.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 3, 1 + rnd() * 3);
  });
}
const teakTexture = () => canvasTexture(256, 256, (g, w, h) => {
  g.fillStyle = '#5b3420'; g.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 32) {
    g.fillStyle = y % 64 ? '#62391f' : '#55301c'; g.fillRect(0, y, w, 31);
    g.fillStyle = '#3a1f12'; g.fillRect(0, y + 31, w, 1);
    for (let x = (y / 32 % 2) * 64; x < w; x += 128) g.fillRect(x, y, 1, 32);
  }
});
const runnerTexture = () => canvasTexture(64, 256, (g, w, h) => {
  g.fillStyle = '#8e1f1a'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#d8ac4d'; g.fillRect(3, 0, 3, h); g.fillRect(w - 6, 0, 3, h);
  for (let y = 8; y < h; y += 24) { g.beginPath(); g.moveTo(w / 2, y); g.lineTo(w / 2 + 8, y + 8); g.lineTo(w / 2, y + 16); g.lineTo(w / 2 - 8, y + 8); g.closePath(); g.fill(); }
});

async function loadProps(load) {
  const urls = [...new Set(UBOSOT_PROPS.map(p => p.url))];
  const scenes = await Promise.all(urls.map(url => load(url).then(g => g.scene, error => { console.warn('[ubosot] prop unavailable', url, error); return null; })));
  return new Map(urls.map((u, i) => [u, scenes[i]]));
}
// Fit a prop to its authored height, stand it on y=0 at its spot, turn it to `facing`.
function placeProp(template, p) {
  const body = template.clone(true);
  body.traverse(o => {
    if (!o.isMesh) return;
    o.castShadow = o.receiveShadow = true;
    // Tripo's physical material becomes a standard one. Without an environment map a
    // metallic gilt renders near-black, so the metal map is dropped for a warm satin gold.
    const m = o.material;
    if (m?.isMeshStandardMaterial) {
      o.material = new THREE.MeshStandardMaterial({ name: m.name, map: m.map, normalMap: m.normalMap,
        roughnessMap: m.roughnessMap, roughness: Math.max(.42, m.roughness ?? 1), metalness: .22, color: m.color });
    }
  });
  const box = new THREE.Box3().setFromObject(body), size = box.getSize(new THREE.Vector3()), centre = box.getCenter(new THREE.Vector3());
  const s = p.height / size.y;
  body.scale.setScalar(s); body.position.set(-centre.x * s, -box.min.y * s, -centre.z * s);
  const g = new THREE.Group(); g.name = `ubosot:${p.id}`; g.position.set(p.x, 0, p.z); g.rotation.y = p.facing; g.add(body);
  return g;
}

export async function buildUbosotWorld(scene, map, { load } = {}) {
  const started = performance.now();
  const root = new THREE.Group(); root.name = `map:${map.id}`;
  const statics = new THREE.Group();
  const collision = new Collision(8, map.view);
  const glows = [], smokes = [];
  const M = {
    teak: new THREE.MeshStandardMaterial({ map: teakTexture(), roughness: .55 }),
    runner: new THREE.MeshStandardMaterial({ map: runnerTexture(), roughness: .9 }),
    lacquer: new THREE.MeshStandardMaterial({ color: '#7e1712', roughness: .45 }),
    gold: new THREE.MeshStandardMaterial({ color: '#d2a443', roughness: .38, metalness: .45 }),
    plaster: new THREE.MeshStandardMaterial({ color: '#eadcc0', roughness: .9 }),
    base: new THREE.MeshStandardMaterial({ color: '#8c5a3c', roughness: .9 }),
    earth: new THREE.MeshStandardMaterial({ color: '#2d2620', roughness: 1 }),
    wax: new THREE.MeshStandardMaterial({ color: '#f3e7cc', emissive: '#ffb45a', emissiveIntensity: .9 }),
    muralW: new THREE.MeshStandardMaterial({ map: muralTexture(11), roughness: .85 }),
    muralN: new THREE.MeshStandardMaterial({ map: muralTexture(29), roughness: .85 }),
  };
  M.muralW.map.repeat.set(2, 1); M.muralW.map.wrapS = THREE.RepeatWrapping;
  const geo = new THREE.BoxGeometry(1, 1, 1), cylinder = new THREE.CylinderGeometry(1, 1, 1, 12);
  const box = (m, x, y, z, w, h, d, into = statics) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.scale.set(w, h, d); o.castShadow = o.receiveShadow = true; into.add(o); return o; };
  const post = (m, x, y, z, r, h, into = statics) => { const o = new THREE.Mesh(cylinder, m); o.position.set(x, y, z); o.scale.set(r, h, r); o.castShadow = o.receiveShadow = true; into.add(o); return o; };
  try {
    const { west, east, north, south } = UBOSOT, width = east - west, depth = south - north;
    // dark courtyard around the hall, a raised base and the teak floor
    const outside = new THREE.Mesh(new THREE.PlaneGeometry(map.view.maxX - map.view.minX, map.view.maxZ - map.view.minZ).rotateX(-Math.PI / 2), M.earth);
    outside.position.set((map.view.minX + map.view.maxX) / 2, -.02, (map.view.minZ + map.view.maxZ) / 2); outside.receiveShadow = true; root.add(outside);
    box(M.base, X, -.2, Z, width + 2, .4, depth + 2);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(width, depth).rotateX(-Math.PI / 2), M.teak);
    M.teak.map.wrapS = M.teak.map.wrapT = THREE.RepeatWrapping; M.teak.map.repeat.set(width / 4, depth / 4);
    floor.position.set(X, .005, Z); floor.receiveShadow = true; floor.name = 'ubosot-floor'; root.add(floor);
    // red runner from the door to the rug, and the prayer rug
    M.runner.map.wrapT = THREE.RepeatWrapping; M.runner.map.repeat.set(1, 4);
    box(M.runner, X, .012, (UBOSOT_RUG.z + UBOSOT_RUG.d / 2 + south) / 2, 1.6, .01, south - UBOSOT_RUG.z - UBOSOT_RUG.d / 2);
    box(M.gold, UBOSOT_RUG.x, .014, UBOSOT_RUG.z, UBOSOT_RUG.w + .16, .012, UBOSOT_RUG.d + .16);
    box(M.lacquer, UBOSOT_RUG.x, .022, UBOSOT_RUG.z, UBOSOT_RUG.w, .012, UBOSOT_RUG.d);
    // tall painted walls (west, north), low walls with a gold rail (east, south, door gap)
    const t = .35;
    box(M.plaster, west - t / 2, WALL_H / 2, Z, t, WALL_H, depth + t * 2);
    const mw = new THREE.Mesh(new THREE.PlaneGeometry(depth - 1, 2.6), M.muralW); mw.rotation.y = Math.PI / 2; mw.position.set(west + .01, 2.6, Z); statics.add(mw);
    box(M.plaster, X, WALL_H / 2, north - t / 2, width + t * 2, WALL_H, t);
    for (const side of [-1, 1]) {
      const mn = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 2.6), M.muralN); mn.position.set(X + side * 4.6, 2.6, north + .01); statics.add(mn);
    }
    // a lacquered red panel with gold frame behind the Buddha
    box(M.lacquer, X, 3.4, north + .03, 4.4, 6.0, .06); box(M.gold, X, 6.45, north + .05, 4.8, .14, .08);
    box(M.plaster, east + t / 2, LOW_H / 2, Z, t, LOW_H, depth + t * 2);
    box(M.gold, east + t / 2, LOW_H + .04, Z, t + .06, .08, depth + t * 2);
    for (const side of [-1, 1]) {
      const x0 = side < 0 ? west : UBOSOT_DOOR.x + UBOSOT_DOOR.halfWidth, x1 = side < 0 ? UBOSOT_DOOR.x - UBOSOT_DOOR.halfWidth : east;
      box(M.plaster, (x0 + x1) / 2, LOW_H / 2, south + t / 2, x1 - x0, LOW_H, t);
      box(M.gold, (x0 + x1) / 2, LOW_H + .04, south + t / 2, x1 - x0, .08, t + .06);
      // door posts
      post(M.lacquer, UBOSOT_DOOR.x + side * (UBOSOT_DOOR.halfWidth + .15), 1.3, south + t / 2, .14, 2.6);
      post(M.gold, UBOSOT_DOOR.x + side * (UBOSOT_DOOR.halfWidth + .15), 2.66, south + t / 2, .18, .12);
    }
    // nave pillars: lacquer with a gold lotus capital and a gold foot
    for (const p of UBOSOT_PILLARS) {
      post(M.lacquer, p.x, 2.4, p.z, .26, 4.8);
      post(M.gold, p.x, .12, p.z, .34, .24); post(M.gold, p.x, 4.75, p.z, .34, .2);
      for (let k = 0; k < 3; k++) post(M.gold, p.x, 1.2 + k * 1.3, p.z, .275, .06);
    }
    // candle ledges either side of the throne, and standing candle trees by the front pillars
    for (const side of [-1, 1]) {
      box(M.lacquer, X + side * 4.1, .45, north + .55, 3.2, .9, .7); box(M.gold, X + side * 4.1, .92, north + .55, 3.3, .05, .78);
      for (let k = 0; k < 7; k++) {
        const cx = X + side * (2.75 + k * .45), cz = north + .55;
        post(M.wax, cx, 1.1, cz, .035, .32); glows.push({ x: cx, y: 1.32, z: cz, size: .22, color: '#ffbf6a', kind: 'candle-always' });
      }
      const tx = X + side * 2.3, tz = Z + 3.2;
      post(M.gold, tx, .65, tz, .05, 1.3); post(M.gold, tx, .05, tz, .22, .1);
      for (let k = 0; k < 5; k++) {
        const a = k / 5 * Math.PI * 2, cx = tx + Math.cos(a) * .22, cz = tz + Math.sin(a) * .22;
        post(M.wax, cx, 1.42, cz, .03, .22); glows.push({ x: cx, y: 1.58, z: cz, size: .2, color: '#ffbf6a', kind: 'candle-always' });
      }
      collision.addCircle(tx, tz, .3);
    }
    // incense smoke rising from the offering table's urn
    smokes.push({ x: X, y: 1.3, z: Z - 5.1, rate: 2.2, size: .35, color: '#d9d2c4', rise: .7 });
    // warm candle light for the shrine end
    const shrine = new THREE.PointLight('#ffb15e', 30, 14, 1.4); shrine.position.set(X, 3.6, Z - 4.4); root.add(shrine);
    const halo = new THREE.SpotLight('#ffd9a0', 40, 16, .5, .6, 1.2); halo.position.set(X, 7.5, Z - 1.5); halo.target.position.set(X, 2.2, Z - 8.3); root.add(halo, halo.target);
    const nave = new THREE.PointLight('#ffc27c', 18, 16, 1.4); nave.position.set(X, 3.2, Z + 3.5); root.add(nave);

    // colliders: walls (segments), pillars, props
    collision.addSegment(west, north, west, south, .25);
    collision.addSegment(west, north, east, north, .25);
    collision.addSegment(east, north, east, south, .25);
    collision.addSegment(west, south, UBOSOT_DOOR.x - UBOSOT_DOOR.halfWidth, south, .25);
    collision.addSegment(UBOSOT_DOOR.x + UBOSOT_DOOR.halfWidth, south, east, south, .25);
    const { circles, boxes } = ubosotColliders();
    for (const c of circles) collision.addCircle(c.x, c.z, c.r);
    for (const b of boxes) collision.addBox(b.x, b.z, b.w, b.d);

    root.add(mergeObject(statics));
    // mergeObject clones source geometry; the unit geometries are released below with root.
    const loaded = await loadProps(load ?? (url => gltfLoader().loadAsync(versioned(url))));
    const props = new THREE.Group(); props.name = 'ubosot-props';
    let placed = 0;
    for (const p of UBOSOT_PROPS) { const t = loaded.get(p.url); if (t) { props.add(placeProp(t, p)); placed++; } }
    root.add(props);
    scene.add(root);
    const terrain = { rect: map.view, area: map.view, height: () => 0, isDeep: () => false, isShallow: () => false, inside: (x, z) => x >= map.view.minX && x <= map.view.maxX && z >= map.view.minZ && z <= map.view.maxZ };
    const atmosphere = new Atmosphere(root, { terrain, glows, smokes });
    // no grass: a detached zero-instance field accepts the quality setting
    const grassGeometry = new THREE.InstancedBufferGeometry(); grassGeometry.setAttribute('position', new THREE.Float32BufferAttribute([], 3)); grassGeometry.instanceCount = 0;
    const grass = { mesh: new THREE.Mesh(grassGeometry, new THREE.MeshBasicMaterial()), update() {} };
    const w = Math.round(map.view.maxX - map.view.minX), h = Math.round(map.view.maxZ - map.view.minZ), data = new Uint8Array(w * h * 4);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const k = (j * w + i) * 4; data[k] = 0; data[k + 1] = 80; data[k + 2] = 12; data[k + 3] = 255; }
    let disposed = false;
    const world = {
      map, root, terrain, collision, ground: floor, mask: { area: map.view, width: w, height: h, data }, grass, atmosphere,
      spots: { ubosot_door: { x: UBOSOT_DOOR.x, z: UBOSOT_DOOR.z - 1.5 } },
      footprints: [], market: [], water: { dispose() {} }, boats: null, animals: null,
      stats: { map: map.id, ubosotProps: placed, candles: glows.length, buildMs: Math.round(performance.now() - started) },
      contains: (x, z) => x >= UBOSOT_WALK.minX && x <= UBOSOT_WALK.maxX && z >= UBOSOT_WALK.minZ && z <= UBOSOT_WALK.maxZ,
      heightAt: () => 0, speedAt: () => 1,
      canStand(x, z, pad = .28) { return world.contains(x, z) && !collision.blocked(x, z, pad); },
      update(t, dt, focus, env) { if (!disposed) atmosphere.update(t, dt, focus, env); },
      dispose() {
        if (disposed) return { geometries: 0, materials: 0, textures: 0 };
        disposed = true; root.removeFromParent(); grass.mesh.geometry.dispose(); grass.mesh.material.dispose();
        geo.dispose(); cylinder.dispose();
        return disposeResources(root);
      },
    };
    return world;
  } catch (error) {
    root.removeFromParent(); disposeResources(root); geo.dispose(); cylinder.dispose();
    throw error;
  }
}
