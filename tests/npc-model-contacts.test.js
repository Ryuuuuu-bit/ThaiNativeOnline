import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { sha256 } from '../tools/npc-models/glb.mjs';
import { createStagedNPCProfile } from '../tools/npc-models/stage.mjs';
import * as THREE from 'three';
import { measureNPCContacts, contactRolePlan, legacyGripForPart, fitWornSocket } from '../tools/npc-models/contacts.mjs';
import { measureHand } from '../tools/npc-models/anatomy.mjs';
import { MESHY_NPC_JOINTS } from '../tools/npc-models/calibration.mjs';
import { NPC_MODELS, npcHandContactTransform } from '../src/npc/NPCModels.js';
import { BODY_PARTS } from '../src/npc/body/bodyParts.js';
import { RIG } from '../src/npc/body/rig.js';

const near = (a, b, tolerance = 1e-6) => assert.ok(Math.abs(a - b) <= tolerance, `${a} != ${b}`);
const brief = { families: Object.values(NPC_MODELS).map(s => ({ id: s.family, npcIds: [...s.npcIds] })) };

// Deliberately synthetic independent rolled axes and rigid skin patches. This
// exercises measurement/ownership contracts, not delivered anatomy acceptance.
function fixture({ family = 'blacksmith', scale = 1.7, handRoll = .4, headWidth = .2 } = {}) {
  const scene = new THREE.Group(), armature = new THREE.Group(); armature.name = 'Armature'; scene.add(armature);
  const definitions = [
    ['Hips', 'Armature', [0, .88, 0]], ['Spine02', 'Hips', [0, 1.02, 0]], ['Spine01', 'Spine02', [0, 1.15, 0]], ['Spine', 'Spine01', [0, 1.25, 0]],
    ['neck', 'Spine', [0, 1.40, 0]], ['Head', 'neck', [0, 1.47, 0]], ['head_end', 'Head', [0, 1.72, 0]], ['headfront', 'Head', [0, 1.47, .25]],
  ];
  for (const [side, sign] of [['Left', 1], ['Right', -1]]) definitions.push(
    [`${side}Shoulder`, 'Spine', [sign * .08, 1.335, 0]], [`${side}Arm`, `${side}Shoulder`, [sign * .178, 1.335, 0]],
    [`${side}ForeArm`, `${side}Arm`, [sign * .28, 1.05, 0]], [`${side}Hand`, `${side}ForeArm`, [sign * .35, .8, .02]],
    [`${side}UpLeg`, 'Hips', [sign * .09, .88, 0]], [`${side}Leg`, `${side}UpLeg`, [sign * .09, .46, 0]],
    [`${side}Foot`, `${side}Leg`, [sign * .09, .06, 0]], [`${side}ToeBase`, `${side}Foot`, [sign * .09, .02, .15]],
  );
  const names = new Map([['Armature', armature]]), bones = [];
  for (const [name, parentName, worldPosition] of definitions) {
    const parent = names.get(parentName), bone = new THREE.Bone(); bone.name = name; parent.add(bone); parent.updateWorldMatrix(true, false);
    bone.position.copy(new THREE.Vector3(...worldPosition).applyMatrix4(parent.matrixWorld.clone().invert()));
    const worldRotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(name.includes('Hand') ? .2 : .03, name.includes('Hand') ? -.15 : 0, name.includes('Hand') ? handRoll : .05));
    bone.quaternion.copy(parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(worldRotation));
    bone.updateWorldMatrix(true, false); names.set(name, bone); bones.push(bone);
  }
  scene.updateMatrixWorld(true);
  const positions = [], skinIndex = [], skinWeight = [], indices = [], handVertices = {};
  const patch = (name, size, centre, local = false) => {
    const geometry = new THREE.BoxGeometry(...size, 3, 3, 3), p = geometry.attributes.position, first = positions.length / 3, index = bones.indexOf(names.get(name));
    for (let i = 0; i < p.count; i++) {
      const point = new THREE.Vector3().fromBufferAttribute(p, i).add(new THREE.Vector3(...centre));
      if (local) point.applyMatrix4(names.get(name).matrixWorld);
      positions.push(...point); skinIndex.push(index, 0, 0, 0); skinWeight.push(1, 0, 0, 0);
    }
    indices.push(...Array.from(geometry.index.array, i => i + first));
    if (name.endsWith('Hand')) handVertices[name] = first;
    geometry.dispose();
  };
  patch('Head', [headWidth, .26, .22], [0, 1.60, .01]);
  patch('Spine', [.34, .455, .22], [0, 1.1075, 0]);
  patch('LeftHand', [.07, .13, .02], [0, -.065, 0], true);
  patch('RightHand', [.07, .13, .02], [0, -.065, 0], true);
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setIndex(indices);
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndex, 4)); geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeight, 4));
  const mesh = new THREE.SkinnedMesh(geometry, new THREE.MeshBasicMaterial()); scene.add(mesh); mesh.bind(new THREE.Skeleton(bones)); scene.updateMatrixWorld(true); mesh.skeleton.update();
  const objects = [armature, ...bones], objectNames = new Map(objects.map(o => [o, o.name]));
  const rig = { sha256: 'a'.repeat(64), gltf: { scene }, mesh, objects, names, objectNames,
    rest: new Map(objects.map(o => [o, { world: o.matrixWorld.clone(), p: o.position.clone(), q: o.quaternion.clone(), s: o.scale.clone() }])) };
  const nodes = Object.fromEntries(bones.map(o => [o.name, { parent: o.parent.name, bindWorld: o.matrixWorld.toArray(), idleWorld: o.matrixWorld.toArray(),
    bindLocal: { rotation: o.quaternion.toArray() }, idleLocal: { rotation: o.quaternion.toArray() } }]));
  const hands = {};
  for (const side of ['left', 'right']) {
    const name = `${side === 'left' ? 'Left' : 'Right'}Hand`, palmReference = new THREE.Vector3(0, 0, 1).applyQuaternion(names.get(name).getWorldQuaternion(new THREE.Quaternion())).toArray();
    const hand = measureHand(rig, name, { palmReference });
    hands[side] = { ...hand, centroid: hand.centroid.map(v => v / scale), wrist: hand.wrist.map(v => v / scale) };
  }
  const sources = { body: 'b'.repeat(64), walk: 'c'.repeat(64), run: 'd'.repeat(64) };
  const calibration = { schema: 1, sourceHashes: sources, coordinates: { up: '+Y', front: '+Z', height: NPC_MODELS[family].height, footOrigin: [0, 0, 0] }, nodes, hands };
  const qa = { schema: 1, family, sha256: rig.sha256, sources, source: { sha256: sources.body }, frame: { scale, matrix: new THREE.Matrix4().makeScale(scale, scale, scale).toArray() }, audit: { passed: true } };
  return { rig, calibration, qa, family, brief, handVertices };
}

