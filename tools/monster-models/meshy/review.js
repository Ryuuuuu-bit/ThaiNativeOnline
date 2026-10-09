import * as THREE from 'three';
import { gltfLoader } from '/src/core/gltf.js';
import { MONSTER_MODELS } from '/src/combat/MonsterModels.js';
import { MONSTERS } from '/src/combat/data/monsters.js';

const params=new URLSearchParams(location.search),set=params.get('set')||'1';
const watRang = set === '6';
const types = ({'1':['boar','fowl','crab'],'2':['cobra','monkey'],'3':['dhole','phibpa'],'4':['buffalo'],'5':['kongkoi','monitor','pray','khamot','winyan','takian'],'6':['headless','pret','krahang','krasue','phitaihong','soldier','pusom']}[set]||['boar','fowl','crab']);
document.querySelector('.creatures').innerHTML='<button data-type="all" class="active">ดูทั้งชุด</button>'+types.map(id=>`<button data-type="${id}">${MONSTERS[id].name} · Lv.${MONSTERS[id].level}</button>`).join('');
if(set==='2'||set==='3'){document.querySelector('header p').textContent=set==='2'?'ชุด Lv.2 · งูเห่านา และลิงกัง':'ชุด Lv.3 · หมาไน และผีป่า';document.querySelector('header .badge').href=`./motion.html?set=${set}`;document.querySelector('header small').textContent=`THAI NATIVE ONLINE · CREATURE STUDY 0${set}`;}
if(set==='4'){document.querySelector('header p').textContent='บอสทุ่งนา · ควายป่า Lv.4';document.querySelector('header .badge').href='./motion.html?set=4';document.querySelector('header small').textContent='THAI NATIVE ONLINE · PADDY BOSS';}
if(set==='5'){document.querySelector('header h1').textContent='ผู้พิทักษ์แห่งป่าลึก';document.querySelector('header p').textContent='ชุดป่าลึก · มอนสเตอร์ Lv.4–6';document.querySelector('header .badge').href='./motion.html?set=5';document.querySelector('header small').textContent='THAI NATIVE ONLINE · DEEP FOREST';}
if(watRang){document.title='Thai Native Online · Wat Rang creatures';document.querySelector('header h1').textContent='วิญญาณแห่งวัดร้าง';document.querySelector('header p').textContent='ชุดวัดร้าง · มอนสเตอร์ Lv.6–10';document.querySelector('header .badge').href='./motion.html?set=6';document.querySelector('header small').textContent='THAI NATIVE ONLINE · WAT RANG';document.body.style.background='#172b29';}
const canvas = document.querySelector('canvas'), host = canvas.parentElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.18;
const scene = new THREE.Scene(); scene.background = new THREE.Color('#73845b');
scene.add(new THREE.HemisphereLight('#dde8d3', '#5e6244', 2.5));
const sun = new THREE.DirectionalLight('#fff0c6', 3.1); sun.position.set(-3, 8, 4); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -.0003; sun.shadow.normalBias = .025;
Object.assign(sun.shadow.camera, { left: -7, right: 7, top: 5, bottom: -5 }); scene.add(sun);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: '#657a4b', roughness: 1 }));
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
if (watRang) { scene.background.set('#69736d'); ground.material.color.set('#58645a'); }
const camera = new THREE.OrthographicCamera(-5, 5, 3, -3, .05, 100);
const directions = { game: [15, 23, 22], front: [0, 3, 28], side: [28, 3, 0], back: [0, 3, -28], top: [.001, 28, 0] };
const models = [], old = [], footprints = [];
let type = params.get('type') || ((set==='5'||watRang)&&innerWidth<650?types[0]:'all'), view = 'game', spin = false, comparison = false;
if (!types.includes(type)) type = 'all';
const loader = gltfLoader();
function arrange() {
  const selected = type === 'all' ? types : [type];
  const offset = new THREE.Vector3(...directions[view]);
  const right = new THREE.Vector3(offset.z || 1, 0, -offset.x).normalize();
  const away = new THREE.Vector3(-right.z, 0, right.x).multiplyScalar(-2.5);
  const gap = .65, total = footprints.reduce((sum, radius) => sum + radius * 2 + gap, -gap);
  let cursor = -total / 2;
  if (watRang) {
    const shadowHalf = type === 'all' ? total / 2 + 4 : comparison ? Math.max(5, Math.max(...footprints) * 3 + 2) : 5;
    Object.assign(sun.shadow.camera, { left: -shadowHalf, right: shadowHalf, top: shadowHalf, bottom: -shadowHalf }); sun.shadow.camera.updateProjectionMatrix();
  }
  models.forEach((m, i) => {
    m.visible = selected.includes(types[i]);
    m.position.copy(right).multiplyScalar(type === 'all' ? (i - (types.length-1)/2) * 3.4 : (comparison ? 1.5 : 0));
    old[i].visible = comparison && m.visible;
    old[i].position.copy(type === 'all' ? m.position.clone().add(away) : right.clone().multiplyScalar(-1.5));
    if (watRang) {
      const radius = footprints[i], distance = type === 'all' ? cursor + radius : comparison ? radius + .5 : 0;
      cursor += radius * 2 + gap;
      m.position.copy(right).multiplyScalar(distance); m.position.y = (MONSTER_MODELS[types[i]].lift ?? 0) * MONSTERS[types[i]].size;
      old[i].position.copy(type === 'all' ? m.position.clone().add(away.clone().normalize().multiplyScalar(Math.max(...footprints) * 2 + .75)) : right.clone().multiplyScalar(-distance));
      old[i].position.y = m.position.y;
    }
  });
  document.querySelector('#labels').innerHTML = selected.map(id => `<div><strong>${MONSTERS[id].name}</strong><span>Lv.${MONSTERS[id].level} · ${MONSTERS[id].hp} HP</span></div>`).join('');
  document.querySelectorAll('[data-type]').forEach(b => b.classList.toggle('active', b.dataset.type === type));
  resize();
}
function resize() {
  renderer.setSize(host.clientWidth, host.clientHeight, false);
  const aspect = host.clientWidth / host.clientHeight;
  if (watRang) { fitWatRangCamera(aspect); return; }
  const height=type==='all'?2:MONSTER_MODELS[type].height;
  const forestSingle=set==='5'&&type!=='all';
  const width = type === 'all' ? 3.4*types.length+.2 : comparison ? 5.6 : forestSingle?(type==='monitor'?3.8:Math.max(2.4,height*1.35)):3.2;
  const half = Math.max(width / 2 / aspect, forestSingle?height*.70+.12:set==='5'?1.8:type === 'all' ? 1.7 : set==='3'||set==='4'?1.4:1.15, view==='top'?(type==='monitor'?1.9:set==='4'?1.8:0):0);
  Object.assign(camera, { left: -half * aspect, right: half * aspect, top: half, bottom: -half });
  const offset = new THREE.Vector3(...directions[view]);
  const target = new THREE.Vector3(0, forestSingle?height*.55:set==='5'?1.0:set==='3'||set==='4'?.85:.5, 0);
  if (comparison && type === 'all') target.add(new THREE.Vector3(-offset.x, 0, -offset.z).normalize().multiplyScalar(1.1));
  if (view === 'top') camera.up.set(0, 0, -1); else camera.up.set(0, 1, 0);
  camera.position.copy(target).add(new THREE.Vector3(...directions[view])); camera.lookAt(target); camera.updateProjectionMatrix();
}
// Fit actual scaled/lifted bounds, including a swept footprint for turntables.
function fitWatRangCamera(aspect) {
  const offset = new THREE.Vector3(...directions[view]), forward = offset.clone().normalize();
  camera.up.set(0, view === 'top' ? 0 : 1, view === 'top' ? -1 : 0);
  const right = new THREE.Vector3().crossVectors(camera.up, forward).normalize(), up = new THREE.Vector3().crossVectors(forward, right);
  const boxes = [], bounds = new THREE.Box3();
  for (let i = 0; i < models.length; i++) for (const model of [models[i], old[i]]) {
    if (!model.visible) continue;
    const box = new THREE.Box3().setFromObject(model), size = box.getSize(new THREE.Vector3()), radius = Math.hypot(size.x, size.z) / 2 + .06;
    box.min.x = model.position.x - radius; box.max.x = model.position.x + radius;
    box.min.z = model.position.z - radius; box.max.z = model.position.z + radius;
    box.min.y = Math.min(0, box.min.y); boxes.push(box); bounds.union(box);
  }
  const target = bounds.getCenter(new THREE.Vector3());
  let halfWidth = 0, halfHeight = 0;
  for (const box of boxes) for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
    const point = new THREE.Vector3(x, y, z).sub(target);
    halfWidth = Math.max(halfWidth, Math.abs(point.dot(right))); halfHeight = Math.max(halfHeight, Math.abs(point.dot(up)));
  }
  const half = Math.max((halfWidth * 1.2 + .2) / aspect, halfHeight * 1.3 + .2);
  Object.assign(camera, { left: -half * aspect, right: half * aspect, top: half, bottom: -half });
  camera.position.copy(target).add(offset); camera.lookAt(target); camera.updateProjectionMatrix();
}
for (const id of types) {
  const gltf = await loader.loadAsync(`./${id}.glb`), model = gltf.scene;
  model.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(model), dimensions = bounds.getSize(new THREE.Vector3());
  const outerScale = watRang ? MONSTERS[id].size : 1;
  const group = new THREE.Group(); group.add(model); group.scale.setScalar(MONSTER_MODELS[id].height * outerScale / dimensions.y);
  model.position.set(-(bounds.min.x + bounds.max.x) / 2, -bounds.min.y, -(bounds.min.z + bounds.max.z) / 2);
  group.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  models.push(group); scene.add(group);
  const baseline = await loader.loadAsync(`./baseline/${id}.glb`), original = baseline.scene;
  original.updateMatrixWorld(true);
  const oldBox = new THREE.Box3().setFromObject(original), oldSize = oldBox.getSize(new THREE.Vector3());
  const oldGroup = new THREE.Group(); oldGroup.scale.setScalar(MONSTER_MODELS[id].height * outerScale / oldSize.y);
  original.position.set(-(oldBox.min.x + oldBox.max.x) / 2, -oldBox.min.y, -(oldBox.min.z + oldBox.max.z) / 2);
  oldGroup.add(original); old.push(oldGroup); scene.add(oldGroup);
  footprints.push(Math.max(1.1, Math.hypot(dimensions.x, dimensions.z) * group.scale.x / 2, Math.hypot(oldSize.x, oldSize.z) * oldGroup.scale.x / 2));
}
document.querySelector('#status').textContent = 'โมเดล 3D จริง · เปลี่ยนมุมกล้องเพื่อตรวจรอบตัว';
document.querySelectorAll('[data-type]').forEach(b => b.onclick = () => { type = b.dataset.type; arrange(); });
document.querySelectorAll('[data-view]').forEach(b => b.onclick = () => {
  view = b.dataset.view; document.querySelectorAll('[data-view]').forEach(x => x.classList.toggle('active', x === b)); arrange();
});
document.querySelector('#spin').onclick = () => { spin = !spin; document.querySelector('#spin').setAttribute('aria-pressed', String(spin)); };
document.querySelector('#compare').onchange = e => { comparison = e.target.checked; arrange(); };
addEventListener('resize', resize);
arrange();
let previous = performance.now();
renderer.setAnimationLoop(now => {
  const dt = Math.min(.1, (now - previous) / 1000); previous = now;
  if (spin) models.forEach(m => m.rotation.y += dt * .35);
  old.forEach(m => m.userData.animate?.(now / 1000, false, false));
  renderer.render(scene, camera);
});
window.monsterReview = { models, old, scene, renderer, camera, types, setRotation: angle => models.forEach(m => m.rotation.y = angle) };
window.reviewReady = true;
