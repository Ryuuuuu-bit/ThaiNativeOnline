// Candidate QA: import validateBossMotionAssets({ type, motionPath, manifestPath? }).
// It always skins the immutable approved PUBLIC BODY, never the donor's geometry.
// Run with BOSS_MOTION_CANDIDATES to require all eight candidate GLBs/manifests.
// Before publication, absent optional overlays are explicitly pending, not approved.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { gltfLoader } from '../src/core/gltf.js';
import { makeMonsterModel } from '../src/combat/MonsterModels.js';
import { BOSS_MOTION_PROFILES, bossMotionClip } from '../src/combat/BossMotion.js';
import { BOSS_SKILLS } from '../src/combat/data/boss-skills.js';
import { disposeCombatModel, markCachedCombatGeometry } from '../src/combat/CombatResources.js';

// Frozen from the prior -animated.json receipts, before the motion-polish work.
export const APPROVED_BOSS_BODIES = Object.freeze({
  chalawan: '1d44ccc84b13b8698390207ddf72bf474252d24ddbe704cbe308dec4ae3afc55',
  bamboo_grave_3: 'b068b44f7159ec28acc3d2a0b96b88539ddd2aed6e5b78db97dcb4e595161b79',
  sealed_mine_3: 'eac366b7efad407cd2201b36c49265ab852acd7fdccb1c2317df4deabfc532dd',
  dusk_fort_3: 'e570992477ed5a48f59382f333b6739f6b01dc0c1c82ddc29697b79b1ca9a36a',
  giant_valley_3: 'bbbb0fc757216a69b1fcfff649e300010e8bf4b007c9f85b6338a7d81d546915',
  himmapan_3: '87187a592ed037f2e3a394db3f8fe7fc484d8b0388eb2dd273ccffd3d80ffd45',
  fallen_city_3: '6fc4a6fad3cb82d4ebfd85ac0e71e99f22598b4fb8e49355c3f748e2fb3c8e0e',
  demon_rift_3: '5f622db6ac315aa0632e5ddc8f2a35a944daff830236fbc8872bb39a3316371a',
});
export const BOSS_MESHY_CLIPS = Object.freeze(['idle-meshy', 'cast-meshy', 'ritual-meshy', 'slash-meshy']);
export const BOSS_MOTION_LIMITS = Object.freeze({ sampleHz: 24, minEdge: .005, ratio: 2,
  extension: .01, armError: .005, feetDrift: .0015, floor: -.01, rigidError: .0001,
  protectedTransformError: .000001 });
const ROOT = new URL('../', import.meta.url);
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const rounded = value => Number.isFinite(value) ? Number(value.toFixed(7)) : String(value);
const distance = (points, a, b) => Math.hypot(points[a * 3] - points[b * 3],
  points[a * 3 + 1] - points[b * 3 + 1], points[a * 3 + 2] - points[b * 3 + 2]);
const matrixDistance = (a, b) => Math.hypot(a[12] - b[12], a[13] - b[13], a[14] - b[14]);
const quaternionError = (a, b) => Math.min(
  Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y), Math.abs(a.z - b.z), Math.abs(a.w - b.w)),
  Math.max(Math.abs(a.x + b.x), Math.abs(a.y + b.y), Math.abs(a.z + b.z), Math.abs(a.w + b.w)));