test('import/help are offline and side-effect free; no source loader or generation runs', () => {
  const url = new URL('../tools/npc-models/contacts.mjs', import.meta.url).href;
  assert.equal(execFileSync(process.execPath, ['--input-type=module', '-e', `await import(${JSON.stringify(url)});`], { encoding: 'utf8' }), '');
});

test('17 families/34 real IDs retain their own props, existing handle coordinates and explicit baked exceptions', () => {
  const plans = Object.keys(NPC_MODELS).map(f => contactRolePlan(f, brief)); assert.equal(plans.flatMap(p => p.roles).length, 34);
  const sword = contactRolePlan('master_sword', brief); assert.deepEqual(sword.grips.foreR.contact, [0, RIG.handY, .05]);
  assert.deepEqual(sword.grips.foreR.parts, ['sword']); assert.deepEqual(contactRolePlan('boatman', brief).grips.foreR.contact, [0, RIG.handY, .03]);
  assert.deepEqual(contactRolePlan('master_hunter', brief).grips.foreL.contact, [0, RIG.handY, .10]);
  assert.deepEqual(contactRolePlan('city_guard', brief).grips.foreR.parts, ['spear', 'spearTip']);
  assert.deepEqual(contactRolePlan('blacksmith', brief).roles[0].retained, ['hammer', 'headband']);
  assert.deepEqual(contactRolePlan('master_muay', brief, ['mongkol']).roles[0].retained, []);
  const supplier = contactRolePlan('gate_supplier', brief, ['ngob']); assert.deepEqual(supplier.roles.filter(r => r.retained.includes('basket')).map(r => r.id), ['gate_supplier']);
  assert.throws(() => legacyGripForPart('invented_sword'), /No inspected/);
  assert.throws(() => contactRolePlan('blacksmith', { families: [{ id: 'blacksmith', npcIds: ['another_npc'] }] }), /IDs differ/);
});

