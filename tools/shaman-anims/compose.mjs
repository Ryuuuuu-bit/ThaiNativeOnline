// Builds the shaman's (หมอผี · จอมขมังเวทย์) animations on the owner's own Tripo rig (Mixamo
// bone names, its own rest pose and weights; the skull staff parented to the right hand — see
// README.md). The procedural pose builder (fighter() below) works in world space, so it drives
// this skeleton as it is; walk and run are the Muay Thai fighter's clips retargeted onto it.
import { load, sample, clone, blend, worldPos, worldQuat, rotWorld, writeAnim, legIK, fist, hingeLimb, duration, THREE } from '../muaythai-anims/lib.mjs';
const R = await load(process.argv[2] ?? 'tools/shaman-anims/shaman-tripo.glb');
const F = await load('tools/muaythai-anims/fighter-tripo.glb');
const findF = re => Object.values(F.anims).find(a => re.test(a.getName()));
const TEEP = findF(/teep/), WALK = findF(/^walk/), RUN = findF(/^run/);
const B = n => 'mixamorig:' + n;
const HIPS = R.byName[B('Hips')];
const FPS = 30, TAU = Math.PI * 2;

// --- retarget: the fighter's world-space bone turns, applied on top of this rig's rest ------
const restOf = M => new Map(M.nodes.map(n => [n, { t: new THREE.Vector3(...n.getTranslation()), r: new THREE.Quaternion(...n.getRotation()), s: new THREE.Vector3(...n.getScale()) }]));
const REST_R = restOf(R), REST_F = restOf(F);
const order = [];   // parents before children
(function walk(n) { order.push(n); n.listChildren().forEach(walk); })(R.byName[B('Hips')]);
const HIP_K = worldPos(R, REST_R, B('Hips')).y / worldPos(F, REST_F, B('Hips')).y;
function retarget(pf) {
  const p = clone(REST_R), wq = new Map();
  for (const n of order) {
    const name = n.getName(), fn = F.byName[name], par = R.parent.get(n);
    const parW = wq.get(par) ?? (par ? worldQuat(R, p, par) : new THREE.Quaternion());
    let w;
    if (fn && /^mixamorig/.test(name)) { const d = worldQuat(F, pf, fn).multiply(worldQuat(F, REST_F, fn).invert()); w = d.multiply(worldQuat(R, REST_R, n)); }
    else w = parW.clone().multiply(p.get(n).r);
    p.get(n).r.copy(parW.clone().invert().multiply(w)).normalize(); wq.set(n, w);
  }
  const hf = pf.get(F.byName[B('Hips')]).t, hf0 = REST_F.get(F.byName[B('Hips')]).t;
  p.get(HIPS).t.copy(REST_R.get(HIPS).t).add(hf.clone().sub(hf0).multiplyScalar(HIP_K));
  return p;
}
// walking and running he keeps the staff upright at his side (the right arm is re-posed
// from the stance each frame; the rest of the body is the fighter's clip)
function retargetClip(name, anim) {
  const d = duration(anim), frames = [];
  for (let i = 0; i <= Math.round(d * FPS); i++) {
    const p = retarget(sample(F, anim, i / FPS)), h = SSTANCE.Rh, head = worldPos(R, p, B('Head'));
    armIK(p, 'R', head.clone().add(new THREE.Vector3(...h.at)), h.pole);
    hand(p, 'R', bladePalm(p, 'R', h.blade)); fist(R, p, B, 'Right', 1); tiltBlade(p, 'R'); TILT.R = null;
    frames.push(p);
  }
  writeAnim(R, name, frames, FPS, ['staff']);
}

