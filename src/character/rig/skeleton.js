import * as THREE from 'three';

// Humanoid skeleton shared by every class. Bone names follow the Mixamo
// convention so clips can later be retargeted to or from Blender/Mixamo rigs.
// Every bone has an identity rest rotation, so bone-local axes equal character
// axes at rest: +X = character's left, +Y = up, +Z = forward. Arms and legs
// hang straight down at rest (I-pose), which keeps limb axes uniform.
export const BONES = [
  ['Hips', null, [0, .9, 0]],
  ['Spine', 'Hips', [0, .1, 0]],
  ['Spine1', 'Spine', [0, .12, 0]],
  ['Spine2', 'Spine1', [0, .12, 0]],
  ['Neck', 'Spine2', [0, .17, 0]],
  ['Head', 'Neck', [0, .08, 0]],
];
for (const [side, s] of [['Left', 1], ['Right', -1]]) {
  BONES.push(
    [`${side}Shoulder`, 'Spine2', [s * .035, .115, -.01]],
    [`${side}Arm`, `${side}Shoulder`, [s * .165, 0, 0]],
    [`${side}ForeArm`, `${side}Arm`, [0, -.27, 0]],
    [`${side}Hand`, `${side}ForeArm`, [0, -.25, 0]],
    [`${side}HandFingers1`, `${side}Hand`, [0, -.085, 0]],
    [`${side}HandFingers2`, `${side}HandFingers1`, [0, -.045, 0]],
    [`${side}HandThumb1`, `${side}Hand`, [-s * .008, -.03, .03]],
    [`${side}UpLeg`, 'Hips', [s * .09, -.04, 0]],
    [`${side}Leg`, `${side}UpLeg`, [0, -.4, 0]],
    [`${side}Foot`, `${side}Leg`, [0, -.39, 0]],
    [`${side}ToeBase`, `${side}Foot`, [0, -.05, .11]],
  );
}

export const DIM = {
  thigh: .4, shin: .39, ankleHeight: .07, toeForward: .11, toeDown: .05, heelBack: .05,
  hipHeight: .9, footLength: .25,
};

// Anatomical limits in degrees. Poses are clamped to these ranges before
// baking, and scripts/check-rig.mjs verifies every baked frame against them.
export const LIMITS = {
  spine: { pitch: [-25, 45], yaw: [-40, 40], lean: [-25, 25] },
  chest: { pitch: [-25, 40], yaw: [-40, 40], lean: [-25, 25] },
  neck: { pitch: [-40, 50], yaw: [-60, 60], lean: [-30, 30] },
  head: { pitch: [-30, 35], yaw: [-30, 30], lean: [-20, 20] },
  clav: { elevate: [-10, 30], protract: [-15, 25] },
  arm: { raise: [-60, 178], dir: [-75, 180], twist: [-80, 95] },
  fore: { flex: [0, 150], twist: [-85, 85] },
  hand: { flex: [-70, 80], dev: [-25, 35] },
  fingers: [0, 100], thumb: [0, 60],
  hip: { flex: [-35, 130], abduct: [-25, 65] },
  knee: [0, 150], ankle: [-50, 30], toe: [-30, 75],
};

const deg = THREE.MathUtils.degToRad;
const clamp = THREE.MathUtils.clamp;
const lim = (v, r) => clamp(v, r[0], r[1]);

export function createSkeleton() {
  const bones = {}, list = [];
  for (const [name, parent, offset] of BONES) {
    const bone = new THREE.Bone(); bone.name = name; bone.position.set(...offset);
    (parent ? bones[parent] : null)?.add(bone);
    bones[name] = bone; list.push(bone);
  }
  bones.Hips.updateMatrixWorld(true);
  const rest = {};
  for (const bone of list) rest[bone.name] = bone.getWorldPosition(new THREE.Vector3());
  return { bones, list, rest, root: bones.Hips };
}

