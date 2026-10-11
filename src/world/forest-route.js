import { J, STREAM, polylineDistance, waterAt } from './CityMap.js';

// The existing 3 m trail from the north bridge landing to the wat gateway.
// Low dry ground on this trail is not a submerged bank. This reservation does
// not bypass static collision or decks, and does not flatten the forest.
export const FOREST_NORTH_TRAIL = [J.sb_n, J.f5, [8.5, -439]];
export function forestTrailDryGround(x, z) {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return false;
  if (polylineDistance(x, z, FOREST_NORTH_TRAIL) > 1.5) return false;
  if (waterAt(x, z) !== 0) return false;
  // Water rendering extends past the inset deep-water classification.
  // Never allow the exception on the stream's visible shore ribbon.
  if (z > -425 && z < -380 && polylineDistance(x, z, STREAM.pts) <= STREAM.half + .6) return false;
  return true;
}
