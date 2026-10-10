// Local-only NPC asset preparation. No generation calls and no runtime/public writes.
// Optional packing dependencies: --deps <existing helper project> or NPC_MODEL_DEPS.
import { readFile, writeFile, mkdir, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { GLBBuilder, sha256 } from './glb.mjs';
import { THREE, loadRig, restoreRest, worldVertices, restGeometryMatrix, assertNativeContract, canonicalFrame, canonicalWorlds, inPlaceWorlds, localPose, clampedSampler, sampleTimes, rigContract } from './rig.mjs';
import { inspectRig, resolveSemantics, auditRig, LIMITS } from './audit.mjs';
import { repairWeights, equivalentSkinJoints } from './weights.mjs';
import { forwardKnees, groundAnimations } from './motion-limits.mjs';
import { compileCalibration } from './calibration.mjs';

const runFile = promisify(execFile);
export const REPO = fileURLToPath(new URL('../../', import.meta.url));
export const OUTPUT_ROOT = path.resolve(REPO, 'artifacts/city-npc-models');

export async function candidateDirectory(directory = OUTPUT_ROOT) {
  const target = path.resolve(REPO, directory), inside = p => p === OUTPUT_ROOT || p.startsWith(OUTPUT_ROOT + path.sep);
  if (!inside(target)) throw Error('All outputs must remain under artifacts/city-npc-models');
  // Check existing ancestors before creating any output. Do not follow an escaping junction.
  let ancestor = target;
  for (;;) {
    try {
      const resolved = await realpath(ancestor), relative = path.relative(ancestor, target), actual = path.resolve(resolved, relative);
      const repoReal = await realpath(REPO), allowedReal = path.join(repoReal, 'artifacts/city-npc-models');
      if (actual !== allowedReal && !actual.startsWith(allowedReal + path.sep)) throw Error('Output junction escapes candidate directory');
      break;
    } catch (error) { if (error.code !== 'ENOENT') throw error; const parent = path.dirname(ancestor); if (parent === ancestor) throw error; ancestor = parent; }
  }
  await mkdir(target, { recursive: true }); return target;
}

export function packingDependencies(explicit = process.env.NPC_MODEL_DEPS) {
  const candidates = explicit ? [path.resolve(explicit)] : [path.join(REPO, 'tools/monster-models'), REPO];
  for (const project of candidates) {
    const require = createRequire(path.join(project, 'package.json'));
    try { return { sharp: require('sharp'), gltfpack: require.resolve('gltfpack/cli.js'), project }; } catch (error) { if (explicit) throw Error(`Packing dependencies unavailable in ${project}: ${error.message}`); }
  }
  throw Error('Set NPC_MODEL_DEPS to an existing helper project containing sharp and gltfpack; no install is performed');
}

export function validateCalibration(profile, sources) {
  if (profile.schema !== 1) throw Error('Calibration schema must be 1');
  for (const role of ['body', 'walk', 'run']) if (!/^[a-f0-9]{64}$/.test(profile.sources?.[role] ?? '') || profile.sources[role] !== sources[role].sha256) throw Error(`Calibration ${role} SHA does not match actual input`);
  if (![1.72, 1.2].includes(profile.height)) throw Error('Calibration height must be 1.72 or 1.2');
  resolveSemantics(sources.body, profile.semantics);
  for (const [name, values] of Object.entries(profile.idleRotations ?? {})) {
    if (!sources.body.names.has(name) || !Array.isArray(values) || values.length !== 4 || !values.every(Number.isFinite) || Math.abs(Math.hypot(...values) - 1) > 1e-5) throw Error(`Invalid inspected idle quaternion: ${name}`);
  }
  for (const [role, gains] of Object.entries(profile.nativeGains ?? {})) {
    if (!['walk', 'run'].includes(role)) throw Error('Native gain role must be walk or run');
    for (const [name, gain] of Object.entries(gains)) if (!sources.body.names.has(name) || !Number.isFinite(gain) || gain < 0 || gain > 1) throw Error(`Invalid bounded native gain: ${name}`);
  }
  if (profile.nativeRelativeBones != null && (!Array.isArray(profile.nativeRelativeBones) || profile.nativeRelativeBones.some(n => !sources.body.names.has(n)))) throw Error('Native relative bones must match this actual rig');
}

export async function textureOverrideBytes(override) {
  const file = path.resolve(REPO, override.path ?? '');
  if (!file.startsWith(OUTPUT_ROOT + path.sep) || !/^[a-f0-9]{64}$/.test(override.sha256 ?? '')) throw Error('Texture override requires ignored local candidate path and SHA256');
  const actual = await realpath(file), allowed = await realpath(OUTPUT_ROOT);
  if (!actual.startsWith(allowed + path.sep)) throw Error('Texture override junction escapes ignored candidates');
  const bytes = await readFile(file); if (sha256(bytes) !== override.sha256) throw Error('Texture override SHA does not match'); return bytes;
}

export function bakeNativeClip(body, donor, frame, profile, role) {
  assertNativeContract(body, donor);
  const wanted = profile.clips?.[role], clips = donor.gltf.animations;
  const clip = wanted ? clips.find(c => c.name === wanted) : clips.length === 1 ? clips[0] : null;
  if (!clip) throw Error(`Select an actual native ${role} clip in calibration.clips`);
  const sampler = clampedSampler(donor, clip), times = sampleTimes(clip);
  restoreRest(body);
  const restWorlds = canonicalWorlds(body, frame), restHip = new THREE.Vector3().setFromMatrixPosition(restWorlds.get(profile.semantics.hips));
  const fixedAncestors = new Map(body.objects.filter(o => !body.mesh.skeleton.bones.includes(o)).map(o => [body.objectNames.get(o), restWorlds.get(body.objectNames.get(o))]));
  let firstHip; const poses = [];
  const reference = new Map();
  let kneeCorrections = 0;
  if (profile.nativeFirstFrameRelative === true) {
    sampler.at(0);
    for (const object of donor.objects) if (!profile.nativeRelativeBones || profile.nativeRelativeBones.includes(donor.objectNames.get(object))) reference.set(object, { p: object.position.clone(), q: object.quaternion.clone(), s: object.scale.clone() });
  }
  try {
    for (const t of times) {
      sampler.at(t);
      for (const object of donor.objects) {
        const name = donor.objectNames.get(object), gain = profile.nativeGains?.[role]?.[name] ?? 1, rest = donor.rest.get(object), ref = reference.get(object);
        if (ref) {
          object.position.copy(rest.p.clone().add(object.position.clone().sub(ref.p).multiplyScalar(gain)));
          const neutral = profile.idleRotations?.[name] ? new THREE.Quaternion(...profile.idleRotations[name]) : rest.q;
          const delta = ref.q.clone().invert().multiply(object.quaternion);
          object.quaternion.copy(neutral.clone().multiply(new THREE.Quaternion().slerp(delta, gain)));
          object.scale.copy(rest.s.clone().add(object.scale.clone().sub(ref.s).multiplyScalar(gain)));
        } else {
          object.position.lerpVectors(rest.p, object.position, gain);
          object.quaternion.copy(rest.q.clone().slerp(object.quaternion, gain));
          object.scale.lerpVectors(rest.s, object.scale, gain);
        }
      }
      donor.gltf.scene.updateMatrixWorld(true);
      const worlds = canonicalWorlds(donor, frame), hip = new THREE.Vector3().setFromMatrixPosition(worlds.get(profile.semantics.hips));
      firstHip ??= hip.clone();
      const inPlace = inPlaceWorlds(worlds, profile.semantics.hips, restHip, firstHip, fixedAncestors);
      if (profile.kneeForwardOnly === true) kneeCorrections += forwardKnees(body, inPlace, profile.semantics, restWorlds);
      poses.push(localPose(body, inPlace));
    }
  } finally { sampler.dispose(); }
  return { name: role, times, poses, sourceName: clip.name, sourceDuration: clip.duration, hipStartCorrectionY: restHip.y - firstHip.y, boundedNativeGains: profile.nativeGains?.[role] ?? null, firstFrameRelativeToNeutral: profile.nativeFirstFrameRelative === true, relativeBones: profile.nativeRelativeBones ?? null, kneeCorrections };
}

function addAnimation(builder, animation, nodeIDs) {
  const input = builder.accessor(new Float32Array(animation.times), 'SCALAR', { bounds: true }), samplers = [], channels = [];
  for (let j = 0; j < animation.poses[0].length; j++) for (const [property, key, type, size] of [['translation', 'p', 'VEC3', 3], ['rotation', 'q', 'VEC4', 4], ['scale', 's', 'VEC3', 3]]) {
    const values = new Float32Array(animation.times.length * size);
    let previous;
    for (let i = 0; i < animation.poses.length; i++) {
      const value = animation.poses[i][j][key].clone();
      if (key === 'q' && previous && previous.dot(value) < 0) value.set(-value.x, -value.y, -value.z, -value.w);
      value.toArray(values, i * size); previous = value;
    }
    const output = builder.accessor(values, type), sampler = samplers.length;
    samplers.push({ input, output, interpolation: 'LINEAR' });
    channels.push({ sampler, target: { node: nodeIDs.get(animation.poses[0][j].name), path: property } });
  }
  builder.json.animations.push({ name: animation.name, samplers, channels });
}

export async function buildCandidate(sources, profile, { dependencies } = {}) {
  const body = sources.body;
  validateCalibration(profile, sources);
  for (const role of ['walk', 'run']) assertNativeContract(body, sources[role]);
  const sourceReport = inspectRig(body);
  if (sourceReport.triangles > LIMITS.triangles) throw Error(`Source exceeds ${LIMITS.triangles} triangles; no automatic geometry reduction`);
  if (sourceReport.bindError > 0.001) throw Error('Source skin does not reproduce its rest geometry; inspect inverse binds before preparing');
  if (sourceReport.materials !== 1 || body.json.materials[0].alphaMode && body.json.materials[0].alphaMode !== 'OPAQUE') throw Error('Expected one opaque source material');
  const frame = canonicalFrame(worldVertices(body), profile, profile.height), builder = new GLBBuilder(), nodeIDs = new Map();
  const restWorlds = canonicalWorlds(body, frame), restPose = localPose(body, restWorlds);
  for (const [name, values] of Object.entries(profile.idleRotations ?? {})) body.names.get(name).quaternion.fromArray(values);
  body.gltf.scene.updateMatrixWorld(true);
  const idlePose = localPose(body, canonicalWorlds(body, frame)); restoreRest(body);
  const idle = { name: 'idle', times: Array.from({ length: 31 }, (_, i) => i / 30), poses: Array.from({ length: 31 }, () => idlePose) };
  const animations = [idle, ...['walk', 'run'].map(role => bakeNativeClip(body, sources[role], frame, profile, role))];
  const weightRepair = repairWeights(body, frame, profile, equivalentSkinJoints(body, restWorlds, animations));
  for (const pose of restPose) { nodeIDs.set(pose.name, builder.json.nodes.length); builder.json.nodes.push({ name: pose.name, translation: pose.p.toArray(), rotation: pose.q.toArray(), scale: pose.s.toArray(), children: [] }); }
  for (const o of body.objects) {
    const id = nodeIDs.get(body.objectNames.get(o)), parent = nodeIDs.get(body.objectNames.get(o.parent));
    if (parent === undefined) builder.json.scenes[0].nodes.push(id); else builder.json.nodes[parent].children.push(id);
  }
  const joints = body.mesh.skeleton.bones.map(o => nodeIDs.get(body.objectNames.get(o))), ibms = new Float32Array(joints.length * 16);
  body.mesh.skeleton.bones.forEach((o, i) => restWorlds.get(body.objectNames.get(o)).clone().invert().toArray(ibms, i * 16));
  builder.json.skins.push({ name: 'NPCSkin', joints, inverseBindMatrices: builder.accessor(ibms, 'MAT4') });
  const attributes = {}, geometry = body.mesh.geometry, vertices = worldVertices(body), p = new THREE.Vector3();
  const positions = new Float32Array(vertices.length);
  for (let i = 0; i < vertices.length; i += 3) p.fromArray(vertices, i).applyMatrix4(frame.matrix).toArray(positions, i);
  const floorCorrections = profile.floorClearance === true ? groundAnimations(body, positions, restWorlds, animations) : null;
  attributes.POSITION = builder.accessor(positions, 'VEC3', { bounds: true });
  if (!geometry.attributes.normal || !geometry.attributes.uv) throw Error('Expected source normals and color UVs');
  const normalMatrix = new THREE.Matrix3().getNormalMatrix(frame.matrix.clone().multiply(restGeometryMatrix(body))), normals = new Float32Array(positions.length), uvs = new Float32Array(geometry.attributes.position.count * 2);
  for (let i = 0; i < geometry.attributes.position.count; i++) {
    p.fromBufferAttribute(geometry.attributes.normal, i).applyNormalMatrix(normalMatrix).toArray(normals, i * 3);
    uvs[i * 2] = geometry.attributes.uv.getX(i); uvs[i * 2 + 1] = geometry.attributes.uv.getY(i);
  }
  attributes.NORMAL = builder.accessor(normals, 'VEC3'); attributes.TEXCOORD_0 = builder.accessor(uvs, 'VEC2');
  const indexes = new Uint16Array(geometry.attributes.position.count * 4), weights = new Float32Array(indexes.length);
  for (let i = 0; i < geometry.attributes.position.count; i++) {
    let sum = 0; for (let k = 0; k < 4; k++) sum += geometry.attributes.skinWeight.getComponent(i, k);
    for (let k = 0; k < 4; k++) { indexes[i * 4 + k] = geometry.attributes.skinIndex.getComponent(i, k); weights[i * 4 + k] = geometry.attributes.skinWeight.getComponent(i, k) / sum; }
  }
  attributes.JOINTS_0 = builder.accessor(indexes, 'VEC4'); attributes.WEIGHTS_0 = builder.accessor(weights, 'VEC4');
  const triangles = new Uint32Array(geometry.index?.array ?? Array.from({ length: positions.length / 3 }, (_, i) => i));
  const sourceMaterial = body.json.materials[0], colorID = sourceMaterial.pbrMetallicRoughness?.baseColorTexture?.index;
  const imageID = body.json.textures?.[colorID]?.source, image = body.json.images?.[imageID], view = body.json.bufferViews?.[image?.bufferView];
  if (!view || view.extensions || image.mimeType && !['image/png', 'image/jpeg', 'image/webp'].includes(image.mimeType)) throw Error('Expected embedded source color texture');
  if ((sourceMaterial.pbrMetallicRoughness.baseColorTexture.texCoord ?? 0) !== 0 || sourceMaterial.pbrMetallicRoughness.baseColorTexture.extensions) throw Error('Nondefault source color UV mapping requires inspection');
  const deps = dependencies ?? packingDependencies();
  let imageBytes = body.bin.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength);
  if (profile.textureOverride) {
    imageBytes = await textureOverrideBytes(profile.textureOverride);
  }
  const metadata = await deps.sharp(imageBytes).metadata();
  const packedImage = await deps.sharp(imageBytes).resize(1024, 1024, { fit: 'fill' }).removeAlpha().jpeg({ quality: 90, chromaSubsampling: '4:4:4' }).toBuffer();
  builder.json.images = [{ bufferView: builder.view(packedImage), mimeType: 'image/jpeg', name: 'NPCColor1024' }];
  builder.json.textures = [{ source: 0, sampler: 0 }]; builder.json.samplers = [{ magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 10497 }];
  builder.json.materials.push({ name: 'NPCPainted', alphaMode: 'OPAQUE', doubleSided: false, pbrMetallicRoughness: { baseColorFactor: sourceMaterial.pbrMetallicRoughness?.baseColorFactor ?? [1, 1, 1, 1], baseColorTexture: { index: 0 }, metallicFactor: 0, roughnessFactor: 1 } });
  builder.json.meshes.push({ name: 'NPCBody', primitives: [{ attributes, indices: builder.accessor(triangles, 'SCALAR'), material: 0, mode: 4 }] });
  const meshID = builder.json.nodes.length; builder.json.nodes.push({ name: 'NPCBody', mesh: 0, skin: 0 }); builder.json.scenes[0].nodes.push(meshID);
  for (const animation of animations) addAnimation(builder, animation, nodeIDs);
  builder.json.extras = { npcPreparation: { schema: 1, sourceHashes: profile.sources, height: profile.height, axisCalibration: { up: profile.up, forward: profile.forward, footOrigin: profile.footOrigin } } };
  return { bytes: builder.encode(), frame, sourceReport, weightRepair, floorCorrections, animations: animations.map(({ poses, times, ...a }) => ({ ...a, samples: times.length })), texture: { sourceWidth: metadata.width, sourceHeight: metadata.height, sourceBytes: imageBytes.length, override: profile.textureOverride ?? null, finalWidth: 1024, finalHeight: 1024, finalBytes: packedImage.length, encoding: 'JPEG quality 90, 4:4:4', omittedSourceMaps: ['normalTexture', 'occlusionTexture', 'emissiveTexture'].filter(k => sourceMaterial[k]).concat(sourceMaterial.pbrMetallicRoughness?.metallicRoughnessTexture ? ['metallicRoughnessTexture'] : []) } };
}

