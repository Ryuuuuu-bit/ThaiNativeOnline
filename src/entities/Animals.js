import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mat } from '../world/materials.js';
import { cyl, ball, beam } from '../world/Architecture.js';
import { mergeObject } from '../world/Batching.js';
import { PADDIES } from '../world/CityMap.js';
import { createRng } from '../world/rng.js';

const merged = parts => mergeGeometries(parts.map(g => { const n = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(n.attributes)) if (!['position', 'normal'].includes(k)) n.deleteAttribute(k); return n; }), false);

function buffaloTemplate() {
  const g = new THREE.Group(), body = mat('#4a4a47'), horn = mat('#8d8574');
  ball(g, body, 0, .95, 0, .55, .5, 1);
  ball(g, body, 0, 1.05, .95, .32, .3, .42);
  for (const s of [-1, 1]) {
    beam(g, horn, [s * .15, 1.3, 1.05], [s * .6, 1.35, .85], .06, 5); beam(g, horn, [s * .6, 1.35, .85], [s * .62, 1.55, .6], .045, 5);
    for (const z of [-.55, .55]) cyl(g, body, s * .28, .35, z, .1, .08, .7, 6);
  }
  beam(g, body, [0, 1.05, -.95], [0, .55, -1.15], .04, 4);
  return mergeObject(g);
}

