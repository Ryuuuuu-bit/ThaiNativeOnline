// Pure terrain queries (no three.js) so they can run under `node --test`.
import { terrain, path, river } from './data/terrain.js';
import { landmarks } from './data/landmarks.js';

export function pathX(z) { return path.amplitude * Math.sin(z * path.frequency) + path.offset; }
export function riverX(z) { return river.center + Math.sin(z * river.frequency) * river.amplitude; }
/** x coordinate where the water begins at depth z. */
export function shoreX(z) { return riverX(z) - river.shoreOffset; }
export function inWater(x, z) { return x > shoreX(z); }
export function groundHeight(x, z) {
  const n = terrain.noise;
  const noise = n.ampA * Math.sin(x * n.freqAX) * Math.cos(z * n.freqAZ) + n.ampB * Math.sin(z * n.freqBZ);
  return inWater(x, z) ? terrain.waterDepth + noise * terrain.waterNoiseScale : noise;
}
export function nearLandmark(x, z, padding = 0) {
  return landmarks.some(l => Math.hypot(x - l.x, z - l.z) < l.radius + padding);
}
