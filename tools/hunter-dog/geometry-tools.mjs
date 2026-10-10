// Local, dependency-light GLB and diagnostic geometry helpers. No network work.
import { deflateSync } from 'node:zlib';
import { Matrix4, Quaternion, Vector3 } from 'three';
export { readMotionGLB as readGLB } from '../monster-models/meshy/retarget_motion.mjs';

export function worldMatrices(nodes) {
  const parents = nodes.map(() => -1), matrices = [];
  nodes.forEach((n, i) => (n.children ?? []).forEach(c => {
    if (!nodes[c] || parents[c] !== -1) throw Error('Non-tree GLB hierarchy');
    parents[c] = i;
  }));
  const visiting = new Set();
  const get = i => {
    if (matrices[i]) return matrices[i];
    if (visiting.has(i)) throw Error('Cyclic GLB hierarchy');
    visiting.add(i);
    const n = nodes[i], local = n.matrix ? new Matrix4().fromArray(n.matrix) : new Matrix4().compose(
      new Vector3(...(n.translation ?? [0, 0, 0])), new Quaternion(...(n.rotation ?? [0, 0, 0, 1])), new Vector3(...(n.scale ?? [1, 1, 1])));
    matrices[i] = parents[i] < 0 ? local : get(parents[i]).clone().multiply(local);
    visiting.delete(i); return matrices[i];
  };
  nodes.forEach((_, i) => get(i));
  return { matrices, parents };
}

export function glbBuilder() {
  const chunks = [], bufferViews = [], accessors = []; let size = 0;
  const view = bytes => {
    bytes = Buffer.from(bytes); const pad = (4 - size % 4) % 4;
    if (pad) { chunks.push(Buffer.alloc(pad)); size += pad; }
    const index = bufferViews.length;
    bufferViews.push({ buffer: 0, byteOffset: size, byteLength: bytes.length }); chunks.push(bytes); size += bytes.length; return index;
  };
  const attribute = (array, type, componentType, normalized = false, bounds = false) => {
    const components = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 }[type];
    const meta = { bufferView: view(Buffer.from(array.buffer, array.byteOffset, array.byteLength)), componentType, count: array.length / components, type };
    if (normalized) meta.normalized = true;
    if (bounds) {
      meta.min = Array(components).fill(Infinity); meta.max = Array(components).fill(-Infinity);
      array.forEach((n, i) => { const k = i % components; meta.min[k] = Math.min(meta.min[k], n); meta.max[k] = Math.max(meta.max[k], n); });
    }
    accessors.push(meta); return accessors.length - 1;
  };
  return { view, attribute, finish(json) {
    let bin = Buffer.concat(chunks); bin = Buffer.concat([bin, Buffer.alloc((4 - bin.length % 4) % 4)]);
    json = { ...json, accessors, bufferViews, buffers: [{ byteLength: bin.length }] };
    let content = Buffer.from(JSON.stringify(json)); content = Buffer.concat([content, Buffer.alloc((4 - content.length % 4) % 4, 32)]);
    const result = Buffer.alloc(28 + content.length + bin.length);
    result.writeUInt32LE(0x46546c67, 0); result.writeUInt32LE(2, 4); result.writeUInt32LE(result.length, 8);
    result.writeUInt32LE(content.length, 12); result.writeUInt32LE(0x4e4f534a, 16); content.copy(result, 20);
    const at = 20 + content.length; result.writeUInt32LE(bin.length, at); result.writeUInt32LE(0x004e4942, at + 4); bin.copy(result, at + 8); return result;
  } };
}