// --- poses -----------------------------------------------------------------
const G = retarget(sample(F, TEEP, 0));               // the fighter's guard, for the ground line
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
// The staff runs through the right fist and out of the thumb side, skull end first (see
// README.md), so a `blade` (= staff, skull-ward) direction fixes the hand's roll:
// left palm = forearm × blade, right palm = blade × forearm.
// The blade need not stand square to the forearm: whatever it leans toward the forearm's
// line (the sword lies diagonally across the palm, and the wrist cocks) is kept as `TILT`
// and applied after the fist closes — split between the wrist and the grip.
const TILT = {}, TOOL = { R: 'staff' };
function bladePalm(p, S, blade) {
  const fore = worldPos(R, p, B((S === 'L' ? 'Left' : 'Right') + 'Hand')).sub(worldPos(R, p, B((S === 'L' ? 'Left' : 'Right') + 'ForeArm'))).normalize();
  const want = v3(...blade).normalize(), b = want.clone().sub(fore.clone().multiplyScalar(want.dot(fore)));
  if (b.lengthSq() < 1e-6) b.set(0, 1, 0).sub(fore.clone().multiplyScalar(fore.y));
  b.normalize();
  TILT[S] = { perp: b, fore, want, a: THREE.MathUtils.clamp(Math.atan2(want.dot(fore), want.dot(b)), -0.45, 1.25) };
  return (S === 'L' ? fore.clone().cross(b) : b.clone().cross(fore)).toArray();
}
function tiltBlade(p, S) {
  const t = TILT[S]; if (!t || Math.abs(t.a) < 1e-3) return;
  const axis = t.perp.clone().cross(t.fore).normalize().toArray();
  rotWorld(R, p, B((S === 'L' ? 'Left' : 'Right') + 'Hand'), axis, t.a * 0.35);
  if (TOOL[S]) rotWorld(R, p, TOOL[S], axis, t.a * 0.65);
  // a staff turns loosely in the fist: whatever the hand still misses is taken up by the
  // grip (≤ 45°), so the staff ends up where it was asked to point
  if (TOOL[S]) {
    const node = R.byName[TOOL[S]], d = STAFF_AXIS.clone().applyQuaternion(worldQuat(R, p, node));
    const ang = d.angleTo(t.want); if (ang < 1e-3) return;
    const ax = d.clone().cross(t.want).normalize().toArray();
    rotWorld(R, p, TOOL[S], ax, Math.min(ang, 0.8));
  }
}
// the staff's skull-ward axis in its own node frame (the rest world +Z, see README.md)
const STAFF_AXIS = (() => { const n = R.byName.staff; const R0 = new Map(R.nodes.map(m => [m, { t: new THREE.Vector3(...m.getTranslation()), r: new THREE.Quaternion(...m.getRotation()), s: new THREE.Vector3(...m.getScale()) }]));
  return new THREE.Vector3(0, 0, 1).applyQuaternion(worldQuat(R, R0, n).invert()); })();
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
// (the fighter's guard STANCE above is kept as the parameter template)
// keys: [t, params, ease]; extra(t, params) may tweak the params per frame (a bounce, a
// foot lifting on a step); post(t, pose) may change the finished pose (the fall in 'die').
// DBG=1: how far each keyed staff direction is from what the hand can give it (degrees)
const REST0 = new Map(R.nodes.map(n => [n, { t: new THREE.Vector3(...n.getTranslation()), r: new THREE.Quaternion(...n.getRotation()), s: new THREE.Vector3(...n.getScale()) }]));
function checkStaff(name, keys) {
  if (!process.env.DBG) return;
  const node = R.byName.staff; if (!node) return;
  const q0 = worldQuat(R, REST0, node);
  keys.forEach(([t, c]) => { if (!c.Rh?.blade) return; const p = fighter(c), q1 = worldQuat(R, p, node);
    const d = new THREE.Vector3(0, 0, 1).applyQuaternion(q0.clone().invert()).applyQuaternion(q1), w = new THREE.Vector3(...c.Rh.blade).normalize();
    const err = THREE.MathUtils.radToDeg(d.angleTo(w)); if (err > 15) console.log(name, 't=' + t.toFixed(2), 'staff off by', err.toFixed(0) + '°', 'got', d.toArray().map(x => x.toFixed(2)).join(','), 'want', c.Rh.blade.join(',')); });
}
function buildP(name, dur, keys, extra, post) {
  checkStaff(name, keys.map(([t, c]) => [t, norm(c)]));
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
  return writeAnim(R, name, frames, FPS, ['staff']);
}
const spinY = (p, a) => rotWorld(R, p, B('Hips'), [0, 1, 0], a);
const bump = (t, c, w) => Math.max(0, 1 - Math.abs(t - c) / w);               // triangle 0..1
const arcLift = (t, t0, t1, h) => (t > t0 && t < t1 ? Math.sin(Math.PI * (t - t0) / (t1 - t0)) * h : 0);


