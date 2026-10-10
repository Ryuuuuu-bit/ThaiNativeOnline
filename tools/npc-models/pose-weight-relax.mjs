// Repair-stage only. Actual production poses guide local source weight continuity;
// the independent frozen native/runtime audit remains the acceptance authority.
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { NPC } from '../../src/entities/NPC.js';
import { NPCS } from '../../src/data/npcs.js';
import { makeLook } from '../../src/npc/NPCData.js';
import { NPC_MODELS, createMeshy24NPCPoseAdapter } from '../../src/npc/NPCModels.js';
import { NPCModelRenderer } from '../../src/npc/NPCModelRenderer.js';
import { THREE, loadRig, worldVertices, canonicalFrame, clampedSampler, sampleTimes, restGeometryMatrix, assertNativeContract } from './rig.mjs';
import { surfaceGraph, continuousFourWeights } from './weights.mjs';
import { GLBBuilder, sha256 } from './glb.mjs';
import { candidateDirectory } from './prepare.mjs';

const position = (m, p) => new THREE.Vector3().fromArray(p).applyMatrix4(m);

async function actualSkinPoses(family, candidate, profile) {
  const rig = await loadRig(candidate), names = rig.mesh.skeleton.bones.map(b => rig.objectNames.get(b)), poses = [];
  function capture(mesh, restInverse, tag) {
    mesh.updateWorldMatrix(true, false); mesh.skeleton.update();
    const byName = new Map(mesh.skeleton.bones.map((b, i) => [b.name, i]));
    poses.push({ tag, matrices: names.map(name => {
      const i = byName.get(name);
      return mesh.matrixWorld.clone().multiply(mesh.bindMatrixInverse).multiply(mesh.skeleton.bones[i].matrixWorld)
        .multiply(mesh.skeleton.boneInverses[i]).multiply(mesh.bindMatrix).multiply(restInverse);
    }) });
  }
  const restInverse = restGeometryMatrix(rig).invert();
  for (const clip of rig.gltf.animations) {
    const sampler = clampedSampler(rig, clip);
    try { for (const t of sampleTimes(clip, 30)) { sampler.at(t); capture(rig.mesh, restInverse, `native:${clip.name}:${t}`); } }
    finally { sampler.dispose(); }
  }
  const scenarios = family === 'monk_elder' ? [['monk_elder', 'idle', 'pray'], ['monk_teacher', 'sit', 'pray'], ['monk_elder', 'idle', 'look'], ['monk_elder', 'talk', 'talk']]
    : [['monk_young', 'idle', 'pray'], ['monk_young', 'work', 'sweep'], ['monk_young', 'idle', 'look'], ['monk_young', 'talk', 'talk']];
  for (const [id, state, anim] of scenarios) {
    const def = NPCS.find(n => n.id === id), npc = new NPC(def, makeLook(def), {});
    Object.assign(npc, { shown: true, dirty: true, state, anim, x: 0, y: 0, z: 0, yaw: 0, distance: 0 });
    if (state === 'talk') npc.talkTarget = { x: 0, z: 1 };
    const scene = new THREE.Scene(), source = { ...rig.gltf, assetSha256: rig.sha256 }, spec = NPC_MODELS[family];
    const options = { ...profile, qaApproved: true, revision: spec.revision, assetSha256: rig.sha256, geometryAssetSha256: rig.sha256 };
    const renderer = new NPCModelRenderer(scene, [npc], { loadModel: () => source,
      createAdapter: (model, context) => createMeshy24NPCPoseAdapter(model, context, profile.calibration, options) });
    await renderer.ready;
    const entry = renderer.entries.get(npc); if (!entry?.model) throw Error('Actual role matrix capture failed');
    let mesh; entry.model.traverse(o => { if (o.isSkinnedMesh) mesh = o; });
    const inverse = restGeometryMatrix({ ...rig, mesh }).invert();
    try {
      // Every repair-stage role frame at 16 Hz plus prior exact failure times.
      // Final independent acceptance still samples all roles at 30 Hz/extrema.
      const times = new Set([0, 8, .85346772006897, 2.6333333333333333, 2.7333333333333334, 3.3666666666666667, 3.5333333333333333, 3.7333333333333334, 7.9]);
      for (let i = 0; i <= 128; i++) times.add(i / 16);
      let prev = 0;
      for (const t of [...times].sort((a, b) => a - b)) {
        npc.animate(t, 0, state, anim); renderer.update(t - prev, t); prev = t;
        if (!renderer.status(npc).active) throw Error('Actual role became inactive during repair matrix capture');
        capture(mesh, inverse, `${id}:${state}:${anim}:${t}`);
      }
    } finally { renderer.dispose(); }
  }
  return { names, poses, candidateSHA256: rig.sha256 };
}

