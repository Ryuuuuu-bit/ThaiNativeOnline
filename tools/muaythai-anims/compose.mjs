// Builds the Muay Thai skill animations from the fighter's existing Tripo clips.
import { load, sample, clone, blend, worldPos, worldQuat, rotWorld, writeAnim, legIK, fist, hingeLimb, THREE } from './lib.mjs';
const R = await load(process.argv[2] ?? 'fighter-tripo.glb');
const find = re => Object.values(R.anims).find(a => re.test(a.getName()));
const JAB = find(/quick lead-hand jab/), COMBO = find(/jab-cross/), TEEP = find(/teep/), KICK = find(/front_kick/), WALK = find(/^walk/), RUN = find(/^run/);
const B = n => 'mixamorig:' + n;
const sampleAnim = (a, t) => sample(R, a, t);
const HIPS = R.byName[B('Hips')];
const FPS = 30, TAU = Math.PI * 2;

// --- poses -----------------------------------------------------------------
const G = sample(R, TEEP, 0);                       // orthodox guard
const hip0 = G.get(HIPS).t.clone();
const pin = p => { const h = p.get(HIPS).t; h.x = hip0.x; h.z = hip0.z; return p; };
const at = (anim, t) => pin(sample(R, anim, t));
const P = { G };
// Point bone->child along a world direction (blend w).
function aim(p, bone, child, dir, w = 1) {
  const a = worldPos(R, p, B(bone)), b = worldPos(R, p, B(child));
  const cur = b.sub(a).normalize(), want = new THREE.Vector3(...dir).normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(cur, want);
  const axis = new THREE.Vector3(q.x, q.y, q.z); const s = axis.length(); if (s < 1e-6) return p;
  rotWorld(R, p, B(bone), axis.divideScalar(s).toArray(), 2 * Math.atan2(s, q.w) * w); return p;
}
// Limbs are posed as hinges (lib.mjs hingeLimb): elbows/knees never bend sideways or backwards.
const arm = (p, side, upper, fore) => { const S = side === 'L' ? 'Left' : 'Right'; hingeLimb(R, p, B, S + 'Arm', S + 'ForeArm', S + 'Hand', upper, fore); return p; };
const leg = (p, side, upper, lower) => { const S = side === 'L' ? 'Left' : 'Right'; hingeLimb(R, p, B, S + 'UpLeg', S + 'Leg', S + 'Foot', upper, lower); return p; };
const bend = (p, ax, bone = 'Spine1') => { rotWorld(R, p, B(bone), [1, 0, 0], ax); return p; };
const yaw = (p, a, bone = 'Spine1') => { rotWorld(R, p, B(bone), [0, 1, 0], a); return p; };
const lift = (p, h) => { p.get(HIPS).t.y += h; return p; };
const mk = (base, fn) => fn(clone(base));

// --- poses built from the rest skeleton (T-pose, facing +Z, left = +X) --------------
// Units: the rig is ~0.97 tall, so 0.054 ≈ 10 cm on the 1.8 m fighter.
const REST = new Map(R.nodes.map(n => [n, { t: new THREE.Vector3(...n.getTranslation()), r: new THREE.Quaternion(...n.getRotation()), s: new THREE.Vector3(...n.getScale()) }]));
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
const qY = a => new THREE.Quaternion().setFromAxisAngle(v3(0, 1, 0), a);
const restFootQ = side => worldQuat(R, REST, R.byName[B(side + 'Foot')]);
const REST_FOOT_Y = worldPos(R, REST, B('LeftFoot')).y;
// Foot orientation: toes turned `yawTo` (rad, + = toward +X) from straight ahead, heel raised by `heel` (rad) pivoting on the ball.
const toeYaw0 = side => { const a = worldPos(R, REST, B(side + 'Foot')), b = worldPos(R, REST, B(side + 'ToeBase')); return Math.atan2(b.x - a.x, b.z - a.z); };
function footQ(side, yawTo, heel = 0) {
  const turn = qY(yawTo - toeYaw0(side));
  const dir = v3(Math.sin(yawTo), 0, Math.cos(yawTo)), axis = dir.clone().cross(v3(0, 1, 0)).normalize();
  return new THREE.Quaternion().setFromAxisAngle(axis, -heel).multiply(turn).multiply(restFootQ(side));
}
// Two-bone arm IK: wrist to `target`, elbow toward `pole` (world dir), as a hinge.
function armIK(p, side, target, pole) {
  const S = side === 'L' ? 'Left' : 'Right';
  const sh = worldPos(R, p, B(S + 'Arm')), a = worldPos(R, REST, B(S + 'Arm')).distanceTo(worldPos(R, REST, B(S + 'ForeArm'))), b = worldPos(R, REST, B(S + 'ForeArm')).distanceTo(worldPos(R, REST, B(S + 'Hand')));
  const to = target.clone().sub(sh), d = Math.min(to.length(), a + b - 1e-4), n = to.normalize();
  const along = (a * a - b * b + d * d) / (2 * d), h = Math.sqrt(Math.max(0, a * a - along * along));
  const pl = v3(...pole); pl.sub(n.clone().multiplyScalar(pl.dot(n))).normalize();
  const elbow = sh.clone().add(n.clone().multiplyScalar(along)).add(pl.multiplyScalar(h)), wrist = sh.clone().add(n.clone().multiplyScalar(d));
  hingeLimb(R, p, B, S + 'Arm', S + 'ForeArm', S + 'Hand', elbow.clone().sub(sh).toArray(), wrist.clone().sub(elbow).toArray());
  return p;
}
// Hand in line with the forearm (straight wrist), rolled so the palm faces `palm` (world
// dir); `flex` then bends the wrist (− = back, e.g. the wai).
const PALM_LOCAL = {};
function hand(p, side, palm, flex = 0) {
  const S = side === 'L' ? 'Left' : 'Right', node = R.byName[B(S + 'Hand')];
  if (!PALM_LOCAL[S]) PALM_LOCAL[S] = v3(0, -1, 0).applyQuaternion(worldQuat(R, REST, node).invert());   // T-pose: palms down
  const fore = worldPos(R, p, B(S + 'Hand')).sub(worldPos(R, p, B(S + 'ForeArm'))).normalize();
  // straighten: knuckles along the forearm
  const kn = worldPos(R, p, B(S + 'HandMiddle1')).sub(worldPos(R, p, B(S + 'Hand'))).normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(kn, fore), ax = v3(q.x, q.y, q.z), sl = ax.length();
  if (sl > 1e-7) rotWorld(R, p, B(S + 'Hand'), ax.divideScalar(sl).toArray(), 2 * Math.atan2(sl, q.w));
  // roll about the forearm so the palm faces `palm`
  const cur = PALM_LOCAL[S].clone().applyQuaternion(worldQuat(R, p, node));
  const pj = v => v.clone().sub(fore.clone().multiplyScalar(v.dot(fore))).normalize();
  // pronation/supination happens in the forearm: split the roll between the forearm
  // (≤ 55°) and the hand, and never more than a real forearm turns (~±120° in all)
  const roll = THREE.MathUtils.clamp(Math.atan2(pj(cur).cross(pj(v3(...palm))).dot(fore), pj(cur).dot(pj(v3(...palm)))), -2.1, 2.1);
  const foreRoll = THREE.MathUtils.clamp(roll * 0.5, -0.95, 0.95);
  rotWorld(R, p, B(S + 'ForeArm'), fore.toArray(), foreRoll);
  rotWorld(R, p, B(S + 'Hand'), fore.toArray(), -foreRoll);   // keep the hand where it was…
  rotWorld(R, p, B(S + 'Hand'), fore.toArray(), roll);        // …then turn it the whole way
  if (flex) { const ax2 = fore.clone().cross(v3(...palm)).normalize(); rotWorld(R, p, B(S + 'Hand'), ax2.toArray(), flex); }
  return p;
}
// Torso: hips at `hip` (world), turned `hipYaw`; spine turns a further `twist` and leans
// `lean` forward; the head turns back so the eyes stay on the target (+Z), chin `chin` down.
function torso(p, { hip, hipYaw = 0, twist = 0, lean = 0, side = 0, chin = 0, look = 1 }) {
  p.get(HIPS).t.copy(hip);
  rotWorld(R, p, B('Hips'), [0, 1, 0], hipYaw);
  if (side) rotWorld(R, p, B('Hips'), [0, 0, 1], side);
  yaw(p, twist * .5, 'Spine'); yaw(p, twist * .5, 'Spine1');
  // lean toward the target (+Z), blended a little toward the chest's own forward
  const chestF = v3(Math.sin(hipYaw + twist), 0, Math.cos(hipYaw + twist)), fwd = v3(0, 0, 1).lerp(chestF, 0.3).normalize(), lat = v3(0, 1, 0).cross(fwd).normalize();
  rotWorld(R, p, B('Spine'), lat.toArray(), lean * .4); rotWorld(R, p, B('Spine1'), lat.toArray(), lean * .35); rotWorld(R, p, B('Spine2'), lat.toArray(), lean * .25);
  // the head turns back toward the target, as far as a neck can (±75°)
  const off = Math.atan2(Math.sin(hipYaw + twist), Math.cos(hipYaw + twist)), turnBack = -THREE.MathUtils.clamp(off, -1.3, 1.3) * look;
  rotWorld(R, p, B('Neck'), [0, 1, 0], turnBack * .45); rotWorld(R, p, B('Head'), [0, 1, 0], turnBack * .45);
  const hl = v3(1, 0, 0);
  rotWorld(R, p, B('Neck'), hl.toArray(), chin * .5 - lean * .5); rotWorld(R, p, B('Head'), hl.toArray(), chin * .5 - lean * .3);
  return p;
}

