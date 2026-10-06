// Builds the warrior's (นักรบ · ขุนศึกดาบคู่) animations. The warrior mesh is skinned to the
// Muay Thai fighter's Tripo skeleton (same rest pose, weights transferred in Blender, a sword
// parented to each hand — see README.md), so the fighter's walk/run clips play on it unchanged
// and the same procedural pose builder (fighter() below) drives every sword move.
import { load, sample, clone, blend, worldPos, worldQuat, rotWorld, writeAnim, legIK, fist, hingeLimb, THREE } from '../muaythai-anims/lib.mjs';
const R = await load(process.argv[2] ?? 'tools/warrior-anims/warrior-tripo.glb');
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
const P = { G, FK0: at(KICK, 0.5), FK: at(KICK, 0.83), FK1: at(KICK, 1.05) };   // the source "front kick" is really a spinning kick
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
// A sword runs through each fist and out of the thumb side (see README.md), so a blade
// direction fixes the hand's roll: left palm = forearm × blade, right palm = blade × forearm.
// The blade need not stand square to the forearm: whatever it leans toward the forearm's
// line (the sword lies diagonally across the palm, and the wrist cocks) is kept as `TILT`
// and applied after the fist closes — split between the wrist and the grip.
const TILT = {};
function bladePalm(p, S, blade) {
  const fore = worldPos(R, p, B((S === 'L' ? 'Left' : 'Right') + 'Hand')).sub(worldPos(R, p, B((S === 'L' ? 'Left' : 'Right') + 'ForeArm'))).normalize();
  const want = v3(...blade).normalize(), b = want.clone().sub(fore.clone().multiplyScalar(want.dot(fore)));
  if (b.lengthSq() < 1e-6) b.set(0, 1, 0).sub(fore.clone().multiplyScalar(fore.y));
  b.normalize();
  TILT[S] = { perp: b, fore, a: THREE.MathUtils.clamp(Math.atan2(want.dot(fore), want.dot(b)), -0.45, 1.25) };
  return (S === 'L' ? fore.clone().cross(b) : b.clone().cross(fore)).toArray();
}
function tiltBlade(p, S) {
  const t = TILT[S]; if (!t || Math.abs(t.a) < 1e-3) return;
  const axis = t.perp.clone().cross(t.fore).normalize().toArray();
  rotWorld(R, p, B((S === 'L' ? 'Left' : 'Right') + 'Hand'), axis, t.a * 0.35);
  rotWorld(R, p, 'sword_' + S, axis, t.a * 0.65);
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
    hand(p, S, h.blade ? bladePalm(p, S, h.blade) : h.palm, h.flex ?? 0);
  }
  const fk = c.fist ?? [1, 1];
  if (fk[0] > .01) fist(R, p, B, 'Left', fk[0]);
  if (fk[1] > .01) fist(R, p, B, 'Right', fk[1]);
  for (const [S, h] of [['L', c.Lh], ['R', c.Rh]]) if (h.blade) tiltBlade(p, S);
  TILT.L = TILT.R = null;
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
P.G = fighter({ ...STANCE, fist: [0, 0] });   // (not used by the warrior's own clips)
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
const FISTS = new Set();
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

// --- the warrior ---------------------------------------------------------------------
// Twin Thai swords (ดาบสองมือ), one in each fist, blades out of the thumb side. Hands are
// given as { at (from the head), pole (elbow), blade (world direction of the blade) }.
// Battle stance from the concept sheet: wide and low, left foot leading, the left blade
// out toward the target, the right one cocked high by the shoulder. Clip timings (n / 30 s)
// match src/classes/warrior-moves.js, where the FX lands each blow.
const f = n => n / 30;
const H = (at, pole, blade, sh = 0) => ({ at, pole, blade, palm: [0, -1, 0], sh });
const WSTANCE = {
  hip: [0, 0.05, -0.01], hipYaw: -0.4, twist: -0.1, lean: 0.12, side: 0, chin: 0.1, look: 1, fist: [1, 1],
  L: { x: 0.105, z: 0.1, yaw: -0.2, heel: 0, up: 0 },
  R: { x: -0.11, z: -0.12, yaw: -0.85, heel: 0.25, up: 0 },
  Lh: H([0.1, -0.3, 0.28], [0.4, -1, -0.2], [0.1, 0.3, 1]),
  Rh: H([-0.17, -0.12, -0.02], [-1, -0.4, -0.3], [0.25, 0.75, 0.6]),
};
const W = o => withP(WSTANCE, o);
// a step: the moving foot lifts a little on the way
const stepUp = (t0, t1, side, h = 0.03) => (t, c) => { if (t > t0 && t < t1) c[side].up += h * Math.sin(Math.PI * (t - t0) / (t1 - t0)); };
const both = (...fns) => (t, c) => { for (const fn of fns) fn?.(t, c); };

