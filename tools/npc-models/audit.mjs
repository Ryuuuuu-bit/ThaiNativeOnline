import { THREE, restoreRest, worldVertices, restGeometryMatrix, sampleTimes, clampedSampler, rigContract } from './rig.mjs';

export const LIMITS = Object.freeze({ bytes: 800000, targetTriangles: 12000, triangles: 16000, sampleHz: 30, edgeMinimum: 0.005, edgeRatio: 2, edgeExtension: 0.01, segmentDrift: 0.005, handDrift: 0.001, rootDrift: 0.001, hipStart: 0.005, loopPosition: 0.03, kneeBackward: 0.005, kneeFlexDegrees: 8, jointSpeed: 12, idleArmDegrees: 55, floor: -0.01 });

const pos = matrix => new THREE.Vector3().setFromMatrixPosition(matrix);
const point = (values, i) => new THREE.Vector3().fromArray(values, i * 3);
const round = n => Number.isFinite(n) ? +n.toFixed(7) : String(n);

export function bounds(values) {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < values.length; i++) { if (!Number.isFinite(values[i])) throw Error('Nonfinite skinned geometry'); min[i % 3] = Math.min(min[i % 3], values[i]); max[i % 3] = Math.max(max[i % 3], values[i]); }
  return { min, max, size: max.map((v, i) => v - min[i]) };
}

export function indexEdges(geometry, rest) {
  const ids = geometry.index?.array ?? Array.from({ length: rest.length / 3 }, (_, i) => i);
  if (ids.length % 3) throw Error('Invalid triangle indices');
  const seen = new Set(), edges = [];
  for (let i = 0; i < ids.length; i += 3) for (const [a, b] of [[ids[i], ids[i + 1]], [ids[i + 1], ids[i + 2]], [ids[i + 2], ids[i]]]) {
    if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0 || a * 3 >= rest.length || b * 3 >= rest.length) throw Error('Index outside vertex buffer');
    const key = `${Math.min(a, b)}:${Math.max(a, b)}`; if (seen.has(key)) continue; seen.add(key);
    const length = point(rest, a).distanceTo(point(rest, b));
    if (length >= LIMITS.edgeMinimum) edges.push({ a, b, length });
  }
  return edges;
}

export function edgeStrain(values, edges) {
  let maxRatio = 1, maxExtension = 0, violations = 0;
  for (const { a, b, length } of edges) {
    const dx = values[a * 3] - values[b * 3], dy = values[a * 3 + 1] - values[b * 3 + 1], dz = values[a * 3 + 2] - values[b * 3 + 2];
    const now = Math.hypot(dx, dy, dz), ratio = now / length, extension = now - length;
    maxRatio = Math.max(maxRatio, ratio); maxExtension = Math.max(maxExtension, extension);
    if (ratio > LIMITS.edgeRatio && extension > LIMITS.edgeExtension) violations++;
  }
  return { maxRatio, maxExtension, violations };
}

export function validateWeights(rig) {
  const { position, skinIndex, skinWeight } = rig.mesh.geometry.attributes;
  if (!position || !skinIndex || !skinWeight || skinIndex.count !== position.count || skinWeight.count !== position.count || skinIndex.itemSize !== 4 || skinWeight.itemSize !== 4) throw Error('Invalid four-influence skin');
  let maxSumError = 0, weightedJoints = new Set();
  for (let i = 0; i < position.count; i++) {
    let sum = 0;
    for (let k = 0; k < 4; k++) {
      const j = skinIndex.getComponent(i, k), w = skinWeight.getComponent(i, k);
      if (!Number.isInteger(j) || j < 0 || j >= rig.mesh.skeleton.bones.length || !Number.isFinite(w) || w < 0 || w > 1) throw Error(`Invalid skin influence at vertex ${i}`);
      if (w > 0) weightedJoints.add(j); sum += w;
    }
    maxSumError = Math.max(maxSumError, Math.abs(sum - 1));
  }
  // Includes quantized packed weights, which gltfpack may round by one byte.
  if (maxSumError > 1 / 255 + 1e-6) throw Error('Unnormalized skin weights');
  return { maxSumError, weightedJoints: weightedJoints.size };
}

