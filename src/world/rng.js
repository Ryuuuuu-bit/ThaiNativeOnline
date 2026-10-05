// Seeded LCG shared by every world builder. Builders must draw numbers in a
// fixed order so the layout (and collision) is identical on every load.
import { WORLD_SEED } from './data/bounds.js';

let seed = WORLD_SEED;
export function resetSeed(value = WORLD_SEED) { seed = value; }
export function random() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }
export const range = (a, b) => a + random() * (b - a);
/** range() over a [min, max] pair from data. */
export const between = ([a, b]) => range(a, b);
