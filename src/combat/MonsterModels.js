import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { cachedLoader } from '../core/retry.js';
import { versioned } from '../core/version.js';
import { seedOf } from '../core/seed.js';

// Geometry, textures and clips are cached; each monster owns its skeleton,
// animation clock and materials so damage flashes never affect its neighbours.
export const MONSTER_MODELS = {
  boar: { url: '/models/monsters/boar.glb', height: 1.25 },
  pray: { url: '/models/monsters/pray.glb', height: 1.9, lift: .16 },
  krasue: { url: '/models/monsters/krasue.glb', height: 1.55, lift: .45 },
  fowl: { url: '/models/monsters/fowl.glb', height: 1.2 },
  cobra: { url: '/models/monsters/cobra.glb', height: 1.05 },
  crab: { url: '/models/monsters/crab.glb', height: .65 },
  buffalo: { url: '/models/monsters/buffalo.glb', height: 1.6 },
  monkey: { url: '/models/monsters/monkey.glb', height: 1.3 },
  phibpa: { url: '/models/monsters/phibpa.glb', height: 1.8, lift: .12 },
};
// One parse per file, shared; a load is retried, and a failure is forgotten after a while so
// the next monster of the type asks the server again (src/core/retry.js).
const loader = new GLTFLoader();
const load = cachedLoader(url => loader.loadAsync(versioned(url)));

export function makeMonsterModel(type, fallback, monsterId) {
  const spec = MONSTER_MODELS[type];
  if (!spec) return fallback;
  const group = new THREE.Group(); group.add(fallback);
  let animate = (...args) => fallback.userData.animate?.(...args);
  group.userData.animate = (...args) => animate(...args);
  group.userData.ready = load(spec.url).then(gltf => {
    const model = cloneSkinned(gltf.scene);
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model), size = box.getSize(new THREE.Vector3());
    const scale = spec.height / Math.max(.01, size.y);
    const pivot = new THREE.Group(); pivot.add(model); pivot.scale.setScalar(scale);
    pivot.position.y = spec.lift ?? 0;
    model.position.set(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
    model.traverse(o => {
      if (!o.isMesh) return;
      o.userData.monsterId = monsterId; o.castShadow = true; o.receiveShadow = true;
      const copy = m => {
        const material = m.clone();
        if (/Glow|Eye|Core/.test(material.name) && material.emissive) {
          material.emissive.copy(material.color); material.emissiveIntensity = .35;
        }
        return material;
      };
      o.material = Array.isArray(o.material) ? o.material.map(copy) : copy(o.material);
    });
    const mixer = new THREE.AnimationMixer(model), actions = {};
    for (const clip of gltf.animations) actions[clip.name] = mixer.clipAction(clip);
    for (const name of ['attack','hurt','die']) if (actions[name]) {
      actions[name].setLoop(THREE.LoopOnce, 1); actions[name].clampWhenFinished = true;
    }
    let current = null, previousTime = null, wasAttacking = false, wasHurt = false;
    if (actions.die) actions.die.timeScale = 1.4;
    function play(name) {
      const next = actions[name] ?? actions.idle;
      if (!next || next === current) return;
      current?.fadeOut(.12); next.reset().fadeIn(.12).play(); current = next;
    }
    play('idle'); mixer.update((seedOf(monsterId) % 19) / 19);
    animate = (time, moving, attacking, { hurt = false, dying = false } = {}) => {
      const dt = previousTime === null ? 0 : THREE.MathUtils.clamp(time - previousTime, 0, .1);
      previousTime = time;
      if (dying) play('die');
      else if (attacking && !wasAttacking && actions.attack) { play('attack'); actions.attack.reset().play(); }
      else if (hurt && !wasHurt && current !== actions.attack && actions.hurt) { play('hurt'); actions.hurt.reset().play(); }
      else if (current === actions.die || (current !== actions.attack && current !== actions.hurt) || !current?.isRunning()) play(moving ? 'walk' : 'idle');
      wasAttacking = attacking; wasHurt = hurt; mixer.update(dt);
    };
    group.remove(fallback); group.add(pivot);
    fallback.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
    group.userData.modelLoaded = true;
    return model;
  }).catch(error => {
    console.warn(`Monster model ${type} unavailable; using its existing mesh.`, error);
    return null;
  });
  return group;
}
