// The archer's full-draw stance (the reference pose): side-on wide stance with bent knees, bow arm
// straight toward the target, the string drawn to the jaw with the elbow back and high, the head
// looking down the arrow, the bow upright. Built with IK on a class body that already carries
// hunter_shot (tools/class-models/retarget.mjs output), from that clip's full-draw frame.
//   node tools/class-models/archer-pose.mjs body.glb out.glb [clip=aim_pose] [--into-shot]
//   --into-shot   also hold this stance through hunter_shot's full draw (eased in and out)
import { load, sample, clone, blend, worldPos, worldQuat, rotWorld, writeAnim, duration, legIK, hingeLimb, THREE } from '../muaythai-anims/lib.mjs';

const [input, output, clipName = 'aim_pose', ...flags] = process.argv.slice(2);
const R = await load(input), M = n => 'mixamorig:' + n, B = M;
const shot = R.anims.hunter_shot;
if (!shot) throw Error('needs hunter_shot');

// the full draw: the frame with the hands furthest apart
const d = duration(shot); let tDraw = 0, best = 0;
for (let i = 0; i <= 60; i++) { const p = sample(R, shot, d * i / 60), s = worldPos(R, p, M('LeftHand')).distanceTo(worldPos(R, p, M('RightHand'))); if (s > best) { best = s; tDraw = d * i / 60; } }

const restPose = new Map(R.nodes.map(n => [n, { t: new THREE.Vector3(...n.getTranslation()), r: new THREE.Quaternion(...n.getRotation()), s: new THREE.Vector3(...n.getScale()) }]));
const P = (p, n) => worldPos(R, p, M(n));
const H = P(restPose, 'HeadTop_End').y - Math.min(P(restPose, 'LeftToeBase').y, P(restPose, 'RightToeBase').y);   // body height, model units
const UP = new THREE.Vector3(0, 1, 0);

function twoBone(S, T, a, b, pole) {   // elbow/knee position for a two-bone chain reaching T
  const toT = T.clone().sub(S), dist = Math.min(toT.length(), a + b - 1e-4), n = toT.normalize();
  const along = (a * a - b * b + dist * dist) / (2 * dist), h = Math.sqrt(Math.max(0, a * a - along * along));
  const pp = pole.clone().sub(n.clone().multiplyScalar(pole.dot(n))).normalize();
  return S.clone().add(n.clone().multiplyScalar(along)).add(pp.multiplyScalar(h));
}
function reach(p, side, target, pole) {
  const S = P(p, side + 'Arm'), a = S.distanceTo(P(p, side + 'ForeArm')), b = P(p, side + 'ForeArm').distanceTo(P(p, side + 'Hand'));
  const E = twoBone(S, target, a, b, pole);
  const handQ = worldQuat(R, p, R.byName[M(side + 'Hand')]);
  hingeLimb(R, p, B, side + 'Arm', side + 'ForeArm', side + 'Hand', E.clone().sub(S).toArray(), target.clone().sub(E).toArray());
  return handQ;
}
const keepHand = (p, side, q) => { const node = R.byName[M(side + 'Hand')], pq = worldQuat(R, p, R.parent.get(node)); p.get(node).r.copy(pq.invert().multiply(q)).normalize(); };

