import * as THREE from 'three';
import { buildWorld, groundHeight, obstacles, landmarks, treePositions, pathX, riverX, inWater, windUniforms } from './world.js';
import { Character, CLASSES, CLASS_IDS } from './characters/character.js';
import { Dog } from './characters/dog.js';
import { Effects } from './characters/vfx.js';
import './style.css';

const $ = id => document.getElementById(id);
const host = $('world');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
} catch (error) {
  document.body.dataset.error = 'webgl';
  $('loading').querySelector('p').textContent = 'ไม่สามารถเปิด WebGL ได้ กรุณาเปิด hardware acceleration แล้วลองใหม่';
  throw error;
}
host.appendChild(renderer.domElement);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.18;
const scene = new THREE.Scene();
scene.background = new THREE.Color('#b9c6a4');
scene.fog = new THREE.FogExp2('#b9c6a4', .016);
const camera = new THREE.OrthographicCamera(-20, 20, 12, -12, .1, 150);
const cameraOffset = new THREE.Vector3(15, 23, 22);
const focus = new THREE.Vector3(0, 0, -2.5), desiredFocus = focus.clone();
let zoom = 1, cameraPanned = false;
const hemisphere = new THREE.HemisphereLight('#dde8d3', '#5e6244', 2.5); scene.add(hemisphere);
const sun = new THREE.DirectionalLight('#fff0c6', 3.1); sun.position.set(-12, 24, -8); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -32, right: 32, top: 32, bottom: -32, near: 1, far: 90 });
sun.shadow.bias = -.0003; sun.shadow.normalBias = .035; sun.shadow.radius = 3; scene.add(sun);
const world = buildWorld(scene), effects = new Effects(scene);
// The player is a rigged class character (see src/characters). Ground speeds
// are in world meters; the animation phase is synced to them so feet don't slide.
const PLAYER_SCALE = .92, RUN_SPEED = 3.1, WALK_SPEED = 1.2;
const player = { group: null, char: null, dog: null, heading: 0 };
const selectionRing = new THREE.Mesh(new THREE.RingGeometry(.36, .4, 48), new THREE.MeshBasicMaterial({ color: '#e1c983', transparent: true, opacity: .7, side: THREE.DoubleSide }));
selectionRing.rotation.x = -Math.PI / 2; selectionRing.position.y = .04;
function readClass() { try { const id = localStorage.getItem('tno.class'); return CLASS_IDS.includes(id) ? id : 'warrior'; } catch { return 'warrior'; } }
function setClass(id) {
  const previous = player.char, position = previous ? previous.root.position.clone() : new THREE.Vector3(1.4, 0, 3);
  if (previous) { scene.remove(previous.root); previous.dispose(); }
  if (player.dog) { scene.remove(player.dog.root); player.dog = null; }
  const char = new Character(id, { scale: PLAYER_SCALE });
  char.root.position.copy(position); char.root.rotation.y = player.heading; char.root.add(selectionRing); scene.add(char.root);
  char.on(event => { effects.trigger(event, char); if (event.type === 'command') player.dog?.command(); });
  player.char = char; player.group = char.root;
  if (CLASSES[id].companion === 'dog') {
    player.dog = new Dog(char.materials); player.dog.root.scale.setScalar(PLAYER_SCALE);
    player.dog.root.position.copy(position).add(new THREE.Vector3(-.8, 0, -.4)); scene.add(player.dog.root);
  }
  try { localStorage.setItem('tno.class', id); } catch { /* storage unavailable */ }
  $('class-select').value = id; $('portrait').textContent = CLASSES[id].icon;
  $('hotbar').replaceChildren(...char.skills.map((skill, i) => {
    const b = document.createElement('button'); b.title = skill.name;
    b.innerHTML = `<kbd>${i + 1}</kbd>${skill.thai}<small>${skill.name}</small>`;
    b.addEventListener('click', () => castSkill(i)); return b;
  }));
}
function castSkill(i) {
  const skill = player.char.skills[i]; if (!skill) return;
  if (player.char.play(skill.id)) { destination = null; clickMarker.visible = false; }
}
$('class-select').replaceChildren(...CLASS_IDS.map(id => new Option(`${CLASSES[id].thai} · ${CLASSES[id].name}`, id)));
$('class-select').addEventListener('change', event => { setClass(event.target.value); event.target.blur(); });
const keys = new Set(), raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2();
const clickMarker = new THREE.Mesh(new THREE.RingGeometry(.2, .27, 40), new THREE.MeshBasicMaterial({ color: '#fff0b2', transparent: true, opacity: .8, side: THREE.DoubleSide, depthWrite: false }));
clickMarker.rotation.x = -Math.PI / 2; clickMarker.visible = false; scene.add(clickMarker);
let destination = null, pan = null, photo = false, explored = false, elapsed = 0, previousTime = null, nearby = null;
let toastTimer;
const forward = new THREE.Vector3(-cameraOffset.x, 0, -cameraOffset.z).normalize();
const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

