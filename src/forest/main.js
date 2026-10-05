import * as THREE from 'three';
import { buildForest, groundHeight, obstacles, trees, shared, HALF } from './scene.js';
import { makeCharacter } from './sprite.js';
import { createForestAudio } from './audio.js';
import './forest.css';

const $ = id => document.getElementById(id);
const host = $('world');
// ?low trades shadow resolution and pixel density for frame rate on weaker GPUs.
const low = new URLSearchParams(location.search).has('low');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
} catch (error) {
  $('loading').querySelector('p').textContent = 'ไม่สามารถเปิด WebGL ได้ กรุณาเปิด hardware acceleration แล้วลองใหม่';
  throw error;
}
host.appendChild(renderer.domElement);
renderer.setPixelRatio(low ? 1 : Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#dfe6f2');
scene.fog = new THREE.Fog('#dfe6f2', 45, 95);
// Blue sky fill makes the shade on snow read cold blue; the sun is warm.
const hemisphere = new THREE.HemisphereLight('#a9bde6', '#f1ece4', 1.55); scene.add(hemisphere);
const sun = new THREE.DirectionalLight('#fff4df', 3.4); sun.castShadow = true;
sun.shadow.mapSize.setScalar(low ? 2048 : 4096);
Object.assign(sun.shadow.camera, { left: -34, right: 34, top: 34, bottom: -34, near: 1, far: 120 });
sun.shadow.bias = -.0004; sun.shadow.normalBias = .04; sun.shadow.radius = 4;
scene.add(sun, sun.target);
const sunOffset = new THREE.Vector3(-26, 44, -20);

const forest = buildForest(scene);
// The AudioContext is created on first use so browsers never block it.
let audio = null;
const character = makeCharacter(scene, () => audio?.step());
const player = character.group; player.position.set(1.2, groundHeight(1.2, 1.5), 1.5);

const camera = new THREE.PerspectiveCamera(30, 16 / 9, 1, 260);
const focus = player.position.clone();
let yaw = 0, targetYaw = 0, pitch = THREE.MathUtils.degToRad(57), distance = 42, targetDistance = 42;

function resize() {
  const w = host.clientWidth, h = host.clientHeight;
  camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h);
  renderer.getDrawingBufferSize(shared.uViewport.value); shared.uAspect.value = w / h;
}
window.addEventListener('resize', resize); resize();

// ---------- Input: RO-style click-to-walk, WASD, right-drag to orbit ------
const keys = new Set(), raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2();
let destination = null, orbit = null, heading = null;
const marker = new THREE.Mesh(new THREE.RingGeometry(.22, .3, 40), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: .85, depthWrite: false }));
marker.rotation.x = -Math.PI / 2; marker.visible = false; scene.add(marker);
const codes = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight'];
window.addEventListener('keydown', e => {
  if (['INPUT', 'SELECT', 'BUTTON'].includes(e.target.tagName) && !codes.includes(e.code)) return;
  if (codes.includes(e.code)) { e.preventDefault(); keys.add(e.code); destination = null; marker.visible = false; }
  if (e.code === 'KeyR' && !e.repeat) { targetYaw = 0; targetDistance = 42; }
  if (e.code === 'KeyH' && !e.repeat) document.body.classList.toggle('photo-mode');
});
window.addEventListener('keyup', e => keys.delete(e.code));
window.addEventListener('blur', () => { keys.clear(); orbit = null; });
host.addEventListener('contextmenu', e => e.preventDefault());
host.addEventListener('pointerdown', e => {
  if (e.button === 2) { orbit = { x: e.clientX, yaw: targetYaw }; host.setPointerCapture(e.pointerId); return; }
  if (e.button !== 0) return;
  const rect = host.getBoundingClientRect();
  pointer.set((e.clientX - rect.left) / rect.width * 2 - 1, -(e.clientY - rect.top) / rect.height * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObject(forest.ground)[0];
  if (hit && canStand(hit.point.x, hit.point.z)) {
    destination = hit.point.clone(); marker.position.set(hit.point.x, hit.point.y + .06, hit.point.z); marker.visible = true;
  }
});
host.addEventListener('pointermove', e => { if (orbit) targetYaw = orbit.yaw - (e.clientX - orbit.x) * .006; });
host.addEventListener('pointerup', () => orbit = null);
host.addEventListener('wheel', e => { e.preventDefault(); targetDistance = THREE.MathUtils.clamp(targetDistance + e.deltaY * .03, 24, 70); }, { passive: false });
for (const button of document.querySelectorAll('[data-move]')) {
  const code = { up: 'KeyW', left: 'KeyA', down: 'KeyS', right: 'KeyD' }[button.dataset.move];
  button.addEventListener('pointerdown', e => { e.preventDefault(); button.setPointerCapture(e.pointerId); keys.add(code); destination = null; });
  for (const n of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(n, () => keys.delete(code));
}

function canStand(x, z) {
  if (Math.abs(x) > HALF - 3 || Math.abs(z) > HALF - 3) return false;
  return !obstacles.some(o => Math.hypot(x - o.x, z - o.z) < o.radius + .3);
}
function movePlayer(dt) {
  // Screen-relative directions for the current camera orbit.
  const fwd = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw)), right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
  const dir = new THREE.Vector3();
  if (keys.has('KeyW') || keys.has('ArrowUp')) dir.add(fwd);
  if (keys.has('KeyS') || keys.has('ArrowDown')) dir.sub(fwd);
  if (keys.has('KeyD') || keys.has('ArrowRight')) dir.add(right);
  if (keys.has('KeyA') || keys.has('ArrowLeft')) dir.sub(right);
  if (destination && !dir.lengthSq()) {
    dir.subVectors(destination, player.position); dir.y = 0;
    if (dir.length() < .12) { destination = null; marker.visible = false; dir.set(0, 0, 0); }
  }
  if (!dir.lengthSq()) return false;
  dir.normalize(); heading = Math.atan2(dir.x, dir.z);
  const step = 4 * dt, p = player.position, x = p.x + dir.x * step, z = p.z + dir.z * step;
  let moved = false;
  if (canStand(x, z)) { p.x = x; p.z = z; moved = true; }
  else { if (canStand(x, p.z)) { p.x = x; moved = true; } if (canStand(p.x, z)) { p.z = z; moved = true; } }
  if (!moved) { destination = null; marker.visible = false; }
  p.y = groundHeight(p.x, p.z);
  return moved;
}

