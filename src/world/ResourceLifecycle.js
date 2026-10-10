// A map owns these resources. Dispose shared resources only once per lifecycle.
const released = new WeakMap();
export function disposeResources(root) {
  if (released.has(root)) return released.get(root);
  const geometries = new Set(), materials = new Set(), textures = new Set();
  root.traverse(o => {
    if (o.geometry) geometries.add(o.geometry);
    for (const m of [].concat(o.material ?? [])) materials.add(m);
    for (const t of o.userData?.textures ?? []) textures.add(t);
    if (o.isInstancedMesh) o.dispose();
  });
  for (const m of materials) {
    for (const v of Object.values(m)) if (v?.isTexture) textures.add(v);
    for (const u of Object.values(m.uniforms ?? {})) if (u?.value?.isTexture) textures.add(u.value);
    m.dispose();
  }
  for (const g of geometries) g.dispose();
  for (const t of textures) t.dispose();
  const result = { geometries: geometries.size, materials: materials.size, textures: textures.size };
  released.set(root, result);
  return result;
}
