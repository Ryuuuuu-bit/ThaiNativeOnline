// Bounded, source-indexed monk repair. Frozen compiler and family roots stay intact.
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GLBBuilder, sha256 } from './glb.mjs';
import { THREE, loadRig, worldVertices, canonicalFrame, assertNativeContract } from './rig.mjs';
import { surfaceGraph, continuousFourWeights } from './weights.mjs';
import { measureHand } from './anatomy.mjs';
import { adapterContract } from './calibration.mjs';
import { candidateDirectory, calibrateInputs, prepareInputs, REPO } from './prepare.mjs';
import { auditRuntimeFamily } from './runtime-audit.mjs';
import { contactCandidateFromFiles } from './contacts.mjs';
import { indexEdges, edgeStrain } from './audit.mjs';
import { createNPCWaiPose } from '../../src/npc/NPCActivityPoses.js';
import { relaxPoseWeights } from './pose-weight-relax.mjs';

const root = path.join(REPO, 'artifacts/city-npc-models');
const smooth = x => { const t = THREE.MathUtils.clamp(x, 0, 1); return t * t * (3 - 2 * t); };
const allowed = ['monk_elder', 'monk_novice'];
const pins = ['src/npc/NPCModels.js', 'src/npc/NPCModelRenderer.js', 'src/npc/NPCRenderer.js', 'src/npc/NPCActivityPoses.js',
  ...['prepare', 'glb', 'rig', 'audit', 'anatomy', 'weights', 'motion-limits', 'calibration', 'preview', 'batch-prepare', 'normalize-source', 'repair-seams'].map(n => `tools/npc-models/${n}.mjs`)];
const json = async file => JSON.parse(await readFile(file, 'utf8'));

function distances(graph, seeds, maximum, accept = () => true) {
  const distance = new Float64Array(graph.points.length).fill(Infinity), queue = [...seeds];
  for (const i of seeds) distance[i] = 0;
  for (let q = 0; q < queue.length; q++) for (const j of graph.adjacent[queue[q]]) {
    if (!accept(j)) continue;
    const d = distance[queue[q]] + graph.points[queue[q]].distanceTo(graph.points[j]);
    if (d < distance[j] && d < maximum) { distance[j] = d; queue.push(j); }
  }
  return distance;
}

function applyPatch(graph, fields, names, config, operation, accept = () => true) {
  const center = new THREE.Vector3(...config.center), seeds = [];
  for (let i = 0; i < graph.points.length; i++) if (accept(i) && graph.points[i].distanceTo(center) <= config.core) seeds.push(i);
  if (seeds.length < 2) throw Error('Measured patch has insufficient actual surface seeds');
  const distance = distances(graph, seeds, config.feather, accept), target = new Float64Array(names.length);
  for (const i of seeds) for (let j = 0; j < names.length; j++) target[j] += fields[i][j] / seeds.length;
  let changed = 0;
  for (let i = 0; i < fields.length; i++) if (distance[i] < config.feather) {
    const amount = (1 - smooth(distance[i] / config.feather));
    const next = operation(fields[i].slice(), target.slice(), i, amount);
    for (let j = 0; j < names.length; j++) fields[i][j] = fields[i][j] * (1 - amount) + next[j] * amount;
    changed++;
  }
  return { ...config, seedSurfaceIndices: seeds, changedSurfaceVertices: changed };
}

const normalize = w => { const sum = w.reduce((a, b) => a + b, 0); if (sum < 1e-8) throw Error('Anatomical constraint removed every joint'); for (let j = 0; j < w.length; j++) w[j] /= sum; return w; };

