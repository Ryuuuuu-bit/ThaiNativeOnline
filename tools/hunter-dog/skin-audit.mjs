// Quantitative candidate inspection using Node Three's real skinning and the
// current production procedural function, never a replacement pose approximation.
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { readGLB, projectionPNG } from './geometry-tools.mjs';

const round = n => Number(n.toFixed(7));
const boneRegion = name => /^tripo::[01]_(Left|Right)_Limb_/.test(name) ? `${name.includes('::0_') ? 'F' : 'H'}${name.includes('_Left_') ? 'L' : 'R'}` : null;

async function load(bytes) {
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  loader.register(parser => ({ name: 'QA_TEXTURES', beforeRoot() {
    const get = parser.getDependency.bind(parser);
    parser.getDependency = (type, index) => type === 'texture' ? Promise.resolve(new THREE.Texture()) : get(type, index);
  } }));
  return loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
}
function sampleTimes(phase, duration) {
  const times = Array.from({ length: duration * 24 + 1 }, (_, i) => i / 24);
  if (phase === 'bite') times.push(.115, .18, .23, .55, .85);
  if (phase === 'attack') for (let cycle = 0; cycle < 5; cycle++) for (const phase of [.115, .18, .23, .55, .85, 1]) { const t = (cycle + phase) / 2.4; if (t <= duration) times.push(t); }
  if (phase === 'run' || phase === 'trot') { const period = 2 * Math.PI / (phase === 'run' ? 12 : 7.5); for (let t = period; t < duration; t += period) times.push(t); }
  return [...new Set(times)].sort((a, b) => a - b);
}