// Every pose channel with its default value. Poses are flat objects of these
// channels; the animation baker interpolates them numerically.
export const CHANNELS = {
  rootX: 0, rootY: 0, rootZ: 0, rootPitch: 0, rootYaw: 0, rootRoll: 0,
  spinePitch: 0, spineYaw: 0, spineLean: 0, chestPitch: 0, chestYaw: 0, chestLean: 0,
  neckPitch: 0, neckYaw: 0, neckLean: 0, headPitch: 0, headYaw: 0, headLean: 0,
};
for (const s of ['L', 'R']) Object.assign(CHANNELS, {
  [`clav${s}Elevate`]: 0, [`clav${s}Protract`]: 0,
  [`arm${s}Raise`]: 6, [`arm${s}Dir`]: 90, [`arm${s}Twist`]: 0,
  [`fore${s}Flex`]: 10, [`fore${s}Twist`]: 0, [`hand${s}Flex`]: 0, [`hand${s}Dev`]: 0,
  [`fingers${s}`]: 25, [`thumb${s}`]: 15,
  // Feet are IK targets: ankle position in character space and foot orientation.
  [`foot${s}X`]: s === 'L' ? .1 : -.1, [`foot${s}Y`]: DIM.ankleHeight, [`foot${s}Z`]: 0,
  [`foot${s}Yaw`]: 0, [`foot${s}Pitch`]: 0, [`foot${s}Roll`]: 0,
  [`knee${s}Out`]: 0, [`toe${s}`]: 0, [`toe${s}Auto`]: 1,
});

// Short-hand used by pose authors: {armL:[raise,dir,twist], footR:[x,y,z,yaw,pitch]} etc.
const GROUPS = {
  root: ['rootX', 'rootY', 'rootZ', 'rootPitch', 'rootYaw', 'rootRoll'],
  spine: ['spinePitch', 'spineYaw', 'spineLean'], chest: ['chestPitch', 'chestYaw', 'chestLean'],
  neck: ['neckPitch', 'neckYaw', 'neckLean'], head: ['headPitch', 'headYaw', 'headLean'],
};
for (const s of ['L', 'R']) Object.assign(GROUPS, {
  [`clav${s}`]: [`clav${s}Elevate`, `clav${s}Protract`],
  [`arm${s}`]: [`arm${s}Raise`, `arm${s}Dir`, `arm${s}Twist`],
  [`fore${s}`]: [`fore${s}Flex`, `fore${s}Twist`], [`hand${s}`]: [`hand${s}Flex`, `hand${s}Dev`],
  [`grip${s}`]: [`fingers${s}`, `thumb${s}`],
  [`foot${s}`]: [`foot${s}X`, `foot${s}Y`, `foot${s}Z`, `foot${s}Yaw`, `foot${s}Pitch`, `foot${s}Roll`],
});
export function expandPose(short = {}) {
  const out = {};
  for (const [key, value] of Object.entries(short)) {
    if (GROUPS[key] && Array.isArray(value)) value.forEach((v, i) => { if (v !== null && v !== undefined) out[GROUPS[key][i]] = v; });
    else out[key] = value;
  }
  return out;
}
export function fullPose(...layers) {
  const pose = { ...CHANNELS };
  for (const layer of layers) Object.assign(pose, expandPose(layer));
  return pose;
}

// Clamp semantic channels to anatomical limits (positions are left alone).
export function clampPose(p) {
  const L = LIMITS;
  for (const [name, part] of [['spine', 'spine'], ['chest', 'chest'], ['neck', 'neck'], ['head', 'head']]) {
    p[`${name}Pitch`] = lim(p[`${name}Pitch`], L[part].pitch); p[`${name}Yaw`] = lim(p[`${name}Yaw`], L[part].yaw); p[`${name}Lean`] = lim(p[`${name}Lean`], L[part].lean);
  }
  for (const s of ['L', 'R']) {
    p[`clav${s}Elevate`] = lim(p[`clav${s}Elevate`], L.clav.elevate); p[`clav${s}Protract`] = lim(p[`clav${s}Protract`], L.clav.protract);
    p[`arm${s}Raise`] = lim(p[`arm${s}Raise`], L.arm.raise); p[`arm${s}Dir`] = lim(p[`arm${s}Dir`], L.arm.dir); p[`arm${s}Twist`] = lim(p[`arm${s}Twist`], L.arm.twist);
    p[`fore${s}Flex`] = lim(p[`fore${s}Flex`], L.fore.flex); p[`fore${s}Twist`] = lim(p[`fore${s}Twist`], L.fore.twist);
    p[`hand${s}Flex`] = lim(p[`hand${s}Flex`], L.hand.flex); p[`hand${s}Dev`] = lim(p[`hand${s}Dev`], L.hand.dev);
    p[`fingers${s}`] = lim(p[`fingers${s}`], L.fingers); p[`thumb${s}`] = lim(p[`thumb${s}`], L.thumb);
    p[`toe${s}`] = lim(p[`toe${s}`], L.toe); p[`foot${s}Pitch`] = clamp(p[`foot${s}Pitch`], -70, 40);
  }
  return p;
}