// --- the shaman ----------------------------------------------------------------------
// The skull staff in the right fist (thumb side = skull end), the left hand free for the
// mudras and the casting. Hands: { at (from the head), pole (elbow), palm } for the left,
// { at, pole, blade (staff direction, skull-ward) } for the right. Clip timings (n / 30 s)
// match src/classes/shaman-moves.js, where the FX lands each spell.
const f = n => n / 30;
const Hl = (at, pole, palm, sh = 0) => ({ at, pole, palm, sh });
const Hr = (at, pole, blade, sh = 0) => ({ at, pole, blade, palm: [0, -1, 0], sh });
const SSTANCE = {
  hip: [0, 0.012, 0], hipYaw: -0.25, twist: -0.05, lean: 0.06, side: 0, chin: 0.12, look: 1, fist: [0.25, 1],
  L: { x: 0.08, z: 0.05, yaw: -0.1, heel: 0, up: 0 },
  R: { x: -0.085, z: -0.04, yaw: -0.45, heel: 0, up: 0 },
  Lh: Hl([0.2, -0.45, 0.05], [0.3, -0.4, -1], [-1, 0, 0.2]),
  Rh: Hr([-0.16, -0.33, 0.2], [-0.15, -1, -0.5], [0, 1, 0.02]),   // elbow at the side, forearm level: the staff stands upright
};
const S = o => withP(SSTANCE, o);

buildP('idle', 2.6, [[0, SSTANCE], [2.6, SSTANCE]], (t, c) => {
  const w = TAU * t / 2.6;
  c.hip[1] += 0.004 * (1 - Math.cos(2 * w)) / 2; c.hipYaw += 0.03 * Math.sin(w); c.chin += 0.025 * Math.sin(2 * w);
  c.Lh.at = c.Lh.at.map((x, i) => x + [0.004 * Math.sin(w), 0.006 * Math.sin(w + 1), 0][i]);
});