function glbJSON(bytes) {
  assert.ok(bytes.length >= 20 && bytes.readUInt32LE(0) === 0x46546c67, 'Expected actual GLB bytes');
  assert.equal(bytes.readUInt32LE(4), 2, 'glTF 2 GLB');
  assert.equal(bytes.readUInt32LE(8), bytes.length, 'GLB must be complete');
  assert.equal(bytes.readUInt32LE(16), 0x4e4f534a, 'First chunk must be JSON');
  const length = bytes.readUInt32LE(12); assert.ok(20 + length <= bytes.length);
  const json = JSON.parse(bytes.subarray(20, 20 + length).toString('utf8'));
  assert.ok(!json.buffers?.some(buffer => buffer.uri), 'QA accepts embedded buffers only');
  return json;
}
async function parse(bytes) {
  // Same decoder and SkinnedMesh implementation as the game. Only image decoding
  // is stubbed; positions, indices, weights, inverse binds and bones stay REAL.
  return gltfLoader().register(() => ({ name: 'QA_TEXTURES', loadTexture: () => Promise.resolve(new THREE.Texture()) }))
    .parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
}
function release(gltf) {
  gltf?.scene.traverse(object => {
    if (!object.isMesh) return;
    object.geometry.dispose();
    for (const material of [].concat(object.material)) {
      for (const value of Object.values(material)) if (value?.isTexture) value.dispose();
      material.dispose();
    }
  });
}
async function approvedBody(type) {
  assert.ok(Object.hasOwn(APPROVED_BOSS_BODIES, type), `Not an approved humanoid boss: ${type}`);
  const bytes = await readFile(new URL(`public/models/monsters/${type}.glb`, ROOT));
  const receipt = JSON.parse(await readFile(new URL(`tools/monster-models/meshy/${type}-animated.json`, ROOT), 'utf8'));
  assert.equal(receipt.type, type); assert.equal(receipt.sha256, APPROVED_BOSS_BODIES[type], 'Previous approval receipt changed');
  assert.equal(sha256(bytes), APPROVED_BOSS_BODIES[type], `${type}: approved BODY is immutable`);
  assert.equal(bytes.length, receipt.bytes);
  assert.ok(glbJSON(bytes).extensionsRequired?.includes('EXT_meshopt_compression'), 'Check the compressed approved public body');
  const gltf = await parse(bytes), meshes = [];
  gltf.scene.traverse(object => { if (object.isMesh) meshes.push(object); });
  assert.equal(meshes.length, 1, `${type}: one approved surface`);
  const mesh = meshes[0]; assert.ok(mesh.isSkinnedMesh);
  assert.equal(mesh.skeleton.bones.length, receipt.bones);
  assert.deepEqual(gltf.animations.map(clip => clip.name).sort(), ['attack', 'die', 'hurt', 'idle', 'walk']);
  return { bytes, gltf, mesh };
}

export function bossMotionSampleTimes(clip) {
  assert.ok(Number.isFinite(clip.duration) && clip.duration > 0, `${clip.name}: positive finite duration`);
  const times = new Set([0, clip.duration]);
  for (let frame = 0; frame <= Math.ceil(clip.duration * BOSS_MOTION_LIMITS.sampleHz); frame++) {
    times.add(Math.min(frame / BOSS_MOTION_LIMITS.sampleHz, clip.duration));
  }
  for (const track of clip.tracks) for (const time of track.times) {
    assert.ok(Number.isFinite(time) && time >= 0 && time <= clip.duration, `${clip.name}: invalid exported key time`);
    times.add(Math.max(0, Math.min(time, clip.duration)));
  }
  return [...times].sort((a, b) => a - b);
}

