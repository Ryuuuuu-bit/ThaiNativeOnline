// Put a Tripo Studio animation (text-to-motion, exported on the same body) on a class body as a clip.
// The Tripo export shares the body's skeleton, so bone rotations copy over as they are. Hands that
// hold a weapon keep the body's own grip (fingers and the weapon's seat in the hand, from its current
// idle); the clip is resampled to 30 fps and its end eased into its start so it loops.
//   node tools/class-models/add-idle.mjs body.glb tripo.glb <animation index|name> out.glb [clip=idle] [weapon props...]
// A bow (hunter_bow) is re-seated to hang upright in the hand: Tripo's hand turns differently from
// the old idle's, which would lay the bow across the body.
import { load, sample, clone, blend, writeAnim, duration, worldMatrix, worldPos, THREE } from '../muaythai-anims/lib.mjs';

const [bodyPath, tripoPath, which, output, clipName = 'idle', ...props] = process.argv.slice(2);
const R = await load(bodyPath), T = await load(tripoPath);
const anims = T.root.listAnimations();
const src = /^\d+$/.test(which) ? anims[+which] : anims.find(a => a.getName().toLowerCase().includes(which.toLowerCase()));
if (!src) throw Error(`no animation ${which}: ${anims.map(a => a.getName()).join(' | ')}`);

const restOf = M => new Map(M.nodes.map(n => [n, { t: new THREE.Vector3(...n.getTranslation()), r: new THREE.Quaternion(...n.getRotation()), s: new THREE.Vector3(...n.getScale()) }]));
const rr = restOf(R), base = R.anims.idle ? sample(R, R.anims.idle, 0) : rr;
const weaponHands = new Set(props.map(p => R.parent.get(R.byName[p])?.getName()).filter(Boolean).map(n => n.replace(/^mixamorig:|Hand$/g, '')));
const gripBone = n => [...weaponHands].some(side => new RegExp(`^mixamorig:${side}Hand(Thumb|Index|Middle|Ring|Pinky)`).test(n));

const d = duration(src), count = Math.round(d * 30), frames = [];
for (let i = 0; i <= count; i++) {
  const ps = sample(T, src, i / 30), p = clone(rr);
  for (const node of R.nodes) {
    const name = node.getName(), tn = T.byName[name];
    if (gripBone(name) || props.includes(name)) { p.get(node).t.copy(base.get(node).t); p.get(node).r.copy(base.get(node).r); continue; }
    if (!tn || !name.startsWith('mixamorig:')) continue;
    p.get(node).r.copy(ps.get(tn).r);
    if (name === 'mixamorig:Hips') p.get(node).t.copy(ps.get(tn).t);
  }
  frames.push(p);
}
// feet on the ground: Tripo's motion lets the soles sink or float a little; each frame the hips move
// so the lower foot stands exactly where it stands at rest
{
  const feet = ['LeftFoot', 'RightFoot', 'LeftToeBase', 'RightToeBase'].map(n => 'mixamorig:' + n).filter(n => R.byName[n]);
  const low = p => Math.min(...feet.map(n => worldPos(R, p, n).y)), restLow = low(rr);
  const hips = R.byName['mixamorig:Hips'], parent = R.parent.get(hips);
  const toLocal = new THREE.Matrix3().setFromMatrix4(parent ? worldMatrix(R, rr, parent) : new THREE.Matrix4()).invert();
  for (const f of frames) f.get(hips).t.add(new THREE.Vector3(0, restLow - low(f), 0).applyMatrix3(toLocal));
}
// the bow hangs upright: one turn about the hand (from the first frame) that brings the bow's long
// axis to vertical, then held in the hand for the whole clip
const bow = R.byName.hunter_bow;
if (bow && props.includes('hunter_bow')) {
  const hand = R.parent.get(bow), p0 = frames[0];
  const min = new THREE.Vector3(Infinity, Infinity, Infinity), max = min.clone().negate();
  (function walk(n) { const m = n.getMesh?.(); if (m) for (const prim of m.listPrimitives()) { const a = prim.getAttribute('POSITION'); for (let i = 0; i < a.getCount(); i++) { const v = new THREE.Vector3(...a.getElement(i, [])); min.min(v); max.max(v); } } n.listChildren().forEach(walk); })(bow);
  const sz = max.clone().sub(min), ax = sz.x >= sz.y && sz.x >= sz.z ? new THREE.Vector3(1, 0, 0) : sz.y >= sz.z ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(0, 0, 1);
  const W = worldMatrix(R, p0, bow), q0 = new THREE.Quaternion(); W.decompose(new THREE.Vector3(), q0, new THREE.Vector3());
  const axis = ax.applyQuaternion(q0).normalize(), up = new THREE.Vector3(0, axis.y >= 0 ? 1 : -1, 0);
  const turn = new THREE.Quaternion().setFromUnitVectors(axis, up), pivot = worldPos(R, p0, hand.getName());
  const M = new THREE.Matrix4().makeTranslation(pivot.x, pivot.y, pivot.z).multiply(new THREE.Matrix4().makeRotationFromQuaternion(turn)).multiply(new THREE.Matrix4().makeTranslation(-pivot.x, -pivot.y, -pivot.z)).multiply(W);
  const local = worldMatrix(R, p0, hand).invert().multiply(M), t = new THREE.Vector3(), r = new THREE.Quaternion(), sc = new THREE.Vector3();
  local.decompose(t, r, sc);
  for (const f of frames) { f.get(bow).t.copy(t); f.get(bow).r.copy(r); }
}
// seamless loop: the last 0.4 s eases into the first frame
const tail = Math.min(12, Math.floor(frames.length / 3));
for (let k = 0; k < tail; k++) { const i = frames.length - tail + k, w = THREE.MathUtils.smoothstep((k + 1) / tail, 0, 1); frames[i] = blend(frames[i], frames[0], w); }

R.anims[clipName]?.dispose();
writeAnim(R, clipName, frames, 30, props.filter(p => R.byName[p]));
await R.io.write(output, R.doc);
console.log(`${output}: ${clipName} <- "${src.getName()}" (${d.toFixed(2)} s, grip kept on ${[...weaponHands].join(', ') || 'no hand'})`);
