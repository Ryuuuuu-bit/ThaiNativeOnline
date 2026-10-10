import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile, readFile, rm, readdir } from 'node:fs/promises';
import path from 'node:path';
import { GLBBuilder, parseGLB, sha256 } from '../tools/npc-models/glb.mjs';
import { THREE, loadRig, worldVertices, canonicalFrame, canonicalWorlds, assertNativeContract, sampleTimes, clampedSampler } from '../tools/npc-models/rig.mjs';
import { edgeStrain, indexEdges, kneeMetrics, auditRig, inspectRig } from '../tools/npc-models/audit.mjs';
import { REPO, OUTPUT_ROOT, candidateDirectory, packingDependencies, validateCalibration, bakeNativeClip, prepareInputs, argumentsFrom, textureOverrideBytes } from '../tools/npc-models/prepare.mjs';
import { continuousFourWeights, surfaceGraph } from '../tools/npc-models/weights.mjs';
import { forwardKnees } from '../tools/npc-models/motion-limits.mjs';
import { compileCalibration, MESHY_NPC_JOINTS } from '../tools/npc-models/calibration.mjs';

const semantics = {
  hips: 'Hips', head: 'Head',
  left: { upperArm: 'LeftUpperArm', forearm: 'LeftForearm', hand: 'LeftHand', thigh: 'LeftThigh', shin: 'LeftShin', foot: 'LeftFoot' },
  right: { upperArm: 'RightUpperArm', forearm: 'RightForearm', hand: 'RightHand', thigh: 'RightThigh', shin: 'RightShin', foot: 'RightFoot' },
};

// Synthetic geometry exists only to exercise transform/receipt failure cases.
// Real Meshy candidates have a separate opt-in production-asset gate below.
function fixture({ rotation = 0, clip = null, wrongParent = false, badLength = false, relaxed = true } = {}) {
  const b = new GLBBuilder(), objects = [], names = new Map(), definitions = [['Armature', null, [0, 0, 0]], ['Hips', 'Armature', [0, 90, 0]], ['Spine', 'Hips', [0, 25, 0]], ['Head', 'Spine', [0, 43, 0]]];
  for (const [side, sign] of [['Left', 1], ['Right', -1]]) definitions.push(
    [`${side}UpperArm`, 'Spine', [sign * 22, 20, 0]], [`${side}Forearm`, `${side}UpperArm`, [sign * 8, relaxed ? -24 : 0, 0]], [`${side}Hand`, `${side}Forearm`, [sign * 2, -21, 0]],
    [`${side}Thigh`, 'Hips', [sign * 10, -6, 0]], [`${side}Shin`, `${side}Thigh`, [0, -38, 0]], [`${side}Foot`, `${side}Shin`, [0, -42, 0]]);
  for (const [name, parent, t] of definitions) {
    const id = objects.length, o = new THREE.Object3D(); o.name = name; o.position.fromArray(t); if (!parent) o.scale.setScalar(0.01);
    objects.push(o); names.set(name, id); if (parent) objects[names.get(parent)].add(o);
    b.json.nodes.push({ name, translation: t, ...(parent ? {} : { scale: [0.01, 0.01, 0.01] }), children: [] });
    if (parent) b.json.nodes[names.get(parent)].children.push(id);
  }
  if (wrongParent) {
    const hand = names.get('LeftHand'), forearm = names.get('LeftForearm');
    b.json.nodes[forearm].children = []; b.json.nodes[names.get('RightForearm')].children.push(hand);
  }
  objects[0].updateMatrixWorld(true);
  const joints = objects.slice(1), ibms = new Float32Array(joints.length * 16), positions = [], normals = [], uv = [], ji = [], jw = [], indexes = [];
  joints.forEach((o, j) => {
    o.matrixWorld.clone().invert().toArray(ibms, j * 16);
    const center = new THREE.Vector3().setFromMatrixPosition(o.matrixWorld), radius = o.name === 'Head' ? 0.14 : o.name.endsWith('Foot') ? 0.04 : 0.02;
    const first = positions.length / 3;
    for (const d of [[-radius, -radius, 0], [radius, -radius, 0], [0, radius, 0], [0, 0, radius]]) { positions.push(...center.clone().add(new THREE.Vector3(...d)).toArray()); normals.push(0, 1, 0); uv.push(0.5, 0.5); ji.push(j, 0, 0, 0); jw.push(1, 0, 0, 0); }
    for (const tri of [[0, 1, 2], [0, 1, 3], [0, 2, 3], [1, 2, 3]]) indexes.push(...tri.map(v => v + first));
  });
  const attrs = { POSITION: b.accessor(new Float32Array(positions), 'VEC3', { bounds: true }), NORMAL: b.accessor(new Float32Array(normals), 'VEC3'), TEXCOORD_0: b.accessor(new Float32Array(uv), 'VEC2'), JOINTS_0: b.accessor(new Uint16Array(ji), 'VEC4'), WEIGHTS_0: b.accessor(new Float32Array(jw), 'VEC4') };
  b.json.meshes.push({ primitives: [{ attributes: attrs, indices: b.accessor(new Uint16Array(indexes), 'SCALAR'), material: 0 }] });
  b.json.skins.push({ joints: joints.map(o => names.get(o.name)), inverseBindMatrices: b.accessor(ibms, 'MAT4') });
  const mesh = b.json.nodes.length; b.json.nodes.push({ name: 'Body', mesh: 0, skin: 0 });
  const root = b.json.nodes.length; b.json.nodes.push({ name: 'SourceFrame', rotation: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), rotation).toArray(), children: [0, mesh] }); b.json.scenes[0].nodes = [root];
  const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADElEQVQImWM4c2Y3AAS7AlSKTCvpAAAAAElFTkSuQmCC', 'base64');
  b.json.images = [{ bufferView: b.view(image), mimeType: 'image/png' }]; b.json.textures = [{ source: 0 }];
  b.json.materials = [{ pbrMetallicRoughness: { baseColorTexture: { index: 0 } }, alphaMode: 'OPAQUE' }];
  if (clip) {
    const input = b.accessor(new Float32Array([0, 0.5, 1]), 'SCALAR', { bounds: true });
    const values = badLength ? [0, -38, 0, 0, -58, 0, 0, -38, 0] : [0, 102, 0, 0, 104, 30, 0, 102, 60];
    const output = b.accessor(new Float32Array(values), 'VEC3');
    b.json.animations.push({ name: clip, samplers: [{ input, output, interpolation: 'LINEAR' }], channels: [{ sampler: 0, target: { node: names.get(badLength ? 'LeftShin' : 'Hips'), path: 'translation' } }] });
  }
  return b.encode();
}

