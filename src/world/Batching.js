import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Static architecture is authored as ordinary meshes, then merged per material
// and per spatial chunk: thousands of boxes become a few hundred frustum-culled
// draw calls, and only nearby chunks reach the shadow pass.
const prepared = new WeakMap();
function prepare(geometry) {
  let g = prepared.get(geometry);
  if (g) return g;
  g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal' && name !== 'uv') g.deleteAttribute(name);
  if (!g.attributes.normal) g.computeVertexNormals();
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  g.clearGroups(); g.morphAttributes = {};
  prepared.set(geometry, g);
  return g;
}

// `keep(x, z)` (optional) drops pieces outside the map being built; `whole`
// keeps every piece of an object whose placement was already accepted.
export class StaticBatcher {
  constructor(chunk = 40, keep = null) { this.chunk = chunk; this.keep = keep; this.buckets = new Map(); this.count = 0; }
  add(geometry, material, matrix, castShadow = true, whole = false) {
    const e = matrix.elements;
    if (this.keep && !whole && !this.keep(e[12], e[14])) return;
    const key = `${Math.floor(e[12] / this.chunk)},${Math.floor(e[14] / this.chunk)}|${material.uuid}|${castShadow ? 1 : 0}`;
    let bucket = this.buckets.get(key);
    if (!bucket) this.buckets.set(key, bucket = { material, castShadow, items: [] });
    bucket.items.push([geometry, matrix.clone()]); this.count++;
  }
  addObject(root, whole = false) {
    root.updateMatrixWorld(true);
    root.traverse(o => { if (o.isMesh && !o.isInstancedMesh && o.visible) this.add(o.geometry, o.material, o.matrixWorld, o.castShadow, whole); });
  }
  build(scene) {
    let meshes = 0;
    for (const bucket of this.buckets.values()) {
      const parts = bucket.items.map(([g, m]) => prepare(g).clone().applyMatrix4(m));
      const merged = mergeGeometries(parts, false);
      for (const p of parts) p.dispose();
      if (!merged) continue;
      merged.computeBoundingSphere();
      if (Number.isNaN(merged.boundingSphere.radius)) console.warn('[batch] NaN geometry for material', bucket.material.color.getHexString(), bucket.items.map(([g]) => g.type).join(','));
      const mesh = new THREE.Mesh(merged, bucket.material);
      mesh.castShadow = bucket.castShadow; mesh.receiveShadow = true; mesh.matrixAutoUpdate = false;
      scene.add(mesh); meshes++;
    }
    this.buckets.clear();
    return meshes;
  }
}

// Repeated props and vegetation: one InstancedMesh per chunk keeps culling effective.
const dummy = new THREE.Object3D(), white = new THREE.Color('#ffffff');
export class InstanceSet {
  constructor(geometry, material, { chunk = 40, castShadow = true, receiveShadow = true, keep = null } = {}) {
    Object.assign(this, { geometry, material, chunk, castShadow, receiveShadow, keep }); this.cells = new Map(); this.total = 0;
  }
  add(x, y, z, { rx = 0, ry = 0, rz = 0, s = 1, sx, sy, sz, color } = {}) {
    dummy.position.set(x, y, z); dummy.rotation.set(rx, ry, rz); dummy.scale.set(sx ?? s, sy ?? s, sz ?? s); dummy.updateMatrix();
    this.addMatrix(dummy.matrix, color);
  }
  addMatrix(matrix, color, whole = false) {
    const e = matrix.elements;
    if (this.keep && !whole && !this.keep(e[12], e[14])) return;
    const key = `${Math.floor(e[12] / this.chunk)},${Math.floor(e[14] / this.chunk)}`;
    let cell = this.cells.get(key);
    if (!cell) this.cells.set(key, cell = { matrices: [], colors: [], colored: false });
    cell.matrices.push(...e);
    if (color) cell.colored = true;
    cell.colors.push(color ? (color.isColor ? color.clone() : new THREE.Color(color)) : white);
    this.total++;
  }
  build(scene) {
    const meshes = [];
    for (const cell of this.cells.values()) {
      const n = cell.colors.length, mesh = new THREE.InstancedMesh(this.geometry, this.material, n);
      mesh.instanceMatrix.array.set(cell.matrices);
      if (cell.colored) for (let i = 0; i < n; i++) mesh.setColorAt(i, cell.colors[i]);
      mesh.castShadow = this.castShadow; mesh.receiveShadow = this.receiveShadow;
      mesh.computeBoundingSphere(); mesh.matrixAutoUpdate = false;
      if (Number.isNaN(mesh.boundingSphere.radius)) console.warn('[instances] NaN in', this.geometry.type, this.material.color.getHexString());
      scene.add(mesh); meshes.push(mesh);
    }
    this.cells.clear();
    return meshes;
  }
}

// Collapse a small moving object (a boat, a buffalo) into one mesh per material.
export function mergeObject(root) {
  root.updateMatrixWorld(true);
  const byMaterial = new Map(), out = new THREE.Group();
  root.traverse(o => {
    if (!o.isMesh) return;
    let list = byMaterial.get(o.material);
    if (!list) byMaterial.set(o.material, list = []);
    list.push(prepare(o.geometry).clone().applyMatrix4(o.matrixWorld));
  });
  for (const [material, parts] of byMaterial) {
    const mesh = new THREE.Mesh(mergeGeometries(parts, false), material);
    mesh.castShadow = true; mesh.receiveShadow = true; out.add(mesh);
  }
  return out;
}