function diffuseConstraint(graph, fields, names, config, constrain) {
  const centre = new THREE.Vector3(...config.center), seeds = [];
  for (let i = 0; i < graph.points.length; i++) if (graph.points[i].distanceTo(centre) < config.core) seeds.push(i);
  const fixed = new Set(seeds), distance = distances(graph, seeds, config.feather), original = fields.map(v => v.slice());
  const region = Array.from(distance, (d, i) => ({ i, fade: 1 - smooth(d / config.feather) })).filter(p => p.fade > 0);
  for (let pass = 0; pass < config.iterations; pass++) {
    const next = fields.map(v => v.slice());
    for (const { i, fade } of region) {
      const average = new Float64Array(names.length); let total = 0;
      for (const j of graph.adjacent[i]) { const w = 1 / Math.max(.003, graph.points[i].distanceTo(graph.points[j])); total += w; for (let k = 0; k < names.length; k++) average[k] += fields[j][k] * w; }
      if (total > 0) for (let k = 0; k < names.length; k++) {
        const smoothed = .01 * original[i][k] + .99 * (.5 * fields[i][k] + .5 * average[k] / total);
        next[i][k] = smoothed * fade + original[i][k] * (1 - fade);
      }
      if (fixed.has(i)) constrain(next[i]);
      normalize(next[i]);
    }
    for (const { i } of region) fields[i] = next[i];
  }
  return { ...config, seedSurfaceIndices: seeds, changedSurfaceVertices: region.length, method: 'Actual indexed-surface inverse-edge diffusion with anatomical core constraints and smooth immutable outer boundary; no across-air transfer' };
}