async function temporary(t) {
  await mkdir(OUTPUT_ROOT, { recursive: true }); const dir = await mkdtemp(path.join(OUTPUT_ROOT, 'test-'));
  t.after(async () => { assert.ok(dir.startsWith(OUTPUT_ROOT + path.sep)); await rm(dir, { recursive: true, force: true }); }); return dir;
}

async function sourcesAt(dir, config = {}) {
  const sources = {}, files = {};
  for (const role of ['body', 'walk', 'run']) {
    files[role] = path.join(dir, `${role}.glb`); await writeFile(files[role], fixture({ ...config, clip: role === 'body' ? null : role })); sources[role] = await loadRig(files[role]);
  }
  return { sources, files };
}

const profileFor = sources => ({ schema: 1, sources: Object.fromEntries(Object.entries(sources).map(([r, s]) => [r, s.sha256])), height: 1.72, up: [0, 1, 0], forward: [0, 0, 1], footOrigin: [0, 0, 0], semantics, idleRotations: {} });

test('NPC binary reader rejects truncated and external payloads', () => {
  const bytes = fixture(); assert.equal(parseGLB(bytes).json.skins[0].joints.length, 15);
  assert.throws(() => parseGLB(bytes.subarray(0, bytes.length - 4)), /header/);
  const b = new GLBBuilder(); b.json.buffers[0].uri = 'outside.bin'; b.view(Buffer.from([0])); assert.throws(() => parseGLB(b.encode()), /External/);
});

