import * as THREE from 'three';
import { gltfLoader } from '../../core/gltf.js';
import { versioned } from '../../core/version.js';
import { disposeResources } from '../ResourceLifecycle.js';

// The royal elephants (ช้างทรง) that guard the north avenue where it leaves the plaza: a Tripo
// GLB (public/models/props/royal_elephant.glb, textured, gltfpack-ed) standing on a low brick
// plinth in each `kit` reservation whose variant is 'elephant' (compact-city-neighborhoods.js).
// The reservations already block players, NPC routes and the server, so this only draws.
//
//   buildCityElephants({ city, load? }) → Promise<{ root, dispose, stats }>
//     load(url) → { scene } replaces the network loader (tests). The caller adds `root`.
//     A failed download rejects; CompactCityWorld then leaves the plinths' ground empty.
export const ROYAL_ELEPHANT = Object.freeze({
  url: '/models/props/royal_elephant.glb',
  // headdress height in metres, capped so the body also fits inside its reservation
  height: 2.7,
  plinth: .26,
});
const FACING = { south: 0, north: Math.PI, east: Math.PI / 2, west: -Math.PI / 2 };

export async function buildCityElephants({ city, load, model = ROYAL_ELEPHANT } = {}) {
  const yards = city.buildings.filter(b => b.kind === 'kit' && b.variant === 'elephant');
  const root = new THREE.Group(); root.name = 'city:royal-elephants';
  let disposed = false;
  // disposeResources releases every geometry, material and texture under root (shared once).
  const dispose = () => {
    if (disposed) return; disposed = true;
    root.removeFromParent(); disposeResources(root);
  };
  try {
    const gltf = await (load ?? (url => gltfLoader().loadAsync(versioned(url))))(model.url);
    const source = gltf.scene;
    source.traverse(o => {
      if (!o.isMesh) return;
      o.castShadow = o.receiveShadow = true;
      // Tripo exports KHR_materials_volume, which makes three build a physical material;
      // a standard one renders the same opaque hide for less.
      if (o.material?.isMeshPhysicalMaterial) {
        const p = o.material;
        o.material = new THREE.MeshStandardMaterial({ name: p.name, map: p.map, normalMap: p.normalMap,
          roughnessMap: p.roughnessMap, metalnessMap: p.metalnessMap, roughness: p.roughness, metalness: p.metalness, color: p.color });
        p.dispose();
      }
    });
    source.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(source), size = bounds.getSize(new THREE.Vector3());
    const centre = bounds.getCenter(new THREE.Vector3());
    const plinthGeometry = new THREE.BoxGeometry(1, 1, 1);
    const brick = new THREE.MeshStandardMaterial({ name: 'elephant-plinth', color: '#9a5a3e', roughness: .9 });
    const cap = new THREE.MeshStandardMaterial({ name: 'elephant-plinth-cap', color: '#d8c49b', roughness: .85 });
    const placed = [];
    for (const yard of yards) {
      const g = new THREE.Group(); g.name = `royal-elephant:${yard.id}`; g.position.set(yard.x, 0, yard.z);
      const base = new THREE.Mesh(plinthGeometry, brick);
      base.scale.set(yard.w - .2, model.plinth - .06, yard.d - .2); base.position.y = (model.plinth - .06) / 2;
      const top = new THREE.Mesh(plinthGeometry, cap);
      top.scale.set(yard.w - .36, .06, yard.d - .36); top.position.y = model.plinth - .03;
      base.receiveShadow = top.receiveShadow = base.castShadow = true;
      g.add(base, top);
      // The model faces +z; turn it to the reservation's front and fit it inside the plinth top.
      const ry = FACING[yard.front] ?? 0, along = Math.abs(Math.sin(ry)) > .5;
      const roomX = yard.w - .3, roomZ = yard.d - .3;
      const s = Math.min(model.height / size.y, (along ? roomX : roomZ) / size.z, (along ? roomZ : roomX) / size.x);
      const body = source.clone(true); body.name = 'royal-elephant';
      body.scale.setScalar(s);
      body.position.set(-centre.x * s, model.plinth - bounds.min.y * s, -centre.z * s);
      const turn = new THREE.Group(); turn.rotation.y = ry; turn.add(body); g.add(turn);
      root.add(g); placed.push(g);
    }
    root.updateMatrixWorld(true);
    const stats = { royalElephants: placed.length,
      royalElephantHeight: placed.length ? +new THREE.Box3().setFromObject(placed[0].getObjectByName('royal-elephant')).getSize(new THREE.Vector3()).y.toFixed(2) : 0 };
    return { root, dispose, stats };
  } catch (error) {
    dispose();
    throw error;
  }
}
