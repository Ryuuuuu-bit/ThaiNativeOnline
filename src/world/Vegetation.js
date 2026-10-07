import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { InstanceSet as BaseSet } from './Batching.js';
import { M, mat } from './materials.js';
import { patchMaterial } from './shaders.js';
import { createRng } from './rng.js';
import { leafClumpTexture, patchFoliage } from '../shared/foliage.js';

const rngTex = createRng(1977);
function texture(w, h, draw) {
  const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
  draw(canvas.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(canvas); t.colorSpace = THREE.SRGBColorSpace; return t;
}
// Leaf clumps as in the forest map: a data texture (shade / coverage) tinted per
// instance, so canopies read as many small dense clumps with a darker inside.
const leafData = leafClumpTexture(rngTex, { snow: false });
// Palm frond: a rib with paired leaflets.
const frondTexture = texture(128, 32, (ctx, w, h) => {
  ctx.strokeStyle = '#d6dcb0'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); ctx.stroke();
  for (let x = 4; x < w - 2; x += 3.2) for (const s of [-1, 1]) {
    const len = (h / 2 - 1) * Math.sin(Math.PI * Math.min(1, x / w + .12)), v = 170 + rngTex() * 70;
    ctx.strokeStyle = `rgb(${v * .85},${v},${v * .62})`; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(x, h / 2); ctx.lineTo(x + 5, h / 2 + s * len); ctx.stroke();
  }
});
const bananaTexture = texture(64, 128, (ctx, w, h) => {
  ctx.fillStyle = '#e8f2c4'; ctx.beginPath(); ctx.ellipse(w / 2, h / 2, w / 2 - 2, h / 2 - 2, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#b5c48a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(w / 2, 2); ctx.lineTo(w / 2, h - 2); ctx.stroke();
  ctx.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 7; i++) { const y = rngTex.range(10, h - 10), s = rngTex() > .5 ? 1 : -1; ctx.fillRect(s > 0 ? w / 2 + 6 : 0, y, w / 2 - 6, 1.6); }
});

function trunkGeometry(parts) {
  return mergeGeometries(parts.map(([a, b, r, seg = 7]) => {
    const from = new THREE.Vector3(...a), to = new THREE.Vector3(...b), d = to.clone().sub(from);
    const g = new THREE.CylinderGeometry(r * .55, r, d.length(), seg).toNonIndexed();
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize()));
    g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
    g.deleteAttribute('uv'); return g;
  }), false);
}
function broadleafTrunk(rng, h, spread) {
  const parts = [[[0, 0, 0], [rng.range(-.2, .2), h * .78, rng.range(-.2, .2)], .43, 8]];
  for (let i = 0; i < 5; i++) { const a = i * 1.26 + rng(); parts.push([[Math.cos(a) * .8, .06, Math.sin(a) * .8], [0, .7, 0], .16]); }
  for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2 + rng.range(-.3, .3), r = rng.range(1.1, 2.1) * spread; parts.push([[0, h * .47, 0], [Math.cos(a) * r, h * .8, Math.sin(a) * r], .12]); }
  return trunkGeometry(parts);
}
function giantTrunk(rng, h) {
  const parts = [[[0, 0, 0], [rng.range(-.3, .3), h, rng.range(-.3, .3)], .7, 9]];
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + rng(); parts.push([[Math.cos(a) * 1.5, 0, Math.sin(a) * 1.5], [Math.cos(a) * .2, 1.8, Math.sin(a) * .2], .32, 5]); }
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + rng(), r = rng.range(2.4, 3.6); parts.push([[0, h * .75, 0], [Math.cos(a) * r, h * .95 + rng(), Math.sin(a) * r], .22]); }
  return trunkGeometry(parts);
}
function deadTrunk(rng) {
  const parts = [[[0, 0, 0], [.3, 4.2, .1], .32, 7]];
  for (let i = 0; i < 6; i++) {
    const a = rng() * Math.PI * 2, y = rng.range(2, 4), r = rng.range(1, 2.2), end = [Math.cos(a) * r, y + rng.range(.4, 1.5), Math.sin(a) * r];
    parts.push([[.1, y, 0], end, .08]); parts.push([end, [end[0] * 1.4, end[1] + .6, end[2] * 1.4 + .3], .04, 4]);
  }
  return trunkGeometry(parts);
}
function palmTrunk(lean) {
  const pts = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(lean * .25, 2.5, 0), new THREE.Vector3(lean * .7, 5, 0), new THREE.Vector3(lean, 7, 0)];
  const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 10, .16, 6, false);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const k = 1.25 - p.getY(i) / 7 * .45, cx = lean * (Math.max(0, p.getY(i)) / 7) ** 1.4; p.setX(i, cx + (p.getX(i) - cx) * k); p.setZ(i, p.getZ(i) * k); }
  g.computeVertexNormals(); return { geometry: g, tip: new THREE.Vector3(lean, 7, 0) };
}
function frondCrown(count, length, droop, up = .25) {
  const parts = [];
  for (let i = 0; i < count; i++) {
    const g = new THREE.PlaneGeometry(length, .55, 6, 1), p = g.attributes.position;
    for (let k = 0; k < p.count; k++) { const t = (p.getX(k) + length / 2) / length; p.setX(k, t * length); p.setY(k, p.getY(k) * (1 - t * .5)); p.setZ(k, -droop * t * t + up * t); }
    g.rotateX(-Math.PI / 2 + .25); g.rotateY(i / count * Math.PI * 2 + (i % 2) * .3);
    parts.push(g.toNonIndexed());
  }
  return mergeGeometries(parts, false);
}
function bananaCrown() {
  const parts = [];
  for (let i = 0; i < 7; i++) {
    const g = new THREE.PlaneGeometry(.55, 1.7, 1, 4), p = g.attributes.position;
    for (let k = 0; k < p.count; k++) { const t = (p.getY(k) + .85) / 1.7; p.setY(k, t * 1.4); p.setZ(k, t * t * .9); }
    g.rotateX(-.5); g.rotateY(i / 7 * Math.PI * 2 + i * .2); g.translate(0, 0, 0);
    parts.push(g.toNonIndexed());
  }
  return mergeGeometries(parts, false);
}
function crossPlanes(w, h, n = 3) {
  return mergeGeometries(Array.from({ length: n }, (_, i) => new THREE.PlaneGeometry(w, h).translate(0, h / 2, 0).rotateY(i / n * Math.PI).toNonIndexed()), false);
}

