import * as THREE from 'three';
import { materials } from './materials.js';

export function mesh(geometry, material, parent, x = 0, y = 0, z = 0, scale) {
  const m = new THREE.Mesh(geometry, material); m.position.set(x, y, z);
  if (scale) m.scale.set(...scale);
  m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
}

const boxGeo = new THREE.BoxGeometry(1, 1, 1);
export function box(parent, material, x, y, z, sx, sy, sz) { return mesh(boxGeo, material, parent, x, y, z, [sx, sy, sz]); }

export function cylinder(parent, material, x, y, z, top, bottom, height, segments = 12) {
  return mesh(new THREE.CylinderGeometry(top, bottom, height, segments), material, parent, x, y, z);
}

/** A tapered limb from `from` to `to` (both [x, y, z]). */
export function branchBetween(parent, from, to, radius) {
  const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to), d = b.clone().sub(a);
  const m = mesh(new THREE.CylinderGeometry(radius * .55, radius, d.length(), 7), materials.branch, parent);
  m.position.copy(a.add(b).multiplyScalar(.5)); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
}
