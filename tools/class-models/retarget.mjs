// Transfer authored class moves onto a supplied Mixamo skin without changing its
// bind pose/weights. Rigid weapons retain their authored world orientation and grip.
// node tools/class-models/retarget.mjs source.glb donor.glb output.glb [prop names...]
import { load, sample, clone, worldPos, worldQuat, writeAnim, duration, THREE } from '../muaythai-anims/lib.mjs';
import { copyToDocument, prune, dedup } from '@gltf-transform/functions';

const [source, donor, output, ...props] = process.argv.slice(2);
if (!source || !donor || !output) throw Error('Expected source, donor and output paths');
const R = await load(source), D = await load(donor);
const rest = M => new Map(M.nodes.map(n => [n, { t: new THREE.Vector3(...n.getTranslation()), r: new THREE.Quaternion(...n.getRotation()), s: new THREE.Vector3(...n.getScale()) }]));
const rd = rest(D), original = rest(R), hips = 'mixamorig:Hips';
if (!R.byName[hips] || !D.byName[hips]) throw Error('Both files require a Mixamo skeleton');
const k = worldPos(R, original, hips).y / worldPos(D, rd, hips).y;
if (!Number.isFinite(k) || k <= 0) throw Error('Invalid rig scale');
const copied = copyToDocument(R.doc, D.doc, props.map(name => {
  if (!D.byName[name]) throw Error(`Missing weapon ${name}`);
  return D.byName[name];
}));
const attachments = props.map(name => {
  const from = D.byName[name], hand = D.parent.get(from)?.getName(), node = copied.get(from);
  if (!R.byName[hand]) throw Error(`Missing weapon hand ${hand}`);
  R.byName[hand].addChild(node);
  node.setScale(from.getScale().map(v => v * k));
  R.byName[name] = node; R.parent.set(node, R.byName[hand]); R.nodes.push(node);
  return { name, from, node, hand };
});
const rr = rest(R), order = [];
(function visit(n) { order.push(n); n.listChildren().forEach(visit); })(R.byName[hips]);
function pose(pd) {
  const p = clone(rr), wq = new Map();
  for (const node of order) {
    const name = node.getName(), dn = D.byName[name], parent = R.parent.get(node);
    const parentQ = wq.get(parent) ?? (parent ? worldQuat(R, p, parent) : new THREE.Quaternion());
    let q;
    if (dn && name.startsWith('mixamorig:')) {
      q = worldQuat(D, pd, dn).multiply(worldQuat(D, rd, dn).invert()).multiply(worldQuat(R, original, node));
    } else q = parentQ.clone().multiply(p.get(node).r);
    p.get(node).r.copy(parentQ.clone().invert().multiply(q)).normalize(); wq.set(node, q);
  }
  const dh = D.byName[hips];
  p.get(R.byName[hips]).t.copy(rr.get(R.byName[hips]).t).add(pd.get(dh).t.clone().sub(rd.get(dh).t).multiplyScalar(k));
  for (const { name, node, hand } of attachments) {
    const inverseHand = worldQuat(R, p, R.byName[hand]).invert();
    p.get(node).r.copy(inverseHand.clone().multiply(worldQuat(D, pd, D.byName[name]))).normalize();
    p.get(node).t.copy(worldPos(D, pd, name).sub(worldPos(D, pd, hand)).multiplyScalar(k).applyQuaternion(inverseHand));
  }
  return p;
}
// Seat static prop transforms too, so the bind-pose bounds agree with animation.
const neutral = pose(rd);
for (const { node } of attachments) node.setTranslation(neutral.get(node).t.toArray()).setRotation(neutral.get(node).r.toArray());
for (const old of [...R.root.listAnimations()]) old.dispose();
for (const anim of D.root.listAnimations()) {
  const frames = [], count = Math.round(duration(anim) * 30);
  for (let i = 0; i <= count; i++) {
    const p = pose(sample(D, anim, i / 30));
    if (['walk', 'run'].includes(anim.getName())) {
      const h = p.get(R.byName[hips]).t, h0 = rr.get(R.byName[hips]).t;
      h.x = h0.x; h.z = h0.z;
    }
    frames.push(p);
  }
  writeAnim(R, anim.getName(), frames, 30, props);
}
await R.doc.transform(prune(), dedup());
const buffer = R.root.listBuffers()[0];
for (const accessor of R.root.listAccessors()) accessor.setBuffer(buffer);
for (const extra of R.root.listBuffers().slice(1)) extra.dispose();
await R.io.write(output, R.doc);
console.log(`${output}: ${R.root.listAnimations().map(a => a.getName()).join(', ')}`);
