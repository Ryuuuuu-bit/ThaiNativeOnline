// Walkability (no three.js).
import { worldBounds } from './data/bounds.js';
import { inWater } from './terrainMath.js';
import { obstacles } from './state.js';

// The x-offset keeps the player's feet off the water's edge.
const SHORE_MARGIN = .35;

export function canStand(x, z, radius = 0.25) {
  if (x < worldBounds.minX || x > worldBounds.maxX || z < worldBounds.minZ || z > worldBounds.maxZ) return false;
  if (inWater(x + SHORE_MARGIN, z)) return false;
  return !obstacles.some(o => Math.hypot(x - o.x, z - o.z) < o.radius + radius);
}
