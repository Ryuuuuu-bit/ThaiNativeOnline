import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { roleSocket, surfaceAnchor } from '../tools/npc-models/fit-role-contacts.mjs';
import { legacyGripForPart } from '../tools/npc-models/contacts.mjs';

const point = (x, y, z) => new THREE.Vector3(x, y, z);
function fixture(y = .06) {
  const values = new THREE.Float32BufferAttribute([-.015, y, 0, .015, y, 0, 0, y + .015, 0], 3);
  const mesh = { matrixWorld: new THREE.Matrix4(), skeleton: { update() {} }, geometry: { attributes: { position: values } },
    getVertexPosition(i, target) { return target.fromBufferAttribute(values, i); } };
  return { rig: { mesh, gltf: { scene: { updateMatrixWorld() {} } }, names: new Map([['RightHand', { matrixWorld: new THREE.Matrix4() }]]) },
    evidence: { bone: 'RightHand', matrix: new THREE.Matrix4().toArray(), triangles: [{ triangle: 0, vertices: [0, 1, 2], records: [0, 1, 2] }], records: [{ handWeight: .65 }, { handWeight: .8 }, { handWeight: .9 }] } };
}
test('true proximal mixed-weight surface remains eligible; distal centroid cannot be substituted', () => {
  const { rig, evidence } = fixture(), a = surfaceAnchor(rig, evidence, 0);
  assert.equal(a.triangle, 0); assert.ok(Math.abs(a.point.y - .065) < 1e-8);
  assert.deepEqual(a.weights, [.65, .8, .9]);
  const distal = fixture(.13);
  assert.throws(() => surfaceAnchor(distal.rig, distal.evidence, 0), /distal-finger/);
  assert.throws(() => surfaceAnchor(rig, evidence, 7), /actual indexed/);
  assert.throws(() => surfaceAnchor(rig, evidence, 0, [.5, .5, .5]), /actual indexed/);
});
test('each retained handle lands on measured target with a unit, non-reflected frame', () => {
  const { rig, evidence } = fixture(), palm = surfaceAnchor(rig, evidence, 0);
  for (const part of ['hammer', 'bow', 'knife']) {
    const fit = roleSocket({ rig, evidence, part, palm, web: { point: point(.03, .07, 0) }, ulnar: point(-.03, .065, 0), shaftSign: part === 'knife' ? -1 : 1 });
    const matrix = new THREE.Matrix4().fromArray(fit.socket.matrix), actual = new THREE.Vector3(...legacyGripForPart(part)).applyMatrix4(matrix);
    assert.ok(actual.distanceTo(fit.center) < 1e-10);
    assert.ok(Math.abs(matrix.determinant() - 1) < 1e-10);
    for (const i of [0, 4, 8]) assert.ok(Math.abs(Math.hypot(...matrix.elements.slice(i, i + 3)) - 1) < 1e-10);
    assert.ok(fit.actualSupportRadius > .009 && fit.actualSupportRadius < .023);
    if (part === 'knife') {
      const edge = point(1, 0, 0).transformDirection(matrix), blade = point(0, 0, 1).transformDirection(matrix);
      assert.ok(edge.y > .9, 'actual legacy +X cutting edge faces the fingers');
      assert.ok(blade.x < -.9, 'actual blade points outside ulnar palm, clear of thumb branch');
    }
  }
});
test('socket fitter rejects reflected choices and unbounded offsets', () => {
  const { rig, evidence } = fixture(), palm = surfaceAnchor(rig, evidence, 0);
  const options = { rig, evidence, part: 'knife', palm, web: { point: point(.03, .07, 0) }, ulnar: point(-.03, .065, 0) };
  assert.throws(() => roleSocket({ ...options, shaftSign: 0 }), /Unbounded/);
  assert.throws(() => roleSocket({ ...options, clearance: .02 }), /Unbounded/);
  assert.throws(() => roleSocket({ ...options, tilt: 1 }), /Unbounded/);
});