export class Animals {
  constructor(scene, ctx) {
    const rng = createRng(2024), dummy = this.dummy = new THREE.Object3D();
    // Chickens around homes.
    const spots = ctx.chickenSpots.slice(0, 22);
    const bodyGeo = merged([new THREE.SphereGeometry(.16, 8, 6).scale(1, .9, 1.3).translate(0, .22, 0), new THREE.SphereGeometry(.09, 6, 5).translate(0, .38, .16), new THREE.ConeGeometry(.08, .2, 5).rotateX(-1).translate(0, .3, -.2)]);
    const combGeo = merged([new THREE.BoxGeometry(.03, .06, .08).translate(0, .48, .16), new THREE.ConeGeometry(.025, .07, 4).rotateX(Math.PI / 2).translate(0, .38, .27)]);
    this.chickens = [];
    const count = spots.length * 3;
    this.chickenBody = new THREE.InstancedMesh(bodyGeo, mat('#ffffff'), count); this.chickenComb = new THREE.InstancedMesh(combGeo, mat('#b8352a'), count);
    spots.forEach(([x, z]) => {
      for (let k = 0; k < 3; k++) {
        const i = this.chickens.length;
        this.chickens.push({ cx: x, cz: z, x: x + rng.range(-1, 1), z: z + rng.range(-1, 1), tx: x, tz: z, yaw: 0, peck: 0, wait: rng() * 3 });
        this.chickenBody.setColorAt(i, new THREE.Color(rng.pick(['#f1ece0', '#a9643a', '#6b3d22', '#d8c3a0'])));
      }
    });
    for (const m of [this.chickenBody, this.chickenComb]) { m.castShadow = true; m.frustumCulled = false; scene.add(m); }

    // Water buffalo: a few in the pen, some resting in the fields.
    const template = buffaloTemplate();
    this.buffalo = [];
    const add = (x, z, area) => { const o = template.clone(); scene.add(o); this.buffalo.push({ o, x, z, area, tx: x, tz: z, yaw: rng() * 6, wait: rng() * 5 }); };
    for (const pen of ctx.pens) for (let i = 0; i < 3; i++) add(pen.x + rng.range(-2, 2), pen.z + rng.range(-1.5, 1.5), { x: pen.x, z: pen.z, rx: pen.rx, rz: pen.rz });
    for (const [x, z] of [[-50, -176], [-78, -212], [-35, -245]]) add(x, z, { x, z, rx: 5, rz: 3 });

    // Egrets stand in the paddies; small flocks circle over the fields by day.
    const egretGeo = merged([new THREE.SphereGeometry(.13, 7, 5).scale(1, .9, 1.6).translate(0, .45, 0), new THREE.CylinderGeometry(.025, .03, .35, 4).rotateX(.4).translate(0, .66, .14), new THREE.SphereGeometry(.05, 5, 4).translate(0, .84, .2),
      new THREE.CylinderGeometry(.012, .012, .35, 3).translate(.04, .17, 0), new THREE.CylinderGeometry(.012, .012, .35, 3).translate(-.04, .17, 0)]);
    const wet = PADDIES.filter(p => p.state !== 'ripe');
    this.egrets = new THREE.InstancedMesh(egretGeo, mat('#f4f1e8'), 26); this.egrets.castShadow = true;
    this.egretData = [];
    for (let i = 0; i < 26; i++) { const p = rng.pick(wet); this.egretData.push({ x: rng.range(p.x0 + .5, p.x1 - .5), z: rng.range(p.z0 + .5, p.z1 - .5), yaw: rng() * 6, phase: rng() * 6 }); }
    scene.add(this.egrets);
    const birdGeo = new THREE.BufferGeometry();
    birdGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, .15, -.45, .08, -.1, 0, 0, -.05, 0, 0, .15, 0, 0, -.05, .45, .08, -.1], 3)); birdGeo.computeVertexNormals();
    this.birds = new THREE.InstancedMesh(birdGeo, mat('#2f2c28', { side: THREE.DoubleSide }), 24); this.birds.frustumCulled = false; scene.add(this.birds);
    this.birdSeed = Array.from({ length: 24 }, (_, i) => [i < 12 ? [-60, -190] : [60, -60], rng.range(10, 22), rng.range(.08, .14), rng() * 6, rng.range(11, 16)]);
    this.terrain = ctx.terrain;
  }
  update(t, dt, focus, env) {
    const d = this.dummy, h = (x, z) => this.terrain.height(x, z), near = (x, z, r) => Math.abs(x - focus.x) < r && Math.abs(z - focus.z) < r;
    this.chickens.forEach((c, i) => {
      if (near(c.x, c.z, 70)) {
        c.wait -= dt;
        if (c.wait < 0) { c.tx = c.cx + (Math.random() - .5) * 5; c.tz = c.cz + (Math.random() - .5) * 5; c.wait = 2 + Math.random() * 4; }
        const dx = c.tx - c.x, dz = c.tz - c.z, dist = Math.hypot(dx, dz);
        if (dist > .1) { c.x += dx / dist * dt * .9; c.z += dz / dist * dt * .9; c.yaw = Math.atan2(dx, dz); c.peck = 0; } else c.peck += dt;
      }
      const hidden = env.night > .6;
      d.position.set(c.x, h(c.x, c.z), c.z); d.rotation.set(c.peck > 0 ? Math.max(0, Math.sin(c.peck * 6)) * .6 : Math.sin(t * 14 + i) * .05, c.yaw, 0);
      d.scale.setScalar(hidden ? 0 : 1); d.updateMatrix();
      this.chickenBody.setMatrixAt(i, d.matrix); this.chickenComb.setMatrixAt(i, d.matrix);
    });
    this.chickenBody.instanceMatrix.needsUpdate = this.chickenComb.instanceMatrix.needsUpdate = true;
    for (const b of this.buffalo) {
      if (near(b.x, b.z, 80)) {
        b.wait -= dt;
        if (b.wait < 0) { b.tx = b.area.x + (Math.random() - .5) * 2 * b.area.rx; b.tz = b.area.z + (Math.random() - .5) * 2 * b.area.rz; b.wait = 6 + Math.random() * 8; }
        const dx = b.tx - b.x, dz = b.tz - b.z, dist = Math.hypot(dx, dz);
        if (dist > .2) { b.x += dx / dist * dt * .35; b.z += dz / dist * dt * .35; const yaw = Math.atan2(dx, dz); b.yaw += Math.atan2(Math.sin(yaw - b.yaw), Math.cos(yaw - b.yaw)) * Math.min(1, dt * 1.5); }
      }
      b.o.position.set(b.x, h(b.x, b.z) + Math.sin(t * 1.4 + b.x) * .02, b.z); b.o.rotation.y = b.yaw;
    }
    this.egretData.forEach((e, i) => {
      d.position.set(e.x, -.2, e.z); d.rotation.set(Math.max(0, Math.sin(t * .7 + e.phase)) ** 6 * .9, e.yaw + Math.sin(t * .2 + e.phase) * .5, 0);
      d.scale.setScalar(env.night > .5 ? 0 : 1); d.updateMatrix(); this.egrets.setMatrixAt(i, d.matrix);
    });
    this.egrets.instanceMatrix.needsUpdate = true;
    this.birdSeed.forEach(([[cx, cz], r, speed, phase, height], i) => {
      const a = t * speed + phase, x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r * .7;
      d.position.set(x, height + Math.sin(t + i) * .5, z); d.rotation.set(0, a + Math.PI, Math.sin(t * 8 + i) * .5);
      d.scale.setScalar(env.night > .5 ? 0 : 1.2); d.updateMatrix(); this.birds.setMatrixAt(i, d.matrix);
    });
    this.birds.instanceMatrix.needsUpdate = true;
  }
}
