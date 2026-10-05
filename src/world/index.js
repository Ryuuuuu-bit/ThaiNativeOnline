// World system public API (see docs/INTERFACES.md, "World").
import { resetSeed } from './rng.js';
import { resetState, animations } from './state.js';
import { windUniforms } from './wind.js';
import { makeTerrain } from './terrain.js';
import { makeGrass, makeTrees, makeRocks } from './vegetation.js';
import { makeChedi, makePavilion, makeShrine, makeRuins } from './architecture.js';
import { makeWater } from './water.js';
import { makeAtmosphere } from './atmosphere.js';

export { groundHeight, inWater, pathX, riverX } from './terrainMath.js';
export { canStand } from './collision.js';
export { obstacles, treePositions } from './state.js';
export { landmarks } from './data/landmarks.js';
export { worldBounds } from './data/bounds.js';
export { windUniforms };

export function buildWorld(scene) {
  resetSeed(); resetState();
  // Build order is part of the seeded layout: every builder draws from the
  // shared RNG, so reordering these moves trees, rocks and obstacles.
  const ground = makeTerrain(scene);
  makeGrass(scene); makeTrees(scene); makeRocks(scene);
  makeChedi(scene); makePavilion(scene); makeShrine(scene); makeRuins(scene);
  const water = makeWater(scene), atmosphere = makeAtmosphere(scene);
  return {
    ground, water, atmosphere,
    update(time, dt) {
      windUniforms.uTime.value = time;
      const wind = windUniforms.uWind.value;
      for (const a of animations) {
        a.object.rotation.z = Math.sin(time * .9 + a.phase) * a.strength * wind;
        a.object.rotation.x = Math.cos(time * .7 + a.phase) * a.strength * .4 * wind;
      }
      atmosphere.update(time, dt);
    },
  };
}
