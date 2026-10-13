// Transfer authored class moves onto a supplied Mixamo skin without changing its
// bind pose/weights. Rigid weapons retain their authored world orientation and grip.
// node tools/class-models/retarget.mjs source.glb donor.glb output.glb [prop names...]
import { load, sample, clone, blend, worldPos, worldQuat, worldMatrix, rotWorld, writeAnim, duration, THREE } from '../muaythai-anims/lib.mjs';
import { copyToDocument, prune, dedup } from '@gltf-transform/functions';

const [source, donor, output, ...props] = process.argv.slice(2);
const swordRig = props.includes('sword_L') && props.includes('sword_R'), bowRig = props.includes('hunter_bow');
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
  return { name, from, node, hand };
});
// the copied props may carry child nodes (their mesh parts): re-index the whole scene
R.nodes = R.root.listNodes(); R.parent = new Map();
R.nodes.forEach(n => n.listChildren().forEach(c => R.parent.set(c, n)));
for (const { name, node } of attachments) R.byName[name] = node;
const rr = rest(R), order = [];
(function visit(n) { order.push(n); n.listChildren().forEach(visit); })(R.byName[hips]);
// A matching bone name does not imply matching anatomical axes. Align the
// actual bone->child vectors, then use a second axis to preserve palm/sole roll.
// A rotation-only bind offset otherwise preserves the new rig's bent wrist and
// different elbow plane inside every authored pose.
function anatomicalFrame(M, restPose, name) {
  const node = M.byName[name];
  const child = node?.listChildren().find(n => n.getName().startsWith('mixamorig:'));
  if (!child) return null;
  const from = worldPos(M, restPose, name);
  let to = worldPos(M, restPose, child.getName()), reference = new THREE.Vector3(0, 0, 1);
  if (/Hand$/.test(name)) {
    to = worldPos(M, restPose, name + 'Middle1');
    reference = worldPos(M, restPose, name + 'Pinky1').sub(worldPos(M, restPose, name + 'Index1'));
  } else if (/Foot|Toe/.test(name)) reference.set(0, 1, 0);
  const y = to.sub(from).normalize();
  const x = reference.sub(y.clone().multiplyScalar(reference.dot(y)));
  if (x.lengthSq() < 1e-8) x.set(1, 0, 0).addScaledVector(y, -y.x);
  x.normalize();
  const z = x.clone().cross(y).normalize();
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
}
const alignment = new Map();
for (const node of order) {
  const name = node.getName();
  if (!D.byName[name] || !name.startsWith('mixamorig:')) continue;
  const sourceFrame = anatomicalFrame(D, rd, name), targetFrame = anatomicalFrame(R, original, name);
  alignment.set(node, sourceFrame && targetFrame ? sourceFrame.multiply(targetFrame.invert()) : new THREE.Quaternion());
}
// How far a donor finger is curled: the bends between its segments (the knuckle measured
// from the palm's long axis), in radians.
const FIST_CURL = 1.45 + 1.55 + 1.1, THUMB_CURL = 1.3, M = n => 'mixamorig:' + n;
function donorCurl(pd, side, f) {
  const P = n => worldPos(D, pd, M(side + n));
  const pts = f === 'Thumb' ? [P('HandThumb2'), P('HandThumb3'), P('HandThumb4')] : [P('Hand'), P('Hand' + f + '1'), P('Hand' + f + '2'), P('Hand' + f + '3'), P('Hand' + f + '4')];
  if (f !== 'Thumb') pts[0] = pts[1].clone().sub(P('HandMiddle1').sub(P('Hand')));   // knuckle against the palm's axis
  let a = 0; for (let i = 1; i < pts.length - 1; i++) a += pts[i].clone().sub(pts[i - 1]).angleTo(pts[i + 1].clone().sub(pts[i]));
  return a;
}
// Bend one finger the way the donor's bends (each joint by its share of a fist), about the hand's
// knuckle line. Which side is the palm cannot be told from a straight finger, so it comes from the
// donor: both hands get the same anatomical frame (palm axis x knuckle line), and the side of that
// frame the donor's fingertip curls toward is the side this one curls toward.
const palmSide = (Mo, p0, side) => {
  const P = n => worldPos(Mo, p0, M(side + n));
  return P('HandPinky1').sub(P('HandIndex1')).cross(P('HandMiddle1').sub(P('Hand'))).normalize();
};
function donorBendSide(pd, side, f) {
  const P = n => worldPos(D, pd, M(side + n)), dir = P('Hand' + f + '4').sub(P('Hand' + f + '1')), along = P('HandMiddle1').sub(P('Hand')).normalize();
  const bend = dir.sub(along.clone().multiplyScalar(dir.dot(along)));
  return bend.dot(palmSide(D, pd, side)) >= 0 ? 1 : -1;
}
const CURL_SCALE = 1;
function curlFinger(p, side, f, k, want = 1) {
  if (k < .02) return;
  const P = n => worldPos(R, p, M(side + n)), across = P('HandPinky1').sub(P('HandIndex1')).normalize().toArray();
  const first = M(side + 'Hand' + f + '1'), probe = clone(p), n0 = palmSide(R, p, side);
  rotWorld(R, probe, first, across, .3);
  const moved = worldPos(R, probe, M(side + 'Hand' + f + '4')).sub(P('Hand' + f + '4'));
  const sign = Math.sign(moved.dot(n0)) === want ? 1 : -1;
  [1, 2, 3].forEach((j, i) => rotWorld(R, p, M(side + 'Hand' + f + j), across, sign * [1.45, 1.55, 1.1][i] * k * CURL_SCALE));
}
function curlThumb(p, side, k) {
  if (k < .02) return;
  const P = n => worldPos(R, p, M(side + n)), across = P('HandPinky1').sub(P('HandIndex1')).normalize();
  for (const [j, a] of [[2, .6], [3, .7]]) {
    const before = P('HandThumb4').distanceTo(P('HandMiddle2')), axis = P('HandThumb4').sub(P('HandThumb1')).cross(across).normalize().toArray();
    rotWorld(R, p, M(side + 'HandThumb' + j), axis, a * k);
    if (P('HandThumb4').distanceTo(P('HandMiddle2')) > before) rotWorld(R, p, M(side + 'HandThumb' + j), axis, -2 * a * k);
  }
}
function pose(pd, clipName = '') {
  const p = clone(rr), wq = new Map();
  for (const node of order) {
    const name = node.getName(), dn = D.byName[name], parent = R.parent.get(node);
    const parentQ = wq.get(parent) ?? (parent ? worldQuat(R, p, parent) : new THREE.Quaternion());
    let q;
    if (dn && name.startsWith('mixamorig:')) {
      q = worldQuat(D, pd, dn).multiply(worldQuat(D, rd, dn).invert())
        .multiply(swordRig ? alignment.get(node) : new THREE.Quaternion()).multiply(worldQuat(R, original, node));
      if (swordRig && /:(Neck|Head)$/.test(name) && !['hurt', 'die'].includes(clipName)) {
        // The small anime head needs a stable gaze; donor combat head rolls
        // combined with different neck bind axes visibly cock it sideways.
        const delta = worldQuat(D, pd, dn).multiply(worldQuat(D, rd, dn).invert());
        const e = new THREE.Euler().setFromQuaternion(delta, 'YXZ');
        e.x = THREE.MathUtils.clamp(e.x, -.18, .18);
        e.z = THREE.MathUtils.clamp(e.z, -.045, .045);
        q = new THREE.Quaternion().setFromEuler(e).multiply(worldQuat(R, original, node));
      }
    } else q = parentQ.clone().multiply(p.get(node).r);
    p.get(node).r.copy(parentQ.clone().invert().multiply(q)).normalize(); wq.set(node, q);
  }
  const dh = D.byName[hips];
  p.get(R.byName[hips]).t.copy(rr.get(R.byName[hips]).t).add(pd.get(dh).t.clone().sub(rd.get(dh).t).multiplyScalar(k));
  // Finger axes vary even between Mixamo exports: copying the donor's finger rotations folds
  // the new fingers sideways. Rebuild every finger on this hand instead, curled toward the palm
  // as far as the donor's finger is curled (the twin swords keep a full grip).
  for (const node of order) if (/Hand(Thumb|Index|Middle|Ring|Pinky)/.test(node.getName())) p.get(node).r.copy(rr.get(node).r);
  for (const side of ['Left', 'Right']) {
    if (swordRig) { for (const f of ['Index', 'Middle', 'Ring', 'Pinky']) curlFinger(p, side, f, 1, donorBendSide(pd, side, f)); curlThumb(p, side, 1); continue; }
    // an archer's drawing hand hooks the string in the bow moves (the donor's hand stays flat)
    const hook = bowRig && side === 'Right' && clipName.startsWith('hunter_') ? { Index: .42, Middle: .42, Ring: .42, Pinky: .5 } : {};
    for (const f of ['Index', 'Middle', 'Ring', 'Pinky']) curlFinger(p, side, f, Math.max(hook[f] ?? 0, Math.min(1.1, donorCurl(pd, side, f) / FIST_CURL)), donorBendSide(pd, side, f));
    curlThumb(p, side, Math.min(1.1, donorCurl(pd, side, 'Thumb') / THUMB_CURL));
  }
  for (const { name, node, hand } of attachments) {
    const inverseHand = worldQuat(R, p, R.byName[hand]).invert();
    p.get(node).r.copy(inverseHand.clone().multiply(worldQuat(D, pd, D.byName[name]))).normalize();
    p.get(node).t.copy(worldPos(D, pd, name).sub(worldPos(D, pd, hand)).multiplyScalar(k).applyQuaternion(inverseHand));
    if (swordRig) {
      const center = (M, p0) => ['Index2', 'Middle2', 'Ring2', 'Pinky2'].reduce((v, finger) => v.add(worldPos(M, p0, hand + finger)), new THREE.Vector3()).multiplyScalar(.25);
      const donorGrip = center(D, pd).sub(worldPos(D, pd, hand)).multiplyScalar(k);
      const newGrip = center(R, p).sub(worldPos(R, p, hand));
      p.get(node).t.add(newGrip.sub(donorGrip).applyQuaternion(inverseHand));
    }
  }
  return p;
}
// Seat static prop transforms too, so the bind-pose bounds agree with animation.
const neutral = pose(rd);
for (const { node } of attachments) node.setTranslation(neutral.get(node).t.toArray()).setRotation(neutral.get(node).r.toArray());
// Feet on the ground: in the donor's idle the soles stand where they stand at rest; the new
// legs (other proportions, aligned axes) can end up lower or higher. Lift or lower the hips by
// the difference so the new body stands exactly as high as the donor's.
const FEET = ['LeftFoot', 'RightFoot', 'LeftToeBase', 'RightToeBase'].map(M);
const low = (Mo, p0) => Math.min(...FEET.map(n => worldPos(Mo, p0, n).y));
const idle = D.anims.idle ?? D.root.listAnimations()[0];
const idlePose = sample(D, idle, 0), expected = (low(D, idlePose) - low(D, rd)) * k;
const groundLift = expected - (low(R, pose(idlePose, idle.getName())) - low(R, rr));
const hipsParent = R.parent.get(R.byName[hips]);
const liftLocal = new THREE.Vector3(0, groundLift, 0).applyMatrix3(new THREE.Matrix3().setFromMatrix4(hipsParent ? worldMatrix(R, rr, hipsParent) : new THREE.Matrix4()).invert());
console.log(`feet: hips ${groundLift >= 0 ? 'up' : 'down'} ${(Math.abs(groundLift) * 100).toFixed(1)} cm (model units)`);