test('handScale comes exactly from preparation mapping, independently of measured hand length or legacy forearm offset', () => {
  const input = fixture({ scale: 2.3 }), result = measureNPCContacts(input);
  assert.equal(result.profileFields.handScale, 2.3); assert.equal(result.checks.visualApproved, false);
  assert.ok(result.checks.maxContactError < 1e-6); near(result.measurements.hands.right.actualHandLength, .13);
  assert.equal(result.measurements.hands.right.legacyForearmContactOffset, -.31);
  assert.notEqual(result.profileFields.handScale, .13 / .31); assert.equal(result.measurements.hands.right.thumb, null);
  assert.match(result.measurements.hands.right.thumbStatus, /UNVERIFIED/);
});

test('missing/contradictory scale, wrong family, raw sources or current body identity reject rather than guessing', () => {
  for (const mutate of [
    f => delete f.qa.frame.scale,
    f => { f.qa.frame.scale = 8; },
    f => { f.qa.family = 'boatman'; },
    f => { f.calibration.sourceHashes = { ...f.calibration.sourceHashes, body: 'e'.repeat(64) }; },
    f => { f.qa.sha256 = 'e'.repeat(64); },
  ]) { const input = fixture(); mutate(input); assert.throws(() => measureNPCContacts(input)); }
});

test('actual topology/bind-frame mismatch is rejected even when receipt strings match', () => {
  const input = fixture(); input.calibration.nodes.RightHand.bindWorld[12] += .03;
  assert.throws(() => measureNPCContacts(input), /actual body rest/);
  const missing = fixture(); missing.rig.names.delete('RightHand'); assert.throws(() => measureNPCContacts(missing), /Meshy-24/);
});

test('actual rigid patch overrides old PCA centroid after weight-mask changes; conflicting palm orientation stays blocked', () => {
  const input = fixture(); input.calibration.hands.right.centroid[1] += .04;
  const result = measureNPCContacts(input);
  assert.ok(result.measurements.hands.right.rawContractCentroidDifference > .05);
  assert.ok(result.checks.maxContactError < 1e-6);
  const hand = input.rig.names.get('RightHand'), socket = new THREE.Matrix4().fromArray(result.profileFields.sockets.foreR.matrix);
  const point = new THREE.Vector3(...result.profileFields.grips.foreR.contact).applyMatrix4(socket).applyMatrix4(hand.matrixWorld);
  near(point.distanceTo(new THREE.Vector3(...result.measurements.hands.right.contactPatch.restCentre)), 0);
  const bad = fixture(); bad.calibration.hands.left.fingersLocal = [1, 0, 0];
  assert.throws(() => measureNPCContacts(bad), error => error.code === 'NPC_HAND_PCA_MISMATCH' && error.witness.side === 'left');
});

test('valid signed PCA change is measured and flagged for visual recalibration, never treated as approval', () => {
  const input = fixture();
  const old = new THREE.Vector3(...input.calibration.hands.right.palmLocal).applyAxisAngle(new THREE.Vector3(...input.calibration.hands.right.fingersLocal), .5);
  input.calibration.hands.right.palmLocal = old.toArray();
  input.calibration.hands.right.palmWorld = old.applyQuaternion(input.rig.names.get('RightHand').getWorldQuaternion(new THREE.Quaternion())).toArray();
  const result = measureNPCContacts(input);
  assert.equal(result.checks.axisReviewRequired, true); assert.equal(result.checks.visualApproved, false);
  near(result.measurements.hands.right.rawToCurrentAxes.palmDot, Math.cos(.5));
  assert.ok(result.checks.maxContactError < 1e-6);
});

test('texture-only body requires explicit unchanged-geometry receipt and retains independent final/source hashes', () => {
  const input = fixture(); input.rig.sha256 = 'e'.repeat(64);
  assert.throws(() => measureNPCContacts(input), /body hash/);
  input.textileReport = { sourceSHA256: input.qa.sha256, sha256: input.rig.sha256, geometryRigAnimationUnchanged: true };
  const result = measureNPCContacts(input); assert.equal(result.assetSha256, 'e'.repeat(64)); assert.equal(result.geometryAssetSha256, 'a'.repeat(64));
  input.textileReport.geometryRigAnimationUnchanged = false; assert.throws(() => measureNPCContacts(input), /body hash/);
});

