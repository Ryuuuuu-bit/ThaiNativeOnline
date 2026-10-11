import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { particleProjection } from '../src/classes/fx/particle-projection.js';
const source = (await readFile(new URL('../src/classes/fx/engine.js', import.meta.url), 'utf8'))
  .replace(/^import .*;\r?$/gm, '').replace(/^export /gm, '');
const createFx = runInNewContext(source + '\ncreateFx;', { THREE, particleProjection,
  document: { createElement: () => ({ getContext: () => ({ createRadialGradient: () => ({ addColorStop() {} }), fillRect() {} }) }) },
});
function fixture(camera) {
  const renderer = { domElement: { clientHeight: 900 }, getPixelRatio: () => 2 };
  const fx = createFx({ scene: new THREE.Scene(), camera, renderer, labels: {}, size: 1.35 });
  return fx.root.children.filter(o => o.isPoints);
}
test('both particle pools retain their screen size across composer resolution changes', () => {
  const camera = new THREE.OrthographicCamera(-20, 20, 13, -13, .1, 220);
  for (const points of fixture(camera)) {
    let expected;
    for (const scale of [1, .8, .6, 1]) {
      points.onBeforeRender({ getCurrentViewport: v => v.set(0, 0, 3200 * scale, 1800 * scale) }, null, camera);
      const pixels = points.material.uniforms.uScale.value / scale;
      expected ??= pixels;
      assert.ok(Math.abs(pixels - expected) < 1e-9, 'target downscaling must not enlarge smoke');
    }
    camera.zoom = 1.5;
    points.onBeforeRender({ getCurrentViewport: v => v.set(0, 0, 1920, 1080) }, null, camera);
    assert.equal(points.material.uniforms.uScale.value, particleProjection(camera, 1080, 1, 1.35));
    camera.zoom = 1;
  }
});
test('particle draw uses the active render camera and target, including perspective previews', () => {
  const camera = new THREE.PerspectiveCamera(50, 1, .1, 220);
  for (const points of fixture(camera)) {
    points.onBeforeRender({ getCurrentViewport: v => v.set(0, 0, 800, 600) }, null, camera);
    assert.equal(points.material.uniforms.uOrtho.value, 0);
    assert.equal(points.material.uniforms.uScale.value, particleProjection(camera, 600, 1, 1.35));
    const ortho = new THREE.OrthographicCamera(-10, 10, 10, -10);
    points.onBeforeRender({ getCurrentViewport: v => v.set(0, 0, 800, 600) }, null, ortho);
    assert.equal(points.material.uniforms.uOrtho.value, 1);
    assert.equal(points.material.uniforms.uScale.value, 40.5);
  }
});
