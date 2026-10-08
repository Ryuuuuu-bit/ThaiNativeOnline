import * as THREE from 'three';
import { gltfLoader } from '../core/gltf.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { cachedLoader } from '../core/retry.js';
import { versioned } from '../core/version.js';

// One parse per GLB: every character of a class (the player, each other player on the map) is a
// clone of the same loaded scene, with its own materials (tints) over shared geometry and textures.
// A load is retried a few times (phones drop connections), see src/core/retry.js.
const loadOnce = cachedLoader(url => gltfLoader().loadAsync(versioned(url)));
const loadShared = url => {
  return loadOnce(url).then(gltf => {
    const scene = cloneSkinned(gltf.scene);
    scene.traverse(o => { if (o.isMesh) o.material = Array.isArray(o.material) ? o.material.map(m => m.clone()) : o.material.clone(); });
    return { scene, animations: gltf.animations };
  });
};

// A 3D player character loaded from a GLB (e.g. a Tripo export). Interface:
// { group, update(dt, time, moving, heading) },
// plus attack(name) for one-shot moves. The model is expected to face +Z with
// its feet at y = 0 (Tripo's default).
//
// Clip names from Tripo are often the whole animation prompt, so they are mapped
// to game names by pattern (first match wins). Unrigged meshes fall back to a
// procedural bob/sway; rigged ones without an idle clip hold the first frame of
// the guard clip (a fighting stance) instead of the T-pose.
const CLIP_NAMES = [
  ['attack_combo', /jab-cross|combination|combo/i],
  ['attack_jab', /\bjab\b/i],
  ['skill_teep', /teep|push kick/i],
  ['attack_kick_front', /front[_ ]?kick/i],
  ['attack_kick_body', /roundhouse|kick_body/i],
  ['skill_crocodile_tail', /crocodile|spinning back/i],
  ['walk', /walk/i],
  ['run', /\brun\b|run\./i],
  ['idle', /idle|stand/i],
  ['hurt', /hurt|hit react/i],
  ['die', /\bdie\b|death|knock ?out/i],
];
// Clips already exported under a game name (e.g. "boxer_croc", "walk.001") keep it.
const EXACT = /^(boxer_[a-z]+|idle|walk|run|hurt|die|attack_[a-z_]+|skill_[a-z_]+)$/;
const gameName = clipName => {
  const bare = clipName.replace(/\.\d+$/, '');
  if (EXACT.test(bare)) return bare;
  return CLIP_NAMES.find(([, re]) => re.test(clipName))?.[0] ?? clipName;
};

// Keep animations in place: drop horizontal travel of the root bone so the game,
// not the clip, moves the character.
function pinRoot(clip) {
  for (const track of clip.tracks) {
    if (!/hips\.position$/i.test(track.name)) continue;
    const v = track.values, x0 = v[0], z0 = v[2];
    for (let i = 0; i < v.length; i += 3) { v[i] = x0; v[i + 2] = z0; }
  }
  return clip;
}