test('independent family hand rotations produce different local sockets, upright forward props and rigid contact during movement', () => {
  const a = fixture({ family: 'master_sword', handRoll: .65 }), b = fixture({ family: 'boatman', handRoll: -.4 });
  const ra = measureNPCContacts(a), rb = measureNPCContacts(b);
  assert.notDeepEqual(ra.socketWitnesses.foreR.matrix, rb.socketWitnesses.foreR.matrix);
  for (const r of [ra, rb]) { near(new THREE.Vector3(...r.socketWitnesses.foreR.neutralPropForward).distanceTo(new THREE.Vector3(0, 0, 1)), 0); near(new THREE.Vector3(...r.socketWitnesses.foreR.neutralPropUp).distanceTo(new THREE.Vector3(0, 1, 0)), 0); }
  const bone = a.rig.names.get('RightHand'), fore = a.rig.names.get('RightForeArm');
  const socket = npcHandContactTransform(a.calibration.hands.right, { handScale: a.qa.frame.scale, ...ra.profileFields.grips.foreR });
  for (const angle of [-.6, 0, .4]) {
    fore.quaternion.copy(a.rig.rest.get(fore).q).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), angle));
    a.rig.gltf.scene.updateMatrixWorld(true); a.rig.mesh.skeleton.update();
    const hand = measureHand(a.rig, 'RightHand', { palmReference: new THREE.Vector3(...a.calibration.hands.right.palmLocal).applyQuaternion(bone.getWorldQuaternion(new THREE.Quaternion())).toArray() });
    const grip = new THREE.Vector3(...ra.profileFields.grips.foreR.contact).applyMatrix4(socket).applyMatrix4(bone.matrixWorld);
    near(grip.distanceTo(new THREE.Vector3(...hand.centroid)), 0);
  }
});

test('worn head/torso fits use actual per-body surface and marker frame, preserving attachment under head motion', () => {
  const a = fixture({ headWidth: .2 }), b = fixture({ headWidth: .28 });
  const fa = fitWornSocket(a.rig, a.calibration, 'head'), fb = fitWornSocket(b.rig, b.calibration, 'head');
  assert.notDeepEqual(fa.socket.matrix, fb.socket.matrix); assert.equal(fa.evidence.anatomicalCrownMeasured, false);
  near(fb.evidence.scale[0] / fa.evidence.scale[0], 1.4);
  const geometry = BODY_PARTS.find(p => p.name === 'head').geo(); geometry.computeBoundingBox();
  const local = new THREE.Matrix4().fromArray(fa.socket.matrix), bone = a.rig.names.get('Head');
  const before = geometry.boundingBox.clone().applyMatrix4(bone.matrixWorld.clone().multiply(local));
  near(before.getSize(new THREE.Vector3()).x, .2); geometry.dispose();
  bone.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), .3)); a.rig.gltf.scene.updateMatrixWorld(true);
  const world = bone.matrixWorld.clone().multiply(local); near(world.clone().premultiply(bone.matrixWorld.clone().invert()).elements[12], local.elements[12]);
  const upper = fitWornSocket(a.rig, a.calibration, 'upper'); assert.equal(upper.socket.bone, 'Spine'); assert.ok(upper.socket.matrix.every(Number.isFinite));
});

test('thumb witness must be hash-pinned and on the actual rigid hand, with no invented finger articulation', () => {
  const input = fixture(), right = input.handVertices.RightHand;
  input.thumbLandmarks = { schema: 1, assetSha256: input.rig.sha256, hands: { right: { vertex: right } } };
  const result = measureNPCContacts(input); assert.equal(result.measurements.hands.right.thumb.vertex, right); assert.equal(result.measurements.hands.left.thumb, null);
  assert.equal(result.checks.visualApproved, false); assert.match(result.measurements.hands.right.thumb.status, /Visual validation still required/);
  input.thumbLandmarks.assetSha256 = 'e'.repeat(64); assert.throws(() => measureNPCContacts(input), /exact current body/);
  input.thumbLandmarks.assetSha256 = input.rig.sha256; input.thumbLandmarks.hands.right.vertex = 0; assert.throws(() => measureNPCContacts(input), /rigid hand patch/);
});