export async function repairMonkSource({ family, out }) {
  if (!allowed.includes(family)) throw Error('Only the two explicitly owned monk bodies can be repaired');
  const dir = path.join(root, family), frozen = await json(path.join(dir, 'freeze-receipt.json'));
  for (const output of Object.values(frozen.outputs)) if (sha256(await readFile(output.path)) !== output.sha256) throw Error('Frozen family output changed');
  const source = await loadRig(frozen.inputPaths.body), preconditionFile = path.join(dir, family + '-unpacked.glb'), base = await loadRig(preconditionFile);
  if (source.sha256 !== frozen.sources.body) throw Error('Raw source does not match frozen lineage');
  const profile = await json(frozen.outputs.calibration.path), vertices = worldVertices(source), canonical = worldVertices(base), frame = canonicalFrame(vertices, profile, profile.height);
  if (vertices.length !== canonical.length) throw Error('Canonical precondition changed vertex count');
  let sourceMappingError = 0;
  for (let i = 0; i < vertices.length; i += 3) sourceMappingError = Math.max(sourceMappingError, new THREE.Vector3().fromArray(vertices, i).applyMatrix4(frame.matrix).distanceTo(new THREE.Vector3().fromArray(canonical, i)));
  if (sourceMappingError > 1e-5) throw Error('Actual raw-to-canonical source index mapping failed');
  const graph = surfaceGraph(source, frame), names = source.mesh.skeleton.bones.map(b => source.objectNames.get(b)), baseNames = base.mesh.skeleton.bones.map(b => base.objectNames.get(b));
  const fields = graph.points.map(() => new Float64Array(names.length)), counts = new Uint32Array(fields.length);
  for (let i = 0; i < graph.vertexWeld.length; i++) {
    const n = graph.vertexWeld[i]; counts[n]++;
    for (let k = 0; k < 4; k++) fields[n][names.indexOf(baseNames[base.mesh.geometry.attributes.skinIndex.getComponent(i, k)])] += base.mesh.geometry.attributes.skinWeight.getComponent(i, k);
  }
  for (let i = 0; i < fields.length; i++) for (let j = 0; j < names.length; j++) fields[i][j] /= counts[i];
  const patches = [];
  if (family === 'monk_elder') {
    patches.push(diffuseConstraint(graph, fields, names, { reason: 'Actual sleeve/torso gradient: retain the natural arm-to-torso field, smooth on indexed garment adjacency, remove unrelated thigh only at the measured upper garment core', center: [-.167, 1.1324, -.1176], core: .012, feather: .16, iterations: 256 }, weights => {
      for (let j = 0; j < names.length; j++) if (/UpLeg|^LeftLeg$|^RightLeg$|Foot|Toe/.test(names[j])) weights[j] = 0;
    }));
    const hand = measureHand(base, 'LeftHand', { palmReference: [0, 1, 0] }), wrist = new THREE.Vector3(...hand.wrist), fingers = new THREE.Vector3(...hand.centroid).sub(wrist).normalize();
    const along = i => graph.points[i].clone().sub(wrist).dot(fingers);
    const radial = i => graph.points[i].clone().sub(wrist).addScaledVector(fingers, -along(i)).length();
    const j = names.indexOf('LeftHand');
    const seeds = [], center = new THREE.Vector3(.291, 1.249, .254), accept = i => along(i) >= .025 && radial(i) < .08 && graph.points[i].x > .22;
    for (let i = 0; i < graph.points.length; i++) if (accept(i) && graph.points[i].distanceTo(center) < .04) seeds.push(i);
    const distance = distances(graph, seeds, .22, accept);
    let changed = 0;
    for (let i = 0; i < fields.length; i++) if (distance[i] < .22) {
      // The signed palm PCA is retained in the receipt. For geometric wrist
      // cutoff use its measured wrist-to-surface-centroid vector; projection
      // into a tilted palm plane incorrectly excluded genuine distal digits.
      const amount = smooth((along(i) - .025) / .025) * (1 - smooth(Math.max(0, radial(i) - .06) / .02));
      for (let k = 0; k < names.length; k++) fields[i][k] *= (1 - amount); fields[i][j] += amount;
      if (amount > 0) changed++;
    }
    patches.push({ reason: 'Actual distal left palm/digits are rigid Hand; wrist-to-actual-hand-centroid cutoff with 25mm longitudinal and 20mm radial feather, restricted to connected hand surface', center: center.toArray(), measuredHand: hand, anatomicalLongitudinalAxis: fingers.toArray(), seedSurfaceIndices: seeds, changedSurfaceVertices: changed, longitudinalStart: .025, longitudinalFull: .05, radialFull: .06, radialLimit: .08 });
  } else {
    patches.push(applyPatch(graph, fields, names, { reason: 'Actual right low robe: replace impossible arm ownership with the garment’s hips anchor, preserving thigh contribution; surface-only feather into the genuine hanging sleeve', center: [-.1856, .5724, -.0676], core: .012, feather: .10 }, (_weights, target) => {
      const hips = names.indexOf('Hips');
      for (let j = 0; j < names.length; j++) if (/Arm|Shoulder|Hand/.test(names[j])) { target[hips] += target[j]; target[j] = 0; }
      return normalize(target);
    }));
  }
  const joints = new Uint16Array(graph.vertexWeld.length * 4), weights = new Float32Array(joints.length);
  let changedFromPrecondition = 0, maximumWeightDelta = 0;
  for (let i = 0; i < graph.vertexWeld.length; i++) {
    const four = continuousFourWeights(fields[graph.vertexWeld[i]]), old = new Float64Array(names.length);
    for (let k = 0; k < 4; k++) { joints[i * 4 + k] = four[k].j; weights[i * 4 + k] = four[k].v; old[names.indexOf(baseNames[base.mesh.geometry.attributes.skinIndex.getComponent(i, k)])] += base.mesh.geometry.attributes.skinWeight.getComponent(i, k); }
    let delta = 0; for (let j = 0; j < names.length; j++) delta = Math.max(delta, Math.abs(old[j] - (four.find(w => w.j === j)?.v ?? 0)));
    if (delta > 1e-6) changedFromPrecondition++; maximumWeightDelta = Math.max(maximumWeightDelta, delta);
  }
  const builder = new GLBBuilder(); builder.json = structuredClone(source.json); builder.parts = [Buffer.from(source.bin)]; builder.length = source.bin.length;
  const primitive = builder.json.meshes[0].primitives[0]; primitive.attributes.JOINTS_0 = builder.accessor(joints, 'VEC4'); primitive.attributes.WEIGHTS_0 = builder.accessor(weights, 'VEC4');
  const output = await candidateDirectory(out), file = path.join(output, 'repaired-source.glb'); await writeFile(file, builder.encode());
  const repaired = await loadRig(file); assertNativeContract(source, repaired);
  if (!repaired.bin.subarray(0, source.bin.length).equals(source.bin)) throw Error('Original raw binary buffers changed');
  const expectedJSON = structuredClone(source.json), actualJSON = structuredClone(repaired.json);
  for (const j of [expectedJSON, actualJSON]) { delete j.meshes[0].primitives[0].attributes.JOINTS_0; delete j.meshes[0].primitives[0].attributes.WEIGHTS_0; delete j.accessors; delete j.bufferViews; delete j.buffers; }
  if (JSON.stringify(expectedJSON) !== JSON.stringify(actualJSON)) throw Error('Repair changed non-weight JSON');
  const after = worldVertices(repaired); let restSkinDrift = 0;
  for (let i = 0; i < vertices.length; i += 3) restSkinDrift = Math.max(restSkinDrift, Math.hypot(...[0, 1, 2].map(k => vertices[i + k] - after[i + k])));
  if (restSkinDrift > 1e-5) throw Error('Weight correction changed actual rest skin');
  const receipt = { schema: 1, family, status: 'SOURCE_WEIGHT_DERIVATIVE_ONLY_NOT_APPROVED', source: frozen.inputPaths.body, sourceSHA256: source.sha256,
    precondition: preconditionFile, preconditionSHA256: base.sha256, originalNativeSources: frozen.sources, output: file, outputSHA256: repaired.sha256,
    sourceIndexMapping: 'Actual original raw and canonical unpacked vertex order/positions verified; UV duplicate vertices share the source-indexed position-welded triangle graph', sourceMappingError, restSkinDrift,
    unchangedOriginalBinaryPrefixSHA256: sha256(source.bin), geometryNormalsUVIndicesTextureRigAndRestPreserved: true,
    inheritedRepair: 'Already frozen per-body adjacency/diffusion weights from canonical unpacked precondition, then only measured local constraints. No second global diffusion.',
    changedFromPrecondition, maximumWeightDelta, patches, limits: ['No numeric or Art approval from this source-only check.', 'Parent must regenerate monk texture/contact receipts after full isolated native/runtime acceptance.'] };
  const receiptFile = path.join(output, 'source-repair-receipt.json'); await writeFile(receiptFile, JSON.stringify(receipt, null, 2) + '\n');
  return { frozen, receipt, receiptFile, output };
}

