import * as THREE from 'three';
import { M } from './materials.js';
import { createRng, hashString } from './rng.js';

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
  // เรือนไทย: a steep main pitch that kicks out into a shallow, flared eave (ชายคา).
  return [[-w / 2, 0], [-w * .4, h * .075], [-w * .06, h * .93], [0, h], [w * .06, h * .93], [w * .4, h * .075], [w / 2, 0]];
}
// Height of a profile's upper edge at x (linear between its points).
function profileTop(points, x) {
  for (let i = 1; i < points.length; i++) {
    const [x0, y0] = points[i - 1], [x1, y1] = points[i];
    if (x >= x0 && x <= x1) return y0 + (y1 - y0) * (x - x0) / (x1 - x0 || 1);
  }
  return 0;
}
// part: 'all', 'main' (without the eave kicks) or 'eave' (only the outer kick segments).
function roofGeometry(w, d, h, style, part = 'all') {
  return cached(`roof${w.toFixed(1)}|${d.toFixed(1)}|${h.toFixed(1)}|${style}|${part}`, () => {
    const cross = roofProfile(w, h, style), pos = [], uv = [], index = [];
    let s = 0;
    cross.forEach(([x, y], i) => {
      if (i) s += Math.hypot(x - cross[i - 1][0], y - cross[i - 1][1]);
      for (const z of [-d / 2, d / 2]) { pos.push(x, y, z); uv.push(z / 2, s / 2); }
    });
    for (let i = 0; i < cross.length - 1; i++) {
      const eave = i === 0 || i === cross.length - 2;
      if (part === 'main' && eave || part === 'eave' && !eave) continue;
      const a = i * 2; index.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
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
// Bargeboard (ป้านลม): a flat board of width b riding the roof edge, offset along the slope normal.
function bargeGeometry(w, h, b, t = .08) {
  return cached(`barge${w.toFixed(1)}|${h.toFixed(1)}|${b.toFixed(2)}`, () => {
    const pts = roofProfile(w, h, 'house'), top = [], low = [];
    pts.forEach(([x, y], i) => {
      const a = pts[Math.max(0, i - 1)], c = pts[Math.min(pts.length - 1, i + 1)];
      let nx = -(c[1] - a[1]), ny = c[0] - a[0]; const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
      top.push([x + nx * b * .3, y + ny * b * .3]); low.push([x - nx * b * .7, y - ny * b * .7]);
    });
    const shape = new THREE.Shape();
    [...top, ...low.reverse()].forEach(([x, y], i) => (i ? shape.lineTo(x, y) : shape.moveTo(x, y)));
    return new THREE.ExtrudeGeometry(shape, { depth: t, bevelEnabled: false }).translate(0, 0, -t / 2);
  });
}
// A sheet with tile-sized UVs (u across, v down the slope) for lean-to roofs (กันสาด); local +z runs down the slope.
const sheetGeometry = (w, l) => cached(`sheet${w.toFixed(1)}|${l.toFixed(1)}`, () => {
  const g = new THREE.PlaneGeometry(w, l).rotateX(-Math.PI / 2), uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / 2, uv.getY(i) * l / 2);
  return g;
});
const finialGeometry = cached('finial', () => new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
  new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, .3, .12), new THREE.Vector3(0, .62, .02), new THREE.Vector3(0, .78, -.14)]), 10, .06, 5, false));
// Curled eave tip (หางหงส์ / ตัวเหงา), drawn in the xy plane and reaching out along +x.
const curlGeometry = cached('curl', () => new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
  new THREE.Vector3(-.1, -.02, 0), new THREE.Vector3(.35, .02, 0), new THREE.Vector3(.62, .25, 0), new THREE.Vector3(.58, .52, 0), new THREE.Vector3(.4, .58, 0)]), 8, .09, 4, false));
// Small upswept apex horn for house gables, pointing out along +z.
const hornGeometry = cached('horn', () => new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
  new THREE.Vector3(0, -.1, -.05), new THREE.Vector3(0, .25, .02), new THREE.Vector3(0, .5, .2), new THREE.Vector3(0, .62, .42)]), 6, .07, 4, false));