function resize() {
  const width = host.clientWidth, height = host.clientHeight, aspect = width / height;
  const halfHeight = 13 / zoom;
  camera.left = -halfHeight * aspect; camera.right = halfHeight * aspect; camera.top = halfHeight; camera.bottom = -halfHeight;
  camera.updateProjectionMatrix(); renderer.setSize(width, height);
}
window.addEventListener('resize', resize); resize();
function toast(text) { clearTimeout(toastTimer); $('toast').textContent = text; $('toast').hidden = false; toastTimer = setTimeout(() => $('toast').hidden = true, 5000); }
function resetCamera() { cameraPanned = false; zoom = 1; resize(); }
function setPhoto() { photo = !photo; document.body.classList.toggle('photo-mode', photo); $('restore-ui').hidden = !photo; }
function explore() {
  if (!nearby) return;
  if (nearby.kind === 'chedi') {
    explored = true; $('quest-symbol').textContent = '✓'; $('quest-text').textContent = 'ค้นพบเจดีย์กลางป่าแล้ว';
    toast('เจดีย์เก่า · รากไม้โอบล้อมอิฐที่ผ่านกาลเวลา สถานที่แห่งนี้จะเป็นจุดเริ่มต้นของเรื่องราวในบทต่อไป');
  } else if (nearby.kind === 'pavilion') toast('ศาลาริมคลอง · สายลมพัดผ่านหลังคาไม้ และบัวค่อย ๆ ลอยตามผิวน้ำ');
  else toast('ศาลเจ้าป่า · พวงมาลัยเก่าบอกว่ามีผู้เดินทางมาที่นี่ก่อนคุณ');
}
const movementCodes = ['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowLeft','ArrowDown','ArrowRight'];
window.addEventListener('keydown', event => {
  if (['INPUT','SELECT','TEXTAREA','BUTTON'].includes(event.target.tagName)) return;
  if (movementCodes.includes(event.code)) { event.preventDefault(); keys.add(event.code); destination = null; clickMarker.visible = false; }
  if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') keys.add(event.code);
  if (!event.repeat) {
    if (event.code === 'KeyR') resetCamera();
    if (event.code === 'KeyH') setPhoto();
    if (event.code === 'KeyE') explore();
    if (['Digit1', 'Digit2', 'Digit3'].includes(event.code)) castSkill(Number(event.code.slice(5)) - 1);
    if (event.code === 'Escape') { $('settings').hidden = true; $('settings-toggle').setAttribute('aria-expanded','false'); if (photo) setPhoto(); }
  }
});
window.addEventListener('keyup', event => keys.delete(event.code));
window.addEventListener('blur', () => { keys.clear(); pan = null; });
document.addEventListener('visibilitychange', () => { keys.clear(); previousTime = null; });
host.addEventListener('contextmenu', event => event.preventDefault());
host.addEventListener('pointerdown', event => {
  if (event.button === 2) {
    pan = { x: event.clientX, y: event.clientY, start: desiredFocus.clone() }; host.setPointerCapture(event.pointerId); cameraPanned = true;
  } else if (event.button === 0) {
    const rect = host.getBoundingClientRect(); pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);
    raycaster.setFromCamera(pointer,camera); const hit = raycaster.intersectObject(world.ground)[0];
    if (hit && canStand(hit.point.x, hit.point.z)) {
      destination = hit.point.clone(); clickMarker.position.set(hit.point.x, groundHeight(hit.point.x,hit.point.z)+.07,hit.point.z); clickMarker.visible=true;
    }
  }
});
host.addEventListener('pointermove', event => {
  if (!pan) return;
  const pixelsToWorld = (camera.top-camera.bottom)/host.clientHeight;
  const dx=(event.clientX-pan.x)*pixelsToWorld, dy=(event.clientY-pan.y)*pixelsToWorld;
  desiredFocus.copy(pan.start).addScaledVector(right,-dx).addScaledVector(forward,dy*1.5);
  desiredFocus.x=THREE.MathUtils.clamp(desiredFocus.x,-14,14); desiredFocus.z=THREE.MathUtils.clamp(desiredFocus.z,-16,16);
});
host.addEventListener('pointerup', () => pan=null);
host.addEventListener('pointercancel', () => pan=null);
host.addEventListener('wheel', event => { event.preventDefault(); zoom=THREE.MathUtils.clamp(zoom-event.deltaY*.001, .65, 1.8); resize(); },{passive:false});
for (const button of document.querySelectorAll('[data-move]')) {
  const code = {up:'KeyW',left:'KeyA',down:'KeyS',right:'KeyD'}[button.dataset.move];
  button.addEventListener('pointerdown',event=>{event.preventDefault();button.setPointerCapture(event.pointerId);keys.add(code);destination=null;clickMarker.visible=false;});
  for(const name of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(name,()=>keys.delete(code));
}
function canStand(x,z) {
  if (Math.abs(x)>25 || Math.abs(z)>25 || inWater(x+.35,z)) return false;
  return !obstacles.some(o=>Math.hypot(x-o.x,z-o.z)<o.radius+.25);
}
function movePlayer(dt) {
  const direction=new THREE.Vector3(), char=player.char, p=player.group.position;
  if(keys.has('KeyW')||keys.has('ArrowUp'))direction.add(forward);
  if(keys.has('KeyS')||keys.has('ArrowDown'))direction.sub(forward);
  if(keys.has('KeyD')||keys.has('ArrowRight'))direction.add(right);
  if(keys.has('KeyA')||keys.has('ArrowLeft'))direction.sub(right);
  if(destination && !direction.lengthSq()) {
    direction.subVectors(destination,p);direction.y=0;
    if(direction.length()<.14){destination=null;clickMarker.visible=false;direction.set(0,0,0);}
  }
  // Skills root the character; only their own root motion moves it.
  if(char.busy)direction.set(0,0,0);
  let speed=0;
  const step=(dx,dz)=>{
    const x=p.x+dx,z=p.z+dz;let moved=false;
    if(canStand(x,z)){p.x=x;p.z=z;moved=true;}
    else {if(canStand(x,p.z)){p.x=x;moved=true;}if(canStand(p.x,z)){p.z=z;moved=true;}}
    return moved;
  };
  if(direction.lengthSq()){
    direction.normalize();
    const target=Math.atan2(direction.x,direction.z);let turn=target-player.heading;turn=Math.atan2(Math.sin(turn),Math.cos(turn));
    player.heading+=turn*Math.min(1,dt*14);
    speed=keys.has('ShiftLeft')||keys.has('ShiftRight')?WALK_SPEED:RUN_SPEED;
    if(!step(direction.x*speed*dt,direction.z*speed*dt)){speed=0;if(destination){destination=null;clickMarker.visible=false;toast('เส้นทางถูกกีดขวาง ลองเดินอ้อมด้วย W A S D');}}
  }
  const motion=char.update(dt,speed/PLAYER_SCALE);
  if(motion)step(Math.sin(player.heading)*motion,Math.cos(player.heading)*motion);
  p.y=groundHeight(p.x,p.z);player.group.rotation.y=player.heading;
  if(player.dog){player.dog.update(dt,char,speed);const d=player.dog.root.position;d.y=groundHeight(d.x,d.z);}
  effects.update(dt);
}

$('reset-camera').addEventListener('click',resetCamera);
$('photo-mode').addEventListener('click',setPhoto);$('restore-ui').addEventListener('click',setPhoto);
$('interaction').addEventListener('click',explore);
$('settings-toggle').addEventListener('click',()=>{const hidden=!$('settings').hidden;$('settings').hidden=hidden;$('settings-toggle').setAttribute('aria-expanded',String(!hidden));});
$('settings-close').addEventListener('click',()=>{$('settings').hidden=true;$('settings-toggle').setAttribute('aria-expanded','false');});
$('wind').addEventListener('input',event=>{windUniforms.uWind.value=Number(event.target.value)/100;$('wind-value').value=`${event.target.value}%`;});
$('particles').addEventListener('change',event=>{world.atmosphere.particles.visible=event.target.checked;world.atmosphere.leaves.visible=event.target.checked;});
$('quality').addEventListener('change',event=>{
  const high=event.target.value==='high';renderer.setPixelRatio(high?Math.min(devicePixelRatio,2):1);sun.shadow.mapSize.set(high?2048:1024,high?2048:1024);
  if(sun.shadow.map){sun.shadow.map.dispose();sun.shadow.map=null;}renderer.shadowMap.needsUpdate=true;resize();
});
$('time-of-day').addEventListener('change',event=>{
  const evening=event.target.value==='evening';scene.background.set(evening?'#bdab92':'#b9c6a4');scene.fog.color.copy(scene.background);
  sun.color.set(evening?'#ffd09c':'#fff0c6');sun.intensity=evening?2.3:3.1;sun.position.set(evening?-20:-12,evening?13:24,-8);
  hemisphere.color.set(evening?'#c9c0bc':'#dde8d3');hemisphere.intensity=evening?1.8:2.5;
  world.water.uniforms.uTint.value.set(evening?'#748571':'#648e7b');
  $('weather-label').textContent=evening?'เย็น · แสงสุดท้ายของวัน':'เช้า · สายลมอ่อน';
});

// Optional ambience is synthesized locally; no audio download or autoplay.
let audioContext, audioGain, birdTimer, soundEnabled=false;
function chirp() {
  if(!audioContext||!soundEnabled)return;
  const start=audioContext.currentTime;
  for(let i=0;i<3;i++) {
    const oscillator=audioContext.createOscillator(),gain=audioContext.createGain();oscillator.type='sine';
    oscillator.frequency.setValueAtTime(2100+i*170,start+i*.17);oscillator.frequency.exponentialRampToValueAtTime(3300+i*80,start+i*.17+.07);
    gain.gain.setValueAtTime(0,start+i*.17);gain.gain.linearRampToValueAtTime(.025,start+i*.17+.015);gain.gain.exponentialRampToValueAtTime(.0001,start+i*.17+.13);
    oscillator.connect(gain);gain.connect(audioGain);oscillator.start(start+i*.17);oscillator.stop(start+i*.17+.15);
  }
  birdTimer=setTimeout(chirp,4500+Math.random()*6000);
}
$('sound').addEventListener('click',async()=>{
  if(!audioContext) {
    const Audio=window.AudioContext||window.webkitAudioContext;
    if(!Audio){toast('เบราว์เซอร์นี้ไม่รองรับเสียงบรรยากาศ');return;}
    audioContext=new Audio();audioGain=audioContext.createGain();audioGain.gain.value=0;audioGain.connect(audioContext.destination);
    const buffer=audioContext.createBuffer(1,audioContext.sampleRate*3,audioContext.sampleRate),data=buffer.getChannelData(0);
    for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*.25;
    const source=audioContext.createBufferSource();source.buffer=buffer;source.loop=true;
    const filter=audioContext.createBiquadFilter();filter.type='lowpass';filter.frequency.value=550;source.connect(filter);filter.connect(audioGain);source.start();
  }
  await audioContext.resume();soundEnabled=!soundEnabled;audioGain.gain.setTargetAtTime(soundEnabled?.32:0,audioContext.currentTime,.35);
  $('sound').setAttribute('aria-pressed',String(soundEnabled));$('sound').style.color=soundEnabled?'#edce8b':'';
  $('sound').title=soundEnabled?'ปิดเสียงบรรยากาศ':'เปิดเสียงบรรยากาศ';$('sound').setAttribute('aria-label',$('sound').title);
  clearTimeout(birdTimer);if(soundEnabled)chirp();
});

const mini=$('minimap'),ctx=mini.getContext('2d'),miniBase=document.createElement('canvas');miniBase.width=220;miniBase.height=168;
const base=miniBase.getContext('2d'),mapX=x=>(x/58+.5)*220,mapY=z=>(z/58+.5)*168;
base.fillStyle='#526443';base.fillRect(0,0,220,168);
base.fillStyle='#739183';base.beginPath();base.moveTo(220,0);for(let i=0;i<=58;i++)base.lineTo(mapX(riverX(i-29)-2.2),mapY(i-29));base.lineTo(220,168);base.closePath();base.fill();
base.strokeStyle='#baae7e';base.lineWidth=6;base.beginPath();for(let i=0;i<=58;i++)i?base.lineTo(mapX(pathX(i-29)),mapY(i-29)):base.moveTo(mapX(pathX(-29)),mapY(-29));base.stroke();
base.lineWidth=3;for(const l of landmarks){base.beginPath();base.moveTo(mapX(pathX(l.z)),mapY(l.z));base.lineTo(mapX(l.x),mapY(l.z));base.stroke();}
for(const tree of treePositions){base.fillStyle='#2f4936';base.beginPath();base.arc(mapX(tree.x),mapY(tree.z),tree.radius*2.5,0,Math.PI*2);base.fill();}
for(const l of landmarks){base.fillStyle=l.kind==='chedi'?'#d8bd83':'#a99874';base.fillRect(mapX(l.x)-3,mapY(l.z)-3,6,6);}
function updateMini(){ctx.drawImage(miniBase,0,0);const p=player.group.position;ctx.fillStyle='#fff1b7';ctx.shadowColor='#fff2b8';ctx.shadowBlur=7;ctx.beginPath();ctx.arc(mapX(p.x),mapY(p.z),3,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;$('coords').textContent=`${p.x.toFixed(0)}, ${p.z.toFixed(0)}`;}
function updateInteraction(){
  nearby=landmarks.find(l=>Math.hypot(l.x-player.group.position.x,l.z-player.group.position.z)<l.radius+1.7)||null;
  $('interaction').hidden=!nearby;if(nearby)$('interaction').querySelector('span').textContent=`สำรวจ${nearby.name}`;
}
let lastHud=0;
renderer.setAnimationLoop(timestamp=>{
  if(document.hidden){previousTime=null;return;}
  const dt=previousTime===null?0:Math.min((timestamp-previousTime)/1000,.05);previousTime=timestamp;elapsed+=dt;
  movePlayer(dt);world.update(elapsed,dt);
  if(!cameraPanned)desiredFocus.set(player.group.position.x*.55,0,player.group.position.z*.55-3.5);
  focus.lerp(desiredFocus,1-Math.exp(-dt*3));camera.position.copy(focus).add(cameraOffset);camera.lookAt(focus);
  if(clickMarker.visible){clickMarker.scale.setScalar(1+Math.sin(elapsed*5)*.12);}
  if(timestamp-lastHud>100){updateMini();updateInteraction();lastHud=timestamp;}
  renderer.render(scene,camera);
});
// A completed first render, rather than a timeout, dismisses the loading screen.
setClass(readClass());
camera.position.copy(focus).add(cameraOffset);camera.lookAt(focus);renderer.render(scene,camera);
$('loading').classList.add('done');setTimeout(()=>$('loading').hidden=true,700);
