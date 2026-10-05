import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { InstanceSet } from './Batching.js';
import { M, mat } from './materials.js';

// Repeated small props are instanced per chunk. A prop is one or more parts;
// parts flagged `tint` take the per-instance colour (fruit, rocks, flowers).
const lathe = (points, seg = 12) => new THREE.LatheGeometry(points.map(([x, y]) => new THREE.Vector2(x, y)), seg);
const merge = (...geometries) => mergeGeometries(geometries.map(g => (g.index ? g.toNonIndexed() : g)).map(g => { for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k); return g; }), false);
const at = (g, x, y, z, rx = 0, ry = 0, rz = 0) => { g.rotateX(rx); g.rotateY(ry); g.rotateZ(rz); g.translate(x, y, z); return g; };

const woven = mat('#a5824f', { side: THREE.DoubleSide }), tint = mat('#ffffff'), tintFlat = mat('#ffffff', { flatShading: true });
const leaf = mat('#ffffff', { side: THREE.DoubleSide });

const PARTS = {
  jar: [lathe([[0, 0], [.22, 0], [.34, .15], [.38, .32], [.33, .5], [.22, .6], [.2, .66], [.24, .7], [.17, .7]], 14), mat('#7a4630', { roughness: .55 })],
  pot: [lathe([[0, 0], [.14, 0], [.22, .1], [.2, .2], [.12, .27], [.14, .3], [.1, .3]], 10), M.clayLight],
  basket: [lathe([[0, 0], [.2, 0], [.27, .18], [.28, .22]], 10), woven],
  pile: [at(new THREE.DodecahedronGeometry(.22, 0), 0, 0, 0).scale(1, .45, 1), tint, true],
  sack: [at(new THREE.CapsuleGeometry(.19, .22, 3, 8), 0, .2, 0, 0, 0, Math.PI / 2).scale(1, .75, 1), mat('#c7b289')],
  crate: [new THREE.BoxGeometry(.65, .55, .65).translate(0, .275, 0), mat('#8a6a45')],
  rope: [at(new THREE.TorusGeometry(.2, .065, 5, 12), 0, .07, 0, Math.PI / 2), M.rope],
  hay: [merge(new THREE.ConeGeometry(1, 1.3, 10).translate(0, .95, 0), new THREE.CylinderGeometry(1, 1.05, .35, 10).translate(0, .17, 0)), M.hay],
  log: [at(new THREE.CylinderGeometry(.3, .34, 4, 8), 0, .28, 0, 0, 0, Math.PI / 2), M.darkBark],
  rock: [new THREE.DodecahedronGeometry(1, 0), tintFlat, true],
  stump: [new THREE.CylinderGeometry(.35, .45, .5, 8).translate(0, .25, 0), M.bark],
  slab: [merge(new THREE.BoxGeometry(.6, .8, .14).translate(0, .4, 0), new THREE.CylinderGeometry(.3, .3, .14, 10, 1, false, 0, Math.PI).rotateX(Math.PI / 2).rotateZ(Math.PI / 2).translate(0, .8, 0)), tint, true],
  urn: [merge(new THREE.BoxGeometry(.9, .35, .9).translate(0, .17, 0), lathe([[0, 0], [.38, 0], [.36, .12], [.3, .35], [.18, .55], [.1, .62], [.08, .9], [0, .95]], 8).translate(0, .35, 0)), tint, true],
  merlon: [merge(new THREE.BoxGeometry(.7, .5, .55).translate(0, .25, 0), new THREE.ConeGeometry(.42, .55, 4).rotateY(Math.PI / 4).scale(1, 1, .8).translate(0, .77, 0)), tint, true],
  lotusPad: [new THREE.CircleGeometry(.3, 10).rotateX(-Math.PI / 2), mat('#5f7d4b', { side: THREE.DoubleSide })],
  lotus: [merge(...Array.from({ length: 7 }, (_, i) => { const a = i / 7 * Math.PI * 2; return new THREE.SphereGeometry(1, 6, 4).scale(.04, .1, .045).rotateZ(Math.sin(a) * .6).rotateX(Math.cos(a) * .6).translate(Math.cos(a) * .08, .06, Math.sin(a) * .08); })), mat('#e2b6ad')],
  herb: [new THREE.ConeGeometry(.22, .45, 5).translate(0, .22, 0), tint, true],
  flower: [new THREE.IcosahedronGeometry(.07, 0).translate(0, .32, 0), tint, true],
  candle: [new THREE.CylinderGeometry(.03, .03, .16, 6).translate(0, .08, 0), M.candle],
  torch: [merge(new THREE.CylinderGeometry(.03, .03, .8, 5).translate(0, .4, 0), new THREE.CylinderGeometry(.06, .04, .16, 6).translate(0, .82, 0)), M.wood],
  fishDry: [new THREE.BoxGeometry(.06, .3, .1).translate(0, -.15, 0), mat('#a39b85')],
  trap: [lathe([[0, 0], [.18, .02], [.16, .35], [.08, .7], [0, .74]], 8).rotateZ(Math.PI / 2).translate(-.37, .18, 0), woven],
  mortar: [lathe([[0, 0], [.2, 0], [.22, .18], [.16, .22], [0, .12]], 10), M.stoneDark],
  bench: [merge(new THREE.BoxGeometry(1.6, .08, .5).translate(0, .45, 0), ...[[-.7, -.18], [.7, -.18], [-.7, .18], [.7, .18]].map(([x, z]) => new THREE.BoxGeometry(.07, .45, .07).translate(x, .22, z))), M.woodLight],
  barrel: [new THREE.CylinderGeometry(.32, .3, .8, 10).translate(0, .4, 0), mat('#6b4a2e')],
  anvil: [merge(new THREE.CylinderGeometry(.3, .36, .55, 8).translate(0, .27, 0), new THREE.BoxGeometry(.7, .2, .28).translate(0, .66, 0), new THREE.ConeGeometry(.12, .3, 4).rotateZ(-Math.PI / 2).translate(.48, .68, 0)), M.iron],
  ore: [new THREE.OctahedronGeometry(.18, 0), M.spiritFlame],
  coal: [new THREE.DodecahedronGeometry(.4, 0).scale(1, .45, 1), mat('#262420', { flatShading: true })],
  mooring: [merge(new THREE.CylinderGeometry(.14, .16, 1.4, 7).translate(0, .3, 0), new THREE.TorusGeometry(.17, .04, 4, 8).rotateX(Math.PI / 2).translate(0, .75, 0)), M.darkWood],
};
// Composite props: [part, x, y, z, scale].
const PROPS = {
  fruitBasket: [['basket'], ['pile', 0, .2, 0, .95]],
  fishBasket: [['basket'], ['pile', 0, .2, 0, .95, '#9aa3a2']],
  bigJar: [['jar', 0, 0, 0, 1.6]],
};

