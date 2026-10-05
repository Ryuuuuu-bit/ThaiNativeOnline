import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Character, CLASSES, CLASS_IDS } from './character.js';
import { Dog } from './dog.js';
import { Effects } from './vfx.js';
import { LIMITS } from './skeleton.js';
import '../../style.css';
import './viewer.css';

const $ = id => document.getElementById(id);
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
$('stage').appendChild(renderer.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color('#d9d4c6'); scene.fog = new THREE.Fog('#d9d4c6', 9, 22);
const camera = new THREE.PerspectiveCamera(32, 1, .05, 60); camera.position.set(2.4, 1.55, 4.2);
const controls = new OrbitControls(camera, renderer.domElement); controls.target.set(0, .9, 0); controls.enableDamping = true; controls.minDistance = 1.2; controls.maxDistance = 10;
scene.add(new THREE.HemisphereLight('#fff6e6', '#6b6152', 2.2));
const key = new THREE.DirectionalLight('#fff1d6', 2.6); key.position.set(3, 6, 4); key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
Object.assign(key.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4 }); key.shadow.bias = -.0004; key.shadow.normalBias = .02; scene.add(key);
const rim = new THREE.DirectionalLight('#c9dcff', 1.2); rim.position.set(-4, 3, -4); scene.add(rim);
const floor = new THREE.Mesh(new THREE.CircleGeometry(12, 64), new THREE.MeshStandardMaterial({ color: '#cbc4b1', roughness: 1 }));
floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
const grid = new THREE.PolarGridHelper(3, 12, 6, 64, '#a99f88', '#bdb5a0'); grid.position.y = .002; scene.add(grid);

let current = null, dog = null, helper = null, mode = 'idle', loopSkill = true, travelZ = 0, lastSkill = null;
const effects = new Effects(scene);

function setClass(id) {
  if (current) { scene.remove(current.root); current.dispose(); }
  if (dog) { scene.remove(dog.root); dog = null; }
  if (helper) { scene.remove(helper); helper = null; }
  current = new Character(id); scene.add(current.root); travelZ = 0;
  current.on((event, c) => { effects.trigger(event, c); if (event.type === 'command') dog?.command(); });
  if (CLASSES[id].companion === 'dog') { dog = new Dog(current.materials); dog.root.position.set(-.9, 0, .5); scene.add(dog.root); }
  if ($('show-skeleton').checked) addHelper();
  document.querySelectorAll('#class-list button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.id === id)));
  const def = CLASSES[id];
  $('class-title').textContent = `${def.thai} · ${def.name}`; $('class-role').textContent = def.role;
  $('skill-buttons').replaceChildren(...current.skills.map(s => chip(`${s.thai}`, s.name, () => playSkill(s.id), `skill:${s.id}`)));
  mode = 'idle'; markActive();
  const deform = current.skeleton.bones.length - current.springSystem.joints.length - (current.nock ? 1 : 0);
  $('rig-info').innerHTML = `
    <span class="eyebrow">ข้อมูล rig</span>
    <dl><dt>กระดูกหลัก</dt><dd>${deform - current.springs.length} (Mixamo naming)</dd>
    <dt>กระดูกผ้า/พู่ (spring)</dt><dd>${current.springSystem.joints.length + current.springs.length}</dd>
    <dt>Skinned meshes</dt><dd>${current.meshes.length} วัสดุ</dd>
    <dt>สามเหลี่ยม</dt><dd>${Math.round(current.meshes.reduce((a, m) => a + m.geometry.attributes.position.count / 3, 0)).toLocaleString()}</dd>
    <dt>Animation clips</dt><dd>${Object.keys(current.clips).length}</dd></dl>
    <p>ขาใช้ IK สองข้อต่อ เท้าไม่ไถลบนพื้น ข้อต่อจำกัดมุมตามสรีระ (เข่า 0–${LIMITS.knee[1]}°, ศอก 0–${LIMITS.fore.flex[1]}°)</p>`;
}
function chip(label, title, onClick, id) {
  const b = document.createElement('button'); b.textContent = label; b.title = title; b.dataset.mode = id; b.addEventListener('click', onClick); return b;
}
function markActive() { document.querySelectorAll('.chips button').forEach(b => b.classList.toggle('active', b.dataset.mode === mode || b.dataset.mode === `skill:${lastSkill}` && mode === 'skill')); }
function playSkill(id) { travelZ = 0; current.root.position.z = 0; lastSkill = id; mode = 'skill'; current.play(id) || (current.skill = null, current.play(id)); markActive(); }

$('class-list').replaceChildren(...CLASS_IDS.map(id => {
  const b = document.createElement('button'); b.dataset.id = id;
  b.innerHTML = `<span class="class-icon">${CLASSES[id].icon}</span><span><b>${CLASSES[id].thai}</b><small>${CLASSES[id].name}</small></span>`;
  b.addEventListener('click', () => setClass(id)); return b;
}));
$('loco-buttons').replaceChildren(
  chip('ยืน', 'Idle', () => { mode = 'idle'; markActive(); }, 'idle'),
  chip('เดิน', 'Walk 1.2 m/s', () => { mode = 'walk'; markActive(); }, 'walk'),
  chip('วิ่ง', 'Run 3.1 m/s', () => { mode = 'run'; markActive(); }, 'run'),
  chip('เดินวงกลม', 'Walk/run around the circle with blending', () => { mode = 'circle'; markActive(); }, 'circle'),
);
function addHelper() { helper = new THREE.SkeletonHelper(current.model); helper.material.depthTest = false; helper.material.transparent = true; scene.add(helper); }
$('show-skeleton').addEventListener('change', e => {
  if (helper) { scene.remove(helper); helper = null; }
  if (e.target.checked) addHelper();
  for (const m of current.meshes) { m.material.transparent = e.target.checked; m.material.opacity = e.target.checked ? .35 : 1; }
});
$('loop-skill').addEventListener('change', e => loopSkill = e.target.checked);
$('export').addEventListener('click', async () => {
  const { GLTFExporter } = await import('three/addons/exporters/GLTFExporter.js');
  current.mixer.stopAllAction(); current.skeleton.pose(); current.model.updateMatrixWorld(true);
  const clips = Object.values(current.clips);
  new GLTFExporter().parse(current.model, glb => {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([glb], { type: 'model/gltf-binary' }));
    a.download = `thai-native-${current.classId}.glb`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    setClass(current.classId);
  }, err => console.error(err), { binary: true, animations: clips, onlyVisible: true });
});