test('candidate generation preserves every body vertex and rest transform, and never upgrades failed native QA', () => {
  const input = fixture(), positions = input.rig.mesh.geometry.attributes.position.array.slice();
  const original = input.rig.objects.map(o => ({ p: o.position.toArray(), q: o.quaternion.toArray(), s: o.scale.toArray() }));
  input.qa.audit.passed = false; input.calibration.nodes.RightArm.idleLocal.rotation = new THREE.Quaternion().fromArray(input.rig.names.get('RightArm').quaternion.toArray()).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), .1)).toArray();
  const result = measureNPCContacts(input); assert.equal(result.preparationAuditPassed, false); assert.equal(result.status, 'MEASURED_CONTACT_CANDIDATE_NOT_APPROVED');
  assert.deepEqual(input.rig.mesh.geometry.attributes.position.array, positions);
  assert.deepEqual(input.rig.objects.map(o => ({ p: o.position.toArray(), q: o.quaternion.toArray(), s: o.scale.toArray() })), original);
  assert.ok(!Object.hasOwn(result.profileFields, 'qaApproved'));
});

function stageFixture() {
  const f = fixture(), encode = value => Buffer.from(JSON.stringify(value));
  const baseBytes = Buffer.from('synthetic body bytes'), candidateBytes = Buffer.from('synthetic textile bytes');
  f.rig.sha256 = sha256(baseBytes); f.qa.sha256 = f.rig.sha256; f.qa.audit.failureCount = 0;
  const adapterBytes = encode(f.calibration), qaBytes = encode(f.qa), briefBytes = encode(f.brief), contacts = measureNPCContacts(f);
  contacts.inputHashes = { body: f.rig.sha256, adapter: sha256(adapterBytes), qa: sha256(qaBytes), brief: sha256(briefBytes) };
  return { family: f.family, revision: 'woven-v1', baseBytes, candidateBytes, adapterBytes, qaBytes, briefBytes, contactsBytes: encode(contacts),
    textileReportBytes: encode({ sourceSHA256: sha256(baseBytes), sha256: sha256(candidateBytes), geometryRigAnimationUnchanged: true }) };
}

test('staging merges measured contacts/normalization into isolated profile with pinned source, final and contact bytes', () => {
  const input = stageFixture(), profile = createStagedNPCProfile(input), fields = JSON.parse(input.contactsBytes).profileFields;
  for (const key of ['handScale', 'grips', 'sockets', 'normalization']) assert.deepEqual(profile[key], fields[key]);
  assert.equal(profile.inspectionOnly, true); assert.equal(profile.productionApproved, false);
  assert.equal(profile.geometryAssetSha256, sha256(input.baseBytes)); assert.equal(profile.assetSha256, sha256(input.candidateBytes));
  assert.equal(profile.inspectionProvenance.contactSHA256, sha256(input.contactsBytes)); assert.equal(profile.inspectionProvenance.contactVisualApproved, false);
  fields.grips.foreR.contact[0] = 999; assert.notEqual(profile.grips.foreR.contact[0], 999);
});

test('staging rejects stale bytes even for whitespace-only adapter/QA/brief changes and rejects failed contacts/native QA', () => {
  for (const key of ['baseBytes', 'candidateBytes', 'adapterBytes', 'qaBytes', 'briefBytes']) {
    const input = stageFixture(); input[key] = Buffer.concat([input[key], Buffer.from('\n')]);
    assert.throws(() => createStagedNPCProfile(input));
  }
  for (const change of [c => { c.checks.numericContactPassed = false; }, c => { c.preparationAuditPassed = false; },
    c => { c.profileFields.handScale += .1; }, c => { c.profileFields.normalization.facingYaw = Math.PI; },
    c => { c.profileFields.qaApproved = true; }, c => { delete c.profileFields.sockets.head; }]) {
    const input = stageFixture(), c = JSON.parse(input.contactsBytes); change(c); input.contactsBytes = Buffer.from(JSON.stringify(c));
    assert.throws(() => createStagedNPCProfile(input));
  }
  const input = stageFixture(), qa = JSON.parse(input.qaBytes); qa.audit.passed = false; input.qaBytes = Buffer.from(JSON.stringify(qa));
  assert.throws(() => createStagedNPCProfile(input), /native QA/);
});

test('staging rejects reflected/missing hand sockets and wrong actual handle coordinates', () => {
  for (const change of [c => { delete c.profileFields.sockets.foreR; }, c => { c.profileFields.grips.foreR.contact[2] += .05; },
    c => { for (const i of [0, 1, 2]) c.profileFields.sockets.foreR.matrix[i] *= -1; }]) {
    const input = stageFixture(), c = JSON.parse(input.contactsBytes); change(c); input.contactsBytes = Buffer.from(JSON.stringify(c));
    assert.throws(() => createStagedNPCProfile(input));
  }
});