const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
const _m = new THREE.Matrix4(), _e = new THREE.Euler();
const DOWN = new THREE.Vector3(0, -1, 0), Y = new THREE.Vector3(0, 1, 0);
const spineEuler = (bone, pitch, yaw, lean) => bone.quaternion.setFromEuler(_e.set(deg(pitch), deg(yaw), -deg(lean), 'YXZ'));

// Swing-twist arm: raise = angle away from hanging (negative = behind),
// dir = azimuth (0 forward, 90 outward, negative across the body).
function armQuat(out, s, raise, dir, twist) {
  if (raise < 0) { raise = -raise; dir += 180; }
  const r = deg(raise), a = deg(dir);
  _v.set(s * Math.sin(r) * Math.sin(a), -Math.cos(r), Math.sin(r) * Math.cos(a));
  out.setFromUnitVectors(DOWN, _v);
  return out.multiply(_q2.setFromAxisAngle(Y, deg(s * twist)));
}

// Applies a full pose to the skeleton. Legs are solved with analytic two-bone
// IK so planted feet stay planted whatever the pelvis does.
export function applyPose(skel, p, report) {
  const b = skel.bones;
  b.Hips.position.set(p.rootX, DIM.hipHeight + p.rootY, p.rootZ);
  b.Hips.quaternion.setFromEuler(_e.set(deg(p.rootPitch), deg(p.rootYaw), -deg(p.rootRoll), 'YXZ'));
  spineEuler(b.Spine, p.spinePitch * .55, p.spineYaw * .5, p.spineLean * .55);
  spineEuler(b.Spine1, p.spinePitch * .45, p.spineYaw * .5, p.spineLean * .45);
  spineEuler(b.Spine2, p.chestPitch, p.chestYaw, p.chestLean);
  spineEuler(b.Neck, p.neckPitch, p.neckYaw, p.neckLean);
  spineEuler(b.Head, p.headPitch, p.headYaw, p.headLean);
  for (const [side, S, s] of [['Left', 'L', 1], ['Right', 'R', -1]]) {
    b[`${side}Shoulder`].quaternion.setFromEuler(_e.set(0, -s * deg(p[`clav${S}Protract`]), s * deg(p[`clav${S}Elevate`]), 'YXZ'));
    armQuat(b[`${side}Arm`].quaternion, s, p[`arm${S}Raise`], p[`arm${S}Dir`], p[`arm${S}Twist`]);
    b[`${side}ForeArm`].quaternion.setFromEuler(_e.set(-deg(p[`fore${S}Flex`]), s * deg(p[`fore${S}Twist`]), 0, 'YXZ'));
    b[`${side}Hand`].quaternion.setFromEuler(_e.set(-deg(p[`hand${S}Dev`]), 0, -s * deg(p[`hand${S}Flex`]), 'XZY'));
    const curl = deg(p[`fingers${S}`]);
    b[`${side}HandFingers1`].quaternion.setFromEuler(_e.set(0, 0, -s * curl));
    b[`${side}HandFingers2`].quaternion.setFromEuler(_e.set(0, 0, -s * curl * 1.1));
    b[`${side}HandThumb1`].quaternion.setFromEuler(_e.set(deg(p[`thumb${S}`]) * .4, 0, -s * deg(p[`thumb${S}`])));
  }
  b.Hips.updateMatrixWorld(true);
  for (const [side, S, s] of [['Left', 'L', 1], ['Right', 'R', -1]]) solveLeg(skel, side, S, s, p, report);
}