export function inspectRig(rig) {
  restoreRest(rig);
  const vertices = worldVertices(rig), shape = bounds(vertices), weights = validateWeights(rig), v = new THREE.Vector3();
  const geometryFrame = restGeometryMatrix(rig);
  let bindError = 0;
  for (let i = 0; i < vertices.length / 3; i++) {
    v.fromBufferAttribute(rig.mesh.geometry.attributes.position, i).applyMatrix4(geometryFrame);
    bindError = Math.max(bindError, v.distanceTo(point(vertices, i)));
  }
  return { sha256: rig.sha256, bytes: rig.bytes.length, vertices: vertices.length / 3, triangles: (rig.mesh.geometry.index?.count ?? vertices.length / 3) / 3, meshes: 1, materials: rig.json.materials?.length ?? 0, joints: rig.mesh.skeleton.bones.length, weights, bindError, bounds: shape, contract: rigContract(rig), clips: rig.gltf.animations.map(c => ({ name: c.name, duration: c.duration, tracks: c.tracks.length, samples: sampleTimes(c).length })) };
}

export function colorDimensions(rig) {
  const texture = rig.json.materials?.[0]?.pbrMetallicRoughness?.baseColorTexture, image = rig.json.images?.[rig.json.textures?.[texture?.index]?.source], view = rig.json.bufferViews?.[image?.bufferView];
  if (!view || view.buffer !== 0) throw Error('Missing embedded color texture');
  const bytes = rig.bin.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength);
  if (image.mimeType === 'image/png' && bytes.length >= 24 && bytes.readUInt32BE(0) === 0x89504e47) return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  if (image.mimeType === 'image/jpeg' && bytes[0] === 255 && bytes[1] === 216) {
    for (let i = 2; i + 4 <= bytes.length;) {
      if (bytes[i++] !== 255) throw Error('Invalid JPEG marker'); while (bytes[i] === 255) i++;
      const marker = bytes[i++]; if (marker === 217 || marker === 218) break;
      const length = bytes.readUInt16BE(i); if (length < 2 || i + length > bytes.length) throw Error('Truncated color texture');
      if ([192, 193, 194].includes(marker) && length >= 7) return { width: bytes.readUInt16BE(i + 5), height: bytes.readUInt16BE(i + 3) };
      i += length;
    }
  }
  throw Error('Unsupported or malformed packed color texture');
}

export function resolveSemantics(rig, semantics) {
  if (!semantics || !semantics.hips || !semantics.head) throw Error('Inspected hips/head semantics required');
  const read = name => { if (!name || !rig.names.has(name) || !rig.mesh.skeleton.bones.includes(rig.names.get(name))) throw Error(`Missing semantic joint: ${name}`); return rig.names.get(name); };
  const result = { hips: read(semantics.hips), head: read(semantics.head) }, unique = new Set([semantics.hips, semantics.head]);
  for (const side of ['left', 'right']) {
    result[side] = {};
    for (const label of ['upperArm', 'forearm', 'hand', 'thigh', 'shin', 'foot']) {
      const name = semantics[side]?.[label]; if (unique.has(name)) throw Error(`Repeated anatomy joint: ${name}`); unique.add(name); result[side][label] = read(name);
    }
    for (const [a, b] of [['upperArm', 'forearm'], ['forearm', 'hand'], ['thigh', 'shin'], ['shin', 'foot']]) {
      let p = result[side][b].parent; while (p && p !== result[side][a]) p = p.parent;
      if (!p) throw Error(`Incorrect anatomical ancestry: ${side} ${a}/${b}`);
    }
  }
  return result;
}

export function kneeMetrics(hip, knee, ankle, forward) {
  const upper = knee.clone().sub(hip), lower = ankle.clone().sub(knee), chord = ankle.clone().sub(hip);
  const flexDegrees = THREE.MathUtils.radToDeg(upper.angleTo(lower));
  const along = chord.lengthSq() > 0 ? THREE.MathUtils.clamp(knee.clone().sub(hip).dot(chord) / chord.lengthSq(), 0, 1) : 0;
  const projected = knee.clone().sub(hip.clone().addScaledVector(chord, along)).dot(forward);
  return { flexDegrees, forwardOffset: projected, backward: flexDegrees > LIMITS.kneeFlexDegrees && projected < -LIMITS.kneeBackward };
}

