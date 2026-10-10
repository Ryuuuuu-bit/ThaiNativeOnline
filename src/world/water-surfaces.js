import { BOUNDS, WATER_Y, PADDY_WATER_Y, MARSH_WATER_Y, CANAL, STREAM, POND, PADDIES, CHANNELS, KLONG, NONGS, riverBank, farBank, baseHeight, resample } from './CityMap.js';

// Shared static topology for rendering and navigation. Shader waves are visual only.
function ribbon(pts, half, yAt, pos, shore, idx) {
  const line = resample(pts, 1.5), base = pos.length / 3;
  line.forEach(([x, z], i) => {
    const [ax, az] = line[Math.max(0, i - 1)], [bx, bz] = line[Math.min(line.length - 1, i + 1)], len = Math.hypot(bx - ax, bz - az) || 1;
    const nx = -(bz - az) / len, nz = (bx - ax) / len, y = yAt(x, z);
    for (const s of [-1, 0, 1]) { pos.push(x + nx * half * s, y, z + nz * half * s); shore.push(s ? 0 : 1); }
    if (i) { const a = base + (i - 1) * 3, b = base + i * 3; idx.push(a, a + 1, b, a + 1, b + 1, b, a + 1, a + 2, b + 1, a + 2, b + 2, b + 1); }
  });
}

export function waterSurfaces(rect = BOUNDS) {
  const surfaces = [], overlaps = (z0, z1) => z1 >= rect.minZ && z0 <= rect.maxZ;
  const add = (kind, positions, shore, indices) => surfaces.push({ kind, positions: new Float32Array(positions), shore, indices });
  // River, extended past the map edges so its ends are never seen. Tessellated
  // (1.5 x ~2.1 units) so the vertex waves stay smooth.
  if (overlaps(155, 260)) {
    const pos = [], shore = [], idx = [], rows = 40, cols = [];
    for (let x = BOUNDS.minX - 40; x <= BOUNDS.maxX + 40; x += 1.5) cols.push(x);
    cols.forEach((x, i) => {
      const a = riverBank(x) - .8, b = farBank(x) + .8;
      for (let r = 0; r <= rows; r++) { const z = a + (b - a) * r / rows; pos.push(x, WATER_Y, z); shore.push(Math.min(1, Math.max(0, Math.min(z - a - .8, b - .8 - z) / 14))); }
      if (i) for (let r = 0; r < rows; r++) { const p = (i - 1) * (rows + 1) + r, q = i * (rows + 1) + r; idx.push(p, p + 1, q, q, p + 1, q + 1); }
    });
    add('river', pos, shore, idx);
  }
  if (overlaps(-90, 2)) {
    const pos = [], shore = [], idx = [];
    ribbon(CANAL.pts, CANAL.half + .7, () => WATER_Y, pos, shore, idx);
    // Lotus pond in the temple grounds.
    const base = pos.length / 3, seg = 28;
    pos.push(POND.x, WATER_Y + .02, POND.z); shore.push(1);
    for (let i = 0; i <= seg; i++) { const a = i / seg * Math.PI * 2; pos.push(POND.x + Math.cos(a) * (POND.rx + .6), WATER_Y + .02, POND.z + Math.sin(a) * (POND.rz + .6)); shore.push(0); if (i) idx.push(base, base + i + 1, base + i); }
    add('canal', pos, shore, idx);
  }
  if (overlaps(-425, -380)) {
    const pos = [], shore = [], idx = [];
    ribbon(STREAM.pts, STREAM.half + .6, (x, z) => baseHeight(x, z) - .38, pos, shore, idx);
    add('stream', pos, shore, idx);
  }
  // คลองหนองบึง: the klong and the pools (their reed-bed rims lie under the same water line).
  if (overlaps(-820, -600)) {
    const pos = [], shore = [], idx = [];
    ribbon(KLONG.pts, KLONG.half + .9, () => MARSH_WATER_Y, pos, shore, idx);
    for (const n of NONGS) {
      const base = pos.length / 3, seg = 36;
      pos.push(n.x, MARSH_WATER_Y, n.z); shore.push(1);
      for (let i = 0; i <= seg; i++) { const a = i / seg * Math.PI * 2; pos.push(n.x + Math.cos(a) * n.rx * 1.15, MARSH_WATER_Y, n.z + Math.sin(a) * n.rz * 1.15); shore.push(0); if (i) idx.push(base, base + i + 1, base + i); }
    }
    add('marsh', pos, shore, idx);
  }
  if (overlaps(-256, -148)) {
    const pos = [], shore = [], idx = [];
    for (const p of PADDIES) {
      if (!overlaps(p.z0, p.z1)) continue;
      const b = pos.length / 3, cx = (p.x0 + p.x1) / 2, cz = (p.z0 + p.z1) / 2;
      pos.push(p.x0 - .2, PADDY_WATER_Y, p.z0 - .2, p.x1 + .2, PADDY_WATER_Y, p.z0 - .2, p.x1 + .2, PADDY_WATER_Y, p.z1 + .2, p.x0 - .2, PADDY_WATER_Y, p.z1 + .2, cx, PADDY_WATER_Y, cz);
      shore.push(0, 0, 0, 0, 1);
      idx.push(b, b + 4, b + 1, b + 1, b + 4, b + 2, b + 2, b + 4, b + 3, b + 3, b + 4, b);
    }
    for (const c of CHANNELS) ribbon(c.pts, c.half + .2, () => -.16, pos, shore, idx);
    add('paddy', pos, shore, idx);
  }
  return surfaces;
}