// ---------- UI ---------------------------------------------------------------
$('wind').addEventListener('input', e => { const v = Number(e.target.value) / 100; shared.uWind.value = v; audio?.setWind(v); $('wind-value').value = `${e.target.value}%`; });
$('snowfall').addEventListener('change', e => { forest.snow.points.visible = e.target.checked; });
$('sound').addEventListener('click', async () => {
  audio ??= createForestAudio();
  if (!audio) { $('sound').textContent = '✕ ไม่รองรับเสียง'; return; }
  audio.setWind(shared.uWind.value);
  const on = await audio.toggle();
  $('sound').setAttribute('aria-pressed', String(on)); $('sound').classList.toggle('on', on);
  $('sound').title = on ? 'ปิดเสียงป่า' : 'เปิดเสียงป่า'; $('sound').setAttribute('aria-label', $('sound').title);
});
function download(canvas, name) {
  canvas.toBlob(blob => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); });
}
$('export-sprite').addEventListener('click', () => download(character.sheet, 'novice-8dir-spritesheet.png'));
$('screenshot').addEventListener('click', () => download(renderer.domElement, 'big-forest.png'));
$('photo-toggle').addEventListener('click', () => document.body.classList.toggle('photo-mode'));

// Minimap: trees as dots on snow, player as a glowing point.
const mini = $('minimap'), mctx = mini.getContext('2d'), mbase = document.createElement('canvas');
mbase.width = mini.width; mbase.height = mini.height;
{
  const b = mbase.getContext('2d'); b.fillStyle = '#e7ecf4'; b.fillRect(0, 0, mini.width, mini.height);
  for (const t of trees) {
    b.fillStyle = t.kind === 'pine' ? '#3d5a4a' : '#6b8a5c';
    b.beginPath(); b.arc((t.x / HALF / 2 + .5) * mini.width, (t.z / HALF / 2 + .5) * mini.height, t.radius * .9, 0, Math.PI * 2); b.fill();
  }
}

// ---------- Loop ------------------------------------------------------------
const playerScreen = new THREE.Vector3(), playerView = new THREE.Vector3();
let elapsed = 0, previous = null, hud = 0;
renderer.setAnimationLoop(t => {
  if (document.hidden) { previous = null; return; }
  const dt = previous === null ? 0 : Math.min((t - previous) / 1000, .05); previous = t; elapsed += dt;
  const moving = movePlayer(dt);
  yaw += (targetYaw - yaw) * (1 - Math.exp(-dt * 8)); distance += (targetDistance - distance) * (1 - Math.exp(-dt * 6));
  character.update(dt, elapsed, moving, heading, yaw);
  focus.lerp(player.position, 1 - Math.exp(-dt * 4));
  camera.position.set(focus.x + Math.sin(yaw) * Math.cos(pitch) * distance, focus.y + Math.sin(pitch) * distance, focus.z + Math.cos(yaw) * Math.cos(pitch) * distance);
  camera.lookAt(focus.x, focus.y + .6, focus.z);
  // The shadow frustum follows the view so dappled shade stays crisp.
  sun.target.position.copy(focus); sun.position.copy(focus).add(sunOffset);
  forest.update(dt, elapsed, focus);
  // Tell foliage where the player is so it can open a window around them.
  playerScreen.copy(player.position).setY(player.position.y + 1).project(camera);
  shared.uPlayerUv.value.set(playerScreen.x * .5 + .5, playerScreen.y * .5 + .5);
  playerView.copy(player.position).applyMatrix4(camera.matrixWorldInverse); shared.uPlayerDepth.value = -playerView.z;
  if (marker.visible) marker.scale.setScalar(1 + Math.sin(elapsed * 6) * .12);
  if (t - hud > 100) {
    hud = t; mctx.drawImage(mbase, 0, 0);
    const p = player.position, mx = (p.x / HALF / 2 + .5) * mini.width, my = (p.z / HALF / 2 + .5) * mini.height;
    mctx.fillStyle = '#ff6f91'; mctx.shadowColor = '#ff6f91'; mctx.shadowBlur = 6; mctx.beginPath(); mctx.arc(mx, my, 3, 0, Math.PI * 2); mctx.fill(); mctx.shadowBlur = 0;
    $('coords').textContent = `${Math.round(p.x + HALF)}, ${Math.round(p.z + HALF)}`;
  }
  renderer.render(scene, camera);
});
$('loading').classList.add('done'); setTimeout(() => $('loading').hidden = true, 700);