async function staticWai(candidate, profile) {
  const rig = await loadRig(candidate), rest = worldVertices(rig), edges = indexEdges(rig.mesh.geometry, rest);
  for (const [name, node] of Object.entries(profile.calibration.nodes)) rig.names.get(name).quaternion.fromArray(node.idleLocal.rotation);
  const before = edgeStrain(worldVertices(rig), edges), pose = createNPCWaiPose(rig.gltf.scene, profile.calibration, profile);
  pose.apply({ anim: 'pray', moving: false }); const values = worldVertices(rig), after = edgeStrain(values, edges), skin = rig.mesh.geometry.attributes;
  const bad = edges.filter(e => { const d = new THREE.Vector3().fromArray(values, e.a * 3).distanceTo(new THREE.Vector3().fromArray(values, e.b * 3)); return d / e.length > 2 && d - e.length > .01; }).map(e => ({ ...e, vertices: [e.a, e.b].map(i => ({ index: i, rest: Array.from(rest.slice(i * 3, i * 3 + 3)), posed: Array.from(values.slice(i * 3, i * 3 + 3)), weights: Array.from({ length: 4 }, (_, k) => ({ joint: rig.mesh.skeleton.bones[skin.skinIndex.getComponent(i, k)].name, weight: skin.skinWeight.getComponent(i, k) })).filter(w => w.weight > 0) })) }));
  return { passed: before.violations === 0 && after.violations === 0, before, after, bad };
}

