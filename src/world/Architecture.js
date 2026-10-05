import * as THREE from 'three';
import { M } from './materials.js';

// Building kit. Builders return a Group in local space (front faces +z). The
// group's userData lists colliders, decks, instanced props, glows, smoke and NPC
// anchors; World.place() transforms them into the world and batches the meshes.

export const BOX = new THREE.BoxGeometry(1, 1, 1);
export const SPHERE = new THREE.SphereGeometry(1, 12, 8);
const cache = new Map();
const cached = (key, make) => { let g = cache.get(key); if (!g) cache.set(key, g = make()); return g; };
const cylGeo = (rt, rb, seg) => cached(`c${rt.toFixed(2)}|${rb.toFixed(2)}|${seg}`, () => new THREE.CylinderGeometry(rt, rb, 1, seg));
const coneGeo = seg => cached(`k${seg}`, () => new THREE.ConeGeometry(1, 1, seg));

export function mesh(parent, geometry, material, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, ry = 0, rx = 0, rz = 0) {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.rotation.set(rx, ry, rz); m.castShadow = true;
  parent.add(m); return m;
}
export const box = (p, material, x, y, z, sx, sy, sz, ry = 0, rx = 0, rz = 0) => mesh(p, BOX, material, x, y, z, sx, sy, sz, ry, rx, rz);
export function cyl(p, material, x, y, z, rt, rb, h, seg = 10) {
  const k = Math.max(rt, rb, .001);
  return mesh(p, cylGeo(rt / k, rb / k, seg), material, x, y, z, k, h, k);
}
export const cone = (p, material, x, y, z, r, h, seg = 8) => mesh(p, coneGeo(seg), material, x, y, z, r, h, r);
export const ball = (p, material, x, y, z, sx, sy = sx, sz = sx) => mesh(p, SPHERE, material, x, y, z, sx, sy, sz);
// A beam between two local points.
export function beam(p, material, a, b, r, seg = 6) {
  const from = new THREE.Vector3(...a), to = new THREE.Vector3(...b), dir = to.clone().sub(from), len = dir.length();
  const m = mesh(p, cylGeo(1, 1, seg), material, 0, 0, 0, r, len, r);
  m.position.copy(from.add(to).multiplyScalar(.5)); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  return m;
}

export function structure(footprint) {
  const g = new THREE.Group();
  g.userData = { colliders: [], decks: [], props: [], glows: [], smokes: [], anchors: {}, footprint };
  return g;
}
export const solid = (g, x, z, w, d, rot = 0) => g.userData.colliders.push({ t: 'box', x, z, w, d, rot });
export const post = (g, x, z, r) => g.userData.colliders.push({ t: 'circle', x, z, r });
export const wallLine = (g, x1, z1, x2, z2, r) => g.userData.colliders.push({ t: 'seg', x1, z1, x2, z2, r });
export const deck = (g, x, z, w, d, rot, h, ramps) => g.userData.decks.push({ x, z, w, d, rot, h, ramps });
export const prop = (g, name, x, y, z, o = {}) => g.userData.props.push({ name, x, y, z, ...o });
export const glow = (g, x, y, z, size = 1, color = '#ffb45a', kind = 'lantern') => g.userData.glows.push({ x, y, z, size, color, kind });
export const smoke = (g, x, y, z, o = {}) => g.userData.smokes.push({ x, y, z, ...o });
export const anchor = (g, name, x, z, face = 0) => { g.userData.anchors[name] = { x, z, face }; };