function aimPose() {
  const p = sample(R, shot, tDraw);
  // aim: level, along the donor's draw line
  const A = P(p, 'LeftHand').sub(P(p, 'RightHand')); A.y = 0; A.normalize();
  const side = A.clone().cross(UP).normalize();   // toward the archer's front (the camera in the reference)

  // stance: hips down, feet apart along the arrow (front foot toward the target), knees bent
  const hips = R.byName[M('Hips')], footQ = s => worldQuat(R, p, R.byName[M(s + 'Foot')]);
  const fq = { Left: footQ('Left'), Right: footQ('Right') };
  const feet = { Left: P(p, 'LeftFoot'), Right: P(p, 'RightFoot') };
  const lead = feet.Left.clone().sub(feet.Right).dot(A) >= 0 ? 'Left' : 'Right', rear = lead === 'Left' ? 'Right' : 'Left';
  feet[lead].add(A.clone().multiplyScalar(.11 * H)).add(side.clone().multiplyScalar(.03 * H));
  feet[rear].add(A.clone().multiplyScalar(-.09 * H)).add(side.clone().multiplyScalar(-.03 * H));
  p.get(hips).t.y -= .06 * H / (R.parent.get(hips) ? worldMatrixScale(R.parent.get(hips)) : 1);
  for (const s of ['Left', 'Right']) legIK(R, p, B, s, feet[s], fq[s], side.toArray());

  // the chest opens a little toward the front, the spine stays tall
  rotWorld(R, p, M('Spine1'), UP.toArray(), -.12 * Math.sign(A.clone().cross(side).y || 1));

  // bow arm: straight at the target from the shoulder, a soft elbow
  const SL = P(p, 'LeftArm'), armL = SL.distanceTo(P(p, 'LeftForeArm')) + P(p, 'LeftForeArm').distanceTo(P(p, 'LeftHand'));
  const bowQ = reach(p, 'Left', SL.clone().add(A.clone().multiplyScalar(armL * .97)).add(UP.clone().multiplyScalar(.01 * H)), UP.clone().multiplyScalar(-1).add(side.clone().multiplyScalar(-.3)));
  keepHand(p, 'Left', bowQ);

  // head looks down the arrow, chin toward the string
  const face = () => new THREE.Vector3(0, 0, 1).applyQuaternion(worldQuat(R, p, R.byName[M('Head')]).multiply(worldQuat(R, restPose, R.byName[M('Head')]).invert()));
  const f0 = face(); f0.y = 0; f0.normalize();
  const yaw = Math.atan2(f0.clone().cross(A).y, f0.dot(A)) * .85;
  rotWorld(R, p, M('Neck'), UP.toArray(), yaw * .4); rotWorld(R, p, M('Head'), UP.toArray(), yaw * .6);
  rotWorld(R, p, M('Head'), side.clone().cross(UP).normalize().toArray(), .1);

  // draw hand at the jaw under the aiming eye, elbow back along the arrow and high
  const head = P(p, 'Head'), jaw = head.clone().add(UP.clone().multiplyScalar(-.075 * H)).add(A.clone().multiplyScalar(-.015 * H)).add(side.clone().multiplyScalar(.025 * H));   // the wrist: knuckles land at the chin
  const drawQ = reach(p, 'Right', jaw, A.clone().multiplyScalar(-1).add(UP.clone().multiplyScalar(.08)));
  // the drawing hand keeps its grip but lines up with the forearm (a near-straight wrist, slightly
  // cocked toward the face): the smallest turn from where it is, so the forearm gains no twist
  keepHand(p, 'Right', drawQ);
  {
    const fa = P(p, 'RightHand').sub(P(p, 'RightForeArm')).normalize(), now = P(p, 'RightHandMiddle1').sub(P(p, 'RightHand')).normalize();
    const want = fa.clone().lerp(A, .15).normalize(), q = new THREE.Quaternion().setFromUnitVectors(now, want);
    const ax = new THREE.Vector3(q.x, q.y, q.z), sl = ax.length();
    if (sl > 1e-6) rotWorld(R, p, M('RightHand'), ax.divideScalar(sl).toArray(), 2 * Math.atan2(sl, q.w));
  }
  // bow upright: turn the bow hand about the arrow until the bow's long axis is vertical
  const bow = R.byName.hunter_bow;
  if (bow) {
    const ax = longAxis(bow), world = ax.applyQuaternion(worldQuat(R, p, bow)).normalize();
    const proj = v => v.clone().sub(A.clone().multiplyScalar(v.dot(A))).normalize();
    const ang = Math.atan2(proj(world).cross(UP).dot(A), proj(world).dot(UP));
    const flip = Math.abs(ang) > Math.PI / 2 ? (ang > 0 ? ang - Math.PI : ang + Math.PI) : ang;
    rotWorld(R, p, M('LeftHand'), A.toArray(), flip);
  }
  return p;
}
function worldMatrixScale(node) { let s = 1, n = node; while (n) { s *= n.getScale()[1]; n = R.parent.get(n); } return s; }
function longAxis(node) {   // the bow's longest local axis (from its mesh bounds)
  const min = new THREE.Vector3(Infinity, Infinity, Infinity), max = min.clone().negate();
  (function walk(n) { const m = n.getMesh?.(); if (m) for (const prim of m.listPrimitives()) { const a = prim.getAttribute('POSITION'); for (let i = 0; i < a.getCount(); i++) { const v = new THREE.Vector3(...a.getElement(i, [])); min.min(v); max.max(v); } } n.listChildren().forEach(walk); })(node);
  const s = max.sub(min); return s.x >= s.y && s.x >= s.z ? new THREE.Vector3(1, 0, 0) : s.y >= s.z ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(0, 0, 1);
}

const aim = aimPose(), props = R.byName.hunter_bow ? ['hunter_bow'] : [];
for (const a of R.root.listAnimations().filter(a => a.getName() === clipName)) a.dispose();   // rebuilt, not doubled
writeAnim(R, clipName, [aim, aim], 1, props);
if (flags.includes('--into-shot')) {
  // hold the stance through the draw: ease in from the clip, hold, ease out
  const n = Math.round(d * 30), frames = [];
  for (let i = 0; i <= n; i++) {
    const t = i / 30, base = sample(R, shot, t), w = THREE.MathUtils.smoothstep(t, tDraw - .3, tDraw - .05) * (1 - THREE.MathUtils.smoothstep(t, tDraw + .25, tDraw + .5));
    frames.push(w > 0 ? blend(base, aim, w) : base);
  }
  shot.dispose(); writeAnim(R, 'hunter_shot', frames, 30, props);
}
await R.io.write(output, R.doc);
console.log(`${output}: ${clipName} from hunter_shot @${tDraw.toFixed(2)}s`);
