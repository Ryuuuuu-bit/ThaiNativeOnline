import * as THREE from 'three';
import { gltfLoader } from '../../core/gltf.js';
import { versioned } from '../../core/version.js';
import { disposeResources } from '../ResourceLifecycle.js';
import { TEMPLE_GUARDIANS } from '../../data/templeGrounds.js';

// Tripo models standing in `kit` reservations of compact-city-neighborhoods.js (the Ayutthaya
// kit skips these variants). Each model is fitted inside its reservation on a low plinth and
// turned to the reservation's `front`. The reservations already block players, NPC routes and
// the server, so this only draws.
//   elephant    ช้างทรง, the royal pair where the north avenue leaves the plaza
//   yak         ยักษ์วัด, the guardian pair on the temple terrace (`extras`: drawn at a height,
//               inside the temple's own solid footprint, so no reservation)
//   bell_tower  หอระฆัง (rung with F, src/data/templeGrounds.js)
//   bodhi       ต้นโพธิ์ผูกผ้า in the north lodge's garden (wishes, src/data/templeGrounds.js)
//
//   buildCityElephants({ city, load?, extras? }) → Promise<{ root, dispose, stats }>
//     load(url) → { scene } replaces the network loader (tests). The caller adds `root`.
//     A model that fails to load is skipped (its plinth stays); every model failing rejects.
export const CITY_MODELS = Object.freeze({
  elephant: Object.freeze({ url: '/models/props/royal_elephant.glb', height: 2.7, plinth: .26, inset: .15 }),
  yak: Object.freeze({ url: '/models/temple/yak.glb', height: 3.6, plinth: .3, inset: .15 }),
  bell_tower: Object.freeze({ url: '/models/temple/bell_tower.glb', height: 5.2, plinth: 0, inset: .1 }),
  bodhi: Object.freeze({ url: '/models/temple/bodhi.glb', height: 6, plinth: 0, inset: .1 }),
});
export const ROYAL_ELEPHANT = CITY_MODELS.elephant;
const FACING = { south: 0, north: Math.PI, east: Math.PI / 2, west: -Math.PI / 2 };

function standardize(o) {
  if (!o.isMesh) return;
  o.castShadow = o.receiveShadow = true;
  // Tripo exports KHR_materials_volume, which makes three build a physical material;
  // a standard one renders the same opaque surface for less.
  if (o.material?.isMeshPhysicalMaterial) {
    const p = o.material;
    o.material = new THREE.MeshStandardMaterial({ name: p.name, map: p.map, normalMap: p.normalMap,
      roughnessMap: p.roughnessMap, metalnessMap: p.metalnessMap, roughness: p.roughness, metalness: p.metalness, color: p.color });
    p.dispose();
  }
}

export async function buildCityElephants({ city, load, models = CITY_MODELS, extras = TEMPLE_GUARDIANS } = {}) {
  const yards = [...city.buildings.filter(b => b.kind === 'kit' && models[b.variant]), ...extras.filter(e => models[e.variant])];
  const root = new THREE.Group(); root.name = 'city:tripo-models';
  let disposed = false;
  // disposeResources releases every geometry, material and texture under root (shared once).
  const dispose = () => {
    if (disposed) return; disposed = true;
    root.removeFromParent(); disposeResources(root);
  };
  try {
    const loadOne = load ?? (url => gltfLoader().loadAsync(versioned(url)));
    const variants = [...new Set(yards.map(y => y.variant))];
    const sources = new Map(await Promise.all(variants.map(v => loadOne(models[v].url).then(g => {
      g.scene.traverse(standardize); g.scene.updateMatrixWorld(true);
      const bounds = new THREE.Box3().setFromObject(g.scene);
      return [v, { scene: g.scene, bounds, size: bounds.getSize(new THREE.Vector3()), centre: bounds.getCenter(new THREE.Vector3()) }];
    }, error => { console.warn('[compact-city] model unavailable', v, error); return [v, null]; }))));
    if (variants.length && variants.every(v => !sources.get(v))) throw new Error('no city model loaded');
    const plinthGeometry = new THREE.BoxGeometry(1, 1, 1);
    const brick = new THREE.MeshStandardMaterial({ name: 'city-model-plinth', color: '#9a5a3e', roughness: .9 });
    const cap = new THREE.MeshStandardMaterial({ name: 'city-model-plinth-cap', color: '#d8c49b', roughness: .85 });
    const count = {};
    for (const yard of yards) {
      const model = models[yard.variant], src = sources.get(yard.variant);
      const g = new THREE.Group(); g.name = `city-model:${yard.id}`; g.userData.variant = yard.variant; g.position.set(yard.x, yard.y ?? 0, yard.z);
      if (model.plinth > 0) {
        const base = new THREE.Mesh(plinthGeometry, brick);
        base.scale.set(yard.w - .2, model.plinth - .06, yard.d - .2); base.position.y = (model.plinth - .06) / 2;
        const top = new THREE.Mesh(plinthGeometry, cap);
        top.scale.set(yard.w - .36, .06, yard.d - .36); top.position.y = model.plinth - .03;
        base.receiveShadow = top.receiveShadow = base.castShadow = true;
        g.add(base, top);
      }
      if (src) {
        // The model faces +z; turn it to the reservation's front and fit it inside the reservation
        // (a tree's canopy may overhang: only its height is authored).
        const ry = FACING[yard.front] ?? 0, along = Math.abs(Math.sin(ry)) > .5;
        const roomX = yard.w - model.inset * 2, roomZ = yard.d - model.inset * 2;
        const s = model.overhang ? model.height / src.size.y
          : Math.min(model.height / src.size.y, (along ? roomX : roomZ) / src.size.z, (along ? roomZ : roomX) / src.size.x);
        const body = src.scene.clone(true); body.name = 'city-model-body';
        body.scale.setScalar(s);
        body.position.set(-src.centre.x * s, model.plinth - src.bounds.min.y * s, -src.centre.z * s);
        const turn = new THREE.Group(); turn.rotation.y = ry; turn.add(body); g.add(turn);
        count[yard.variant] = (count[yard.variant] ?? 0) + 1;
      }
      root.add(g);
    }
    root.updateMatrixWorld(true);
    const first = root.getObjectByName('city-model:kit_elephant_w')?.getObjectByName('city-model-body');
    const stats = { royalElephants: count.elephant ?? 0, cityModels: count,
      royalElephantHeight: first ? +new THREE.Box3().setFromObject(first).getSize(new THREE.Vector3()).y.toFixed(2) : 0 };
    return { root, dispose, stats };
  } catch (error) {
    dispose();
    throw error;
  }
}
