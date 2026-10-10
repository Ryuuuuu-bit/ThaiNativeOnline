import { THREE, restoreRest, worldVertices, canonicalFrame, canonicalWorlds, localPose, rigContract, assertNativeContract } from './rig.mjs';
import { fitRelaxedIdle } from './anatomy.mjs';

// Names verified from the first actual keeper, not inferred from a player rig.
export const MESHY_NPC_JOINTS = Object.freeze(['Hips', 'Spine02', 'Spine01', 'Spine', 'neck', 'Head', 'head_end', 'headfront', 'LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand', 'RightShoulder', 'RightArm', 'RightForeArm', 'RightHand', 'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'LeftToeBase', 'RightUpLeg', 'RightLeg', 'RightFoot', 'RightToeBase']);

export function verifyMeshyFrame(rig, profile, frame) {
  const names = rig.mesh.skeleton.bones.map(o => rig.objectNames.get(o));
  if (names.length !== 24 || MESHY_NPC_JOINTS.some(n => !names.includes(n))) throw Error('Actual source is not the inspected Meshy 24-joint NPC contract');
  const worlds = canonicalWorlds(rig, frame), p = n => new THREE.Vector3().setFromMatrixPosition(worlds.get(n));
  if (p('headfront').sub(p('Head')).z < profile.height * 0.05) throw Error('Inspected forward axis disagrees with actual head-front marker');
  const hip = p('Hips');
  for (const [side, sign] of [['Left', 1], ['Right', -1]]) for (const end of ['Shoulder', 'Arm', 'UpLeg']) if ((p(side + end).x - hip.x) * sign < 0.01) throw Error(`Inspected side disagrees with ${side + end}`);
}

export function adapterContract(rig, frame, profile, hands) {
  restoreRest(rig);
  const bindWorlds = canonicalWorlds(rig, frame), bind = localPose(rig, bindWorlds);
  for (const [name, q] of Object.entries(profile.idleRotations ?? {})) rig.names.get(name).quaternion.fromArray(q);
  rig.gltf.scene.updateMatrixWorld(true);
  const idleWorlds = canonicalWorlds(rig, frame), idle = localPose(rig, idleWorlds), nodes = {};
  const pointingTo = { LeftArm: 'LeftForeArm', LeftForeArm: 'LeftHand', RightArm: 'RightForeArm', RightForeArm: 'RightHand', LeftUpLeg: 'LeftLeg', LeftLeg: 'LeftFoot', RightUpLeg: 'RightLeg', RightLeg: 'RightFoot', Head: 'headfront' };
  for (let i = 0; i < bind.length; i++) {
    const b = bind[i], matrix = bindWorlds.get(b.name), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(); matrix.decompose(p, q, s);
    const inverse = q.clone().invert(), forwardLocal = new THREE.Vector3(0, 0, 1).applyQuaternion(inverse), upLocal = new THREE.Vector3(0, 1, 0).applyQuaternion(inverse), child = pointingTo[b.name];
    const along = child ? new THREE.Vector3().setFromMatrixPosition(bindWorlds.get(child)).sub(p).normalize().applyQuaternion(inverse) : null;
    nodes[b.name] = { parent: rigContract(rig).find(n => n.name === b.name).parent, bindLocal: { translation: b.p.toArray(), rotation: b.q.toArray(), scale: b.s.toArray() }, idleLocal: { translation: idle[i].p.toArray(), rotation: idle[i].q.toArray(), scale: idle[i].s.toArray() }, bindWorld: matrix.toArray(), idleWorld: idleWorlds.get(b.name).toArray(), axes: { forwardLocal: forwardLocal.toArray(), upLocal: upLocal.toArray(), ...(along ? { alongLocal: along.toArray(), bendTowardForwardLocal: along.clone().cross(forwardLocal).normalize().toArray() } : {}) } };
  }
  restoreRest(rig);
  return { schema: 1, sourceHashes: profile.sources, coordinates: { up: '+Y', front: '+Z', units: 'metres', height: profile.height, footOrigin: [0, 0, 0], meshTransform: 'identity before optional gltfpack quantization transform' }, clips: ['idle', 'walk', 'run'], semantics: profile.semantics, nodes, hands, instructions: ['Use baked idle/walk/run; horizontal travel already removed. No runtime model-scale compensation.', 'Reset modified joints to the evaluated clip pose each frame before applying calibrated role offsets.', 'Local axes come from this body only. Do not transfer quaternions across different family bind frames.', 'Held-prop socket alignment still requires native visual review. The 24-joint rig has no finger articulation.'] };
}

export function compileCalibration(sources, guide) {
  if (guide.schema !== 1) throw Error('Calibration schema must be 1');
  for (const role of ['body', 'walk', 'run']) if (!sources[role] || guide.sources?.[role] !== sources[role].sha256) throw Error(`Calibration ${role} SHA does not match actual input`);
  for (const role of ['walk', 'run']) assertNativeContract(sources.body, sources[role]);
  const rig = sources.body, frame = canonicalFrame(worldVertices(rig), guide, guide.height);
  verifyMeshyFrame(rig, guide, frame);
  const fit = fitRelaxedIdle(rig, frame, guide), profile = { ...guide, idleRotations: fit.rotations };
  return { profile, adapter: { ...adapterContract(rig, frame, profile, fit.hands), fitMethod: fit.method } };
}