// Ridge caps contrast with their roof and use the roof (fading) materials.
let RIDGE = null;
const ridgeFor = m => {
  RIDGE ??= new Map([[M.tile, M.tileDark], [M.tileOrange, M.tileDark], [M.tileGreen, M.tileDark], [M.tileDark, M.tile], [M.thatch, M.thatchDark], [M.thatchDark, M.thatch]]);
  return RIDGE.get(m) ?? m;
};

// Gable infill (หน้าจั่ว): 'sun' is the sunburst (หน้าจั่วพรหมพักตร์ / ลายแสงอาทิตย์), 'panel' framed boards (ปะกน).
function gablePattern(p, w, h, pattern, m, b, style = 'house') {
  const pts = roofProfile(w * .9, h * .93, style), gw = w * .9, z = .035;
  if (style === 'house') box(p, m, 0, .05, z, gw * .86, b * .9, .06);
  if (pattern === 'sun') {
    const n = 9;
    for (let i = 0; i < n; i++) {
      const a = Math.PI * (.1 + .8 * i / (n - 1)), dx = Math.cos(a), dy = Math.sin(a);
      let t = .2;
      while (t < h && Math.abs(dx * t) < gw / 2 && dy * t + .1 < profileTop(pts, dx * t) - .12) t += .05;
      if (t < .4) continue;
      box(p, m, dx * t / 2, .1 + dy * t / 2, z, Math.max(.055, b * .4), t, .045, 0, 0, a - Math.PI / 2);
    }
    const r = Math.min(.45, b * 1.6);
    mesh(p, cylGeo(1, 1, 12), m, 0, .1, z, r, .06, r, 0, Math.PI / 2);
  } else {
    const step = Math.max(.42, gw / 9);
    for (let x = -gw * .4 + step / 2; x < gw * .4; x += step) {
      const top = profileTop(pts, x) - .08;
      if (top > .3) box(p, m, x, (top + .05) / 2, z, .05, top - .05, .045);
    }
    const yr = h * .36, half = gw / 2 * (1 - yr / (h * .93)) * .9;
    if (half > .4) box(p, m, 0, yr, z, half * 2, .07, .05);
  }
}