export function auditRig(rig, { height, semantics, enforceBudget = true } = {}) {
  const source = inspectRig(rig), anatomy = resolveSemantics(rig, semantics), failures = [];
  let failureCount = 0;
  const fail = text => { failureCount++; if (failures.length < 16 && !failures.includes(text)) failures.push(text); };
  if (enforceBudget && rig.bytes.length >= LIMITS.bytes) fail(`Download ${rig.bytes.length} >= ${LIMITS.bytes}`);
  if (source.triangles > LIMITS.triangles) fail(`Triangles ${source.triangles} > ${LIMITS.triangles}`);
  if (Math.abs(source.bounds.max[1] - height) > 0.02 || Math.abs(source.bounds.min[1]) > 0.005) fail('Canonical height/foot floor mismatch');
  if (source.materials !== 1 || rig.json.materials?.[0]?.alphaMode && rig.json.materials[0].alphaMode !== 'OPAQUE') fail('Expected one opaque material');
  const texture = colorDimensions(rig);
  if (rig.json.images.length !== 1 || rig.json.textures.length !== 1 || texture.width !== 1024 || texture.height !== 1024) fail('Expected one 1024x1024 embedded color texture');
  if (rig.gltf.animations.map(c => c.name).sort().join(',') !== 'idle,run,walk') fail('Expected idle/walk/run only');
  const rest = worldVertices(rig), edges = indexEdges(rig.mesh.geometry, rest), segments = [], handPoints = [], restHip = pos(anatomy.hips.matrixWorld), restHipQ = anatomy.hips.getWorldQuaternion(new THREE.Quaternion());
  for (const side of ['left', 'right']) {
    const a = anatomy[side];
    for (const [from, to] of [[a.upperArm, a.forearm], [a.forearm, a.hand], [a.thigh, a.shin], [a.shin, a.foot]]) {
      const length = pos(from.matrixWorld).distanceTo(pos(to.matrixWorld));
      if (length < height * 0.035 || length > height * 0.35) fail(`Implausible ${side} limb length`);
      segments.push({ from, to, length });
    }
    if ((pos(a.thigh.matrixWorld).x - restHip.x) * (side === 'left' ? 1 : -1) < height * 0.01) fail(`Calibrated ${side} thigh is on wrong side`);
    const j = rig.mesh.skeleton.bones.indexOf(a.hand), { skinIndex, skinWeight } = rig.mesh.geometry.attributes, inverse = a.hand.matrixWorld.clone().invert();
    for (let i = 0; i < skinIndex.count; i++) {
      let weight = 0; for (let k = 0; k < 4; k++) if (skinIndex.getComponent(i, k) === j) weight += skinWeight.getComponent(i, k);
      if (weight >= 0.999999) handPoints.push({ i, hand: a.hand, local: point(rest, i).applyMatrix4(inverse) });
    }
  }
  const clips = [];
  for (const clip of rig.gltf.animations) {
    const sampler = clampedSampler(rig, clip), times = sampleTimes(clip), metrics = { name: clip.name, duration: clip.duration, samples: times.length, verticesPerSample: rest.length / 3, edges: edges.length, maxEdgeRatio: 1, maxEdgeExtension: 0, edgeViolations: 0, maxSegmentDrift: 0, maxRigidHandDrift: 0, rigidHandVertices: handPoints.length, maxHipXZDrift: 0, hipStartOffset: 0, maxJointSpeed: 0, maxKneeFlexDegrees: 0, minKneeForwardOffset: 0, backwardKneeSamples: 0, minFloor: Infinity, maxIdleArmDegrees: 0, loopJointJump: 0, loopVertexJump: 0 };
    let firstVertices, firstJoints, previousJoints, previousTime, lastVertices, lastJoints;
    try {
      for (const t of times) {
        sampler.at(t);
        const vertices = worldVertices(rig), box = bounds(vertices), strain = edgeStrain(vertices, edges), joints = rig.mesh.skeleton.bones.map(b => pos(b.matrixWorld));
        metrics.minFloor = Math.min(metrics.minFloor, box.min[1]);
        metrics.maxEdgeRatio = Math.max(metrics.maxEdgeRatio, strain.maxRatio); metrics.maxEdgeExtension = Math.max(metrics.maxEdgeExtension, strain.maxExtension); metrics.edgeViolations += strain.violations;
        if (strain.violations) fail(`${clip.name}: indexed edge strain`);
        const hip = pos(anatomy.hips.matrixWorld);
        metrics.maxHipXZDrift = Math.max(metrics.maxHipXZDrift, Math.hypot(hip.x - restHip.x, hip.z - restHip.z));
        if (!firstVertices) { firstVertices = vertices; firstJoints = joints; metrics.hipStartOffset = hip.distanceTo(restHip); }
        for (const s of segments) metrics.maxSegmentDrift = Math.max(metrics.maxSegmentDrift, Math.abs(pos(s.from.matrixWorld).distanceTo(pos(s.to.matrixWorld)) - s.length));
        for (const h of handPoints) metrics.maxRigidHandDrift = Math.max(metrics.maxRigidHandDrift, point(vertices, h.i).applyMatrix4(h.hand.matrixWorld.clone().invert()).distanceTo(h.local));
        const hipRotation = anatomy.hips.getWorldQuaternion(new THREE.Quaternion()).multiply(restHipQ.clone().invert()), forward = new THREE.Vector3(0, 0, 1).applyQuaternion(hipRotation);
        for (const side of ['left', 'right']) {
          const a = anatomy[side], knee = kneeMetrics(pos(a.thigh.matrixWorld), pos(a.shin.matrixWorld), pos(a.foot.matrixWorld), forward);
          metrics.maxKneeFlexDegrees = Math.max(metrics.maxKneeFlexDegrees, knee.flexDegrees); metrics.minKneeForwardOffset = Math.min(metrics.minKneeForwardOffset, knee.forwardOffset);
          if (knee.backward) metrics.backwardKneeSamples++;
          if (clip.name === 'idle') metrics.maxIdleArmDegrees = Math.max(metrics.maxIdleArmDegrees, THREE.MathUtils.radToDeg(pos(a.forearm.matrixWorld).sub(pos(a.upperArm.matrixWorld)).angleTo(new THREE.Vector3(0, -1, 0))));
        }
        if (previousJoints && t - previousTime > 1e-5) for (let j = 0; j < joints.length; j++) metrics.maxJointSpeed = Math.max(metrics.maxJointSpeed, joints[j].distanceTo(previousJoints[j]) / (t - previousTime));
        for (let i = 0; i < vertices.length / 3; i++) if (point(vertices, i).distanceTo(hip) > height * 1.5) { fail(`${clip.name}: vertex escaped anatomical bounds`); break; }
        previousJoints = lastJoints = joints; previousTime = t; lastVertices = vertices;
      }
      for (let j = 0; j < firstJoints.length; j++) metrics.loopJointJump = Math.max(metrics.loopJointJump, firstJoints[j].distanceTo(lastJoints[j]));
      for (let i = 0; i < firstVertices.length / 3; i++) metrics.loopVertexJump = Math.max(metrics.loopVertexJump, point(firstVertices, i).distanceTo(point(lastVertices, i)));
      if (metrics.maxSegmentDrift > LIMITS.segmentDrift) fail(`${clip.name}: limb length drift`);
      if (metrics.maxRigidHandDrift > LIMITS.handDrift) fail(`${clip.name}: hand skin drift`);
      if (metrics.maxHipXZDrift > LIMITS.rootDrift || metrics.hipStartOffset > LIMITS.hipStart) fail(`${clip.name}: root travel/hip teleport`);
      if (metrics.backwardKneeSamples) fail(`${clip.name}: backwards knee flexion`);
      if (metrics.maxJointSpeed > LIMITS.jointSpeed) fail(`${clip.name}: joint teleport speed`);
      if (metrics.minFloor < LIMITS.floor) fail(`${clip.name}: floor penetration`);
      if (metrics.maxIdleArmDegrees > LIMITS.idleArmDegrees) fail('idle: arms are not relaxed');
      if (metrics.loopJointJump > LIMITS.loopPosition || metrics.loopVertexJump > LIMITS.loopPosition) fail(`${clip.name}: loop seam`);
      clips.push(Object.fromEntries(Object.entries(metrics).map(([k, v]) => [k, typeof v === 'number' ? round(v) : v])));
    } finally { sampler.dispose(); }
  }
  return { passed: failureCount === 0, failureCount, failures, limits: LIMITS, structure: { bytes: source.bytes, triangles: source.triangles, vertices: source.vertices, joints: source.joints, bindError: source.bindError, bounds: source.bounds, weights: source.weights, texture }, clips, limitations: ['No finger articulation can be inferred without finger joints.', 'Ground penetration is measured; this preparation does not add foot IK.', 'Numeric acceptance requires subsequent native visual pose review.'] };
}