function reference(mesh) {
  const bones = mesh.skeleton.bones, named = new Map(bones.map(bone => [bone.name, bone]));
  assert.equal(named.size, bones.length, 'Unique approved bone names');
  for (const name of ['Root', 'Body', 'Head', 'ArmLUpper', 'ArmLLower', 'HandL', 'ArmRUpper', 'ArmRLower', 'HandR', 'LegLFoot', 'LegRFoot']) {
    assert.ok(named.has(name), `Missing real approved bone ${name}`);
  }
  const transforms = bones.map(bone => ({ bone, position: bone.position.clone(), quaternion: bone.quaternion.clone(), scale: bone.scale.clone() }));
  const position = mesh.geometry.getAttribute('position'), index = mesh.geometry.index;
  assert.ok(index && index.count % 3 === 0, 'Use actual indexed triangles');
  const rest = new Float64Array(position.count * 3), posed = new Float64Array(rest.length), point = new THREE.Vector3();
  mesh.updateWorldMatrix(true, false);
  for (let i = 0; i < position.count; i++) {
    point.fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld);
    assert.ok(Number.isFinite(point.x) && Number.isFinite(point.y) && Number.isFinite(point.z), 'Finite approved bind geometry');
    point.toArray(rest, i * 3);
  }
  const seen = new Set(), edges = [];
  for (let i = 0; i < index.count; i += 3) for (let corner = 0; corner < 3; corner++) {
    let a = index.getX(i + corner), b = index.getX(i + (corner + 1) % 3);
    assert.ok(Number.isInteger(a) && Number.isInteger(b) && a >= 0 && b >= 0 && a < position.count && b < position.count);
    if (a > b) [a, b] = [b, a];
    const key = a * position.count + b;
    if (seen.has(key)) continue; seen.add(key);
    const length = distance(rest, a, b);
    // Keep every actual pair, including UV seams with different weights. Never
    // merge by spatial proximity, average, or substitute synthetic neighbours.
    if (length >= BOSS_MOTION_LIMITS.minEdge) edges.push({ a, b, length });
  }
  assert.ok(edges.length > 0, 'Meaningful indexed edges were checked');
  const arms = bones.filter(bone => /^(Arm[LR](Upper|Lower)|Hand[LR])$/.test(bone.name)).map(bone => {
    assert.ok(bone.parent?.isBone); return { bone, length: matrixDistance(bone.matrixWorld.elements, bone.parent.matrixWorld.elements) };
  });
  const feet = bones.filter(bone => /^Leg[LR]Foot$/.test(bone.name)).map(bone => ({ bone, start: bone.matrixWorld.clone() }));
  assert.equal(feet.length, 2);
  const protectedBones = transforms.filter(item => /Hand|Finger|Thumb|Index|Middle|Ring|Pinky/i.test(item.bone.name));
  const rigid = bones.filter(bone => /^(Club|Sword|Wing[LR])$/.test(bone.name)).map(bone => {
    const owner = bone.name.startsWith('Wing') ? 'Body' : 'HandR';
    assert.equal(bone.parent.name, owner, `Approved ${bone.name} ownership`);
    return { bone: bones.indexOf(bone), owner: bones.indexOf(named.get(owner)) };
  });
  return { named, transforms, rest, posed, point, parentPoint: new THREE.Vector3(), edges, arms, feet, protectedBones, rigid, root: transforms.find(item => item.bone.name === 'Root') };
}

function validateTracks(clips, ref) {
  assert.deepEqual(clips.map(clip => clip.name).sort(), [...BOSS_MESHY_CLIPS].sort(), 'Exactly four optional Meshy clips');
  for (const clip of clips) {
    assert.ok(clip.tracks.length > 0, `${clip.name}: actual animation tracks`);
    const targets = new Set();
    for (const track of clip.tracks) {
      const binding = THREE.PropertyBinding.parseTrackName(track.name);
      assert.ok(!binding.objectName && binding.propertyIndex === undefined, `Direct approved bone track only: ${track.name}`);
      assert.ok(ref.named.has(binding.nodeName), `Track must bind to a REAL approved bone: ${track.name}`);
      assert.ok(['position', 'quaternion', 'scale'].includes(binding.propertyName), `Bone TRS only: ${track.name}`);
      assert.ok(!targets.has(track.name), `Duplicate animation track: ${track.name}`); targets.add(track.name);
      const width = binding.propertyName === 'quaternion' ? 4 : 3;
      const cubic = track.createInterpolant.isInterpolantFactoryMethodGLTFCubicSpline ? 3 : 1;
      assert.ok(track.times.length > 0); assert.equal(track.values.length, track.times.length * width * cubic);
      for (let i = 0; i < track.times.length; i++) {
        assert.ok(Number.isFinite(track.times[i]) && (i === 0 || track.times[i] > track.times[i - 1]), `Increasing finite keys: ${track.name}`);
      }
      for (const value of track.values) assert.ok(Number.isFinite(value), `Finite track component: ${track.name}`);
    }
  }
}