// Ridge runs along local z. width spans x; y is the eave height. House-style
// roofs get flat bargeboards with curled tips, a ridge cap, eave boards and a
// gable pattern; temple roofs keep their gilded trim and finials.
export function thaiRoof(p, { width, depth, height = width * .6, y, x = 0, z = 0, ry = 0, material = M.tile, style = 'house', trim = M.darkWood, gable = M.woodLight, finials = false, trimR = .045, ridge = null, pattern = 'panel', battens = trim, tips = true, eave = null, ends = [-1, 1] }) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; p.add(g);
  if (style === 'temple' || eave === false) mesh(g, roofGeometry(width, depth, height, style), material);
  else { mesh(g, roofGeometry(width, depth, height, style, 'main'), material); mesh(g, roofGeometry(width, depth, height, style, 'eave'), eave ?? ridgeFor(material)); }
  if (style === 'temple') {
    for (const end of [-1, 1]) {
      if (gable) {
        const face = new THREE.Group(); face.position.z = end * (depth / 2 - .12); face.rotation.y = end > 0 ? 0 : Math.PI; g.add(face);
        mesh(face, gableGeometry(width, height, style), gable);
        // Gilded sunburst on the pediment (หน้าบัน) of larger sacred roofs.
        if (pattern && width > 3) gablePattern(face, width, height, 'sun', trim, THREE.MathUtils.clamp(width * .03, .08, .25), style);
      }
      mesh(g, trimGeometry(width, height, style, trimR), trim, 0, 0, end * depth / 2);
      if (finials) {
        mesh(g, finialGeometry, trim, 0, height - .02, end * depth / 2, 1.3, 1.3, end * 1.3);
        for (const side of [-1, 1]) mesh(g, finialGeometry, trim, side * width * .5, .13 * height, end * depth / 2, .6, .6, end * .6, side * .5);
      }
    }
    return g;
  }
  const b = THREE.MathUtils.clamp(width * .034, .07, .22);
  if (ridge !== false) box(g, ridge ?? ridgeFor(material), 0, height - b * .15, 0, Math.max(.16, b * 1.2), b, depth + .06);
  for (const side of [-1, 1]) box(g, trim, side * (width / 2 - .03), -b * .3, 0, .06, b * .9, depth - .04);
  for (const end of ends) {
    const e = new THREE.Group(); e.position.z = end * depth / 2; e.rotation.y = end > 0 ? 0 : Math.PI; g.add(e);
    mesh(e, bargeGeometry(width, height, b), trim);
    if (tips) {
      const s = b * 1.9;
      for (const side of [-1, 1]) mesh(e, curlGeometry, trim, side * (width / 2 - .02), -b * .45, 0, s, s, s, side > 0 ? 0 : Math.PI);
      mesh(e, hornGeometry, trim, 0, height + b * .1, 0, b * 3.4, b * 3.4, b * 3.4);
    }
    if (gable) {
      const inner = new THREE.Group(); inner.position.z = -.14; e.add(inner);
      mesh(inner, gableGeometry(width, height, style), gable);
      if (pattern) gablePattern(inner, width, height, pattern, battens, b);
    }
  }
  return g;
}
// Lean-to roof (กันสาด) from (z0, y0) down to (z1, y1), `w` wide, centred on x.
export function leanTo(p, material, x, w, z0, y0, z1, y1, edge = M.darkWood) {
  const l = Math.hypot(z1 - z0, y1 - y0), a = Math.atan2(y0 - y1, z1 - z0);
  mesh(p, sheetGeometry(w, l), material, x, (y0 + y1) / 2, (z0 + z1) / 2, 1, 1, 1, 0, a);
  box(p, edge, x, y1 - .05, z1, w, .12, .06, 0, a);
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

// ---------- Wall details ----------
// Framed plank panels (ฝาปะกน) laid on a wall face. The face is centred at
// (x, z), `len` wide, from y0 up `h`, and faces +z when rot = 0. `skip` lists
// [from, to] spans along the face kept clear of studs (doors, windows).
export function panelFace(p, m, x, z, rot, len, y0, h, { step = .9, skip = [] } = {}) {
  const g = new THREE.Group(); g.position.set(x, y0, z); g.rotation.y = rot; p.add(g);
  for (const y of [.05, h * .56, h - .05]) box(g, m, 0, y, .02, len, .08, .05);
  const n = Math.max(1, Math.round(len / step));
  for (let i = 0; i <= n; i++) {
    const lx = -len / 2 + i * len / n;
    if (!skip.some(([a, b]) => lx > a && lx < b)) box(g, m, lx, h / 2, .02, .07, h, .05);
  }
  return g;
}
// A framed window on a wall face (same placement convention as panelFace):
// open ones show a lit pane with the shutters folded flat against the wall.
export function windowFrame(p, { x, y, z, rot = 0, w = .8, h = .7, frame = M.darkWood, shutter = M.teak, open = true }) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rot; p.add(g);
  box(g, open ? M.window : shutter, 0, 0, .05, w, h, .04);
  box(g, frame, 0, h / 2 + .05, .07, w + .28, .09, .08);
  box(g, frame, 0, -h / 2 - .05, .09, w + .32, .07, .14);
  for (const s of [-1, 1]) box(g, frame, s * (w / 2 + .04), 0, .07, .07, h, .07);
  if (open) for (const s of [-1, 1]) { box(g, shutter, s * (w * .75 + .1), 0, .05, w / 2, h, .04); box(g, frame, s * (w * .75 + .1), 0, .075, w * .3, .05, .02); }
  else box(g, frame, 0, 0, .08, .04, h, .02);
  return g;
}
// Door opening with jambs, lintel and a raised sill (ธรณีประตู).
export function doorFrame(p, { x, y, z, rot = 0, w = 1, h = 1.7, frame = M.darkWood }) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rot; p.add(g);
  box(g, M.darkWood, 0, h / 2, .02, w, h, .04);
  box(g, frame, 0, h + .06, .07, w + .36, .12, .1);
  box(g, frame, 0, .06, .08, w + .1, .12, .12);
  for (const s of [-1, 1]) box(g, frame, s * (w / 2 + .05), h / 2, .07, .09, h, .08);
  return g;
}