// ---------- Roofs ----------
function roofProfile(w, h, style) {
  if (style === 'temple') return [[-w / 2, .13 * h], [-w * .38, 0], [-w * .19, .33 * h], [0, h], [w * .19, .33 * h], [w * .38, 0], [w / 2, .13 * h]];
  return [[-w / 2, 0], [-w * .42, h * .15], [-w * .05, h * .95], [0, h], [w * .05, h * .95], [w * .42, h * .15], [w / 2, 0]];
}
function roofGeometry(w, d, h, style) {
  return cached(`roof${w.toFixed(1)}|${d.toFixed(1)}|${h.toFixed(1)}|${style}`, () => {
    const cross = roofProfile(w, h, style), pos = [], uv = [], index = [];
    let s = 0;
    cross.forEach(([x, y], i) => {
      if (i) s += Math.hypot(x - cross[i - 1][0], y - cross[i - 1][1]);
      for (const z of [-d / 2, d / 2]) { pos.push(x, y, z); uv.push(z / 2, s / 2); }
    });
    for (let i = 0; i < cross.length - 1; i++) { const a = i * 2; index.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(index); g.computeVertexNormals(); return g;
  });
}
function gableGeometry(w, h, style) {
  return cached(`gable${w.toFixed(1)}|${h.toFixed(1)}|${style}`, () => {
    const cross = roofProfile(w * .9, h * .93, style), shape = new THREE.Shape();
    cross.forEach(([x, y], i) => (i ? shape.lineTo(x, y) : shape.moveTo(x, y)));
    return new THREE.ShapeGeometry(shape);
  });
}
function trimGeometry(w, h, style, r) {
  return cached(`trim${w.toFixed(1)}|${h.toFixed(1)}|${style}|${r}`, () => {
    const curve = new THREE.CatmullRomCurve3(roofProfile(w, h, style).map(([x, y]) => new THREE.Vector3(x, y + r, 0)));
    return new THREE.TubeGeometry(curve, 18, r, 4, false);
  });
}
const finialGeometry = cached('finial', () => new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
  new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, .3, .12), new THREE.Vector3(0, .62, .02), new THREE.Vector3(0, .78, -.14)]), 10, .06, 5, false));

// Ridge runs along local z. width spans x; y is the eave height.
export function thaiRoof(p, { width, depth, height = width * .6, y, x = 0, z = 0, ry = 0, material = M.tile, style = 'house', trim = M.darkWood, gable = M.woodLight, finials = false, trimR = .045 }) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; p.add(g);
  mesh(g, roofGeometry(width, depth, height, style), material);
  for (const end of [-1, 1]) {
    if (gable) mesh(g, gableGeometry(width, height, style), gable, 0, 0, end * (depth / 2 - .12), 1, 1, 1, end > 0 ? 0 : Math.PI);
    mesh(g, trimGeometry(width, height, style, trimR), trim, 0, 0, end * depth / 2);
    if (finials) {
      mesh(g, finialGeometry, trim, 0, height - .02, end * depth / 2, 1.3, 1.3, end * 1.3);
      for (const side of [-1, 1]) mesh(g, finialGeometry, trim, side * width * .5, .13 * height + (style === 'temple' ? 0 : -.1), end * depth / 2, .6, .6, end * .6, side * .5);
    }
  }
  return g;
}
// Tiered temple roof: each tier is shorter and narrower, giving the stepped Ayutthaya silhouette.
export function tieredRoof(p, { width, depth, y, tiers = 2, material = M.tile, edge = M.tileGreen, trim = M.gold, gable = M.woodRed, x = 0, z = 0, ry = 0 }) {
  for (let i = 0; i < tiers; i++) {
    const k = 1 - i * .2, w = width * k, d = depth * (1 - i * .12), h = w * .55;
    thaiRoof(p, { width: w, depth: d, height: h, y: y + i * w * .17, x, z, ry, material: i % 2 ? edge : material, style: 'temple', trim, gable, finials: i === tiers - 1 });
  }
}

