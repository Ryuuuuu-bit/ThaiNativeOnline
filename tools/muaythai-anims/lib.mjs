import { NodeIO } from '@gltf-transform/core';
import * as THREE from 'three';
export { THREE };
export async function load(path) {
  const io = new NodeIO(); const doc = await io.read(path); const root = doc.getRoot();
  const nodes = root.listNodes(); const byName = Object.fromEntries(nodes.map(n => [n.getName(), n]));
  const parent = new Map(); nodes.forEach(n => n.listChildren().forEach(c => parent.set(c, n)));
  const anims = Object.fromEntries(root.listAnimations().map(a => [a.getName(), a]));
  return { io, doc, root, nodes, byName, parent, anims };
}
// Sample an animation at time t -> Map(node -> {t:Vector3, r:Quaternion, s:Vector3})
export function sample(R, anim, t) {
  const pose = new Map();
  for (const n of R.nodes) pose.set(n, { t: new THREE.Vector3(...n.getTranslation()), r: new THREE.Quaternion(...n.getRotation()), s: new THREE.Vector3(...n.getScale()) });
  for (const ch of anim.listChannels()) {
    const s = ch.getSampler(), inp = s.getInput().getArray(), out = s.getOutput().getArray(), path = ch.getTargetPath();
    const k = path === 'rotation' ? 4 : 3; const n = inp.length;
    let i = 0; while (i < n - 1 && inp[i + 1] <= t) i++;
    const j = Math.min(i + 1, n - 1); const u = j === i ? 0 : Math.min(1, Math.max(0, (t - inp[i]) / (inp[j] - inp[i])));
    const p = pose.get(ch.getTargetNode());
    if (path === 'rotation') { const a = new THREE.Quaternion().fromArray(out, i * 4), b = new THREE.Quaternion().fromArray(out, j * 4); p.r.copy(a.slerp(b, u)); }
    else { const a = new THREE.Vector3().fromArray(out, i * 3), b = new THREE.Vector3().fromArray(out, j * 3); (path === 'translation' ? p.t : p.s).copy(a.lerp(b, u)); }
  }
  return pose;
}
export const duration = anim => Math.max(...anim.listSamplers().map(s => { const a = s.getInput().getArray(); return a[a.length - 1]; }));
export function clone(pose) { const m = new Map(); for (const [n, p] of pose) m.set(n, { t: p.t.clone(), r: p.r.clone(), s: p.s.clone() }); return m; }
export function blend(a, b, u) { const m = new Map(); for (const [n, p] of a) { const q = b.get(n); m.set(n, { t: p.t.clone().lerp(q.t, u), r: p.r.clone().slerp(q.r, u), s: p.s.clone().lerp(q.s, u) }); } return m; }
export function worldMatrix(R, pose, node) {
  const m = new THREE.Matrix4(); let n = node; const chain = [];
  while (n) { chain.unshift(n); n = R.parent.get(n); }
  for (const c of chain) { const p = pose.get(c); m.multiply(new THREE.Matrix4().compose(p.t, p.r, p.s)); }
  return m;
}
export function worldQuat(R, pose, node) { const q = new THREE.Quaternion(); let n = node; const chain = []; while (n) { chain.unshift(n); n = R.parent.get(n); } for (const c of chain) q.multiply(pose.get(c).r); return q; }
export function worldPos(R, pose, name) { return new THREE.Vector3().setFromMatrixPosition(worldMatrix(R, pose, R.byName[name])); }
// Rotate a bone about a world (armature-space) axis by angle, in place.
export function rotWorld(R, pose, name, axis, angle) {
  const node = R.byName[name], par = R.parent.get(node);
  const Pw = par ? worldQuat(R, pose, par) : new THREE.Quaternion();
  const Rw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(...axis).normalize(), angle);
  const p = pose.get(node); p.r.premultiply(Pw.clone().invert().multiply(Rw).multiply(Pw)).normalize();
}
// Write a list of poses (sampled at fps) as a new animation.
// `extra`: node names outside the skin to key as well (e.g. a weapon turning in the hand).
export function writeAnim(R, name, frames, fps, extra = []) {
  const { doc } = R; const buf = doc.getRoot().listBuffers()[0];
  const anim = doc.createAnimation(name);
  const times = new Float32Array(frames.length).map((_, i) => i / fps);
  const input = doc.createAccessor().setType('SCALAR').setArray(times).setBuffer(buf);
  const joints = [...R.root.listSkins()[0].listJoints(), ...extra.map(n => R.byName[n]).filter(Boolean)];
  for (const n of joints) for (const path of ['translation', 'rotation']) {
    const k = path === 'rotation' ? 4 : 3, arr = new Float32Array(frames.length * k);
    frames.forEach((f, i) => { const p = f.get(n); (path === 'rotation' ? p.r : p.t).toArray(arr, i * k); });
    const out = doc.createAccessor().setType(k === 4 ? 'VEC4' : 'VEC3').setArray(arr).setBuffer(buf);
    const s = doc.createAnimationSampler().setInput(input).setOutput(out).setInterpolation('LINEAR');
    anim.addSampler(s).addChannel(doc.createAnimationChannel().setTargetNode(n).setTargetPath(path).setSampler(s));
  }
  return anim;
}
// Two-bone leg IK: put `side`'s foot ('Left'/'Right') at world position `target`
// (Vector3, armature space), knee bending toward `pole` (world direction), and
// keep the foot's world orientation `footQ` (Quaternion) so the sole stays flat.
// `B(name)` maps a bone name to the rig's node name.
export function legIK(R, pose, B, side, target, footQ, pole = [0, 0, 1]) {
  const up = R.byName[B(side + 'UpLeg')], kn = R.byName[B(side + 'Leg')], ft = R.byName[B(side + 'Foot')];
  const H = worldPos(R, pose, up.getName()), K = worldPos(R, pose, kn.getName()), F = worldPos(R, pose, ft.getName());
  const a = H.distanceTo(K), b = K.distanceTo(F);
  const toT = target.clone().sub(H); const d = Math.min(toT.length(), a + b - 1e-4); const n = toT.normalize();
  const along = (a * a - b * b + d * d) / (2 * d), h = Math.sqrt(Math.max(0, a * a - along * along));
  const p = new THREE.Vector3(...pole); p.sub(n.clone().multiplyScalar(p.dot(n))).normalize();
  const knee = H.clone().add(n.clone().multiplyScalar(along)).add(p.multiplyScalar(h));
  const foot = H.clone().add(n.clone().multiplyScalar(d));
  const aimTo = (node, child, want) => {
    const s = worldPos(R, pose, node.getName()), c = worldPos(R, pose, child.getName());
    const q = new THREE.Quaternion().setFromUnitVectors(c.sub(s).normalize(), want.clone().normalize());
    const ax = new THREE.Vector3(q.x, q.y, q.z), sl = ax.length(); if (sl < 1e-7) return;
    rotWorld(R, pose, node.getName(), ax.divideScalar(sl).toArray(), 2 * Math.atan2(sl, q.w));
  };
  hingeLimb(R, pose, B, side + 'UpLeg', side + 'Leg', side + 'Foot', knee.clone().sub(H).toArray(), foot.clone().sub(knee).toArray());
  if (footQ) { const pq = worldQuat(R, pose, R.parent.get(ft)); pose.get(ft).r.copy(pq.invert().multiply(footQ)).normalize(); }
}
// Curl a hand into a fist (k = 0..1). Each finger joint turns about the knuckle line
// (index → pinky base), in whichever direction brings the fingertip toward the wrist;
// the thumb folds over the fingers.
export function fist(R, pose, B, side, k = 1) {
  const P = n => worldPos(R, pose, B(side + n));
  const across = P('HandPinky1').sub(P('HandIndex1')).normalize();
  const curl = (bones, tip, angles) => bones.forEach((b, i) => {
    const name = B(side + b), wrist = P('Hand');
    const before = worldPos(R, pose, B(side + tip)).distanceTo(wrist);
    rotWorld(R, pose, name, across.toArray(), angles[i] * k);
    if (worldPos(R, pose, B(side + tip)).distanceTo(wrist) > before) rotWorld(R, pose, name, across.toArray(), -2 * angles[i] * k);
  });
  for (const f of ['Index', 'Middle', 'Ring', 'Pinky']) curl(['Hand' + f + '1', 'Hand' + f + '2', 'Hand' + f + '3'], 'Hand' + f + '4', [1.45, 1.55, 1.1]);
  // thumb: fold toward the middle finger's second knuckle
  const t1 = B(side + 'HandThumb2'), t2 = B(side + 'HandThumb3');
  for (const [name, a] of [[t1, .6], [t2, .7]]) {
    const before = P('HandThumb4').distanceTo(P('HandMiddle2'));
    const axis = P('HandThumb4').sub(P('HandThumb1')).cross(across).normalize().toArray();
    rotWorld(R, pose, name, axis, a * k);
    if (P('HandThumb4').distanceTo(P('HandMiddle2')) > before) rotWorld(R, pose, name, axis, -2 * a * k);
  }
}

