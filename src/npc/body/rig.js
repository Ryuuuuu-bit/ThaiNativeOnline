import * as THREE from 'three';

// Skeleton of a townsperson at scale 1 (about 1.72 m, six heads tall).
// Each NPC exposes one matrix per frame; body parts are modelled in the
// local space of their frame.
//   root   feet on the ground, facing +z      upper  chest, bends at the waist
//   head   base of the skull (neck top)       armL/R shoulder → elbow, foreL/R elbow → hand
//   legL/R hip → knee                          shinL/R knee → foot
export const RIG = {
  hipY: .88, hipX: .09, waistY: .92, thigh: .42, shin: .40,
  shoulderY: 1.37, shoulderX: .19, shoulderXF: .168, upperArm: .29, handY: -.31,
  neckY: 1.47,
  head: { y: .135, z: .01, rx: .1, ry: .13, rz: .115 },
};
export const FRAMES = ['root', 'upper', 'head', 'armL', 'armR', 'foreL', 'foreR', 'legL', 'legR', 'shinL', 'shinR'];

// Long tools are held with a straight right arm so they stay upright.
const LONG = ['spear', 'staff', 'paddle', 'rod', 'broom'];
export const straightRightArm = look => look.props.some(p => LONG.includes(p));

// Joint bends implied by the pose (the pose itself only swings hips and shoulders).
export const elbowBend = armX => .12 + Math.min(Math.max(-armX, 0), 1.6) * .28;
export const kneeBend = (legX, seated) => (seated ? .3 : legX > 0 ? legX * 1.3 : 0);

const t1 = new THREE.Matrix4(), t2 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);

// Fill npc.frames from npc.pose (position, yaw and scale from the NPC).
export function computeFrames(npc) {
  const p = npc.pose, f = npc.frames, look = npc.look, s = look.scale, R = RIG;
  const sx = look.female && !look.child ? R.shoulderXF : R.shoulderX, seated = p.y < -.3;
  f.root.compose(v.set(npc.x, npc.y + p.y * s, npc.z), q.setFromAxisAngle(up, npc.yaw), sc.set(s, s, s));
  f.upper.copy(f.root).multiply(t1.makeTranslation(0, R.waistY, 0)).multiply(t2.makeRotationX(p.bend)).multiply(t1.makeTranslation(0, -R.waistY, 0));
  f.head.copy(f.upper).multiply(t1.makeTranslation(0, R.neckY, 0)).multiply(t2.makeRotationY(p.headYaw)).multiply(t1.makeRotationX(p.headPitch));
  f.legL.copy(f.root).multiply(t1.makeTranslation(-R.hipX, R.hipY, 0)).multiply(t2.makeRotationX(p.legL));
  f.legR.copy(f.root).multiply(t1.makeTranslation(R.hipX, R.hipY, 0)).multiply(t2.makeRotationX(p.legR));
  f.shinL.copy(f.legL).multiply(t1.makeTranslation(0, -R.thigh, 0)).multiply(t2.makeRotationX(kneeBend(p.legL, seated)));
  f.shinR.copy(f.legR).multiply(t1.makeTranslation(0, -R.thigh, 0)).multiply(t2.makeRotationX(kneeBend(p.legR, seated)));
  f.armL.copy(f.upper).multiply(t1.makeTranslation(-sx, R.shoulderY, 0)).multiply(t2.makeRotationX(p.armLx)).multiply(t1.makeRotationZ(-p.armLz));
  f.armR.copy(f.upper).multiply(t1.makeTranslation(sx, R.shoulderY, 0)).multiply(t2.makeRotationX(p.armRx)).multiply(t1.makeRotationZ(p.armRz));
  f.foreL.copy(f.armL).multiply(t1.makeTranslation(0, -R.upperArm, 0)).multiply(t2.makeRotationX(-elbowBend(p.armLx)));
  const elbowR = npc.straightArm ? 0 : elbowBend(p.armRx);
  f.foreR.copy(f.armR).multiply(t1.makeTranslation(0, -R.upperArm, 0)).multiply(t2.makeRotationX(-elbowR));
}