const _hip = new THREE.Vector3(), _target = new THREE.Vector3(), _knee = new THREE.Vector3(), _pole = new THREE.Vector3();
const _x = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3(), _footQ = new THREE.Quaternion();
const _hn = new THREE.Vector3(), _seg = new THREE.Vector3(), _fr = new THREE.Vector3();
function worldBasisQuat(out, downDir, forwardHint) {
  _y.copy(downDir).negate().normalize();
  _z.copy(forwardHint).addScaledVector(_y, -forwardHint.dot(_y));
  if (_z.lengthSq() < 1e-8) _z.set(0, 0, 1).addScaledVector(_y, -_y.z);
  _z.normalize(); _x.crossVectors(_y, _z);
  _m.makeBasis(_x, _y, _z); return out.setFromRotationMatrix(_m);
}
function setWorldQuat(bone, worldQ) {
  bone.parent.getWorldQuaternion(_q).invert();
  bone.quaternion.copy(_q).multiply(worldQ); bone.updateMatrixWorld(true);
}
function solveLeg(skel, side, S, s, p, report) {
  const up = skel.bones[`${side}UpLeg`], leg = skel.bones[`${side}Leg`], foot = skel.bones[`${side}Foot`], toe = skel.bones[`${side}ToeBase`];
  up.getWorldPosition(_hip);
  _target.set(p[`foot${S}X`], p[`foot${S}Y`], p[`foot${S}Z`]);
  const yaw = deg(p[`foot${S}Yaw`] * s), pitch = deg(p[`foot${S}Pitch`]);
  // Knee points over the toes, optionally splayed outward for wide stances.
  _pole.set(Math.sin(yaw) + s * p[`knee${S}Out`], 0, Math.cos(yaw)).normalize();
  const d = _v.subVectors(_target, _hip), dist = d.length();
  const a = DIM.thigh, c = DIM.shin, reach = Math.min(Math.max(dist, Math.abs(a - c) + 1e-3), (a + c) * .9995);
  if (report) report.reach = Math.max(report.reach || 0, dist - reach);
  d.normalize();
  const hipAngle = Math.acos(clamp((a * a + reach * reach - c * c) / (2 * a * reach), -1, 1));
  const perp = _v2.copy(_pole).addScaledVector(d, -_pole.dot(d)).normalize();
  _knee.copy(_hip).addScaledVector(d, a * Math.cos(hipAngle)).addScaledVector(perp, a * Math.sin(hipAngle));
  const ankle = _target.copy(_hip).addScaledVector(d, reach);
  // Each segment's front (+Z) lies in the bend plane, perpendicular to the
  // segment: robust even when the thigh points straight at the pole.
  const hingeN = _hn.crossVectors(perp, d);
  _seg.subVectors(_knee, _hip).normalize(); worldBasisQuat(_footQ, _seg, _fr.crossVectors(_seg, hingeN)); setWorldQuat(up, _footQ);
  _seg.subVectors(ankle, _knee).normalize(); worldBasisQuat(_footQ, _seg, _fr.crossVectors(_seg, hingeN)); setWorldQuat(leg, _footQ);
  // Foot orientation in character space: yaw, then pitch (toes up +), then roll.
  _footQ.setFromEuler(_e.set(-pitch, yaw, deg(p[`foot${S}Roll`]) * s, 'YXZ'));
  setWorldQuat(foot, _footQ);
  // Auto toe: when the heel lifts while the ball of the foot is near the ground
  // the toes bend to stay flat (toe-off), otherwise follow the manual channel.
  let toeBend = p[`toe${S}`];
  if (p[`toe${S}Auto`] > 0 && pitch < 0) {
    const toeY = ankle.y - Math.cos(-pitch) * DIM.toeDown - Math.sin(-pitch) * DIM.toeForward;
    const contact = clamp(1 - (toeY - .025) / .05, 0, 1);
    toeBend = Math.max(toeBend, THREE.MathUtils.radToDeg(-pitch) * contact * p[`toe${S}Auto`]);
  }
  toe.quaternion.setFromEuler(_e.set(-deg(Math.min(toeBend, LIMITS.toe[1])), 0, 0));
  toe.updateMatrixWorld(true);
}

export function poseSkeleton(skel, short) {
  const p = clampPose(fullPose(short)); applyPose(skel, p); return p;
}
