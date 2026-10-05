import * as THREE from 'three';

// Base anatomy and reusable garment helpers. Sections are [d, rx, rz, zoff, xoff]
// along each chain (see RigBuilder.tube). Rest landmarks: hips joint y .90,
// shoulders y 1.355, wrists .835, knees .46, ankles .07, head joint 1.49.
export const TORSO = { bones: ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head'], end: [0, 1.56, 0] };
export const TORSO_SECTIONS = [
  [-.15, .05, .045, -.01], [-.12, .118, .085, -.012], [-.06, .148, .1, -.016], [.02, .142, .092, -.004],
  [.13, .126, .082, .006], [.23, .138, .088, .01], [.32, .156, .099, .014], [.39, .165, .1, .012],
  [.45, .162, .09, 0], [.495, .125, .072, -.01], [.53, .056, .056, -.004], [.6, .047, .05, .002], [.64, .045, .046, 0],
];
export const ARM = s => ({ bones: [`${s}Arm`, `${s}ForeArm`], end: null });
export const ARM_SECTIONS = [
  [-.06, .018, .018], [-.045, .04, .042], [-.02, .056, .058], [.01, .062, .06, -.004], [.06, .058, .056], [.13, .05, .053, .004],
  [.22, .044, .045], [.27, .041, .042, -.004], [.32, .045, .044], [.42, .035, .033], [.51, .029, .025],
];
export const LEG_SECTIONS = [
  [-.07, .065, .065], [0, .088, .088, .004], [.08, .085, .087, .008], [.2, .073, .076, .006], [.33, .056, .058, .004],
  [.4, .05, .052], [.47, .051, .055, -.012], [.55, .048, .054, -.014], [.68, .034, .036, -.004], [.78, .03, .03],
];
export const FOOT_SECTIONS = [[0, .03, .025], [.02, .04, .036], [.08, .043, .037], [.14, .046, .03], [.18, .043, .024], [.21, .032, .015]];
export const HEAD_SECTIONS = [
  [0, .02, .02, .052], [.02, .046, .044, .045], [.05, .074, .074, .03], [.09, .095, .097, .012],
  [.13, .103, .108, 0], [.18, .105, .112, -.008], [.23, .093, .1, -.012], [.27, .062, .07, -.012], [.295, .02, .025, -.012],
];
export const HEAD_PTS = [[0, 1.45, .0], [0, 1.76, -.01]];

export const grow = (sections, dr, dz = 0) => sections.map(([d, rx, rz, z = 0, x = 0]) => [d, rx + dr, rz + dr, z + dz, x]);
export const slice = (sections, d0, d1) => {
  const at = d => {
    let k = 0; while (k < sections.length - 2 && d > sections[k + 1][0]) k++;
    const a = sections[k], b = sections[k + 1], u = THREE.MathUtils.clamp((d - a[0]) / (b[0] - a[0]), 0, 1), sm = u * u * (3 - 2 * u);
    return [d, ...[1, 2, 3, 4].map(j => THREE.MathUtils.lerp(a[j] ?? 0, b[j] ?? 0, sm))];
  };
  return [at(d0), ...sections.filter(s => s[0] > d0 && s[0] < d1), at(d1)];
};

const armEnd = (rb, s) => rb.restPos(`${s}Hand`);
const legEnd = (rb, s) => rb.restPos(`${s}Foot`);
export const SIDES = [['Left', 1], ['Right', -1]];

export function buildBody(rb, m, { baggy = 0 } = {}) {
  rb.tube(TORSO.bones, TORSO.end, TORSO_SECTIONS, m.torso, { radial: 24, step: .015, vScale: 1 / .79 });
  rb.tube(['Head'], null, HEAD_SECTIONS, m.skin, { pts: HEAD_PTS, radial: 22, step: .012 });
  for (const [s, k] of SIDES) {
    rb.tube(ARM(s).bones, armEnd(rb, s), ARM_SECTIONS, m.skin, { startParent: `${s}Shoulder`, blend: .05, radial: 14 });
    hand(rb, s, k, m.skin);
    rb.tube([`${s}UpLeg`, `${s}Leg`], legEnd(rb, s), LEG_SECTIONS, m.skin, { startParent: 'Hips', blend: .05, radial: 16 });
    foot(rb, s, k, m.skin);
    // Ear
    rb.rigid('Head', new THREE.SphereGeometry(.03, 10, 8), m.skin, { pos: [k * .1, .085, -.005], scale: [.45, 1, .75] });
  }
  face(rb, m);
  // Sphere colliders keep hanging cloth outside the body.
  rb.collider('Hips', [0, -.04, -.01], .12);
  rb.collider('Spine2', [0, .02, .01], .135);
  rb.collider('Head', [0, .12, 0], .11);
  for (const [s] of SIDES) {
    // `baggy` widens the leg colliders to the trousers' silhouette.
    rb.collider(`${s}UpLeg`, [0, -.08, .005], .085 + baggy * .6); rb.collider(`${s}UpLeg`, [0, -.26, .005], .07 + baggy);
    rb.collider(`${s}Leg`, [0, -.12, -.01], .056 + baggy * .8); rb.collider(`${s}Leg`, [0, -.28, 0], .042 + baggy * .4);
  }
}

export function hand(rb, s, k, mat, grow = 0) {
  const h = rb.restPos(`${s}Hand`), f2 = rb.restPos(`${s}HandFingers2`);
  rb.tube([`${s}Hand`, `${s}HandFingers1`, `${s}HandFingers2`], [f2.x, f2.y - .045, f2.z],
    [[-.01, .018 + grow, .026 + grow], [.02, .021 + grow, .038 + grow], [.07, .02 + grow, .043 + grow], [.1, .016 + grow, .04 + grow], [.16, .012 + grow, .034 + grow], [.175, .006, .02]],
    mat, { hint: [0, 0, 1], blend: .015, radial: 10, step: .012 });
  const t = rb.restPos(`${s}HandThumb1`);
  rb.tube([`${s}HandThumb1`], [t.x + k * .0, t.y - .045, t.z + .025], [[0, .014 + grow, .014 + grow], [.03, .012 + grow, .012 + grow], [.055, .006, .006]], mat, { radial: 8, step: .012 });
}
export function foot(rb, s, k, mat, grow = 0, toeCap = true) {
  const a = rb.restPos(`${s}Foot`);
  rb.tube([`${s}Foot`, `${s}ToeBase`], null, grow ? FOOT_SECTIONS.map(([d, x, z]) => [d, x + grow, z + grow, grow * .5]) : FOOT_SECTIONS, mat,
    { pts: [[a.x, .035, -.055], [a.x, .033, .105], [a.x, .03, .16]], hint: [0, 1, 0], blend: .02, radial: 12, step: .015, capEnd: toeCap });
}

function face(rb, m) {
  for (const k of [1, -1]) {
    rb.rigid('Head', new THREE.SphereGeometry(.024, 14, 10), m.eye, { pos: [k * .041, .095, .093], rot: [0, k * .38, 0], scale: [.8, 1.12, .32] });
    rb.rigid('Head', new THREE.SphereGeometry(.007, 6, 6), m.eyeWhite, { pos: [k * .036 + .006, .104, .1] });
    rb.rigid('Head', new THREE.BoxGeometry(.05, .007, .012), m.hair, { pos: [k * .043, .128, .1], rot: [0, k * .35, k * -.12] });
  }
  rb.rigid('Head', new THREE.ConeGeometry(.012, .03, 6), m.skin, { pos: [0, .07, .112], rot: [.35, 0, 0] });
  rb.rigid('Head', new THREE.TorusGeometry(.016, .0032, 4, 10, Math.PI * .7), m.lip, { pos: [0, .05, .103], rot: [-.25, 0, Math.PI * 1.15] });
}

// Spiky anime hair: a cap plus cones radiating from the skull.
export function hair(rb, m, { cap = .016, spikes = [], capFrom = .16, back = true } = {}) {
  rb.tube(['Head'], null, slice(grow(HEAD_SECTIONS, cap, -.006), capFrom, .3), m.hair, { pts: HEAD_PTS, radial: 22, step: .012, capStart: false });
  if (back) rb.rigid('Head', new THREE.SphereGeometry(.1, 14, 10), m.hair, { pos: [0, .08, -.05], scale: [1.02, 1.05, .75] });
  const C = new THREE.Vector3(0, .135, -.012), up = new THREE.Vector3(0, 1, 0);
  for (const [az, el, len, rad, droop = .3] of spikes) {
    const a = az * Math.PI / 180, e = el * Math.PI / 180;
    const d = new THREE.Vector3(Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e));
    const tipDir = d.clone().add(new THREE.Vector3(0, -droop, 0)).normalize();
    const base = C.clone().addScaledVector(d, .09);
    const g = new THREE.ConeGeometry(rad, len, 5); g.translate(0, len / 2, 0);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(up, tipDir)); g.translate(base.x, base.y, base.z);
    rb.rigidMatrix('Head', g, m.hair, new THREE.Matrix4());
  }
}
// Deterministic messy spikes: a ring of bangs, sides and back tufts.
export function messySpikes(seed = 1, { bangs = 7, length = 1, top = 9 } = {}) {
  let x = seed * 9301; const rnd = () => (x = (x * 16807) % 2147483647) / 2147483647;
  const out = [];
  for (let i = 0; i < bangs; i++) out.push([-50 + i * 100 / (bangs - 1) + rnd() * 8, 30 + rnd() * 10, (.075 + rnd() * .035) * length, .026, 1.25 + rnd() * .35]);
  for (let i = 0; i < 10; i++) { const az = 60 + i * 24 + rnd() * 10; out.push([az, 5 + rnd() * 25, (.09 + rnd() * .06) * length, .035, .7 + rnd() * .6]); out.push([-az, 5 + rnd() * 25, (.09 + rnd() * .06) * length, .035, .7 + rnd() * .6]); }
  for (let i = 0; i < top; i++) out.push([rnd() * 360, 50 + rnd() * 30, (.08 + rnd() * .06) * length, .035, .1 + rnd() * .3]);
  return out;
}