const CARD = 2.5;

export class Vegetation {
  // keep(x, z): optional filter for the map being built; every call still draws
  // the same random numbers, so layouts match between maps.
  constructor(keep = null) {
    const rng = createRng(4242);
    this.rng = rng;
    const InstanceSet = class extends BaseSet { constructor(g, m, o = {}) { super(g, m, { keep, ...o }); } };
    const leaves = () => patchFoliage(mat('#ffffff', { map: leafData, alphaTest: .45, side: THREE.DoubleSide, roughness: .9 }));
    const leafMat = patchMaterial(leaves(), { wind: .16, instanced: true, fade: true });
    const frondMat = patchMaterial(mat('#ffffff', { map: frondTexture, alphaTest: .4, side: THREE.DoubleSide }), { wind: .1, instanced: true, fade: true });
    const bananaMat = patchMaterial(mat('#7da34d', { map: bananaTexture, alphaTest: .4, side: THREE.DoubleSide }), { wind: .14, instanced: true, fade: true });
    const bushMat = patchMaterial(leaves(), { wind: .12, instanced: true });
    this.cards = new InstanceSet(new THREE.PlaneGeometry(CARD, CARD), leafMat);
    this.trunks = [0, 1, 2].map(() => new InstanceSet(broadleafTrunk(rng, 4.4, 1), M.bark));
    this.giants = [0, 1].map(() => new InstanceSet(giantTrunk(rng, 11), M.darkBark));
    this.dead = [0, 1].map(() => new InstanceSet(deadTrunk(rng), M.darkBark));
    this.palms = [.6, 1.4, -.9].map(lean => { const t = palmTrunk(lean); return { set: new InstanceSet(t.geometry, M.palmBark), tip: t.tip }; });
    this.palmCrown = new InstanceSet(frondCrown(10, 2.6, 1.4), frondMat);
    this.sugarCrown = new InstanceSet(frondCrown(16, 1.6, .2, .7), frondMat);
    this.sugarTrunk = new InstanceSet(new THREE.CylinderGeometry(.16, .22, 9, 7).translate(0, 4.5, 0), M.palmBark);
    this.bananaStem = new InstanceSet(new THREE.CylinderGeometry(.09, .14, 1.9, 6).translate(0, .95, 0), mat('#6f7a45'));
    this.bananaCrown = new InstanceSet(bananaCrown(), bananaMat);
    this.bamboo = new InstanceSet(mergeGeometries([new THREE.CylinderGeometry(.05, .065, 1, 5).translate(0, .5, 0).toNonIndexed(),
      ...[.15, .3, .45, .6, .75, .9].map(y => new THREE.CylinderGeometry(.075, .075, .02, 5).translate(0, y, 0).toNonIndexed())], false), mat('#7c855a'));
    this.bushes = new InstanceSet(crossPlanes(1.4, 1.1), bushMat);
    this.ferns = new InstanceSet(frondCrown(8, 1.1, .5, .5), frondMat);
    this.vines = new InstanceSet(new THREE.PlaneGeometry(.35, 3.2).translate(0, -1.6, 0), leafMat, { castShadow: false });
    this.fruit = new InstanceSet(new THREE.IcosahedronGeometry(.11, 0), mat('#ffffff'), { castShadow: false });
    this.obstacles = [];
    this.d = new THREE.Object3D(); this.c = new THREE.Color();
  }
  // Fronds (palm, sugar palm, fern) keep the original palette: their textures carry colour.
  frondColor(dark) {
    const r = this.rng;
    return this.c.setHSL(r.range(.22, .3) + dark * .06, r.range(.17, .32) - dark * .05, r.range(.24, .4) - dark * .14).clone();
  }
  // Forest-map palette: rich, fairly dark greens; `shade` (0 bottom → 1 top of the crown)
  // lightens the outer top so the canopy is self-shaded. Tropical: a touch warmer and
  // brighter than the snowy forest.
  leafColor(dark, shade = .5) {
    const r = this.rng;
    return this.c.setHSL(r.range(.25, .32) + dark * .03, r.range(.38, .52) - dark * .08, .08 + shade * .1 - dark * .04 + r.range(-.02, .02)).clone();
  }
  // Crown of many small leaf clumps (like the forest's broadleaf trees): a dome of
  // `radius` around (x, y, z), flattened by `flat`. `count` is the old card count;
  // clumps are ~3.6× as many and much smaller, scaled by crown area.
  canopy(x, y, z, count, radius, size, dark = 0, flat = .22) {
    // The old big cards overhung the crown by about half a card; small clumps don't, so
    // the dome itself is wider to keep the same silhouette.
    radius *= 1.3;
    const r = this.rng, d = this.d, n = Math.round(count * 3.6), tall = radius * (.72 - flat);
    for (let j = 0; j < n; j++) {
      const a = r() * Math.PI * 2, rr = Math.sqrt(r()), h = r.range(-.7, 1);
      d.position.set(x + Math.cos(a) * rr * radius, y + h * tall * (1 - rr * rr * .5) - radius * .1, z + Math.sin(a) * rr * radius);
      d.rotation.set(-Math.PI / 2 + r.range(-.5, .5) * (1 + rr), r.range(-.5, .5) * (1 + rr), r() * 6.28, 'YXZ');
      d.scale.setScalar(radius * r.range(.4, .62) * Math.max(.75, size / (radius * .38)) / CARD); d.updateMatrix();
      this.cards.addMatrix(d.matrix, this.leafColor(dark, (h + .7) / 1.7 * (1 - rr * .25)));
    }
    d.rotation.order = 'XYZ';
  }
  broadleaf(x, y, z, { s = 1, dark = 0, cards = 34 } = {}) {
    const r = this.rng, h = r.range(4.4, 6.2) * s;
    r.pick(this.trunks).add(x, y, z, { ry: r() * 6.28, s, sy: h / 4.4 });
    this.canopy(x, y + h, z, cards, 2.3 * s, s * 1.15, dark);
    this.obstacles.push([x, z, .55 * s]);
  }
  giant(x, y, z, { s = 1, dark = .7 } = {}) {
    const r = this.rng, h = 11 * s;
    r.pick(this.giants).add(x, y, z, { ry: r() * 6.28, s });
    this.canopy(x, y + h + .8 * s, z, 46, 3.8 * s, s * 1.5, dark, .12);
    this.canopy(x, y + h * .62, z, 10, 2.2 * s, s, dark + .1);
    this.obstacles.push([x, z, .9 * s]);
  }
  fruitTree(x, y, z, { s = 1, fruit = '#d9b23d' } = {}) {
    const r = this.rng;
    r.pick(this.trunks).add(x, y, z, { ry: r() * 6.28, s: s * .65, sy: s * .55 });
    this.canopy(x, y + 3 * s, z, 22, 1.7 * s, .9 * s, -.1, .1);
    for (let i = 0; i < 9; i++) { const a = r() * 6.28, rr = r.range(.6, 1.6) * s; this.fruit.add(x + Math.cos(a) * rr, y + r.range(2.2, 3.4) * s, z + Math.sin(a) * rr, { color: fruit }); }
    this.obstacles.push([x, z, .35 * s]);
  }
  palm(x, y, z, { s = 1, ry = this.rng() * 6.28 } = {}) {
    const p = this.rng.pick(this.palms), q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry);
    p.set.add(x, y, z, { ry, s });
    const tip = p.tip.clone().multiplyScalar(s).applyQuaternion(q);
    this.palmCrown.add(x + tip.x, y + tip.y, z + tip.z, { ry: this.rng() * 6.28, s: s * this.rng.range(.9, 1.1), color: this.frondColor(-.2) });
    this.obstacles.push([x, z, .3 * s]);
  }
  sugarPalm(x, y, z, { s = 1 } = {}) {
    this.sugarTrunk.add(x, y, z, { s, sy: s * this.rng.range(.85, 1.15) });
    this.sugarCrown.add(x, y + 9 * s, z, { ry: this.rng() * 6.28, s: s * 1.2, color: this.frondColor(.1) });
    this.obstacles.push([x, z, .3 * s]);
  }
  banana(x, y, z, { s = 1 } = {}) {
    this.bananaStem.add(x, y, z, { s });
    this.bananaCrown.add(x, y + 1.8 * s, z, { ry: this.rng() * 6.28, s });
  }
  bambooGrove(x, y, z, { n = 9, s = 1, dark = 0 } = {}) {
    const r = this.rng;
    for (let b = 0; b < n; b++) {
      const bx = x + r.range(-.8, .8), bz = z + r.range(-.8, .8), h = r.range(3, 4.8) * s;
      this.bamboo.add(bx, y, bz, { sy: h, rz: r.range(-.12, .12), rx: r.range(-.12, .12) });
      for (let j = 0; j < 8; j++) {
        this.d.position.set(bx + r.range(-.8, .8), y + h * .6 + r.range(0, h * .45), bz + r.range(-.8, .8));
        this.d.scale.set(.6, .15, .25); this.d.rotation.set(0, r.range(0, 6), r.range(-.8, .8)); this.d.updateMatrix();
        this.cards.addMatrix(this.d.matrix, this.c.set('#5d784c').offsetHSL(0, 0, -dark * .1 + r.range(-.04, .04)).clone());
      }
    }
    this.obstacles.push([x, z, .9]);
  }
  deadTree(x, y, z, { s = 1 } = {}) {
    this.rng.pick(this.dead).add(x, y, z, { ry: this.rng() * 6.28, s });
    this.obstacles.push([x, z, .35 * s]);
  }
  bush(x, y, z, { s = 1, dark = 0 } = {}) { this.bushes.add(x, y, z, { ry: this.rng() * 3, s, color: this.leafColor(dark - .1) }); }
  fern(x, y, z, { s = 1, dark = 0 } = {}) { this.ferns.add(x, y + .1, z, { ry: this.rng() * 6, s, color: this.frondColor(dark) }); }
  vine(x, y, z, { s = 1 } = {}) { this.vines.add(x, y, z, { ry: this.rng() * 3, sy: s, color: this.leafColor(.8) }); }
  // Runs fn(veg) on a private random sequence (seed), so a district can add plants
  // without shifting the shared sequence: every later tree keeps its look.
  isolated(seed, fn) {
    const shared = this.rng;
    this.rng = createRng(seed);
    try { return fn(this); } finally { this.rng = shared; }
  }
  build(scene) {
    let n = 0;
    for (const set of [this.cards, ...this.trunks, ...this.giants, ...this.dead, ...this.palms.map(p => p.set), this.palmCrown, this.sugarCrown, this.sugarTrunk,
      this.bananaStem, this.bananaCrown, this.bamboo, this.bushes, this.ferns, this.vines, this.fruit]) n += set.build(scene).length;
    return n;
  }
}