// --- procedural fighter --------------------------------------------------------------
// A whole pose from a few numbers (orthodox: left foot and left hand lead). Skills key
// these numbers over time and every frame is rebuilt from them, so hands travel on
// straight paths and come back the way they went out.
//   hip: [x, drop, z]  hipYaw / twist / lean / side / chin (rad), look (head toward the target, 0..1)
//   L / R feet: { x, z, yaw, heel, up, pole, point }   Lh / Rh hands: { at: [x, y, z] from the head (world axes), pole, palm, sh (shoulder raise), flex }
//   fist: [left, right] curl 0..1
const HIP0 = worldPos(R, REST, B('Hips'));
const STANCE = {
  hip: [-0.005, 0.02, -0.03], hipYaw: -0.45, twist: -0.12, lean: 0.1, side: 0, chin: 0.2,
  L: { x: 0.075, z: 0.095, yaw: -0.12, heel: 0, up: 0 },
  R: { x: -0.085, z: -0.11, yaw: -0.72, heel: 0.32, up: 0 },
  Lh: { at: [0.035, -0.055, 0.135], pole: [0.35, -1, -0.1], palm: [-0.8, 0, -0.55], sh: 0 },
  Rh: { at: [-0.06, -0.07, 0.065], pole: [-0.2, -1, 0.05], palm: [0.55, 0, 0.83], sh: 0 },
  look: 1, fist: [1, 1],
};
function fighter(c) {
  const p = clone(REST);
  torso(p, { hip: HIP0.clone().add(v3(c.hip[0], -c.hip[1], c.hip[2])), hipYaw: c.hipYaw, twist: c.twist, lean: c.lean, side: c.side, chin: c.chin, look: c.look ?? 1 });
  // feet: planted ({x, z, yaw, heel, up}) or lifted (up > 0): the knee bends toward
  // `pole` and the foot relaxes on the shin; `point` extends the ankle along the shin.
  for (const S of ['Left', 'Right']) {
    const f = c[S[0]];
    const at = v3(f.x, REST_FOOT_Y + (f.up ?? 0) + Math.sin(f.heel ?? 0) * 0.055, f.z);
    legIK(R, p, B, S, at, footQ(S, f.yaw, f.heel ?? 0), f.pole ?? [Math.sin(f.yaw), 0, Math.cos(f.yaw)]);
    // a foot off the floor relaxes to its neutral angle on the shin (not kept level)
    const air = THREE.MathUtils.smoothstep(f.up ?? 0, 0.04, 0.14);
    if (air > 0) {
      const ft = R.byName[B(S + 'Foot')], par = worldQuat(R, p, R.parent.get(ft)), now = par.clone().multiply(p.get(ft).r);
      const neutral = par.clone().multiply(REST.get(ft).r), w = now.slerp(neutral, air);
      p.get(ft).r.copy(par.invert().multiply(w)).normalize();
    }
    if (f.point) {                                   // ankle extended: the foot follows the shin
      const sh = worldPos(R, p, B(S + 'Foot')).sub(worldPos(R, p, B(S + 'Leg'))).normalize();
      const toe = worldPos(R, p, B(S + 'ToeBase')).sub(worldPos(R, p, B(S + 'Foot'))).normalize();
      const want = toe.clone().lerp(sh, f.point).normalize(), q = new THREE.Quaternion().setFromUnitVectors(toe, want), ax = v3(q.x, q.y, q.z), sl = ax.length();
      if (sl > 1e-7) rotWorld(R, p, B(S + 'Foot'), ax.divideScalar(sl).toArray(), 2 * Math.atan2(sl, q.w));
    }
  }
  const head = worldPos(R, p, B('Head'));
  for (const [S, h] of [['L', c.Lh], ['R', c.Rh]]) {
    if (h.sh) rotWorld(R, p, B((S === 'L' ? 'Left' : 'Right') + 'Shoulder'), [0, 0, 1], S === 'L' ? h.sh : -h.sh);
    armIK(p, S, head.clone().add(v3(...h.at)), h.pole);
    hand(p, S, h.palm, h.flex ?? 0);
  }
  const fk = c.fist ?? [1, 1];
  if (fk[0] > .01) fist(R, p, B, 'Left', fk[0]);
  if (fk[1] > .01) fist(R, p, B, 'Right', fk[1]);
  return p;
}
// Deep-interpolate two parameter sets.
const mix = (a, b, u) => Array.isArray(a) ? a.map((x, i) => mix(x, b[i], u)) : typeof a === 'object' ? Object.fromEntries(Object.keys(a).map(k => [k, mix(a[k], b[k] ?? a[k], u)])) : a + (b - a) * u;
// Override a parameter set: withP(base, {...}) merges nested objects.
const withP = (base, o) => { const r = JSON.parse(JSON.stringify(base)); for (const [k, v] of Object.entries(o)) r[k] = (v && typeof v === 'object' && !Array.isArray(v)) ? { ...r[k], ...v } : v; return r; };
// Fill defaults so every key has the same fields (poles follow the foot when not given).
function norm(c) {
  const r = JSON.parse(JSON.stringify(c));
  for (const k of ['L', 'R']) { const f = r[k]; f.up ??= 0; f.heel ??= 0; f.point ??= 0; f.pole ??= [Math.sin(f.yaw), 0, Math.cos(f.yaw)]; }
  for (const k of ['Lh', 'Rh']) { const h = r[k]; h.sh ??= 0; h.flex ??= 0; }
  r.side ??= 0; r.look ??= 1; r.fist ??= [1, 1];
  return r;
}
// Every clip starts and ends in this guard, so the bone-posed clips use it too.
P.G = fighter({ ...STANCE, fist: [0, 0] });
// keys: [t, params, ease]; extra(t, params) may tweak the params per frame (a bounce, a
// foot lifting on a step); post(t, pose) may change the finished pose (the fall in 'die').
function buildP(name, dur, keys, extra, post) {
  return build(name, dur, keys.map(([t, c, e]) => [t, norm(c), e]), null, (t, k, u) => { let c = mix(k.a, k.b, u); if (extra) c = extra(t, c) ?? c; const pz = fighter(c); post?.(t, pz); return pz; });
}