// Weapons never pass through the head: in a frame where the blade or bow would, it turns about
// the hand away from the head just enough to clear it; the turn eases in and out over nearby
// frames (no snap).
const head = M('Head'), headTop = R.byName[M('HeadTop_End')] ? M('HeadTop_End') : null;
const weaponPoints = attachments.map(({ node }) => {
  const pts = [];
  (function walk(n) { const mesh = n.getMesh?.(); if (mesh) for (const prim of mesh.listPrimitives()) { const a = prim.getAttribute('POSITION'); const step = Math.max(1, Math.floor(a.getCount() / 800)); for (let i = 0; i < a.getCount(); i += step) pts.push([n, new THREE.Vector3(...a.getElement(i, []))]); } n.listChildren().forEach(walk); })(node);
  return pts;
});
function headSphere(p) {
  const h = worldPos(R, p, head), top = headTop ? worldPos(R, p, headTop) : h.clone().add(new THREE.Vector3(0, .2 / k, 0));
  return { c: h.clone().lerp(top, .5), r: h.distanceTo(top) * .95 };   // the head with its hair
}
function intrusion(p, a) {   // deepest weapon point inside the head sphere: { depth, point }
  const { c, r } = headSphere(p); let best = { depth: 0 };
  const mats = new Map();
  for (const [n, v] of weaponPoints[a]) { if (!mats.has(n)) mats.set(n, worldMatrix(R, p, n)); const w = v.clone().applyMatrix4(mats.get(n)), d = r - w.distanceTo(c); if (d > best.depth) best = { depth: d, point: w, c }; }
  return best;
}
function turnWeapon(p, a, angle) {   // rotate the prop about its hand, away from the head
  if (angle < 1e-3) return;
  // in the plane of the weapon's direction (from the hand to its middle) and the head's: opens the
  // angle between them, so a larger turn always moves the weapon further from the head
  const { node, hand } = attachments[a], pivot = worldPos(R, p, hand), mats = new Map(), mid = new THREE.Vector3();
  for (const [n, v] of weaponPoints[a]) { if (!mats.has(n)) mats.set(n, worldMatrix(R, p, n)); mid.add(v.clone().applyMatrix4(mats.get(n))); }
  mid.divideScalar(weaponPoints[a].length);
  const { c } = headSphere(p), toward = mid.sub(pivot);
  const axis = toward.clone().cross(c.clone().sub(pivot)).normalize(); if (!(axis.lengthSq() > .5)) return;
  const parentW = worldMatrix(R, p, R.byName[hand]), W = worldMatrix(R, p, node);
  const turn = new THREE.Matrix4().makeTranslation(pivot.x, pivot.y, pivot.z).multiply(new THREE.Matrix4().makeRotationAxis(axis, -angle)).multiply(new THREE.Matrix4().makeTranslation(-pivot.x, -pivot.y, -pivot.z));
  const local = parentW.clone().invert().multiply(turn.multiply(W)), t = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
  local.decompose(t, q, sc); p.get(node).t.copy(t); p.get(node).r.copy(q);
}