// ---------- Houses ----------
// Raised Thai house (เรือนไทย): stilts and floor beams, framed plank walls
// (ฝาปะกน) with shuttered windows, a terrace (ชาน) with railings and stairs,
// a steep flared roof with bargeboards and a patterned gable. The shared `rng`
// draws exactly what it always did (layout and NPC spots depend on it); the
// look varies through a private generator seeded from the house's own size.
export function stiltHouse(rng, { thatch = rng.chance(.4), wide = 1 } = {}) {
  const w = rng.range(5, 6.6) * wide, d = rng.range(4.2, 5.2), fh = rng.range(1.5, 1.9), wh = 2;
  const v = createRng(hashString(`house|${w.toFixed(5)}|${d.toFixed(5)}|${fh.toFixed(5)}`));
  const g = structure({ w: w + 1.6, d: d + 4.2 });
  const wall = rng.pick([M.woodPale, M.woodLight, M.teak]), dark = M.darkWood, top = fh + wh;
  const frame = wall === M.teak ? v.pick([M.woodPale, M.darkWood, M.woodLight]) : v.pick([M.darkWood, M.teak, M.woodRed, M.darkWood]);
  const shutter = v.pick([M.teak, M.woodRed, M.wood, M.darkWood].filter(m => m !== wall && m !== frame));
  const rail = v.pick([M.wood, frame, M.woodPale]);
  // Stilts (เสา) up to the eaves; beams (ราอด, คาน) carry the floor.
  const postX = [-w / 2 + .2, 0, w / 2 - .2], postZ = [-d / 2 + .2, d / 2 - .2];
  for (const px of postX) for (const pz of postZ) cyl(g, dark, px, top / 2, pz, .1, .13, top, 6);
  for (const pz of postZ) box(g, dark, 0, fh - .2, pz, w + .45, .16, .16);
  for (const px of postX) box(g, dark, px, fh - .36, 0, .14, .14, d + .45);
  box(g, M.wood, 0, fh, 0, w + .2, .18, d + .2);
  box(g, frame, 0, fh + .02, d / 2 + .11, w + .24, .14, .04);
  // Walls: back, sides and the front either side of the door.
  const y0 = fh + .09, h = wh - .09, dw = w * .2;
  box(g, wall, 0, y0 + h / 2, -d / 2 + .1, w, h, .12);
  box(g, wall, -w / 2 + .1, y0 + h / 2, 0, .12, h, d);
  box(g, wall, w / 2 - .1, y0 + h / 2, 0, .12, h, d);
  box(g, wall, -(w + dw) / 4, y0 + h / 2, d / 2 - .1, (w - dw) / 2, h, .12);
  box(g, wall, (w + dw) / 4, y0 + h / 2, d / 2 - .1, (w - dw) / 2, h, .12);
  const segment = (w - dw) / 2, wy = y0 + h * .55;
  for (const s of [-1, 1]) {
    panelFace(g, frame, s * (w + dw) / 4, d / 2 - .04, 0, segment, y0, h, { skip: [[-.55, .55]] });
    windowFrame(g, { x: s * (w + dw) / 4, y: wy, z: d / 2 - .04, w: .8, h: .72, frame, shutter });
    panelFace(g, frame, s * (w / 2 - .04), 0, s * Math.PI / 2, d, y0, h, { skip: [[-.55, .55]] });
    windowFrame(g, { x: s * (w / 2 - .04), y: wy, z: 0, rot: s * Math.PI / 2, w: .75, h: .7, frame, shutter, open: v.chance(.6) });
  }
  panelFace(g, frame, 0, -d / 2 + .04, Math.PI, w, y0, h, { skip: [[-w * .25 - .5, -w * .25 + .5], [w * .25 - .5, w * .25 + .5]] });
  for (const s of [-1, 1]) windowFrame(g, { x: s * w * .25, y: wy, z: -d / 2 + .04, rot: Math.PI, w: .75, h: .7, frame, shutter, open: v.chance(.4) });
  doorFrame(g, { x: 0, y: y0, z: d / 2 - .1, w: dw - .2, h: h * .86, frame });
  // Terrace (ชาน) with plank seams, railings, stairs and a newel-posted handrail.
  const vx = rng.chance(.5) ? -w * .18 : w * .18, vw = w * .62, front = d / 2 + 2;
  box(g, M.woodLight, vx, fh - .02, d / 2 + 1, vw, .14, 2);
  for (let i = 1; i < 5; i++) box(g, M.wood, vx, fh + .052, d / 2 + i * .4, vw - .06, .012, .035);
  box(g, frame, vx, fh - .05, front + .02, vw + .04, .14, .05);
  const sx = vx + w * .2, steps = Math.round(fh * 3.2), stairEnd = d / 2 + 2.05 + steps * .32;
  const roofMat = thatch ? M.thatch : rng.pick([M.tile, M.tileDark, M.tile]);
  const pent = v.chance(.55), py = top - .5;
  for (const s of [-1, 1]) cyl(g, dark, vx + s * w * .29, (pent ? py : fh + .9) / 2, front - .1, .07, .08, pent ? py : fh + .9, 6);
  railing(g, rail, vx - w * .31, front - .04, vx + w * .05, front - .04, fh);
  for (const s of [-1, 1]) railing(g, rail, vx + s * (vw / 2 - .04), d / 2 + .12, vx + s * (vw / 2 - .04), front - .1, fh, .5);
  stairs(g, M.wood, sx, stairEnd, .9, fh, steps, 0);
  for (const s of [-1, 1]) beam(g, frame, [sx + s * .48, .05, stairEnd + .18], [sx + s * .48, fh, front + .02], .05, 4);
  cyl(g, frame, sx + .5, .5, stairEnd + .1, .06, .06, 1, 6);
  beam(g, rail, [sx + .5, .95, stairEnd + .1], [sx + .5, fh + .6, front], .035, 4);
  if (pent) {
    // A tiled lean-to (กันสาด) shades the terrace, with a lantern under its edge.
    leanTo(g, roofMat, vx, vw + .6, d / 2 + .35, top + .22, front + .35, py, frame);
    box(g, dark, vx, py - .1, front - .1, vw, .12, .12);
    if (v.chance(.65)) hangingLantern(g, vx - w * .16, py - .45, front - .15, v.chance(.5) ? M.lantern : M.lanternPaper);
  } else {
    for (let i = 0; i < 3; i++) if (v.chance(.7)) prop(g, 'plantPot', vx - vw / 2 + .35 + i * .45, fh + .06, front - .3, { s: v.range(.8, 1.1), ry: v() * 6 });
  }
  prop(g, 'jar', sx - .75, fh + .06, front - .35, { s: .6 });
  thaiRoof(g, { width: d + 1.8, depth: w + 1.4, height: (d + 1.8) * .74, y: top - .05, ry: Math.PI / 2, material: roofMat, gable: wall === M.teak ? M.woodLight : M.teak, trim: v.chance(.7) ? dark : frame, pattern: v.pick(['sun', 'panel', 'sun']), battens: wall === M.teak ? M.teak : M.woodPale });
  // Life under the house: a bamboo platform (แคร่), water jars, sometimes a hanging basket or firewood.
  box(g, M.woodPale, -w * .22, .45, -.2, 1.8, .1, 1.1);
  for (const lx of [-1, 1]) for (const lz of [-1, 1]) box(g, dark, -w * .22 + lx * .8, .22, -.2 + lz * .45, .06, .44, .06);
  prop(g, 'jar', sx - 1.1, 0, stairEnd - .4, { s: rng.range(.9, 1.2) });
  prop(g, 'jar', w / 2 + .3, 0, -d / 4, { s: rng.range(.8, 1.1) });
  if (rng.chance(.5)) prop(g, 'basket', -w / 2 - .2, 0, d / 4);
  if (v.chance(.5)) for (let i = 0; i < 5; i++) box(g, M.branch, w * .24, .08 + (i > 2 ? .15 : 0), -d / 2 + .5 + (i > 2 ? i - 2.5 : i) * .16, 1.3, .15, .15);
  if (v.chance(.4)) for (let i = 0; i < 3; i++) prop(g, 'pot', -w / 2 + .5 + i * .45, 0, d / 2 + .3, { s: v.range(.9, 1.3) });
  solid(g, 0, 0, w + .5, d + .5);
  solid(g, vx, d / 2 + 1, w * .62, 2);
  anchor(g, 'door', sx, stairEnd + .9, 0);
  g.userData.footprint = { w: w + 1.6, d: stairEnd + 1.2 + d / 2 + .6, z: (stairEnd + 1.2 - d / 2 - .6) / 2 };
  anchor(g, 'seat', -w * .22, 1.2, 0);
  if (rng.chance(.35)) smoke(g, w / 2 - .6, fh + wh + .8, -d / 2 + .6, { rate: .9, size: 1.4, when: 'cook' });
  return g;
}

