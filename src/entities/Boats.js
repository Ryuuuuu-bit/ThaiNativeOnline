import * as THREE from 'three';
import { M, mat } from '../world/materials.js';
import { box, cyl, cone, ball, beam } from '../world/Architecture.js';
import { mergeObject } from '../world/Batching.js';
import { WATER_Y, riverBank, farBank } from '../world/CityMap.js';

// Thai river craft built from an extruded side profile tapered at both ends.
function hullGeometry(L, B, H, U) {
  const h = L / 2, s = new THREE.Shape();
  s.moveTo(-h, H + U); s.quadraticCurveTo(-h * .82, 0, -h * .5, 0); s.lineTo(h * .5, 0); s.quadraticCurveTo(h * .82, 0, h, H + U);
  s.lineTo(h * .86, H + U * .55); s.quadraticCurveTo(h * .6, H, h * .4, H); s.lineTo(-h * .4, H); s.quadraticCurveTo(-h * .6, H, -h * .86, H + U * .55); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: B, bevelEnabled: false, curveSegments: 8 });
  g.translate(0, 0, -B / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const k = 1 - Math.min(1, Math.abs(p.getX(i)) / h) ** 2.2 * .92; p.setZ(i, p.getZ(i) * k); }
  g.rotateY(Math.PI / 2); g.computeVertexNormals();
  return g;
}
const skin = mat('#b98a64'), hatMat = mat('#c9b07a');
function figure(g, x, y, z, { shirt = M.cloth.indigo, hat = true, sit = false, ry = 0 } = {}) {
  const f = new THREE.Group(); f.position.set(x, y, z); f.rotation.y = ry; g.add(f);
  cyl(f, shirt, 0, sit ? .35 : .55, 0, .14, .2, sit ? .5 : .7, 7);
  ball(f, skin, 0, sit ? .75 : 1.05, 0, .16);
  if (hat) cone(f, hatMat, 0, sit ? .92 : 1.22, 0, .36, .18, 10);
  return f;
}
const deckMat = M.darkWood;

const TYPES = {
  sampan: () => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(hullGeometry(5, 1.1, .42, .38), M.teak));
    box(g, deckMat, 0, .43, 0, .6, .02, 3.2);
    for (const z of [-1.2, 1.2]) box(g, M.wood, 0, .38, z, .9, .05, .14);
    return g;
  },
  vendor: () => {
    const g = TYPES.sampan();
    for (let i = 0; i < 4; i++) { cyl(g, M.thatch, 0, .5, -1.2 + i * .75, .24, .18, .18, 8); ball(g, [M.cloth.yellow, M.cloth.red, M.moss, M.cloth.yellow][i], 0, .6, -1.2 + i * .75, .17, .08, .17); }
    figure(g, 0, .4, 1.6, { shirt: M.cloth.blue, sit: true, ry: Math.PI });
    beam(g, M.wood, [0, .7, 1.5], [.5, .1, 3.2], .025);
    return g;
  },
  fishing: () => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(hullGeometry(6, 1.3, .45, .45), M.teak));
    box(g, deckMat, 0, .46, 0, .75, .02, 4);
    box(g, M.net, 0, .55, -1.3, .8, .14, .9);
    figure(g, 0, .45, .9, { shirt: M.cloth.cream, sit: true });
    beam(g, M.darkWood, [.2, .9, 1.1], [1.8, 2.4, 3.6], .02, 4);
    return g;
  },
  barge: () => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(hullGeometry(13, 3.4, 1.05, .7), M.teak));
    box(g, deckMat, 0, 1.06, 0, 2.2, .03, 9);
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.45, 6.5, 14, 1, true, -Math.PI / 2, Math.PI), M.thatch);
    roof.rotation.x = Math.PI / 2; roof.position.set(0, 1.1, -.6); roof.castShadow = true; g.add(roof);
    for (let i = 0; i < 5; i++) ball(g, mat('#c7b289'), (i % 2 - .5) * .9, 1.35, 3.6 + (i > 2 ? .6 : 0) - (i % 3) * .5, .32, .26, .4);
    figure(g, 0, 1.06, -5.2, { shirt: M.cloth.cream });
    beam(g, M.wood, [0, 1.5, -5.4], [0, .2, -7.4], .05);
    return g;
  },
  ferry: () => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(hullGeometry(8, 2.6, .6, .45), M.teak));
    box(g, M.woodLight, 0, .62, 0, 1.9, .06, 5.6);
    for (const x of [-.85, .85]) for (const z of [-2.2, 0, 2.2]) cyl(g, M.darkWood, x, 1.5, z, .05, .05, 1.8, 5);
    box(g, M.cloth.red, 0, 2.42, 0, 2.2, .06, 5.2);
    for (const x of [-.75, .75]) box(g, M.woodLight, x, .85, 0, .3, .08, 4.6);
    figure(g, 0, .6, -3.2, { shirt: M.cloth.indigo });
    return g;
  },
  junk: () => {
    // A foreign trading junk (สำเภา): large hull, deck house and batten sails.
    const g = new THREE.Group();
    g.add(new THREE.Mesh(hullGeometry(22, 6, 2.4, 1.6), M.woodRed));
    box(g, deckMat, 0, 2.42, 0, 4.4, .05, 15);
    box(g, M.woodRed, 0, 3.3, -7, 4, 1.8, 3.4); box(g, M.gold, 0, 3.3, -8.72, 3, .6, .06);
    box(g, M.teak, 0, 2.9, 5, 3.6, 1, 4);
    for (const [z, h] of [[-2, 13], [4.5, 10]]) {
      cyl(g, M.darkWood, 0, 2.4 + h / 2, z, .14, .18, h, 7);
      const sail = new THREE.Mesh(new THREE.PlaneGeometry(5.4, h * .62), mat('#9c5a3a', { side: THREE.DoubleSide }));
      sail.position.set(0, 2.4 + h * .55, z + .2); sail.rotation.y = Math.PI / 2 + .2; sail.castShadow = true; g.add(sail);
      for (let k = 0; k < 6; k++) box(g, M.darkWood, 0, 2.4 + h * .27 + k * h * .62 / 5.5, z + .25, .08, .05, 5.4, .2);
    }
    box(g, M.cloth.red, 0, 15.6, -2, .02, .5, 1.4);
    return g;
  },
};
const cache = new Map();
function makeBoat(type) {
  let template = cache.get(type);
  if (!template) cache.set(type, template = mergeObject(TYPES[type]()));
  return template.clone();
}