function resize() {
  const w = innerWidth, h = innerHeight; renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();
const params = new URLSearchParams(location.search);
setClass(CLASS_IDS.includes(params.get('class')) ? params.get('class') : 'warrior');
if (params.get('skill')) playSkill(params.get('skill'));
if (params.get('mode')) { mode = params.get('mode'); markActive(); }
if (params.get('cam')) { const [x, y, z] = params.get('cam').split(',').map(Number); camera.position.set(x, y, z); }
if (params.get('target')) { const [x, y, z] = params.get('target').split(',').map(Number); controls.target.set(x, y, z); }

let angle = 0, last = performance.now(), fixedTime = params.has('t') ? Number(params.get('t')) : null;
function step(dt) {
  const scale = $('slow').checked ? .25 : 1; dt *= scale;
  let speed = 0;
  if (mode === 'walk') speed = 1.2; else if (mode === 'run') speed = 3.1;
  else if (mode === 'circle') {
    const t = performance.now() / 1000, s = 1.2 + 1.9 * (.5 + .5 * Math.sin(t * .5));
    speed = s; angle += dt * s / 2.2;
    current.root.position.set(Math.cos(angle) * 2.2, 0, Math.sin(angle) * 2.2); current.root.rotation.y = -angle;
  }
  if (mode !== 'circle' && mode !== 'skill') { current.root.position.set(0, 0, 0); current.root.rotation.y = 0; }
  if (mode === 'skill' && !current.busy) {
    if (loopSkill) { setTimeout(() => mode === 'skill' && !current.busy && playSkill(lastSkill), 350); mode = 'skill-wait'; }
    else { mode = 'idle'; markActive(); }
  }
  if (mode === 'skill-wait' && current.busy) mode = 'skill';
  const motion = current.update(dt, speed);
  if (current.skill) { travelZ += motion; current.root.position.z = travelZ; }
  dog?.update(dt, current, mode === 'circle' ? speed : 0);
  effects.update(dt);
}
renderer.setAnimationLoop(now => {
  const dt = Math.min(.05, (now - last) / 1000); last = now;
  if (fixedTime !== null) { // deterministic frame for screenshots: ?t=seconds
    for (let i = 0; i < Math.round(fixedTime * 60); i++) step(1 / 60);
    fixedTime = null; document.body.dataset.ready = '1';
  } else if (!params.has('pause')) step(dt);
  if (current.skill || mode === 'circle') controls.target.lerp(new THREE.Vector3(current.root.position.x, .9, current.root.position.z), .05);
  controls.update(); renderer.render(scene, camera);
});
$('loading').classList.add('done'); setTimeout(() => $('loading').hidden = true, 600);
