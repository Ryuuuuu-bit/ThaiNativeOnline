import { THREE, worldVertices, restoreRest, canonicalWorlds } from './rig.mjs';
import { resolveSemantics } from './audit.mjs';

function symmetricEigen(matrix) {
  const a = matrix.map(row => row.slice()), vectors = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  for (let pass = 0; pass < 32; pass++) {
    let p = 0, q = 1;
    for (const [i, j] of [[0, 2], [1, 2]]) if (Math.abs(a[i][j]) > Math.abs(a[p][q])) { p = i; q = j; }
    if (Math.abs(a[p][q]) < 1e-12) break;
    const theta = 0.5 * Math.atan2(2 * a[p][q], a[q][q] - a[p][p]), c = Math.cos(theta), s = Math.sin(theta);
    const app = a[p][p], aqq = a[q][q], apq = a[p][q];
    a[p][p] = c * c * app - 2 * s * c * apq + s * s * aqq; a[q][q] = s * s * app + 2 * s * c * apq + c * c * aqq; a[p][q] = a[q][p] = 0;
    for (let k = 0; k < 3; k++) if (k !== p && k !== q) { const kp = a[k][p], kq = a[k][q]; a[k][p] = a[p][k] = c * kp - s * kq; a[k][q] = a[q][k] = s * kp + c * kq; }
    for (let k = 0; k < 3; k++) { const kp = vectors[k][p], kq = vectors[k][q]; vectors[k][p] = c * kp - s * kq; vectors[k][q] = s * kp + c * kq; }
  }
  return [0, 1, 2].map(i => ({ value: a[i][i], axis: new THREE.Vector3(vectors[0][i], vectors[1][i], vectors[2][i]).normalize() })).sort((x, y) => x.value - y.value);
}

export function measureHand(rig, handName, { palmReference, minimumWeight = 0.8 } = {}) {
  const hand = rig.names.get(handName), index = rig.mesh.skeleton.bones.indexOf(hand);
  if (index < 0 || !Array.isArray(palmReference) || palmReference.length !== 3 || !palmReference.every(Number.isFinite) || Math.hypot(...palmReference) < 0.1) throw Error('An inspected hand and palm-facing reference are required');
  const vertices = worldVertices(rig), { skinIndex, skinWeight } = rig.mesh.geometry.attributes, points = [];
  // Position weld avoids UV seam duplication biasing the measured palm plane.
  const seen = new Set();
  for (let i = 0; i < skinIndex.count; i++) {
    let w = 0; for (let k = 0; k < 4; k++) if (skinIndex.getComponent(i, k) === index) w += skinWeight.getComponent(i, k);
    if (w < minimumWeight) continue;
    const p = new THREE.Vector3().fromArray(vertices, i * 3), key = p.toArray().map(v => Math.round(v * 1e6)).join(':');
    if (!seen.has(key)) { points.push(p); seen.add(key); }
  }
  if (points.length < 12) throw Error(`Insufficient actual hand surface for ${handName}`);
  const mean = points.reduce((s, p) => s.add(p), new THREE.Vector3()).divideScalar(points.length), cov = Array.from({ length: 3 }, () => [0, 0, 0]);
  for (const p of points) { const d = p.clone().sub(mean).toArray(); for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) cov[i][j] += d[i] * d[j] / points.length; }
  const eigen = symmetricEigen(cov), normal = eigen[0].axis, reference = new THREE.Vector3(...palmReference).normalize();
  if (Math.abs(normal.dot(reference)) < 0.6 || eigen[0].value / eigen[1].value > 0.5) throw Error(`Ambiguous actual palm plane: ${handName}`);
  if (normal.dot(reference) < 0) normal.negate();
  const wrist = new THREE.Vector3().setFromMatrixPosition(hand.matrixWorld), fingers = mean.clone().sub(wrist).addScaledVector(normal, -mean.clone().sub(wrist).dot(normal)).normalize();
  if (!fingers.toArray().every(Number.isFinite) || mean.distanceTo(wrist) < 0.02) throw Error(`Ambiguous actual finger direction: ${handName}`);
  const inverse = hand.getWorldQuaternion(new THREE.Quaternion()).invert();
  return { name: handName, vertices: points.length, centroid: mean.toArray(), wrist: wrist.toArray(), eigenvalues: eigen.map(e => e.value), fingersWorld: fingers.toArray(), palmWorld: normal.toArray(), fingersLocal: fingers.clone().applyQuaternion(inverse).toArray(), palmLocal: normal.clone().applyQuaternion(inverse).toArray() };
}