function swingArm(p, a, angle) {   // the weapon arm's upper arm turns away from the head
  if (angle < 1e-3) return;
  const side = attachments[a].hand.includes('Left') ? 'Left' : 'Right', shoulder = worldPos(R, p, M(side + 'Arm'));
  const { c } = headSphere(p), handAt = worldPos(R, p, attachments[a].hand);
  const axis = handAt.sub(shoulder).cross(c.clone().sub(shoulder)).normalize(); if (!(axis.lengthSq() > .5)) return;
  rotWorld(R, p, M(side + 'Arm'), axis.toArray(), -angle);
}
for (const old of [...R.root.listAnimations()]) old.dispose();
for (const anim of D.root.listAnimations()) {
  const frames = [], count = Math.round(duration(anim) * 30);
  for (let i = 0; i <= count; i++) {
    const p = pose(sample(D, anim, i / 30), anim.getName());
    const h = p.get(R.byName[hips]).t;
    if (['walk', 'run'].includes(anim.getName())) { const h0 = rr.get(R.byName[hips]).t; h.x = h0.x; h.z = h0.z; }
    h.add(liftLocal);
    frames.push(p);
  }
  attachments.forEach((_, a) => {
    // Clear the head with the least change: first swing the upper arm out (hand and weapon move
    // together, the grip stays), then turn the weapon about the hand. Per frame the smallest pair
    // (arm 0-35° by 5, weapon 0-45° by 15) that clears, in-betweens included; both ease over ±7
    // frames; then everything is checked again and nudged where a swing still cuts in.
    const apply = (p, arm, wpn) => { const q = clone(p); swingArm(q, a, arm * Math.PI / 180); turnWeapon(q, a, wpn * Math.PI / 180); return q; };
    const clear = (p, next) => !intrusion(p, a).depth && !(next && [.25, .5, .75].some(u => intrusion(blend(p, next, u), a).depth));
    const need = frames.map((p, i) => {
      if (clear(p, frames[i + 1]) && !(frames[i - 1] && !clear(frames[i - 1], p))) return [0, 0];
      for (let arm = 0; arm <= 35; arm += 5) for (const wpn of [0, 15, 30, 45]) if (clear(apply(p, arm, wpn))) return [arm, wpn];
      return [35, 45];
    });
    const ease = k => need.map((_, i) => Math.max(0, ...need.map((n, j) => n[k] * Math.max(0, 1 - Math.abs(i - j) / 7))));
    const arm = ease(0), wpn = ease(1), base = frames.map(p => clone(p));
    for (let pass = 0; pass < 10; pass++) {
      const out = base.map((p, i) => apply(p, arm[i], wpn[i]));
      let ok = true;
      out.forEach((q, i) => { if (!clear(q, out[i + 1])) { ok = false; for (const j of [i, i + 1]) if (out[j]) { arm[j] = Math.min(45, arm[j] + 5); wpn[j] = Math.min(60, wpn[j] + 5); } } });
      if (ok || pass === 9) { out.forEach((q, i) => frames[i] = q); if (!ok) console.log(`  ${anim.getName()}: ${attachments[a].name} brushes the hair (head itself clear)`); break; }
    }
    const moved = arm.filter((d, i) => d > 0 || wpn[i] > 0).length;
    if (moved) console.log(`  ${anim.getName()}: ${attachments[a].name} clear of the head in ${moved} frames (arm up to ${Math.max(...arm).toFixed(0)}°, weapon up to ${Math.max(...wpn).toFixed(0)}°)`);
  });
  writeAnim(R, anim.getName(), frames, 30, props);
}
await R.doc.transform(prune(), dedup());
const buffer = R.root.listBuffers()[0];
for (const accessor of R.root.listAccessors()) accessor.setBuffer(buffer);
for (const extra of R.root.listBuffers().slice(1)) extra.dispose();
await R.io.write(output, R.doc);
console.log(`${output}: ${R.root.listAnimations().map(a => a.getName()).join(', ')}`);
