import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createNPCToolPresentation } from '../src/npc/NPCToolPresentation.js';
import { GEAR_PARTS } from '../src/npc/body/gearParts.js';
import { RIG } from '../src/npc/body/rig.js';

const families = { master_sword: ['sword', 'foreR', .05], master_bandit: ['knife', 'foreR', .06],
  enhancer: ['hammer', 'foreR', .05], master_hunter: ['bow', 'foreL', .10],
  monk_novice: ['broom', 'foreR', .16], boatman: ['paddle', 'foreR', .03] };
const near = (actual, expected, eps = 1e-8) => assert.ok(Math.abs(actual - expected) < eps, `${actual} vs ${expected}`);
const matrixNear = (a, b) => a.elements.forEach((v, i) => near(v, b.elements[i]));

// Rotated bone bases and nonzero canonical ground deliberately defeat
// translation-only mounts, guessed source axes, and wrist/root substitution.
function fixture(height = 1.72) {
  const model = new THREE.Group(), armature = new THREE.Group(); armature.name = 'Armature'; model.add(armature);
  const unit = height / 1.72, footOrigin = [.17, .23, -.11], bones = {}, nodes = {};
  function add(name, parent, p, angles) {
    const bone = new THREE.Bone(); bone.name = name; parent.add(bone); parent.updateWorldMatrix(true, false);
    const world = new THREE.Matrix4().compose(new THREE.Vector3(...p).multiplyScalar(unit).add(new THREE.Vector3(...footOrigin)),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(...angles)), new THREE.Vector3(1, 1, 1));
    const local = parent.matrixWorld.clone().invert().multiply(world);
    local.decompose(bone.position, bone.quaternion, bone.scale); bone.updateWorldMatrix(true, false);
    bones[name] = bone; nodes[name] = { parent: parent.name, idleWorld: world.toArray() };
    return bone;
  }
  const hip = add('Hips', armature, [0, .95, .04], [.1, -.2, .35]);
  const torso = add('Spine02', hip, [0, 1.06, .045], [-.2, .3, -.25]);
  add('Spine', torso, [0, 1.25, .01], [.12, -.18, .22]);
  add('LeftUpLeg', hip, [.10, .86, .04], [.2, .1, -.3]);
  add('RightUpLeg', hip, [-.09, .86, .04], [-.2, -.1, .3]);
  add('RightHand', torso, [-.3, 1.08, .15], [.8, -.6, .5]);
  const calibration = { schema: 1, coordinates: { up: '+Y', front: '+Z', height, footOrigin }, nodes };
  const root = new THREE.Group(), poseRoot = new THREE.Group(), orient = new THREE.Group(), scale = new THREE.Group(), offset = new THREE.Group();
  root.add(poseRoot); poseRoot.add(orient); orient.add(scale); scale.add(offset); offset.add(model);
  offset.position.set(...footOrigin.map(v => -v));
  const context = { root, poseRoot, moving: false, state: 'idle', anim: 'idle', spec: { height } };
  function place(yaw = 0, outerScale = 1, targetHeight = height) {
    root.position.set(7, 2.3, -4); root.rotation.y = yaw; root.scale.setScalar(outerScale);
    context.spec.height = targetHeight; scale.scale.setScalar(targetHeight / (height * outerScale)); root.updateMatrixWorld(true);
  }
  place();
  return { model, bones, calibration, root, context, place };
}

function surface(part, frame) {
  const geometry = GEAR_PARTS.find(p => p.name === part).geo(), attr = geometry.attributes.position;
  const bounds = new THREE.Box3(), point = new THREE.Vector3();
  for (let i = 0; i < attr.count; i++) bounds.expandByPoint(point.fromBufferAttribute(attr, i).applyMatrix4(frame));
  geometry.dispose(); return bounds;
}
function frames() { return Object.fromEntries(['foreR', 'foreL', 'upper', 'head'].map((name, i) => [name, new THREE.Matrix4().makeTranslation(i + 1, i + 2, i + 3)])); }
const snapshot = model => { const out = []; model.traverse(o => out.push([o.name, o.position.toArray(), o.quaternion.toArray(), o.scale.toArray()])); return out; };

test('all six policies are rigid, unreflected and leave actual calibrated bodies/input frames untouched', () => {
  for (const [family, [part, frame, handleZ]] of Object.entries(families)) {
    const f = fixture(family === 'monk_novice' ? 1.2 : 1.72), before = snapshot(f.model), cal = JSON.stringify(f.calibration), input = frames();
    const original = Object.fromEntries(Object.entries(input).map(([key, m]) => [key, m.clone()]));
    const helper = createNPCToolPresentation(f.model, f.calibration, family);
    f.context.moving = true;
    const result = helper.frames(f.context, input), matrix = result[frame];
    assert.ok(matrix.determinant() > 0);
    const scales = [0, 4, 8].map(i => Math.hypot(...matrix.elements.slice(i, i + 3)));
    near(scales[0], scales[1]); near(scales[1], scales[2]);
    assert.ok(surface(part, matrix).min.y > f.root.position.y + .025, `${part} must clear ground while stowed`);
    if (['sword', 'knife', 'hammer'].includes(part)) {
      const handle = new THREE.Vector3(0, RIG.handY, handleZ).applyMatrix4(matrix);
      near(handle.y - f.root.position.y, .95);
      assert.ok(new THREE.Vector3(0, 0, 1).transformDirection(matrix).y < -.9, 'authored tool length points down from belt');
      assert.ok(Math.abs(handle.x - f.root.position.x) > .2, 'handle clears calibrated hip joint span');
    } else {
      assert.ok(surface(part, matrix).max.z < f.root.position.z - .12, `${part} envelope is behind body`);
    }
    assert.deepEqual(snapshot(f.model), before); assert.equal(JSON.stringify(f.calibration), cal);
    for (const key of Object.keys(input)) { matrixNear(input[key], original[key]); if (key !== frame) assert.equal(result[key], input[key]); }
    assert.deepEqual(helper.parts, family === 'master_sword' ? ['swordScabbard'] : family === 'master_bandit' ? ['knifeScabbard'] : []);
    assert.deepEqual(helper.scabbards, helper.parts);
    for (const sheath of helper.scabbards) assert.ok(surface(sheath, matrix).min.y > f.root.position.y + .02, 'parent scabbard also clears ground');
    const report = helper.presentation(); report[part] = 'fake grip'; assert.notEqual(helper.presentation()[part], 'fake grip');
  }
});