// ---------- Common pieces ----------
export function stairs(p, material, x, z, width, height, steps, ry = 0) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; p.add(g);
  for (let i = 0; i < steps; i++) box(g, material, 0, height * (i + .5) / steps, -i * .32, width, height / steps, .34);
  return g;
}
export function railing(p, material, x1, z1, x2, z2, y, spacing = .45) {
  const len = Math.hypot(x2 - x1, z2 - z1), rot = Math.atan2(x2 - x1, z2 - z1);
  box(p, material, (x1 + x2) / 2, y + .55, (z1 + z2) / 2, .07, .07, len, rot);
  for (let t = 0; t <= len; t += spacing) box(p, material, x1 + (x2 - x1) * t / len, y + .28, z1 + (z2 - z1) * t / len, .05, .55, .05);
}
export function fence(p, material, x1, z1, x2, z2) {
  const len = Math.hypot(x2 - x1, z2 - z1), rot = Math.atan2(x2 - x1, z2 - z1);
  for (const y of [.35, .7]) box(p, material, (x1 + x2) / 2, y, (z1 + z2) / 2, .05, .06, len, rot);
  for (let t = 0; t <= len; t += .9) box(p, material, x1 + (x2 - x1) * t / len, .45, z1 + (z2 - z1) * t / len, .08, .9, .08);
}
export function lanternPost(p, x, z) {
  cyl(p, M.darkWood, x, 1.1, z, .06, .08, 2.2, 6);
  box(p, M.darkWood, x, 2.2, z + .2, .06, .06, .5);
  cyl(p, M.lantern, x, 1.95, z + .42, .13, .13, .32, 8);
  glow(p, x, 1.95, z + .42, 1.4);
}
export function hangingLantern(p, x, y, z, material = M.lantern) {
  box(p, M.darkWood, x, y + .25, z, .02, .3, .02);
  cyl(p, material, x, y, z, .12, .12, .3, 8);
  glow(p, x, y, z, 1.2);
}

// ---------- Houses ----------
export function stiltHouse(rng, { thatch = rng.chance(.4), wide = 1 } = {}) {
  const w = rng.range(5, 6.6) * wide, d = rng.range(4.2, 5.2), fh = rng.range(1.5, 1.9), wh = 1.8;
  const g = structure({ w: w + 1.6, d: d + 4.2 });
  const wall = rng.pick([M.woodPale, M.woodLight, M.teak]), dark = M.darkWood;
  for (const px of [-w / 2 + .2, 0, w / 2 - .2]) for (const pz of [-d / 2 + .2, d / 2 - .2]) cyl(g, dark, px, (fh + wh) / 2, pz, .1, .12, fh + wh, 6);
  box(g, M.wood, 0, fh, 0, w + .2, .18, d + .2);
  // Walls with door, shutters and plank seams.
  box(g, wall, 0, fh + wh / 2, -d / 2 + .1, w, wh, .12);
  box(g, wall, -w / 2 + .1, fh + wh / 2, 0, .12, wh, d);
  box(g, wall, w / 2 - .1, fh + wh / 2, 0, .12, wh, d);
  box(g, wall, -w * .3, fh + wh / 2, d / 2 - .1, w * .4, wh, .12);
  box(g, wall, w * .3, fh + wh / 2, d / 2 - .1, w * .4, wh, .12);
  box(g, dark, 0, fh + wh * .45, d / 2 - .14, w * .2, wh * .9, .06);
  box(g, M.window, -w * .3, fh + wh * .55, d / 2 - .03, .7, .6, .04);
  box(g, M.window, w * .3, fh + wh * .55, d / 2 - .03, .7, .6, .04);
  for (let i = 0; i < 6; i++) box(g, dark, -w / 2 + (i + .5) * w / 6, fh + wh / 2, -d / 2 + .03, .04, wh, .04);
  // Veranda (ชาน) and stairs.
  const vx = rng.chance(.5) ? -w * .18 : w * .18;
  box(g, M.woodLight, vx, fh - .02, d / 2 + 1, w * .62, .14, 2);
  for (const sx of [-1, 1]) cyl(g, dark, vx + sx * w * .29, fh / 2, d / 2 + 1.9, .07, .08, fh, 6);
  railing(g, M.wood, vx - w * .31, d / 2 + 1.98, vx + w * .05, d / 2 + 1.98, fh);
  const sx = vx + w * .2, steps = Math.round(fh * 3.2), stairEnd = d / 2 + 2.05 + steps * .32;
  stairs(g, M.wood, sx, stairEnd, .9, fh, steps, 0);
  thaiRoof(g, { width: d + 1.6, depth: w + 1.4, height: (d + 1.6) * .72, y: fh + wh - .05, ry: Math.PI / 2, material: thatch ? M.thatch : rng.pick([M.tile, M.tileDark, M.tile]), gable: wall === M.teak ? M.woodLight : M.teak });
  // Life under the house: a bamboo platform (แคร่), water jars.
  box(g, M.woodPale, -w * .22, .45, -.2, 1.8, .1, 1.1);
  for (const lx of [-1, 1]) for (const lz of [-1, 1]) box(g, dark, -w * .22 + lx * .8, .22, -.2 + lz * .45, .06, .44, .06);
  prop(g, 'jar', sx - 1.1, 0, stairEnd - .4, { s: rng.range(.9, 1.2) });
  prop(g, 'jar', w / 2 + .3, 0, -d / 4, { s: rng.range(.8, 1.1) });
  if (rng.chance(.5)) prop(g, 'basket', -w / 2 - .2, 0, d / 4);
  solid(g, 0, 0, w + .5, d + .5);
  solid(g, vx, d / 2 + 1, w * .62, 2);
  anchor(g, 'door', sx, stairEnd + .9, 0);
  g.userData.footprint = { w: w + 1.6, d: stairEnd + 1.2 + d / 2 + .6, z: (stairEnd + 1.2 - d / 2 - .6) / 2 };
  anchor(g, 'seat', -w * .22, 1.2, 0);
  if (rng.chance(.35)) smoke(g, w / 2 - .6, fh + wh + .8, -d / 2 + .6, { rate: .9, size: 1.4, when: 'cook' });
  return g;
}

