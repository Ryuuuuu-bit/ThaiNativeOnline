import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { buildNakMuay } from './placeholderNakMuay.js';
import { loadSpriteSheet, makeSpriteRig, viewRow, frameAt, clipFor } from './spriteHero.js';
import { CHARACTERS, DEFAULT_CHARACTER } from './characters.js';

const placeholders = { 'nak-muay': buildNakMuay };

// RO-style soft shadow disc under the feet.
function shadowDisc() {
  const disc = document.createElement('canvas'); disc.width = disc.height = 64;
  const ctx = disc.getContext('2d'), g = ctx.createRadialGradient(32, 32, 4, 32, 32, 31);
  g.addColorStop(0, '#1b244088'); g.addColorStop(.7, '#1b244055'); g.addColorStop(1, '#1b244000'); ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.1, .8), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(disc), transparent: true, depthWrite: false }));
  mesh.rotation.x = -Math.PI / 2; mesh.position.y = .03; return mesh;
}

// ---------- 3D model (glb, or procedural stand-in) --------------------------
async function loadModel(def) {
  let source = 'glb', root, clips;
  try {
    const gltf = await new GLTFLoader().loadAsync(def.url);
    root = gltf.scene; clips = {};
    for (const [state, name] of Object.entries(def.clips)) {
      const found = gltf.animations.find(a => a.name.toLowerCase() === name.toLowerCase());
      if (found) clips[state] = found;
    }
    const missing = Object.keys(def.clips).filter(s => !clips[s]);
    if (missing.length) console.warn(`[hero] ${def.url} has no clips for: ${missing.join(', ')} (found: ${gltf.animations.map(a => a.name).join(', ') || 'none'})`);
    root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
  } catch (error) {
    source = 'placeholder';
    console.info(`[hero] ${def.url} unavailable (${error.message ?? error}); using procedural stand-in`);
    ({ root, clips } = placeholders[def.placeholder]());
  }
  // Normalise to the configured height, feet on y=0, facing +Z.
  const box = new THREE.Box3().setFromObject(root), size = box.getSize(new THREE.Vector3());
  const scale = def.height / size.y; root.scale.setScalar(scale); root.position.y = -box.min.y * scale;
  return { root, clips, source };
}

function modelDriver(root, clips) {
  const mixer = new THREE.AnimationMixer(root), actions = {};
  for (const [state, clip] of Object.entries(clips)) {
    const a = mixer.clipAction(clip); actions[state] = a;
    if (!['idle', 'walk', 'guard'].includes(state)) { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; }
  }
  let current = null;
  return {
    has: state => !!actions[state],
    duration: state => actions[state].getClip().duration,
    play(state, fade = .12) {
      const next = actions[state]; if (!next || next === current) return;
      next.reset().fadeIn(fade).play(); current?.fadeOut(fade); current = next;
    },
    // Models rotate to their heading; the camera yaw is irrelevant.
    update(dt, { group, facing }) { group.rotation.y = facing; mixer.update(dt); },
  };
}

// ---------- Sprite sheet --------------------------------------------------
function spriteDriver(rig, cameraRef) {
  let state = 'idle', elapsed = 0, row = 0;
  return {
    has: s => !!rig.clips[s],
    duration: s => rig.clips[s].frames / rig.clips[s].fps,
    play(s) { if (s !== state) { state = s; elapsed = 0; } },
    update(dt, { facing, camera }) {
      elapsed += dt;
      row = viewRow(facing, cameraRef.yaw, row);
      const clip = clipFor(rig.clips, state, row) ?? clipFor(rig.clips, 'idle', row);
      if (!rig.show(state, row, frameAt(elapsed, clip))) rig.show('idle', row, frameAt(elapsed, clipFor(rig.clips, 'idle', row)));
      // Billboard toward the camera so the art never skews on the tilted ground.
      rig.root.quaternion.copy(camera.quaternion);
    },
  };
}

export async function createHero(scene, id = DEFAULT_CHARACTER, { onStep, cameraRef } = {}) {
  const def = CHARACTERS[id] ?? CHARACTERS[DEFAULT_CHARACTER];
  const group = new THREE.Group(); group.name = `hero:${id}`; scene.add(group);
  let driver, root, source;
  if (def.kind === 'sprite') {
    const sheet = await loadSpriteSheet(def.sheet);
    const rig = makeSpriteRig(sheet, def.unitsPerLab); root = rig.root; source = 'sprite';
    driver = spriteDriver(rig, cameraRef ?? { yaw: 0 });
  } else {
    const loaded = await loadModel(def); root = loaded.root; source = loaded.source;
    driver = modelDriver(root, loaded.clips);
  }
  group.add(root, shadowDisc());

  let busy = null, stance = null, stepPhase = 0, facing = 0;
  const lungeDir = new THREE.Vector3(), skills = Object.fromEntries(def.skills.map(s => [s.key, s]));
  const restState = () => stance ?? 'idle';
  const hero = {
    group, root, def, source, skills: def.skills,
    get busy() { return !!busy; },
    get guarding() { return !!stance; },
    useSkill(code) {
      const skill = skills[code];
      if (!skill || !driver.has(skill.clip)) return null;
      if (skill.toggle) { stance = stance ? null : skill.clip; if (!busy) driver.play(restState()); return skill; }
      if (busy) return null;
      busy = { skill, time: 0, duration: driver.duration(skill.clip) };
      lungeDir.set(Math.sin(facing), 0, Math.cos(facing));
      driver.play(skill.clip, .06);
      return skill;
    },
    // moving: whether input moved the hero this frame; heading: world yaw of travel or null.
    update(dt, moving, heading, camera) {
      if (heading !== null && !busy) facing = heading;
      let lunge = null;
      if (busy) {
        busy.time += dt;
        const l = busy.skill.lunge;
        if (l && busy.time > l.from && busy.time < l.to) lunge = lungeDir.clone().multiplyScalar(l.speed * dt);
        if (busy.time >= busy.duration) { busy = null; driver.play(restState(), .18); }
      } else if (moving) {
        driver.play('walk');
        const before = stepPhase; stepPhase = (stepPhase + dt / .4) % 1;
        if (stepPhase < before) onStep?.();
      } else driver.play(restState());
      driver.update(dt, { group, facing, camera });
      return lunge;
    },
  };
  driver.play('idle', 0);
  return hero;
}