function newMetrics(name, samples = 0) {
  return { name, samples, nonFiniteVertices: 0, edgeViolations: 0, maxRatio: 0,
    maxExtension: 0, armError: 0, feetDrift: 0, floor: Infinity,
    rigidError: 0, handError: 0, rootError: 0, protocolFailures: 0 };
}

// Both direct clips and the production controller use these exact checks.
// Controller placement/height scaling is removed, preserving source metres,
// the original decoded indexed edges, and the unchanged acceptance limits.
function measureSkin(mesh, ref, result, metrics, time, toSource) {
  const point = ref.point;
  for (let i = 0; i < result.vertices; i++) {
    mesh.getVertexPosition(i, point); mesh.localToWorld(point);
    if (toSource) point.applyMatrix4(toSource);
    point.toArray(ref.posed, i * 3);
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y) || !Number.isFinite(point.z)) metrics.nonFiniteVertices++;
    else metrics.floor = Math.min(metrics.floor, point.y);
  }
  for (const edge of ref.edges) {
    const length = distance(ref.posed, edge.a, edge.b), ratio = length / edge.length, extension = length - edge.length;
    if (!Number.isFinite(length)) continue; // The non-finite vertices already fail.
    metrics.maxRatio = Math.max(metrics.maxRatio, ratio); metrics.maxExtension = Math.max(metrics.maxExtension, extension);
    if (ratio > BOSS_MOTION_LIMITS.ratio && extension > BOSS_MOTION_LIMITS.extension) {
      metrics.edgeViolations++;
      if (!result.worstEdge || extension > result.worstEdge.extension) result.worstEdge = { clip: metrics.name, time, a: edge.a, b: edge.b, rest: edge.length, length, ratio, extension };
    }
  }
  const parentPoint = ref.parentPoint;
  for (const arm of ref.arms) {
    point.setFromMatrixPosition(arm.bone.matrixWorld); parentPoint.setFromMatrixPosition(arm.bone.parent.matrixWorld);
    if (toSource) { point.applyMatrix4(toSource); parentPoint.applyMatrix4(toSource); }
    metrics.armError = Math.max(metrics.armError, Math.abs(point.distanceTo(parentPoint) - arm.length));
  }
  for (const foot of ref.feet) {
    point.setFromMatrixPosition(foot.bone.matrixWorld);
    if (toSource) point.applyMatrix4(toSource);
    parentPoint.setFromMatrixPosition(foot.start);
    metrics.feetDrift = Math.max(metrics.feetDrift, point.distanceTo(parentPoint));
  }
  for (const pair of ref.rigid) for (let component = 0; component < 16; component++) {
    metrics.rigidError = Math.max(metrics.rigidError, Math.abs(mesh.skeleton.boneMatrices[pair.bone * 16 + component] - mesh.skeleton.boneMatrices[pair.owner * 16 + component]));
  }
  for (const hand of ref.protectedBones) metrics.handError = Math.max(metrics.handError, quaternionError(hand.bone.quaternion, hand.quaternion));
  metrics.rootError = Math.max(metrics.rootError, ref.root.bone.position.distanceTo(ref.root.position),
    ref.root.bone.scale.distanceTo(ref.root.scale), quaternionError(ref.root.bone.quaternion, ref.root.quaternion));
}