test('NPC canonicalization requires explicit axes and preserves centimetre skin frames', async t => {
  const dir = await temporary(t), { sources } = await sourcesAt(dir, { rotation: Math.PI / 2 });
  const body = sources.body, vertices = worldVertices(body), report = inspectRig(body);
  assert.ok(report.bindError < 1e-6); assert.equal(report.joints, 15);
  assert.throws(() => canonicalFrame(vertices, {}, 1.72), /Explicit/);
  assert.throws(() => canonicalFrame(vertices, { up: [0, 0, 1], forward: [0, 0, 1], footOrigin: [0, 0, 0] }, 1.72), /orthogonal/);
  const frame = canonicalFrame(vertices, { up: [0, 0, 1], forward: [0, -1, 0], footOrigin: [0, 0, 0] }, 1.72);
  const worlds = canonicalWorlds(body, frame), hip = new THREE.Vector3().setFromMatrixPosition(worlds.get('Hips'));
  assert.ok(Math.abs(hip.y - 0.9) < 1e-6 && Math.abs(hip.z) < 1e-6);
  const scales = new THREE.Vector3(); worlds.get('LeftHand').decompose(new THREE.Vector3(), new THREE.Quaternion(), scales); assert.ok(scales.distanceTo(new THREE.Vector3(1, 1, 1)) < 1e-6);
  const small = canonicalFrame(vertices, { up: [0, 0, 1], forward: [0, -1, 0], footOrigin: [0, 0, 0] }, 1.2); assert.ok(Math.abs(small.scale / frame.scale - 1.2 / 1.72) < 1e-9);
});

test('NPC calibration pins all three real input hashes and native ancestry/rest frames', async t => {
  const dir = await temporary(t), { sources } = await sourcesAt(dir), profile = profileFor(sources);
  validateCalibration(profile, sources);
  assert.throws(() => validateCalibration({ ...profile, sources: { ...profile.sources, walk: '0'.repeat(64) } }, sources), /walk SHA/);
  const bad = path.join(dir, 'wrong-parent.glb'); await writeFile(bad, fixture({ wrongParent: true, clip: 'walk' }));
  const changed = await loadRig(bad); assert.throws(() => assertNativeContract(sources.body, changed), /bone contract differs/);
  sources.walk.rest.get(sources.walk.names.get('LeftHand')).world.elements[12] += 0.01;
  assert.throws(() => assertNativeContract(sources.body, sources.walk), /rest frame differs/);
});

test('NPC native bake removes world horizontal travel and anchors hip without destroying vertical bob', async t => {
  const dir = await temporary(t), { sources } = await sourcesAt(dir), profile = profileFor(sources), frame = canonicalFrame(worldVertices(sources.body), profile, profile.height);
  const baked = bakeNativeClip(sources.body, sources.walk, frame, profile, 'walk');
  assert.ok(baked.times.includes(0.5)); assert.equal(baked.times.at(-1), 1);
  const hip = baked.poses.map(p => p.find(n => n.name === 'Hips').p);
  assert.ok(hip.every(p => Math.abs(p.x) < 1e-6 && Math.abs(p.z) < 1e-6));
  assert.ok(Math.abs(hip[0].y - 0.9) < 1e-6); assert.ok(Math.abs(Math.max(...hip.map(p => p.y)) - 0.92) < 1e-6);
  assert.ok(Math.abs(baked.hipStartCorrectionY + 0.12) < 1e-6);
});

test('NPC sampler includes off-grid keys, clamps endpoints and never wraps its final frame', async t => {
  const dir = await temporary(t), { sources } = await sourcesAt(dir), rig = sources.walk, clip = rig.gltf.animations[0];
  clip.tracks[0].times[1] = 0.413; assert.ok(sampleTimes(clip).some(t => Math.abs(t - 0.413) < 1e-6));
  const almostGrid = new THREE.AnimationClip('float endpoint', 0.03333333507180214, []); assert.equal(sampleTimes(almostGrid).at(-1), almostGrid.duration);
  const sampler = clampedSampler(rig, clip); sampler.at(0); const start = rig.names.get('Hips').position.z;
  sampler.at(clip.duration); const end = rig.names.get('Hips').position.z; assert.ok(end > start + 50);
  sampler.at(clip.duration + 0.2); assert.equal(rig.names.get('Hips').position.z, end); sampler.dispose();
});

test('NPC strain detects a real stretched indexed edge and backwards knees instead of accepting finite poses', () => {
  const rest = new Float64Array([0, 0, 0, 0.02, 0, 0, 0, 0.02, 0]), geometry = { index: { array: new Uint16Array([0, 1, 2]) } };
  const edges = indexEdges(geometry, rest), bad = rest.slice(); bad[3] = 0.08;
  assert.equal(edgeStrain(rest, edges).violations, 0); assert.ok(edgeStrain(bad, edges).violations > 0);
  const hip = new THREE.Vector3(0, 0.9, 0), ankle = new THREE.Vector3(0, 0.1, 0), forward = new THREE.Vector3(0, 0, 1);
  assert.equal(kneeMetrics(hip, new THREE.Vector3(0, 0.5, 0.12), ankle, forward).backward, false);
  assert.equal(kneeMetrics(hip, new THREE.Vector3(0, 0.5, -0.12), ankle, forward).backward, true);
});