// 1 คาถาอาคม: draw the staff back, then drive the skull at the target; three fireballs leave it (0.4)
{
  const back = S({ twist: -0.25, lean: -0.04, Rh: Hr([-0.15, -0.08, -0.02], [-0.6, -0.3, -1], [0, 1, -0.35]), Lh: Hl([0.04, -0.24, 0.16], [0.6, -0.6, -0.4], [0, 0, 1]), fist: [0.1, 1] });
  const thrust = S({ hip: [0, 0.03, 0.04], twist: 0.15, lean: 0.18, L: { ...SSTANCE.L, z: 0.12 },
    Rh: Hr([-0.07, -0.22, 0.44], [-0.5, -0.6, -0.3], [0, 0.2, 1]), Lh: Hl([0.12, -0.28, 0.14], [0.6, -0.6, -0.4], [0, 0, 1]), fist: [0.1, 1] });
  buildP('shaman_akom', 1.0, [[0, SSTANCE], [f(8), back, easeOut], [f(12), thrust, easeIn], [f(20), thrust], [1.0, SSTANCE, ease]]);
}
// 2 ยันต์ตรึงวิญญาณ: the left hand draws three talismans from the right shoulder and flings them (0.47)
{
  const draw = S({ twist: -0.35, hipYaw: -0.4, Lh: Hl([-0.1, -0.14, 0.06], [0.5, -0.3, -1], [0, 0, -1]), fist: [0.4, 1] });
  const fling = S({ twist: 0.3, hipYaw: -0.1, lean: 0.12, L: { ...SSTANCE.L, z: 0.11 }, Lh: Hl([0.33, -0.16, 0.34], [0.6, -0.8, 0], [0, -0.3, 1]), fist: [0, 1] });
  buildP('shaman_yant', 1.1, [[0, SSTANCE], [f(9), draw, easeOut], [f(14), fling, easeIn], [f(22), fling], [1.1, SSTANCE, ease]]);
}
// 3 เกราะยันต์เก้ายอด: the staff planted before him, the left hand raised palm-out in a mudra (0.7)
{
  const ward = S({ hipYaw: -0.1, twist: 0, lean: 0.08, chin: 0.25, Rh: Hr([-0.08, -0.26, 0.3], [-0.4, -1, -0.4], [0, 1, 0]), Lh: Hl([0.08, -0.08, 0.24], [0.8, -0.6, -0.3], [0, 0, 1]), fist: [0, 1] });
  buildP('shaman_ward', 1.4, [[0, SSTANCE], [f(14), withP(ward, { Rh: { ...ward.Rh, at: [-0.08, -0.18, 0.3] } }), ease], [f(21), ward, easeIn], [f(34), ward], [1.4, SSTANCE, ease]]);
}
// 4 อัสนีบาต: the staff thrust to the sky, then brought down to point at the target as the bolt falls (0.6)
{
  const sky = S({ lean: -0.12, chin: -0.35, Rh: Hr([-0.1, 0.3, 0.08], [-1, 0.1, -0.2], [0, 1, 0.2], 0.12), Lh: Hl([0.22, -0.3, 0.12], [0.6, -0.4, -0.6], [-0.5, -0.5, 0.5]), fist: [0.1, 1] });
  const point = S({ lean: 0.12, chin: 0.05, Rh: Hr([-0.06, -0.06, 0.4], [-0.7, -0.4, -0.3], [0, 0.35, 1]), Lh: Hl([0.14, -0.3, 0.12], [0.6, -0.6, -0.4], [0, -1, 0.3]), fist: [0.1, 1] });
  buildP('shaman_thunder', 1.2, [[0, SSTANCE], [f(12), sky, ease], [f(15), sky], [f(18), point, easeIn], [f(26), point], [1.2, SSTANCE, ease]]);
}
// 5 เพลิงกัลป์ปราบผี: both arms up, calling the fire, then the staff slammed down ahead; the left
// palm pushes the four waves on (0.8, 1.03, 1.27, 1.5)
{
  const call = S({ lean: -0.15, chin: -0.4, Rh: Hr([-0.12, 0.28, 0.04], [-1, 0.2, -0.3], [0.25, 1, 0], 0.12), Lh: Hl([0.16, 0.28, 0.04], [1, 0.2, -0.3], [0, 0, 1], 0.12), fist: [0, 1] });
  const slam = S({ hip: [0, 0.08, 0.05], lean: 0.3, chin: 0.1, L: { ...SSTANCE.L, z: 0.14 }, R: { ...SSTANCE.R, heel: 0.3 },
    Rh: Hr([-0.06, -0.38, 0.36], [-0.7, -0.4, -0.4], [0, -0.1, 1]), Lh: Hl([0.12, -0.2, 0.42], [0.6, -0.8, 0], [0, 0, 1]), fist: [0, 1] });
  buildP('shaman_kalp', 2.0, [[0, SSTANCE], [f(14), call, ease], [f(19), call], [f(23), slam, easeIn], [f(48), slam], [2.0, SSTANCE, ease]], (t, c) => {
    for (const h of [24, 31, 38, 45]) { const u = bump(t, f(h), f(3)); c.Lh.at[2] += 0.05 * u; c.hip[1] += 0.01 * u; }
  });
}
// 6 น้ำมนต์ธาราทิพย์: head bowed over a one-handed wai, the staff upright; then the left hand opens
// and sprinkles the holy water out over the party (0.9)
{
  const pray = S({ hipYaw: -0.1, twist: 0, lean: 0.1, chin: 0.35, Rh: Hr([-0.13, -0.3, 0.22], [-0.3, -1, -0.5], [0, 1, 0]), Lh: Hl([0.02, -0.22, 0.14], [0.8, -0.6, -0.4], [-1, 0, 0]), fist: [0, 1] });
  const sprinkle = S({ hipYaw: -0.1, twist: 0.1, lean: -0.04, chin: -0.1, Rh: Hr([-0.13, -0.3, 0.22], [-0.3, -1, -0.5], [0, 1, 0]), Lh: Hl([0.28, -0.08, 0.3], [0.8, -0.6, 0], [0, 1, 0.3]), fist: [0, 1] });
  buildP('shaman_holy', 1.8, [[0, SSTANCE], [f(12), pray, ease], [f(23), pray], [f(27), sprinkle, easeOut], [f(40), sprinkle], [1.8, SSTANCE, ease]]);
}
// 7 ไฟผีห้าทิศ: the staff swept across in a flat arc, scattering five ghost fires (0.5)
{
  const wind = S({ twist: 0.45, hipYaw: -0.05, Rh: Hr([0.12, -0.2, 0.2], [-0.6, -0.6, -0.6], [1, 0.25, 0.4]), Lh: Hl([0.3, -0.35, -0.05], [0.4, -0.6, -1], [0, -1, 0]), fist: [0.1, 1] });
  const sweep = S({ twist: -0.45, hipYaw: -0.4, lean: 0.12, Rh: Hr([-0.32, -0.2, 0.25], [-0.6, -0.6, 0], [-1, 0.25, 0.5]), Lh: Hl([0.25, -0.3, 0.15], [0.6, -0.6, -0.4], [0, -1, 0.3]), fist: [0.1, 1] });
  buildP('shaman_ghostfire', 1.2, [[0, SSTANCE], [f(9), wind, easeOut], [f(15), sweep, easeIn], [f(23), sweep], [1.2, SSTANCE, ease]]);
}
// 8 คำสาปพรายตานี: both hands raised, then hunched forward — the staff's skull to the ground toward the
// target, the left hand a clawing grip that drags the curse up (0.63)
{
  const raise = S({ lean: -0.1, chin: -0.2, Rh: Hr([-0.14, 0.12, 0.1], [-1, -0.2, -0.3], [0, 1, 0.3]), Lh: Hl([0.16, 0.12, 0.1], [1, -0.2, -0.3], [0, 0, 1]), fist: [0.2, 1] });
  const curse = S({ hip: [0, 0.07, 0.03], lean: 0.4, chin: 0.15, L: { ...SSTANCE.L, z: 0.12 },
    Rh: Hr([-0.06, -0.36, 0.36], [-0.7, -0.3, -0.4], [0, -0.65, 0.75]), Lh: Hl([0.12, -0.26, 0.44], [0.6, -0.8, 0], [0, -1, 0.2]), fist: [0.65, 1] });
  buildP('shaman_curse', 1.4, [[0, SSTANCE], [f(11), raise, ease], [f(19), curse, easeIn], [f(32), curse], [1.4, SSTANCE, ease]], (t, c) => {
    if (t > f(19) && t < f(32)) c.Lh.at[1] += 0.03 * Math.sin(Math.PI * (t - f(19)) / f(13));   // the claw drags upward
  });
}
// 9 สมาธิกสิณไฟ: he sits cross-legged, the staff upright at his right, the left hand palm-up in his lap;
// the fire kasina kindles before him (1.0)
{
  const sit = S({ hip: [0, 0.37, 0.0], hipYaw: 0, twist: 0, lean: 0.04, chin: 0.2,
    L: { x: -0.07, z: 0.13, yaw: -1.35, heel: 0, up: 0.02, pole: [1, 0.5, 0.6] }, R: { x: 0.07, z: 0.08, yaw: 1.35, heel: 0, up: 0.02, pole: [-1, 0.5, 0.6] },
    Rh: Hr([-0.2, -0.06, 0.16], [-0.5, -1, -0.3], [0, 1, 0]), Lh: Hl([0.04, -0.5, 0.17], [0.8, -0.4, -0.4], [0, 1, 0]), fist: [0, 1] });   // staff held up so its foot stays on the ground
  buildP('shaman_meditate', 2.0, [[0, SSTANCE], [f(14), sit, ease], [f(46), sit], [2.0, SSTANCE, ease]], (t, c) => {
    if (t > f(14) && t < f(46)) c.hip[1] -= 0.012 * Math.sin(TAU * (t - f(14)) / 1.1);   // breathing
  });
}
// 10 พายุอัสนีเทพ: the staff held high, the left hand open to the sky, turning slowly as the storm
// breaks round him in five waves (0.8 … 1.87)
{
  const storm = S({ hipYaw: 0, twist: 0, lean: -0.12, chin: -0.4, L: { x: 0.1, z: 0.04, yaw: 0, heel: 0, up: 0 }, R: { x: -0.1, z: -0.04, yaw: -0.2, heel: 0, up: 0 },
    Rh: Hr([-0.1, 0.32, 0.04], [-1, 0.1, -0.2], [0, 1, 0.1], 0.12), Lh: Hl([0.28, 0.12, 0.08], [1, -0.2, -0.3], [0, 1, 0], 0.08), fist: [0, 1] });
  buildP('shaman_storm', 2.2, [[0, SSTANCE], [f(14), storm, ease], [f(60), storm], [2.2, SSTANCE, ease]], (t, c) => {
    for (const h of [24, 32, 40, 48, 56]) { const u = bump(t, f(h), f(3)); c.Rh.at[1] += 0.03 * u; c.hip[1] += 0.012 * u; }
  });
}
// Hit and knock-out (from the shaman's stance)
const SHURT = S({ hip: [-0.005, 0.03, -0.05], lean: -0.22, chin: -0.2, Lh: Hl([0.2, -0.3, 0.06], [0.5, -0.5, -0.6], [-1, 0, 0.3]), Rh: Hr([-0.17, -0.3, 0.14], [-0.2, -1, -0.5], [0, 1, 0.3]) });
buildP('hurt', 0.5, [[0, SSTANCE], [0.08, SHURT, easeOut], [0.2, SHURT], [0.5, SSTANCE, ease]]);
{
  const slump = S({ hip: [0, 0.2, -0.06], lean: -0.1, Lh: Hl([0.2, -0.45, 0.0], [0.3, 0, -1], [-1, 0, 0]), Rh: Hr([-0.2, -0.45, -0.02], [-0.3, 0, -1], [0.3, 0.6, 0.6]) });
  const spread = withP(slump, { hip: [0, 0.05, -0.04], L: { ...SSTANCE.L, heel: 0, yaw: 0.3 }, R: { ...SSTANCE.R, heel: 0, yaw: -0.4 },
    Lh: Hl([0.32, -0.12, 0.0], [0, -1, -0.3], [-1, 0, 0]), Rh: Hr([-0.32, -0.12, -0.02], [0, -1, -0.3], [-0.6, 0, 0.8]) });
  buildP('die', 1.6, [[0, SSTANCE], [0.25, SHURT, easeOut], [0.6, slump, ease], [1.0, spread, ease], [1.6, spread]], null, (t, p) => {
    const u = ease(Math.min(1, Math.max(0, (t - 0.6) / 0.6)));
    rotWorld(R, p, B('Hips'), [1, 0, 0], -1.45 * u);
    const parts = ['Head', 'Spine2', 'Hips', 'LeftFoot', 'RightFoot', 'LeftLeg', 'RightLeg', 'LeftHand', 'RightHand'];
    lift(p, (0.06 - Math.min(...parts.map(n => worldPos(R, p, B(n)).y))) * u);
  });
}

retargetClip('walk', WALK); retargetClip('run', RUN);
const { prune, dedup } = await import('@gltf-transform/functions');
await R.doc.transform(prune(), dedup());
console.log(R.root.listAnimations().map(a => a.getName()).join(', '));
await R.io.write(process.argv[3] ?? 'public/models/shaman.glb', R.doc);