export function shophouseRow(rng, units, { goods = [], awning = null } = {}) {
  const uw = 3.6, d = 5.2, h1 = 2.5, h2 = 1.3, w = units * uw;
  const g = structure({ w: w + 1, d: d + 3 });
  const wall = rng.pick([M.woodLight, M.teak, M.woodPale]);
  box(g, M.stone, 0, .12, 0, w + .2, .24, d + .2);
  box(g, wall, 0, h1 / 2 + .2, -d / 2 + .1, w, h1, .14);
  box(g, wall, 0, h1 + .2 + h2 / 2, 0, w, h2, d - .3);
  for (const sx of [-1, 1]) box(g, wall, sx * (w / 2 - .07), (h1 + h2) / 2 + .2, 0, .14, h1 + h2, d);
  for (let u = 0; u < units; u++) {
    const cx = -w / 2 + uw * (u + .5);
    box(g, M.darkWood, cx - uw / 2 + .05, h1 / 2 + .2, d / 2 - .1, .14, h1, .14);
    const open = u % 3 !== 2;
    if (open) { box(g, M.darkWood, cx, h1 / 2 + .2, d / 2 - .6, uw - .3, h1 - .1, .05); box(g, M.wood, cx - uw * .44, h1 / 2 + .2, d / 2 - .2, .12, h1 - .2, .5); }
    else for (let k = 0; k < 6; k++) box(g, k % 2 ? M.wood : M.teak, cx - uw / 2 + .3 + k * (uw - .6) / 5.5, h1 / 2 + .2, d / 2 - .15, (uw - .6) / 6, h1 - .1, .06);
    box(g, M.window, cx, h1 + .2 + h2 * .5, d / 2 - .18, .9, .55, .05);
    // Awning, sign and a lantern for each shop room.
    const cloth = awning ?? rng.pick([M.cloth.red, M.cloth.cream, M.cloth.indigo, M.cloth.yellow, M.thatch]);
    box(g, cloth, cx, h1 + .02, d / 2 + .75, uw - .1, .05, 1.7, 0, .32);
    for (const sx of [-1, 1]) cyl(g, M.darkWood, cx + sx * (uw / 2 - .2), (h1 - .2) / 2, d / 2 + 1.5, .05, .05, h1 - .2, 5);
    box(g, M.darkWood, cx, h1 + .48, d / 2 + .04, 1.6, .38, .06); box(g, M.gold, cx, h1 + .48, d / 2 + .08, 1.4, .24, .02);
    hangingLantern(g, cx + uw * .3, h1 - .35, d / 2 + 1.2);
    for (const item of goods[u] ?? []) prop(g, item.name, cx + (item.x ?? 0), item.y ?? 0, d / 2 + 1 + (item.z ?? 0), item);
  }
  thaiRoof(g, { width: d + 1.6, depth: w + 1, height: (d + 1.6) * .55, y: h1 + h2 + .15, ry: Math.PI / 2, material: rng.pick([M.tile, M.tileDark]), gable: wall });
  solid(g, 0, 0, w + .2, d + .2);
  return g;
}

