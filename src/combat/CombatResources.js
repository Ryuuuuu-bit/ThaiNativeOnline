// Instance matrices own GPU buffers independently of a mesh's geometry. Release
// both, deduplicating the geometry/materials shared inside one procedural body.
// Cached GLB geometry/textures are owned by MonsterModels, not by a view.
// A WeakSet marks the actual shared geometry, so an independent geometry.clone()
// remains owned even though Three copies geometry.userData when cloning.
const cachedGeometries = new WeakSet();

export function markCachedCombatGeometry(group) {
  group.traverse(o => { if (o.geometry) cachedGeometries.add(o.geometry); });
}

export function disposeCombatModel(group) {
  const geometries=new Set(),materials=new Set(),skeletons=new Set();
  group.traverse(o=>{
    if(o.isInstancedMesh)o.dispose();
    if(o.geometry&&!cachedGeometries.has(o.geometry))geometries.add(o.geometry);
    if(o.skeleton)skeletons.add(o.skeleton);
    for(const material of o.material?Array.isArray(o.material)?o.material:[o.material]:[])materials.add(material);
  });
  geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());skeletons.forEach(s=>s.dispose());
}