buildP('idle', 2.4, [[0, WSTANCE], [2.4, WSTANCE]], (t, c) => {
  const w = TAU * t / 2.4;
  c.hip[1] += 0.004 * (1 - Math.cos(2 * w)) / 2; c.hipYaw += 0.03 * Math.sin(w); c.chin += 0.02 * Math.sin(2 * w);
  c.Lh.at = c.Lh.at.map((x, i) => x + [0, 0.008 * Math.sin(w + 1), 0.006 * Math.cos(w)][i]);
  c.Rh.at = c.Rh.at.map((x, i) => x + [0, 0.006 * Math.sin(w), 0][i]);
});

// 1 ฟันดาบคู่: three cross cuts — left blade down from over the right shoulder (0.3),
// right blade down from over the left (0.47), both together in an X (0.67)
{
  const upL = W({ twist: -0.45, hipYaw: -0.55, Lh: H([-0.12, 0.08, 0.1], [0.6, 0.2, -0.6], [-0.4, 0.8, -0.3]) });
  const cutL = W({ twist: 0.35, hipYaw: -0.2, lean: 0.25, Lh: H([0.3, -0.42, 0.25], [0.8, -0.6, 0], [0.6, -0.5, 0.6]), Rh: H([-0.15, -0.2, 0.05], [-1, -0.5, -0.2], [0.2, 0.6, 0.8]) });
  const upR = withP(cutL, { twist: 0.4, Rh: H([0.12, 0.08, 0.12], [-0.6, 0.2, -0.6], [0.4, 0.8, -0.3]) });
  const cutR = W({ twist: -0.3, hipYaw: -0.45, lean: 0.28, Lh: H([0.22, -0.38, 0.2], [0.8, -0.6, 0], [0.4, -0.3, 0.8]), Rh: H([-0.3, -0.42, 0.25], [-0.8, -0.6, 0], [-0.6, -0.5, 0.6]) });
  const upX = W({ twist: 0, hipYaw: -0.3, lean: 0.0, chin: 0, Lh: H([0.22, 0.14, 0.12], [0.8, 0.2, -0.4], [-0.2, 0.9, 0.3], 0.05), Rh: H([-0.22, 0.14, 0.12], [-0.8, 0.2, -0.4], [0.2, 0.9, 0.3], 0.05) });
  const cutX = W({ twist: 0, hipYaw: -0.3, lean: 0.32, hip: [0, 0.08, 0.03], Lh: H([-0.12, -0.42, 0.32], [0.6, -0.8, 0], [-0.5, -0.4, 0.7]), Rh: H([0.12, -0.44, 0.3], [-0.6, -0.8, 0], [0.5, -0.4, 0.7]) });
  buildP('sword_twin', 1.0, [[0, WSTANCE], [f(6), upL, easeOut], [f(9), cutL, easeIn], [f(11), upR, easeOut], [f(14), cutR, easeIn], [f(17), upX, easeOut], [f(20), cutX, easeIn], [f(24), cutX], [1.0, WSTANCE, ease]]);
}
// 2 แทงทะลวง: coil low with both blades drawn back at the hips, then a long lunge with
// both points driven straight ahead (0.4)
{
  const coil = W({ hip: [0, 0.1, -0.05], hipYaw: -0.6, twist: -0.2, lean: 0.25, chin: 0.15,
    Lh: H([0.16, -0.48, -0.05], [0.5, -0.6, -0.8], [0, 0.1, 1]), Rh: H([-0.18, -0.5, -0.1], [-0.5, -0.6, -0.8], [0, 0.1, 1]) });
  const lunge = W({ hip: [0, 0.13, 0.17], hipYaw: -0.3, twist: 0, lean: 0.35, chin: 0.1,
    L: { x: 0.11, z: 0.42, yaw: -0.05, heel: 0, up: 0 }, R: { x: -0.11, z: -0.2, yaw: -0.7, heel: 0.6, up: 0 },
    Lh: H([0.06, -0.22, 0.48], [0.3, -1, 0], [0, 0, 1]), Rh: H([-0.04, -0.26, 0.46], [-0.3, -1, 0], [0, 0, 1]) });
  buildP('sword_thrust', 1.0, [[0, WSTANCE], [f(7), coil, easeOut], [f(12), lunge, easeIn], [f(18), lunge], [1.0, WSTANCE, ease]], stepUp(f(7), f(12), 'L', 0.05));
}
// 3 ดาบวายุ: both blades crossed high behind the head, then torn apart outward in a
// flat scissor cut at chest height that sends the wind wave (0.5)
{
  const wind = W({ hip: [0, 0.06, -0.03], hipYaw: -0.25, twist: 0.1, lean: -0.08, chin: 0,
    Lh: H([-0.04, 0.16, -0.06], [0.8, 0.4, -0.4], [-0.6, 0.6, -0.4], 0.08), Rh: H([0.04, 0.16, -0.06], [-0.8, 0.4, -0.4], [0.6, 0.6, -0.4], 0.08) });
  const tear = W({ hip: [0, 0.08, 0.06], hipYaw: -0.2, twist: 0, lean: 0.25, chin: 0.1,
    L: { ...WSTANCE.L, z: 0.17 },
    Lh: H([0.42, -0.3, 0.22], [0.5, -1, -0.3], [0.6, -0.05, 0.8]), Rh: H([-0.42, -0.3, 0.22], [-0.5, -1, -0.3], [-0.6, -0.05, 0.8]) });
  buildP('sword_wind', 1.1, [[0, WSTANCE], [f(9), wind, easeOut], [f(15), tear, easeIn], [f(21), tear], [1.1, WSTANCE, ease]], stepUp(f(9), f(15), 'L'));
}
// 4 ตั้งการ์ดดาบคู่: low and square, blades crossed in an X in front of the face (0.6)
{
  const guard = W({ hip: [0, 0.1, 0], hipYaw: -0.15, twist: 0, lean: 0.06, chin: 0.15,
    L: { x: 0.12, z: 0.06, yaw: -0.1, heel: 0, up: 0 }, R: { x: -0.12, z: -0.08, yaw: -0.5, heel: 0, up: 0 },
    Lh: H([0.07, -0.14, 0.24], [0.8, -0.5, -0.2], [-0.6, 0.75, 0.2]), Rh: H([-0.07, -0.14, 0.24], [-0.8, -0.5, -0.2], [0.6, 0.75, 0.2]) });
  buildP('sword_guard', 1.3, [[0, WSTANCE], [f(10), guard, easeOut], [f(18), withP(guard, { hip: [0, 0.12, 0] }), easeIn], [f(30), guard], [1.3, WSTANCE, ease]]);
}
// 5 เพลงดาบพิฆาต: the sword dance — six alternating diagonal cuts as he turns, the last
// one spinning (0.33, 0.6, 0.87, 1.13, 1.4, 1.67)
{
  const hiL = tw => W({ twist: tw - 0.4, Lh: H([-0.12, 0.1, 0.1], [0.6, 0.2, -0.6], [-0.4, 0.8, -0.3]), Rh: H([-0.2, -0.3, 0.05], [-1, -0.5, 0], [-0.3, 0.2, 0.9]) });
  const loL = tw => W({ twist: tw + 0.35, lean: 0.25, Lh: H([0.32, -0.4, 0.22], [0.8, -0.6, 0], [0.6, -0.5, 0.6]), Rh: H([-0.15, -0.2, 0.05], [-1, -0.5, -0.2], [0.2, 0.6, 0.8]) });
  const hiR = tw => W({ twist: tw + 0.4, Lh: H([0.2, -0.3, 0.05], [1, -0.5, 0], [0.3, 0.2, 0.9]), Rh: H([0.12, 0.1, 0.1], [-0.6, 0.2, -0.6], [0.4, 0.8, -0.3]) });
  const loR = tw => W({ twist: tw - 0.35, lean: 0.25, Lh: H([0.2, -0.3, 0.15], [0.8, -0.6, 0], [0.4, -0.3, 0.8]), Rh: H([-0.32, -0.4, 0.22], [-0.8, -0.6, 0], [-0.6, -0.5, 0.6]) });
  const keys = [[0, WSTANCE]], hits = [10, 18, 26, 34, 42, 50];
  hits.forEach((h, i) => { const L = i % 2 === 0; keys.push([f(h - 5), (L ? hiL : hiR)(0), easeOut], [f(h), (L ? loL : loR)(0), easeIn]); });
  keys.push([f(53), loR(0)], [2.0, WSTANCE, ease]);
  buildP('sword_pikat', 2.0, keys, (t, c) => { for (const h of hits) { const u = bump(t, f(h), f(4)); c.hip[1] += 0.02 * u; } }, (t, p) => {
    // the body turns a full circle over the dance (feet pivot with it), the last cut spins
    const u = Math.min(1, Math.max(0, (t - f(5)) / (f(50) - f(5)))); spinY(p, TAU * ease(u));
  });
}
// 6 ธงชัยเฉลิมพล: the right blade raised to the sky like a standard, then driven point-down
// into the ground at his feet on one knee (0.9) — the garuda banner rises from it
{
  const raise = W({ hip: [0, 0.0, 0], hipYaw: -0.2, twist: 0, lean: -0.08, chin: -0.25,
    L: { x: 0.09, z: 0.06, yaw: -0.1, heel: 0, up: 0 }, R: { x: -0.1, z: -0.08, yaw: -0.5, heel: 0, up: 0 },
    Lh: H([0.2, -0.45, 0.06], [0.4, -0.2, -1], [0.3, -0.6, 0.6]), Rh: H([-0.08, 0.36, 0.06], [-1, 0, -0.2], [0, 1, 0.1], 0.12) });
  const plant = W({ hip: [0, 0.27, 0.0], hipYaw: -0.2, twist: 0, lean: 0.2, chin: 0.1,
    L: { x: 0.1, z: 0.16, yaw: -0.1, heel: 0, up: 0 }, R: { x: -0.08, z: -0.16, yaw: -0.4, heel: 1.0, up: 0, pole: [0, -0.4, 1] },
    Lh: H([0.22, -0.48, 0.0], [0.4, 0, -1], [0.3, -0.6, 0.6]), Rh: H([-0.02, -0.4, 0.3], [-1, 0, 0.1], [0, -1, 0.05]) });
  buildP('sword_banner', 1.8, [[0, WSTANCE], [f(12), raise, ease], [f(20), withP(raise, { chin: -0.3 })], [f(27), plant, easeIn], [f(40), plant], [1.8, WSTANCE, ease]]);
}
// 7 ดาบบาทวงจักร: arms flung out, blades level, three full spins (0.37, 0.67, 0.97)
{
  const out = W({ hip: [0, 0.06, 0], hipYaw: 0, twist: 0, lean: 0.05, chin: 0.05,
    L: { x: 0.11, z: 0.02, yaw: 0, heel: 0.3, up: 0 }, R: { x: -0.11, z: -0.02, yaw: 0, heel: 0.3, up: 0 },
    Lh: H([0.48, -0.24, 0.02], [0, -1, -0.3], [0.2, 0, 1]), Rh: H([-0.48, -0.24, 0.02], [0, -1, -0.3], [-0.2, 0, -1]) });
  buildP('sword_whirl', 1.4, [[0, WSTANCE], [f(5), out, easeOut], [f(32), out], [1.4, WSTANCE, ease]], null, (t, p) => {
    const u = Math.min(1, Math.max(0, (t - f(2)) / (f(32) - f(2)))); spinY(p, -TAU * 3 * u);
  });
}
// 8 กระโจนผ่าปฐพี: crouch, spring high with both blades raised behind the head, come down
// and smash both into the ground (0.9)
{
  const crouch = W({ hip: [0, 0.16, -0.03], hipYaw: -0.25, lean: 0.35, chin: 0.15,
    Lh: H([0.2, -0.5, -0.06], [0.5, -0.4, -0.8], [0.2, 0.3, -1]), Rh: H([-0.2, -0.5, -0.06], [-0.5, -0.4, -0.8], [-0.2, 0.3, -1]) });
  const air = W({ hip: [0, -0.22, 0.05], hipYaw: -0.2, lean: -0.15, chin: -0.1,
    L: { x: 0.1, z: 0.12, yaw: -0.1, heel: 0, up: 0.2, pole: [0, 0.3, 1] }, R: { x: -0.1, z: -0.05, yaw: -0.4, heel: 0, up: 0.16, pole: [0, 0.3, 1] },
    Lh: H([0.1, 0.18, -0.12], [0.6, 0.6, -0.4], [-0.1, 0.4, -1], 0.1), Rh: H([-0.1, 0.18, -0.12], [-0.6, 0.6, -0.4], [0.1, 0.4, -1], 0.1) });
  const smash = W({ hip: [0, 0.2, 0.08], hipYaw: -0.2, lean: 0.45, chin: 0.2,
    L: { x: 0.11, z: 0.22, yaw: -0.1, heel: 0, up: 0 }, R: { x: -0.1, z: -0.16, yaw: -0.5, heel: 0.7, up: 0 },
    Lh: H([0.12, -0.55, 0.3], [0.5, -0.5, -0.6], [0, -0.85, 0.5]), Rh: H([-0.12, -0.55, 0.3], [-0.5, -0.5, -0.6], [0, -0.85, 0.5]) });
  buildP('sword_leap', 1.5, [[0, WSTANCE], [f(8), crouch, easeOut], [f(18), air, easeOut], [f(24), withP(air, { hip: [0, -0.12, 0.08] }), easeIn], [f(27), smash, easeIn], [f(36), smash], [1.5, WSTANCE, ease]]);
}
// 9 โทสะขุนศึก: the war cry — chest out, head back, blades flung low and wide, then a
// crouching roar with the arms bent and the swords shaking (0.8)
{
  const open = W({ hip: [0, 0.03, -0.02], hipYaw: -0.1, twist: 0, lean: -0.18, chin: -0.45,
    L: { x: 0.12, z: 0.04, yaw: 0.0, heel: 0, up: 0 }, R: { x: -0.12, z: -0.06, yaw: -0.3, heel: 0, up: 0 },
    Lh: H([0.38, -0.5, 0.05], [0.4, -0.2, -1], [0.6, -0.5, 0.4]), Rh: H([-0.38, -0.5, 0.05], [-0.4, -0.2, -1], [-0.6, -0.5, 0.4]) });
  const roar = W({ hip: [0, 0.14, 0], hipYaw: -0.1, twist: 0, lean: 0.25, chin: -0.1,
    L: { x: 0.13, z: 0.04, yaw: 0.0, heel: 0, up: 0 }, R: { x: -0.13, z: -0.06, yaw: -0.3, heel: 0, up: 0 },
    Lh: H([0.3, -0.24, 0.1], [0.6, -0.8, -0.3], [0.2, 0.9, 0.3]), Rh: H([-0.3, -0.24, 0.1], [-0.6, -0.8, -0.3], [-0.2, 0.9, 0.3]) });
  buildP('sword_berserk', 1.6, [[0, WSTANCE], [f(12), open, ease], [f(20), open], [f(24), roar, easeIn], [f(38), roar], [1.6, WSTANCE, ease]], (t, c) => {
    if (t > f(24) && t < f(38)) { const k = Math.sin(TAU * 9 * t) * 0.006; c.Lh.at[0] += k; c.Rh.at[0] -= k; c.hip[1] += Math.abs(k) * 0.5; }
  });
}
// 10 ดาบประหารอสูร: both blades raised together overhead (the lightning gathers), held,
// then one huge cleave down into a deep lunge (1.2)
{
  const raise = W({ hip: [0, 0.02, -0.03], hipYaw: -0.3, twist: 0, lean: -0.12, chin: -0.25,
    L: { x: 0.1, z: 0.08, yaw: -0.15, heel: 0, up: 0 }, R: { x: -0.11, z: -0.1, yaw: -0.7, heel: 0.2, up: 0 },
    Lh: H([0.04, 0.34, -0.02], [1, 0.1, -0.2], [0.05, 1, -0.2], 0.12), Rh: H([-0.04, 0.34, -0.02], [-1, 0.1, -0.2], [-0.05, 1, -0.2], 0.12) });
  const cleave = W({ hip: [0, 0.18, 0.15], hipYaw: -0.25, twist: 0, lean: 0.5, chin: 0.2,
    L: { x: 0.11, z: 0.38, yaw: -0.05, heel: 0, up: 0 }, R: { x: -0.1, z: -0.2, yaw: -0.7, heel: 0.6, up: 0 },
    Lh: H([0.06, -0.5, 0.42], [0.6, -0.6, -0.4], [0, -0.6, 0.8]), Rh: H([-0.06, -0.5, 0.42], [-0.6, -0.6, -0.4], [0, -0.6, 0.8]) });
  buildP('sword_execute', 2.0, [[0, WSTANCE], [f(12), raise, ease], [f(30), withP(raise, { lean: -0.16, hip: [0, 0.0, -0.04] })], [f(36), cleave, easeIn], [f(48), cleave], [2.0, WSTANCE, ease]], both(stepUp(f(30), f(36), 'L', 0.05), (t, c) => {
    if (t > f(12) && t < f(30)) { const k = Math.sin(TAU * 7 * t) * 0.004; c.Lh.at[1] += k; c.Rh.at[1] += k; }
  }));
}
// Hit and knock-out (as the hunter's, from the battle stance)
const WHURT = W({ hip: [-0.005, 0.06, -0.05], lean: -0.22, chin: -0.2, Lh: H([0.18, -0.3, 0.1], [0.5, -0.8, -0.3], [0.3, 0.5, 0.8]), Rh: H([-0.18, -0.3, 0.02], [-0.5, -0.8, -0.3], [-0.2, 0.6, 0.7]) });
buildP('hurt', 0.5, [[0, WSTANCE], [0.08, WHURT, easeOut], [0.2, WHURT], [0.5, WSTANCE, ease]]);
{
  const slump = W({ hip: [0, 0.2, -0.06], lean: -0.1, Lh: H([0.2, -0.45, 0.0], [0.3, 0, -1], [0.4, -0.7, 0.4]), Rh: H([-0.2, -0.45, -0.02], [-0.3, 0, -1], [-0.4, -0.7, 0.4]) });
  const spread = withP(slump, { hip: [0, 0.05, -0.04], L: { ...WSTANCE.L, heel: 0, yaw: 0.3 }, R: { ...WSTANCE.R, heel: 0, yaw: -0.4 },
    Lh: H([0.32, -0.12, 0.0], [0, -1, -0.3], [0.5, 0, 0.8]), Rh: H([-0.32, -0.12, -0.02], [0, -1, -0.3], [-0.5, 0, 0.8]) });
  buildP('die', 1.6, [[0, WSTANCE], [0.25, WHURT, easeOut], [0.6, slump, ease], [1.0, spread, ease], [1.6, spread]], null, (t, p) => {
    const u = ease(Math.min(1, Math.max(0, (t - 0.6) / 0.6)));
    rotWorld(R, p, B('Hips'), [1, 0, 0], -1.45 * u);
    const parts = ['Head', 'Spine2', 'Hips', 'LeftFoot', 'RightFoot', 'LeftLeg', 'RightLeg', 'LeftHand', 'RightHand'];
    lift(p, (0.06 - Math.min(...parts.map(n => worldPos(R, p, B(n)).y))) * u);
  });
}

WALK.setName('walk'); RUN.setName('run');
for (const a of [JAB, COMBO, TEEP, KICK]) a.dispose();
const { prune, dedup } = await import('@gltf-transform/functions');
await R.doc.transform(prune(), dedup());
console.log(R.root.listAnimations().map(a => a.getName()).join(', '));
await R.io.write(process.argv[3] ?? 'public/models/warrior.glb', R.doc);