// --- composer ----------------------------------------------------------------
// Feet and knees never go through the floor: a sinking foot is put back on the
// floor with leg IK (the knee bends), and if a knee would still be under it the
// whole body rises.
const GROUND = { foot: Math.min(worldPos(R, G, B('LeftFoot')).y, worldPos(R, G, B('RightFoot')).y), toe: Math.min(worldPos(R, G, B('LeftToeBase')).y, worldPos(R, G, B('RightToeBase')).y) };
const FLAT = { Left: worldQuat(R, G, R.byName[B('LeftFoot')]), Right: worldQuat(R, G, R.byName[B('RightFoot')]) };
// The trunk never lies flat: a head kick leans the body back ~45-60°, not 90°.
// Anything past `max` degrees from vertical is taken back by the spine (split
// between the lower and upper spine), so the kicking leg keeps its line.
function capLean(p, max) {
  for (let i = 0; i < 4; i++) { // the spine pivots above the hips, so a few passes converge
    const v = worldPos(R, p, B('Neck')).sub(worldPos(R, p, B('Hips'))), up = new THREE.Vector3(0, 1, 0);
    const extra = v.angleTo(up) - THREE.MathUtils.degToRad(max); if (extra <= .005) return;
    const axis = v.clone().cross(up).normalize().toArray();
    rotWorld(R, p, B('Spine'), axis, extra * .6); rotWorld(R, p, B('Spine1'), axis, extra * .5);
  }
}
function groundFeet(p) {
  for (const S of ['Left', 'Right']) {
    const f = worldPos(R, p, B(S + 'Foot')), toe = worldPos(R, p, B(S + 'ToeBase'));
    if (f.y < GROUND.foot - 0.002 || toe.y < GROUND.toe - 0.004) legIK(R, p, B, S, new THREE.Vector3(f.x, Math.max(f.y, GROUND.foot), f.z), FLAT[S]);
  }
  const low = Math.min(...['LeftLeg', 'RightLeg'].map(n => worldPos(R, p, B(n)).y), ...['LeftToeBase', 'RightToeBase'].map(n => worldPos(R, p, B(n)).y - GROUND.toe + 0.03));
  if (low < 0.03) lift(p, 0.03 - low);
}
// Clips where the fighter's hands are closed fists (not the wai or falling).
// Clips posed from bones (not the procedural fighter, which curls its own fists).
const FISTS = new Set(['boxer_drum', 'boxer_iron']);
const ease = u => u * u * (3 - 2 * u);
const easeIn = u => u * u * u;                 // accelerate into a hit
const easeOut = u => 1 - Math.pow(1 - u, 2.4); // decelerate into a wind-up
// keys: [t, pose]; fx(t, pose) applies time-based overlays (spin, jump).
function build(name, dur, keys, fx, gen) {
  const frames = [];
  for (let i = 0; i <= Math.round(dur * FPS); i++) {
    const t = i / FPS; let k = 0; while (k < keys.length - 1 && keys[k + 1][0] <= t) k++;
    const [t0, a] = keys[k], [t1, b, e = ease] = keys[Math.min(k + 1, keys.length - 1)];
    const u = t1 > t0 ? e(Math.min(1, (t - t0) / (t1 - t0))) : 0;
    const p = gen ? gen(t, { a, b }, u) : blend(a, b, u); fx?.(t, p);
    if (name !== 'die') capLean(p, 58);
    groundFeet(p);
    if (FISTS.has(name)) { fist(R, p, B, 'Left'); fist(R, p, B, 'Right'); }
    frames.push(p);
  }
  return writeAnim(R, name, frames, FPS);
}
const spinY = (p, a) => rotWorld(R, p, B('Hips'), [0, 1, 0], a);
const bump = (t, c, w) => Math.max(0, 1 - Math.abs(t - c) / w);               // triangle 0..1
const arcLift = (t, t0, t1, h) => (t > t0 && t < t1 ? Math.sin(Math.PI * (t - t0) / (t1 - t0)) * h : 0);

// Loops
// Muay Thai rhythm: the weight rocks back onto the rear leg and forward again once a
// second (hips dip as they pass over the knees), the light lead foot taps up on the way
// back, the hips turn a touch with it and the gloves drift in small circles.
buildP('idle', 2, [[0, STANCE], [2, STANCE]], (t, c) => {
  const w = TAU * t / 1, back = (1 - Math.cos(w)) / 2;
  c.hip[2] -= 0.012 * back; c.hip[1] += 0.01 * Math.sin(w) ** 2; c.hipYaw -= 0.04 * back; c.twist -= 0.02 * Math.sin(w);
  c.L.up += 0.016 * Math.max(0, Math.sin(w - 0.6)) ** 2;
  c.Lh.at = c.Lh.at.map((x, i) => x + [0.006 * Math.cos(w + 0.5), 0.008 * Math.sin(w + 0.5), 0][i]);
  c.Rh.at = c.Rh.at.map((x, i) => x + [0.004 * Math.cos(w + 2.3), 0.005 * Math.sin(w + 2.3), 0][i]);
});
// Skills
// Straight punches, boxing form: the punching arm drives straight out at the
// target (+Z) to almost full extension, fist level with the shoulder; that
// shoulder rises to cover the chin; the other fist stays at the chin; the torso
// turns only as much as the punch needs (jab ~15°, cross ~35°) and leans in a little.
// หมัดแย็บ, three jabs (hits at 0.2 / 0.4 / 0.62 s). The lead fist goes straight out
// along the line to the target and comes back on the same line; it turns palm-down
// only in the last part of the punch. The hips and shoulders turn the lead side in
// (hips ~10°, shoulders ~20° more), the lead shoulder rises to cover the chin, the
// rear glove stays on the cheek and the head moves a little off the line. The third
// jab steps in: the lead foot slides ~10 cm forward and the rear foot follows.
const JAB_OUT = withP(STANCE, { hip: [-0.02, 0.026, -0.012], hipYaw: -0.6, twist: -0.32, lean: 0.14,
  Lh: { at: [0.0, -0.035, 0.33], pole: [1, -0.35, 0], palm: [0.15, -1, 0], sh: 0.16 }, Rh: { at: [-0.05, -0.06, 0.07], pole: [-0.2, -1, 0.1], palm: [0.55, 0, 0.83], sh: 0 } });