const frameQuaternion = (finger, palm) => {
  const f = finger.clone().normalize(), n = palm.clone().addScaledVector(f, -palm.dot(f)).normalize(), across = new THREE.Vector3().crossVectors(f, n).normalize();
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(across, f, n));
};

export function fitRelaxedIdle(rig, frame, profile) {
  restoreRest(rig); const anatomy = resolveSemantics(rig, profile.semantics), rotations = {}, hands = {}, sourceHands = {};
  const canonicalToSource = new THREE.Matrix3().getNormalMatrix(frame.matrix.clone().invert());
  const direction = value => { if (!Array.isArray(value) || value.length !== 3 || !value.every(Number.isFinite) || Math.hypot(...value) < 0.1) throw Error('Explicit calibrated idle direction required'); return new THREE.Vector3(...value).applyMatrix3(canonicalToSource).normalize(); };
  for (const side of ['left', 'right']) {
    const a = anatomy[side], config = profile.idleDirections?.[side];
    sourceHands[side] = { measurement: measureHand(rig, profile.semantics[side].hand, { palmReference: config?.sourcePalm }), quaternion: a.hand.getWorldQuaternion(new THREE.Quaternion()) };
  }
  const worldRotation = (bone, rotation) => {
    const parent = bone.parent.getWorldQuaternion(new THREE.Quaternion()); bone.quaternion.copy(parent.invert().multiply(rotation)); rotations[rig.objectNames.get(bone)] = bone.quaternion.toArray(); rig.gltf.scene.updateMatrixWorld(true);
  };
  for (const side of ['left', 'right']) {
    const a = anatomy[side], config = profile.idleDirections[side];
    for (const [bone, child, wanted] of [[a.upperArm, a.forearm, config.upper], [a.forearm, a.hand, config.forearm]]) {
      const vector = new THREE.Vector3().setFromMatrixPosition(child.matrixWorld).sub(new THREE.Vector3().setFromMatrixPosition(bone.matrixWorld)).normalize();
      const delta = new THREE.Quaternion().setFromUnitVectors(vector, direction(wanted)); worldRotation(bone, delta.multiply(bone.getWorldQuaternion(new THREE.Quaternion())));
    }
    const measured = sourceHands[side].measurement, targetF = direction(config.forearm), targetN = direction(config.palm);
    const delta = frameQuaternion(targetF, targetN).multiply(frameQuaternion(new THREE.Vector3(...measured.fingersWorld), new THREE.Vector3(...measured.palmWorld)).invert());
    worldRotation(a.hand, delta.multiply(sourceHands[side].quaternion)); hands[side] = measured;
  }
  const worlds = canonicalWorlds(rig, frame), adapter = Object.fromEntries([...worlds].map(([name, m]) => {
    const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(); m.decompose(p, q, s);
    return [name, { neutralPosition: p.toArray(), neutralQuaternion: q.toArray(), sourceLocalQuaternion: rig.rest.get(rig.names.get(name)).q.toArray(), idleLocalQuaternion: rig.names.get(name).quaternion.toArray() }];
  }));
  restoreRest(rig);
  return { rotations, hands, adapter, method: 'Measured upper/forearm child vectors; shortest world rotations preserve source roll. Actual weighted hand surface PCA supplies signed palm normal and wrist-to-fingers direction. Desired directions are explicit in calibrated +Y/+Z frame.' };
}