export function warehouse(rng, w = 12, d = 7) {
  const g = structure({ w: w + 1, d: d + 2 });
  box(g, M.stone, 0, .2, 0, w + .2, .4, d + .2);
  for (const [sx, sz] of [[0, -1], [-1, 0], [1, 0]]) box(g, M.woodLight, sx * (w / 2 - .08), 1.8, sz * (d / 2 - .08), sx ? .16 : w, 2.8, sz ? .16 : d);
  for (const sx of [-1, 1]) box(g, M.woodLight, sx * w * .32, 1.8, d / 2 - .08, w * .36, 2.8, .16);
  box(g, M.darkWood, 0, 1.6, d / 2 - .1, w * .28, 2.4, .05);
  for (let x = -w / 2 + 1; x < w / 2; x += 2) box(g, M.darkWood, x, 1.8, d / 2 + .02, .08, 2.8, .06);
  thaiRoof(g, { width: d + 1.4, depth: w + .8, height: (d + 1.4) * .5, y: 3.15, ry: Math.PI / 2, material: rng.chance(.5) ? M.thatch : M.tileDark, gable: M.wood });
  solid(g, 0, 0, w + .2, d + .2);
  return g;
}

// ---------- Market ----------
const STALL_GOODS = {
  fruit: g => { for (let i = 0; i < 4; i++) prop(g, 'fruitBasket', -.9 + i * .6, .86, .1, { color: ['#d6a23c', '#c8572f', '#8fae45', '#e2c25a'][i] }); },
  veg: g => { for (let i = 0; i < 4; i++) prop(g, 'fruitBasket', -.9 + i * .6, .86, .1, { color: ['#6f9a3c', '#9c4a7a', '#d98a3a', '#5f8a36'][i] }); },
  fish: g => { for (let i = 0; i < 3; i++) prop(g, 'fishBasket', -.8 + i * .8, .86, .1); prop(g, 'jar', 1.5, 0, .5, { s: .8 }); },
  pottery: g => { for (let i = 0; i < 4; i++) prop(g, 'pot', -.9 + i * .6, .86, .1, { s: .7 + (i % 2) * .2 }); for (let i = 0; i < 3; i++) prop(g, 'jar', -1 + i, 0, .85, { s: .7 + i * .12 }); },
  cloth: g => { for (let i = 0; i < 5; i++) box(g, [M.cloth.red, M.cloth.indigo, M.cloth.yellow, M.cloth.green, M.cloth.purple][i], -.95 + i * .47, .93, .1, .42, .14, .7); },
  rice: g => { for (let i = 0; i < 4; i++) prop(g, 'sack', -.9 + i * .6, .95, .05, { ry: i }); },
  herbs: g => { for (let i = 0; i < 4; i++) prop(g, 'fruitBasket', -.9 + i * .6, .86, .1, { color: ['#7a8f45', '#9a7a45', '#5f7a3e', '#b39a5c'][i] }); },
  lanterns: g => { for (let i = 0; i < 4; i++) hangingLantern(g, -.9 + i * .6, 1.75, .45, i % 2 ? M.lanternPaper : M.lantern); },
  charms: g => { for (let i = 0; i < 6; i++) box(g, i % 2 ? M.cloth.red : M.cloth.yellow, -1 + i * .4, 1.65, .55, .18, .28, .02); prop(g, 'pot', .9, .86, 0, { s: .5 }); },
  weapons: g => {
    box(g, M.darkWood, 0, 1.2, -.45, 2.2, .08, .08); box(g, M.darkWood, 0, .55, -.45, 2.2, .08, .08);
    for (let i = 0; i < 6; i++) { box(g, M.steel, -.95 + i * .38, .95, -.4, .06, 1, .02); box(g, M.darkWood, -.95 + i * .38, .38, -.4, .1, .22, .05); }
    for (let i = 0; i < 2; i++) box(g, M.steel, -.4 + i * .8, .88, .15, .1, .04, .9, .3);
  },
  armor: g => {
    for (let i = 0; i < 2; i++) { cyl(g, M.darkWood, -.6 + i * 1.2, .9, -.3, .04, .04, 1.8, 5); cyl(g, i ? M.cloth.red : M.cloth.indigo, -.6 + i * 1.2, 1.35, -.3, .2, .26, .55, 8); cyl(g, M.gold, -.6 + i * 1.2, 1.75, -.3, .06, .17, .22, 8); }
    cyl(g, M.wood, .3, .95, .15, .32, .32, .05, 14);
  },
};
export function stall(rng, kind) {
  const g = structure({ w: 3.4, d: 2.8 });
  const cloth = rng.pick([M.cloth.red, M.cloth.cream, M.cloth.indigo, M.cloth.yellow, M.cloth.green, M.cloth.white]);
  box(g, M.woodLight, 0, .8, 0, 2.6, .1, 1.2);
  for (const lx of [-1.2, 1.2]) for (const lz of [-.5, .5]) box(g, M.darkWood, lx, .4, lz, .08, .8, .08);
  for (const lx of [-1.35, 1.35]) for (const lz of [-.85, .75]) cyl(g, M.darkWood, lx, 1.15, lz, .04, .05, 2.3 - (lz > 0 ? .3 : 0), 5);
  box(g, cloth, 0, 2.08, -.05, 2.95, .04, 1.95, 0, .16);
  for (const lx of [-1, 1]) box(g, cloth, lx * 1.47, 1.9, -.05, .02, .35, 1.9);
  (STALL_GOODS[kind] ?? STALL_GOODS.fruit)(g);
  solid(g, 0, 0, 2.7, 1.3);
  anchor(g, 'vendor', 0, -1.15, 0); anchor(g, 'customer', 0, 1.45, Math.PI);
  return g;
}