export function makeModelCharacter(scene, onStep, { url, height = 2.6, guardClip = 'attack_jab' } = {}) {
  const group = new THREE.Group(); scene.add(group);
  const body = new THREE.Group(); group.add(body);

  let mixer = null, current = null, oneShot = null, tintFade = null;
  const tinted = [];
  const actions = {};
  const ready = loadShared(url).then(gltf => {
    const model = gltf.scene;
    // Refresh cloned skin bind inverses before Box3 samples quantised vertices.
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model), size = box.getSize(new THREE.Vector3());
    const s = height / size.y;
    model.scale.setScalar(s);
    model.position.set(-(box.min.x + box.max.x) / 2 * s, -box.min.y * s, -(box.min.z + box.max.z) / 2 * s);
    model.traverse(o => {
      if (!o.isMesh) return;
      o.castShadow = true; o.receiveShadow = true;
      if (o.isSkinnedMesh) o.frustumCulled = false; // bind-pose bounds don't follow the animation
      if (o.material.map) o.material.map.anisotropy = 4;
      if (o.material.emissive) { o.material.userData.baseEmissive = o.material.emissive.clone(); tinted.push(o.material); }
    });
    body.add(model);
    if (gltf.animations.length) {
      mixer = new THREE.AnimationMixer(model);
      for (const clip of gltf.animations) {
        const name = gameName(clip.name);
        if (!actions[name]) actions[name] = mixer.clipAction(pinRoot(clip));
      }
      if (!actions.idle && actions[guardClip]) {
        // Hold the guard pose of an attack clip as the idle stance.
        const idle = mixer.clipAction(actions[guardClip].getClip().clone());
        idle.play(); idle.paused = true; idle.time = 0; actions.idle = idle;
      }
      mixer.addEventListener('finished', e => {
        if (e.action !== oneShot) return;
        oneShot.fadeOut(.15); oneShot = null; current = null;
      });
      // The bind-pose box above can be off from how the model really stands: re-seat it
      // on its idle pose so the feet touch y = 0 and the body is centred on the turn axis.
      if (actions.idle) {
        actions.idle.reset().play(); mixer.update(0); current = actions.idle;
        body.updateMatrixWorld(true);
        const toBody = body.matrixWorld.clone().invert(), v = new THREE.Vector3();
        const lo = new THREE.Vector3(Infinity, Infinity, Infinity), hi = lo.clone().negate();
        model.traverse(o => {
          if (!o.isSkinnedMesh) return;
          const p = o.geometry.attributes.position;
          for (let i = 0; i < p.count; i += 5) { o.getVertexPosition(i, v); v.applyMatrix4(o.matrixWorld).applyMatrix4(toBody); lo.min(v); hi.max(v); }
        });
        if (Number.isFinite(lo.y)) model.position.sub(new THREE.Vector3((lo.x + hi.x) / 2, lo.y, (lo.z + hi.z) / 2));
      }
    }
    return { model, clips: Object.keys(actions) };
  });

  // The first clip snaps in: fading from nothing would show the bind (T) pose for a moment.
  const play = (name, fade = current ? .2 : 0) => {
    const next = actions[name];
    if (!next || next === current) return;
    next.enabled = true; next.setEffectiveWeight(1);
    if (!fade) next.reset().play();
    else if (next.paused) next.fadeIn(fade); else next.reset().fadeIn(fade).play();
    current?.fadeOut(fade); current = next;
  };

  let facing = 0, walkTime = 0, lastStep = -1, sway = 0;
  return {
    group, ready,
    get clips() { return Object.keys(actions); },
    has: name => Boolean(actions[name]),
    // Authored length of a clip in seconds (0 if absent).
    clipLength: name => actions[name]?.getClip().duration ?? 0,
    // Skeleton bone by Mixamo name ('LeftHand', 'Head' …); null before load or if absent.
    bone(name) { let b = null; body.traverse(o => { if (!b && o.isBone && o.name.replace(/[:_]/g, '').endsWith(name) && o.name.replace(/[:_]/g, '').startsWith('mixamorig')) b = o; }); return b; },
    // Any object of the model by exact name (e.g. the warrior's 'sword_L'); null if absent.
    node(name) { return body.getObjectByName(name) ?? null; },
    // Glow the whole body (skill auras); tint(null) clears it. Optional fade-out time.
    tint(color, amount = 1, fade = 0) {
      const apply = k => tinted.forEach(m => m.emissive.copy(color ?? m.userData.baseEmissive).multiplyScalar(color ? k : 1));
      if (!color || !fade) { apply(amount); return; }
      tintFade = { color, amount, t: 0, fade, apply };
    },
    // Play a one-shot move (e.g. 'attack_jab') at `speed` (the class tempo, src/classes/tempo.js,
    // or the basic attack fitted to the attack interval); returns false if the model lacks it.
    // A newer move cuts in over one still playing. Walking cancels whatever is left of it.
    attack(name, speed = 1) {
      const action = actions[name];
      if (!action || action === actions.idle) return false;
      if (oneShot && oneShot !== action) oneShot.fadeOut(.08);
      action.setLoop(THREE.LoopOnce, 1); action.clampWhenFinished = true; action.timeScale = speed;
      action.reset().fadeIn(.08).play(); if (current !== action) current?.fadeOut(.08);
      oneShot = action; current = action;
      return true;
    },
    update(dt, time, moving, heading) {
      if (heading !== null) {
        // Turn smoothly along the shortest arc.
        const delta = THREE.MathUtils.euclideanModulo(heading - facing + Math.PI, Math.PI * 2) - Math.PI;
        facing += delta * (1 - Math.exp(-dt * 14));
      }
      group.rotation.y = facing;
      if (tintFade) { tintFade.t += dt; const k = 1 - tintFade.t / tintFade.fade; if (k <= 0) { tintFade.apply.call(null, 0); tinted.forEach(m => m.emissive.copy(m.userData.baseEmissive)); tintFade = null; } else tintFade.apply(tintFade.amount * k); }
      if (moving) {
        walkTime += dt;
        const step = Math.floor(walkTime / .26);
        if (step !== lastStep) { lastStep = step; onStep?.(); }
      } else { walkTime = 0; lastStep = -1; }

      if (mixer) {
        // the player only walks once the cast has let go of him (Game blocks walking while a
        // skill holds him), so walking now means: skip the rest of the move
        if (moving && oneShot) { oneShot.fadeOut(.12); oneShot = null; current = null; }
        if (!oneShot) play(moving ? 'walk' : 'idle');
        mixer.update(dt);
        // A held idle pose still breathes a little.
        body.scale.y = !moving && !oneShot ? 1 + Math.sin(time * 2.2) * .008 : 1;
        return;
      }
      const phase = walkTime / .52 * Math.PI * 2;
      sway += ((moving ? 1 : 0) - sway) * (1 - Math.exp(-dt * 8));
      const breathe = Math.sin(time * 2.2) * .012 * (1 - sway);
      body.position.y = Math.abs(Math.sin(phase)) * .07 * sway;
      body.rotation.z = Math.sin(phase) * .06 * sway;
      body.rotation.x = .08 * sway;
      body.scale.set(1 - breathe * .5, 1 + breathe, 1 - breathe * .5);
    },
  };
}