function finishValidation(result, label = 'Motion asset') {
  // No numeric assertion aborts another sample. Compare full precision;
  // rounding is exclusively for the compact report.
  const failures = result.clips.filter(m => m.nonFiniteVertices > 0 || m.edgeViolations > 0 || m.protocolFailures > 0
    || !Number.isFinite(m.armError) || m.armError > BOSS_MOTION_LIMITS.armError
    || !Number.isFinite(m.feetDrift) || m.feetDrift > BOSS_MOTION_LIMITS.feetDrift
    || m.floor < BOSS_MOTION_LIMITS.floor || !Number.isFinite(m.floor)
    || !Number.isFinite(m.rigidError) || m.rigidError > BOSS_MOTION_LIMITS.rigidError
    || !Number.isFinite(m.handError) || m.handError > BOSS_MOTION_LIMITS.protectedTransformError
    || !Number.isFinite(m.rootError) || m.rootError > BOSS_MOTION_LIMITS.protectedTransformError);
  if (failures.length) {
    const error = new Error(`${label} QA failed: ${JSON.stringify(compactBossMotionMetrics(result))}; clips=${failures.map(m => m.name).join(',')}; worstEdge=${JSON.stringify(result.worstEdge && Object.fromEntries(Object.entries(result.worstEdge).map(([key, value]) => [key, typeof value === 'number' ? rounded(value) : value])))}${result.phaseFailures?.length ? `; phases=${JSON.stringify(result.phaseFailures)}` : ''}`);
    error.metrics = result; throw error;
  }
  return result;
}

async function readMotion(type, motionPath, manifestPath) {
  const bytes = await readFile(motionPath), json = glbJSON(bytes);
  for (const key of ['meshes', 'materials', 'textures', 'images']) assert.equal(json[key]?.length ?? 0, 0, `Motion-only GLB cannot contain ${key}`);
  assert.ok(!json.nodes?.some(node => node.mesh !== undefined || node.camera !== undefined), 'Motion nodes cannot carry geometry/cameras');
  assert.ok(!json.extensions?.KHR_lights_punctual, 'No light resources in the motion-only file');
  if (manifestPath) {
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    assert.equal(manifest.type, type); assert.equal(manifest.bodySHA256, APPROVED_BOSS_BODIES[type]);
    assert.equal(manifest.motionSHA256, sha256(bytes));
    assert.deepEqual(manifest.actionIds, [0, 125, 126, 219]);
  }
  const gltf = await parse(bytes);
  gltf.scene.traverse(object => { assert.ok(!object.isMesh, 'Motion scene cannot supply substitute geometry'); });
  return { bytes, gltf };
}

export function compactBossMotionMetrics(result) {
  const metrics = { type: result.type, samples: 0, vertices: result.vertices, edges: result.edges,
    nonFiniteVertices: 0, edgeViolations: 0, maxRatio: 0, maxExtension: 0, armError: 0,
    feetDrift: 0, floor: Infinity, rigidError: 0, handError: 0, rootError: 0, protocolFailures: 0 };
  for (const clip of result.clips) {
    metrics.samples += clip.samples;
    metrics.nonFiniteVertices += clip.nonFiniteVertices; metrics.edgeViolations += clip.edgeViolations;
    metrics.protocolFailures += clip.protocolFailures ?? 0;
    metrics.floor = Math.min(metrics.floor, clip.floor);
    for (const name of ['maxRatio', 'maxExtension', 'armError', 'feetDrift', 'rigidError', 'handError', 'rootError']) metrics[name] = Math.max(metrics[name], clip[name]);
  }
  return Object.fromEntries(Object.entries(metrics).map(([name, value]) => [name, typeof value === 'number' ? rounded(value) : value]));
}