// Open pavilion (ศาลา); the market variant is large with tiered roofs.
export function sala(rng, { w = 5, d = 4, h = 2.8, tiers = 1, base = .35, roof = M.tile, columns = M.woodRed, gold = true } = {}) {
  const g = structure({ w: w + 2, d: d + 2 });
  box(g, M.brick, 0, base / 2, 0, w + .6, base, d + .6);
  box(g, M.sandstone, 0, base + .03, 0, w + .4, .06, d + .4);
  const nx = Math.max(2, Math.round(w / 2.6) + 1), nz = Math.max(2, Math.round(d / 2.6) + 1);
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
    if (i && j && i < nx - 1 && j < nz - 1 && w < 9) continue;
    const x = -w / 2 + w * i / (nx - 1), z = -d / 2 + d * j / (nz - 1);
    cyl(g, columns, x, base + h / 2, z, .14, .16, h, 8);
    if (gold) cyl(g, M.gold, x, base + h - .1, z, .19, .17, .16, 8);
    post(g, x, z, .2);
  }
  for (const side of [-1, 1]) { box(g, M.darkWood, 0, base + h, side * d / 2, w + .2, .18, .14); box(g, M.darkWood, side * w / 2, base + h, 0, .14, .18, d + .2); }
  if (tiers > 1) tieredRoof(g, { width: w + 1.6, depth: d + 1.8, y: base + h, tiers, material: roof });
  else thaiRoof(g, { width: w + 1.4, depth: d + 1.6, height: (w + 1.4) * .55, y: base + h, material: roof, style: 'temple', trim: gold ? M.gold : M.darkWood, gable: M.woodRed, finials: gold });
  deck(g, 0, 0, w + .6, d + .6, 0, base, [.8, .8]);
  return g;
}

// ---------- Sacred architecture ----------
const bellProfile = [[0, 0], [1.48, 0], [1.5, .12], [1.36, .2], [1.25, .29], [1.22, .52], [1.13, .77], [.92, 1.15], [.7, 1.49], [.53, 1.62], [.48, 1.72], [.45, 1.82], [0, 1.82]];
const bellGeometry = cached('bell', () => new THREE.LatheGeometry(bellProfile.map(([x, y]) => new THREE.Vector2(x, y)), 28));
const bellLowGeometry = cached('bellLow', () => new THREE.LatheGeometry(bellProfile.map(([x, y]) => new THREE.Vector2(x, y)), 12));

