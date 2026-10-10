import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { NPC } from '../src/entities/NPC.js';
import { makeLook } from '../src/npc/NPCData.js';
import { NPCS } from '../src/data/npcs.js';
import { npcsForMap } from '../src/world/maps.js';
import { NPCRenderer } from '../src/npc/NPCRenderer.js';
import { NPCModelRenderer } from '../src/npc/NPCModelRenderer.js';
import { RIG } from '../src/npc/body/rig.js';
import { GEAR_PARTS } from '../src/npc/body/gearParts.js';
import { NPC_MODELS, NPC_MODEL_IDS, npcModelSpec, npcAccessoryParts, createNPCModelCache, registerNPCPoseAdapter,
  createMeshy24NPCPoseAdapter, registerMeshy24NPCPoseAdapter, npcHandContactTransform, loadNPCModelSource,
  registerNPCModelProfiles, npcModelProfile, registerBundledNPCModelProfiles, createProfiledNPCModelCache, NPC_ROLE_MOTION } from '../src/npc/NPCModels.js';

const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} vs ${b}`);

function sourceFixture() {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, -.4, 2, 0, .4, 2, 0, 0, 1, .2], 3));
  geometry.setIndex([0, 1, 2, 1, 2, 3]);
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(Array(16).fill(0), 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], 4));
  const texture = new THREE.Texture(), material = new THREE.MeshStandardMaterial({ map: texture });
  const mesh = new THREE.SkinnedMesh(geometry, material), head = new THREE.Bone(); head.name = 'MeasuredHead'; head.position.y = 1;
  mesh.add(head); mesh.bind(new THREE.Skeleton([head]));
  const scene = new THREE.Group(); scene.add(mesh); scene.updateMatrixWorld(true);
  const animations = ['idle', 'walk', 'run'].map((name, i) => {
    const q = a => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), a).toArray();
    return new THREE.AnimationClip(name, 1, [new THREE.QuaternionKeyframeTrack('MeasuredHead.quaternion', [0, .5, 1], [...q(.05), ...q((i + 1) * .3), ...q(.05)])]);
  });
  return { scene, animations, geometry, material, texture, mesh };
}

function npcFixture(id = 'warp_city_market', props = []) {
  const def = NPCS.find(n => n.id === id) ?? { id, occupation: 'villager' };
  const npc = new NPC(def, { ...makeLook(def), props, hat: null, scale: 1 }, {});
  Object.assign(npc, { shown: true, dirty: true, x: 4, y: .3, z: -7, yaw: .7, seed: 0 });
  return npc;
}

// Axes here describe this synthetic fixture, never a guessed Meshy skeleton.
const fixtureAdapter = (model) => ({
  supports: c => c.state !== 'sit',
  apply: c => { const head = model.getObjectByName('MeasuredHead'); head.rotation.y += c.pose.headYaw; },
});
const silent = () => {};
const matrixFor = (part, npc) => { const i = part.entries.findIndex(e => e.npc === npc); if (i < 0) return null; const m = new THREE.Matrix4(); part.mesh.getMatrixAt(i, m); return m; };

test('17 families match all 34 explicit director IDs; ambient and field roles stay instanced', () => {
  const brief = JSON.parse(readFileSync(new URL('../docs/art/npcs/NPC_MODEL_BRIEFS.json', import.meta.url), 'utf8'));
  const expected = Object.fromEntries(brief.families.flatMap(f => f.npcIds.map(id => [id, f.id])));
  assert.deepEqual(NPC_MODEL_IDS, expected);
  assert.equal(Object.keys(NPC_MODELS).length, 17); assert.equal(Object.keys(NPC_MODEL_IDS).length, 34);
  for (const [id, family] of Object.entries(NPC_MODEL_IDS)) {
    const actual = NPCS.find(n => n.id === id); assert.ok(actual, id);
    assert.equal(npcModelSpec(actual).family, family);
    assert.equal(npcModelSpec({ ...actual, map: 'paddy' })?.family ?? null, ['guard_gate_w', 'guard_gate_e'].includes(id) ? family : null);
  }
  for (const family of brief.families) assert.equal(NPC_MODELS[family.id].height, family.targetWorldBodyHeightMeters);
  const visitors = npcsForMap(NPCS, 'paddy', () => false).filter(n => ['guard_gate_w', 'guard_gate_e'].includes(n.id));
  assert.equal(visitors.length, 2); for (const n of visitors) assert.equal(npcModelSpec(n).family, 'city_guard');
  assert.equal(npcModelSpec({ id: 'ambient_guard', occupation: 'guard', faction: 'city_guard' }), null);
  for (const id of ['shopper_a', 'cargo_merchant', 'village_trader', 'forest_herbalist', 'warp_paddy', 'warp_demon_rift']) assert.equal(npcModelSpec(NPCS.find(n => n.id === id)), null, id);
  assert.equal(npcModelSpec(NPCS.find(n => n.id === 'monk_young')).family, 'monk_novice');
  assert.equal(npcModelSpec(NPCS.find(n => n.id === 'monk_teacher')).family, 'monk_elder');
});

test('pending load keeps the whole fallback; native pose is evaluated before a late walking model becomes visible', async () => {
  const pending = deferred(), npc = npcFixture(), scene = new THREE.Scene(), ambient = npcFixture('shopper_a'); let calls = 0;
  const renderer = new NPCRenderer(scene, [npc, ambient], { loadModel: () => { calls++; return pending.promise; }, createAdapter: fixtureAdapter, onError: silent });
  renderer.update(.1, .1);
  assert.ok(renderer.parts.every(p => !matrixFor(p, npc) || matrixFor(p, npc).determinant() !== 0));
  npc.state = 'walk'; npc.path = []; npc.walkPhase = Math.PI / 2;
  pending.resolve(sourceFixture()); await renderer.ready;
  const entry = renderer.modelRenderer.entries.get(npc);
  assert.equal(calls, 1); assert.equal(entry.root.visible, false);
  renderer.update(.1, .5);
  assert.equal(entry.root.visible, true); assert.equal(entry.phase, 'walk'); close(entry.actions.walk.time, .25);
  assert.notDeepEqual(entry.model.getObjectByName('MeasuredHead').quaternion.toArray(), [0, 0, 0, 1]);
  for (const p of renderer.parts) { const m = matrixFor(p, npc); if (m) assert.equal(m.determinant(), 0, p.name); }
  assert.ok(renderer.parts.some(p => matrixFor(p, ambient)?.determinant() !== 0));
  assert.equal(scene.children.filter(o => o.name === `npc-model:${npc.id}`).length, 1);
  renderer.dispose();
});

test('load failure is contained and keeps original body, clothes and props', async () => {
  const npc = npcFixture('blacksmith', ['hammer', 'apron']), errors = [];
  const renderer = new NPCRenderer(new THREE.Scene(), [npc], { loadModel: async () => { throw Error('missing asset'); }, onError: (_, e) => errors.push(e.message) });
  await renderer.ready; renderer.update(.1, .5);
  assert.equal(renderer.modelRenderer.status(npc).reason, 'load-failed'); assert.deepEqual(errors, ['missing asset']);
  for (const part of renderer.parts) assert.notEqual(matrixFor(part, npc).determinant(), 0);
  renderer.dispose();
});

test('native idle/walk/run are required; missing locomotion never displays bind A/T pose', async () => {
  for (const missing of ['idle', 'walk', 'run']) {
    const source = sourceFixture(); source.animations = source.animations.filter(c => c.name !== missing);
    const npc = npcFixture(), scene = new THREE.Scene();
    const renderer = new NPCModelRenderer(scene, [npc], { loadModel: async () => source, createAdapter: fixtureAdapter, onError: silent });
    await renderer.ready; renderer.update(.1, .5);
    assert.equal(renderer.isActive(npc), false); assert.match(renderer.status(npc).error, new RegExp(missing)); assert.equal(scene.children.length, 0);
    renderer.dispose();
  }
});

test('uncalibrated rigs and unsupported seated activities retain fallback without lowering an unposed GLB', async () => {
  const npc = npcFixture(), renderer = new NPCModelRenderer(new THREE.Scene(), [npc], { loadModel: async () => sourceFixture(), onError: silent });
  await renderer.ready; renderer.update(.1, .5); assert.equal(renderer.status(npc).reason, 'needs-rig-adapter'); assert.equal(renderer.isActive(npc), false);
  renderer.dispose();
  const seated = new NPCModelRenderer(new THREE.Scene(), [npc], { loadModel: async () => sourceFixture(), createAdapter: fixtureAdapter, onError: silent });
  await seated.ready; npc.state = 'sit'; npc.pose.y = -.68; seated.update(.1, .5);
  assert.equal(seated.status(npc).reason, 'unsupported-pose'); assert.equal(seated.entries.get(npc).root.visible, false);
  seated.dispose();
});

test('measured adapter may be registered after a source has loaded, without another download or clone', async () => {
  const npc = npcFixture('general_merchant'); let loads = 0;
  const renderer = new NPCModelRenderer(new THREE.Scene(), [npc], { loadModel: async () => { loads++; return sourceFixture(); }, onError: silent });
  await renderer.ready; const model = renderer.entries.get(npc).model;
  const unregister = registerNPCPoseAdapter('general_merchant', fixtureAdapter);
  try { renderer.update(.1, .5); assert.equal(renderer.isActive(npc), true); assert.equal(renderer.entries.get(npc).model, model); assert.equal(loads, 1); }
  finally { unregister(); renderer.dispose(); }
});

test('world placement preserves terrain height, yaw, look scale and calibrated seated offset; talking pauses locomotion', async () => {
  const npc = npcFixture(); npc.look.scale = 1.1; npc.pose.y = -.68; npc.state = 'sit'; npc.pose.headYaw = .2;
  const renderer = new NPCModelRenderer(new THREE.Scene(), [npc], { loadModel: async () => sourceFixture(), createAdapter: model => ({ ...fixtureAdapter(model), supports: () => true,
    normalization: { sourceHeight: 2, footOrigin: [0, 0, 0], facingYaw: 0 } }), onError: silent });
  await renderer.ready; renderer.update(.1, .5); const e = renderer.entries.get(npc);
  assert.deepEqual(e.root.position.toArray(), [npc.x, npc.y, npc.z]); close(e.root.rotation.y, npc.yaw); close(e.root.scale.x, 1.1); close(e.poseRoot.position.y, -.68);
  close(e.root.userData.normalization.targetHeight, 1.72);
  close(e.scale.scale.y * e.root.scale.y * 2, 1.72); // look scale is compensated, not applied twice.
  npc.state = 'walk'; npc.path = []; npc.anim = 'run'; npc.pose.y = 0; npc.walkPhase = Math.PI;
  renderer.update(.1, .6); assert.equal(e.phase, 'run'); close(e.actions.run.time, .5);
  npc.talkTarget = { x: 3, z: 2 }; renderer.update(.1, .7); assert.equal(e.phase, 'idle'); assert.equal(e.context.state, 'talk');
  assert.equal(npc.path.length, 0); assert.equal(npc.state, 'walk'); // presentation did not change the schedule.
  npc.shown = false; renderer.update(.1, .8); assert.equal(e.root.visible, false); assert.equal(renderer.isActive(npc), false);
  renderer.dispose();
});

test('blacksmith baked apron is suppressed only while the model is active; measured hammer/headband remain', async () => {
  const npc = npcFixture('blacksmith', ['hammer', 'apron']);
  npc.look.hat = 'headband';
  const pending = deferred();
  const renderer = new NPCRenderer(new THREE.Scene(), [npc], { loadModel: () => pending.promise, createAdapter: model => ({
    ...fixtureAdapter(model), proceduralParts: ['hammer', 'apron', 'headband'],
    propFrames: c => ({ foreR: c.model.getObjectByName('MeasuredHead').matrixWorld.clone().multiply(new THREE.Matrix4().makeTranslation(.1, -.3, 0)),
      upper: c.root.matrixWorld.clone(), head: c.model.getObjectByName('MeasuredHead').matrixWorld.clone() }),
  }), onError: silent });
  renderer.update(.1, .1);
  const apron = renderer.parts.find(p => p.name === 'apron');
  assert.notEqual(matrixFor(apron, npc).determinant(), 0); // pending fallback
  pending.resolve(sourceFixture()); await renderer.ready; renderer.update(.1, .5);
  assert.equal(renderer.modelRenderer.isActive(npc), true);
  for (const part of renderer.parts) assert.equal(matrixFor(part, npc).determinant() === 0, !['hammer', 'headband'].includes(part.name), part.name);
  const e = renderer.modelRenderer.entries.get(npc), expected = e.model.getObjectByName('MeasuredHead').matrixWorld.clone().multiply(new THREE.Matrix4().makeTranslation(.1, -.3, 0));
  assert.deepEqual(matrixFor(renderer.parts.find(p => p.name === 'hammer'), npc).elements, expected.elements.map(Math.fround));
  npc.state = 'sit'; npc.dirty = true; renderer.update(.1, .6);
  assert.equal(renderer.modelRenderer.isActive(npc), false);
  assert.notEqual(matrixFor(apron, npc).determinant(), 0); // unsupported-pose fallback
  renderer.dispose();
});

test('baked accessories are family-specific part IDs; unverified muay headwear is retained', () => {
  assert.deepEqual(NPC_MODELS.warp_keeper.bakedAccessories, ['clothHat']);
  assert.deepEqual(NPC_MODELS.blacksmith.bakedAccessories, ['apron']);
  assert.deepEqual(NPC_MODELS.master_muay.bakedAccessories, []);
  const muay = npcFixture('master_muay'); muay.look.hat = 'mongkol';
  assert.ok(npcAccessoryParts(muay, NPC_MODELS.master_muay).has('mongkol'));
  const enhancer = npcFixture('enhancer', ['hammer', 'apron']); enhancer.look.hat = 'headbandRed';
  assert.deepEqual([...npcAccessoryParts(enhancer, NPC_MODELS.enhancer)], ['hammer', 'apron', 'headband']);
  // Future verified metadata suppresses only named parts, without a global rule
  // or an adapter socket becoming necessary for the already baked accessory.
  assert.deepEqual([...npcAccessoryParts(enhancer, { ...NPC_MODELS.enhancer, bakedAccessories: ['apron', 'headband'] })], ['hammer']);
});

test('a baked apron needs no retained upper socket and creates no second body/accessory mesh', async () => {
  const npc = npcFixture('blacksmith', ['apron']), scene = new THREE.Scene();
  const renderer = new NPCRenderer(scene, [npc], { loadModel: async () => sourceFixture(), createAdapter: fixtureAdapter, onError: silent });
  const initialMeshCount = scene.children.filter(o => o.isMesh).length;
  await renderer.ready; renderer.update(.1, .5);
  assert.equal(renderer.modelRenderer.isActive(npc), true);
  assert.equal(renderer.modelRenderer.entries.get(npc).visibleParts.size, 0);
  assert.equal(matrixFor(renderer.parts.find(p => p.name === 'apron'), npc).determinant(), 0);
  assert.equal(scene.children.filter(o => o.isMesh).length, initialMeshCount);
  assert.equal(scene.children.filter(o => o.name === `npc-model:${npc.id}`).length, 1);
  renderer.dispose();
});

test('shared supplier body retains only each ID own basket; keeper baked wrap suppresses old hat', async () => {
  const keeper = npcFixture(); keeper.look.hat = 'cloth';
  const supplier = npcFixture('gate_supplier', ['basket']), rice = npcFixture('vendor_rice');
  const source = sourceFixture(); const cache = createNPCModelCache(async () => source);
  const renderer = new NPCRenderer(new THREE.Scene(), [keeper, supplier, rice], { loadModel: s => cache.load(s), createAdapter: model => ({
    ...fixtureAdapter(model), proceduralParts: ['basket', 'clothHat'],
    propFrames: c => ({ foreL: c.model.getObjectByName('MeasuredHead').matrixWorld.clone(), head: c.model.getObjectByName('MeasuredHead').matrixWorld.clone() }),
  }), onError: silent });
  await renderer.ready; renderer.update(.1, .5);
  for (const n of [keeper, supplier, rice]) assert.equal(renderer.modelRenderer.isActive(n), true);
  assert.equal(matrixFor(renderer.parts.find(p => p.name === 'clothHat'), keeper).determinant(), 0);
  const basket = renderer.parts.find(p => p.name === 'basket'); assert.notEqual(matrixFor(basket, supplier).determinant(), 0); assert.equal(matrixFor(basket, rice), null);
  assert.equal(renderer.modelRenderer.partVisible(rice, 'basket'), false);
  renderer.dispose(); cache.dispose();
});

test('novice height is 1.2m at world scale and its separate bowl remains eligible', async () => {
  const npc = npcFixture('monk_young'); npc.look.scale = 1.04;
  const renderer = new NPCModelRenderer(new THREE.Scene(), [npc], { loadModel: async () => sourceFixture(), createAdapter: model => ({
    ...fixtureAdapter(model), proceduralParts: ['bowl'], normalization: { sourceHeight: 2, footOrigin: [0, 0, 0], facingYaw: 0 },
    propFrames: c => ({ upper: c.root.matrixWorld.clone() }),
  }), onError: silent });
  await renderer.ready; renderer.update(.1, .5); const e = renderer.entries.get(npc);
  assert.equal(renderer.isActive(npc), true); close(e.scale.scale.y * e.root.scale.y * 2, 1.2); assert.equal(renderer.partVisible(npc, 'bowl'), true); renderer.dispose();
});

test('incompatible or absent tool frames fail back to complete procedural NPC, never floating props', async () => {
  for (const frames of [false, true]) {
    const npc = npcFixture('blacksmith', ['hammer']);
    const renderer = new NPCModelRenderer(new THREE.Scene(), [npc], { loadModel: async () => sourceFixture(), createAdapter: model => ({
      ...fixtureAdapter(model), proceduralParts: frames ? ['hammer'] : [],
    }), onError: silent });
    await renderer.ready; renderer.update(.1, .5);
    assert.equal(renderer.isActive(npc), false); assert.equal(renderer.entries.get(npc).root.visible, false);
    assert.equal(renderer.status(npc).reason, frames ? 'pose-failed' : 'needs-prop-adapter'); renderer.dispose();
  }
});

test('shared cached source yields isolated skeletons/material arrays while retaining source geometry and textures', async () => {
  const source = sourceFixture(); source.mesh.material = [source.material, source.material]; let loads = 0;
  const cache = createNPCModelCache(async () => { loads++; return source; });
  const a = npcFixture('guard_port'), b = npcFixture('guard_market');
  const renderer = new NPCModelRenderer(new THREE.Scene(), [a, b], { loadModel: s => cache.load(s), createAdapter: fixtureAdapter, onError: silent });
  await renderer.ready; renderer.update(.1, .5);
  const ma = renderer.entries.get(a).model.children[0], mb = renderer.entries.get(b).model.children[0];
  assert.equal(loads, 1); assert.equal(ma.geometry, source.geometry); assert.equal(mb.geometry, source.geometry);
  assert.notEqual(ma.skeleton, mb.skeleton); assert.notEqual(ma.skeleton, source.mesh.skeleton); assert.notEqual(ma.material[0], mb.material[0]);
  assert.equal(ma.material[0], ma.material[1]); assert.equal(ma.material[0].map, source.texture);
  const unaffected = mb.skeleton.bones[0].quaternion.toArray(); ma.skeleton.bones[0].rotation.y += .3;
  assert.deepEqual(mb.skeleton.bones[0].quaternion.toArray(), unaffected);
  let geometryDisposed = 0, textureDisposed = 0, materialDisposed = 0, instanceDisposed = 0, skeletonDisposed = 0;
  source.geometry.addEventListener('dispose', () => geometryDisposed++); source.texture.addEventListener('dispose', () => textureDisposed++);
  source.material.addEventListener('dispose', () => materialDisposed++); ma.material[0].addEventListener('dispose', () => instanceDisposed++);
  const original = ma.skeleton.dispose.bind(ma.skeleton); ma.skeleton.dispose = () => { skeletonDisposed++; original(); };
  renderer.dispose(); renderer.dispose();
  assert.equal(instanceDisposed, 1); assert.equal(skeletonDisposed, 1); assert.equal(geometryDisposed, 0); assert.equal(textureDisposed, 0); assert.equal(materialDisposed, 0);
  cache.dispose(); cache.dispose(); assert.equal(geometryDisposed, 1); assert.equal(textureDisposed, 1); assert.equal(materialDisposed, 1);
});

test('map disposal before load completion prevents any late model, mixer, adapter or fallback resurrection', async () => {
  const pending = deferred(), npc = npcFixture(), scene = new THREE.Scene(); let adapters = 0;
  const renderer = new NPCRenderer(scene, [npc], { loadModel: () => pending.promise, createAdapter: model => { adapters++; return fixtureAdapter(model); }, onError: silent });
  renderer.dispose(); pending.resolve(sourceFixture()); await renderer.ready; renderer.update(.1, .5);
  assert.equal(scene.children.length, 0); assert.equal(adapters, 0); assert.equal(renderer.parts.length, 0);
});

test('cache can recover a failed request and disposes a late source exactly once after shutdown', async () => {
  let calls = 0; const source = sourceFixture(); const cache = createNPCModelCache(async () => { if (++calls === 1) throw Error('offline'); return source; });
  await assert.rejects(cache.load(NPC_MODELS.warp_keeper), /offline/); assert.equal(cache.size, 0);
  assert.equal(await cache.load(NPC_MODELS.warp_keeper), source); assert.equal(calls, 2); cache.dispose();
  const pending = deferred(), late = sourceFixture(), other = createNPCModelCache(() => pending.promise); let released = 0;
  late.geometry.addEventListener('dispose', () => released++);
  const task = other.load(NPC_MODELS.warp_keeper); other.dispose(); pending.resolve(late);
  await assert.rejects(task, /disposed/); other.dispose(); assert.equal(released, 1);
});

test('partial preparation failure never disposes unvisited meshes shared source materials', async () => {
  const source = sourceFixture(); source.geometry.attributes.position.setX(0, NaN);
  const extra = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial()); source.scene.add(extra);
  let originalDisposed = 0, extraDisposed = 0;
  source.material.addEventListener('dispose', () => originalDisposed++); extra.material.addEventListener('dispose', () => extraDisposed++);
  const npc = npcFixture(), renderer = new NPCModelRenderer(new THREE.Scene(), [npc], { loadModel: async () => source, createAdapter: fixtureAdapter, onError: silent });
  await renderer.ready; renderer.dispose(); assert.equal(originalDisposed, 0); assert.equal(extraDisposed, 0); assert.equal(renderer.status(npc).reason, 'load-failed');
});

test('nonfinite native keyframes and pose adapters are rejected without displaying a corrupted body', async () => {
  const invalid = sourceFixture(); invalid.animations[0].tracks[0].values[0] = NaN;
  const npc = npcFixture(), loadFail = new NPCModelRenderer(new THREE.Scene(), [npc], { loadModel: async () => invalid, createAdapter: fixtureAdapter, onError: silent });
  await loadFail.ready; assert.equal(loadFail.status(npc).reason, 'load-failed'); loadFail.dispose();
  const poseFail = new NPCModelRenderer(new THREE.Scene(), [npc], { loadModel: async () => sourceFixture(), createAdapter: model => ({ supports: () => true,
    apply: () => { model.getObjectByName('MeasuredHead').quaternion.x = NaN; } }), onError: silent });
  await poseFail.ready; poseFail.update(.1, .5); assert.equal(poseFail.status(npc).reason, 'pose-failed'); assert.equal(poseFail.isActive(npc), false); poseFail.dispose();
});

// Synthetic, independently rolled local joint bases exercise the measured
// 24-joint contract. This does not certify any delivered Meshy skin weights.
function mesh24Fixture() {
  const scene = new THREE.Group(), armature = new THREE.Group(); armature.name = 'Armature'; scene.add(armature);
  const bones = new Map();
  const joint = (name, parent, xyz, quaternion = new THREE.Quaternion()) => {
    const bone = new THREE.Bone(); bone.name = name; bone.position.fromArray(xyz); bone.quaternion.copy(quaternion);
    (bones.get(parent) ?? armature).add(bone); bones.set(name, bone); return bone;
  };
  joint('Hips', null, [0, .9, 0]); joint('Spine02', 'Hips', [0, .1, 0]); joint('Spine01', 'Spine02', [0, .15, 0]);
  joint('Spine', 'Spine01', [0, .13, 0]); joint('neck', 'Spine', [0, .2, 0]); joint('Head', 'neck', [0, .1, 0]);
  joint('head_end', 'Head', [0, .12, 0]); joint('headfront', 'Head', [0, 0, .12]);
  for (const [side, sign] of [['Left', -1], ['Right', 1]]) {
    joint(side + 'Shoulder', 'Spine', [sign * .15, .03, 0]);
    joint(side + 'Arm', side + 'Shoulder', [sign * .05, 0, 0], new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), sign * .7));
    joint(side + 'ForeArm', side + 'Arm', [0, -.25, 0]); joint(side + 'Hand', side + 'ForeArm', [0, -.24, 0]);
    joint(side + 'UpLeg', 'Hips', [sign * .1, 0, 0]); joint(side + 'Leg', side + 'UpLeg', [0, -.4, 0]);
    joint(side + 'Foot', side + 'Leg', [0, -.4, 0]); joint(side + 'ToeBase', side + 'Foot', [0, -.08, .1]);
  }
  scene.updateMatrixWorld(true);
  const adapter = {}, hands = {};
  for (const [name, bone] of bones) adapter[name] = {
    neutralPosition: bone.getWorldPosition(new THREE.Vector3()).toArray(), neutralQuaternion: bone.getWorldQuaternion(new THREE.Quaternion()).toArray(),
    sourceLocalQuaternion: bone.quaternion.toArray(), idleLocalQuaternion: bone.quaternion.toArray(),
  };
  for (const [side, prefix] of [['left', 'Left'], ['right', 'Right']]) {
    const bone = bones.get(prefix + 'Hand'), quaternion = bone.getWorldQuaternion(new THREE.Quaternion());
    const fingersLocal = new THREE.Vector3(0, -1, 0), palmLocal = new THREE.Vector3(0, 0, 1), wrist = bone.getWorldPosition(new THREE.Vector3());
    hands[side] = { name: bone.name, vertices: 20, wrist: wrist.toArray(), centroid: bone.localToWorld(new THREE.Vector3(0, -.055, .01)).toArray(),
      fingersLocal: fingersLocal.toArray(), palmLocal: palmLocal.toArray(), fingersWorld: fingersLocal.applyQuaternion(quaternion).toArray(), palmWorld: palmLocal.applyQuaternion(quaternion).toArray() };
  }
  const basic = sourceFixture(), mesh = new THREE.SkinnedMesh(basic.geometry, basic.material);
  // Geometry bounds give the fixture a 1.72m anatomical height.
  mesh.geometry.attributes.position.setY(1, 1.72); mesh.geometry.attributes.position.setY(2, 1.72);
  scene.add(mesh); mesh.bind(new THREE.Skeleton([...bones.values()]));
  const animations = ['idle', 'walk', 'run'].map((name, i) => new THREE.AnimationClip(name, 1,
    [...bones].map(([boneName, bone]) => {
      const a = bone.quaternion.clone(), b = a.clone();
      if (name !== 'idle' && boneName.endsWith('Arm')) b.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), .12 * i));
      return new THREE.QuaternionKeyframeTrack(`${boneName}.quaternion`, [0, .5, 1], [...a, ...b, ...a]);
    })));
  return { scene, animations, bones, assetSha256: 'a'.repeat(64), calibration: { adapter, hands } };
}
const measuredOptions = (spec = NPC_MODELS.warp_keeper) => ({ qaApproved: true, revision: spec.revision, assetSha256: 'a'.repeat(64),
  normalization: { sourceHeight: 1.72, footOrigin: [0, 0, 0], facingYaw: 0 } });
function serializedCalibration(source) {
  const c = { schema: 1, coordinates: { up: '+Y', front: '+Z', height: 1.72, footOrigin: [0, 0, 0] }, hands: source.calibration.hands, nodes: {} };
  for (const [name, bone] of source.bones) c.nodes[name] = { parent: bone.parent.name,
    idleWorld: bone.matrixWorld.toArray(), idleLocal: { rotation: bone.quaternion.toArray() }, bindLocal: { rotation: bone.quaternion.toArray() } };
  return c;
}

test('Meshy24 activation requires QA for exact parsed bytes/revision; invalid/mismatched measured rigs fail closed', async () => {
  for (const approval of [{ qaApproved: false }, { qaApproved: true, revision: 'other' }, { assetSha256: 'b'.repeat(64) }, { assetSha256: undefined }]) {
    const source = mesh24Fixture(), npc = npcFixture();
    const renderer = new NPCModelRenderer(new THREE.Scene(), [npc], { loadModel: async () => source,
      createAdapter: (model, context) => createMeshy24NPCPoseAdapter(model, context, source.calibration, { ...measuredOptions(), ...approval }), onError: silent });
    await renderer.ready; renderer.update(.1, .5); assert.equal(renderer.isActive(npc), false); renderer.dispose();
  }
  const source = mesh24Fixture(), context = { spec: NPC_MODELS.warp_keeper };
  assert.throws(() => createMeshy24NPCPoseAdapter(source.scene, context, { adapter: {} }), /measured NPC/);
  const bad = structuredClone(source.calibration); bad.adapter.LeftLeg.neutralPosition[1] += .1;
  assert.throws(() => createMeshy24NPCPoseAdapter(source.scene, context, bad), /leg length mismatch/);
  source.bones.get('LeftHand').name = 'inventedHand';
  assert.throws(() => createMeshy24NPCPoseAdapter(source.scene, context, source.calibration), /joint contract/);
});

test('measured axes map physical work/talk turns despite rolled bone bases; repeated pose has no drift or stretch', async () => {
  const source = mesh24Fixture(), npc = npcFixture(), state = [npc.x, npc.y, npc.z, npc.yaw];
  const renderer = new NPCModelRenderer(new THREE.Scene(), [npc], { loadModel: async () => source,
    createAdapter: (model, context) => createMeshy24NPCPoseAdapter(model, context, source.calibration, measuredOptions()), onError: silent });
  await renderer.ready; renderer.update(.1, .5); assert.equal(renderer.isActive(npc), true, renderer.status(npc).error);
  const e = renderer.entries.get(npc), arm = e.model.getObjectByName('RightArm'), original = new THREE.Quaternion().fromArray(source.calibration.adapter.RightArm.idleLocalQuaternion);
  npc.state = 'work'; npc.anim = 'hammer'; npc.pose.armRx = -.8; npc.pose.armRz = .06; npc.pose.headYaw = .3;
  renderer.update(.1, .5); assert.equal(renderer.isActive(npc), true, renderer.status(npc).error);
  const delta = original.clone().invert().multiply(arm.quaternion), neutral = new THREE.Quaternion().fromArray(source.calibration.adapter.RightArm.neutralQuaternion);
  const expected = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0).applyQuaternion(neutral.invert()), -.8 * e.adapter.roleMotion.arm);
  close(Math.abs(delta.dot(expected)), 1);
  const snapshot = new Map(); e.model.traverse(o => { if (o.isBone) snapshot.set(o.name, { q: o.quaternion.toArray(), p: o.position.toArray(), s: o.scale.toArray() }); });
  for (let i = 0; i < 100; i++) renderer.update(.1, .5);
  e.model.traverse(o => { if (o.isBone) { assert.deepEqual(o.quaternion.toArray(), snapshot.get(o.name).q); assert.deepEqual(o.position.toArray(), snapshot.get(o.name).p); assert.deepEqual(o.scale.toArray(), [1, 1, 1]); } });
  assert.deepEqual([npc.x, npc.y, npc.z, npc.yaw], state); renderer.dispose();
});

test('native walk/run owns gait and vertical motion without a second procedural leg/arm swing', async () => {
  const source = mesh24Fixture(), npc = npcFixture(); npc.state = 'walk'; npc.path = []; npc.walkPhase = Math.PI; npc.pose.y = .035;
  npc.pose.legL = .5; npc.pose.armRx = 1;
  const renderer = new NPCModelRenderer(new THREE.Scene(), [npc], { loadModel: async () => source,
    createAdapter: (model, context) => createMeshy24NPCPoseAdapter(model, context, source.calibration, measuredOptions()), onError: silent });
  await renderer.ready;
  for (const phase of ['walk', 'run']) {
    npc.anim = phase; renderer.update(.1, .5); const e = renderer.entries.get(npc);
    assert.equal(renderer.isActive(npc), true, renderer.status(npc).error); assert.equal(e.phase, phase); assert.equal(e.poseRoot.position.y, 0);
    const expected = source.bones.get('RightArm').quaternion.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), phase === 'walk' ? .12 : .24));
    close(Math.abs(e.model.getObjectByName('RightArm').quaternion.dot(expected)), 1);
    assert.equal(npc.pose.y, .035); assert.equal(npc.pose.legL, .5);
  }
  renderer.dispose();
});

test('repeated native keys survive full adapter reset, including floor correction and constant head/arm channels', async () => {
  const source = mesh24Fixture(), npc = npcFixture();
  const walk = source.animations.find(c => c.name === 'walk');
  walk.tracks.push(new THREE.VectorKeyframeTrack('Hips.position', [0, .2, .4, 1], [0, .9, 0, 0, .93, 0, 0, .93, 0, 0, .9, 0]));
  const renderer = new NPCModelRenderer(new THREE.Scene(), [npc], { loadModel: async () => source,
    createAdapter: (model, context) => createMeshy24NPCPoseAdapter(model, context, source.calibration, { ...measuredOptions(),
      sockets: { upper: { bone: 'Hips', matrix: new THREE.Matrix4().toArray() } } }), onError: silent });
  await renderer.ready;
  npc.state = 'work'; npc.pose.headYaw = .6; npc.pose.bend = .3; renderer.update(.1, .1);
  npc.state = 'walk'; npc.path = []; npc.carrying = true; npc.pose.armRx = -2; npc.pose.armRz = .3;
  for (const t of [.2, .4, .4, .2]) {
    npc.walkPhase = t * Math.PI * 2; renderer.update(.1, t);
    const e = renderer.entries.get(npc); assert.equal(renderer.isActive(npc), true);
    close(e.model.getObjectByName('Hips').position.y, .93);
    for (const name of ['Head', 'Spine02', 'RightHand']) close(Math.abs(e.model.getObjectByName(name).quaternion.dot(source.bones.get(name).quaternion)), 1);
    assert.deepEqual(e.poseRoot.position.toArray(), [0, 0, 0]);
  }
  renderer.dispose();
});

test('authored neutral does not add a second calibrated arm spread or elbow bend; work loops remain dynamic', async () => {
  const source = mesh24Fixture(), npc = npcFixture('enhancer'); npc.look.props = []; npc.look.hat = null;
  const renderer = new NPCModelRenderer(new THREE.Scene(), [npc], { loadModel: async () => source,
    createAdapter: (model, c) => createMeshy24NPCPoseAdapter(model, c, source.calibration, measuredOptions(NPC_MODELS.enhancer)), onError: silent });
  await renderer.ready; npc.state = 'work';
  Object.assign(npc.pose, { armLx: 0, armRx: 0, armLz: .06, armRz: .06 }); renderer.update(.1, 0);
  const e = renderer.entries.get(npc);
  for (const name of ['LeftArm', 'RightArm', 'LeftForeArm', 'RightForeArm']) close(Math.abs(e.model.getObjectByName(name).quaternion.dot(source.bones.get(name).quaternion)), 1);
  const handPositions = [];
  for (let frame = 0; frame <= 60; frame++) {
    const t = frame / 30; npc.animate(t, 0, 'work', 'hammer'); const authored = structuredClone(npc.pose);
    renderer.update(1 / 30, t); assert.equal(renderer.isActive(npc), true); assert.deepEqual(npc.pose, authored);
    handPositions.push(e.model.getObjectByName('RightHand').getWorldPosition(new THREE.Vector3()));
  }
  assert.ok(handPositions.some(p => p.distanceTo(handPositions[0]) > .03), 'hammer has observable nonzero motion'); renderer.dispose();
});

test('upright robe presentation preserves actual sit activity and measured limb lengths', async () => {
  const source = mesh24Fixture(), npc = npcFixture(); npc.state = 'sit'; npc.anim = 'pray';
  const renderer = new NPCModelRenderer(new THREE.Scene(), [npc], { loadModel: async () => source,
    createAdapter: (model, c) => createMeshy24NPCPoseAdapter(model, c, source.calibration, { ...measuredOptions(), roleMotion: { seated: 'upright' } }), onError: silent });
  await renderer.ready; npc.animate(0, 0, 'sit', 'pray'); const authored = structuredClone(npc.pose);
  renderer.update(.1, 0); const e = renderer.entries.get(npc); assert.equal(renderer.isActive(npc), true);
  close(e.poseRoot.position.y, 0); assert.equal(npc.state, 'sit'); assert.equal(npc.anim, 'pray'); assert.deepEqual(npc.pose, authored);
  for (const side of ['Left', 'Right']) close(e.model.getObjectByName(side + 'Foot').getWorldPosition(new THREE.Vector3()).y, npc.y + .1);
  assert.equal(NPC_ROLE_MOTION.monk_elder.seated, 'upright'); assert.equal(NPC_ROLE_MOTION.master_shaman.seated, 'upright');
  assert.equal(NPC_ROLE_MOTION.occultist.seated, 'upright'); assert.ok(NPC_ROLE_MOTION.occultist.arm > 0 && NPC_ROLE_MOTION.occultist.arm < .3); renderer.dispose();
});

test('novice prayer stows only the active model broom; sweep and complete fallback still render it', async () => {
  const npc = npcFixture('monk_young', ['broom']); npc.look.robe = false; npc.anim = 'pray'; npc.state = 'idle';
  const renderer = new NPCRenderer(new THREE.Scene(), [npc], { loadModel: async () => sourceFixture(), createAdapter: model => ({
    ...fixtureAdapter(model), proceduralParts: ['broom'], propFrames: c => ({ foreR: c.root.matrixWorld.clone() }),
  }), onError: silent });
  await renderer.ready; renderer.update(.1, 0);
  const broom = renderer.parts.find(p => p.name === 'broom'); assert.equal(matrixFor(broom, npc).determinant(), 0);
  npc.anim = 'sweep'; npc.state = 'work'; npc.dirty = true; renderer.update(.1, .2); assert.notEqual(matrixFor(broom, npc).determinant(), 0);
  npc.anim = 'pray'; npc.state = 'sit'; npc.dirty = true; renderer.update(.1, .3); assert.equal(renderer.modelRenderer.isActive(npc), false); assert.notEqual(matrixFor(broom, npc).determinant(), 0);
  renderer.dispose();
});

test('novice broom fit scales about the measured grip without changing the hand or source geometry', async () => {
  const source = mesh24Fixture(), npc = npcFixture('monk_young', ['broom']); npc.look.robe = false;
  const grip = { contact: [0, RIG.handY, .16], fingers: [0, -1, 0], palm: [0, 0, 1] };
  const socket = npcHandContactTransform(source.calibration.hands.right, { handScale: 1, ...grip });
  const positions = Array.from(source.scene.getObjectByProperty('isSkinnedMesh', true).geometry.attributes.position.array);
  const renderer = new NPCModelRenderer(new THREE.Scene(), [npc], { loadModel: async () => source,
    createAdapter: (model, c) => createMeshy24NPCPoseAdapter(model, c, source.calibration, { ...measuredOptions(NPC_MODELS.monk_novice),
      grips: { foreR: grip }, sockets: { foreR: { bone: 'RightHand', matrix: socket.toArray() } } }), onError: silent });
  await renderer.ready; npc.state = 'work'; npc.anim = 'sweep'; npc.animate(.3, 0, 'work', 'sweep'); renderer.update(.1, .3);
  const e = renderer.entries.get(npc); assert.equal(renderer.isActive(npc), true, renderer.status(npc).error);
  assert.ok(e.adapter.toolFit.broomScale < 1 && e.adapter.toolFit.broomScale > .2);
  const originalContact = new THREE.Vector3(...grip.contact).applyMatrix4(socket).applyMatrix4(e.model.getObjectByName('RightHand').matrixWorld);
  const fittedContact = new THREE.Vector3(...grip.contact).applyMatrix4(npc.frames.foreR); close(fittedContact.distanceTo(originalContact), 0);
  assert.deepEqual(Array.from(source.scene.getObjectByProperty('isSkinnedMesh', true).geometry.attributes.position.array), positions);
  renderer.dispose();
});

test('boatman paddle stays above actual terrain through rest/talk/native gait without sliding its reviewed hand cup', async () => {
  const source = mesh24Fixture(), npc = npcFixture('boatman', ['paddle']); npc.look.hat = null; npc.look.robe = false;
  npc.y = 3.4; npc.yaw = 1.3; npc.look.scale = .77;
  const grip = { contact: [0, RIG.handY, .03], fingers: [0, -1, 0], palm: [0, 0, 1] };
  const socket = npcHandContactTransform(source.calibration.hands.right, { handScale: 1, ...grip });
  const geometry = GEAR_PARTS.find(p => p.name === 'paddle').geo(), original = Array.from(geometry.attributes.position.array);
  const renderer = new NPCModelRenderer(new THREE.Scene(), [npc], { loadModel: async () => source,
    createAdapter: (model, c) => createMeshy24NPCPoseAdapter(model, c, source.calibration, { ...measuredOptions(NPC_MODELS.boatman),
      grips: { foreR: grip }, sockets: { foreR: { bone: 'RightHand', matrix: socket.toArray() } } }), onError: silent });
  try {
    await renderer.ready;
    for (const [state, anim, time] of [['sit', 'rest', .5], ['talk', 'talk', .7], ['walk', 'walk', .25], ['walk', 'run', .5]]) {
      npc.state = state; npc.anim = anim; npc.path = state === 'walk' ? [] : null; npc.walkPhase = time * 2 * Math.PI; npc.animate(time, 0, state, anim);
      renderer.update(0, time); assert.equal(renderer.isActive(npc), true, renderer.status(npc).error);
      const e = renderer.entries.get(npc), expected = new THREE.Vector3(...grip.contact).applyMatrix4(socket).applyMatrix4(e.model.getObjectByName('RightHand').matrixWorld);
      close(new THREE.Vector3(...grip.contact).applyMatrix4(npc.frames.foreR).distanceTo(expected), 0);
      const p = new THREE.Vector3(); let floor = Infinity;
      for (let i = 0; i < geometry.attributes.position.count; i++) floor = Math.min(floor, p.fromBufferAttribute(geometry.attributes.position, i).applyMatrix4(npc.frames.foreR).y);
      assert.ok(floor >= npc.y + .019, `paddle floor ${floor} / terrain ${npc.y}`);
      assert.equal(e.adapter.propPresentation().paddle, 'floor-fitted');
      const before = npc.frames.foreR.clone(); renderer.update(0, time); close(Math.max(...before.elements.map((v, i) => Math.abs(v - npc.frames.foreR.elements[i]))), 0);
      assert.equal(npc.state, state); assert.equal(npc.anim, anim);
    }
    assert.deepEqual(Array.from(geometry.attributes.position.array), original);
  } finally { renderer.dispose(); geometry.dispose(); }
});

test('open-hand guard parks spear and tip on terrain while stationary and carries them behind its torso in native gait', async () => {
  const source = mesh24Fixture(), npc = npcFixture('guard_port', ['spear']); npc.look.hat = null; npc.look.robe = false;
  npc.x = 4; npc.z = -7; npc.y = 2.5; npc.yaw = .9; npc.look.scale = .8;
  const socket = npcHandContactTransform(source.calibration.hands.right);
  const renderer = new NPCModelRenderer(new THREE.Scene(), [npc], { loadModel: async () => source,
    createAdapter: (model, c) => createMeshy24NPCPoseAdapter(model, c, source.calibration, { ...measuredOptions(NPC_MODELS.city_guard),
      sockets: { foreR: { bone: 'RightHand', matrix: socket.toArray() } } }), onError: silent });
  const shaft = GEAR_PARTS.find(p => p.name === 'spear').geo(), tip = GEAR_PARTS.find(p => p.name === 'spearTip').geo();
  try {
    await renderer.ready; let parked;
    for (const [state, anim, time] of [['idle', 'guard', 0], ['talk', 'talk', 1], ['walk', 'walk', .5], ['walk', 'run', .8], ['idle', 'guard', 0]]) {
      npc.state = state; npc.anim = anim; npc.path = state === 'walk' ? [] : null; npc.walkPhase = time * 2 * Math.PI; npc.animate(time, 0, state, anim); renderer.update(0, time);
      assert.equal(renderer.isActive(npc), true, renderer.status(npc).error);
      const e = renderer.entries.get(npc), moving = state === 'walk', p = new THREE.Vector3(); let floor = Infinity;
      for (const geo of [shaft, tip]) for (let i = 0; i < geo.attributes.position.count; i++) floor = Math.min(floor, p.fromBufferAttribute(geo.attributes.position, i).applyMatrix4(npc.frames.foreR).y);
      assert.ok(floor >= npc.y, `spear floor ${floor}`);
      assert.equal(e.adapter.propPresentation().spear, moving ? 'back-holstered' : 'ground-parked');
      if (!moving) { close(floor, npc.y + .005); parked ??= npc.frames.foreR.clone(); close(Math.max(...parked.elements.map((v, i) => Math.abs(v - npc.frames.foreR.elements[i]))), 0); }
      assert.equal(npc.state, state); assert.equal(npc.anim, anim); assert.ok(e.visibleParts.has('spear') && e.visibleParts.has('spearTip'));
    }
  } finally { renderer.dispose(); shaft.dispose(); tip.dispose(); }
});

test('vendor displays basket clear of the floor and stows it during travel without changing its schedule or fallback', async () => {
  const source = mesh24Fixture(), npc = npcFixture('gate_supplier', ['basket']); npc.look.hat = null; npc.look.robe = false;
  npc.x = 3; npc.z = -2; npc.y = 1.5; npc.yaw = .7; npc.look.scale = .8;
  const socket = npcHandContactTransform(source.calibration.hands.left);
  const renderer = new NPCModelRenderer(new THREE.Scene(), [npc], { loadModel: async () => source,
    createAdapter: (model, c) => createMeshy24NPCPoseAdapter(model, c, source.calibration, { ...measuredOptions(NPC_MODELS.gate_supplier),
      sockets: { foreL: { bone: 'LeftHand', matrix: socket.toArray() } } }), onError: silent });
  const geometry = GEAR_PARTS.find(p => p.name === 'basket').geo();
  try {
    await renderer.ready; let parked;
    for (const [state, anim] of [['work', 'sell'], ['walk', 'walk'], ['work', 'sell']]) {
      npc.state = state; npc.anim = anim; npc.path = state === 'walk' ? [] : null; npc.animate(.5, 0, state, anim); renderer.update(0, .5);
      assert.equal(renderer.isActive(npc), true, renderer.status(npc).error);
      const e = renderer.entries.get(npc), p = new THREE.Vector3(); let floor = Infinity;
      for (let i = 0; i < geometry.attributes.position.count; i++) floor = Math.min(floor, p.fromBufferAttribute(geometry.attributes.position, i).applyMatrix4(npc.frames.foreL).y);
      close(floor, npc.y + .01);
      assert.equal(renderer.partVisible(npc, 'basket'), state !== 'walk');
      if (state !== 'walk') { parked ??= npc.frames.foreL.clone(); close(Math.max(...parked.elements.map((v, i) => Math.abs(v - npc.frames.foreL.elements[i]))), 0); }
      assert.equal(npc.state, state); assert.equal(npc.anim, anim);
    }
  } finally { renderer.dispose(); geometry.dispose(); }
});

test('role motion and opt-in monk activities survive profile sanitization; invalid/zero motion is rejected atomically', () => {
  const source = mesh24Fixture(), profile = profileFixture(source, 'warp_keeper');
  profile.roleMotion = { arm: .2, head: .3, torso: .1, stance: .2, seated: 'upright', privateSourcePath: 'private' };
  profile.activityPoses = { wai: false, privateSourcePath: 'private' };
  const remove = registerNPCModelProfiles({ schema: 1, families: [profile] });
  try {
    assert.deepEqual(npcModelProfile('warp_keeper').roleMotion, { arm: .2, head: .3, torso: .1, stance: .2, seated: 'upright' });
    assert.deepEqual(npcModelProfile('warp_keeper').activityPoses, { wai: false });
  } finally { remove(); }
  for (const roleMotion of [{ arm: 0 }, { head: NaN }, { torso: 2 }, { seated: 'hidden' }]) assert.throws(() => registerNPCModelProfiles({ schema: 1, families: [{ ...profile, roleMotion }] }), /NPC/);
  assert.throws(() => registerNPCModelProfiles({ schema: 1, families: [{ ...profile, activityPoses: { wai: true } }] }), /monk/);
  const monk = { ...profile, family: 'monk_elder', activityPoses: { wai: true } }; const unregister = registerNPCModelProfiles({ schema: 1, families: [monk] });
  try { assert.deepEqual(npcModelProfile('monk_elder').activityPoses, { wai: true }); } finally { unregister(); }
  const palm = { centreLocal: [0,.06,0], fingersLocal: [0,1,0], palmLocal: [0,0,1], privatePath: 'ignored' };
  const measured = { ...monk, activityPoses: { wai: true, hands: { left: palm, right: palm } } };
  const stop = registerNPCModelProfiles({schema:1,families:[measured]});
  try {
    const saved = npcModelProfile('monk_elder').activityPoses;
    assert.equal(saved.hands.left.privatePath, undefined); assert.notEqual(saved.hands.left.centreLocal,palm.centreLocal);
    const wrong = {...measured,activityPoses:{wai:true,hands:{left:palm,right:{...palm,palmLocal:[0,1,0]}}}};
    assert.throws(()=>registerNPCModelProfiles({schema:1,families:[wrong]}),/wai palm basis/);
    assert.equal(npcModelProfile('monk_elder').activityPoses,saved);
  } finally { stop(); }
});

test('seated/talking feet stay at measured standing plane through yaw/terrain; limb lengths stay unchanged', async () => {
  const source = mesh24Fixture(), npc = npcFixture(); npc.look.scale = 1.1;
  const renderer = new NPCModelRenderer(new THREE.Scene(), [npc], { loadModel: async () => source,
    createAdapter: (model, context) => createMeshy24NPCPoseAdapter(model, context, source.calibration, measuredOptions()), onError: silent });
  await renderer.ready; renderer.update(.1, .5); const e = renderer.entries.get(npc);
  const feet = ['LeftFoot', 'RightFoot'].map(n => e.model.getObjectByName(n)), startY = feet.map(f => f.getWorldPosition(new THREE.Vector3()).y);
  for (const seated of [true, false, true]) {
    npc.state = seated ? 'sit' : 'talk'; npc.pose.y = seated ? -.68 : -.008; npc.pose.bend = seated ? .25 : .08;
    renderer.update(.1, .5); assert.equal(renderer.isActive(npc), true, renderer.status(npc).error);
    feet.forEach((f, i) => close(f.getWorldPosition(new THREE.Vector3()).y, startY[i]));
    for (const side of ['Left', 'Right']) {
      const h = e.model.getObjectByName(side + 'UpLeg').getWorldPosition(new THREE.Vector3());
      const k = e.model.getObjectByName(side + 'Leg').getWorldPosition(new THREE.Vector3());
      const f = e.model.getObjectByName(side + 'Foot').getWorldPosition(new THREE.Vector3());
      close(h.distanceTo(k), .4); close(k.distanceTo(f), .4);
    }
  }
  renderer.dispose();
});

test('idle/work upward bob cannot stretch a straight leg or flicker fallback; work stance remains grounded', async () => {
  const source = mesh24Fixture(), npc = npcFixture();
  const renderer = new NPCModelRenderer(new THREE.Scene(), [npc], { loadModel: async () => source,
    createAdapter: (model, context) => createMeshy24NPCPoseAdapter(model, context, source.calibration, measuredOptions()), onError: silent });
  await renderer.ready;
  for (const bob of [0, .008, .05, .02, 0]) {
    npc.state = 'work'; npc.pose.y = bob; npc.pose.legL = .2; npc.pose.legR = -.15;
    renderer.update(.1, .5); assert.equal(renderer.isActive(npc), true, renderer.status(npc).error);
    const e = renderer.entries.get(npc);
    for (const side of ['Left', 'Right']) {
      const foot = e.model.getObjectByName(side + 'Foot').getWorldPosition(new THREE.Vector3());
      close(foot.y, npc.y + .1); assert.equal(e.model.getObjectByName(side + 'Leg').position.length(), .4);
    }
    assert.equal(npc.pose.y, bob);
  }
  renderer.dispose();
});

test('hand contact maps original-pose surface to current palm and keeps both tools attached across pose/normalization', async () => {
  const source = mesh24Fixture(), npc = npcFixture('master_sword', ['sword', 'basket']);
  const options = { ...measuredOptions(NPC_MODELS.master_sword), handScale: 1 };
  const unregister = registerMeshy24NPCPoseAdapter('master_sword', source.calibration, options);
  const renderer = new NPCModelRenderer(new THREE.Scene(), [npc], { loadModel: async () => source, onError: silent });
  try {
    await renderer.ready;
    for (const armX of [0, -.8, -2.3, 0]) {
      npc.state = 'work'; npc.pose.armRx = armX; npc.pose.armLx = -.4; renderer.update(.1, .5);
      assert.equal(renderer.isActive(npc), true, renderer.status(npc).error); const e = renderer.entries.get(npc);
      for (const [frame, name] of [['foreL', 'LeftHand'], ['foreR', 'RightHand']]) {
        const contact = new THREE.Vector3(0, -.31, 0).applyMatrix4(npc.frames[frame]);
        const surface = new THREE.Vector3(0, -.055, .01).applyMatrix4(e.model.getObjectByName(name).matrixWorld);
        close(contact.distanceTo(surface), 0);
      }
    }
  } finally { unregister(); renderer.dispose(); }
  const invalid = structuredClone(source.calibration.hands.right); invalid.palmLocal = invalid.fingersLocal;
  assert.throws(() => npcHandContactTransform(invalid), /Ambiguous/);
  const socket = npcHandContactTransform(source.calibration.hands.right, { handScale: .5 });
  const point = new THREE.Vector3(0, -.31, 0).applyMatrix4(socket); close(point.distanceTo(new THREE.Vector3(0, -.0275, .005)), 0);
});

test('worn/head props require authored socket transforms and retain source cache ownership', async () => {
  const source = mesh24Fixture(), npc = npcFixture('enhancer', ['hammer']); npc.look.hat = 'headbandRed';
  for (const sockets of [undefined, { head: { bone: 'Head', matrix: new THREE.Matrix4().makeTranslation(0, -.03, 0).toArray() } }]) {
    const renderer = new NPCModelRenderer(new THREE.Scene(), [npc], { loadModel: async () => source,
      createAdapter: (model, context) => createMeshy24NPCPoseAdapter(model, context, source.calibration, { ...measuredOptions(NPC_MODELS.enhancer), handScale: 1, sockets }), onError: silent });
    await renderer.ready; renderer.update(.1, .5);
    assert.equal(renderer.isActive(npc), !!sockets, renderer.status(npc).error);
    if (!sockets) assert.equal(renderer.status(npc).reason, 'needs-prop-adapter');
    renderer.dispose();
  }
});

test('load hashes exact fetched bytes passed to parser once; shared cache cannot substitute another response', async () => {
  const bytes = new Uint8Array([103, 108, 84, 70, 12, 42]).buffer, source = sourceFixture(); let fetched = 0, parsed = 0;
  const cache = createNPCModelCache(url => loadNPCModelSource(url, {
    fetchSource: async requested => { fetched++; assert.equal(requested, url); return { ok: true, arrayBuffer: async () => bytes }; },
    parseSource: async (actual, base) => { parsed++; assert.equal(actual, bytes); assert.equal(base, 'http://localhost/models/npcs/'); return source; },
  }));
  const [a, b] = await Promise.all([cache.load(NPC_MODELS.warp_keeper), cache.load(NPC_MODELS.warp_keeper)]);
  assert.equal(a, b); assert.equal(fetched, 1); assert.equal(parsed, 1);
  assert.equal(a.assetSha256, createHash('sha256').update(new Uint8Array(bytes)).digest('hex')); cache.dispose();
  await assert.rejects(loadNPCModelSource('/missing.glb', { fetchSource: async () => ({ ok: false, status: 404 }), parseSource: () => { throw Error('must not parse'); } }), /HTTP 404/);
});

test('approval replacement and revocation update already loaded adapter without a second body or download', async () => {
  const source = mesh24Fixture(), npc = npcFixture('general_merchant'); let downloads = 0;
  let revoke = registerMeshy24NPCPoseAdapter('general_merchant', source.calibration, { ...measuredOptions(NPC_MODELS.general_merchant), qaApproved: false });
  const renderer = new NPCModelRenderer(new THREE.Scene(), [npc], { loadModel: async () => { downloads++; return source; }, onError: silent });
  try {
    await renderer.ready; renderer.update(.1, .5); assert.equal(renderer.isActive(npc), false); const model = renderer.entries.get(npc).model;
    revoke(); revoke = registerMeshy24NPCPoseAdapter('general_merchant', source.calibration, measuredOptions(NPC_MODELS.general_merchant));
    renderer.update(.1, .5); assert.equal(renderer.isActive(npc), true, renderer.status(npc).error);
    assert.equal(renderer.entries.get(npc).model, model); assert.equal(downloads, 1);
    revoke(); renderer.update(.1, .5); assert.equal(renderer.isActive(npc), false); assert.equal(renderer.status(npc).reason, 'needs-rig-adapter');
  } finally { revoke(); renderer.dispose(); }
});

test('serialized calibrated nodes use actual idleWorld axes/local frames and canonical source normalization', async () => {
  const source = mesh24Fixture(), npc = npcFixture();
  const serialized = serializedCalibration(source);
  const renderer = new NPCModelRenderer(new THREE.Scene(), [npc], { loadModel: async () => source,
    createAdapter: (model, context) => createMeshy24NPCPoseAdapter(model, context, serialized, { ...measuredOptions(), normalization: undefined }), onError: silent });
  await renderer.ready; renderer.update(.1, .5); assert.equal(renderer.isActive(npc), true, renderer.status(npc).error);
  assert.equal(renderer.entries.get(npc).root.userData.normalization.sourceHeight, 1.72); renderer.dispose();
});

test('camera LOD hysteresis skips far skeleton posing, restores complete fallback and keeps nearby interaction model', async () => {
  const source = mesh24Fixture(), npc = npcFixture('blacksmith', ['apron']), camera = new THREE.PerspectiveCamera();
  const renderer = new NPCRenderer(new THREE.Scene(), [npc], { camera, loadModel: async () => source,
    createAdapter: (model, context) => createMeshy24NPCPoseAdapter(model, context, source.calibration, measuredOptions(NPC_MODELS.blacksmith)), onError: silent });
  await renderer.ready; npc.distance = 80;
  const placeCamera = distance => { camera.position.set(npc.x, npc.y, npc.z + distance); camera.updateMatrixWorld(true); };
  placeCamera(37); renderer.update(.1, .5); assert.equal(renderer.modelRenderer.isActive(npc), true);
  const e = renderer.modelRenderer.entries.get(npc);
  const apron = renderer.parts.find(p => p.name === 'apron'); assert.equal(matrixFor(apron, npc).determinant(), 0);
  placeCamera(44); renderer.update(.1, .6); assert.equal(renderer.modelRenderer.isActive(npc), true);
  const posed = e.model.getObjectByName('Head').quaternion.toArray();
  placeCamera(46); npc.pose.headYaw = .4; renderer.update(.1, .7);
  assert.equal(renderer.modelRenderer.isActive(npc), false); assert.equal(e.root.visible, false); assert.equal(e.reason, 'distance-lod');
  for (const part of renderer.parts) assert.notEqual(matrixFor(part, npc).determinant(), 0, part.name);
  assert.deepEqual(e.model.getObjectByName('Head').quaternion.toArray(), posed);
  placeCamera(40); renderer.update(.1, .8); assert.equal(renderer.modelRenderer.isActive(npc), false); // re-entry waits for 38
  placeCamera(37); renderer.update(.1, .9); assert.equal(renderer.modelRenderer.isActive(npc), true); assert.equal(matrixFor(apron, npc).determinant(), 0);
  placeCamera(80); renderer.update(.1, 1, { x: npc.x, z: npc.z }); assert.equal(renderer.modelRenderer.isActive(npc), true); // player talking range
  renderer.dispose(); assert.equal(e.root, null);
});

test('lazy far family neither fetches nor clones; near transition loads once and leaves one body, far reuses it unposed', async () => {
  const source = sourceFixture(), npc = npcFixture(), scene = new THREE.Scene(); npc.distance = 80; let loads = 0, adapters = 0;
  const renderer = new NPCRenderer(scene, [npc], { lazyLoad: true, loadModel: async () => { loads++; return source; },
    createAdapter: model => { adapters++; return fixtureAdapter(model); }, onError: silent });
  renderer.update(.1, .5); await renderer.ready;
  assert.equal(loads, 0); assert.equal(adapters, 0); assert.equal(renderer.modelRenderer.entries.get(npc).model, null);
  npc.distance = 20; renderer.update(.1, .6); await renderer.ready; renderer.update(.1, .7);
  assert.equal(loads, 1); assert.equal(adapters, 1); assert.equal(renderer.modelRenderer.isActive(npc), true);
  assert.equal(scene.children.filter(o => o.name === `npc-model:${npc.id}`).length, 1);
  const model = renderer.modelRenderer.entries.get(npc).model;
  npc.distance = 80; renderer.update(.1, .8); npc.distance = 20; renderer.update(.1, .9);
  assert.equal(loads, 1); assert.equal(adapters, 1); assert.equal(renderer.modelRenderer.entries.get(npc).model, model);
  let materials = 0; model.children[0].material.addEventListener('dispose', () => materials++);
  renderer.dispose(); renderer.dispose(); assert.equal(materials, 1);
});

test('eager cache may fetch far source but defers clone/adapter; disposal prevents lazy late attach', async () => {
  const npc = npcFixture(); npc.distance = 80; let prepared = 0;
  const renderer = new NPCModelRenderer(new THREE.Scene(), [npc], { loadModel: async () => sourceFixture(), createAdapter: model => { prepared++; return fixtureAdapter(model); }, onError: silent });
  await renderer.ready; assert.equal(prepared, 0); assert.equal(renderer.entries.get(npc).model, null);
  npc.distance = 10; renderer.update(.1, .5); assert.equal(prepared, 1); assert.equal(renderer.isActive(npc), true); renderer.dispose();
  const pending = deferred(), scene = new THREE.Scene();
  const lazy = new NPCModelRenderer(scene, [npc], { lazyLoad: true, loadModel: () => pending.promise, createAdapter: fixtureAdapter, onError: silent });
  lazy.update(.1, .5); lazy.dispose(); pending.resolve(sourceFixture()); await lazy.ready; assert.equal(scene.children.length, 0);
});

test('idle breathing/weight shift is seeded, bounded and planted, without accumulating joint scale or changing authored NPC pose', async () => {
  const source = mesh24Fixture(), npc = npcFixture(); npc.look.scale = 1.1; npc.yaw = .7; npc.seed = .3;
  const renderer = new NPCModelRenderer(new THREE.Scene(), [npc], { loadModel: async () => source,
    createAdapter: (model, context) => createMeshy24NPCPoseAdapter(model, context, source.calibration, measuredOptions()), onError: silent });
  await renderer.ready; renderer.update(1 / 30, 0); const e = renderer.entries.get(npc);
  const feet = ['LeftFoot', 'RightFoot'].map(n => e.model.getObjectByName(n)), points = feet.map(f => f.getWorldPosition(new THREE.Vector3()));
  const oldPose = structuredClone(npc.pose), placement = [npc.x, npc.y, npc.z, npc.yaw];
  const x = [], chest = []; let remembered;
  for (let frame = 0; frame <= 240; frame++) {
    const t = frame / 30; renderer.update(1 / 30, t);
    assert.equal(renderer.isActive(npc), true, renderer.status(npc).error);
    feet.forEach((f, i) => close(f.getWorldPosition(new THREE.Vector3()).distanceTo(points[i]), 0));
    e.model.traverse(o => { if (o.isBone) { assert.deepEqual(o.scale.toArray(), source.bones.get(o.name).scale.toArray()); assert.deepEqual(o.position.toArray(), source.bones.get(o.name).position.toArray()); } });
    x.push(e.poseRoot.position.x); chest.push(e.model.getObjectByName('Spine').quaternion.clone());
    assert.ok(Math.abs(e.poseRoot.position.x) < .02); assert.ok(Math.abs(e.poseRoot.position.z) < .003); assert.ok(e.poseRoot.position.y >= -.01);
    if (frame === 30) remembered = { root: e.poseRoot.position.toArray(), head: e.model.getObjectByName('Head').quaternion.toArray() };
  }
  assert.ok(Math.max(...x) - Math.min(...x) > .02, 'observable small weight shift');
  assert.ok(chest.some(q => q.angleTo(chest[0]) > .005), 'nonstatic breathing');
  renderer.update(1 / 30, 1); assert.deepEqual(e.poseRoot.position.toArray(), remembered.root); assert.deepEqual(e.model.getObjectByName('Head').quaternion.toArray(), remembered.head);
  assert.deepEqual(npc.pose, oldPose); assert.deepEqual([npc.x, npc.y, npc.z, npc.yaw], placement);
  npc.state = 'walk'; npc.path = []; renderer.update(1 / 30, 2); assert.equal(renderer.isActive(npc), true);
  assert.deepEqual(e.poseRoot.position.toArray(), [0, 0, 0]);
  npc.state = 'work'; npc.path = null; renderer.update(1 / 30, 2);
  assert.equal(renderer.isActive(npc), true); close(e.poseRoot.position.x, 0); close(e.poseRoot.position.z, 0);
  renderer.dispose();
});

function profileFixture(source, family) {
  return { family, revision: NPC_MODELS[family].revision, geometryAssetSha256: 'c'.repeat(64), assetSha256: source.assetSha256,
    qa: { art: true, runtime: true }, calibration: serializedCalibration(source) };
}

test('external per-family catalog requires both final gates, strips private metadata and preserves exact final byte identity', async () => {
  const source = mesh24Fixture(), npc = npcFixture('herbalist'), profile = profileFixture(source, 'herbalist');
  profile.qa.art = false; profile.privateSourcePath = 'private'; profile.calibration.localPath = 'private';
  let remove = registerNPCModelProfiles({ schema: 1, families: [profile] });
  const renderer = new NPCModelRenderer(new THREE.Scene(), [npc], { loadModel: async () => source, onError: silent });
  try {
    await renderer.ready; renderer.update(.1, .5); assert.equal(renderer.isActive(npc), false);
    assert.equal(npcModelProfile('herbalist').privateSourcePath, undefined); assert.equal(npcModelProfile('herbalist').calibration.localPath, undefined);
    remove(); profile.qa.art = true; profile.qa.runtime = false; remove = registerNPCModelProfiles({ schema: 1, families: [profile] });
    renderer.update(.1, .5); assert.equal(renderer.isActive(npc), false);
    remove(); profile.qa.runtime = true; remove = registerNPCModelProfiles({ schema: 1, families: [profile] });
    renderer.update(.1, .5); assert.equal(renderer.isActive(npc), true, renderer.status(npc).error);
    assert.equal(renderer.entries.get(npc).root.userData.geometryAssetSha256, profile.geometryAssetSha256);
    remove(); profile.assetSha256 = 'b'.repeat(64); remove = registerNPCModelProfiles({ schema: 1, families: [profile] });
    renderer.update(.1, .5); assert.equal(renderer.isActive(npc), false); // color repack must have its own final-byte approval
  } finally { remove(); renderer.dispose(); }
});

test('catalog validation is atomic and rejects duplicate/wrong-taxon/missing measured frames without registering earlier rows', () => {
  const source = mesh24Fixture(), valid = profileFixture(source, 'occultist');
  for (const invalid of [{ ...valid, family: 'sunken_city_3' }, { ...valid, assetSha256: 'prefix' },
    { ...valid, family: 'herbalist', calibration: { ...valid.calibration, nodes: {} } }]) {
    assert.throws(() => registerNPCModelProfiles({ schema: 1, families: [valid, invalid] }), /NPC/);
    assert.equal(npcModelProfile('occultist'), null);
  }
  assert.throws(() => registerNPCModelProfiles({ schema: 1, families: [valid, valid] }), /duplicate/);
});

test('per-file schema1 approved profiles load by eager module filename, allowing family-specific revision with no catalog request', async () => {
  const source = mesh24Fixture(), p = profileFixture(source, 'boatman');
  const profile = { schema: 1, family: p.family, revision: 'woven-v4', assetSha256: p.assetSha256, qaApproved: true, calibration: p.calibration };
  const remove = registerBundledNPCModelProfiles({ './model-profiles/boatman.json': profile });
  let loads = 0;
  const cache = createProfiledNPCModelCache(async (url, hash) => { loads++; assert.ok(url.includes(`woven-v4-${profile.assetSha256}`)); assert.equal(hash, profile.assetSha256); return source; });
  try {
    const [a, b] = await Promise.all([cache.load(NPC_MODELS.boatman), cache.load(NPC_MODELS.boatman)]); assert.equal(a, b); assert.equal(loads, 1);
    assert.equal(npcModelProfile('boatman').assetSha256, source.assetSha256);
    assert.equal(npcModelProfile('boatman').qaApproved, true);
    assert.equal(npcModelProfile('boatman').geometryAssetSha256, undefined);
  } finally { remove(); cache.dispose(); }
  assert.throws(() => registerBundledNPCModelProfiles({ './model-profiles/other.json': profile }), /filename/);
});

test('missing/unapproved profiles do not fetch or parse any body; exact-byte mismatch rejects before texture decoding', async () => {
  let loaded = 0, parsed = 0;
  const cache = createProfiledNPCModelCache(async () => { loaded++; return sourceFixture(); });
  await assert.rejects(cache.load(NPC_MODELS.gate_supplier), /No approved/); assert.equal(loaded, 0);
  const source = mesh24Fixture(), p = profileFixture(source, 'gate_supplier');
  const remove = registerBundledNPCModelProfiles({ './model-profiles/gate_supplier.json': { ...p, schema: 1, qa: undefined, qaApproved: false } });
  try { await assert.rejects(cache.load(NPC_MODELS.gate_supplier), /No approved/); assert.equal(loaded, 0); }
  finally { remove(); cache.dispose(); }
  await assert.rejects(loadNPCModelSource('/fixture.glb', { expectedAssetSha256: 'b'.repeat(64),
    fetchSource: async () => ({ ok: true, arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer }),
    parseSource: () => { parsed++; return source; } }), /approved profile hash/);
  assert.equal(parsed, 0);
});

test('empty production catalog keeps all 34 NPC fallbacks without asset requests, clones or load warnings', async () => {
  let loads = 0; const errors = [], npcs = Object.keys(NPC_MODEL_IDS).map(id => npcFixture(id));
  for (const family of Object.keys(NPC_MODELS)) assert.equal(npcModelProfile(family), null);
  const cache = createProfiledNPCModelCache(async () => { loads++; return sourceFixture(); });
  const scene = new THREE.Scene(), renderer = new NPCRenderer(scene, npcs, { loadModel: spec => cache.load(spec), onError: (_, error) => errors.push(error) });
  try {
    renderer.update(0, .5);
    const baseline = renderer.parts.map(part => part.entries.map(({ npc }) => matrixFor(part, npc).toArray()));
    await renderer.ready; renderer.update(0, .5);
    assert.equal(loads, 0); assert.equal(cache.size, 0); assert.deepEqual(errors, []);
    for (const npc of npcs) {
      assert.equal(renderer.modelRenderer.isActive(npc), false);
      assert.equal(renderer.modelRenderer.status(npc).reason, 'unapproved-profile');
      assert.equal(renderer.modelRenderer.status(npc).error, null);
      assert.equal(renderer.modelRenderer.entries.get(npc).model, null);
    }
    assert.equal(scene.children.filter(o => o.name.startsWith('npc-model:')).length, 0);
    assert.deepEqual(renderer.parts.map(part => part.entries.map(({ npc }) => matrixFor(part, npc).toArray())), baseline);
  } finally { renderer.dispose(); cache.dispose(); }
});

test('catalog accepts clothHat/ngob/mongkol and baked supplier ngob suppresses all five vendor hats only while active', async () => {
  const source = mesh24Fixture();
  const profiles = [['warp_keeper', 'clothHat'], ['gate_supplier', 'ngob'], ['master_muay', 'mongkol']].map(([family, part]) => ({
    ...profileFixture(source, family), bakedAccessories: [part],
  }));
  const remove = registerNPCModelProfiles({ schema: 1, families: profiles });
  const npcs = NPC_MODELS.gate_supplier.npcIds.map(id => { const npc = npcFixture(id); npc.look.hat = 'ngob'; return npc; });
  const renderer = new NPCRenderer(new THREE.Scene(), npcs, { loadModel: async () => source, onError: silent });
  try {
    for (const profile of profiles) assert.deepEqual(npcModelProfile(profile.family).bakedAccessories, profile.bakedAccessories);
    await renderer.ready; renderer.update(.1, .5);
    const hat = renderer.parts.find(part => part.name === 'ngob'); assert.ok(hat); assert.equal(npcs.length, 5);
    for (const npc of npcs) { assert.equal(renderer.modelRenderer.isActive(npc), true, renderer.modelRenderer.status(npc).error); assert.equal(matrixFor(hat, npc).determinant(), 0); }
    remove(); renderer.update(.1, .5);
    for (const npc of npcs) { assert.equal(renderer.modelRenderer.isActive(npc), false); assert.notEqual(matrixFor(hat, npc).determinant(), 0); }
  } finally { remove(); renderer.dispose(); }
});

test('catalog per-family baked headwear suppresses only that active model, keeping procedural fallback complete', async () => {
  const source = mesh24Fixture(), npc = npcFixture('master_muay'); npc.look.hat = 'mongkol';
  const profile = profileFixture(source, 'master_muay'); profile.bakedAccessories = ['mongkol'];
  const remove = registerNPCModelProfiles({ schema: 1, families: [profile] });
  const renderer = new NPCRenderer(new THREE.Scene(), [npc], { loadModel: async () => source, onError: silent });
  try {
    await renderer.ready; renderer.update(.1, .5); assert.equal(renderer.modelRenderer.isActive(npc), true, renderer.modelRenderer.status(npc).error);
    const hat = renderer.parts.find(p => p.name === 'mongkol'); assert.equal(matrixFor(hat, npc).determinant(), 0);
    remove(); renderer.update(.1, .5); assert.equal(renderer.modelRenderer.isActive(npc), false); assert.notEqual(matrixFor(hat, npc).determinant(), 0);
  } finally { remove(); renderer.dispose(); }
});

test('actual skinned hand patch stays rigid with calibrated hand orientation and attached grip during bounded work/idle/native gait', async () => {
  const source = mesh24Fixture(), mesh = source.scene.children.find(o => o.isSkinnedMesh), hand = source.bones.get('RightHand');
  const local = [new THREE.Vector3(-.02, -.065, .01), new THREE.Vector3(.02, -.065, .01), new THREE.Vector3(0, -.035, .01)];
  const rest = local.map(p => p.clone().applyMatrix4(hand.matrixWorld)), index = mesh.skeleton.bones.indexOf(hand);
  const geometry = mesh.geometry;
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([...geometry.attributes.position.array, ...rest.flatMap(p => p.toArray())], 3));
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute([...geometry.attributes.skinIndex.array, index, 0, 0, 0, index, 0, 0, 0, index, 0, 0, 0], 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute([...geometry.attributes.skinWeight.array, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], 4));
  geometry.setIndex([...geometry.index.array, 4, 5, 6]);
  const npc = npcFixture('master_sword', ['sword']), profile = profileFixture(source, 'master_sword'); profile.handScale = 1;
  const remove = registerNPCModelProfiles({ schema: 1, families: [profile] });
  const renderer = new NPCModelRenderer(new THREE.Scene(), [npc], { loadModel: async () => source, onError: silent });
  try {
    await renderer.ready;
    for (const [state, anim, time] of [['idle', 'look', 1], ['work', 'hammer', .3], ['work', 'sword', .7], ['talk', 'talk', .5], ['walk', 'walk', 1], ['walk', 'run', 1.5]]) {
      npc.state = state; npc.anim = anim; npc.path = state === 'walk' ? [] : null; npc.animate(time, 1 / 30, state, anim);
      renderer.update(1 / 30, time); assert.equal(renderer.isActive(npc), true, renderer.status(npc).error);
      const e = renderer.entries.get(npc), currentHand = e.model.getObjectByName('RightHand'), currentMesh = e.model.children.find(o => o.isSkinnedMesh);
      currentMesh.skeleton.update();
      close(Math.abs(currentHand.quaternion.dot(new THREE.Quaternion().fromArray(source.calibration.adapter.RightHand.idleLocalQuaternion))), 1);
      const arm = e.model.getObjectByName('RightArm'), fore = e.model.getObjectByName('RightForeArm');
      assert.ok(arm.quaternion.angleTo(new THREE.Quaternion().fromArray(source.calibration.adapter.RightArm.idleLocalQuaternion)) <= 1.5);
      assert.ok(fore.quaternion.angleTo(new THREE.Quaternion().fromArray(source.calibration.adapter.RightForeArm.idleLocalQuaternion)) <= .650001);
      const vertices = local.map((_, i) => currentMesh.getVertexPosition(4 + i, new THREE.Vector3()).applyMatrix4(currentMesh.matrixWorld));
      vertices.forEach((v, i) => close(v.distanceTo(local[i].clone().applyMatrix4(currentHand.matrixWorld)), 0));
      close(vertices[0].distanceTo(vertices[1]), rest[0].distanceTo(rest[1]));
      close(vertices[1].distanceTo(vertices[2]), rest[1].distanceTo(rest[2]));
      const grip = new THREE.Vector3(0, -.31, 0).applyMatrix4(npc.frames.foreR);
      close(grip.distanceTo(new THREE.Vector3(0, -.055, .01).applyMatrix4(currentHand.matrixWorld)), 0);
    }
  } finally { remove(); renderer.dispose(); }
});