const crcTable = Array.from({ length: 256 }, (_, c) => { for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
function chunk(type, bytes) {
  const data = Buffer.concat([Buffer.from(type), bytes]); let crc = 0xffffffff;
  for (const b of data) crc = crcTable[(crc ^ b) & 255] ^ (crc >>> 8);
  const head = Buffer.alloc(4), tail = Buffer.alloc(4); head.writeUInt32BE(bytes.length); tail.writeUInt32BE((crc ^ 0xffffffff) >>> 0); return Buffer.concat([head, data, tail]);
}

// Geometry-only orthographic diagnostic, deliberately not a material/lighting review.
export function projectionPNG(points, indices, joints = [], links = [], width = 1200, height = 440) {
  const rgba = Buffer.alloc(width * height * 4), depth = new Float64Array(width * height).fill(-Infinity);
  for (let i = 0; i < rgba.length; i += 4) { rgba[i] = 235; rgba[i + 1] = 239; rgba[i + 2] = 234; rgba[i + 3] = 255; }
  const views = [p => [p.z, p.y, p.x], p => [p.x, p.y, p.z], p => [p.x, -p.z, p.y]];
  for (let view = 0; view < 3; view++) {
    const panel = width / 3, projected = points.map(views[view]);
    const lo = [0, 1].map(k => Math.min(...projected.map(p => p[k]))), hi = [0, 1].map(k => Math.max(...projected.map(p => p[k])));
    const scale = Math.min((panel - 42) / (hi[0] - lo[0]), (height - 42) / (hi[1] - lo[1]));
    const screen = p => [(p[0] - (lo[0] + hi[0]) / 2) * scale + panel * (view + .5), height / 2 - (p[1] - (lo[1] + hi[1]) / 2) * scale, p[2]];
    const q = projected.map(screen), edge = (a, b, x, y) => (x - a[0]) * (b[1] - a[1]) - (y - a[1]) * (b[0] - a[0]);
    for (let i = 0; i < indices.length; i += 3) {
      const ids = Array.from(indices.slice(i, i + 3)), [a, b, c] = ids.map(id => q[id]), area = edge(a, b, c[0], c[1]); if (Math.abs(area) < 1e-9) continue;
      const normal = points[ids[1]].clone().sub(points[ids[0]]).cross(points[ids[2]].clone().sub(points[ids[0]])).normalize();
      const shade = Math.round(110 + 95 * Math.abs(normal.dot(new Vector3(.5, .8, .3).normalize())));
      const x0 = Math.max(Math.floor(panel * view), Math.floor(Math.min(a[0], b[0], c[0]))), x1 = Math.min(Math.ceil(panel * (view + 1)) - 1, Math.ceil(Math.max(a[0], b[0], c[0])));
      const y0 = Math.max(0, Math.floor(Math.min(a[1], b[1], c[1]))), y1 = Math.min(height - 1, Math.ceil(Math.max(a[1], b[1], c[1])));
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const u = edge(b, c, x + .5, y + .5) / area, v = edge(c, a, x + .5, y + .5) / area, w = 1 - u - v;
        if (Math.min(u, v, w) < 0) continue; const z = u * a[2] + v * b[2] + w * c[2], at = y * width + x;
        if (z <= depth[at]) continue; depth[at] = z; rgba[at * 4] = shade; rgba[at * 4 + 1] = shade; rgba[at * 4 + 2] = shade;
      }
    }
    const jp = joints.map(p => screen(views[view](p)));
    const pixel = (x, y, color) => { x = Math.round(x); y = Math.round(y); if (x < 0 || x >= width || y < 0 || y >= height) return; const at = (y * width + x) * 4; color.forEach((n, k) => rgba[at + k] = n); };
    for (const [a, b] of links) { const p = jp[a], q = jp[b], n = Math.ceil(Math.hypot(q[0] - p[0], q[1] - p[1])); for (let i = 0; i <= n; i++) pixel(p[0] + (q[0] - p[0]) * i / Math.max(1, n), p[1] + (q[1] - p[1]) * i / Math.max(1, n), [20, 120, 190]); }
    for (const p of jp) for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) pixel(p[0] + dx, p[1] + dy, [190, 40, 30]);
  }
  const scan = Buffer.alloc(height * (width * 4 + 1)); for (let y = 0; y < height; y++) rgba.copy(scan, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(width); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(scan)), chunk('IEND', Buffer.alloc(0))]);
}
