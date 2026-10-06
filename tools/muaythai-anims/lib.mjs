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
export function writeAnim(R, name, frames, fps) {
  const { doc } = R; const buf = doc.getRoot().listBuffers()[0];
  const anim = doc.createAnimation(name);
  const times = new Float32Array(frames.length).map((_, i) => i / fps);
  const input = doc.createAccessor().setType('SCALAR').setArray(times).setBuffer(buf);
  const joints = R.root.listSkins()[0].listJoints();
  for (const n of joints) for (const path of ['translation', 'rotation']) {
    const k = path === 'rotation' ? 4 : 3, arr = new Float32Array(frames.length * k);
    frames.forEach((f, i) => { const p = f.get(n); (path === 'rotation' ? p.r : p.t).toArray(arr, i * k); });
    const out = doc.createAccessor().setType(k === 4 ? 'VEC4' : 'VEC3').setArray(arr).setBuffer(buf);
    const s = doc.createAnimationSampler().setInput(input).setOutput(out).setInterpolation('LINEAR');
    anim.addSampler(s).addChannel(doc.createAnimationChannel().setTargetNode(n).setTargetPath(path).setSampler(s));
  }
  return anim;
}
