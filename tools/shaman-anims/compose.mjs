// Builds the shaman's (หมอผี · จอมขมังเวทย์) animations on the owner's own Tripo rig (Mixamo
// bone names, its own rest pose and weights; unarmed two-hand seals — see
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
// Unarmed locomotion: retain the retargeted arm swing, with relaxed hands.
function retargetClip(name, anim) {
  const d = duration(anim), frames = [];
  for (let i = 0; i <= Math.round(d * FPS); i++) {
    const p = retarget(sample(F, anim, i / FPS));
    fist(R, p, B, 'Left', .15); fist(R, p, B, 'Right', .15);
    frames.push(p);
  }
  writeAnim(R, name, frames, FPS);
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
// (the fighter's guard STANCE above is kept as the parameter template)
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


// --- Unarmed Thai occult caster: two-handed seals, then a clear release. ---
// Original gestures inspired by hand-sign spellcasting; no weapon or franchise symbols.
const H = (at, palm, side) => ({ at, palm, pole: [side * .65, -.65, -.3], sh: 0, flex: 0 });
const SSTANCE = {
  hip: [0, .012, 0], hipYaw: 0, twist: 0, lean: .025, side: 0, chin: .08, look: 1, fist: [.12, .12], seal: 0,
  L: { x: .075, z: .02, yaw: .12, heel: 0, up: 0 },
  R: { x: -.075, z: -.025, yaw: -.12, heel: 0, up: 0 },
  Lh: H([.12, -.32, .12], [-1, .2, .2], 1),
  Rh: H([-.12, -.32, .12], [1, .2, .2], -1),
};
const S = o => withP(SSTANCE, o);
const sealA = S({ fist: [.85, .85], seal: 1, chin: .14,
  Lh: H([.025, -.20, .145], [-1, 0, .2], 1), Rh: H([-.025, -.20, .145], [1, 0, .2], -1) });
const sealB = S({ fist: [.75, .75], seal: 1, chin: .10,
  Lh: H([.035, -.16, .17], [-1, 0, .1], 1), Rh: H([-.035, -.18, .14], [1, 0, .1], -1) });
const release = (kind, variant = 0) => {
  if (kind === 'guard') return S({ Lh: H([.14, -.17, .23], [0, 0, 1], 1), Rh: H([-.14, -.17, .23], [0, 0, 1], -1) });
  if (kind === 'ground') return S({ lean: .28, chin: .24, hip: [0, .055, 0],
    Lh: H([.14, -.42, .27], [0, -1, .1], 1), Rh: H([-.14, -.42, .27], [0, -1, .1], -1) });
  if (kind === 'summon') return S({ chin: -.10,
    Lh: H([.25, -.10, .15], [0, 1, .2], 1), Rh: H([-.25, -.10, .15], [0, 1, .2], -1) });
  return S({ twist: variant * .08, lean: .08,
    Lh: H([.10, -.22, .29], [0, 0, 1], 1), Rh: H([-.10, -.22, .29], [0, 0, 1], -1) });
};
// Straight index/middle fingers with curled ring/little fingers form the seal.
function sealFingers(p, weight) {
  for (const side of ['Left', 'Right']) for (const digit of ['Index', 'Middle']) for (let j = 1; j <= 3; j++) {
    const n = R.byName[B(side + 'Hand' + digit + j)]; if (n) p.get(n).r.slerp(REST.get(n).r, weight);
  }
}
buildP('idle', 2.6, [[0, SSTANCE], [2.6, SSTANCE]], (t, c) => {
  c.chin += .012 * Math.sin(TAU * t / 2.6); // feet and hips stay still
});
const spells = [
  ['shaman_akom', 1, .4, 'push'], ['shaman_yant', 1.1, .47, 'push'],
  ['shaman_ward', 1.4, .7, 'guard'], ['shaman_thunder', 1.2, .6, 'ground'],
  ['shaman_kalp', 2, .8, 'push'], ['shaman_holy', 1.8, .9, 'summon'],
  ['shaman_ghostfire', 1.2, .5, 'summon'], ['shaman_curse', 1.4, .63, 'ground'],
  ['shaman_storm', 2.2, .8, 'summon'],
];
for (const [name, dur, hit, kind] of spells) {
  const end = release(kind);
  buildP(name, dur, [[0, SSTANCE], [hit * .25, sealA], [hit * .55, sealB],
    [hit * .76, sealA], [hit, end], [dur * .86, end], [dur, SSTANCE]], null,
    (t, p) => { const w = t < hit * .76 ? Math.min(1, t / (hit * .25)) : Math.max(0, (hit - t) / (hit * .24)); sealFingers(p, w); });
}
const meditate = S({ hip: [0, .13, 0], chin: .20, fist: [0, 0],
  Lh: H([.025, -.30, .16], [0, 1, 0], 1), Rh: H([-.025, -.31, .16], [0, 1, 0], -1) });
buildP('shaman_meditate', 2, [[0, SSTANCE], [.35, sealA], [.7, meditate], [1.6, meditate], [2, SSTANCE]]);
const hurt = S({ lean: -.18, chin: -.14, hip: [0, .02, -.035] });
buildP('hurt', .5, [[0, SSTANCE], [.1, hurt], [.2, hurt], [.5, SSTANCE]]);
const fallen = S({ hip: [0, .18, -.06], lean: -.10,
  Lh: H([.25, -.30, 0], [-1, 0, 0], 1), Rh: H([-.25, -.30, 0], [1, 0, 0], -1) });
buildP('die', 1.6, [[0, SSTANCE], [.2, hurt], [.65, fallen], [1.6, fallen]], null, (t, p) => {
  const u = ease(Math.min(1, Math.max(0, (t - .45) / .7)));
  rotWorld(R, p, B('Hips'), [1, 0, 0], -1.45 * u);
  const parts = ['Head', 'Spine2', 'Hips', 'LeftFoot', 'RightFoot', 'LeftLeg', 'RightLeg', 'LeftHand', 'RightHand'];
  lift(p, (.06 - Math.min(...parts.map(n => worldPos(R, p, B(n)).y))) * u);
});
// Strip the weapon only in the generated output. The supplied source stays intact.
for (const node of R.root.listNodes()) if (/^staff$/i.test(node.getName())) node.dispose();

retargetClip('walk', WALK); retargetClip('run', RUN);
const { prune, dedup } = await import('@gltf-transform/functions');
await R.doc.transform(prune(), dedup());
console.log(R.root.listAnimations().map(a => a.getName()).join(', '));
await R.io.write(process.argv[3] ?? 'public/models/shaman.glb', R.doc);