const JAB_MID = mix(STANCE, JAB_OUT, 0.35);   // half way back: the double jab starts from here
const LOAD = withP(STANCE, { hip: [0.0, 0.03, -0.04], hipYaw: -0.4 });
const step = (c, dz) => withP(c, { L: { ...c.L, z: c.L.z + dz }, R: { ...c.R, z: c.R.z + dz * 0.7 }, hip: [c.hip[0], c.hip[1], c.hip[2] + dz * 0.8] });
const JAB_STEP = withP(step(JAB_OUT, 0.055), { lean: 0.17, hipYaw: -0.64, twist: -0.36 });
buildP('boxer_jab', 1.0, [
  [0, STANCE], [0.12, LOAD, easeOut], [0.2, JAB_OUT, easeIn], [0.23, JAB_OUT],
  [0.31, JAB_MID, easeOut], [0.4, JAB_OUT, easeIn], [0.43, JAB_OUT],
  [0.52, step(LOAD, 0.03), easeOut], [0.62, JAB_STEP, easeIn], [0.66, JAB_STEP],
  [0.8, step(STANCE, 0.03), easeOut], [1.0, STANCE, ease],
], (t, c) => {
  // the lead foot slides (heel-toe) rather than lifting high on the step
  if (t > 0.5 && t < 0.64) c.L.up += 0.012 * Math.sin(Math.PI * (t - 0.5) / 0.14);
  if (t > 0.6 && t < 0.76) c.R.up += 0.008 * Math.sin(Math.PI * (t - 0.6) / 0.16);
});
// เตะก้านคอ, rear-leg roundhouse to the neck (hit 0.45 s). The lead foot steps out
// ~40° and the fighter pivots on its ball until the heel faces the target (~110°);
// the hips turn over (~110°) and drive the right hip through; the leg swings in almost
// straight, shin first, at neck height, its knee pointing the way it travels; the
// trunk leans back and away (~30°) to balance it; the right arm swings down past the
// hip and the left glove stays up by the face. The leg follows through, folds back and
// is set down behind, and the fighter turns back into guard.
{
  const S0 = STANCE;
  const stepOut = withP(S0, { hip: [0.03, 0.025, 0.04], hipYaw: -0.2, twist: -0.1, lean: 0.06,
    L: { x: 0.12, z: 0.17, yaw: 0.45, heel: 0, up: 0 }, R: { ...S0.R, heel: 0.55 },
    Lh: { ...S0.Lh, at: [0.05, -0.05, 0.15] }, Rh: { ...S0.Rh, at: [-0.08, -0.12, 0.04] } });
  const chamber = withP(stepOut, { hip: [0.05, 0.005, 0.06], hipYaw: 0.75, twist: -0.4, lean: -0.12, side: -0.15, look: 0.9,
    L: { x: 0.12, z: 0.17, yaw: 1.3, heel: 0.45, up: 0 },
    R: { x: -0.06, z: 0.12, yaw: 0.6, up: 0.24, pole: [1, 0.3, 0.6], point: 0.7 },
    Lh: { at: [0.07, -0.04, 0.15], pole: [0.5, -1, 0], palm: [-0.8, 0, -0.5], sh: 0.05 },
    Rh: { at: [-0.16, -0.3, -0.02], pole: [-0.3, -0.4, -1], palm: [0.6, 0, -0.8], sh: 0 } });
  const impact = withP(chamber, { hip: [0.06, -0.01, 0.07], hipYaw: 1.45, twist: -0.5, lean: -0.32, side: -0.32, look: 0.8,
    L: { x: 0.12, z: 0.17, yaw: 1.55, heel: 0.5, up: 0 },
    R: { x: 0.17, z: 0.41, yaw: 1.4, up: 0.62, pole: [1, 0.25, 0], point: 0.9 },
    Lh: { at: [0.1, -0.06, 0.13], pole: [0.6, -1, 0], palm: [-0.7, 0, -0.7], sh: 0.08 },
    Rh: { at: [-0.25, -0.4, -0.12], pole: [-0.3, -0.2, -1], palm: [0.3, 0, -1], sh: 0 } });
  const through = withP(impact, { hipYaw: 1.75, twist: -0.45, lean: -0.24, side: -0.24,
    L: { ...impact.L, yaw: 1.7 }, R: { x: 0.24, z: 0.3, yaw: 1.7, up: 0.42, pole: [1, 0.2, -0.3], point: 0.8 } });
  const recoil = withP(chamber, { hip: [0.03, 0.02, 0.04], hipYaw: 0.5, twist: -0.25, lean: 0, side: -0.05,
    L: { x: 0.12, z: 0.17, yaw: 1.0, heel: 0.25, up: 0 }, R: { x: -0.05, z: 0.0, yaw: -0.2, up: 0.13, pole: [0.3, 0, 1], point: 0.4 },
    Rh: { ...S0.Rh, at: [-0.08, -0.12, 0.05] } });
  const land = withP(S0, { hip: [0.02, 0.025, 0.0], hipYaw: -0.2, L: { x: 0.11, z: 0.15, yaw: 0.2, heel: 0, up: 0 } });
  buildP('boxer_kick', 1.1, [[0, S0], [0.14, stepOut, ease], [0.3, chamber, ease], [0.45, impact, easeIn], [0.52, impact], [0.62, through, easeOut], [0.8, recoil, ease], [0.93, land, ease], [1.1, S0, ease]]);
}
// จระเข้ฟาดหาง, spinning back kick (hit 0.62 s): the lead foot steps across in front,
// the fighter spins clockwise on it (looking over the right shoulder to spot the
// target), chambers the right knee and drives the heel straight back into the target
// at chest height, the trunk leaning away; the leg folds back and he turns back into guard.
{
  const S0 = STANCE;
  const cross = withP(S0, { hip: [-0.03, 0.03, 0.01], hipYaw: -1.35, twist: -0.35, lean: 0.05,
    L: { x: -0.03, z: 0.06, yaw: -1.5, heel: 0.15, up: 0 }, R: { ...S0.R, heel: 0.6 },
    Lh: { ...S0.Lh, at: [0.04, -0.06, 0.12] } });
  const spin = withP(cross, { hip: [-0.03, 0.02, 0.0], hipYaw: -2.55, twist: -0.45, lean: -0.3, look: 1,
    L: { x: -0.03, z: 0.06, yaw: -2.6, heel: 0.3, up: 0 },
    R: { x: -0.0, z: 0.0, yaw: -2.6, up: 0.2, pole: [0, -0.2, -1], point: 0.1 },
    Lh: { at: [0.04, -0.08, 0.06], pole: [0.3, -1, 0], palm: [-0.8, 0, -0.5], sh: 0 }, Rh: { at: [-0.05, -0.08, 0.05], pole: [-0.3, -1, 0], palm: [0.6, 0, 0.8], sh: 0 } });
  const kick = withP(spin, { hip: [-0.03, 0.005, -0.05], hipYaw: -3.0, twist: -0.15, lean: -1.0, side: 0,
    L: { x: -0.03, z: 0.06, yaw: -2.95, heel: 0.25, up: 0 },
    R: { x: -0.02, z: 0.42, yaw: -3.1, up: 0.47, pole: [0, -1, 0], point: 0 } });
  const back = withP(spin, { hipYaw: -2.4, lean: -0.2, R: { x: -0.02, z: 0.02, yaw: -2.4, up: 0.15, pole: [0, -0.2, -1], point: 0.2 } });
  const turn = withP(cross, { hipYaw: -1.2, R: { ...S0.R, heel: 0.3 }, L: { x: 0.02, z: 0.08, yaw: -0.9, heel: 0.2, up: 0 } });
  buildP('boxer_croc', 1.4, [[0, S0], [0.18, cross, ease], [0.4, spin, ease], [0.62, kick, easeIn], [0.7, kick], [0.86, back, easeOut], [1.06, turn, ease], [1.4, S0, ease]], (t, c) => {
    // spot the target: the head turns ahead of the body through the spin
    if (t > 0.18 && t < 0.86) c.look = 1;
  });
}
// War drum in front: alternate left / right beats, then both fists together.
// Stroke follows a real drummer's whip ("lead with the elbow"): raise with the
// elbow high and the fist cocked behind the head -> the elbow drops forward
// first while the forearm stays folded -> the forearm whips down and the arm
// opens on impact -> it rebounds up with the elbow folding again.
// Arms follow direction paths (slerped every frame) so the fists never swing out sideways.
{
  const sk = side => (side === 'L' ? 1 : -1);
  const U = { // [upper arm dir, forearm dir]; x mirrored per side
    ready: [[.35, -.6, .6], [-.2, .45, .85]],      // relaxed, elbow bent ~90
    raise: [[.25, .9, .25], [-.05, .3, -.95]],     // elbow high, fist behind the head (~110 bend)
    lead: [[.2, .12, 1], [0, .95, -.25]],          // elbow drops forward, forearm still up: tight fold
    whip: [[.17, -.2, 1], [0, .25, 1]],            // forearm swinging through the front
    strike: [[.15, -.45, 1], [-.03, -.7, .75]],    // arm opened (~160) onto the drum head
    rebound: [[.2, -.25, 1], [0, .75, .65]],       // bounce: elbow folds again (~115)
    hips: [[.65, -.75, -.1], [-.55, -.25, .45]],
  };
  const dirOf = (pose, side, i) => { const d = U[pose][i]; return new THREE.Vector3(d[0] * sk(side), d[1], d[2]).normalize(); };
  const slerpDir = (a, b, u) => { const q = new THREE.Quaternion().setFromUnitVectors(a, b); return a.clone().applyQuaternion(new THREE.Quaternion().slerp(q, u)); };
  function track(keys) {
    return t => {
      let k = 0; while (k < keys.length - 1 && keys[k + 1][0] <= t) k++;
      const [t0, a] = keys[k], [t1, b, e = ease] = keys[Math.min(k + 1, keys.length - 1)];
      return { a, b, u: t1 > t0 ? e(Math.min(1, (t - t0) / (t1 - t0))) : 0 };
    };
  }
  const applyArm = (p, side, tr) => {
    const S = side === 'L' ? 'Left' : 'Right';
    const gdir = (bone, child) => worldPos(R, P.G, B(child)).sub(worldPos(R, P.G, B(bone))).normalize();
    const pick = (name, i) => name === 'guard' ? (i ? gdir(S + 'ForeArm', S + 'Hand') : gdir(S + 'Arm', S + 'ForeArm')) : dirOf(name, side, i);
    arm(p, side, slerpDir(pick(tr.a, 0), pick(tr.b, 0), tr.u).toArray(), slerpDir(pick(tr.a, 1), pick(tr.b, 1), tr.u).toArray());
  };
  // one stroke landing at time h: raise -> lead -> whip -> strike -> rebound
  const stroke = (h, from) => [[h - .2, 'raise', easeOut], [h - .09, 'lead', ease], [h - .035, 'whip', easeIn], [h, 'strike', easeIn], [h + .1, 'rebound', easeOut]];
  const L = track([[0, 'guard'], ...stroke(.4), [.55, 'ready', ease], [.92, 'ready'], ...stroke(1.3), [1.5, 'ready', ease], [1.85, 'hips', ease], [2.25, 'hips'], [2.6, 'guard', ease]]);
  const Rt = track([[0, 'guard'], [.2, 'ready', easeOut], [.45, 'ready'], ...stroke(.85), [1.0, 'ready', ease], [1.1, 'raise', easeOut], ...stroke(1.3).slice(1), [1.5, 'ready', ease], [1.85, 'hips', ease], [2.25, 'hips'], [2.6, 'guard', ease]]);
  // body: open up and rise on the wind-up (inhale), twist toward the striking arm, drop the hips on impact (exhale)
  const body = (yawA, bendA, neck, h) => mk(P.G, p => { yaw(p, yawA); bend(p, bendA); bend(p, neck, 'Neck'); lift(p, h); return p; });
  const Bd = { upL: body(.25, -.12, -.05, .012), hitL: body(-.15, .32, .12, -.05), upR: body(-.25, -.12, -.05, .012), hitR: body(.15, .32, .12, -.05),
    upB: body(0, -.2, -.15, .02), hitB: body(0, .45, .15, -.075), proud: body(0, -.18, -.12, 0) };
  build('boxer_drum', 2.6, [
    [0, P.G], [0.2, Bd.upL, easeOut], [0.4, Bd.hitL, easeIn], [0.52, blend(Bd.hitL, Bd.upL, .4), easeOut],
    [0.65, Bd.upR, ease], [0.85, Bd.hitR, easeIn], [0.97, blend(Bd.hitR, Bd.upR, .4), easeOut],
    [1.1, Bd.upB, ease], [1.3, Bd.hitB, easeIn], [1.45, blend(Bd.hitB, Bd.upB, .35), easeOut],
    [1.85, Bd.proud, ease], [2.25, Bd.proud], [2.6, P.G, ease],
  ], (t, p) => {
    applyArm(p, 'L', L(t)); applyArm(p, 'R', Rt(t));
    for (const h of [0.4, 0.85, 1.3]) if (t > h && t < h + .25) lift(p, -.012 * Math.sin(Math.PI * (t - h) / .25));
    if (t > 1.85 && t < 2.25) lift(p, .006 * Math.sin(Math.PI * (t - 1.85) / .4));
  });
  // report elbow bend through one stroke (180 = straight)
  const A = R.root.listAnimations().find(a => a.getName() === 'boxer_drum');
  const ang = (pp, S) => { const s = worldPos(R, pp, B(S + 'Arm')), e = worldPos(R, pp, B(S + 'ForeArm')), w = worldPos(R, pp, B(S + 'Hand')); return Math.round(THREE.MathUtils.radToDeg(s.sub(e).angleTo(w.sub(e)))); };
  console.log('L elbow angle 0.2..0.55:', [.2, .26, .31, .365, .4, .45, .5, .55].map(t => ang(sampleAnim(A, t), 'Left')).join(' '));
}
// กายเหล็กมหาอุด: a power-up. The fighter squares up out of the bladed guard into
// a tall, natural stance (feet shoulder-width, spine upright, head level), fists
// clenched by the hips; crosses the arms in front of the face (X guard), chin tucked,
// a slight crouch, trembling — then bursts upright with the arms driven down and a little
// out, and holds that proud stance before stepping back into guard.
{
  const REST = new Map(R.nodes.map(n => [n, { t: new THREE.Vector3(...n.getTranslation()), r: new THREE.Quaternion(...n.getRotation()), s: new THREE.Vector3(...n.getScale()) }]));
  const gL = worldPos(R, P.G, B('LeftFoot')), gR = worldPos(R, P.G, B('RightFoot'));
  const cx = (gL.x + gR.x) / 2, cz = (gL.z + gR.z) / 2, half = 0.105;
  const footL = new THREE.Vector3(cx + half, gL.y, cz), footR = new THREE.Vector3(cx - half, gR.y, cz);
  const restFoot = side => worldQuat(R, REST, R.byName[B(side + 'Foot')]);
  // upright base: rest skeleton (spine and head straight, square to the front), hips at guard height
  const base = (() => { const p = clone(REST); p.get(HIPS).t.copy(P.G.get(HIPS).t); return p; })();
  const stand = (fn) => mk(base, p => { fn(p); legIK(R, p, B, 'Left', footL, restFoot('Left')); legIK(R, p, B, 'Right', footR, restFoot('Right')); return p; });
  const arms = (p, up, fore) => { arm(p, 'L', [up[0], up[1], up[2]], [fore[0], fore[1], fore[2]]); arm(p, 'R', [-up[0], up[1], up[2]], [-fore[0], fore[1], fore[2]]); };
  const S = {
    ready: stand(p => { lift(p, -0.015); arms(p, [0.22, -0.96, 0.12], [0.1, -0.7, 0.7]); }),                                    // fists by the hips
    // arms crossed in front of the face (an X guard), fists clenched, chin tucked behind
    // them, a slight crouch and the shoulders up: the strain before the burst
    tense: stand(p => { lift(p, -0.035); bend(p, 0.14); bend(p, 0.2, 'Neck');
      rotWorld(R, p, B('LeftShoulder'), [0, 0, 1], 0.1); rotWorld(R, p, B('RightShoulder'), [0, 0, 1], -0.1);
      arm(p, 'L', [0.2, -0.3, 0.93], [-0.76, 0.6, 0.22]);
      arm(p, 'R', [-0.22, -0.34, 0.91], [0.74, 0.62, 0.3]); }),
    burst: stand(p => { lift(p, -0.005); bend(p, -0.06); bend(p, -0.1, 'Neck'); arms(p, [0.4, -0.91, 0.06], [0.32, -0.9, 0.28]); }), // arms driven down and out
    proud: stand(p => { lift(p, -0.01); bend(p, -0.03); bend(p, 0.05, 'Neck'); arms(p, [0.3, -0.94, 0.12], [0.18, -0.8, 0.57]); }),  // the held stance
  };
  build('boxer_iron', 2.4, [[0, P.G], [0.32, S.ready, ease], [0.68, S.tense, ease], [1.25, mk(S.tense, p => { lift(p, -0.01); bend(p, 0.04); return p; })], [1.42, S.burst, easeIn], [1.7, S.burst], [2.0, S.proud, ease], [2.15, S.proud], [2.4, P.G, ease]], (t, p) => {
    // straining tremble: grows until the burst, then fades
    const shake = t < 0.5 ? 0 : t < 1.42 ? 0.006 + 0.016 * (t - 0.5) / 0.92 : Math.max(0, 0.02 * (1 - (t - 1.42) / 0.6));
    rotWorld(R, p, B('Spine1'), [0, 0, 1], shake * Math.sin(t * 95)); rotWorld(R, p, B('Spine2'), [1, 0, 0], shake * .6 * Math.sin(t * 77 + 1));
    rotWorld(R, p, B('LeftArm'), [1, 0, 0], shake * Math.sin(t * 88 + 2)); rotWorld(R, p, B('RightArm'), [1, 0, 0], shake * Math.sin(t * 91 + 3));
    // feet: a small step out to shoulder width (and back), otherwise planted
    const toW = t < 0.12 ? 0 : t < 0.32 ? ease((t - 0.12) / 0.2) : t < 2.12 ? 1 : t < 2.36 ? 1 - ease((t - 2.12) / 0.24) : 0;
    const step = (a, b) => (t > a && t < b ? Math.sin(Math.PI * (t - a) / (b - a)) * 0.03 : 0);
    legIK(R, p, B, 'Left', gL.clone().lerp(footL, toW).add(new THREE.Vector3(0, step(0.12, 0.24) + step(2.12, 2.24), 0)), FLAT.Left.clone().slerp(restFoot('Left'), toW));
    legIK(R, p, B, 'Right', gR.clone().lerp(footR, toW).add(new THREE.Vector3(0, step(0.2, 0.32) + step(2.24, 2.36), 0)), FLAT.Right.clone().slerp(restFoot('Right'), toW));
  });
}
const WAI_FLEX = -1.5;
// ไหว้ครูรำมวย (3.2 s): the fighter squares up and opens his hands, kneels and sits
// back on his heels (toes tucked), raises a wai at the chest, bows forward with the
// palms flat on the floor (กราบ), comes back up with the wai at the forehead, rises
// and steps into a ram muay pose on the right leg — left knee raised, both arms spread
// forward and out at shoulder height like wings (ย่างสามขุม) — then back into guard.
{
  const S0 = STANCE;
  // wai: forearms point in toward each other, the wrists bent back ~90° so the fingers
  // stand up and the palms meet (palm down before the wrist bends back = medial after).
  const wai = (y, z, flex = WAI_FLEX) => ({ Lh: { at: [0.016, y, z], pole: [0.8, -0.7, -0.1], palm: [0, -1, 0], sh: 0, flex }, Rh: { at: [-0.016, y, z], pole: [-0.8, -0.7, -0.1], palm: [0, -1, 0], sh: 0, flex } });
  const square = withP(S0, { hip: [0, 0.012, 0], hipYaw: 0, twist: 0, lean: 0.02, chin: 0.1, fist: [0, 0],
    L: { x: 0.07, z: 0.0, yaw: 0.15, heel: 0, up: 0 }, R: { x: -0.07, z: -0.01, yaw: -0.15, heel: 0, up: 0 }, ...wai(-0.17, 0.11) });
  const kneel = withP(square, { hip: [0, 0.35, -0.02], lean: 0.08, chin: 0.15,
    L: { x: 0.065, z: -0.12, yaw: 0, heel: 1.25, up: 0, pole: [0.05, -0.5, 1] }, R: { x: -0.065, z: -0.12, yaw: 0, heel: 1.25, up: 0, pole: [-0.05, -0.5, 1] } });
  const bow = withP(kneel, { hip: [0, 0.37, -0.04], lean: 1.15, chin: 0.25,
    Lh: { at: [0.08, -0.62, 0.12], pole: [0.5, 0.2, -1], palm: [0, -1, 0], sh: 0, flex: -1.0 }, Rh: { at: [-0.08, -0.62, 0.12], pole: [-0.5, 0.2, -1], palm: [0, -1, 0], sh: 0, flex: -1.0 } });
  const headWai = withP(kneel, { lean: 0.15, chin: 0.3, ...wai(0.02, 0.09) });
  const rise = withP(square, { hip: [0, 0.03, 0], ...wai(-0.14, 0.11) });
  const ram = withP(square, { hip: [-0.03, 0.03, 0.01], hipYaw: -0.15, lean: 0.06, chin: 0.05, fist: [0.2, 0.2],
    L: { x: 0.06, z: 0.1, yaw: 0.1, heel: 0, up: 0.17, pole: [0.1, 0.2, 1], point: 0.6 }, R: { x: -0.06, z: -0.02, yaw: -0.3, heel: 0, up: 0 },
    Lh: { at: [0.25, -0.12, 0.12], pole: [0.3, -0.6, -1], palm: [0, -1, 0.2], sh: 0, flex: -0.4 }, Rh: { at: [-0.22, -0.12, 0.06], pole: [-0.3, -0.6, -1], palm: [0, -1, 0.2], sh: 0, flex: -0.4 } });
  const stepDown = withP(S0, { hipYaw: -0.3, fist: [0.6, 0.6] });
  buildP('boxer_waikru', 3.2, [[0, S0], [0.3, square, ease], [0.75, kneel, ease], [1.05, bow, ease], [1.3, bow], [1.55, headWai, ease], [1.75, headWai], [2.1, rise, ease], [2.45, ram, ease], [2.7, ram], [2.95, stepDown, ease], [3.2, S0, ease]], (t, c) => {
    // the raised knee and arms sway a little (the ram's slow wave)
    if (t > 2.45 && t < 2.7) { const w = Math.sin(Math.PI * (t - 2.45) / 0.25); c.Lh.at[1] += 0.02 * w; c.Rh.at[1] -= 0.02 * w; }
  });
}
// หักงวงไอยรา (hit 0.95 s): the left arm scoops under the opponent's kick and traps it
// against the ribs (palm up), the right glove covering the face; the fighter rises on
// his toes with the right elbow cocked high above the head, then drops his weight —
// hips down, trunk folding forward — driving the point of the elbow down onto the
// trapped thigh at hip height, holds, and lets go back into guard.
{
  const S0 = STANCE;
  const catchK = withP(S0, { hip: [0.01, 0.04, -0.02], hipYaw: -0.25, twist: 0.1, lean: 0.1, side: -0.05, fist: [0.4, 1],
    Lh: { at: [0.13, -0.3, 0.08], pole: [1, -0.4, -0.3], palm: [-0.2, 1, 0], sh: 0, flex: 0 }, Rh: { ...S0.Rh, at: [-0.05, -0.06, 0.07] } });
  const cock = withP(catchK, { hip: [0.0, -0.025, 0.03], lean: -0.08, chin: 0.05,
    L: { ...S0.L, heel: 0.5 }, R: { ...S0.R, heel: 0.7 },
    Rh: { at: [-0.03, 0.08, -0.03], pole: [-0.2, 1, 0.3], palm: [0.6, 0, 0.8], sh: 0.1, flex: 0 } });
  const drop = withP(catchK, { hip: [0.0, 0.1, 0.05], lean: 0.85, chin: 0.15, side: 0,
    L: { ...S0.L, heel: 0 }, R: { ...S0.R, heel: 0.3 },
    Lh: { at: [0.12, -0.36, 0.13], pole: [1, -0.4, -0.2], palm: [-0.2, 1, 0], sh: 0, flex: 0 },
    Rh: { at: [-0.05, -0.12, 0.07], pole: [0, -1, 0.45], palm: [0.8, 0, 0.6], sh: 0, flex: 0 } });   // arm folded tight, the elbow's point down
  const hold = withP(drop, { hip: [0.0, 0.08, 0.04], lean: 0.7 });
  buildP('boxer_ngouy', 1.6, [[0, S0], [0.25, catchK, easeOut], [0.6, cock, ease], [0.95, drop, easeIn], [1.2, hold, easeOut], [1.6, S0, ease]]);
}
// ศอกกลับพลิกล็อก (hits 0.22 / 0.6 s): a lead horizontal elbow — the hips and shoulders
// turn into it, the upper arm comes level with the forearm folded tight, the point of the
// elbow sweeping across at chin height — then the left foot steps across and the fighter
// spins clockwise (spotting over the right shoulder) into a spinning back elbow with the
// right arm, and comes round into guard.
{
  const S0 = STANCE;
  const leadElbow = withP(S0, { hip: [0.0, 0.025, 0.0], hipYaw: -0.95, twist: -0.45, lean: 0.12,
    L: { ...S0.L, yaw: -0.5, heel: 0.35 },
    Lh: { at: [-0.06, -0.06, 0.05], pole: [0.3, 0.15, 1], palm: [0, -1, 0], sh: 0.12 }, Rh: { ...S0.Rh, at: [-0.06, -0.05, 0.07] } });
  const across = withP(leadElbow, { hipYaw: -1.9, twist: -0.5, lean: 0.05,
    L: { x: -0.02, z: 0.05, yaw: -1.7, heel: 0.3, up: 0 }, R: { ...S0.R, heel: 0.6 },
    Lh: { ...S0.Lh, at: [0.03, -0.06, 0.1] }, Rh: { at: [0.05, -0.08, 0.02], pole: [-0.5, -0.3, 1], palm: [0, -1, 0], sh: 0 } });
  const backElbow = withP(across, { hipYaw: -3.35, twist: -0.25, lean: 0.0,
    L: { x: -0.02, z: 0.05, yaw: -3.1, heel: 0.3, up: 0 }, R: { x: 0.1, z: -0.05, yaw: -3.6, heel: 0.6, up: 0 },
    Rh: { at: [0.07, -0.07, -0.02], pole: [0, 0.1, 1], palm: [0, -1, 0], sh: 0.1 } });
  const round = withP(S0, { hipYaw: -0.45 - Math.PI * 2 + 0.6, twist: -0.2, L: { ...S0.L, yaw: -0.12 - Math.PI * 2 + 0.4 }, R: { ...S0.R, yaw: -0.72 - Math.PI * 2 + 0.3 } });
  const end = withP(S0, { hipYaw: S0.hipYaw - Math.PI * 2, L: { ...S0.L, yaw: S0.L.yaw - Math.PI * 2 }, R: { ...S0.R, yaw: S0.R.yaw - Math.PI * 2 } });
  buildP('boxer_elbow', 1.0, [[0, S0], [0.12, withP(S0, { hipYaw: -0.3, Lh: { ...S0.Lh, at: [0.07, -0.05, 0.11] } }), easeOut], [0.22, leadElbow, easeIn], [0.27, leadElbow],
    [0.42, across, ease], [0.6, backElbow, easeIn], [0.65, backElbow], [0.82, round, easeOut], [1.0, end, ease]]);
}
// เข่าลอยทะลวงฟ้า, flying knee (hit 0.6 s): a quick step in on the left foot with both
// hands reaching up for the opponent's head, a jump off the left leg driving the right
// knee up through the chest, hips forward, trunk leaning back a little; the hands pull the
// head down onto the knee; he drops, lands on the right foot and steps back into guard.
{
  const S0 = STANCE;
  const reach = { Lh: { at: [0.06, -0.03, 0.2], pole: [0.6, -1, 0], palm: [-0.4, 0, 1], sh: 0 }, Rh: { at: [-0.05, -0.03, 0.2], pole: [-0.6, -1, 0], palm: [0.4, 0, 1], sh: 0 } };
  const load = withP(S0, { hip: [0.01, 0.06, 0.06], hipYaw: -0.3, lean: 0.18, L: { x: 0.06, z: 0.16, yaw: 0, heel: 0, up: 0 }, R: { ...S0.R, heel: 0.7 }, ...reach });
  const drive = withP(load, { hip: [0.0, -0.06, 0.09], hipYaw: -0.2, lean: -0.08, L: { x: 0.06, z: 0.16, yaw: 0, heel: 1.0, up: 0.02 },
    R: { x: -0.04, z: 0.1, yaw: -0.3, up: 0.22, pole: [0, 0.3, 1], point: 0.6, heel: 0 } });
  const strike = withP(drive, { hip: [0.0, -0.17, 0.11], lean: -0.22, chin: 0.25,
    L: { x: 0.06, z: 0.0, yaw: 0, heel: 0, up: 0.17, pole: [0, -0.3, 1], point: 0.8 },
    R: { x: -0.03, z: 0.17, yaw: -0.2, up: 0.44, pole: [0, 0.5, 1], point: 0.6, heel: 0 },
    Lh: { at: [0.05, -0.13, 0.19], pole: [0.7, -1, 0], palm: [-0.3, -0.5, 1], sh: 0 }, Rh: { at: [-0.04, -0.13, 0.19], pole: [-0.7, -1, 0], palm: [0.3, -0.5, 1], sh: 0 } });
  const fall = withP(strike, { hip: [0.0, -0.05, 0.1], lean: -0.05, L: { x: 0.06, z: 0.05, yaw: 0, heel: 0.3, up: 0.06 }, R: { x: -0.04, z: 0.14, yaw: -0.3, up: 0.14, pole: [0, 0, 1], point: 0.3, heel: 0 } });
  const land = withP(S0, { hip: [-0.01, 0.06, 0.08], hipYaw: -0.15, lean: 0.12, L: { x: 0.07, z: 0.0, yaw: 0, heel: 0.4, up: 0 }, R: { x: -0.05, z: 0.14, yaw: -0.4, heel: 0, up: 0 } });
  buildP('boxer_knee', 1.2, [[0, S0], [0.22, load, ease], [0.42, drive, easeIn], [0.6, strike, easeOut], [0.68, strike], [0.85, fall, easeIn], [0.95, land, easeOut], [1.2, S0, ease]]);
}
// หนุมานถวายแหวน (hits 0.34 parry / 0.78 uppercut): the right foot steps out to the side
// as the left glove parries the incoming straight across; the fighter drops low under it
// with both fists cocked at the waist, then drives up off the legs with both fists
// together, palms in, a double uppercut to the chin — the fists side by side like hands
// presenting a ring — and settles back into guard.
{
  const S0 = STANCE;
  const parry = withP(S0, { hip: [-0.02, 0.03, -0.01], hipYaw: -0.6, twist: -0.2, lean: 0.1, R: { x: -0.17, z: -0.07, yaw: -0.8, heel: 0.35, up: 0 },
    Lh: { at: [-0.08, -0.05, 0.16], pole: [0.6, -1, -0.2], palm: [-1, 0, 0.1], sh: 0.08 } });
  const low = withP(parry, { hip: [-0.03, 0.11, 0.0], hipYaw: -0.3, twist: 0, lean: 0.38, chin: 0.15,
    Lh: { at: [0.1, -0.33, 0.05], pole: [0.3, -0.6, -1], palm: [-0.3, 0.5, 0.8], sh: 0 }, Rh: { at: [-0.1, -0.33, 0.05], pole: [-0.3, -0.6, -1], palm: [0.3, 0.5, 0.8], sh: 0 } });
  const up = withP(low, { hip: [-0.02, -0.015, 0.04], hipYaw: -0.15, lean: -0.12, chin: 0.1, L: { ...S0.L, heel: 0.35 }, R: { x: -0.17, z: -0.07, yaw: -0.8, heel: 0.6, up: 0 },
    Lh: { at: [0.02, -0.06, 0.17], pole: [0.15, -1, -0.1], palm: [-0.2, 0, -1], sh: 0.05 }, Rh: { at: [-0.02, -0.06, 0.17], pole: [-0.15, -1, -0.1], palm: [0.2, 0, -1], sh: 0.05 } });
  const follow = withP(up, { hip: [-0.02, -0.025, 0.05], lean: -0.16, Lh: { ...up.Lh, at: [0.02, -0.01, 0.19] }, Rh: { ...up.Rh, at: [-0.02, -0.01, 0.19] } });
  buildP('boxer_hanuman', 1.6, [[0, S0], [0.14, withP(S0, { hip: [0, 0.035, -0.02] }), ease], [0.34, parry, easeOut], [0.4, parry], [0.6, low, ease], [0.66, low], [0.78, up, easeIn], [0.92, follow, easeOut], [1.1, follow], [1.6, S0, ease]], (t, c) => {
    if (t > 0.16 && t < 0.32) c.R.up += 0.02 * Math.sin(Math.PI * (t - 0.16) / 0.16);          // the side step lifts the foot
    if (t > 1.22 && t < 1.45) c.R.up += 0.02 * Math.sin(Math.PI * (t - 1.22) / 0.23);
  });
}
// Hit: the head snaps back and the guard is knocked in; back to guard.
const HURT = withP(STANCE, { hip: [-0.005, 0.035, -0.05], lean: -0.22, chin: -0.2, hipYaw: -0.55, Lh: { ...STANCE.Lh, at: [0.03, -0.08, 0.08] }, Rh: { ...STANCE.Rh, at: [-0.05, -0.09, 0.04] } });
buildP('hurt', 0.5, [[0, STANCE], [0.08, HURT, easeOut], [0.2, HURT], [0.5, STANCE, ease]]);
// Knock-out: the knees give, the arms drop and he topples backwards onto the floor.
{
  const slump = withP(HURT, { hip: [0, 0.12, -0.04], lean: -0.1, fist: [0.3, 0.3], R: { ...STANCE.R, heel: 0 },
    Lh: { at: [0.17, -0.42, 0.0], pole: [0.3, 0, -1], palm: [0, 0, 1], sh: 0 }, Rh: { at: [-0.17, -0.42, -0.02], pole: [-0.3, 0, -1], palm: [0, 0, 1], sh: 0 } });
  // legs straighten as he goes over, so they lie along the floor
  const spread = withP(slump, { hip: [0, -0.01, -0.04], L: { ...STANCE.L, heel: 0, yaw: 0.3 }, R: { ...STANCE.R, heel: 0, yaw: -0.4 }, Lh: { at: [0.3, -0.12, 0.0], pole: [0, -1, -0.3], palm: [0, 1, 0], sh: 0 }, Rh: { at: [-0.3, -0.12, -0.02], pole: [0, -1, -0.3], palm: [0, 1, 0], sh: 0 } });
  buildP('die', 1.6, [[0, STANCE], [0.25, HURT, easeOut], [0.6, slump, ease], [1.0, spread, ease], [1.6, spread]], null, (t, p) => {
    const u = ease(Math.min(1, Math.max(0, (t - 0.45) / 0.75)));
    rotWorld(R, p, B('Hips'), [1, 0, 0], -1.45 * u);
    const parts = ['Head', 'Spine2', 'Hips', 'LeftFoot', 'RightFoot', 'LeftLeg', 'RightLeg', 'LeftHand', 'RightHand'];
    const lowY = Math.min(...parts.map(n => worldPos(R, p, B(n)).y));
    lift(p, (0.06 - lowY) * u);
  });
}

// Rename locomotion, drop the long prompt-named clips (now covered by boxer_*).
WALK.setName('walk'); RUN.setName('run');
for (const a of [JAB, COMBO, TEEP, KICK]) a.dispose();
const { prune, dedup } = await import('@gltf-transform/functions');
await R.doc.transform(prune(), dedup());
console.log(R.root.listAnimations().map(a => a.getName()).join(', '));
await R.io.write(process.argv[3] ?? 'muay-thai-fighter.glb', R.doc);
