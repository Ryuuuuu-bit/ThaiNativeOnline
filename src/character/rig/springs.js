import * as THREE from 'three';

// VRM-style spring bones: each chain joint keeps a simulated tail position
// with inertia, a stiffness pull back toward the animated pose, gravity and
// sphere colliders on the body. Runs after the AnimationMixer every frame.
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _q = new THREE.Quaternion(), _pq = new THREE.Quaternion();
const GRAVITY = new THREE.Vector3(0, -1, 0);

export class SpringSystem {
  constructor(chains, colliders, bones) {
    this.colliders = colliders.map(c => ({ ...c, boneObj: bones.find(b => b.name === c.bone), world: new THREE.Vector3() }));
    this.joints = [];
    for (const chain of chains) {
      for (let i = 0; i < chain.bones.length - 1; i++) {
        const bone = chain.bones[i], child = chain.bones[i + 1];
        this.joints.push({
          bone, child, axis: child.position.clone().normalize(), length: child.position.length(),
          rest: bone.quaternion.clone(), tail: new THREE.Vector3(), prev: new THREE.Vector3(),
          stiffness: chain.stiffness, drag: chain.drag, gravity: chain.gravity, radius: chain.radius, collide: chain.collide,
          ready: false,
        });
      }
    }
  }
  reset() { for (const j of this.joints) j.ready = false; }
  update(dt) {
    if (!this.joints.length) return;
    dt = Math.min(dt, 1 / 30);
    for (const c of this.colliders) c.world.copy(c.offset).applyMatrix4(c.boneObj.matrixWorld);
    for (const j of this.joints) {
      const { bone } = j;
      bone.quaternion.copy(j.rest);
      bone.parent.updateMatrixWorld(); bone.updateMatrixWorld();
      const head = _a.setFromMatrixPosition(bone.matrixWorld);
      bone.parent.getWorldQuaternion(_pq);
      const restDir = _b.copy(j.axis).applyQuaternion(_q.copy(_pq).multiply(j.rest));
      const scale = bone.matrixWorld.getMaxScaleOnAxis(), len = j.length * scale;
      if (!j.ready) { j.tail.copy(head).addScaledVector(restDir, len); j.prev.copy(j.tail); j.ready = true; }
      const next = _c.copy(j.tail).addScaledVector(_c.clone().subVectors(j.tail, j.prev), 1 - j.drag);
      next.addScaledVector(restDir, j.stiffness * dt * len * 4).addScaledVector(GRAVITY, j.gravity * dt * len * 2.2);
      next.sub(head).setLength(len).add(head);
      if (j.collide) for (const c of this.colliders) {
        const r = (c.radius + j.radius) * scale, dist = next.distanceTo(c.world);
        if (dist < r) next.sub(c.world).setLength(r).add(c.world).sub(head).setLength(len).add(head);
      }
      j.prev.copy(j.tail); j.tail.copy(next);
      // Rotate the bone so its child points at the simulated tail.
      const to = next.clone().sub(head).normalize();
      _q.setFromUnitVectors(restDir.normalize(), to);
      const worldQ = _q.multiply(_pq.clone().multiply(j.rest));
      bone.quaternion.copy(_pq.invert().multiply(worldQ));
      bone.updateMatrixWorld();
    }
  }
}
