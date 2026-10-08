import { ROADS, roadPoints, insideWalls } from '../CityMap.js';
import { stiltHouse, shophouseRow } from '../Architecture.js';
import { OCC } from '../Terrain.js';

// Organic clusters of houses along every street: each candidate faces its
// road and is kept only if its footprint is clear of roads, water and
// buildings already placed, so lanes stay readable and districts blend.
function zoneOf(x, z) {
  if (insideWalls(x, z)) {
    if (x > 22 && x < 104 && z > -102 && z < -20) return null;
    if (z > 112) return { type: 'house', skip: .15 };
    if (Math.abs(x) < 52 && z > -4 && z < 112) return { type: 'shop', skip: .2 };
    return { type: 'house', skip: .1 };
  }
  if (z < -112 && z > -152 && Math.abs(x) > 8 && Math.abs(x) < 112) return { type: 'farm', skip: .3 };
  return null;
}

// Houses are the longest build step (every candidate is modelled before its site is checked), so
// the loop hands the browser a frame every BREATH_MS: the loading screen keeps moving and a
// phone never gets a one-second freeze. The random sequence is untouched by the pauses.
const BREATH_MS = 24, breathe = () => new Promise(resolve => setTimeout(resolve, 0));
export async function fillBuildings(ctx) {
  const { rng, occ, veg } = ctx;
  let count = 0, last = performance.now();
  for (const road of ROADS) {
    if (['bridge', 'plaza', 'trail', 'bund'].includes(road.kind)) continue;
    const pts = roadPoints(road);
    for (let i = 1; i < pts.length; i++) {
      const [ax, az] = pts[i - 1], [bx, bz] = pts[i], len = Math.hypot(bx - ax, bz - az), tx = (bx - ax) / len, tz = (bz - az) / len;
      for (let d = rng.range(2.5, 6); d < len - 2; d += rng.range(6.5, 8.5)) {
        const px = ax + tx * d, pz = az + tz * d;
        for (const side of [-1, 1]) {
          const nx = -tz * side, nz = tx * side, zone = zoneOf(px + nx * 8, pz + nz * 8);
          if (!zone || rng() < zone.skip) continue;
          // Try the front row first, nudged along the street, then a second row behind it.
          let g = null, ox, oz, rot, fp, fz, back = 0;
          for (const [shift, row] of [[0, 0], [3.2, 0], [-3.2, 0], [0, 1], [4, 1]]) {
            if (row && rng() < .35) continue;
            const candidate = zone.type === 'shop' ? shophouseRow(rng, row ? 2 : rng.int(2, 3)) : stiltHouse(rng, { thatch: zone.type === 'farm' || rng.chance(.3), wide: row ? .85 : 1, detailed: zone.type === 'house' });
            fp = candidate.userData.footprint; fz = fp.z ?? 0;
            const dist = road.w / 2 + 1.3 + fz + fp.d / 2 + rng.range(0, 1) + row * (fp.d + 1.2);
            ox = px + tx * shift + nx * dist; oz = pz + tz * shift + nz * dist; rot = Math.atan2(-nx, -nz) + rng.range(-.08, .08) * (1 + row);
            if (occ.rectFree(ox - nx * fz, oz - nz * fz, fp.w, fp.d, rot, .6)) { g = candidate; back = row; break; }
          }
          if (!g) continue;
          ctx.place(g, ox, oz, rot, { home: !back });
          count++;
          if (performance.now() - last > BREATH_MS) { await breathe(); last = performance.now(); }
          if (zone.type === 'shop') continue;
          // Banana and coconut beside the house, chickens in some yards.
          for (const s of [-1, 1]) {
            const yx = ox + Math.cos(rot) * s * (fp.w / 2 + 1.4) + nx * rng.range(-1, 2), yz = oz - Math.sin(rot) * s * (fp.w / 2 + 1.4) + nz * rng.range(-1, 2);
            if (occ.get(yx, yz) !== OCC.FREE || rng() < .35) continue;
            if (rng() < .55) veg.banana(yx, ctx.terrain.height(yx, yz), yz, { s: rng.range(.8, 1.1) });
            else veg.palm(yx, ctx.terrain.height(yx, yz), yz, { s: rng.range(.75, 1) });
            occ.markEllipse(yx, yz, 1.6, 1.6, OCC.YARD);
          }
          if (rng() < .3) ctx.chickenSpots.push([ox + nx * 3, oz + nz * 3]);
        }
      }
    }
  }
  return count;
}
