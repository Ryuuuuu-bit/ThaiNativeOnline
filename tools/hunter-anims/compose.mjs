// Builds the hunter's (นายพราน) animations. The hunter mesh is skinned to the Muay Thai
// fighter's Tripo skeleton (same rest pose, weights transferred in Blender, bow parented to
// the left hand — see README.md), so the fighter's walk/run clips play on it unchanged and
// the same procedural pose builder (fighter() below) drives every archery move.
import { load, sample, clone, blend, worldPos, worldQuat, rotWorld, writeAnim, legIK, fist, hingeLimb, THREE } from '../muaythai-anims/lib.mjs';
const R = await load(process.argv[2] ?? 'tools/hunter-anims/hunter-tripo.glb');
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
P.G = fighter({ ...STANCE, fist: [0, 0] });   // (not used by the hunter's own clips)
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

// --- the hunter ---------------------------------------------------------------------
// Right-handed archer: the bow is in the left hand (parented to LeftHand in the GLB, its
// grip running through the fist, so thumb-up = bow upright). To shoot he turns side-on
// to the target (left shoulder leading), pushes the bow arm straight out at shoulder
// height and draws the string hand back to an anchor under the jaw, elbow high behind;
// on the release the string hand flies back past the ear. Clip timings (n / 30 s) match
// src/classes/hunter-moves.js; the FX (src/classes/fx/hunter-skills.js) fires the arrow
// on the hit time.
const f = n => n / 30;
const HSTANCE = {   // ready: relaxed, bow held upright in front of the left hip
  hip: [0, 0.012, -0.01], hipYaw: -0.35, twist: -0.05, lean: 0.04, side: 0, chin: 0.05, look: 1, fist: [1, 0.5],
  L: { x: 0.085, z: 0.05, yaw: -0.1, heel: 0, up: 0 },
  R: { x: -0.09, z: -0.06, yaw: -0.5, heel: 0, up: 0 },
  Lh: { at: [0.13, -0.34, 0.2], pole: [0.2, -1, -0.4], palm: [-1, 0, 0], sh: 0 },   // forearm level: the bow stands upright
  Rh: { at: [-0.15, -0.42, 0.0], pole: [-0.3, -0.3, -1], palm: [1, 0, 0], sh: 0 },
};
const SIDE = { hip: [0, 0.02, 0], hipYaw: -1.35, twist: -0.1, lean: 0.02, chin: 0.05, L: { x: 0.02, z: 0.12, yaw: -1.3, heel: 0, up: 0 }, R: { x: -0.02, z: -0.12, yaw: -1.45, heel: 0, up: 0 } };
const BOW = (y = -0.075, z = 0.45, x = 0) => ({ at: [x, y, z], pole: [0.2, -1, 0], palm: [-1, 0, 0], sh: 0 });
const ANCHOR = (dy = 0, dz = 0) => ({ at: [-0.03, -0.06 + dy, 0.04 + dz], pole: [-0.3, 0.25, -1], palm: [0, 0, -1], sh: 0 });
const NOCKED = (dy = 0, dz = 0) => ({ at: [0.0, -0.09 + dy, 0.3 + dz], pole: [-0.4, -0.3, -1], palm: [0, 0, -1], sh: 0 });
const LOOSE = (dy = 0, dz = 0) => ({ at: [-0.1, -0.03 + dy, -0.05 + dz], pole: [-0.3, 0.4, -1], palm: [-0.3, 0, -1], sh: 0 });
const shot = (body, y, z, dz = 0) => ({
  nock: withP(HSTANCE, { ...body, Lh: BOW(y, z), Rh: NOCKED(y + 0.075, dz), fist: [1, 0.7] }),
  aim: withP(HSTANCE, { ...body, Lh: BOW(y, z), Rh: ANCHOR(y + 0.075, dz), fist: [1, 0.6] }),
  loose: withP(HSTANCE, { ...body, Lh: BOW(y - 0.012, z + 0.01), Rh: LOOSE(y + 0.075, dz), fist: [1, 0.15] }),
});
// the turn to side-on and back: the front foot lifts a little as it slides round
const turnStep = (t0, t1, side) => (t, c) => { if (t > t0 && t < t1) c[side].up += 0.015 * Math.sin(Math.PI * (t - t0) / (t1 - t0)); };
// idle: weight shifts slowly, the bow hand drifts, breathing
buildP('idle', 2.4, [[0, HSTANCE], [2.4, HSTANCE]], (t, c) => {
  const w = TAU * t / 2.4;
  c.hip[0] += 0.006 * Math.sin(w); c.hip[1] += 0.003 * (1 - Math.cos(2 * w)) / 2; c.hipYaw += 0.03 * Math.sin(w);
  c.Lh.at = c.Lh.at.map((x, i) => x + [0, 0.006 * Math.sin(w + 1), 0.004 * Math.cos(w)][i]);
  c.chin += 0.02 * Math.sin(2 * w);
});
// 1 / 2 ศรฉับไว · ศรพิษ: a quick shot (release at 0.4 s)
{
  const S = shot(SIDE, -0.075, 0.45), step = turnStep(0, f(5), 'L');
  buildP('hunter_shot', 1.0, [[0, HSTANCE], [f(5), S.nock, easeOut], [f(10), S.aim, easeIn], [f(11), S.aim], [f(12), S.loose, easeOut], [f(17), S.loose], [1.0, HSTANCE, ease]], step);
}
// 7 ศรกระจายเจ็ดดาว: a full draw, then the release sweeps across so the arrows fan out (0.47 s)
{
  const S = shot(SIDE, -0.075, 0.45);
  const sweepA = withP(S.aim, { twist: -0.35 }), sweepB = withP(S.loose, { twist: 0.2 });
  buildP('hunter_volley', 1.2, [[0, HSTANCE], [f(6), S.nock, easeOut], [f(11), sweepA, easeIn], [f(12), sweepA], [f(14), withP(S.aim, { twist: -0.05 }), easeIn], [f(17), sweepB, easeOut], [f(22), sweepB], [1.2, HSTANCE, ease]], turnStep(0, f(6), 'L'));
}
// 3 ศรทะลวงเกราะ: down on the right knee, a slow heavy draw, held, released at 0.9 s
{
  const KNEEL = { ...SIDE, hip: [0, 0.2, -0.02], lean: 0.06, L: { x: 0.03, z: 0.16, yaw: -1.2, heel: 0, up: 0 }, R: { x: -0.02, z: -0.17, yaw: -1.45, heel: 1.0, up: 0, pole: [0, -0.4, 1] } };
  const S = shot(KNEEL, -0.075, 0.45);
  buildP('hunter_power', 1.4, [[0, HSTANCE], [f(7), S.nock, ease], [f(20), S.aim, easeOut], [f(26), withP(S.aim, { chin: 0.08 })], [f(27), S.loose, easeOut], [f(33), S.loose], [1.4, HSTANCE, ease]], (t, c) => {
    if (t > f(20) && t < f(26)) c.Rh.at[2] -= 0.006 * Math.sin(TAU * 6 * (t - f(20)));   // the string hand trembles at full draw
  });
}
// 9 ศรสังหารเหยี่ยวราตรี: a long aim (breath held), released at 1.33 s with a recoil step
{
  const S = shot(SIDE, -0.075, 0.45);
  const recoil = withP(S.loose, { hip: [0, 0.03, -0.03], lean: -0.06, R: { ...SIDE.R, z: -0.15 } });
  buildP('hunter_snipe', 2.0, [[0, HSTANCE], [f(6), S.nock, easeOut], [f(18), S.aim, ease], [f(39), withP(S.aim, { lean: 0.04 })], [f(40), recoil, easeOut], [f(48), recoil], [2.0, HSTANCE, ease]], (t, c) => {
    turnStep(0, f(6), 'L')(t, c);
    if (t > f(18) && t < f(39)) { const k = Math.sin(TAU * 0.8 * (t - f(18))); c.hip[1] += 0.003 * k; c.Lh.at[1] += 0.003 * k; }
  });
}
// 5 ห่าฝนธนู: aimed high (≈ 55°), leaning back, released at 0.6 s
{
  const UP = { ...SIDE, lean: -0.25, chin: -0.5 };
  const S = shot(UP, 0.17, 0.32, -0.02);
  buildP('hunter_sky', 1.3, [[0, HSTANCE], [f(7), S.nock, easeOut], [f(15), S.aim, easeIn], [f(17), S.aim], [f(18), S.loose, easeOut], [f(24), S.loose], [1.3, HSTANCE, ease]], turnStep(0, f(7), 'L'));
}
// 10 ศรเพลิงอัคนีบาต: a step back, leaning far back, the arrow straight up (≈ 75°); a long
// burning draw, released at 1.1 s, and he watches it climb
{
  const UP = { ...SIDE, hip: [0, 0.04, -0.04], lean: -0.4, chin: -0.8, R: { ...SIDE.R, z: -0.16 } };
  const S = shot(UP, 0.33, 0.14, -0.04);
  buildP('hunter_meteor', 2.0, [[0, HSTANCE], [f(9), S.nock, ease], [f(27), S.aim, ease], [f(32), withP(S.aim, { lean: -0.43 })], [f(33), S.loose, easeOut], [f(45), withP(S.loose, { chin: -0.6 })], [2.0, HSTANCE, ease]], turnStep(0, f(9), 'R'));
}
// 4 ตาเหยี่ยว: the bow raised high in the left hand, the right hand shading the eyes,
// gaze far out (the hawk spirit answers at 0.8 s)
{
  const look = withP(HSTANCE, { hip: [0, 0.0, 0], hipYaw: -0.25, lean: -0.06, chin: -0.1, fist: [1, 0.15],
    Lh: { at: [0.16, 0.22, 0.06], pole: [1, -0.4, -0.2], palm: [-1, 0, 0], sh: 0.1 }, Rh: { at: [-0.01, 0.02, 0.1], pole: [-1, -0.1, 0.3], palm: [0, -1, 0.3], sh: 0.05 } });
  buildP('hunter_hawk', 1.6, [[0, HSTANCE], [f(12), look, ease], [f(24), withP(look, { hipYaw: -0.1 })], [f(36), withP(look, { hipYaw: -0.4 })], [1.6, HSTANCE, ease]]);
}
// 6 ลมใต้ปีกครุฑ: arms swept out like wings, up on the toes; the wings beat down at 0.9 s
{
  const wings = (y, up) => withP(HSTANCE, { hip: [0, -up, 0], hipYaw: -0.1, twist: 0, lean: -0.08, chin: -0.15, fist: [1, 0.1],
    L: { ...HSTANCE.L, heel: up * 9 }, R: { ...HSTANCE.R, yaw: -0.3, heel: up * 9 },
    Lh: { at: [0.42, y, 0.05], pole: [0, -1, -0.3], palm: [0, -1, 0], sh: 0.08 }, Rh: { at: [-0.42, y, 0.05], pole: [0, -1, -0.3], palm: [0, -1, 0], sh: 0.08 } });
  buildP('hunter_garuda', 1.8, [[0, HSTANCE], [f(14), wings(0.06, 0.03), ease], [f(27), wings(-0.16, 0.0), easeIn], [f(33), wings(-0.1, 0.01), easeOut], [f(42), wings(-0.12, 0.01)], [1.8, HSTANCE, ease]]);
}
// 8 กับดักหนามพราน: down into a deep crouch, the right hand sets the trap on the ground in
// front (0.6 s), then up and a step back
{
  const crouch = withP(HSTANCE, { hip: [0, 0.22, 0.02], hipYaw: -0.15, lean: 0.5, chin: -0.1, fist: [1, 0.1],
    L: { ...HSTANCE.L, z: 0.12 }, R: { ...HSTANCE.R, heel: 0.8 },
    Rh: { at: [-0.02, -0.55, 0.22], pole: [-0.5, 0.2, -1], palm: [0, -1, 0], sh: 0 }, Lh: { at: [0.18, -0.35, 0.02], pole: [0.3, -0.5, -1], palm: [-1, 0, 0], sh: 0 } });
  buildP('hunter_trap', 1.4, [[0, HSTANCE], [f(12), crouch, ease], [f(18), withP(crouch, { Rh: { ...crouch.Rh, at: [-0.02, -0.6, 0.24] } }), easeIn], [f(24), crouch], [1.4, HSTANCE, ease]]);
}
// Hit and knock-out (as the fighter's, from the hunter's ready stance)
const HHURT = withP(HSTANCE, { hip: [-0.005, 0.03, -0.04], lean: -0.22, chin: -0.2, hipYaw: -0.45, Lh: { ...HSTANCE.Lh, at: [0.14, -0.3, 0.08] }, Rh: { ...HSTANCE.Rh, at: [-0.1, -0.3, 0.06] } });
buildP('hurt', 0.5, [[0, HSTANCE], [0.08, HHURT, easeOut], [0.2, HHURT], [0.5, HSTANCE, ease]]);
{
  const slump = withP(HHURT, { hip: [0, 0.2, -0.06], lean: -0.1, fist: [0.6, 0.3],
    Lh: { at: [0.17, -0.42, 0.0], pole: [0.3, 0, -1], palm: [-1, 0, 0], sh: 0 }, Rh: { at: [-0.17, -0.42, -0.02], pole: [-0.3, 0, -1], palm: [0, 0, 1], sh: 0 } });
  const spread = withP(slump, { hip: [0, 0.05, -0.04], L: { ...HSTANCE.L, heel: 0, yaw: 0.3 }, R: { ...HSTANCE.R, heel: 0, yaw: -0.4 },
    Lh: { at: [0.3, -0.12, 0.0], pole: [0, -1, -0.3], palm: [-1, 0, 0], sh: 0 }, Rh: { at: [-0.3, -0.12, -0.02], pole: [0, -1, -0.3], palm: [0, 1, 0], sh: 0 } });
  buildP('die', 1.6, [[0, HSTANCE], [0.25, HHURT, easeOut], [0.6, slump, ease], [1.0, spread, ease], [1.6, spread]], null, (t, p) => {
    const u = ease(Math.min(1, Math.max(0, (t - 0.6) / 0.6)));
    rotWorld(R, p, B('Hips'), [1, 0, 0], -1.45 * u);
    const parts = ['Head', 'Spine2', 'Hips', 'LeftFoot', 'RightFoot', 'LeftLeg', 'RightLeg', 'LeftHand', 'RightHand'];
    const lowY = Math.min(...parts.map(n => worldPos(R, p, B(n)).y));
    lift(p, (0.06 - lowY) * u);
  });
}

// Rename locomotion, drop the fighter's prompt-named clips (the hunter has its own).
WALK.setName('walk'); RUN.setName('run');
for (const a of [JAB, COMBO, TEEP, KICK]) a.dispose();
const { prune, dedup } = await import('@gltf-transform/functions');
await R.doc.transform(prune(), dedup());
console.log(R.root.listAnimations().map(a => a.getName()).join(', '));
await R.io.write(process.argv[3] ?? 'public/models/hunter.glb', R.doc);