export async function runMonkTrials({ families = allowed, out = path.join(root, 'monk-wai-trials', 'trial-1') } = {}) {
  const output = await candidateDirectory(out), beforePins = {};
  for (const file of pins) beforePins[file] = sha256(await readFile(path.join(REPO, file)));
  const immutableFiles = [path.join(root, 'candidate-profiles.json')];
  const freeze = await json(path.join(root, 'passing-bodies-freeze.json'));
  for (const row of freeze.families) for (const r of Object.values((await json(row.receipt)).outputs)) immutableFiles.push(r.path);
  const immutable = Object.fromEntries(await Promise.all(immutableFiles.map(async f => [f, sha256(await readFile(f))])));
  const results = [];
  for (const family of families) {
    try {
      const trial = await repairMonkSource({ family, out: path.join(output, family) }), { frozen } = trial;
      const guide = await json(frozen.outputs.guide.path); guide.sources.body = trial.receipt.outputSHA256; delete guide.weightRepair;
      guide.sourceWeightCorrection = { path: trial.receiptFile, sha256: sha256(await readFile(trial.receiptFile)), originalBodySHA256: frozen.sources.body };
      const guideFile = path.join(trial.output, family + '-guide.json'); await writeFile(guideFile, JSON.stringify(guide, null, 2) + '\n');
      const options = { family, body: trial.receipt.output, walk: frozen.inputPaths.walk, run: frozen.inputPaths.run, out: trial.output, calibration: guideFile };
      const calibrated = await calibrateInputs(options);
      // A weight-only repair retains this body's already accepted authored idle
      // and native rotations. Re-measure the palm contract on the corrected
      // surface, without allowing a weight-threshold PCA change to re-author
      // unrelated hand rotations or the native clips.
      const measured = await json(calibrated.adapter), corrected = await json(calibrated.calibration), original = await json(frozen.outputs.calibration.path);
      corrected.idleRotations = original.idleRotations;
      const raw = await loadRig(options.body), frame = canonicalFrame(worldVertices(raw), corrected, corrected.height);
      const contract = { ...adapterContract(raw, frame, corrected, measured.hands), fitMethod: 'Preserve this same body’s frozen measured idle/native rotations; corrected actual hand PCA supplies a new signed palm/socket contract. Weight-only derivative, no pose re-authoring.' };
      await writeFile(calibrated.calibration, JSON.stringify(corrected, null, 2) + '\n');
      await writeFile(calibrated.adapter, JSON.stringify(contract, null, 2) + '\n');
      const prepared = await prepareInputs({ ...options, calibration: calibrated.calibration });
      const row = { family, source: trial.receipt, prepared }; results.push(row);
      console.log(JSON.stringify({ family, phase: 'native', passed: prepared.passed, sha256: prepared.sha256, failures: prepared.failures }));
      if (!prepared.passed) continue;
      const contacts = await contactCandidateFromFiles({ family, body: prepared.candidate, adapter: calibrated.adapter, qa: prepared.report, brief: path.join(REPO, 'docs/art/npcs/NPC_MODEL_BRIEFS.json') });
      const contactFile = path.join(trial.output, 'contacts.json'); await writeFile(contactFile, JSON.stringify(contacts, null, 2) + '\n');
      const adapter = await json(calibrated.adapter), profile = { family, assetSha256: prepared.sha256, geometryAssetSha256: prepared.sha256, calibration: adapter, ...contacts.profileFields, activityPoses: { wai: true } };
      const profileFile = path.join(trial.output, 'profile.json'); await writeFile(profileFile, JSON.stringify(profile, null, 2) + '\n');
      const record = { outputs: {} };
      for (const [key, file] of Object.entries({ candidate: prepared.candidate, adapter: calibrated.adapter, calibration: calibrated.calibration, qa: prepared.report, guide: guideFile, contacts: contactFile, profile: profileFile, source: trial.receipt.output, sourceReceipt: trial.receiptFile })) record.outputs[key] = { path: file, sha256: sha256(await readFile(file)) };
      row.outputs = record.outputs; row.wai = await staticWai(prepared.candidate, profile); console.log(JSON.stringify({ family, phase: 'static-wai', passed: row.wai.passed, bad: row.wai.after.violations }));
      row.runtime = await auditRuntimeFamily({ family, record, profile, hz: 30, duration: 8 });
      row.passed = row.wai.passed && row.runtime.passed;
      await writeFile(path.join(trial.output, 'runtime-wai-qa.json'), JSON.stringify({ wai: row.wai, runtime: row.runtime }, null, 2) + '\n');
      console.log(JSON.stringify({ family, phase: 'runtime-wai', passed: row.passed, frames: row.runtime.results.reduce((n, r) => n + r.metrics.samples, 0) }));
    } catch (e) { results.push({ family, passed: false, blocked: e.stack }); console.log(JSON.stringify({ family, blocked: e.message })); }
  }
  for (const [file, hash] of Object.entries(beforePins)) if (sha256(await readFile(path.join(REPO, file))) !== hash) throw Error('Frozen core/helper changed during trial: ' + file);
  for (const [file, hash] of Object.entries(immutable)) if (sha256(await readFile(file)) !== hash) throw Error('Frozen family/catalog changed during trial: ' + file);
  const report = { schema: 1, passed: results.every(r => r.passed), results, unchangedCoreAndFrozenHelpers: beforePins, unchangedFamilyAndCatalogFiles: immutable, limits: ['Isolated canonical numeric/native/runtime trial. Parent Art captures still required.', 'No core, family root, public or catalog writes. No generation calls.'] };
  const file = path.join(output, 'trial-receipt.json'); await writeFile(file, JSON.stringify(report, null, 2) + '\n'); return { passed: report.passed, file, results: results.map(r => ({ family: r.family, passed: !!r.passed, sha256: r.prepared?.sha256, blocked: r.blocked })) };
}