export async function validateBossMotionAssets({ type, motionPath = new URL(`public/models/monsters/motions/${type}.glb`, ROOT), manifestPath } = {}) {
  const body = await approvedBody(type);
  let motion;
  try {
    const library = await readMotion(type, motionPath, manifestPath);
    const motionBytes = library.bytes; motion = library.gltf;
    const { gltf, mesh } = body; gltf.scene.updateMatrixWorld(true); mesh.skeleton.update();
    const ref = reference(mesh); validateTracks(motion.animations, ref);
    const result = { type, bodySHA256: APPROVED_BOSS_BODIES[type], motionSHA256: sha256(motionBytes),
      vertices: mesh.geometry.attributes.position.count, edges: ref.edges.length, clips: [], worstEdge: null };
    const mixer = new THREE.AnimationMixer(gltf.scene);
    for (const clip of motion.animations) {
      mixer.stopAllAction();
      for (const original of ref.transforms) {
        original.bone.position.copy(original.position); original.bone.quaternion.copy(original.quaternion); original.bone.scale.copy(original.scale);
      }
      const action = mixer.clipAction(clip).reset().setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true; action.play();
      const times = bossMotionSampleTimes(clip), metrics = newMetrics(clip.name, times.length);
      for (const time of times) {
        mixer.setTime(Math.max(0, Math.min(time, clip.duration)));
        gltf.scene.updateMatrixWorld(true); mesh.skeleton.update();
        measureSkin(mesh, ref, result, metrics, time);
      }
      result.clips.push(metrics);
    }
    mixer.stopAllAction(); mixer.uncacheRoot(gltf.scene);
    return finishValidation(result);
  } finally { release(motion); release(body.gltf); }
}

function phaseTimes(duration, boundaries = []) {
  const times = new Set([0, duration, ...boundaries]);
  for (let frame = 0; frame <= Math.ceil(duration * BOSS_MOTION_LIMITS.sampleHz); frame++) {
    times.add(Math.min(duration, frame / BOSS_MOTION_LIMITS.sampleHz));
  }
  return [...times].filter(time => time >= 0 && time <= duration).sort((a, b) => a - b);
}

