import * as THREE from 'three';
import { gltfLoader } from '../../core/gltf.js';
import { Sprites } from '../Atmosphere.js';

// The Ayutthaya kit: modular Thai architecture modelled in Blender
// (tools/city-kit/ayutthaya_kit.py → public/models/city/ayutthaya-kit.glb). Each top-level node
// is one piece standing on its origin, its front toward +z (south). Its materials are named
// after the city palette (buildCityArt's M), so the pieces take the town's own materials here:
// they light, fade in front of the player and glow at night like everything else, and they
// merge into the same static batches.
//
//   loadAyutthayaKit(url?, loader?) → Map piece name → template (float geometry, world-scaled UVs)
//   kitFromGltf(gltf)               → the same from an already parsed file
//   AYUTTHAYA_PLACEMENTS(city)      → [{ piece, x, z, ry, sx, s }] (sx stretches along the piece, s scales it)
//   buildCityAyutthaya({ root, lightRoot, kit, M, mat, city }) → { stats, lights, update(night) }: clones
//     under `root` (static, batched); every lantern part gets a night halo and a warm pool of light
//     on the ground under `lightRoot`
// from the site root (the review pages under /tools load it too)
export const KIT_URL = `${import.meta.env?.BASE_URL ?? '/'}models/city/ayutthaya-kit.glb`;
export const KIT_PIECES = ['gate', 'wall', 'bastion', 'prang', 'chedi', 'shophouse', 'lamp', 'flag',
  'naga', 'elephant', 'planter', 'frangipani', 'palm', 'spirit_house', 'sema'];

// Quantised glTF attributes (gltfpack) become plain floats in the piece's own space, with a
// metre-scaled box-projected UV, so kit parts merge with the town's box meshes.
function plainGeometry(mesh, toPiece) {
  const src = mesh.geometry, g = new THREE.BufferGeometry();
  for (const name of ['position', 'normal']) {
    const a = src.getAttribute(name); if (!a) continue;
    const out = new Float32Array(a.count * 3);
    for (let i = 0; i < a.count; i++) { out[i * 3] = a.getX(i); out[i * 3 + 1] = a.getY(i); out[i * 3 + 2] = a.getZ(i); }
    g.setAttribute(name, new THREE.BufferAttribute(out, 3));
  }
  if (src.index) g.setIndex(Array.from(src.index.array));
  g.applyMatrix4(toPiece);
  if (!g.getAttribute('normal')) g.computeVertexNormals();
  const p = g.getAttribute('position'), n = g.getAttribute('normal'), uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    const [u, v] = ay >= ax && ay >= az ? [p.getX(i), p.getZ(i)] : ax >= az ? [p.getZ(i), p.getY(i)] : [p.getX(i), p.getY(i)];
    uv[i * 2] = u * .5; uv[i * 2 + 1] = v * .5;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

export async function loadAyutthayaKit(url = KIT_URL, loader = gltfLoader()) {
  return kitFromGltf(await loader.loadAsync(url));
}
export function kitFromGltf(gltf) {
  const pieces = new Map();
  gltf.scene.updateMatrixWorld(true);
  for (const node of gltf.scene.children) {
    const piece = new THREE.Group(); piece.name = node.name;
    const inverse = node.matrixWorld.clone().invert();
    node.traverse(o => {
      if (!o.isMesh) return;
      const toPiece = inverse.clone().multiply(o.matrixWorld);
      // GLTFLoader gives a multi-material mesh as one child per material
      const part = new THREE.Mesh(plainGeometry(o, toPiece), o.material); part.name = o.material.name;
      piece.add(part);
    });
    pieces.set(node.name, piece);
  }
  for (const name of KIT_PIECES) if (!pieces.has(name)) throw new Error(`Ayutthaya kit lacks ${name}`);
  return pieces;
}

// Where the pieces go. The perimeter (north wall, gate, side walls, bastions, palms) lies
// beyond the walk boundary; everything inside the walls sits in a `kit` reservation of
// src/world/compact-city-neighborhoods.js, which navigation already blocks.
export function AYUTTHAYA_PLACEMENTS(city) {
  const out = [], put = (piece, x, z, ry = 0, sx = 1, s = 1) => out.push({ piece, x, z, ry, sx, s });
  const { maxX } = city.bounds, wallX = maxX + 1, northZ = city.bounds.minZ - 1.1;
  // north wall with the gate in its middle, a bastion at each corner
  put('gate', 0, -67);
  for (const s of [-1, 1]) {
    for (let i = 0; i < 16; i++) put('wall', s * (9 + i * 4), northZ);
    put('bastion', s * (wallX + 1.2), northZ - 1.1, 0, 1, .8);   // out at the corner, clear of the walk area
    // side walls, turned to run north-south, as far as the river landing
    for (let i = 0; i < 31; i++) put('wall', s * wallX, -60.5 + i * 4, Math.PI / 2);
    // the sugar palm skyline behind the gate
    for (const [x, z] of [[11, -71], [17, -74.5], [26, -70.5], [35, -75]]) put('palm', s * x, z, s * 1.3, 1, 1.15);
  }
  for (const b of city.buildings.filter(b => b.kind === 'kit')) {
    const ry = { south: 0, north: Math.PI, east: Math.PI / 2, west: -Math.PI / 2 }[b.front] ?? 0;
    if (b.variant === 'shophouse') {
      // a row of bays along x, each with its own gable to the street
      const bays = b.bays ?? 3, bay = b.w / bays;
      for (let i = 0; i < bays; i++) put('shophouse', b.x - b.w / 2 + bay * (i + .5), b.z, ry, bay / 3.4);
    } else if (b.variant === 'verge') {
      // a brick planter with a frangipani or a banner, and a lotus lamp at its avenue end
      const toAvenue = b.x < 0 ? 1 : -1;
      put('planter', b.x, b.z, ry);
      put(b.feature ?? 'frangipani', b.x - toAvenue * .35, b.z, ry, 1, b.feature === 'flag' ? 1 : 1.45);
      put('lamp', b.x + toAvenue * .85, b.z, ry);
    } else if (b.variant === 'elephant') {
      // the royal elephants are a textured Tripo model, drawn by buildCityElephants.js
      continue;
    } else put(b.variant, b.x, b.z, ry, 1, b.scale ?? 1);
  }
  return out;
}

// Lantern bodies in a piece, as separate glows: the parts named 'lantern' hold every lantern of
// the piece in one geometry, so their vertices are grouped by distance.
function lanternSpots(template) {
  const spots = [];
  for (const part of template.children.filter(p => p.name === 'lantern')) {
    const pos = part.geometry.getAttribute('position'), groups = [];
    for (let i = 0; i < pos.count; i++) {
      const v = new THREE.Vector3().fromBufferAttribute(pos, i);
      let g = groups.find(g => g.box.distanceToPoint(v) < .35);
      if (!g) groups.push(g = { box: new THREE.Box3(v.clone(), v.clone()) });
      g.box.expandByPoint(v);
    }
    for (const { box } of groups) {
      const size = box.getSize(new THREE.Vector3());
      spots.push({ at: box.getCenter(new THREE.Vector3()), size: Math.max(size.x, size.y, size.z) });
    }
  }
  return spots;
}
// a soft radial disc for the light pools (data texture: no canvas needed)
function poolTexture(n = 32) {
  const data = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const d = Math.hypot(x + .5 - n / 2, y + .5 - n / 2) / (n / 2), a = Math.max(0, 1 - d) ** 1.8;
    data.set([255, 255, 255, Math.round(a * 255)], (y * n + x) * 4);
  }
  const t = new THREE.DataTexture(data, n, n); t.needsUpdate = true; return t;
}

