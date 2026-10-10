import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { readGLB } from './glb.mjs';

export { THREE };

export async function loadRig(file) {
  const source = await readGLB(file);
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).register(() => ({ name: 'QA_TEXTURES', loadTexture: () => Promise.resolve(new THREE.Texture()) }));
  const gltf = await loader.parseAsync(source.bytes.buffer.slice(source.bytes.byteOffset, source.bytes.byteOffset + source.bytes.byteLength), '');
  const meshes = []; gltf.scene.traverse(o => { if (o.isMesh) meshes.push(o); });
  if (meshes.length !== 1 || !meshes[0].isSkinnedMesh) throw Error('Expected exactly one skinned mesh');
  const mesh = meshes[0];
  if (Array.isArray(mesh.material) || mesh.geometry.groups.length > 1 || mesh.morphTargetInfluences?.length) throw Error('Expected one primitive/material and no morph targets');
  const members = new Set(mesh.skeleton.bones);
  for (const bone of mesh.skeleton.bones) for (let p = bone.parent; p && p !== gltf.scene; p = p.parent) members.add(p);
  const objects = []; gltf.scene.traverse(o => { if (members.has(o)) objects.push(o); });
  const names = new Map();
  for (const o of objects) {
    const id = gltf.parser.associations.get(o)?.nodes;
    const name = source.json.nodes?.[id]?.name ?? o.name;
    if (!name || names.has(name)) throw Error(`Missing or duplicate rig name: ${name}`);
    names.set(name, o);
  }
  const objectNames = new Map([...names].map(([n, o]) => [o, n]));
  gltf.scene.updateMatrixWorld(true); mesh.skeleton.update();
  const rest = new Map(objects.map(o => [o, { world: o.matrixWorld.clone(), p: o.position.clone(), q: o.quaternion.clone(), s: o.scale.clone() }]));
  return { ...source, gltf, mesh, objects, names, objectNames, rest };
}

export function restoreRest(rig) {
  for (const [o, r] of rig.rest) { o.position.copy(r.p); o.quaternion.copy(r.q); o.scale.copy(r.s); }
  rig.gltf.scene.updateMatrixWorld(true); rig.mesh.skeleton.update();
}

export function worldVertices(rig) {
  rig.gltf.scene.updateMatrixWorld(true); rig.mesh.skeleton.update();
  const values = new Float64Array(rig.mesh.geometry.attributes.position.count * 3), v = new THREE.Vector3();
  for (let i = 0; i < values.length / 3; i++) { rig.mesh.getVertexPosition(i, v); v.applyMatrix4(rig.mesh.matrixWorld); v.toArray(values, i * 3); }
  return values;
}

export function restGeometryMatrix(rig) {
  // glTF loaders bind with identity. In attached mode bindMatrixInverse can
  // cancel a centimetre-scaled mesh ancestor, so mesh.matrixWorld alone is
  // not the rest geometry frame. Verify all weighted rest matrices against
  // this reference in inspectRig before using it for transformed normals.
  return rig.mesh.matrixWorld.clone().multiply(rig.mesh.bindMatrixInverse)
    .multiply(rig.mesh.skeleton.bones[0].matrixWorld).multiply(rig.mesh.skeleton.boneInverses[0]).multiply(rig.mesh.bindMatrix);
}

export function rigContract(rig) {
  return rig.objects.map(o => ({ name: rig.objectNames.get(o), parent: rig.objectNames.get(o.parent) ?? null, joint: rig.mesh.skeleton.bones.includes(o), matrix: rig.rest.get(o).world.toArray() }));
}

export function assertNativeContract(body, donor, tolerance = 1e-4) {
  const expected = rigContract(body), actual = rigContract(donor);
  if (expected.length !== actual.length) throw Error('Native clip rig node count differs');
  const byName = new Map(actual.map(n => [n.name, n]));
  for (const n of expected) {
    const a = byName.get(n.name);
    if (!a || a.parent !== n.parent || a.joint !== n.joint) throw Error(`Native clip bone contract differs: ${n.name}`);
    if (a.matrix.some((v, i) => Math.abs(v - n.matrix[i]) > tolerance)) throw Error(`Native clip rest frame differs: ${n.name}`);
  }
  const a = body.mesh.skeleton.bones.map(o => body.objectNames.get(o));
  const b = donor.mesh.skeleton.bones.map(o => donor.objectNames.get(o));
  if (a.length !== b.length || a.some(n => !b.includes(n))) throw Error('Native clip joints differ');
}

export function sampleTimes(clip, hz = 30) {
  if (!(clip.duration > 0) || !Number.isFinite(clip.duration) || clip.duration > 30) throw Error('Invalid or unbounded clip duration');
  const times = new Set([0, clip.duration]);
  for (const track of clip.tracks) for (const t of track.times) if (Number.isFinite(t) && t >= 0 && t <= clip.duration) times.add(t);
  // Keep every actual key and the exact endpoint. Prefer an authored float32
  // key over a nearly identical clock-grid time, never discard the endpoint.
  const keys = [...times].sort((a, b) => a - b);
  for (let i = 0; i <= Math.floor(clip.duration * hz); i++) {
    const t = i / hz; let lo = 0, hi = keys.length;
    while (lo < hi) { const mid = (lo + hi) >>> 1; if (keys[mid] < t) lo = mid + 1; else hi = mid; }
    if ((keys[lo] === undefined || Math.abs(keys[lo] - t) > 1e-7) && (keys[lo - 1] === undefined || Math.abs(keys[lo - 1] - t) > 1e-7)) times.add(t);
  }
  return [...times].sort((a, b) => a - b);
}