export class PropLibrary {
  // keep(x, z): optional filter for the map being built (see StaticBatcher).
  constructor(keep = null) { this.keep = keep; this.sets = new Map(); this.m = new THREE.Matrix4(); this.p = new THREE.Matrix4(); this.e = new THREE.Euler(); this.q = new THREE.Quaternion(); }
  set(part) {
    let s = this.sets.get(part);
    if (!s) {
      const [geometry, material, , ] = PARTS[part];
      this.sets.set(part, s = new InstanceSet(geometry, material, { castShadow: !['lotusPad', 'lotus', 'flower', 'candle', 'fishDry'].includes(part) }));
    }
    return s;
  }
  add(name, x, y, z, { ry = 0, rx = 0, rz = 0, s = 1, sx, sy, sz, color } = {}, whole = false) {
    if (this.keep && !whole && !this.keep(x, z)) return;
    const parts = PROPS[name] ?? [[name]];
    this.e.set(rx, ry, rz); this.q.setFromEuler(this.e);
    this.m.compose(new THREE.Vector3(x, y, z), this.q, new THREE.Vector3(sx ?? s, sy ?? s, sz ?? s));
    for (const [part, ox = 0, oy = 0, oz = 0, ps = 1, fixed] of parts) {
      if (!PARTS[part]) { console.warn('Unknown prop', part); continue; }
      this.p.makeScale(ps, ps, ps).setPosition(ox, oy, oz).premultiply(this.m);
      this.set(part).addMatrix(this.p, PARTS[part][2] ? (fixed ?? color ?? '#ffffff') : undefined);
    }
  }
  build(scene) { let n = 0; for (const s of this.sets.values()) n += s.build(scene).length; return n; }
}