// Builders without continuous random sizes (shophouses, stalls) take their
// look from a per-kind sequence; World resets it before every build so the
// same city comes out each time without touching the shared layout sequence.
const lookCount = new Map();
export function resetLooks() { lookCount.clear(); }
function nextLook(kind) {
  const n = lookCount.get(kind) ?? 0; lookCount.set(kind, n + 1);
  return createRng(hashString(`${kind}|${n}`));
}
const CLOTHS = () => [M.cloth.red, M.cloth.cream, M.cloth.indigo, M.cloth.yellow, M.cloth.green, M.cloth.white];
// Contrast trim for an awning: a light cloth on dark ones and red on light ones.
const contrastFor = (cloth, v) => (cloth === M.cloth.cream || cloth === M.cloth.white || cloth === M.cloth.yellow ? v.pick([M.cloth.red, M.cloth.indigo, M.cloth.green]) : v.pick([M.cloth.cream, M.cloth.white, M.cloth.yellow]));
// Scalloped valance along an awning edge: alternating flaps hung under (x, y, z).
function valance(p, x, y, z, w, a, b, ry = 0) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; p.add(g);
  const n = Math.max(3, Math.round(w / .36)), fw = w / n;
  for (let i = 0; i < n; i++) box(g, i % 2 ? b : a, -w / 2 + fw * (i + .5), -.11 - (i % 2) * .03, 0, fw * .92, .22 + (i % 2) * .06, .02);
}

