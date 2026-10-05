import * as THREE from 'three';

// Hunter's companion: a Thai ridgeback-style dog with its own small rig of
// joint groups, animated procedurally (trot cycle, sit, tail wag, command dash).
const mat = (c, r = .8) => new THREE.MeshStandardMaterial({ color: c, roughness: r });
function part(parent, geo, material, pos, rot = [0, 0, 0], scale = [1, 1, 1]) {
  const m = new THREE.Mesh(geo, material); m.position.set(...pos); m.rotation.set(...rot); m.scale.set(...scale);
  m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
}
function joint(parent, pos) { const g = new THREE.Group(); g.position.set(...pos); parent.add(g); return g; }

export class Dog {
  constructor(m) {
    const fur = mat('#c38a52'), light = mat('#ead6b6'), dark = mat('#2a1b14', .4), scarf = mat('#34573b'), gold = m?.gold || mat('#c9a052', .4);
    this.root = new THREE.Group(); this.root.name = 'Companion Dog';
    this.body = joint(this.root, [0, .5, 0]);
    part(this.body, new THREE.CapsuleGeometry(.13, .36, 6, 12), fur, [0, 0, 0], [Math.PI / 2, 0, 0], [1, 1.05, 1]);
    part(this.body, new THREE.SphereGeometry(.12, 12, 8), light, [0, -.04, .14], [0, 0, 0], [.85, .9, 1.2]);
    part(this.body, new THREE.CylinderGeometry(.03, .03, .32, 6), mat('#a8723f'), [0, .12, -.02], [Math.PI / 2, 0, 0], [1.6, 1, .5]);
    this.neck = joint(this.body, [0, .06, .24]);
    part(this.neck, new THREE.CylinderGeometry(.075, .1, .2, 10), fur, [0, .07, .03], [-.6, 0, 0]);
    part(this.neck, new THREE.TorusGeometry(.095, .022, 6, 16), scarf, [0, .02, .02], [Math.PI / 2 - .5, 0, 0]);
    part(this.neck, new THREE.ConeGeometry(.08, .14, 3), scarf, [0, -.06, .1], [Math.PI + .3, 0, 0], [1, 1, .3]);
    part(this.neck, new THREE.CylinderGeometry(.022, .022, .006, 10), gold, [0, -.06, .13], [Math.PI / 2 - .3, 0, 0]);
    this.head = joint(this.neck, [0, .17, .08]);
    part(this.head, new THREE.SphereGeometry(.09, 12, 10), fur, [0, 0, 0], [0, 0, 0], [1, .9, 1.05]);
    part(this.head, new THREE.CylinderGeometry(.04, .055, .12, 10), fur, [0, -.025, .1], [Math.PI / 2, 0, 0]);
    part(this.head, new THREE.SphereGeometry(.022, 8, 6), dark, [0, -.01, .165]);
    this.jaw = joint(this.head, [0, -.05, .06]);
    part(this.jaw, new THREE.BoxGeometry(.06, .02, .1), light, [0, 0, .04]);
    for (const k of [1, -1]) {
      part(this.head, new THREE.SphereGeometry(.014, 8, 6), dark, [k * .045, .025, .07]);
      part(this.head, new THREE.ConeGeometry(.04, .11, 4), fur, [k * .05, .1, -.02], [-.15, 0, -k * .25], [1, 1, .45]);
    }
    this.legs = [];
    for (const [x, z, front] of [[.08, .2, true], [-.08, .2, true], [.08, -.2, false], [-.08, -.2, false]]) {
      const hip = joint(this.body, [x, -.04, z]);
      part(hip, new THREE.CapsuleGeometry(.04, .14, 4, 8), fur, [0, -.1, front ? 0 : -.02], [front ? 0 : .25, 0, 0]);
      const knee = joint(hip, [0, -.2, front ? 0 : -.05]);
      part(knee, new THREE.CapsuleGeometry(.028, .16, 4, 8), front ? fur : fur, [0, -.1, 0]);
      part(knee, new THREE.SphereGeometry(.035, 8, 6), light, [0, -.22, .025], [0, 0, 0], [1, .6, 1.4]);
      this.legs.push({ hip, knee, front, side: Math.sign(x) });
    }
    this.tail = []; let parent = joint(this.body, [0, .06, -.27]);
    for (let i = 0; i < 4; i++) { const seg = joint(parent, [0, 0, i ? -.07 : 0]); part(seg, new THREE.CapsuleGeometry(.025 - i * .004, .06, 4, 6), fur, [0, 0, -.035], [Math.PI / 2, 0, 0]); this.tail.push(seg); parent = seg; }
    this.phase = 0; this.speed = 0; this.sit = 0; this.still = 0; this.time = 0;
    this.dash = null; this.bark = 0; this.heading = 0;
  }
  command() { this.dash = { t: 0 }; }
  update(dt, owner, ownerSpeed = 0) {
    this.time += dt;
    // Follow a spot beside the owner, or dash ahead on command.
    const target = new THREE.Vector3(-.75, 0, .15);
    if (this.dash) {
      this.dash.t += dt; target.set(-.2, 0, this.dash.t < 1.6 ? 2.6 : .15);
      if (this.dash.t > 1.1 && this.dash.t < 1.6) this.bark = 1;
      if (this.dash.t > 2.8) this.dash = null;
    }
    owner.root.localToWorld(target);
    const to = target.sub(this.root.position); to.y = 0;
    const dist = to.length();
    const want = dist > .12 ? Math.min(dist * 3.2, this.dash ? 5.5 : Math.max(4.2, ownerSpeed * 1.2)) : 0;
    this.speed = THREE.MathUtils.damp(this.speed, want, 6, dt);
    if (dist > .05 && this.speed > .05) {
      to.normalize(); this.root.position.addScaledVector(to, Math.min(dist, this.speed * dt));
      const yaw = Math.atan2(to.x, to.z); let d = yaw - this.heading; d = Math.atan2(Math.sin(d), Math.cos(d));
      this.heading += d * Math.min(1, dt * 8);
    } else {
      const face = owner.root.rotation.y + (this.dash ? 0 : .5); let d = face - this.heading; d = Math.atan2(Math.sin(d), Math.cos(d)); this.heading += d * Math.min(1, dt * 3);
    }
    this.root.rotation.y = this.heading;
    this.still = this.speed < .1 ? this.still + dt : 0;
    this.sit = THREE.MathUtils.damp(this.sit, this.still > 1.5 && !this.dash ? 1 : 0, 4, dt);
    // Trot/gallop cycle: diagonal leg pairs, stride ~0.55 m.
    this.phase = (this.phase + dt * this.speed / .55) % 1;
    const move = THREE.MathUtils.clamp(this.speed / 1.5, 0, 1), gallop = THREE.MathUtils.clamp((this.speed - 3) / 2, 0, 1);
    const s = this.sit;
    this.body.position.y = .5 - s * .12 + move * Math.abs(Math.sin(this.phase * Math.PI * 2)) * .03;
    this.body.rotation.x = -s * .55 + gallop * Math.sin(this.phase * Math.PI * 2) * .08;
    this.body.position.z = -s * .06;
    for (const [i, leg] of this.legs.entries()) {
      const off = gallop > .5 ? (leg.front ? 0 : .5) + (leg.side > 0 ? .1 : 0) : (i === 0 || i === 3 ? 0 : .5);
      const p = (this.phase + off) * Math.PI * 2, swing = Math.sin(p) * .55 * move, lift = Math.max(0, Math.cos(p)) * .7 * move;
      if (leg.front) { leg.hip.rotation.x = swing + s * .55; leg.knee.rotation.x = -lift * .4; }
      else { leg.hip.rotation.x = swing - s * 1.15; leg.knee.rotation.x = lift + s * 1.9; }
    }
    this.neck.rotation.x = -s * .1 + move * .15 + Math.sin(this.time * 2) * .02;
    const look = this.bark > 0 ? Math.sin(this.time * 30) * .12 : 0;
    this.head.rotation.x = (s > .5 ? -.35 : 0) + look; this.jaw.rotation.x = this.bark > 0 ? .25 + Math.sin(this.time * 30) * .2 : .05 + move * .15;
    this.bark = Math.max(0, this.bark - dt * 2);
    const wag = this.dash || s > .5 ? 12 : 5;
    this.tail.forEach((t, i) => { t.rotation.x = .75 - i * .12 - move * .35; t.rotation.y = Math.sin(this.time * wag - i * .6) * (.25 + i * .05); });
  }
}