export async function validateBossMotionController({ type,
  motionPath = new URL(`public/models/monsters/motions/${type}.glb`, ROOT), manifestPath } = {}) {
  const body = await approvedBody(type);
  let motion, group;
  try {
    const library = await readMotion(type, motionPath, manifestPath); motion = library.gltf;
    body.gltf.scene.updateMatrixWorld(true); body.mesh.skeleton.update();
    const original = reference(body.mesh); validateTracks(motion.animations, original);
    markCachedCombatGeometry(body.gltf.scene);
    let bodyLoads = 0, motionLoads = 0;
    group = makeMonsterModel(type, new THREE.Group(), 'qa', {
      loadModel: url => { assert.equal(url, `/models/monsters/${type}.glb`); bodyLoads++; return body.gltf; },
      loadMotions: url => { assert.equal(url, `/models/monsters/motions/${type}.glb`); motionLoads++; return motion; },
    });
    const model = await group.userData.ready;
    assert.ok(model && group.userData.modelLoaded, 'Production body must actually load');
    assert.equal(await group.userData.motionsReady, true, 'Production motion library must actually install');
    assert.deepEqual([bodyLoads, motionLoads], [1, 1]);
    group.updateMatrixWorld(true);
    const meshes = []; model.traverse(object => { if (object.isMesh) meshes.push(object); });
    assert.equal(meshes.length, 1); const mesh = meshes[0]; assert.ok(mesh.isSkinnedMesh);
    assert.equal(mesh.geometry, body.mesh.geometry, 'Controller must use the approved body geometry');
    assert.deepEqual(mesh.skeleton.bones.map(bone => bone.name), body.mesh.skeleton.bones.map(bone => bone.name));
    const named = new Map(mesh.skeleton.bones.map(bone => [bone.name, bone]));
    const rebind = item => ({ ...item, bone: named.get(item.bone.name) });
    const ref = { ...original, named, transforms: original.transforms.map(rebind),
      arms: original.arms.map(rebind), feet: original.feet.map(rebind),
      protectedBones: original.protectedBones.map(rebind), root: rebind(original.root) };
    // The production pivot scales/centres/faces the clone. Invert ONLY that
    // fixed placement; skinning, animation weights, bones and crossfades remain
    // the real controller's. Compare to the exact approved source bind floats.
    const toSource = body.gltf.scene.matrixWorld.clone().multiply(model.matrixWorld.clone().invert());
    const result = { type, bodySHA256: APPROVED_BOSS_BODIES[type], motionSHA256: sha256(library.bytes),
      vertices: mesh.geometry.attributes.position.count, edges: ref.edges.length,
      sampleHz: BOSS_MOTION_LIMITS.sampleHz, coordinateSpace: 'approved-body source metres',
      clips: [], worstEdge: null, phaseFailures: [] };
    const profile = BOSS_MOTION_PROFILES[type], skills = BOSS_SKILLS[type];
    assert.equal(skills.length, 2, 'Both actual production skills are exercised');
    let clock = 0;
    group.userData.animate(clock, false, false);
    for (let skillIndex = 0; skillIndex < skills.length; skillIndex++) {
      const skill = skills[skillIndex], cast = { ...skill, serial: skillIndex + 1, remaining: skill.windup };
      const clipName = bossMotionClip(type, cast), clip = motion.animations.find(item => item.name === clipName);
      assert.ok(clip, `Actual production skill ${skill.id} has its optional ${clipName}`);
      const metrics = newMetrics(`${skill.id}/${clipName}`);
      metrics.phaseSamples = {}; result.clips.push(metrics);
      const check = (condition, message, time, state) => {
        if (condition) return;
        metrics.protocolFailures++;
        if (result.phaseFailures.length < 8) result.phaseFailures.push({ skill: skill.id, time, message, ...state });
      };
      const sample = (time, state = {}) => {
        group.userData.animate(time, false, false, state);
        group.updateMatrixWorld(true); mesh.skeleton.update();
        metrics.samples++; measureSkin(mesh, ref, result, metrics, time, toSource);
        const status = { ...group.userData.animationState() };
        metrics.phaseSamples[status.phase] = (metrics.phaseSamples[status.phase] ?? 0) + 1;
        return status;
      };
      // Let the real idle fade settle, without setting mixer weights ourselves.
      const idleStart = clock;
      for (const time of phaseTimes(.15, [profile.blendSeconds])) sample(idleStart + time);
      clock += .15;
      check(group.userData.bossMotionEvent({ stage: 'windup', cast }), 'Windup event rejected', clock);
      const windupStart = clock;
      for (const elapsed of phaseTimes(skill.windup + .2, [profile.blendSeconds, skill.windup, skill.windup + .12])) {
        cast.remaining = Math.max(0, skill.windup - elapsed);
        const state = sample(windupStart + elapsed, { bossCast: cast });
        const expectedPhase = elapsed >= skill.windup ? 'hold' : 'windup';
        const expectedTime = clip.duration * profile.holdFraction * Math.min(1, elapsed / skill.windup);
        check(state.phase === expectedPhase && state.clip === clipName && state.castSerial === cast.serial,
          'Windup/hold released early or selected the wrong clip', elapsed, state);
        check(Number.isFinite(state.clipTime) && Math.abs(state.clipTime - expectedTime) <= 1e-6,
          'Fresh remaining was double-counted or hold advanced', elapsed, state);
      }
      clock = windupStart + skill.windup + .2;
      check(group.userData.bossMotionEvent({ stage: 'impact', cast }), 'Authoritative impact rejected', clock);
      const impactStart = clock;
      // Include both sides of phase boundaries. 1e-8 s distinguishes the
      // inclusive release endpoint from recovery without a float-rounding
      // false failure at exactly the summed recovery timestamp.
      for (const elapsed of phaseTimes(profile.recoverySeconds + .15,
        [profile.releaseSeconds, profile.releaseSeconds + 1e-8, profile.recoverySeconds,
          profile.recoverySeconds + 1e-8, profile.recoverySeconds + profile.blendSeconds])) {
        const state = sample(impactStart + elapsed);
        if (elapsed < profile.recoverySeconds - 1e-8) {
          const expectedPhase = elapsed < profile.releaseSeconds - 1e-8 ? 'release'
            : elapsed > profile.releaseSeconds + 1e-9 ? 'recovery' : null;
          check((expectedPhase ? state.phase === expectedPhase : ['release', 'recovery'].includes(state.phase))
            && state.clip === clipName && state.castSerial === cast.serial,
          'Authoritative release/recovery selected the wrong phase', elapsed, state);
          const fraction = elapsed <= profile.releaseSeconds
            ? THREE.MathUtils.lerp(profile.holdFraction, profile.peakFraction, elapsed / profile.releaseSeconds)
            : THREE.MathUtils.lerp(profile.peakFraction, 1, (elapsed - profile.releaseSeconds) / (profile.recoverySeconds - profile.releaseSeconds));
          check(Number.isFinite(state.clipTime) && Math.abs(state.clipTime - fraction * clip.duration) <= 1e-6,
            'Controller skipped or rewound release/recovery', elapsed, state);
        } else if (elapsed >= profile.recoverySeconds + 1e-9) {
          check(state.phase === 'none' && state.clip === 'idle-meshy', 'Recovery did not return to optional idle', elapsed, state);
        }
      }
      clock = impactStart + profile.recoverySeconds + .15;
    }
    return finishValidation(result, 'Production controller');
  } finally {
    if (group) disposeCombatModel(group);
    release(motion); release(body.gltf);
  }
}