// ---- Garment helpers -------------------------------------------------------
export function torsoWear(rb, mat, d0, d1, extra = .012, opts = {}) {
  rb.tube(TORSO.bones, TORSO.end, slice(grow(TORSO_SECTIONS, extra), d0, d1), mat, { radial: 24, step: .015, capStart: false, capEnd: false, ...opts });
}
export function torsoBand(rb, mat, d, opts = {}) { rb.band(TORSO.bones, TORSO.end, TORSO_SECTIONS, mat, { d, ...opts }); }
export function armWear(rb, s, mat, d0, d1, extra = .01, opts = {}) {
  rb.tube(ARM(s).bones, armEnd(rb, s), slice(grow(ARM_SECTIONS, extra), d0, d1), mat, { startParent: `${s}Shoulder`, blend: .05, radial: 14, capStart: false, capEnd: false, ...opts });
}
export function armBand(rb, s, mat, d, opts = {}) { rb.band(ARM(s).bones, armEnd(rb, s), ARM_SECTIONS, mat, { d, radial: 16, ...opts }); }
export function legWear(rb, s, mat, sections, opts = {}) {
  rb.tube([`${s}UpLeg`, `${s}Leg`], legEnd(rb, s), sections, mat, { startParent: 'Hips', blend: .05, radial: 16, capStart: false, capEnd: false, ...opts });
}
export function legBand(rb, s, mat, d, opts = {}) { rb.band([`${s}UpLeg`, `${s}Leg`], legEnd(rb, s), LEG_SECTIONS, mat, { d, radial: 18, ...opts }); }
// Baggy trousers: flare outward from the leg, gathered at d1.
export function baggy(d0, d1, puff = .05, cuff = .012) {
  const out = [];
  for (let i = 0; i <= 10; i++) {
    const d = THREE.MathUtils.lerp(d0, d1, i / 10), u = i / 10;
    const base = slice(LEG_SECTIONS, d, d)[0];
    const add = u > .85 ? cuff + (1 - (u - .85) / .15) * puff * .4 : cuff + puff * Math.sin(Math.min(1, u / .85) * Math.PI * .85 + .3);
    out.push([d, base[1] + add, base[2] + add, base[3], base[4]]);
  }
  return out;
}
// Hanging cloth panel on a spring chain, e.g. sash ends and loincloths.
export function panel(rb, parent, start, dir, { width = .12, length = .4, segs = 4, mat, taper = 1, stiffness = 1.4, gravity = 1, drag = .35, widthDir, name = 'Panel', radius = .02, bulge = 0 }) {
  const d = new THREE.Vector3(...dir).normalize();
  const wd = widthDir || (() => { const w = new THREE.Vector3(0, 1, 0).cross(d); if (w.lengthSq() < 1e-4) w.set(1, 0, 0); return w.normalize().toArray(); })();
  const chain = rb.springChain(parent, start, d.toArray(), length / segs, segs, { stiffness, gravity, drag, name, radius });
  rb.ribbon(chain, wd, width, mat, { taper, bulge });
  return chain;
}
// A panel that starts on the waist surface at a given angle around the body.
export function waistPanel(rb, angle, opts) {
  const a = angle * Math.PI / 180, r = opts.r ?? .19;
  const start = [Math.sin(a) * r * (opts.rx ?? 1.05), opts.y ?? .86, Math.cos(a) * r * .72 - .01];
  const out = new THREE.Vector3(Math.sin(a), 0, Math.cos(a)).multiplyScalar(opts.flare ?? .2);
  const dir = [out.x, -1, out.z];
  return panel(rb, opts.parent || 'Hips', start, dir, { widthDir: [Math.cos(a), 0, -Math.sin(a)], ...opts });
}
export function tassel(rb, parent, start, { length = .14, mat, capMat, radius = .012, segs = 3, stiffness = 1.1, dir = [0, -1, 0] }) {
  const chain = rb.springChain(parent, start, dir, length / segs, segs, { stiffness, name: 'Tassel', radius: .012 });
  rb.strand(chain, radius * .5, mat, { tipRadius: radius * 1.3 });
  if (capMat) rb.rigid(parent, new THREE.SphereGeometry(radius * 1.1, 8, 6), capMat, { pos: start, local: false });
  return chain;
}
// Braided ring (mongkhon, prajiad, rope belts): torus around a point on a bone.
export function ring(rb, bone, center, radius, tube, mat, rot = [Math.PI / 2, 0, 0], scale = [1, 1, 1]) {
  return rb.rigid(bone, new THREE.TorusGeometry(radius, tube, 8, 28), mat, { pos: center, rot, scale, local: false });
}
export function beads(rb, bone, center, rx, rz, count, size, mats, { tilt = 0, yDrop = 0, local = false } = {}) {
  for (let i = 0; i < count; i++) {
    const a = i / count * Math.PI * 2, front = Math.cos(a);
    const p = [center[0] + Math.sin(a) * rx, center[1] - Math.max(0, front) * yDrop + Math.sin(a) * tilt, center[2] + front * rz];
    rb.rigid(bone, new THREE.SphereGeometry(size, 7, 5), mats[i % mats.length], { pos: p, local });
  }
}