async function loadSources(options) {
  const result = {};
  for (const role of ['body', 'walk', 'run']) { if (!options[role]) throw Error(`--${role} path required`); result[role] = await loadRig(path.resolve(options[role])); }
  return result;
}

export async function inspectInputs(options) {
  const sources = await loadSources(options), output = await candidateDirectory(options.out ?? path.join(OUTPUT_ROOT, options.family ?? 'inspection'));
  const reports = Object.fromEntries(Object.entries(sources).map(([role, rig]) => [role, inspectRig(rig)]));
  const matches = {};
  for (const role of ['walk', 'run']) { try { assertNativeContract(sources.body, sources[role]); matches[role] = true; } catch (error) { matches[role] = error.message; } }
  const report = { schema: 1, inputs: reports, nativeContracts: matches, status: 'Await inspected source axes, foot origin, anatomy and relaxed idle calibration' };
  const template = { schema: 1, sources: Object.fromEntries(Object.entries(sources).map(([role, rig]) => [role, rig.sha256])), height: 1.72, up: null, forward: null, footOrigin: null, semantics: null, idleRotations: {}, clips: Object.fromEntries(['walk', 'run'].map(role => [role, sources[role].gltf.animations.length === 1 ? sources[role].gltf.animations[0].name : null])) };
  await writeFile(path.join(output, 'source-inspection.json'), JSON.stringify(report, null, 2) + '\n');
  await writeFile(path.join(output, 'calibration-template.json'), JSON.stringify(template, null, 2) + '\n');
  return { output, hashes: template.sources, body: { vertices: reports.body.vertices, triangles: reports.body.triangles, joints: reports.body.joints, bounds: reports.body.bounds }, nativeContracts: matches, status: report.status };
}

