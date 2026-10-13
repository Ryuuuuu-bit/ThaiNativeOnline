import * as THREE from 'three';
import { buildWorld } from '../src/world/World.js';
import { MAPS } from '../src/world/maps.js';
import { Environment } from '../src/world/Environment.js';
import { CameraController } from '../src/core/CameraController.js';
import { UBOSOT } from '../src/world/ubosot.js';

// Review harness for ภายในอุโบสถ (map 'ubosot'): the production renderer, lighting and
// gameplay camera angle. window.ubosotReview.render([name, x, z, zoom, hour]) → JPEG data URL.
const host = document.querySelector('#stage'), status = document.querySelector('#status');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(1); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; host.append(renderer.domElement);
const scene = new THREE.Scene(), view = new CameraController(renderer, host), env = new Environment(scene, renderer);
const world = await buildWorld(scene, text => { status.textContent = text; }, MAPS.ubosot);
const views = [
  ['nave', UBOSOT.x, UBOSOT.z + 1, 1.25, 10], ['shrine', UBOSOT.x, UBOSOT.z - 4.5, 2, 10],
  ['siamsi', UBOSOT.x - 4.6, UBOSOT.z + .75, 2.2, 10], ['night', UBOSOT.x, UBOSOT.z + 1, 1.25, 22],
];
function render([name, x, z, zoom, hour]) {
  view.zoom = zoom; view.updateProjection(); view.camera.far = 500; view.camera.updateProjectionMatrix();
  view.offset.set(15, 23, 22); view.snap(new THREE.Vector3(x, 0, z));
  const state = env.update(hour, view.focus, 'ubosot');
  world.update(0, 0, view.focus, state); renderer.render(scene, view.camera);
  status.textContent = `${name} · ${hour}:00 · ${world.stats.ubosotProps} props · ${renderer.info.render.calls} calls · ${Math.round(renderer.info.render.triangles / 1000)}k tris`;
  return renderer.domElement.toDataURL('image/jpeg', .92);
}
for (const v of views) { const b = document.createElement('button'); b.textContent = v[0]; b.onclick = () => render(v); document.querySelector('#views').append(b); }
render(views[0]);
window.ubosotReview = { world, render, views };