export async function runRelaxedMonkTrials({ families = allowed, seed, out }) {
  const output = await candidateDirectory(out), before = {};
  for (const file of pins) before[path.join(REPO, file)] = sha256(await readFile(path.join(REPO, file)));
  const frozenRows = await json(path.join(root, 'passing-bodies-freeze.json'));
  for (const r of frozenRows.families) for (const p of Object.values((await json(r.receipt)).outputs)) before[p.path] = sha256(await readFile(p.path));
  before[path.join(root, 'candidate-profiles.json')] = sha256(await readFile(path.join(root, 'candidate-profiles.json')));
  const results = [];
  for (const family of families) {
    const frozen = await json(path.join(root, family, 'freeze-receipt.json')), seedDir = path.resolve(REPO, seed, family), baseReceipt = await json(path.join(seedDir, 'source-repair-receipt.json'));
    let current = { body: baseReceipt.output, candidate: path.join(seedDir, family + '.glb'), qa: path.join(seedDir, family + '-qa.json'), adapter: path.join(seedDir, family + '-adapter.json'), calibration: path.join(seedDir, family + '-calibration.json'), unpacked: path.join(seedDir, family + '-unpacked.glb') };
    const history = []; let result;
    for (let round = 1; round <= 3; round++) {
      const stage = await candidateDirectory(path.join(output, family, 'stage-' + round));
      const contacts = await contactCandidateFromFiles({ family, body: current.candidate, adapter: current.adapter, qa: current.qa, brief: path.join(REPO, 'docs/art/npcs/NPC_MODEL_BRIEFS.json') });
      const currentAdapter = await json(current.adapter), currentQA = await json(current.qa), profile = { family, assetSha256: currentQA.sha256, geometryAssetSha256: currentQA.sha256, calibration: currentAdapter, ...contacts.profileFields, activityPoses: { wai: true } };
      const relaxed = await relaxPoseWeights({ family, body: current.body, unpacked: current.unpacked, candidate: current.candidate, calibration: current.calibration, profile, out: stage });
      const guide = await json(frozen.outputs.guide.path), original = await json(frozen.outputs.calibration.path);
      guide.sources.body = relaxed.sha256; delete guide.weightRepair;
      guide.sourceWeightCorrection = { originalBodySHA256: frozen.sources.body, base: { path: path.join(seedDir, 'source-repair-receipt.json'), sha256: sha256(await readFile(path.join(seedDir, 'source-repair-receipt.json'))) }, relaxation: { path: relaxed.receiptFile, sha256: sha256(await readFile(relaxed.receiptFile)) } };
      const guideFile = path.join(stage, family + '-guide.json'); await writeFile(guideFile, JSON.stringify(guide, null, 2) + '\n');
      const options = { family, body: relaxed.file, walk: frozen.inputPaths.walk, run: frozen.inputPaths.run, calibration: guideFile, out: stage };
      const calibrated = await calibrateInputs(options), measured = await json(calibrated.adapter), corrected = await json(calibrated.calibration);
      corrected.idleRotations = original.idleRotations;
      const raw = await loadRig(options.body), frame = canonicalFrame(worldVertices(raw), corrected, corrected.height);
      const adapter = { ...adapterContract(raw, frame, corrected, measured.hands), fitMethod: 'Preserve this same body’s frozen idle/native rotations; remeasure actual corrected palm/socket contract. Local source weight repair, no pose re-authoring.' };
      await writeFile(calibrated.calibration, JSON.stringify(corrected, null, 2) + '\n'); await writeFile(calibrated.adapter, JSON.stringify(adapter, null, 2) + '\n');
      const prepared = await prepareInputs({ ...options, calibration: calibrated.calibration });
      current = { body: relaxed.file, candidate: prepared.candidate, qa: prepared.report, adapter: calibrated.adapter, calibration: calibrated.calibration, unpacked: path.join(stage, family + '-unpacked.glb') };
      result = { family, passed: false, round, sha256: prepared.sha256, nativePassed: prepared.passed, sourceSHA256: relaxed.sha256, history };
      history.push({ round, ...prepared, repair: relaxed.receiptFile });
      console.log(JSON.stringify({ family, round, phase: 'pose-relaxed-native', passed: prepared.passed, sha256: prepared.sha256, failures: prepared.failures }));
      if (!prepared.passed) continue;
      const finalContact = await contactCandidateFromFiles({ family, body: current.candidate, adapter: current.adapter, qa: current.qa, brief: path.join(REPO, 'docs/art/npcs/NPC_MODEL_BRIEFS.json') });
      const finalProfile = { family, assetSha256: prepared.sha256, geometryAssetSha256: prepared.sha256, calibration: adapter, ...finalContact.profileFields, activityPoses: { wai: true } };
      const contactFile = path.join(stage, 'contacts.json'), profileFile = path.join(stage, 'profile.json');
      await writeFile(contactFile, JSON.stringify(finalContact, null, 2) + '\n'); await writeFile(profileFile, JSON.stringify(finalProfile, null, 2) + '\n');
      const record = { outputs: {} };
      for (const [key, file] of Object.entries({ candidate: current.candidate, adapter: current.adapter, calibration: current.calibration, qa: current.qa, guide: guideFile, contacts: contactFile, profile: profileFile, source: current.body, sourceReceipt: relaxed.receiptFile })) record.outputs[key] = { path: file, sha256: sha256(await readFile(file)) };
      const wai = await staticWai(current.candidate, finalProfile), runtime = await auditRuntimeFamily({ family, record, profile: finalProfile, hz: 30, duration: 8 });
      result = { ...result, passed: wai.passed && runtime.passed, outputs: record.outputs, wai, runtime };
      await writeFile(path.join(stage, 'runtime-wai-qa.json'), JSON.stringify({ wai, runtime }, null, 2) + '\n');
      console.log(JSON.stringify({ family, round, phase: 'pose-relaxed-runtime', passed: result.passed, waiBad: wai.after.violations, frames: runtime.results.reduce((n, r) => n + r.metrics.samples, 0) }));
      if (result.passed) break;
    }
    results.push(result);
  }
  for (const [file, pin] of Object.entries(before)) if (sha256(await readFile(file)) !== pin) throw Error('Frozen core/helper/family/catalog changed during isolated repair: ' + file);
  const report = { schema: 1, passed: results.every(r => r.passed), results, unchangedPins: before,
    limitations: ['Only numeric/native/runtime/wai source candidates. No Art approval/publication.', 'Parent must regenerate monk texture/contact/profile lineage before staging.', 'Other15 family roots, all monk roots/catalog/public and fixed parent helper unchanged.'] };
  const file = path.join(output, 'trial-receipt.json'); await writeFile(file, JSON.stringify(report, null, 2) + '\n');
  return { passed: report.passed, file, results: results.map(r => ({ family: r.family, passed: r.passed, round: r.round, sha256: r.sha256, sourceSHA256: r.sourceSHA256 })) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { const opts = {}, args = process.argv.slice(2); for (let i = 0; i < args.length; i += 2) { if (args[i] === '--families') opts.families = args[i + 1].split(','); else if (args[i] === '--out') opts.out = args[i + 1]; else if (args[i] === '--seed') opts.seed = args[i + 1]; else throw Error('Use --families monk_elder,monk_novice --out ignored-trial-directory [--seed prior-trial-directory]'); }
    const result = await (opts.seed ? runRelaxedMonkTrials : runMonkTrials)(opts); console.log(JSON.stringify(result)); if (!result.passed) process.exitCode = 1;
  } catch (e) { console.error(e.stack); process.exitCode = 1; }
}