// Bell-shaped Ayutthaya chedi; scale 1 is about 5 units tall.
export function chedi(p, { x = 0, z = 0, scale = 1, body = M.sandstone, base = M.brick, spire = M.gold, low = false, broken = 0 } = {}) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.scale.setScalar(scale); p.add(g);
  box(g, base, 0, .2, 0, 4.8, .4, 4.8);
  box(g, M.stone, 0, .48, 0, 4.2, .16, 4.2);
  box(g, base, 0, .73, 0, 3.75, .4, 3.75);
  box(g, body, 0, .99, 0, 3.85, .12, 3.85);
  cyl(g, body, 0, 1.15, 0, 1.6, 1.8, .25, low ? 12 : 28);
  mesh(g, low ? bellLowGeometry : bellGeometry, body, 0, 1.23, 0);
  if (broken < 1) {
    box(g, body, 0, 3.15, 0, .7, .28, .7);
    const rings = broken ? 4 : 8;
    for (let i = 0; i < rings; i++) cyl(g, i % 2 ? body : M.stone, 0, 3.4 + i * .15, 0, .37 - i * .037, .42 - i * .039, .15, low ? 8 : 18);
    if (!broken) cyl(g, spire, 0, 4.95, 0, .012, .12, 1.05, 10);
  }
  return g;
}

export function bigGoldenChedi(rng) {
  const g = structure({ w: 22, d: 22 });
  // Three receding terraces with stairs on each side, then a gilded bell and spire.
  [[20, 1.2, M.brick], [16.5, 1.1, M.plaster], [13, 1, M.brick]].forEach(([s, h, m], i) => {
    const y = [0, 1.2, 2.3][i];
    box(g, m, 0, y + h / 2, 0, s, h, s);
    box(g, M.sandstone, 0, y + h + .05, 0, s + .2, .1, s + .2);
    for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2; stairs(g, M.plaster, Math.sin(a) * (s / 2 + 1.1), Math.cos(a) * (s / 2 + 1.1), 2.4, h, 4, a).position.y = y; }
  });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) chedi(g, { x: sx * 9.1, z: sz * 9.1, scale: .3, body: M.plaster, spire: M.goldBright, low: true }).position.y = 1.2;
  const top = new THREE.Group(); top.position.y = 3.3; top.scale.setScalar(2.6); g.add(top);
  cyl(top, M.goldBright, 0, .15, 0, 2.2, 2.4, .3, 32);
  mesh(top, bellGeometry, M.goldBright, 0, .3, 0, 1.25, 1.6, 1.25);
  cyl(top, M.goldBright, 0, 3.45, 0, .55, .7, .5, 16);
  for (let i = 0; i < 12; i++) cyl(top, M.goldBright, 0, 3.75 + i * .2, 0, .42 - i * .03, .46 - i * .031, .2, 16);
  cyl(top, M.goldBright, 0, 7.1, 0, .02, .16, 1.9, 10);
  ball(top, M.goldBright, 0, 6.15, 0, .2);
  solid(g, 0, 0, 21, 21);
  glow(g, 0, 22, 0, 6, '#ffd98a', 'beacon');
  return g;
}

