import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Collects skinned geometry in rest-pose character space and merges it per
// material into SkinnedMeshes bound to one skeleton. Rigid props become parts
// fully weighted to a single bone, so one skeleton drives everything and the
// result exports cleanly to glTF.
export class RigBuilder {
  constructor(skel) {
    this.skel = skel; this.parts = []; this.springs = []; this.colliders = [];
    this.boneIndex = new Map(); this.bones = [...skel.list];
    this.bones.forEach((b, i) => this.boneIndex.set(b.name, i));
  }
  index(name) {
    const i = this.boneIndex.get(name);
    if (i === undefined) throw new Error(`Unknown bone ${name}`);
    return i;
  }
  restPos(name) { return this.skel.rest[name]; }

  addPart(geometry, material, weightFn) {
    const g = geometry.index ? geometry.toNonIndexed() : geometry;
    const pos = g.attributes.position, n = pos.count;
    const skinIndex = new Uint16Array(n * 4), skinWeight = new Float32Array(n * 4), v = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      v.fromBufferAttribute(pos, i);
      const w = weightFn(v, i);
      let total = 0; w.slice(0, 4).forEach(([, wt]) => total += wt);
      w.slice(0, 4).forEach(([bone, wt], k) => { skinIndex[i * 4 + k] = typeof bone === 'number' ? bone : this.index(bone); skinWeight[i * 4 + k] = wt / (total || 1); });
    }
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndex, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeight, 4));
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n * 2), 2));
    if (!g.attributes.normal) g.computeVertexNormals();
    for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'skinIndex', 'skinWeight'].includes(name)) g.deleteAttribute(name);
    this.parts.push({ geometry: g, material });
  }

  // Rigid primitive placed in rest character space and bound to one bone.
  rigid(bone, geometry, material, { pos = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1], local = true, order = 'XYZ' } = {}) {
    const g = geometry.clone();
    const m = new THREE.Matrix4().compose(new THREE.Vector3(...pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot, order)), new THREE.Vector3(...scale));
    if (local) m.premultiply(new THREE.Matrix4().makeTranslation(this.restPos(bone)));
    g.applyMatrix4(m);
    this.addPart(g, material, () => [[bone, 1]]);
    return g;
  }
  // Rigid geometry with an arbitrary matrix relative to the bone's rest joint.
  rigidMatrix(bone, geometry, material, matrix) {
    const g = geometry.clone(); g.applyMatrix4(matrix.clone().premultiply(new THREE.Matrix4().makeTranslation(this.restPos(bone))));
    this.addPart(g, material, () => [[bone, 1]]); return g;
  }

  // Tube along a chain of joints with elliptical sections and smooth skinning
  // between consecutive bones. sections: [d, rx, rz, zoff?, xoff?] where d is
  // distance along the chain from the first joint (may be negative or beyond).
  chainPath(bones, end, custom) {
    const pts = custom ? custom.map(p => new THREE.Vector3(...p)) : bones.map(n => this.restPos(n).clone());
    if (!custom) pts.push(end instanceof THREE.Vector3 ? end : new THREE.Vector3(...end));
    const lens = [0];
    for (let i = 1; i < pts.length; i++) lens.push(lens[i - 1] + pts[i].distanceTo(pts[i - 1]));
    return { bones, pts, lens };
  }
  pointAt(path, d) {
    const { pts, lens } = path; let i = 0;
    while (i < lens.length - 2 && d > lens[i + 1]) i++;
    const seg = new THREE.Vector3().subVectors(pts[i + 1], pts[i]), len = seg.length(); seg.normalize();
    return { p: pts[i].clone().addScaledVector(seg, d - lens[i]), t: seg, i };
  }
  weightsAt(path, d, blend = .045, startParent) {
    const { bones, lens } = path; const n = bones.length;
    let i = 0; while (i < n - 1 && d > lens[i + 1]) i++;
    const out = [];
    // Blend with the previous/next bone around interior joints.
    const lo = lens[i], hi = lens[i + 1] ?? Infinity;
    if (i > 0 && d - lo < blend) { const w = .5 + .5 * (d - lo) / blend; out.push([bones[i], w], [bones[i - 1], 1 - w]); }
    else if (i < n - 1 && hi - d < blend) { const w = .5 + .5 * (hi - d) / blend; out.push([bones[i], w], [bones[i + 1], 1 - w]); }
    else out.push([bones[i], 1]);
    if (i === 0 && startParent && d < blend) {
      const w = .5 * Math.max(0, 1 - Math.max(d, 0) / blend); out.forEach(o => o[1] *= 1 - w); out.push([startParent, w]);
    }
    return out;
  }
  tube(bones, end, sections, material, { radial = 14, step = .02, hint, blend = .045, startParent, capStart = true, capEnd = true, vScale = 1, uWrap = 1, pts, arc } = {}) {
    const path = this.chainPath(bones, end, pts);
    const ds = sections.map(s => s[0]), d0 = ds[0], d1 = ds[ds.length - 1];
    const rows = Math.max(2, Math.ceil((d1 - d0) / step) + 1);
    const verts = [], uvs = [], ring = radial + 1, dList = [];
    const sample = d => {
      let k = 0; while (k < sections.length - 2 && d > sections[k + 1][0]) k++;
      const a = sections[k], b = sections[k + 1], u = THREE.MathUtils.clamp((d - a[0]) / ((b[0] - a[0]) || 1), 0, 1);
      const sm = u * u * (3 - 2 * u);
      return [1, 2, 3, 4].map(j => THREE.MathUtils.lerp(a[j] ?? 0, b[j] ?? 0, sm));
    };
    for (let r = 0; r < rows; r++) {
      const d = d0 + (d1 - d0) * r / (rows - 1); dList.push(d);
      const { p, t } = this.pointAt(path, d);
      const [rx, rz, zoff, xoff] = sample(d);
      const h = hint ? new THREE.Vector3(...hint) : (Math.abs(t.y) > .7 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0));
      const front = h.addScaledVector(t, -h.dot(t)).normalize();
      const side = new THREE.Vector3().crossVectors(t, front).normalize();
      for (let j = 0; j < ring; j++) {
        const a = arc ? THREE.MathUtils.lerp(arc[0], arc[1], j / radial) * Math.PI / 180 : (j / radial - .5) * Math.PI * 2;
        const q = p.clone().addScaledVector(side, Math.sin(a) * rx + xoff).addScaledVector(front, Math.cos(a) * rz + zoff);
        verts.push(q.x, q.y, q.z); uvs.push(j / radial * uWrap, (d - d0) * vScale);
      }
    }
    const index = [];
    for (let r = 0; r < rows - 1; r++) for (let j = 0; j < radial; j++) {
      const a = r * ring + j, b = a + ring;
      index.push(a, a + 1, b, b, a + 1, b + 1);
    }
    const addCap = (row, flip) => {
      const c = verts.length / 3; let cx = 0, cy = 0, cz = 0;
      for (let j = 0; j < radial; j++) { cx += verts[(row * ring + j) * 3]; cy += verts[(row * ring + j) * 3 + 1]; cz += verts[(row * ring + j) * 3 + 2]; }
      verts.push(cx / radial, cy / radial, cz / radial); uvs.push(.5, .5); dList.push(dList[row]);
      for (let j = 0; j < radial; j++) flip ? index.push(c, row * ring + j, row * ring + j + 1) : index.push(c, row * ring + j + 1, row * ring + j);
    };
    const first = sample(d0), last = sample(d1);
    if (!arc && capStart && first[0] > .002) addCap(0, true);
    if (!arc && capEnd && last[0] > .002) addCap(rows - 1, false);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.setIndex(index); g.computeVertexNormals();
    const nrm = g.attributes.normal;
    if (!arc) for (let r = 0; r < rows; r++) { // weld the UV seam's normals
      const a = r * ring, b = a + radial, v = new THREE.Vector3(nrm.getX(a) + nrm.getX(b), nrm.getY(a) + nrm.getY(b), nrm.getZ(a) + nrm.getZ(b)).normalize();
      nrm.setXYZ(a, v.x, v.y, v.z); nrm.setXYZ(b, v.x, v.y, v.z);
    }
    const rowOf = i => i < rows * ring ? Math.floor(i / ring) : -1;
    const g2 = g.toNonIndexed();
    // toNonIndexed loses the vertex→row mapping, so weights are computed from
    // the original index buffer order.
    const order = index; const weights = order.map(vi => this.weightsAt(path, vi < rows * ring ? dList[rowOf(vi)] : dList[vi - rows * ring + rows], blend, startParent));
    this.addPart(g2, material, (v, i) => weights[i]);
    return path;
  }

  // Band hugging a tube surface: a ring whose height varies with angle, used
  // for straps, sashes and trims. radius(d) comes from the owner tube sections.
  band(bones, end, sections, material, { d, tilt = 0, phase = 0, width = .03, thick = .012, radial = 28, blend = .045, pts } = {}) {
    const path = this.chainPath(bones, end, pts), verts = [], weights = [];
    const ring = radial + 1;
    const sample = dd => {
      let k = 0; while (k < sections.length - 2 && dd > sections[k + 1][0]) k++;
      const a = sections[k], b = sections[k + 1], u = THREE.MathUtils.clamp((dd - a[0]) / ((b[0] - a[0]) || 1), 0, 1), sm = u * u * (3 - 2 * u);
      return [1, 2, 3, 4].map(j => THREE.MathUtils.lerp(a[j] ?? 0, b[j] ?? 0, sm));
    };
    const rowsDef = [[-width / 2, 0], [-width / 2, thick], [width / 2, thick], [width / 2, 0]];
    for (const [dw, off] of rowsDef) for (let j = 0; j < ring; j++) {
      const a = j / radial * Math.PI * 2, dd = d + Math.sin(a + phase) * tilt + dw;
      const { p, t } = this.pointAt(path, dd);
      const h = Math.abs(t.y) > .7 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0);
      const front = h.addScaledVector(t, -h.dot(t)).normalize(), side = new THREE.Vector3().crossVectors(t, front).normalize();
      const [rx, rz, zoff, xoff] = sample(dd);
      const q = p.addScaledVector(side, Math.sin(a) * (rx + off) + xoff).addScaledVector(front, Math.cos(a) * (rz + off) + zoff);
      verts.push(q.x, q.y, q.z); weights.push(this.weightsAt(path, dd, blend));
    }
    const index = [];
    for (let r = 0; r < 3; r++) for (let j = 0; j < radial; j++) { const a = r * ring + j, b = a + ring; index.push(a, a + 1, b, b, a + 1, b + 1); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3)); g.setIndex(index); g.computeVertexNormals();
    const w = index.map(i => weights[i]);
    this.addPart(g.toNonIndexed(), material, (v, i) => w[i]);
  }

  // Secondary-motion chain: new bones parented to `parent`, simulated by
  // SpringChain at runtime. dir is the rest direction in character space.
  springChain(parent, startWorld, dir, segLen, count, opts = {}) {
    const parentBone = this.skel.bones[parent] || this.bones[this.index(parent)];
    const start = new THREE.Vector3(...startWorld), step = new THREE.Vector3(...dir).normalize().multiplyScalar(segLen);
    const bones = [];
    let prev = parentBone, prevPos = this.restPos(parent) || parentBone.getWorldPosition(new THREE.Vector3());
    for (let i = 0; i <= count; i++) {
      const bone = new THREE.Bone(); bone.name = `${opts.name || 'Cloth'}_${this.bones.length}`;
      const pos = start.clone().addScaledVector(step, i);
      bone.position.copy(pos).sub(prevPos); prev.add(bone);
      this.bones.push(bone); this.boneIndex.set(bone.name, this.bones.length - 1);
      this.skel.rest[bone.name] = pos; bones.push(bone); prev = bone; prevPos = pos;
    }
    this.springs.push({ bones, stiffness: opts.stiffness ?? 1.2, drag: opts.drag ?? .35, gravity: opts.gravity ?? 1, radius: opts.radius ?? .02, collide: opts.collide ?? true });
    return bones.map(b => b.name);
  }
  // Flat cloth strip skinned to a spring chain. widthDir is the strip's
  // sideways direction; taper scales width toward the tip.
  ribbon(chain, widthDir, width, material, { taper = 1, root, rootWeight = 0, bulge = 0 } = {}) {
    const pts = chain.map(n => this.skel.rest[n]); const n = pts.length;
    const wd = new THREE.Vector3(...widthDir).normalize(), verts = [], uvs = [], weights = [];
    const along = new THREE.Vector3().subVectors(pts[n - 1], pts[0]).normalize();
    const normal = new THREE.Vector3().crossVectors(wd, along).normalize();
    for (let i = 0; i < n; i++) {
      const w = width * THREE.MathUtils.lerp(1, taper, i / (n - 1)) / 2;
      for (const sx of [-1, 0, 1]) {
        const p = pts[i].clone().addScaledVector(wd, sx * w).addScaledVector(normal, (1 - sx * sx) * bulge);
        verts.push(p.x, p.y, p.z); uvs.push((sx + 1) / 2, i / (n - 1));
      }
      const wts = i === 0 && root ? [[root, rootWeight], [chain[0], 1 - rootWeight]] : [[chain[Math.min(i, n - 2)], 1]];
      weights.push(wts, wts, wts);
    }
    const index = [];
    for (let i = 0; i < n - 1; i++) for (let k = 0; k < 2; k++) { const a = i * 3 + k, b = a + 3; index.push(a, b, a + 1, a + 1, b, b + 1); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); g.setIndex(index); g.computeVertexNormals();
    const w = index.map(i => weights[i]);
    this.addPart(g.toNonIndexed(), material, (v, i) => w[i]);
  }
  // Thin hanging cylinder (tassel, string of beads, talisman cord).
  strand(chain, radius, material, { tipRadius = radius, radial = 6 } = {}) {
    const pts = chain.map(n => this.skel.rest[n]);
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1], len = a.distanceTo(b);
      const r0 = THREE.MathUtils.lerp(radius, tipRadius, i / (pts.length - 1)), r1 = THREE.MathUtils.lerp(radius, tipRadius, (i + 1) / (pts.length - 1));
      const g = new THREE.CylinderGeometry(r1, r0, len * 1.04, radial, 1, false);
      g.applyMatrix4(new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(.5), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()), new THREE.Vector3(1, 1, 1)));
      this.addPart(g, material, () => [[chain[i], 1]]);
    }
  }
  // Extra helper bone (e.g. a bow string nock) at a rest position in character space.
  extraBone(name, parent, worldPos) {
    const bone = new THREE.Bone(); bone.name = name;
    const pp = this.skel.rest[parent]; bone.position.set(worldPos[0] - pp.x, worldPos[1] - pp.y, worldPos[2] - pp.z);
    this.bones[this.index(parent)].add(bone); this.bones.push(bone); this.boneIndex.set(name, this.bones.length - 1);
    this.skel.rest[name] = new THREE.Vector3(...worldPos); return bone;
  }
  collider(bone, offset, radius) { this.colliders.push({ bone, offset: new THREE.Vector3(...offset), radius }); }

  build() {
    const byMat = new Map();
    for (const { geometry, material } of this.parts) {
      if (!byMat.has(material)) byMat.set(material, []);
      byMat.get(material).push(geometry);
    }
    const root = this.skel.root; root.updateMatrixWorld(true);
    const skeleton = new THREE.Skeleton(this.bones);
    const meshes = [];
    for (const [material, geos] of byMat) {
      const geo = mergeGeometries(geos, false); geo.computeBoundingSphere();
      const mesh = new THREE.SkinnedMesh(geo, material);
      mesh.name = material.name || 'Part'; mesh.castShadow = true;
      // Faces stay readable: hair and headwear never shadow the head skin.
      mesh.receiveShadow = material.name !== 'Skin'; mesh.frustumCulled = false;
      mesh.bind(skeleton, new THREE.Matrix4());
      meshes.push(mesh);
    }
    return { skeleton, meshes };
  }
}
