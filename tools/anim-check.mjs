// Anatomy check for the class GLBs (node tools/anim-check.mjs; needs @gltf-transform/core,
// see tools/muaythai-anims/README.md). For every clip it reports, with the worst frame:
//   elbows/knees bent backwards (hyperextend), sideways off their hinge or twisted;
//   shoulder/hip/wrist/ankle/neck twist or swing past human range (vs the T-pose rest);
//   spine twist > 65° or bend > 75° relative to the pelvis; hands inside the torso;
//   feet/toes through the floor; knees colliding. Hinge axes come from the walk/run cycles.
// Small numbers on Tripo's own clips (walk, kicks: ~10–15°) are within noise.
import { load, sample, worldPos, worldQuat, duration, THREE } from './muaythai-anims/lib.mjs';
const D = THREE.MathUtils.radToDeg;
const here = p => new URL(p, import.meta.url).pathname;
const files = { fighter: here('../public/models/muay-thai-fighter.glb'), herbalist: here('../public/models/herbalist.glb') };
const B = n => 'mixamorig:' + n;
for (const [who, f] of Object.entries(files)) {
  const R = await load(f), nodes = R.byName;
  const rest = new Map(R.nodes.map(n => [n, { r: new THREE.Quaternion(...n.getRotation()) }]));
  const childOf = { LeftArm: 'LeftForeArm', LeftForeArm: 'LeftHand', RightArm: 'RightForeArm', RightForeArm: 'RightHand', LeftUpLeg: 'LeftLeg', LeftLeg: 'LeftFoot', RightUpLeg: 'RightLeg', RightLeg: 'RightFoot', LeftHand: 'LeftHandMiddle1', RightHand: 'RightHandMiddle1', LeftFoot: 'LeftToeBase', RightFoot: 'RightToeBase', Neck: 'Head', Head: 'HeadTop_End', Spine: 'Spine1', Spine1: 'Spine2', Spine2: 'Neck' };
  // bone axis in local space = child's rest translation direction
  const axisOf = j => new THREE.Vector3(...nodes[B(childOf[j])].getTranslation()).normalize();
  const rel = (pose, j) => rest.get(nodes[B(j)]).r.clone().invert().multiply(pose.get(nodes[B(j)]).r);
  const swingTwist = (q, ax) => { const p = new THREE.Vector3(q.x, q.y, q.z).projectOnVector(ax); const twq = new THREE.Quaternion(p.x, p.y, p.z, q.w).normalize(); const sw = q.clone().multiply(twq.clone().invert()); let tw = 2 * Math.atan2(p.dot(ax), q.w); tw = Math.atan2(Math.sin(tw), Math.cos(tw)); return { tw, sw, swA: 2 * Math.acos(Math.min(1, Math.abs(sw.w))), swAx: new THREE.Vector3(sw.x, sw.y, sw.z).normalize().multiplyScalar(Math.sign(sw.w) || 1) }; };
  // hinge reference: flex axes taken from clearly bent frames of idle (knees) and a cast pose (elbows)
  const idle = sample(R, R.anims.idle, who === 'fighter' ? .5 : 1.2);
  // hinge reference: average flex axis over clearly bent frames of the walk and run cycles
  const ref = {};
  for (const j of ['LeftForeArm', 'RightForeArm', 'LeftLeg', 'RightLeg']) {
    const acc = new THREE.Vector3();
    for (const clip of ['walk', 'run']) for (let t = 0; t < duration(R.anims[clip]); t += .05) { const st = swingTwist(rel(sample(R, R.anims[clip], t), j), axisOf(j)); if (D(st.swA) > 20) acc.add(st.swAx); }
    ref[j] = acc.normalize();
  }
  // elbows of the herbalist are straight in idle: take the folded-arm frame anyway (it is folded) — fine for both
  const rows = [];
  const hipsN = nodes[B('Hips')];
  const ground0 = Math.min(worldPos(R, idle, B('LeftToeBase')).y, worldPos(R, idle, B('RightToeBase')).y, worldPos(R, idle, B('LeftFoot')).y, worldPos(R, idle, B('RightFoot')).y);
  const height = worldPos(R, idle, B('HeadTop_End')).y - ground0;
  for (const [name, A] of Object.entries(R.anims)) {
    const dur = duration(A), issues = {};
    const note = (k, t, v) => { if (!issues[k] || Math.abs(v) > Math.abs(issues[k].v)) issues[k] = { t: +t.toFixed(2), v: +v.toFixed(0) }; };
    for (let t = 0; t <= dur + 1e-6; t += 1 / 30) {
      const p = sample(R, A, t);
      for (const j of ['LeftForeArm', 'RightForeArm', 'LeftLeg', 'RightLeg']) {
        const st = swingTwist(rel(p, j), axisOf(j)); const flex = D(st.swA) * Math.sign(st.swAx.dot(ref[j]));
        const off = D(st.swAx.angleTo(ref[j]));
        if (flex < -8) note(j + ' hyperextend°', t, flex);
        if (D(st.swA) > 25 && off > 35 && off < 145) note(j + ' sideways-bend° (off-hinge)', t, off);
        if (Math.abs(D(st.tw)) > 60) note(j + ' twist°', t, D(st.tw));
        if (flex > 165) note(j + ' over-flex°', t, flex);
      }
      for (const j of ['LeftArm', 'RightArm', 'LeftUpLeg', 'RightUpLeg', 'LeftHand', 'RightHand', 'LeftFoot', 'RightFoot', 'Neck', 'Head']) {
        const st = swingTwist(rel(p, j), axisOf(j)); const tw = D(st.tw), sw = D(st.swA);
        const lim = { LeftArm: [95, 170], RightArm: [95, 170], LeftUpLeg: [50, 130], RightUpLeg: [50, 130], LeftHand: [70, 85], RightHand: [70, 85], LeftFoot: [35, 55], RightFoot: [35, 55], Neck: [60, 45], Head: [60, 45] }[j];
        if (Math.abs(tw) > lim[0]) note(j + ' twist°', t, tw);
        if (sw > lim[1]) note(j + ' swing°', t, sw);
      }
      // whole spine relative to hips
      const sq = worldQuat(R, p, hipsN).invert().multiply(worldQuat(R, p, nodes[B('Spine2')]));
      const sst = swingTwist(sq, new THREE.Vector3(0, 1, 0)); if (Math.abs(D(sst.tw)) > 65) note('spine twist°', t, D(sst.tw)); if (D(sst.swA) > 75) note('spine bend°', t, D(sst.swA));
      // hands inside the torso: distance to the hips→neck segment
      const h0 = worldPos(R, p, B('Spine')), n0 = worldPos(R, p, B('Neck')), seg = new THREE.Line3(h0, n0), c = new THREE.Vector3();
      for (const s of ['LeftHand', 'RightHand']) { const hp = worldPos(R, p, B(s)); seg.closestPointToPoint(hp, true, c); const d = hp.distanceTo(c) / height; if (d < .055) note(s + ' inside torso (dist %h)', t, d * 100); }
      // knees/feet through each other and feet through ground
      for (const s of ['LeftToeBase', 'RightToeBase', 'LeftFoot', 'RightFoot']) { const y = (worldPos(R, p, B(s)).y - ground0) / height * 100; if (y < -2.5) note(s + ' below ground (%h)', t, y); }
      const kd = worldPos(R, p, B('LeftLeg')).distanceTo(worldPos(R, p, B('RightLeg'))) / height; if (kd < .04) note('knees collide (%h)', t, kd * 100);
    }
    rows.push([name, Object.entries(issues).map(([k, v]) => `${k}=${v.v}@${v.t}`).join('; ') || 'ok']);
  }
  console.log('\n== ' + who); for (const r of rows) console.log(r[0].padEnd(14), r[1]);
}