export function ubosot(rng) {
  const w = 10, d = 18, h = 4.2;
  const g = structure({ w: w + 4, d: d + 6 });
  box(g, M.brick, 0, .45, 0, w + 1.4, .9, d + 1.4);
  box(g, M.sandstone, 0, .93, 0, w + 1.6, .08, d + 1.6);
  box(g, M.plaster, 0, .9 + h / 2, 0, w, h, d);
  // Columns and porches at both ends; gilded window frames.
  for (const end of [-1, 1]) {
    for (const sx of [-1, -.33, .33, 1]) { cyl(g, M.plaster, sx * w * .42, .9 + h / 2, end * (d / 2 + 1.4), .3, .34, h, 10); cyl(g, M.gold, sx * w * .42, .9 + h - .2, end * (d / 2 + 1.4), .38, .34, .3, 10); }
    box(g, M.woodRed, 0, .9 + h * .42, end * (d / 2 + .02), 2.2, h * .8, .1);
    box(g, M.gold, 0, .9 + h * .42, end * (d / 2 + .06), 1.2, h * .65, .04);
    stairs(g, M.sandstone, 0, end * (d / 2 + 2.9), 3.5, .9, 3, end > 0 ? 0 : Math.PI);
  }
  for (const sx of [-1, 1]) for (let i = 0; i < 5; i++) {
    box(g, M.woodRed, sx * (w / 2 + .02), .9 + h * .5, -d / 2 + 2.2 + i * (d - 4.4) / 4, .08, 1.5, 1);
    box(g, M.gold, sx * (w / 2 + .05), .9 + h * .5, -d / 2 + 2.2 + i * (d - 4.4) / 4, .04, 1.7, 1.2);
  }
  tieredRoof(g, { width: w + 3, depth: d + 4.4, y: .9 + h, tiers: 3, material: M.tileOrange, edge: M.tileGreen, gable: M.woodRed });
  // Boundary stones (ใบเสมา) mark the sacred ground.
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, -1], [0, 1], [-1, 0], [1, 0]]) {
    const bx = sx * (w / 2 + 3.2), bz = sz * (d / 2 + 4.6);
    box(g, M.sandstone, bx, .35, bz, .9, .7, .9);
    box(g, M.sandstone, bx, 1.05, bz, .5, .8, .14); cone(g, M.sandstone, bx, 1.6, bz, .3, .4, 4).scale.z = .1;
  }
  solid(g, 0, 0, w + 1.6, d + 1.6);
  for (const end of [-1, 1]) for (const sx of [-1, -.33, .33, 1]) post(g, sx * w * .42, end * (d / 2 + 1.4), .38);
  return g;
}

export function bellTower() {
  const g = structure({ w: 5, d: 5 });
  box(g, M.brick, 0, 1.6, 0, 3.4, 3.2, 3.4);
  box(g, M.plaster, 0, 3.3, 0, 3.6, .2, 3.6);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) cyl(g, M.woodRed, sx * 1.4, 4.6, sz * 1.4, .12, .14, 2.6, 8);
  cyl(g, M.gold, 0, 5, 0, .45, .62, .9, 14); ball(g, M.gold, 0, 5.45, 0, .2);
  thaiRoof(g, { width: 4.4, depth: 4.4, height: 2.6, y: 5.9, material: M.tileGreen, style: 'temple', trim: M.gold, gable: M.woodRed, finials: true });
  thaiRoof(g, { width: 4.4, depth: 4.4, height: 2.6, y: 5.9, ry: Math.PI / 2, material: M.tileGreen, style: 'temple', trim: M.gold, gable: M.woodRed });
  solid(g, 0, 0, 3.6, 3.6);
  return g;
}

export function kuti(rng) {
  const g = structure({ w: 5, d: 5 });
  const fh = 1.1;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) cyl(g, M.darkWood, sx * 1.6, fh / 2, sz * 1.3, .09, .09, fh, 6);
  box(g, M.wood, 0, fh, 0, 3.6, .14, 3);
  box(g, M.woodPale, 0, fh + .9, 0, 3.2, 1.8, 2.6);
  box(g, M.darkWood, 0, fh + .8, 1.31, .7, 1.4, .05);
  thaiRoof(g, { width: 4.2, depth: 3.6, height: 2.4, y: fh + 1.75, material: M.tileDark, gable: M.woodLight });
  stairs(g, M.wood, 0, 2.6, .8, fh, 3, Math.PI);
  solid(g, 0, 0, 3.6, 3.2);
  return g;
}

export function spiritHouse(x = 0, z = 0, p) {
  const g = p ?? structure({ w: 2, d: 2 });
  cyl(g, M.plaster, x, .8, z, .12, .14, 1.6, 8);
  box(g, M.woodRed, x, 1.65, z, 1.1, .1, 1);
  box(g, M.plaster, x, 2, z, .7, .6, .6);
  box(g, M.gold, x, 2, z + .31, .3, .4, .02);
  thaiRoof(g, { width: 1.1, depth: 1, height: .8, y: 2.3, x, z, material: M.tileOrange, style: 'temple', trim: M.gold, gable: M.woodRed, finials: true, trimR: .02 });
  for (let i = 0; i < 3; i++) cyl(g, M.cloth.yellow, x - .3 + i * .3, 1.75, z + .4, .05, .05, .1, 6);
  glow(g, x, 1.85, z + .42, .7, '#ffcf80', 'candle');
  post(g, x, z, .35);
  return g;
}