export async function calibrateInputs(options) {
  if (!/^[a-z][a-z0-9_-]{0,63}$/.test(options.family ?? '') || !options.calibration) throw Error('calibrate requires --family and hash-pinned inspected --calibration guide');
  const sources = await loadSources(options), guide = JSON.parse(await readFile(options.calibration, 'utf8'));
  validateCalibration(guide, sources);
  const { profile, adapter } = compileCalibration(sources, guide), output = await candidateDirectory(options.out ?? path.join(OUTPUT_ROOT, options.family));
  const calibration = path.join(output, `${options.family}-calibration.json`), contract = path.join(output, `${options.family}-adapter.json`);
  await writeFile(calibration, JSON.stringify(profile, null, 2) + '\n'); await writeFile(contract, JSON.stringify(adapter, null, 2) + '\n');
  return { family: options.family, calibration, adapter: contract, sources: profile.sources, status: 'Calibration measured from this body; prepare and pose QA still required' };
}

export async function prepareInputs(options) {
  if (!/^[a-z][a-z0-9_-]{0,63}$/.test(options.family ?? '')) throw Error('--family requires a simple stable ID');
  if (!options.calibration) throw Error('--calibration requires an inspected, hash-pinned profile');
  const sources = await loadSources(options), profileBytes = await readFile(options.calibration), profile = JSON.parse(profileBytes), deps = packingDependencies(options.deps);
  const result = await buildCandidate(sources, profile, { dependencies: deps }), output = await candidateDirectory(options.out ?? path.join(OUTPUT_ROOT, options.family));
  const unpacked = path.join(output, `${options.family}-unpacked.glb`), candidate = path.join(output, `${options.family}.glb`);
  await writeFile(unpacked, result.bytes);
  await runFile(process.execPath, [deps.gltfpack, '-i', unpacked, '-o', candidate, '-cc', '-kn', '-ke'], { timeout: 120000, maxBuffer: 1024 * 1024 });
  const packed = await loadRig(candidate), audit = auditRig(packed, { height: profile.height, semantics: profile.semantics });
  // Packing must not rename/drop rig nodes or silently change joint ancestry.
  const outputContract = rigContract(packed), expected = rigContract(sources.body);
  const changed = expected.filter(n => { const found = outputContract.find(a => a.name === n.name); return !found || found.parent !== n.parent || found.joint !== n.joint; });
  if (changed.length || outputContract.length !== expected.length) { audit.passed = false; audit.failureCount++; audit.failures.push('Packed rig names/ancestry changed'); }
  for (const role of ['body', 'walk', 'run']) if (sha256(await readFile(options[role])) !== sources[role].sha256) throw Error(`Input changed during preparation: ${role}`);
  if (profile.textureOverride) await textureOverrideBytes(profile.textureOverride);
  const report = { schema: 1, family: options.family, candidate, sha256: packed.sha256, sources: profile.sources, inputPaths: Object.fromEntries(['body', 'walk', 'run'].map(role => [role, path.resolve(options[role])])), calibrationPath: path.resolve(options.calibration), calibrationSHA256: sha256(profileBytes), height: profile.height, source: result.sourceReport, frame: { matrix: result.frame.matrix.toArray(), scale: result.frame.scale, sourceHeight: result.frame.sourceHeight }, weightRepair: result.weightRepair, floorCorrections: result.floorCorrections, texture: result.texture, animations: result.animations, dependencies: { node: process.version, helperProject: deps.project, gltfpack: deps.gltfpack }, audit };
  const reportPath = path.join(output, `${options.family}-qa.json`);
  await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n');
  return { family: options.family, candidate, report: reportPath, sha256: packed.sha256, passed: audit.passed, failures: audit.failures, bytes: packed.bytes.length, triangles: audit.structure.triangles, clips: audit.clips };
}

export function argumentsFrom(argv) {
  const [mode, ...rest] = argv, options = {};
  if (!['inspect', 'calibrate', 'prepare'].includes(mode)) throw Error('Usage: prepare.mjs inspect|calibrate|prepare --body FILE --walk FILE --run FILE [--family ID --calibration JSON --out DIR --deps EXISTING_PROJECT]');
  for (let i = 0; i < rest.length; i += 2) {
    const name = rest[i]?.slice(2), value = rest[i + 1];
    if (!rest[i]?.startsWith('--') || !['body', 'walk', 'run', 'family', 'calibration', 'out', 'deps'].includes(name) || !value || value.startsWith('--') || options[name]) throw Error(`Invalid option: ${rest[i]}`);
    options[name] = value;
  }
  return { mode, options };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { mode, options } = argumentsFrom(process.argv.slice(2));
    const result = await ({ inspect: inspectInputs, calibrate: calibrateInputs, prepare: prepareInputs }[mode](options));
    console.log(JSON.stringify(result)); if (result.passed === false) process.exitCode = 1;
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