// Importing the candidate helper does not schedule production tests or print TAP.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const types = Object.keys(APPROVED_BOSS_BODIES);
  const candidateDirectory = process.env.BOSS_MOTION_CANDIDATES;
  const motionDirectory = candidateDirectory ? resolve(candidateDirectory) : process.env.BOSS_MESHY_MOTION_DIR
    ? resolve(process.env.BOSS_MESHY_MOTION_DIR) : fileURLToPath(new URL('public/models/monsters/motions/', ROOT));
  const paths = types.map(type => resolve(motionDirectory, `${type}${candidateDirectory ? '-motion' : ''}.glb`));
  const manifests = types.map(type => candidateDirectory ? resolve(motionDirectory, `${type}-motion-manifest.json`)
    : fileURLToPath(new URL(`tools/monster-models/meshy/motions/${type}-motion-manifest.json`, ROOT)));
  const publicationStarted = !!candidateDirectory || !!process.env.BOSS_MESHY_MOTION_DIR || paths.some(path => existsSync(path));
  for (const type of types) test(`Approved ${type}: original body/receipt remain immutable`, async () => {
    const body = await approvedBody(type); release(body.gltf);
  });
  test('Eight Meshy motion-only overlays pass every exported key and clamped 24 Hz sample', async t => {
    if (!publicationStarted) { t.skip('No optional motion GLBs published yet; use validateBossMotionAssets on candidate paths, then freeze the production manifest'); return; }
    for (const path of paths) assert.ok(existsSync(path), `Partial motion publication: missing ${path}`);
    for (let i = 0; i < types.length; i++) await t.test(types[i], async sub => {
      const result = await validateBossMotionAssets({ type: types[i], motionPath: paths[i], manifestPath: manifests[i] });
      sub.diagnostic(JSON.stringify(compactBossMotionMetrics(result)));
    });
  });
  test('Production controller: both real skills retain safe skins through windup, hold, impact and recovery at 24 Hz', async t => {
    if (candidateDirectory || !publicationStarted) {
      t.skip('Controller QA waits for production publication; candidate clip QA remains separate'); return;
    }
    for (const path of paths) assert.ok(existsSync(path), `Partial motion publication: missing ${path}`);
    for (let i = 0; i < types.length; i++) await t.test(types[i], async sub => {
      const result = await validateBossMotionController({ type: types[i], motionPath: paths[i], manifestPath: manifests[i] });
      sub.diagnostic(JSON.stringify({ ...compactBossMotionMetrics(result), sampleHz: result.sampleHz, coordinateSpace: result.coordinateSpace }));
    });
  });
}