function skin(weights, vectors) {
  const p = new THREE.Vector3(); for (let j = 0; j < weights.length; j++) if (weights[j] > 0) p.addScaledVector(vectors[j], weights[j]); return p;
}
function four(w) { const result = new Float64Array(w.length); for (const x of continuousFourWeights(w)) result[x.j] = x.v; return result; }

export async function relaxPoseWeights({ family, body, unpacked, candidate, profile, calibration, out }) {
  if (!['monk_elder', 'monk_novice'].includes(family)) throw Error('Explicit monk-only source repair');
  const raw = await loadRig(body), base = await loadRig(unpacked), p = JSON.parse(await readFile(calibration, 'utf8'));
  const rawPositions = worldVertices(raw), frame = canonicalFrame(rawPositions, p, p.height), rest = worldVertices(base);
  if (rest.length !== rawPositions.length) throw Error('Repair precondition vertex count changed');
  let mappingError = 0;
  for (let i = 0; i < rest.length; i += 3) mappingError = Math.max(mappingError, new THREE.Vector3().fromArray(rawPositions, i).applyMatrix4(frame.matrix).distanceTo(new THREE.Vector3().fromArray(rest, i)));
  if (mappingError > 1e-5) throw Error('Repair precondition source index/shape changed');
  const graph = surfaceGraph(raw, frame), names = raw.mesh.skeleton.bones.map(b => raw.objectNames.get(b)), baseNames = base.mesh.skeleton.bones.map(b => base.objectNames.get(b));
  const fields = graph.points.map(() => new Float64Array(names.length)), counts = new Uint32Array(fields.length);
  for (let i = 0; i < graph.vertexWeld.length; i++) { const w = graph.vertexWeld[i]; counts[w]++; for (let k = 0; k < 4; k++) fields[w][names.indexOf(baseNames[base.mesh.geometry.attributes.skinIndex.getComponent(i, k)])] += base.mesh.geometry.attributes.skinWeight.getComponent(i, k); }
  for (let i = 0; i < fields.length; i++) for (let j = 0; j < names.length; j++) fields[i][j] /= counts[i];
  const original = fields.map(w => w.slice()), centre = new THREE.Vector3(...(family === 'monk_elder' ? [-.167, 1.1324, -.1176] : [-.1856, .5724, -.0676]));
  const distance = new Float64Array(fields.length).fill(Infinity), queue = [];
  for (let i = 0; i < fields.length; i++) if (graph.points[i].distanceTo(centre) < .012) { distance[i] = 0; queue.push(i); }
  const radius = family === 'monk_elder' ? .22 : .33;
  for (let q = 0; q < queue.length; q++) for (const j of graph.adjacent[queue[q]]) { const d = distance[queue[q]] + graph.points[queue[q]].distanceTo(graph.points[j]); if (d < radius && d < distance[j]) { distance[j] = d; queue.push(j); } }
  const editable = i => distance[i] < radius;
  const valid = (i, j) => distance[i] !== 0 || !(family === 'monk_elder' ? /UpLeg|^LeftLeg$|^RightLeg$|Foot|Toe/.test(names[j]) : /Arm|Shoulder|Hand/.test(names[j]));
  const edges = [];
  for (let a = 0; a < graph.points.length; a++) for (const b of graph.adjacent[a]) if (a < b && (editable(a) || editable(b))) {
    const length = graph.points[a].distanceTo(graph.points[b]); if (length >= .005) edges.push({ a, b, length });
  }
  const actual = await actualSkinPoses(family, candidate, profile), nameMap = names.map(n => actual.names.indexOf(n));
  if (nameMap.some(n => n < 0)) throw Error('Actual pose rig bone names changed');
  const indices = [...new Set(edges.flatMap(e => [e.a, e.b]))], cache = actual.poses.map(pose => ({ tag: pose.tag,
    vertices: new Map(indices.map(i => [i, names.map((_, j) => graph.points[i].clone().applyMatrix4(pose.matrices[nameMap[j]]))])) }));
  const rounds = [], witnesses = [];
  for (let pass = 0; pass < 12; pass++) {
    let adjusted = 0, maximumRatio = 1;
    for (const pose of cache) for (const e of edges) {
      const va = pose.vertices.get(e.a), vb = pose.vertices.get(e.b), a = skin(fields[e.a], va), b = skin(fields[e.b], vb), length = a.distanceTo(b);
      maximumRatio = Math.max(maximumRatio, length / e.length);
      // A private safety margin in the repair objective; the final gate is
      // independently unchanged at ratio >2 AND extension >10mm.
      const targetLength = Math.max(e.length * 1.85, e.length + .008);
      if (length <= targetLength) continue;
      const target = new Float64Array(names.length);
      for (let j = 0; j < names.length; j++) if ((!editable(e.a) || valid(e.a, j)) && (!editable(e.b) || valid(e.b, j))) target[j] = !editable(e.a) ? fields[e.a][j] : !editable(e.b) ? fields[e.b][j] : (fields[e.a][j] + fields[e.b][j]) / 2;
      const sum = target.reduce((a, b) => a + b, 0); if (sum < 1e-8) throw Error('No shared anatomical support across witnessed edge');
      for (let j = 0; j < names.length; j++) target[j] /= sum;
      const blend = (i, alpha) => !editable(i) ? fields[i] : four(fields[i].map((v, j) => v * (1 - alpha) + target[j] * alpha));
      const test = alpha => skin(blend(e.a, alpha), va).distanceTo(skin(blend(e.b, alpha), vb));
      if (test(1) >= length - 1e-9) continue;
      let lo = 0, hi = 1;
      for (let n = 0; n < 12; n++) { const mid = (lo + hi) / 2; if (test(mid) <= targetLength) hi = mid; else lo = mid; }
      fields[e.a] = blend(e.a, hi); fields[e.b] = blend(e.b, hi); adjusted++;
      if (witnesses.length < 30) witnesses.push({ pose: pose.tag, sourceSurfaceEdge: [e.a, e.b], rest: [graph.points[e.a].toArray(), graph.points[e.b].toArray()], beforeRatio: length / e.length, extension: length - e.length, blend: hi });
    }
    rounds.push({ pass, adjustedEdges: adjusted, maximumRatio }); if (!adjusted) break;
  }
  const joints = new Uint16Array(graph.vertexWeld.length * 4), weights = new Float32Array(joints.length);
  let changed = 0, maxDelta = 0;
  for (let i = 0; i < fields.length; i++) { const d = Math.max(...fields[i].map((v, j) => Math.abs(v - original[i][j]))); if (d > 1e-6) changed++; maxDelta = Math.max(maxDelta, d); }
  for (let i = 0; i < graph.vertexWeld.length; i++) { const w = continuousFourWeights(fields[graph.vertexWeld[i]]); for (let k = 0; k < 4; k++) { joints[i * 4 + k] = w[k].j; weights[i * 4 + k] = w[k].v; } }
  const builder = new GLBBuilder(); builder.json = structuredClone(raw.json); builder.parts = [Buffer.from(raw.bin)]; builder.length = raw.bin.length;
  const attrs = builder.json.meshes[0].primitives[0].attributes; attrs.JOINTS_0 = builder.accessor(joints, 'VEC4'); attrs.WEIGHTS_0 = builder.accessor(weights, 'VEC4');
  const output = await candidateDirectory(out), file = path.join(output, 'pose-relaxed-source.glb'); await writeFile(file, builder.encode());
  const repaired = await loadRig(file); assertNativeContract(raw, repaired);
  if (!repaired.bin.subarray(0, raw.bin.length).equals(raw.bin)) throw Error('Repair changed original buffers');
  const after = worldVertices(repaired); let restSkinDrift = 0;
  for (let i = 0; i < rest.length; i += 3) restSkinDrift = Math.max(restSkinDrift, Math.hypot(...[0, 1, 2].map(k => after[i + k] - rawPositions[i + k])));
  if (restSkinDrift > 1e-5) throw Error('Repair changed actual rest geometry');
  const receipt = { schema: 1, family, status: 'LOCAL_SOURCE_WEIGHT_REPAIR_NOT_APPROVED', input: body, inputSHA256: raw.sha256, output: file, outputSHA256: repaired.sha256,
    precondition: unpacked, preconditionSHA256: base.sha256, matrixCandidateSHA256: actual.candidateSHA256, sourceIndexMappingError: mappingError, restSkinDrift,
    geometryNormalsUVIndexTextureRigAndRestPreserved: true, surfaceRadius: radius, changedSurfaceVertices: changed, maximumWeightDelta: maxDelta, actualPoses: actual.poses.length,
    method: 'Only actual indexed garment neighbors inside the source-local geodesic mask exchange their existing joint ownership, driven by skin matrices from the real production adapter and native clips; anatomical core exclusions remain enforced; continuous four-weight sparsification and UV welding.', rounds, witnesses,
    limits: ['Repair objective is sampled at 16Hz plus witnessed times/native keys. It grants no acceptance.', 'Frozen independent native/runtime validation at 30Hz, all keys/extrema, remains required; no gate changes.', 'Visual cloth silhouette, palm/thumb orientation and role continuity still require parent Art capture.'] };
  const receiptFile = path.join(output, 'pose-weight-repair.json'); await writeFile(receiptFile, JSON.stringify(receipt, null, 2) + '\n'); return { file, sha256: repaired.sha256, receiptFile, receipt };
}
