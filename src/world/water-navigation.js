import { waterSurfaces } from './water-surfaces.js';

// Static surface depth, independent of decorative shader ripples.
export const WADE = .22;
const CELL = 8, cache = new Map();

// Index the exact rendered triangles, including ribbon bends and polygon shores.
// Every query touches only its local 8 m bucket; map views bound the cache.
export function waterSurfaceFor(rect, enabled = true) {
  const key = [enabled, rect.minX, rect.maxX, rect.minZ, rect.maxZ].join(',');
  if (cache.has(key)) return cache.get(key);
  const buckets = new Map();
  for (const { positions: p, indices } of enabled ? waterSurfaces(rect) : []) {
    for (let i = 0; i < indices.length; i += 3) {
      const a = indices[i] * 3, b = indices[i + 1] * 3, c = indices[i + 2] * 3;
      const t = [p[a], p[a + 1], p[a + 2], p[b], p[b + 1], p[b + 2], p[c], p[c + 1], p[c + 2]];
      const minX = Math.floor(Math.min(t[0], t[3], t[6]) / CELL), maxX = Math.floor(Math.max(t[0], t[3], t[6]) / CELL);
      const minZ = Math.floor(Math.min(t[2], t[5], t[8]) / CELL), maxZ = Math.floor(Math.max(t[2], t[5], t[8]) / CELL);
      for (let z = minZ; z <= maxZ; z++) for (let x = minX; x <= maxX; x++) {
        const id = `${x},${z}`;
        if (!buckets.has(id)) buckets.set(id, []);
        buckets.get(id).push(t);
      }
    }
  }
  const surface = {
    heightAt(x, z) {
      if (!Number.isFinite(x) || !Number.isFinite(z)) return null;
      let height = null;
      for (const t of buckets.get(`${Math.floor(x / CELL)},${Math.floor(z / CELL)}`) ?? []) {
        const [ax, ay, az, bx, by, bz, cx, cy, cz] = t;
        const det = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
        if (Math.abs(det) < 1e-12) continue;
        const u = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / det;
        const v = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / det;
        if (u < -1e-8 || v < -1e-8 || u + v > 1 + 1e-8) continue;
        const y = u * ay + v * by + (1 - u - v) * cy;
        height = height === null ? y : Math.max(height, y);
      }
      return height;
    },
  };
  // Fourteen authored map views fit without eviction; bound future callers too.
  if (cache.size >= 16) cache.delete(cache.keys().next().value);
  cache.set(key, surface);
  return surface;
}

// Bounds, static collision and deck precedence belong to the caller.
export function waterAllowsStanding(terrain, surface, x, z) {
  if (!Number.isFinite(x) || !Number.isFinite(z) || terrain.isDeep(x, z)) return false;
  const y = surface.heightAt(x, z);
  return y === null || terrain.height(x, z) >= y - WADE;
}
