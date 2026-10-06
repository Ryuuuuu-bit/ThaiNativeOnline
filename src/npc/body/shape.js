import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

// Small geometry toolkit for the townsfolk. Every part ends up as one
// non-indexed geometry with position, normal and a vertex colour that the
// instance colour multiplies (used for shading, hems and woven patterns).

// Smooth closed solid of revolution. `profile` lists [radius, y] bottom → top.
// Options: seg (radial), sx/sz (cross-section scale), phi (partial sweep),
// warp(v, angle) to sculpt vertices before normals are computed.
export function lathe(profile, { seg = 14, sx = 1, sz = 1, phi = null, warp = null } = {}) {
  const pts = profile.map(([r, y]) => new THREE.Vector2(Math.max(r, 0), y));
  const g = phi ? new THREE.LatheGeometry(pts, seg, phi[0], phi[1]) : new THREE.LatheGeometry(pts, seg);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(p, i);
    const a = Math.atan2(v.x, v.z);
    v.x *= sx; v.z *= sz;
    if (warp) warp(v, a);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  return smooth(g);
}

// Ellipsoid of radii rx, ry, rz centred at (x, y, z).
export const blob = (rx, ry, rz, x = 0, y = 0, z = 0, seg = 8) =>
  new THREE.SphereGeometry(1, seg, Math.max(4, Math.round(seg * .7))).scale(rx, ry, rz).translate(x, y, z);

// Unit sphere sculpted vertex by vertex, then smoothed.
export function sculpt(seg, rings, fn) {
  const g = new THREE.SphereGeometry(1, seg, rings), p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { fn(v.fromBufferAttribute(p, i)); p.setXYZ(i, v.x, v.y, v.z); }
  return smooth(g);
}

// Weld seams and recompute normals so lathes and spheres shade without creases.
export function smooth(g) {
  for (const k of Object.keys(g.attributes)) if (k !== 'position') g.deleteAttribute(k);
  const m = mergeVertices(g, 1e-5);
  m.computeVertexNormals();
  return m;
}

// Drop zero-area triangles (left behind when vertices are clamped onto an edge).
export function dropFlat(g, eps = 1e-9) {
  const p = g.attributes.position, idx = g.index.array, out = [], a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let i = 0; i < idx.length; i += 3) {
    a.fromBufferAttribute(p, idx[i]); b.fromBufferAttribute(p, idx[i + 1]); c.fromBufferAttribute(p, idx[i + 2]);
    if (b.sub(a).cross(c.sub(a)).lengthSq() > eps) out.push(idx[i], idx[i + 1], idx[i + 2]);
  }
  g.setIndex(out);
  return g;
}

// Radius of a [radius, y] profile at height y (linear).
export function profileAt(prof, y) {
  if (y <= prof[0][1]) return prof[0][0];
  for (let i = 1; i < prof.length; i++) if (y <= prof[i][1]) { const [r0, y0] = prof[i - 1], [r1, y1] = prof[i]; return r0 + (r1 - r0) * (y - y0) / (y1 - y0); }
  return prof[prof.length - 1][0];
}
// Profile resampled every `step` between y0 and y1 (finer rows for clipped garments).
export function resample(prof, y0, y1, step) {
  const out = [];
  for (let y = y0; y < y1 - 1e-6; y += step) out.push([profileAt(prof, y), y]);
  out.push([profileAt(prof, y1), y1]);
  return out;
}

// Per-triangle tone (crisp blocks: woven bands, checks, hems). tone(cx, cy, cz, i) → 0..1 grey.
export function paint(g, tone) {
  const n = g.index ? g.toNonIndexed() : g, p = n.attributes.position, col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i += 3) {
    const cx = (p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) / 3, cy = (p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3, cz = (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) / 3;
    const t = tone(cx, cy, cz, i / 3);
    col.fill(t, i * 3, i * 3 + 9);
  }
  n.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return n;
}

// Merge into one non-indexed geometry with position / normal / color only.
export function merge(...gs) {
  return mergeGeometries(gs.map(g => {
    const n = g.index ? g.toNonIndexed() : g;
    for (const k of Object.keys(n.attributes)) if (!['position', 'normal', 'color'].includes(k)) n.deleteAttribute(k);
    if (!n.attributes.normal) n.computeVertexNormals();
    if (!n.attributes.color) n.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n.attributes.position.count * 3).fill(1), 3));
    return n;
  }), false);
}

export const cyl = (rt, rb, h, seg = 8) => new THREE.CylinderGeometry(rt, rb, h, seg);
export const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
