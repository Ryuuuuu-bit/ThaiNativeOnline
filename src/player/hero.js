import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { buildNakMuay } from './placeholderNakMuay.js';
import { CHARACTERS } from './characters.js';

const placeholders = { 'nak-muay': buildNakMuay };

// Loads a character's .glb; on any failure (404 while the Blender export does
// not exist yet, broken file) the procedural stand-in takes its place. Either
// way the caller gets the same {root, clips} contract.
async function loadModel(def) {
  let source = 'glb';
  let root, clips;
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
  const scale = def.height / size.y; root.scale.setScalar(scale);
  root.position.y = -box.min.y * scale;
  return { root, clips, source };
}

export async function createHero(scene, id = 'nak-muay', { onStep } = {}) {
  const def = CHARACTERS[id];
  const group = new THREE.Group(); group.name = `hero:${id}`; scene.add(group);
  const { root, clips, source } = await loadModel(def);
  group.add(root);
  // RO-style soft shadow disc under the feet; real shadows still fall on the ground.
  const disc = document.createElement('canvas'); disc.width = disc.height = 64;
  const ctx = disc.getContext('2d'), g = ctx.createRadialGradient(32, 32, 4, 32, 32, 31);
  g.addColorStop(0, '#1b244088'); g.addColorStop(.7, '#1b244055'); g.addColorStop(1, '#1b244000'); ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.1, .8), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(disc), transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = .03; group.add(shadow);

  const mixer = new THREE.AnimationMixer(root);
  const actions = {};
  for (const [state, clip] of Object.entries(clips)) {
    const a = mixer.clipAction(clip); actions[state] = a;
    if (['elbow', 'knee'].includes(state)) { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; }
  }
  let current = null, busy = null, guarding = false, stepPhase = 0, facing = 0;
  const lungeDir = new THREE.Vector3();
  const skills = Object.fromEntries(def.skills.map(s => [s.key, s]));

  function play(state, fade = .12) {
    const next = actions[state];
    if (!next || next === current) return;
    next.reset().fadeIn(fade).play();
    current?.fadeOut(fade);
    current = next;
  }
  const hero = {
    group, root, def, source, skills: def.skills, mixer,
    get busy() { return !!busy; },
    get guarding() { return guarding; },
    // Fire a hotbar skill by key code; returns the skill if it started.
    useSkill(code) {
      const skill = skills[code];
      if (!skill || !actions[skill.clip]) return null;
      if (skill.toggle) { guarding = !guarding; if (!busy) play(guarding ? skill.clip : 'idle'); return skill; }
      if (busy) return null;
      busy = { skill, time: 0, duration: actions[skill.clip].getClip().duration };
      lungeDir.set(Math.sin(facing), 0, Math.cos(facing));
      play(skill.clip, .06);
      return skill;
    },
    // moving: whether input moved the hero this frame; heading: world yaw of travel or null.
    update(dt, moving, heading) {
      if (heading !== null && !busy) { facing = heading; group.rotation.y = heading; }
      let lunge = null;
      if (busy) {
        busy.time += dt;
        const l = busy.skill.lunge;
        if (l && busy.time > l.from && busy.time < l.to) lunge = lungeDir.clone().multiplyScalar(l.speed * dt);
        if (busy.time >= busy.duration) { busy = null; play(guarding ? 'guard' : 'idle', .18); }
      } else if (moving) {
        play('walk');
        const before = stepPhase; stepPhase = (stepPhase + dt / .4) % 1;
        if (stepPhase < before) onStep?.();
      } else play(guarding ? 'guard' : 'idle');
      mixer.update(dt);
      return lunge;
    },
  };
  play('idle', 0);
  return hero;
}
