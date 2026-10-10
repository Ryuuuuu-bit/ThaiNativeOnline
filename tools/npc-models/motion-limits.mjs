import { THREE, localPose } from './rig.mjs';

export function forwardKnees(rig, worlds, semantics, restWorlds) {
  const position = name => new THREE.Vector3().setFromMatrixPosition(worlds.get(name));
  const rotation = matrix => { const q = new THREE.Quaternion(); matrix.decompose(new THREE.Vector3(), q, new THREE.Vector3()); return q; };
  const restHip = rotation(restWorlds.get(semantics.hips)), poseHip = rotation(worlds.get(semantics.hips));
  const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(poseHip.multiply(restHip.invert()));
  let corrected = 0;
  for (const side of ['left', 'right']) {
    const s = semantics[side], hip = position(s.thigh), knee = position(s.shin), ankle = position(s.foot), upper = knee.clone().sub(hip).normalize();
    const plane = forward.clone().addScaledVector(upper, -forward.dot(upper)).normalize(), lower = ankle.clone().sub(knee), projection = lower.dot(plane);
    if (projection <= 1e-8) continue;
    const wanted = lower.clone().addScaledVector(plane, -2 * projection), delta = new THREE.Quaternion().setFromUnitVectors(lower.clone().normalize(), wanted.normalize());
    const transform = new THREE.Matrix4().makeTranslation(...knee).multiply(new THREE.Matrix4().makeRotationFromQuaternion(delta)).multiply(new THREE.Matrix4().makeTranslation(...knee.clone().negate()));
    const shin = rig.names.get(s.shin);
    for (const o of rig.objects) {
      let ancestor = o; while (ancestor && ancestor !== shin) ancestor = ancestor.parent;
      if (ancestor) worlds.get(rig.objectNames.get(o)).premultiply(transform);
    }
    corrected++;
  }
  return corrected;
}

function poseWorlds(rig, pose) {
  const worlds = new Map();
  for (const p of pose) {
    const matrix = new THREE.Matrix4().compose(p.p, p.q, p.s), parent = rig.objectNames.get(rig.names.get(p.name).parent);
    if (parent) matrix.premultiply(worlds.get(parent)); worlds.set(p.name, matrix);
  }
  return worlds;
}

// Translation changes only the skeleton's common Y. Geometry and native timing
// remain intact; this is floor clearance, not planted-foot IK or navigation.
export function groundAnimations(rig, positions, restWorlds, animations) {
  const names = rig.mesh.skeleton.bones.map(o => rig.objectNames.get(o)), inverse = names.map(n => restWorlds.get(n).clone().invert()), { skinIndex, skinWeight } = rig.mesh.geometry.attributes;
  const report = [];
  for (const animation of animations) {
    let maxLift = 0;
    for (let n = 0; n < animation.poses.length; n++) {
      const worlds = poseWorlds(rig, animation.poses[n]), matrices = names.map((name, i) => worlds.get(name).clone().multiply(inverse[i]).elements);
      let min = Infinity;
      for (let i = 0; i < positions.length / 3; i++) {
        const x = positions[i * 3], y = positions[i * 3 + 1], z = positions[i * 3 + 2]; let posedY = 0;
        for (let k = 0; k < 4; k++) { const m = matrices[skinIndex.getComponent(i, k)], w = skinWeight.getComponent(i, k); posedY += w * (m[1] * x + m[5] * y + m[9] * z + m[13]); }
        min = Math.min(min, posedY);
      }
      const lift = Math.max(0, -min); maxLift = Math.max(maxLift, lift);
      if (lift > 0.1) throw Error('Floor correction exceeds bounded 10cm; inspect the gait');
      if (lift > 0) {
        for (const name of names) worlds.get(name).elements[13] += lift;
        animation.poses[n] = localPose(rig, worlds);
      }
    }
    report.push({ clip: animation.name, maxLift });
  }
  return report;
}