// ---- anatomical limbs ----------------------------------------------------------
// Elbows and knees are hinges. hingeLimb() poses root→mid along `upDir` and
// mid→end along `loDir` (world directions) the way a real limb can: it turns the
// upper bone about its own axis until the joint's hinge is perpendicular to both
// directions, then bends the mid joint about that hinge only (no sideways bend,
// no forearm/shin twist, never past straight). Rest pose is a T-pose with palms
// down, so elbows flex toward +Z (forward) and knees toward -Z (back).
const REST_HINGE = { LeftForeArm: [0, -1, 0], RightForeArm: [0, 1, 0], LeftLeg: [1, 0, 0], RightLeg: [1, 0, 0] };
function restPoseOf(R) {
  if (!R._rest) R._rest = new Map(R.nodes.map(n => [n, { t: new THREE.Vector3(...n.getTranslation()), r: new THREE.Quaternion(...n.getRotation()), s: new THREE.Vector3(...n.getScale()) }]));
  return R._rest;
}
function aimBone(R, pose, name, childName, want) {
  const s = worldPos(R, pose, name), c = worldPos(R, pose, childName);
  const q = new THREE.Quaternion().setFromUnitVectors(c.sub(s).normalize(), want.clone().normalize());
  const ax = new THREE.Vector3(q.x, q.y, q.z), sl = ax.length(); if (sl < 1e-7) return;
  rotWorld(R, pose, name, ax.divideScalar(sl).toArray(), 2 * Math.atan2(sl, q.w));
}
const signedAngle = (a, b, axis) => Math.atan2(a.clone().cross(b).dot(axis), a.dot(b));
export function hingeLimb(R, pose, B, root, mid, end, upDir, loDir) {
  const rest = restPoseOf(R), nMid = R.byName[B(mid)];
  const u = new THREE.Vector3(...upDir).normalize(), f = new THREE.Vector3(...loDir).normalize();
  // hinge axis in the mid bone's local frame (from the rest pose)
  const hl = new THREE.Vector3(...REST_HINGE[mid]).applyQuaternion(worldQuat(R, rest, nMid).invert()).normalize();
  pose.get(nMid).r.copy(rest.get(nMid).r);                       // mid at rest: the limb is (nearly) straight
  aimBone(R, pose, B(root), B(mid), u);
  // desired hinge: rotating u about it by the elbow/knee angle gives f
  // A nearly straight limb has no defined hinge plane: fall back to the natural one
  // (elbow pointing down/back so the forearm folds forward-up, knee folding backward)
  // and blend to the requested plane as the joint bends, so the bone never flips.
  const natural = u.clone().cross(new THREE.Vector3(...(/Leg$/.test(mid) ? [0, -.2, -1] : [0, .5, 1])).normalize());
  if (natural.lengthSq() < 1e-6) natural.copy(u.clone().cross(new THREE.Vector3(1, 0, 0)));
  natural.normalize();
  const bendA = u.angleTo(f), want = u.clone().cross(f);
  const k = THREE.MathUtils.smoothstep(bendA, .09, .45);
  let hs = want.lengthSq() > 1e-10 ? want.normalize() : natural.clone();
  if (hs.dot(natural) < 0 && k < 1) hs.lerp(natural, 1 - k); else hs.lerp(natural, 1 - k);
  hs.normalize();
  const midQ = () => worldQuat(R, pose, nMid);
  const hNow = hl.clone().applyQuaternion(midQ());
  const proj = v => v.clone().sub(u.clone().multiplyScalar(v.dot(u))).normalize();
  rotWorld(R, pose, B(root), u.toArray(), signedAngle(proj(hNow), proj(hs), u));
  // bend about the hinge only
  const d0 = worldPos(R, pose, B(end)).sub(worldPos(R, pose, B(mid))).normalize();
  const hW = hl.clone().applyQuaternion(midQ());
  const pj = v => v.clone().sub(hW.clone().multiplyScalar(v.dot(hW))).normalize();
  // the rest pose may be slightly bent: allow straightening back to 180°, never past it
  const rU = worldPos(R, rest, B(mid)).sub(worldPos(R, rest, B(root))), rF = worldPos(R, rest, B(end)).sub(worldPos(R, rest, B(mid)));
  const restFlex = rU.angleTo(rF);
  const phi = Math.min(2.6, Math.max(-restFlex, signedAngle(pj(d0), pj(f), hW)));
  pose.get(nMid).r.copy(rest.get(nMid).r).multiply(new THREE.Quaternion().setFromAxisAngle(hl, phi)).normalize();
}
