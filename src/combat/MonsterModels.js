import * as THREE from 'three';
import { gltfLoader } from '../core/gltf.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { cachedLoader } from '../core/retry.js';
import { versioned } from '../core/version.js';
import { seedOf } from '../core/seed.js';
import { disposeCombatModel, markCachedCombatGeometry } from './CombatResources.js';
import { applyBossFog } from './BossMaterial.js';
import { BossMotion, BOSS_MOTION_PROFILES, createBossAnimator } from './BossMotion.js';

// Geometry, textures and clips are cached; each monster owns its skeleton,
// animation clock and materials so damage flashes never affect its neighbours.
export const MONSTER_MODELS = {
  boar: { url: '/models/monsters/boar.glb', height: 1.25 },
  pray: { url: '/models/monsters/pray.glb', height: 1.9, lift: .16 },
  krasue: { url: '/models/monsters/krasue.glb', height: 1.55, lift: .45, deathDim: .7 },
  fowl: { url: '/models/monsters/fowl.glb', height: 1.2 },
  cobra: { url: '/models/monsters/cobra.glb', height: 1.05 },
  crab: { url: '/models/monsters/crab.glb', height: .65 },
  buffalo: { url: '/models/monsters/buffalo.glb', height: 1.6 },
  monkey: { url: '/models/monsters/monkey.glb', height: 1.3 },
  dhole: { url: '/models/monsters/dhole.glb', height: 1.065 },
  phibpa: { url: '/models/monsters/phibpa.glb', height: 1.8, lift: .12 },
  kongkoi: { url: '/models/monsters/kongkoi.glb', height: 1.55 },
  monitor: { url: '/models/monsters/monitor.glb', height: .8 },
  croc: { url: '/models/monsters/croc.glb', height: .6 / 1.3 },
  // Keep Chalawan's authored standing origin beneath his body, not his tail.
  chalawan: { url: '/models/monsters/chalawan.glb', height: 1.4, groundPivot: [0, 0], fill: .35, deathDim: .82 },
  bamboo_grave_3: { url: '/models/monsters/bamboo_grave_3.glb', height: 1.7, fill: .35, deathDim: .82 },
  sealed_mine_3: { url: '/models/monsters/sealed_mine_3.glb', height: 1.9, fill: .35, deathDim: .82 },
  sunken_city_3: { url: '/models/monsters/sunken_city_3.glb', height: 1.6, fill: .35, fogScale: .45, deathDim: .82 },
  dusk_fort_3: { url: '/models/monsters/dusk_fort_3.glb', height: 1.8, fill: .35, fogScale: .45, deathDim: .82 },
  giant_valley_3: { url: '/models/monsters/giant_valley_3.glb', height: 2, groundPivot: [-.0015, -.137], fill: .35, fogScale: .45, deathDim: .82 },
  himmapan_3: { url: '/models/monsters/himmapan_3.glb', height: 1.9, fill: .35, fogScale: .45, deathDim: .82 },
  fallen_city_3: { url: '/models/monsters/fallen_city_3.glb', height: 1.9, groundPivot: [.091, -.275], facing: -Math.atan2(.32, .947), fill: .35, fogScale: .45, deathDim: .82 },
  demon_rift_3: { url: '/models/monsters/demon_rift_3.glb', height: 2.1, fill: .35, fogScale: .45, deathDim: .82 },
  khamot: { url: '/models/monsters/khamot.glb', height: .85, lift: .3, deathDim: .7 },
  winyan: { url: '/models/monsters/winyan.glb', height: 1.85, lift: .14 },
  takian: { url: '/models/monsters/takian.glb', height: 2.5 },
  headless: { url: '/models/monsters/headless.glb', height: 1.9 },
  pret: { url: '/models/monsters/pret.glb', height: 2.65 },
  krahang: { url: '/models/monsters/krahang.glb', height: 1.9, lift: .42 },
  phitaihong: { url: '/models/monsters/phitaihong.glb', height: 1.9 },
  soldier: { url: '/models/monsters/soldier.glb', height: 1.95 },
  pusom: { url: '/models/monsters/pusom.glb', height: 1.9 },
  // world boss, the ghost sisters (Meshy models, tools/meshy/): taller than any other ghost
  // like the other bosses: a painted-colour fill (and lighter boss fog) so they read in the dark hall at night
  ghost_red: { url: '/models/monsters/ghost_red.glb', height: 2.6, lift: .1, fill: .5, fogScale: .45, deathDim: .82 },
  ghost_black: { url: '/models/monsters/ghost_black.glb', height: 2.6, lift: .1, fill: .6, fogScale: .45, deathDim: .82 },
};
// One parse per file, shared; a load is retried, and a failure is forgotten after a while so
// the next monster of the type asks the server again (src/core/retry.js).
const loader = gltfLoader();
const load = cachedLoader(url => loader.loadAsync(versioned(url)).then(gltf => {
  markCachedCombatGeometry(gltf.scene);
  return gltf;
}));