export function clampedSampler(rig, clip) {
  restoreRest(rig);
  const mixer = new THREE.AnimationMixer(rig.gltf.scene), action = mixer.clipAction(clip);
  action.setLoop(THREE.LoopOnce, 1); action.clampWhenFinished = true; action.play();
  return { at(t) { action.reset().play(); mixer.setTime(Math.min(clip.duration, Math.max(0, t))); rig.gltf.scene.updateMatrixWorld(true); rig.mesh.skeleton.update(); }, dispose() { mixer.stopAllAction(); mixer.uncacheRoot(rig.gltf.scene); restoreRest(rig); } };
}

export function decomposeRigid(matrix, label) {
  const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(); matrix.decompose(p, q, s);
  if (![...p, ...q, ...s].every(Number.isFinite) || s.toArray().some(v => v <= 0)) throw Error(`Invalid transform: ${label}`);
  const rebuilt = new THREE.Matrix4().compose(p, q, s);
  if (rebuilt.elements.some((v, i) => Math.abs(v - matrix.elements[i]) > 1e-5)) throw Error(`Shear is unsupported: ${label}`);
  return { p, q, s };
}

export function canonicalFrame(vertices, calibration, height) {
  if (![1.72, 1.2].includes(height)) throw Error('Expected adult height 1.72 or novice height 1.2');
  const read = (value, label) => {
    if (!Array.isArray(value) || value.length !== 3 || !value.every(Number.isFinite)) throw Error(`Explicit ${label} calibration required`);
    return new THREE.Vector3(...value);
  };
  const up = read(calibration.up, 'up'), front = read(calibration.forward, 'forward'), origin = read(calibration.footOrigin, 'footOrigin');
  if (Math.abs(up.length() - 1) > 1e-5 || Math.abs(front.length() - 1) > 1e-5 || Math.abs(up.dot(front)) > 1e-5) throw Error('Calibration axes must be orthogonal unit vectors');
  const right = new THREE.Vector3().crossVectors(up, front), basis = new THREE.Matrix4().makeBasis(right, up, front).invert();
  let min = Infinity, max = -Infinity;
  for (let i = 0; i < vertices.length; i += 3) { const y = new THREE.Vector3().fromArray(vertices, i).sub(origin).dot(up); min = Math.min(min, y); max = Math.max(max, y); }
  if (!(max > 0) || Math.abs(min) > max * 0.01) throw Error('Calibrated foot origin is not on the geometry floor');
  const scale = height / max;
  const matrix = new THREE.Matrix4().makeScale(scale, scale, scale).multiply(basis).multiply(new THREE.Matrix4().makeTranslation(...origin.clone().negate()));
  return { matrix, scale, sourceHeight: max, sourceFloor: min, height };
}

export function canonicalWorlds(rig, frame) {
  return new Map(rig.objects.map(o => {
    const { s } = decomposeRigid(rig.rest.get(o).world, rig.objectNames.get(o));
    if (Math.max(...s.toArray()) - Math.min(...s.toArray()) > 1e-5) throw Error(`Nonuniform rest scale: ${rig.objectNames.get(o)}`);
    return [rig.objectNames.get(o), frame.matrix.clone().multiply(o.matrixWorld).scale(new THREE.Vector3(1 / (s.x * frame.scale), 1 / (s.y * frame.scale), 1 / (s.z * frame.scale)))];
  }));
}

export function inPlaceWorlds(worlds, hipsName, restHip, firstHip, fixedAncestors = new Map()) {
  const hip = worlds.get(hipsName); if (!hip) throw Error(`Missing calibrated hips: ${hipsName}`);
  const current = new THREE.Vector3().setFromMatrixPosition(hip);
  const shift = new THREE.Vector3(restHip.x - current.x, restHip.y - firstHip.y, restHip.z - current.z);
  return new Map([...worlds].map(([name, m]) => {
    const matrix = m.clone(), p = fixedAncestors.has(name) ? new THREE.Vector3().setFromMatrixPosition(fixedAncestors.get(name)) : new THREE.Vector3().setFromMatrixPosition(matrix).add(shift);
    matrix.setPosition(p); return [name, matrix];
  }));
}

export function localPose(rig, worlds) {
  return rig.objects.map(o => {
    const name = rig.objectNames.get(o), parent = rig.objectNames.get(o.parent);
    const matrix = parent ? worlds.get(parent).clone().invert().multiply(worlds.get(name)) : worlds.get(name);
    return { name, ...decomposeRigid(matrix, name) };
  });
}