// Two-storey wooden shophouse row (ห้องแถวไม้): shop rooms open under cloth
// awnings or closed with folding plank doors (บานเฟี้ยม), shuttered upper
// windows, eave brackets (คันทวย), signboards and lanterns.
export function shophouseRow(rng, units, { goods = [], awning = null } = {}) {
  const uw = 3.6, d = 5.2, h1 = 2.5, h2 = 1.5, w = units * uw, top1 = h1 + .2, top2 = top1 + h2;
  const v = nextLook('shop');
  const g = structure({ w: w + 1, d: d + 3 });
  const wall = rng.pick([M.woodLight, M.teak, M.woodPale]);
  const frame = wall === M.teak ? v.pick([M.woodPale, M.darkWood]) : v.pick([M.darkWood, M.teak, M.woodRed]);
  const shutter = v.pick([M.teak, M.woodRed, M.wood, M.darkWood].filter(m => m !== wall && m !== frame));
  box(g, M.stone, 0, .12, 0, w + .2, .24, d + .2);
  box(g, M.sandstone, 0, .25, 0, w + .3, .04, d + .3);
  box(g, wall, 0, h1 / 2 + .2, -d / 2 + .1, w, h1, .14);
  box(g, wall, 0, top1 + h2 / 2, 0, w, h2, d - .3);
  for (const sx of [-1, 1]) box(g, wall, sx * (w / 2 - .07), (top1 + top2) / 2 - h1 / 2, 0, .14, top2 - .2, d);
  // Storey beam, upper-floor panels and windows on every side.
  box(g, frame, 0, top1 + .02, d / 2 - .1, w + .12, .16, .24);
  const unitX = u => -w / 2 + uw * (u + .5), skips = Array.from({ length: units }, (_, u) => [unitX(u) - .65, unitX(u) + .65]);
  panelFace(g, frame, 0, d / 2 - .15, 0, w, top1 + .1, h2 - .1, { step: uw / 4, skip: skips });
  panelFace(g, frame, 0, -d / 2 + .03, Math.PI, w, .26, h1 - .06, { step: uw / 4, skip: skips });
  panelFace(g, frame, 0, -d / 2 + .15, Math.PI, w, top1 + .1, h2 - .1, { step: uw / 4, skip: skips });
  for (const s of [-1, 1]) {
    panelFace(g, frame, s * w / 2, 0, s * Math.PI / 2, d, .26, top2 - .26, { step: 1.05, skip: [[-.6, .6]] });
    windowFrame(g, { x: s * w / 2, y: top1 + h2 * .55, z: 0, rot: s * Math.PI / 2, w: .8, h: .6, frame, shutter, open: v.chance(.6) });
  }
  for (let u = 0; u < units; u++) {
    const cx = unitX(u);
    box(g, M.darkWood, cx - uw / 2 + .05, h1 / 2 + .2, d / 2 - .1, .14, h1, .14);
    const open = u % 3 !== 2;
    if (open) {
      box(g, M.darkWood, cx, h1 / 2 + .2, d / 2 - .6, uw - .3, h1 - .1, .05); box(g, M.wood, cx - uw * .44, h1 / 2 + .2, d / 2 - .2, .12, h1 - .2, .5);
      // Counter and a shelf of wares inside the open room.
      box(g, M.woodLight, cx + .2, .82, d / 2 - .42, uw - 1.3, .08, .5); box(g, frame, cx + .2, .52, d / 2 - .2, uw - 1.3, .56, .05);
      box(g, M.darkWood, cx, 1.55, d / 2 - .55, uw - .7, .05, .22);
      for (let k = 0; k < 4; k++) prop(g, v.pick(['pot', 'jar', 'basket']), cx - uw * .3 + k * uw * .2, 1.58, d / 2 - .55, { s: .45 });
    } else for (let k = 0; k < 6; k++) box(g, k % 2 ? M.wood : M.teak, cx - uw / 2 + .3 + k * (uw - .6) / 5.5, h1 / 2 + .2, d / 2 - .15, (uw - .6) / 6, h1 - .1, .06);
    windowFrame(g, { x: cx, y: top1 + h2 * .55, z: d / 2 - .15, w: 1, h: .62, frame, shutter });
    windowFrame(g, { x: cx, y: top1 + h2 * .55, z: -d / 2 + .15, rot: Math.PI, w: .8, h: .6, frame, shutter, open: v.chance(.5) });
    windowFrame(g, { x: cx, y: h1 * .55, z: -d / 2 + .03, rot: Math.PI, w: .8, h: .6, frame, shutter, open: false });
    // Eave brackets (คันทวย) from the upper wall to the roof edge.
    for (const s of [-1, 1]) if (s < 0 || u === units - 1) beam(g, frame, [cx + s * (uw / 2 - .06), top2 - .5, d / 2 - .15], [cx + s * (uw / 2 - .06), top2 + .1, d / 2 + .55], .045, 4);
    // Awning, sign and a lantern for each shop room.
    const cloth = awning ?? rng.pick([M.cloth.red, M.cloth.cream, M.cloth.indigo, M.cloth.yellow, M.thatch]);
    box(g, cloth, cx, h1 + .02, d / 2 + .75, uw - .1, .05, 1.7, 0, .32);
    if (cloth !== M.thatch) {
      const trim = contrastFor(cloth, v);
      valance(g, cx, h1 - .25, d / 2 + 1.57, uw - .1, cloth, trim);
      if (v.chance(.35)) for (const k of [-1, 0, 1]) box(g, trim, cx + k * uw * .3, h1 + .05, d / 2 + .76, .32, .05, 1.7, 0, .32);
    }
    for (const sx of [-1, 1]) cyl(g, M.darkWood, cx + sx * (uw / 2 - .2), (h1 - .2) / 2, d / 2 + 1.5, .05, .05, h1 - .2, 5);
    box(g, M.darkWood, cx, h1 + .42, d / 2 + .04, 1.6, .36, .06); box(g, v.chance(.7) ? M.gold : M.cloth.red, cx, h1 + .42, d / 2 + .08, 1.4, .22, .02);
    hangingLantern(g, cx + uw * .3, h1 - .35, d / 2 + 1.2);
    for (const item of goods[u] ?? []) prop(g, item.name, cx + (item.x ?? 0), item.y ?? 0, d / 2 + 1 + (item.z ?? 0), item);
  }
  const roof = { width: d + 1.6, height: (d + 1.6) * .58, y: h1 + h2 + .15, ry: Math.PI / 2, material: rng.pick([M.tile, M.tileDark]), gable: wall === M.teak ? M.woodLight : M.teak, battens: frame, pattern: v.pick(['panel', 'sun']), trim: M.darkWood };
  if (units === 3 && v.chance(.7)) {
    // Stepped ridge (หลังคาลดชั้น): the middle room's roof rises above its neighbours.
    thaiRoof(g, { ...roof, depth: uw + .3, width: d + 1.9, height: (d + 1.9) * .6, y: roof.y + .5 });
    for (const s of [-1, 1]) thaiRoof(g, { ...roof, x: s * (uw + .25), depth: uw + .5, ends: [s] });
  } else thaiRoof(g, { ...roof, depth: w + 1 });
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
  const v = nextLook('stall');
  const cloth = rng.pick(CLOTHS()), trim = contrastFor(cloth, v);
  box(g, M.woodLight, 0, .8, 0, 2.6, .1, 1.2);
  box(g, M.darkWood, 0, .74, .6, 2.64, .1, .04);
  for (const lx of [-1.2, 1.2]) for (const lz of [-.5, .5]) box(g, M.darkWood, lx, .4, lz, .08, .8, .08);
  for (const lx of [-1.35, 1.35]) for (const lz of [-.85, .75]) cyl(g, M.darkWood, lx, 1.15, lz, .04, .05, 2.3 - (lz > 0 ? .3 : 0), 5);
  // Striped canopy with a scalloped valance; a cloth skirt hides the table legs.
  box(g, cloth, 0, 2.08, -.05, 2.95, .04, 1.95, 0, .16);
  if (v.chance(.6)) for (const k of [-1, 0, 1]) box(g, trim, k * .9, 2.105, -.05, .3, .04, 1.95, 0, .16);
  valance(g, 0, 1.94, .92, 2.95, cloth, trim);
  for (const lx of [-1, 1]) box(g, cloth, lx * 1.47, 1.9, -.05, .02, .35, 1.9);
  box(g, v.chance(.5) ? trim : cloth, 0, .48, .63, 2.5, .5, .02);
  // Some stalls hang a small signboard; baskets and sacks wait under the table.
  if (v.chance(.45)) { cyl(g, M.darkWood, -1.35, 2.5, -.85, .03, .03, .8, 5); box(g, M.darkWood, -1.35, 2.75, -.62, .06, .36, .5); box(g, trim, -1.32, 2.75, -.62, .02, .26, .4); }
  for (let i = 0; i < 2; i++) if (v.chance(.6)) prop(g, v.pick(['basket', 'sack', 'jar']), -.7 + i * 1.3, 0, -.15, { s: .7, ry: v() * 6 });
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