test('NPC four-influence packing stays continuous at competing fourth/fifth weights', () => {
  const field = values => { const dense = Array(values.length).fill(0); for (const x of continuousFourWeights(values)) dense[x.j] = x.v; return dense; };
  const a = field([0.56, 0.25, 0.10, 0.050001, 0.049999]), b = field([0.56, 0.25, 0.10, 0.049999, 0.050001]);
  assert.ok(Math.max(...a.map((v, i) => Math.abs(v - b[i]))) < 0.00001);
  assert.ok(a.filter(v => v > 0).length <= 4); assert.ok(Math.abs(a.reduce((s, v) => s + v, 0) - 1) < 1e-9);
  assert.throws(() => continuousFourWeights([1, 1, 1, 1, 1]), /Ambiguous/);
});

test('NPC surface smoothing does not connect separate nearby limb geometry through air', async t => {
  const dir = await temporary(t), { sources } = await sourcesAt(dir), profile = profileFor(sources), frame = canonicalFrame(worldVertices(sources.body), profile, profile.height);
  const graph = surfaceGraph(sources.body, frame);
  assert.equal(graph.components.length, 15);
  for (let i = 0; i < graph.adjacent.length; i++) for (const j of graph.adjacent[i]) assert.equal(graph.labels[i], graph.labels[j]);
});

test('NPC calibrated knee limiter corrects hyperextension while preserving the joint and shin length', async t => {
  const dir = await temporary(t), { sources } = await sourcesAt(dir), rig = sources.body, profile = profileFor(sources), frame = canonicalFrame(worldVertices(rig), profile, profile.height), rest = canonicalWorlds(rig, frame), worlds = new Map([...rest].map(([n, m]) => [n, m.clone()]));
  const knee = new THREE.Vector3().setFromMatrixPosition(worlds.get('LeftShin')), hip = new THREE.Vector3().setFromMatrixPosition(worlds.get('LeftThigh')), ankle = new THREE.Vector3().setFromMatrixPosition(worlds.get('LeftFoot')); ankle.z = 0.2; worlds.get('LeftFoot').setPosition(ankle);
  const length = ankle.distanceTo(knee); assert.equal(kneeMetrics(hip, knee, ankle, new THREE.Vector3(0, 0, 1)).backward, true);
  assert.equal(forwardKnees(rig, worlds, semantics, rest), 1);
  const corrected = new THREE.Vector3().setFromMatrixPosition(worlds.get('LeftFoot'));
  assert.equal(kneeMetrics(hip, knee, corrected, new THREE.Vector3(0, 0, 1)).backward, false);
  assert.ok(Math.abs(corrected.distanceTo(knee) - length) < 1e-9); assert.deepEqual(new THREE.Vector3().setFromMatrixPosition(worlds.get('LeftShin')).toArray(), knee.toArray());
});

test('NPC compiler refuses copied calibration hashes and unsupported anatomy instead of guessing a new rig', async t => {
  const dir = await temporary(t), { sources } = await sourcesAt(dir), profile = profileFor(sources);
  assert.throws(() => compileCalibration(sources, { ...profile, sources: { ...profile.sources, body: '0'.repeat(64) } }), /body SHA/);
  assert.throws(() => compileCalibration(sources, profile), /24-joint/);
  assert.throws(() => validateCalibration({ ...profile, nativeGains: { walk: { Hips: 1.01 } } }, sources), /bounded native gain/);
});

test('NPC texture repair accepts only hash-pinned ignored local data', async t => {
  const dir = await temporary(t), bytes = Buffer.from('texture receipt fixture'), file = path.join(dir, 'colour.png'); await writeFile(file, bytes);
  assert.deepEqual(await textureOverrideBytes({ path: file, sha256: sha256(bytes) }), bytes);
  await assert.rejects(textureOverrideBytes({ path: file, sha256: '0'.repeat(64) }), /SHA does not match/);
  await assert.rejects(textureOverrideBytes({ path: path.join(REPO, 'public/outside.png'), sha256: sha256(bytes) }), /ignored local/);
});