test('mounted offsets stay identical relative to live hip/torso through gait, root yaw and normalized scale', () => {
  for (const [family, [part, frame]] of Object.entries(families)) {
    const f = fixture(family === 'monk_novice' ? 1.2 : 1.72), helper = createNPCToolPresentation(f.model, f.calibration, family);
    f.context.moving = true;
    const anchor = f.bones[['sword', 'knife', 'hammer'].includes(part) ? 'Hips' : 'Spine02'];
    const first = helper.frames(f.context, frames())[frame];
    const attachment = anchor.matrixWorld.clone().invert().multiply(first);
    for (const [yaw, size] of [[1.4, .71], [-2.2, 1.8], [.4, 1.05]]) {
      f.bones.Hips.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), .07));
      f.bones.Spine02.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), .015));
      f.bones.RightHand.position.y += .04; f.place(yaw, size);
      const matrix = helper.frames(f.context, frames())[frame];
      matrixNear(anchor.matrixWorld.clone().invert().multiply(matrix), attachment);
      assert.ok(surface(part, matrix).min.y > f.root.position.y, `${part} moving envelope stays clear of floor`);
      for (const sheath of helper.scabbards) assert.ok(surface(sheath, matrix).min.y > f.root.position.y, 'moving scabbard clears floor');
      assert.ok(matrix.determinant() > 0);
    }
  }
});

test('stationary broom/paddle park from actual geometry floors under world yaw/scale/normalization, independently of pose', () => {
  for (const family of ['monk_novice', 'boatman']) {
    const [part, frame] = families[family], height = family === 'monk_novice' ? 1.2 : 1.72;
    const f = fixture(height), yawOffset = .47;
    const helper = createNPCToolPresentation(f.model, f.calibration, family, { normalization: { sourceHeight: height, footOrigin: f.calibration.coordinates.footOrigin, facingYaw: yawOffset } });
    for (const [yaw, size, targetHeight] of [[0, .7, height], [1.3, 1.8, height], [-2.1, 1.1, height * .86]]) {
      f.place(yaw, size, targetHeight);
      for (const state of ['work', 'idle', 'sit']) {
        f.context.state = state; f.context.anim = family === 'monk_novice' ? 'sweep' : 'idle';
        const matrix = helper.frames(f.context, frames())[frame], box = surface(part, matrix);
        near(box.min.y, f.root.position.y + .005, 2e-7);
        near(Math.hypot(...matrix.elements.slice(0, 3)), targetHeight / 1.72);
        near(new THREE.Vector3(0, 0, 1).transformDirection(matrix).distanceTo(new THREE.Vector3(Math.sin(yaw + yawOffset), 0, Math.cos(yaw + yawOffset))), 0);
        assert.equal(helper.presentation()[part], 'ground-parked');
        f.context.poseRoot.position.y = -.6; f.bones.Hips.rotation.x += .25; f.root.updateMatrixWorld(true);
        matrixNear(helper.frames(f.context, frames())[frame], matrix);
      }
      f.context.moving = true; helper.frames(f.context, frames()); assert.equal(helper.presentation()[part], 'back-stowed');
      f.context.moving = false; f.context.poseRoot.position.set(0, 0, 0);
    }
  }
});

test('unconfigured families preserve frames and guard/basket presentation verbatim', () => {
  for (const family of ['city_guard', 'gate_supplier', 'blacksmith', 'monk_elder', 'unknown']) {
    const input = frames(), helper = createNPCToolPresentation(null, null, family);
    assert.equal(helper.frames({ moving: true }, input), input); assert.deepEqual(helper.parts, []); assert.deepEqual(helper.scabbards, []); assert.deepEqual(helper.presentation(), {});
  }
});

test('missing/reflected neutral or live mounts fail instead of using source-axis guesses', () => {
  for (const mutate of [f => delete f.calibration.nodes.Hips,
    f => { f.calibration.nodes.Hips.parent = 'WrongSource'; },
    f => { f.calibration.nodes.Hips.idleWorld[0] *= -1; f.calibration.nodes.Hips.idleWorld[1] *= -1; f.calibration.nodes.Hips.idleWorld[2] *= -1; }]) {
    const f = fixture(); mutate(f); assert.throws(() => createNPCToolPresentation(f.model, f.calibration, 'master_sword'), /calibrated|non-reflected/);
  }
  const f = fixture(), helper = createNPCToolPresentation(f.model, f.calibration, 'boatman');
  f.root.scale.x = -1; f.root.updateMatrixWorld(true);
  assert.throws(() => helper.frames(f.context, frames()), /non-reflected/);
  f.context.moving = true; assert.throws(() => helper.frames(f.context, frames()), /non-reflected/);
});
