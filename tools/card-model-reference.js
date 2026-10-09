// Capture production presentation builders, not reference-only geometry.
import * as THREE from 'three';
import { makeMonsterFallback } from '/src/combat/CombatView.js';
import { makeMonsterModel, MONSTER_MODELS } from '/src/combat/MonsterModels.js';
import { MONSTERS } from '/src/combat/data/monsters.js';
import { disposeCombatModel } from '/src/combat/CombatResources.js';
import { gltfLoader } from '/src/core/gltf.js';
import { versioned } from '/src/core/version.js';

const canvas = document.querySelector('canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(600, 750, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.background = new THREE.Color('#e4e1d8');
scene.add(new THREE.HemisphereLight('#ffffff', '#a5a096', 2.3));
const key = new THREE.DirectionalLight('#fff5e5', 2.6);
key.castShadow = true;
key.shadow.mapSize.set(1024, 1024);
key.shadow.normalBias = .025;
scene.add(key, key.target);
const fill = new THREE.DirectionalLight('#e9f1ff', .8);
fill.position.set(8, 5, -6);
scene.add(fill);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: '#d2cec3', roughness: 1 }));
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, .01, 300);
const loader = gltfLoader();
let current = null, sources = [], sourceReceipts = [];

function resources(object) {
  const geometries = new Set(), materials = new Set(), skeletons = new Set(), textures = new Set();
  object?.traverse(o => {
    if (o.geometry) geometries.add(o.geometry);
    if (o.skeleton) skeletons.add(o.skeleton);
    for (const material of o.material ? Array.isArray(o.material) ? o.material : [o.material] : []) {
      materials.add(material);
      for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
    }
  });
  return { geometries, materials, skeletons, textures };
}

function release() {
  const visible = resources(current), images = new Set();
  if (current) { scene.remove(current); disposeCombatModel(current); current = null; }
  // Direct loads intentionally bypass the game's shared cache. Visible clones
  // share source geometry/textures, but own materials and skeletons.
  const extra = { geometries: new Set(), materials: new Set(), skeletons: new Set(), textures: new Set(visible.textures) };
  for (const gltf of sources) {
    for (const object of new Set([gltf.scene, ...(gltf.scenes ?? [])])) {
      const owned = resources(object);
      for (const kind of Object.keys(extra)) for (const value of owned[kind]) {
        if (!visible[kind].has(value) || kind === 'textures') extra[kind].add(value);
      }
    }
  }
  extra.geometries.forEach(g => g.dispose());
  extra.materials.forEach(m => m.dispose());
  extra.skeletons.forEach(s => s.dispose());
  extra.textures.forEach(t => {
    t.dispose();
    for (const image of Array.isArray(t.image) ? t.image : [t.image]) if (image && typeof image.close === 'function') images.add(image);
  });
  images.forEach(i => i.close());
  sources = []; sourceReceipts = [];
  renderer.renderLists.dispose();
  renderer.render(scene, camera);
  return { ...renderer.info.memory };
}

function fit(model) {
  model.updateMatrixWorld(true);
  model.traverse(o => o.skeleton?.update());
  const box = new THREE.Box3().setFromObject(model, true);
  if (box.isEmpty() || ![...box.min, ...box.max].every(Number.isFinite)) throw Error('Invalid visible model bounds');
  const center = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
  const distance = Math.max(10, size.length() * 4);
  camera.position.copy(center).add(new THREE.Vector3(.65, .42, 1).normalize().multiplyScalar(distance));
  camera.lookAt(center);
  camera.updateMatrixWorld(true);
  let extentX = 0, extentY = 0;
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
    const point = new THREE.Vector3(x, y, z).applyMatrix4(camera.matrixWorldInverse);
    extentX = Math.max(extentX, Math.abs(point.x)); extentY = Math.max(extentY, Math.abs(point.y));
  }
  const half = Math.max(extentY, extentX / .8) * 1.12;
  Object.assign(camera, { left: -half * .8, right: half * .8, top: half, bottom: -half, far: distance * 3 });
  camera.updateProjectionMatrix();
  key.position.copy(center).add(new THREE.Vector3(-distance * .6, distance, distance * .8));
  key.target.position.copy(center);
  const span = Math.max(size.length(), 2) * 1.3;
  Object.assign(key.shadow.camera, { left: -span, right: span, top: span, bottom: -span, near: .1, far: distance * 3 });
  key.shadow.camera.updateProjectionMatrix();
  floor.position.y = Math.min(0, box.min.y) - .008;
  let meshes = 0, triangles = 0;
  model.traverse(o => {
    if (!o.isMesh || !o.visible) return;
    meshes++;
    triangles += (o.geometry.index?.count ?? o.geometry.attributes.position?.count ?? 0) / 3 * (o.isInstancedMesh ? o.count : 1);
  });
  return { min: box.min.toArray(), max: box.max.toArray(), size: size.toArray(), camera: camera.position.toArray(), target: center.toArray(), meshes, triangles };
}

async function prepare(id) {
  if (!Object.hasOwn(MONSTERS, id)) throw Error(`Unknown monster: ${id}`);
  release();
  const def = MONSTERS[id], spec = MONSTER_MODELS[id];
  const loadDirect = async (url, kind) => {
    const receipt = { kind, url, resolvedUrl: new URL(versioned(url), location.href).href, loaded: false };
    sourceReceipts.push(receipt);
    try {
      const gltf = await loader.loadAsync(receipt.resolvedUrl);
      sources.push(gltf);
      receipt.loaded = true;
      receipt.clips = gltf.animations.map(c => ({ name: c.name, duration: c.duration }));
      return gltf;
    } catch (error) { receipt.error = String(error); throw error; }
  };
  current = makeMonsterModel(id, makeMonsterFallback(def), `card-model-reference-${id}`, {
    loadModel: url => loadDirect(url, 'body'), loadMotions: url => loadDirect(url, 'motions'),
  });
  current.scale.setScalar(def.size);
  scene.add(current);
  await current.userData.ready;
  await current.userData.motionsReady;
  if (spec && !current.userData.modelLoaded) throw Error(`Production body failed to load: ${id}`);
  for (let frame = 0; frame <= 15; frame++) current.userData.animate?.(frame / 30, false, false, { hurt: false, dying: false });
  const bounds = fit(current);
  await renderer.compileAsync(scene, camera);
  renderer.render(scene, camera);
  return {
    id, name: def.name, origin: current.userData.modelLoaded ? 'production-glb' : 'production-fallback',
    fallbackShape: def.shape, fallbackLook: def.look ?? null, worldScale: def.size,
    modelSpec: spec ?? null, sources: sourceReceipts.map(r => ({ ...r })),
    pose: { requested: 'idle', elapsedSeconds: .5, frames: 15, animationState: current.userData.animationState?.() ?? null },
    framing: bounds, memory: { ...renderer.info.memory },
  };
}

window.cardModelReference = {
  ready: true,
  catalog: Object.entries(MONSTERS).map(([id, def]) => ({ id, name: def.name })),
  prepare, release,
  shutdown() { release(); floor.geometry.dispose(); floor.material.dispose(); key.shadow.dispose(); renderer.dispose(); renderer.forceContextLoss(); },
};