// Optional animation libraries must never delay or reject the body load. A
// missing library is cached as null and warns once, including on older deploys.
const motionLoads = new Map();
function loadMotionLibrary(url) {
  if (!motionLoads.has(url)) motionLoads.set(url, loader.loadAsync(versioned(url)).catch(error => {
    console.warn(`Optional boss motions ${url} unavailable; using body clips.`, error);
    return null;
  }));
  return motionLoads.get(url);
}

export function makeMonsterModel(type, fallback, monsterId, { bossMotion, loadModel = load, loadMotions = loadMotionLibrary } = {}) {
  const spec = MONSTER_MODELS[type];
  if (!spec) return fallback;
  const group = new THREE.Group(); group.add(fallback);
  const motion = BOSS_MOTION_PROFILES[type] ? bossMotion ?? new BossMotion(type) : null;
  let disposed = false, ownedMixer = null, previousFrame = null, latestArgs = null, bossAnimator = null;
  let snapshotSerial = null, snapshotRemaining = null;
  const sampledState = {}, frameArgs = [0, false, false, null];
  let animate = (...args) => fallback.userData.animate?.(...args);
  group.userData.bossMotionEvent = event => motion?.event(event) ?? false;
  group.userData.animationState = () => motion?.state() ?? {};
  group.userData.dispose = () => {
    if (disposed) return;
    disposed = true;
    ownedMixer?.stopAllAction();
    if (ownedMixer) ownedMixer.uncacheRoot(ownedMixer.getRoot());
    latestArgs = null;
  };
  group.userData.animate = (time, moving, attacking, state = {}) => {
    if (disposed) return;
    const dt = previousFrame === null ? 0 : THREE.MathUtils.clamp(time - previousFrame, 0, .1);
    previousFrame = time;
    let predictionDt = dt;
    if (motion && state.bossCast) {
      const cast = state.bossCast;
      motion.event({ stage: 'windup', cast, snapshot: true });
      // Fresh remaining already describes this frame. A repeated network
      // snapshot still needs local prediction; a stale/terminal cast must not
      // stop a newer windup or authoritative release clock.
      if (Number.isFinite(cast.remaining) && cast.remaining >= 0
        && motion.active?.stage === 'windup' && motion.serial === cast.serial
        && (snapshotSerial !== cast.serial || snapshotRemaining !== cast.remaining)) predictionDt = 0;
      snapshotSerial = cast.serial; snapshotRemaining = cast.remaining;
    }
    const sampled = motion ? state.bossMotion ?? motion.update(predictionDt, state) : null;
    frameArgs[0] = time; frameArgs[1] = moving; frameArgs[2] = attacking;
    if (sampled) { Object.assign(sampledState, state); sampledState.bossMotion = sampled; frameArgs[3] = sampledState; }
    else frameArgs[3] = state;
    latestArgs = frameArgs;
    animate(...latestArgs);
  };
  // Start separately; even a never-settling optional request cannot hold ready.
  const library = BOSS_MOTION_PROFILES[type]?.meshy
    ? Promise.resolve().then(() => loadMotions(`/models/monsters/motions/${type}.glb`)).catch(() => null)
    : Promise.resolve(null);
  let optionalClips = [];
  group.userData.motionsReady = library.then(gltf => {
    if (disposed) return false;
    optionalClips = (gltf?.animations ?? []).filter(c => ['idle-meshy', 'cast-meshy', 'ritual-meshy', 'slash-meshy'].includes(c.name));
    installOptionalClips();
    return optionalClips.length > 0;
  });
  let bodyActions = null;
  function installOptionalClips() {
    if (!ownedMixer || !bodyActions || disposed) return;
    for (const clip of optionalClips) bodyActions[clip.name] = ownedMixer.clipAction(clip);
    bossAnimator?.refresh();
  }
  group.userData.ready = Promise.resolve().then(() => loadModel(spec.url)).then(gltf => {
    if (disposed) return null;
    const model = cloneSkinned(gltf.scene);
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model), size = box.getSize(new THREE.Vector3());
    const scale = spec.height / Math.max(.01, size.y);
    const pivot = new THREE.Group(); pivot.add(model); pivot.scale.setScalar(scale);
    pivot.rotation.y = spec.facing ?? 0;
    pivot.position.y = spec.lift ?? 0;
    model.position.set(-(spec.groundPivot?.[0] ?? (box.min.x + box.max.x) / 2), -box.min.y, -(spec.groundPivot?.[1] ?? (box.min.z + box.max.z) / 2));
    const deathColors = [];
    model.traverse(o => {
      if (!o.isMesh) return;
      o.userData.monsterId = monsterId; o.castShadow = true; o.receiveShadow = true;
      const copy = m => {
        const material = m.clone();
        applyBossFog(material, spec.fogScale);
        if (spec.deathDim) deathColors.push({ material, color: material.color.clone() });
        if (/Glow|Eye|Core/.test(material.name) && material.emissive) {
          material.emissive.copy(material.color); material.emissiveIntensity = .35;
        }
        if (spec.fill && material.emissive) {
          // Preserve painted colours through the world's night/fog lighting.
          // This small textured fill adds neither lights nor bloom.
          material.emissive.copy(material.color); material.emissiveMap=material.map;
          material.emissiveIntensity=spec.fill;
        }
        return material;
      };
      o.material = Array.isArray(o.material) ? o.material.map(copy) : copy(o.material);
    });
    const mixer = new THREE.AnimationMixer(model), actions = {};
    ownedMixer = mixer; bodyActions = actions;
    for (const clip of gltf.animations) actions[clip.name] = mixer.clipAction(clip);
    installOptionalClips();
    for (const name of ['attack','hurt','die']) if (actions[name]) {
      actions[name].setLoop(THREE.LoopOnce, 1); actions[name].clampWhenFinished = true;
    }
    let current = null, previousTime = null, wasAttacking = false, wasHurt = false, deathTime = 0;
    bossAnimator = createBossAnimator(type, mixer, actions);
    group.userData.animationState = () => bossAnimator ? bossAnimator.state() : ({ clip: current?.getClip().name, clipTime: current?.time, time: current?.time, timeScale: current?.timeScale });
    if (actions.die) actions.die.timeScale = 1.4;
    function play(name) {
      const next = actions[name] ?? actions.idle;
      if (!next || next === current) return;
      current?.fadeOut(.12); next.reset().fadeIn(.12).play(); current = next;
    }
    if (!bossAnimator) play('idle');
    mixer.update((seedOf(monsterId) % 19) / 19);
    animate = (time, moving, attacking, state = {}) => {
      const { hurt = false, dying = false } = state;
      const dt = previousTime === null ? 0 : THREE.MathUtils.clamp(time - previousTime, 0, .1);
      previousTime = time;
      deathTime = dying ? Math.min(1, deathTime + dt * 1.4) : 0;
      for (const { material, color } of deathColors) material.color.copy(color).multiplyScalar(1 - spec.deathDim * deathTime);
      if (bossAnimator) { bossAnimator.update(dt, moving, attacking, state); return; }
      if (dying) play('die');
      else if (attacking && !wasAttacking && actions.attack) { play('attack'); actions.attack.reset().play(); }
      else if (hurt && !wasHurt && current !== actions.attack && actions.hurt) { play('hurt'); actions.hurt.reset().play(); }
      else if (current === actions.die || (current !== actions.attack && current !== actions.hurt) || !current?.isRunning()) play(moving ? 'walk' : 'idle');
      wasAttacking = attacking; wasHurt = hurt; mixer.update(dt);
    };
    group.remove(fallback); group.add(pivot);
    disposeCombatModel(fallback);
    group.userData.modelLoaded = true;
    // Replay the latest visual sample, not the original windup, after a slow load.
    if (latestArgs) animate(...latestArgs);
    return model;
  }).catch(error => {
    console.warn(`Monster model ${type} unavailable; using its existing mesh.`, error);
    return null;
  });
  return group;
}