export function buildCityAyutthaya({ root, lightRoot = null, kit, M, mat, city }) {
  // palette names the town has no material for get a close one
  const extra = { brickRed: mat('#9a5a3e', { map: M.brick.map }), cloth: M.ochre, bark: M.wood };
  const material = name => M[name] ?? extra[name] ?? M.cream;
  const placements = AYUTTHAYA_PLACEMENTS(city), count = {}, glows = [], spotCache = new Map();
  for (const p of placements) {
    const template = kit.get(p.piece); if (!template) continue;
    const g = new THREE.Group(); g.position.set(p.x, 0, p.z); g.rotation.y = p.ry; g.scale.set(p.sx * p.s, p.s, p.s);
    for (const part of template.children) {
      const m = new THREE.Mesh(part.geometry, material(part.name));
      m.castShadow = part.name !== 'lantern'; m.receiveShadow = true; g.add(m);
    }
    root.add(g); count[p.piece] = (count[p.piece] ?? 0) + 1;
    if (!spotCache.has(p.piece)) spotCache.set(p.piece, lanternSpots(template));
    g.updateMatrix();
    for (const spot of spotCache.get(p.piece)) glows.push({ at: spot.at.clone().applyMatrix4(g.matrix), size: spot.size * p.s });
  }
  let halos = null, pools = null;
  if (lightRoot && glows.length) {
    halos = new Sprites(lightRoot, glows.length, { flicker: .6 });
    for (const { at, size } of glows) halos.push(at.x, at.y, at.z, Math.max(1.1, size * 4.5), '#ffbf6a', .9);
    halos.commit(); halos.points.name = 'ayutthaya-lantern-halos';
    pools = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({
      map: poolTexture(), color: '#ffae5c', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    }), glows.length);
    const d = new THREE.Object3D();
    glows.forEach(({ at, size }, i) => { d.position.set(at.x, .06, at.z); d.scale.setScalar(Math.min(6, 2 + at.y * .9 + size * 3)); d.updateMatrix(); pools.setMatrixAt(i, d.matrix); });
    pools.renderOrder = 3; pools.name = 'ayutthaya-light-pools'; lightRoot.add(pools);
  }
  return {
    stats: { pieces: count, placements: placements.length, lights: glows.length },
    lights: glows,
    // night: 0 by day … 1 at night (the town's lantern factor)
    update(night) {
      if (!halos) return;
      halos.material.uniforms.uIntensity.value = night; halos.points.visible = night > .01;
      pools.material.opacity = .42 * night; pools.visible = night > .01;
    },
  };
}