export async function auditCandidate(candidate, expectedPoints, expectedIndices, rig, recipe, outputRoot, transferred, donorBytes) {
  const bytes = await fs.readFile(candidate), d = await readGLB(bytes), p = d.json.meshes[0].primitives[0];
  const [pa, ja, wa, ia] = await Promise.all([d.accessor(p.attributes.POSITION), d.accessor(p.attributes.JOINTS_0), d.accessor(p.attributes.WEIGHTS_0), d.accessor(p.indices)]);
  const errors = []; let geometryError = 0, sumError = 0, crossLegInfluences = 0, zeroWeightVertices = 0, invalidJointIndices = 0, seamDifferences = 0;
  const histogram = [0, 0, 0, 0, 0], seam = new Map(), used = new Set();
  for (let i = 0; i < pa.count; i++) {
    const point = new THREE.Vector3(...pa.values.slice(i * 3, i * 3 + 3)); geometryError = Math.max(geometryError, point.distanceTo(expectedPoints[i]));
    let sum = 0, count = 0;
    for (let k = 0; k < 4; k++) {
      const j = ja.values[i * 4 + k], w = wa.values[i * 4 + k];
      if (!Number.isInteger(j) || j < 0 || j >= 38) invalidJointIndices++;
      if (!Number.isFinite(w) || w < 0 || w > 1) errors.push(`Invalid vertex weight ${i}`);
      sum += w; if (w > 0) { count++; used.add(j); const r = boneRegion(rig.names[j]); if (r && transferred && r !== transferred.permittedLegs[i]) crossLegInfluences++; }
    }
    if (sum <= 0) zeroWeightVertices++; sumError = Math.max(sumError, Math.abs(1 - sum)); histogram[count]++;
    const key = point.toArray().join(','), data = Array.from(ja.values.slice(i * 4, i * 4 + 4)).join(',') + '|' + Array.from(wa.values.slice(i * 4, i * 4 + 4)).join(',');
    if (seam.has(key) && seam.get(key) !== data) seamDifferences++; seam.set(key, data);
  }
  const topologyEqual = ia.values.length === expectedIndices.length && ia.values.every((n, i) => n === expectedIndices[i]);
  if (!topologyEqual) errors.push('Topology changed');
  if (geometryError > recipe.limits.maxRoundTripGeometryErrorMeters) errors.push('Geometry encoding error exceeds limit');
  if (invalidJointIndices || zeroWeightVertices || sumError > 1e-6 || crossLegInfluences || seamDifferences) errors.push('Weight integrity gate failed');
  const namesEqual = d.json.skins[0].joints.every((n, i) => d.json.nodes[n].name === rig.names[i]);
  if (!namesEqual || d.json.skins[0].joints.length !== 38) errors.push('Donor joint contract changed');
  const gltf = await load(bytes);
  gltf.scene.updateMatrixWorld(true);
  const sourceText = await fs.readFile(new URL('../../src/classes/dog.js', import.meta.url), 'utf8');
  const start = sourceText.indexOf('function riggedDog('), end = sourceText.indexOf('export function makeDog', start);
  if (start < 0 || end < start) throw Error('Actual procedural controller cannot be extracted; numerical pose audit blocked');
  const create = new Function('THREE', 'cloneSkinned', 'X', 'Y', 'SCALE', sourceText.slice(start, end) + '\nreturn riggedDog;')(
    THREE, cloneSkinned, new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), 1.25);
  const meshes = []; gltf.scene.traverse(n => { if (n.isSkinnedMesh) meshes.push(n); });
  if (meshes.length !== 1 || meshes[0].skeleton.bones.length !== 38) errors.push('Actual loader failed 38-bone skinned mesh');
  const point = new THREE.Vector3(); let bindError = 0;
  meshes[0].skeleton.update();
  for (let i = 0; i < pa.count; i++) { meshes[0].getVertexPosition(i, point).applyMatrix4(meshes[0].matrixWorld); bindError = Math.max(bindError, point.distanceTo(expectedPoints[i])); }
  if (bindError > recipe.limits.maxBindPoseErrorMeters) errors.push('Actual Three bind pose exceeds limit');
  const indexedEdges = new Map();
  for (let i = 0; i < expectedIndices.length; i += 3) for (const [u, v] of [[0, 1], [1, 2], [2, 0]]) {
    const a = expectedIndices[i + u], b = expectedIndices[i + v], key = a < b ? `${a},${b}` : `${b},${a}`;
    const sourceLength = expectedPoints[a].distanceTo(expectedPoints[b]); if (sourceLength >= recipe.limits.minimumMeasuredEdgeMeters) indexedEdges.set(key, { a, b, length: sourceLength * 1.25 });
  }
  const edges = [...indexedEdges.values()], phases = ['idle', 'trot', 'run', 'attack', 'bite', 'howl', 'glow'], result = {}, snapshots = {};
  let poseFinite = true, poseStrainPass = true, samples = 0, equivalentSkinMatrixError = 0;
  for (const phase of phases) {
    const instance = create(gltf.scene, '#5dffa8'), inner = instance.inner, skinned = [];
    inner.traverse(n => { if (n.isSkinnedMesh) skinned.push(n); }); const mesh = skinned[0];
    const duration = ['bite', 'howl', 'glow'].includes(phase) ? 1 : 2, times = sampleTimes(phase, duration);
    const metrics = { samples: times.length, minimumY: Infinity, maximumEdgeRatio: 0, maximumEdgeExtensionMeters: 0, maximumBadEdgesInPose: 0, badEdgeSamples: 0, nonfiniteVertices: 0, worstEdge: null, bounds: new THREE.Box3() }, badExamples = new Map();
    const posed = Array.from({ length: pa.count }, () => new THREE.Vector3());
    for (let frame = 0; frame < times.length; frame++) {
      const t = times[frame], amount = t / duration, moving = phase === 'trot' || phase === 'run';
      instance.animate(t, moving, phase === 'attack', { run: phase === 'run' ? 1 : 0, bite: phase === 'bite' ? amount : undefined, howl: phase === 'howl' ? amount : 0, glow: phase === 'glow' ? amount : 0 });
      inner.updateMatrixWorld(true); mesh.skeleton.update(); samples++;
      for (const group of transferred?.equivalentGroups ?? []) for (const member of group.members) for (let k = 0; k < 16; k++) equivalentSkinMatrixError = Math.max(equivalentSkinMatrixError, Math.abs(mesh.skeleton.boneMatrices[group.representative * 16 + k] - mesh.skeleton.boneMatrices[member * 16 + k]));
      for (let i = 0; i < posed.length; i++) {
        mesh.getVertexPosition(i, posed[i]).applyMatrix4(mesh.matrixWorld);
        if (!posed[i].toArray().every(Number.isFinite)) { metrics.nonfiniteVertices++; continue; }
        metrics.minimumY = Math.min(metrics.minimumY, posed[i].y); metrics.bounds.expandByPoint(posed[i]);
      }
      let bad = 0;
      for (const edge of edges) {
        const length = posed[edge.a].distanceTo(posed[edge.b]), ratio = length / edge.length, extension = length - edge.length;
        metrics.maximumEdgeRatio = Math.max(metrics.maximumEdgeRatio, ratio); metrics.maximumEdgeExtensionMeters = Math.max(metrics.maximumEdgeExtensionMeters, extension);
        if (ratio > recipe.limits.maxPoseEdgeRatio && extension > recipe.limits.maxPoseEdgeExtensionMeters) {
          bad++; const entry = { vertices: [edge.a, edge.b], time: t, sourceLengthMeters: round(edge.length), posedLengthMeters: round(length), ratio: round(ratio), extensionMeters: round(extension), regions: transferred ? [transferred.regions[edge.a], transferred.regions[edge.b]] : null };
          if (!metrics.worstEdge || extension > metrics.worstEdge.extensionMeters) metrics.worstEdge = entry;
          const key = `${edge.a},${edge.b}`; if (!badExamples.has(key) || extension > badExamples.get(key).extensionMeters) badExamples.set(key, entry);
        }
      }
      metrics.maximumBadEdgesInPose = Math.max(metrics.maximumBadEdgesInPose, bad); metrics.badEdgeSamples += bad;
      if (frame === times.indexOf(times.reduce((a, b) => Math.abs(a - duration * .45) < Math.abs(b - duration * .45) ? a : b))) { snapshots[phase] = posed.map(p => p.clone()); await fs.writeFile(`${outputRoot}/${phase}-geometry.png`, projectionPNG(posed, expectedIndices)); }
      if (phase === 'bite' && [.115, .55, .85].includes(t)) await fs.writeFile(`${outputRoot}/bite-${t === .115 ? 'windup' : t === .55 ? 'impact' : 'recovery'}-geometry.png`, projectionPNG(posed, expectedIndices));
    }
    poseFinite &&= metrics.nonfiniteVertices === 0; poseStrainPass &&= metrics.badEdgeSamples === 0;
    result[phase] = { ...metrics, minimumY: round(metrics.minimumY), maximumEdgeRatio: round(metrics.maximumEdgeRatio), maximumEdgeExtensionMeters: round(metrics.maximumEdgeExtensionMeters), largestStrainExamples: [...badExamples.values()].sort((a, b) => b.extensionMeters - a.extensionMeters).slice(0, 8), bounds: { min: metrics.bounds.min.toArray().map(round), max: metrics.bounds.max.toArray().map(round) } };
    inner.traverse(n => { n.skeleton?.dispose(); if (n.isMesh) { for (const m of Array.isArray(n.material) ? n.material : [n.material]) m.dispose(); } });
  }
  const donorFloorComparison = {};
  if (donorBytes) {
    const donor = await load(donorBytes);
    for (const phase of ['idle', 'trot', 'run', 'bite']) {
      const instance = create(donor.scene, '#5dffa8'), meshes = []; instance.inner.traverse(n => { if (n.isSkinnedMesh) meshes.push(n); });
      const mesh = meshes[0], duration = phase === 'bite' ? 1 : 2; let min = Infinity;
      for (const t of sampleTimes(phase, duration)) {
        instance.animate(t, phase === 'trot' || phase === 'run', false, { run: phase === 'run' ? 1 : 0, bite: phase === 'bite' ? t : undefined });
        instance.inner.updateMatrixWorld(true); mesh.skeleton.update();
        for (let i = 0; i < mesh.geometry.attributes.position.count; i++) { mesh.getVertexPosition(i, point).applyMatrix4(mesh.matrixWorld); min = Math.min(min, point.y); }
      }
      donorFloorComparison[phase] = { donorBuilderMinimumY: round(min), candidateBuilderMinimumY: result[phase].minimumY, donorWorldMinimumY: round(min * .8), candidateWorldMinimumY: round(result[phase].minimumY * .8) };
      instance.inner.traverse(n => { n.skeleton?.dispose(); if (n.isMesh) n.material.dispose(); });
    }
  }
  if (equivalentSkinMatrixError > 1e-6) errors.push('Controller changed the assumed equivalent skin groups');
  return { structuralPass: errors.length === 0, errors, poseFinite, poseStrainPass, equivalentSkinMatrixError, visualApprovalRequired: true,
    exactProductionControllerSHA256: createHash('sha256').update(sourceText).digest('hex'), controllerSource: 'src/classes/dog.js riggedDog; exact function evaluated locally, SCALE=1.25; actual GLTFLoader/SkeletonUtils/SkinnedMesh',
    skin: { maxWeightSumError: sumError, zeroWeightVertices, invalidJointIndices, crossLegInfluences, seamDifferences, histogram, usedJoints: used.size, unusedJointNames: rig.names.filter((_, i) => !used.has(i)), bindPoseErrorMeters: bindError, geometryEncodingErrorMeters: geometryError, topologyEqual, namesEqual },
    poseSampling: { hz: 24, extraSamples: 'Exact attack/bite windup, transition, impact .55 and recovery; gait cycle boundaries', samples, measuredIndexedEdges: edges.length, minimumMeasuredModelEdgeMeters: recipe.limits.minimumMeasuredEdgeMeters, failWhenBoth: { ratio: recipe.limits.maxPoseEdgeRatio, extensionMeters: recipe.limits.maxPoseEdgeExtensionMeters }, phases: result, donorFloorComparison,
      floorIsMeasurementOnly: true, plantedFootClaim: false, note: 'Model runtime scale 1.25 included; actor scale and terrain excluded. No planted-foot IK exists. Parent changes to attack controller require a fresh audit.' } };
}
