import * as THREE from 'three';

function basis(fingers, palm) {
  const f = fingers.clone().normalize(), p = palm.clone().addScaledVector(f, -palm.dot(f)).normalize();
  if (!Number.isFinite(p.lengthSq()) || p.lengthSq() < .9) throw new Error('Measured prayer palm basis required');
  return new THREE.Matrix4().makeBasis(new THREE.Vector3().crossVectors(f, p).normalize(), f, p);
}

// Opt-in Thai wai fitted to the actual Meshy arms and signed palm planes.
// Keep the existing schedule/activity; this only places the visible hands.
// Thumb semantics and robe clearance still require actual visual/skin QA.
export function createNPCWaiPose(model, calibration, options = {}) {
  const arms = [], p = new THREE.Vector3(), q = new THREE.Quaternion(), parentQ = new THREE.Quaternion();
  model.updateWorldMatrix(true, true);
  for (const [side, frame, sign] of [['left', 'foreL', 1], ['right', 'foreR', -1]]) {
    const prefix = side === 'left' ? 'Left' : 'Right', upper = model.getObjectByName(prefix + 'Arm'), elbow = model.getObjectByName(prefix + 'ForeArm'), wrist = model.getObjectByName(prefix + 'Hand');
    const hand = calibration.hands?.[side], socket = options.sockets?.[frame], grip = options.grips?.[frame];
    if (!upper?.isBone || elbow?.parent !== upper || wrist?.parent !== elbow || !hand || socket?.bone !== wrist.name || !grip?.contact) throw new Error('Actual prayer arm/hand contact contract required');
    const anatomical = options.activityPoses?.hands?.[side];
    const inverse = new THREE.Quaternion().setFromRotationMatrix(basis(new THREE.Vector3().fromArray(anatomical?.fingersLocal ?? hand.fingersLocal), new THREE.Vector3().fromArray(anatomical?.palmLocal ?? hand.palmLocal))).invert();
    const centre = anatomical ? new THREE.Vector3().fromArray(anatomical.centreLocal)
      : new THREE.Vector3().fromArray(grip.contact).applyMatrix4(new THREE.Matrix4().fromArray(socket.matrix));
    arms.push({ upper, elbow, wrist, sign, inverse, centre, palmOffset: anatomical?.palmOffset, a: elbow.position.length(), b: wrist.position.length() });
  }
  const spine = model.getObjectByName('Spine');
  if (!spine?.isBone) throw new Error('Actual prayer chest anchor required');
  const origin = new THREE.Vector3(), up = new THREE.Vector3(), front = new THREE.Vector3(), across = new THREE.Vector3();
  const shoulder = new THREE.Vector3(), target = new THREE.Vector3(), direction = new THREE.Vector3(), pole = new THREE.Vector3(), bend = new THREE.Vector3();
  const old = new THREE.Vector3(), next = new THREE.Vector3(), worldQ = new THREE.Quaternion(), desiredQ = new THREE.Quaternion();
  function worldRotation(bone, rotation) {
    bone.parent.getWorldQuaternion(parentQ); bone.quaternion.copy(parentQ.invert().multiply(rotation)); bone.updateWorldMatrix(false, true);
  }
  function aim(bone, child, endpoint) {
    bone.getWorldPosition(p); child.getWorldPosition(old); old.sub(p).normalize(); next.copy(endpoint).sub(p).normalize();
    q.setFromUnitVectors(old, next).multiply(bone.getWorldQuaternion(worldQ)); worldRotation(bone, q);
  }
  return {
    apply(context) {
      if (context.anim !== 'pray' || context.moving) return false;
      model.updateWorldMatrix(true, true);
      const scale = model.getWorldScale(p).y, size = calibration.coordinates.height / 1.72;
      up.set(0, 1, 0).transformDirection(model.matrixWorld); front.set(0, 0, 1).transformDirection(model.matrixWorld); across.set(1, 0, 0).transformDirection(model.matrixWorld);
      spine.getWorldPosition(origin); origin.addScaledVector(front, .16 * size * scale).addScaledVector(up, -.035 * size * scale);
      for (const arm of arms) {
        const fingers = up.clone().addScaledVector(front, .06).normalize(), palm = across.clone().multiplyScalar(-arm.sign);
        desiredQ.setFromRotationMatrix(basis(fingers, palm)).multiply(arm.inverse);
        target.copy(origin).addScaledVector(across, arm.sign * (arm.palmOffset ?? .021 * size) * scale).sub(arm.centre.clone().applyQuaternion(desiredQ).multiplyScalar(scale));
        arm.upper.getWorldPosition(shoulder); direction.copy(target).sub(shoulder);
        const d = direction.length(), a = arm.a * scale, b = arm.b * scale;
        if (d > a + b - .00001 || d < Math.abs(a - b) + .00001) throw new Error('Measured prayer wrist target unreachable');
        direction.normalize(); pole.copy(up).multiplyScalar(-1).addScaledVector(across, arm.sign * .4).addScaledVector(front, -.12);
        pole.addScaledVector(direction, -pole.dot(direction)).normalize();
        const along = (a * a - b * b + d * d) / (2 * d), rise = Math.sqrt(Math.max(0, a * a - along * along));
        bend.copy(shoulder).addScaledVector(direction, along).addScaledVector(pole, rise);
        aim(arm.upper, arm.elbow, bend); aim(arm.elbow, arm.wrist, target);
        // Pronation belongs along the forearm. Applying the whole palm turn at
        // the wrist alone twists the mixed wrist/forearm skin into a seam.
        const axis = target.clone().sub(bend).normalize();
        const turn = desiredQ.clone().multiply(arm.wrist.getWorldQuaternion(new THREE.Quaternion()).invert());
        const projected = turn.x * axis.x + turn.y * axis.y + turn.z * axis.z;
        let angle = 2 * Math.atan2(projected, turn.w);
        angle = Math.atan2(Math.sin(angle), Math.cos(angle));
        worldRotation(arm.elbow, new THREE.Quaternion().setFromAxisAngle(axis, angle).multiply(arm.elbow.getWorldQuaternion(new THREE.Quaternion())));
        worldRotation(arm.wrist, desiredQ);
      }
      return true;
    },
  };
}