test('NPC CLI refuses noncandidate destinations and duplicate/unknown arguments', async () => {
  await assert.rejects(candidateDirectory(path.resolve(OUTPUT_ROOT, '../../../public/models/npcs')), /under artifacts/);
  assert.throws(() => argumentsFrom(['prepare', '--body', 'a', '--body', 'b']), /Invalid option/);
  assert.throws(() => argumentsFrom(['prepare', '--generate', 'yes']), /Invalid option/);
});

test('NPC complete local packing reloads actual skin and fails changed limb/idle anatomy', async t => {
  let deps; try { deps = packingDependencies(); } catch { t.skip('Set NPC_MODEL_DEPS to existing sharp/gltfpack helper project for local packing QA'); return; }
  const dir = await temporary(t), { sources, files } = await sourcesAt(dir), profile = profileFor(sources), calibration = path.join(dir, 'profile.json');
  await writeFile(calibration, JSON.stringify(profile));
  const good = await prepareInputs({ ...files, calibration, family: 'fixture', out: path.join(dir, 'prepared'), deps: deps.project });
  assert.equal(good.passed, true, JSON.stringify(good.failures)); assert.ok(good.bytes < 800000);
  const packed = await loadRig(good.candidate), audit = auditRig(packed, { height: profile.height, semantics });
  assert.equal(audit.passed, true); assert.equal(audit.clips.length, 3); assert.ok(audit.clips.every(c => c.samples >= 31 && c.maxHipXZDrift <= 0.001));
  const altered = await sourcesAt(dir, { badLength: true }), badProfile = profileFor(altered.sources); await writeFile(calibration, JSON.stringify(badProfile));
  const bad = await prepareInputs({ ...altered.files, calibration, family: 'bad-limb', out: path.join(dir, 'bad'), deps: deps.project });
  assert.equal(bad.passed, false); assert.ok(bad.failures.some(f => f.includes('limb length drift')));
  const stiff = await sourcesAt(dir, { relaxed: false }); await writeFile(calibration, JSON.stringify(profileFor(stiff.sources)));
  const unrelaxed = await prepareInputs({ ...stiff.files, calibration, family: 'stiff-idle', out: path.join(dir, 'stiff'), deps: deps.project });
  assert.equal(unrelaxed.passed, false); assert.ok(unrelaxed.failures.some(f => f.includes('not relaxed')));
});

test('NPC actual candidate reports revalidate immutable bodies, packed hashes and all skin frames', { skip: !process.env.NPC_MODEL_CANDIDATES }, async () => {
  const root = path.resolve(process.env.NPC_MODEL_CANDIDATES), reports = [];
  async function scan(directory) { for (const e of await readdir(directory, { withFileTypes: true })) { const p = path.join(directory, e.name); if (e.isDirectory()) await scan(p); else if (e.name.endsWith('-qa.json')) reports.push(p); } }
  await scan(root); assert.ok(reports.length > 0, 'No actual NPC candidate reports found');
  const bodyHashes = new Set();
  for (const file of reports) {
    const report = JSON.parse(await readFile(file, 'utf8')); assert.equal(report.audit.passed, true, `${report.family}: candidate not accepted`);
    assert.equal(sha256(await readFile(report.candidate)), report.sha256, `${report.family}: changed packed bytes`);
    assert.equal(bodyHashes.has(report.sources.body), false, 'Each NPC family requires a distinct newly generated body'); bodyHashes.add(report.sources.body);
    const rig = await loadRig(report.candidate), profile = JSON.parse(await readFile(report.calibrationPath, 'utf8'));
    assert.equal(rig.mesh.skeleton.bones.length, 24); assert.ok(MESHY_NPC_JOINTS.every(n => rig.names.has(n)));
    assert.equal(sha256(await readFile(report.calibrationPath)), report.calibrationSHA256);
    for (const role of ['body', 'walk', 'run']) assert.equal(sha256(await readFile(report.inputPaths[role])), report.sources[role]);
    if (profile.textureOverride) await textureOverrideBytes(profile.textureOverride);
    const result = auditRig(rig, { height: report.height, semantics: profile.semantics }); assert.equal(result.passed, true, JSON.stringify({ family: report.family, failures: result.failures }));
  }
});