export class Boats {
  constructor(scene, ctx) {
    this.list = [];
    const add = (type, x, z, rot, opts = {}) => {
      const object = makeBoat(type); object.position.set(x, WATER_Y, z); object.rotation.y = rot; scene.add(object);
      const boat = { object, type, x, z, rot, phase: Math.random() * 6, y: opts.y ?? WATER_Y - (type === 'junk' ? .9 : type === 'barge' ? .45 : .15), ...opts };
      this.list.push(boat); return boat;
    };
    const b = riverBank;
    add('junk', -15.6, b(-22) + 10, 0);
    add('barge', 30, b(30) + 18.4, Math.PI / 2 + .04);
    add('barge', -28.5, b(-22) + 9, .03);
    add('ferry', 8.9, b(6) + 11, 0, { ferry: { a: b(6) + 11, b: farBank(8.9) - 5, wait: 14, t: 0 } });
    for (const [x, dz, r] of [[-38, 2.2, 1.5], [-6, 2.6, 1.7], [46, 2.4, 1.5], [57, 2, 1.65], [-56, 2.2, 1.4]]) add('sampan', x, b(x) + dz, r);
    add('fishing', -94.2, b(-96) + 5, .05);
    add('fishing', -100, b(-100) - 1.2, .3, { y: ctx.terrain.height(-100, b(-100) - 1.2) - .25, beached: true });
    add('sampan', -89, b(-89) - .9, -.25, { y: ctx.terrain.height(-89, b(-89) - .9) - .2, beached: true });
    add('fishing', -70, 192, .6, { anchored: true }); add('fishing', -42, 199, -.4, { anchored: true });
    for (const [x, r] of [[-12, Math.PI / 2 + .1], [10, Math.PI / 2 - .08], [24, Math.PI / 2 + .05], [-24, Math.PI / 2]]) add('vendor', x, -10.4 + Math.sin(x) * .6, r);
    // River traffic loops along lanes; one fishing boat returns to the village.
    add('barge', -140, 197, Math.PI / 2, { lane: { z: 197, speed: 1.4, dir: 1 } });
    add('barge', 90, 214, -Math.PI / 2, { lane: { z: 214, speed: 1.1, dir: -1 } });
    add('sampan', 40, 188, -Math.PI / 2, { lane: { z: 188, speed: 2.6, dir: -1 } });
    add('sampan', -60, 226, Math.PI / 2, { lane: { z: 226, speed: 2.2, dir: 1 } });
    add('fishing', -150, 205, 0, { route: { pts: [[-150, 208], [-118, 196], [-96, b(-96) + 11.5]], wait: 26, t: 0, leg: 0, forward: true } });
  }
  update(t, dt) {
    for (const boat of this.list) {
      const o = boat.object;
      if (boat.lane) {
        boat.x += boat.lane.dir * boat.lane.speed * dt;
        if (boat.x > 160) boat.x = -160; if (boat.x < -160) boat.x = 160;
        o.position.x = boat.x; o.position.z = boat.lane.z + Math.sin(t * .05 + boat.phase) * 2;
      } else if (boat.ferry) {
        const f = boat.ferry, span = Math.abs(f.b - f.a), travel = span / 2.2;
        f.t = (f.t + dt) % ((travel + f.wait) * 2);
        let k = f.t < f.wait ? 0 : f.t < f.wait + travel ? (f.t - f.wait) / travel : f.t < f.wait * 2 + travel ? 1 : 1 - (f.t - f.wait * 2 - travel) / travel;
        k = k * k * (3 - 2 * k);
        o.position.z = f.a + (f.b - f.a) * k; o.position.x = boat.x;
        boat.docked = k === 0;
      } else if (boat.route) {
        const r = boat.route, pts = r.forward ? r.pts : [...r.pts].reverse();
        if (r.t > 0) { r.t -= dt; }
        else {
          const [tx, tz] = pts[r.leg + 1], dx = tx - boat.x, dz = tz - boat.z, d = Math.hypot(dx, dz);
          if (d < .3) { r.leg++; if (r.leg >= pts.length - 1) { r.leg = 0; r.forward = !r.forward; r.t = r.wait; } }
          else { const step = Math.min(d, dt * 2.4); boat.x += dx / d * step; boat.z += dz / d * step; o.rotation.y = Math.atan2(dx, dz); }
        }
        o.position.x = boat.x; o.position.z = boat.z;
      }
      if (boat.beached) { o.position.y = boat.y; continue; }
      o.position.y = boat.y + Math.sin(t * 1.3 + boat.phase) * .045;
      o.rotation.z = Math.sin(t * 1.1 + boat.phase) * .025; o.rotation.x = Math.sin(t * .9 + boat.phase * 2) * .015;
    }
  }
}
