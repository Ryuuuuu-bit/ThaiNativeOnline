import test from 'node:test';
import assert from 'node:assert/strict';
import { particleProjection } from '../src/classes/fx/particle-projection.js';
test('orthographic FX has finite pixel size without a perspective fov; zoom tracks the world', () => {
  const camera = { isOrthographicCamera: true, top: 12, bottom: -12, zoom: 1 };
  assert.ok(Math.abs(particleProjection(camera, 720, 2, 1.35) - 81) < 1e-9);
  camera.zoom = 2;
  assert.ok(Math.abs(particleProjection(camera, 720, 2, 1.35) - 162) < 1e-9);
});
test('perspective previews preserve their depth-projection scale', () => {
  assert.ok(Math.abs(particleProjection({ fov: 90 }, 800, 1, 1) - 400) < 1e-9);
});
