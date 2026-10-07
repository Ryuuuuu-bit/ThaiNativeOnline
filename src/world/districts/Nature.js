import { WALL, BOUNDS, OLD_MIN_Z, ROADS, CANAL, CEMETERY, roadPoints, insideWalls, riverBank, farBank, wildness, smoothstep, resample } from '../CityMap.js';
import { M } from '../materials.js';
import { cyl, structure } from '../Architecture.js';
import { OCC } from '../Terrain.js';

// City → farm → grassland → light forest → dense forest → deep forest.
// Density, tree species and colour all follow wildness(z), so there is no hard border.
export function scatterNature(ctx) {
  const { rng, veg, occ, terrain, props } = ctx;
  const h = (x, z) => terrain.height(x, z);
  const free = (x, z, r = 1) => [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r]].every(([dx, dz]) => occ.get(x + dx, z + dz) === OCC.FREE);
  const claim = (x, z, r) => occ.markEllipse(x, z, r, r, OCC.YARD);

  // Shade trees along city streets.
  for (const road of ROADS) {
    if (!['road', 'paved'].includes(road.kind)) continue;
    const pts = roadPoints(road);
    if (!insideWalls(...pts[0]) && !insideWalls(...pts[pts.length - 1])) continue;
    for (let i = 1; i < pts.length; i++) {
      const [ax, az] = pts[i - 1], [bx, bz] = pts[i], len = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / len, uz = (bz - az) / len;
      for (let d = 6; d < len - 4; d += 13) for (const side of [-1, 1]) {
        const off = side * (road.w / 2 + 2.4), tx = ax + ux * d - uz * off, tz = az + uz * d + ux * off;
        if (!insideWalls(tx, tz) || !free(tx, tz, 1.8) || rng() < .45) continue;
        veg.broadleaf(tx, h(tx, tz), tz, { s: rng.range(.75, 1), cards: 30 }); claim(tx, tz, 3);
      }
    }
  }
  // Palms along the canal and the river bank.
  for (const [x, z] of resample(CANAL.pts, 8)) for (const side of [-1, 1]) {
    const px = x + rng.range(-2, 2), pz = z + side * (CANAL.half + 2.4);
    if (free(px, pz, .8) && rng() > .3) { veg.palm(px, h(px, pz), pz, { s: rng.range(.8, 1.05) }); claim(px, pz, 1.5); }
  }
  for (let x = BOUNDS.minX + 2; x < BOUNDS.maxX; x += rng.range(5, 9)) {
    const z = riverBank(x) - rng.range(2.5, 5);
    if (free(x, z, .8)) { veg.palm(x, h(x, z), z, { s: rng.range(.85, 1.15) }); claim(x, z, 1.5); }
  }
  for (let x = BOUNDS.minX - 10; x < BOUNDS.maxX + 10; x += rng.range(3, 6)) {
    const z = farBank(x) + rng.range(3, 14);
    if (rng() < .5) veg.palm(x, h(x, z), z, { s: rng.range(.9, 1.2) }); else veg.broadleaf(x, h(x, z), z, { s: rng.range(.9, 1.3), cards: 26 });
  }
  // Gardens and yards scattered through the city.
  for (let i = 0; i < 900; i++) {
    const x = rng.range(WALL.west + 2, 114), z = rng.range(-108, 160);
    if (!insideWalls(x, z) || !free(x, z, 2)) continue;
    const r = rng(), y = h(x, z);
    if (r < .3) veg.banana(x, y, z, { s: rng.range(.8, 1.1) });
    else if (r < .5) veg.palm(x, y, z, { s: rng.range(.8, 1.05) });
    else if (r < .72) veg.broadleaf(x, y, z, { s: rng.range(.7, 1), cards: 28 });
    else if (r < .82) veg.bambooGrove(x, y, z, { n: 6, s: .8 });
    else { veg.bush(x, y, z, { s: rng.range(.8, 1.3) }); for (let k = 0; k < 4; k++) props.add('flower', x + rng.range(-1, 1), y, z + rng.range(-1, 1), { color: rng.pick(['#e7c54a', '#d2523d', '#e9e2c9', '#c97aa8']) }); }
    claim(x, z, 2.5);
  }
  // Tree belts hide the map edges beside the walls and fields.
  for (let z = -255; z < 160; z += 3.2) for (const s of [-1, 1]) {
    // (west of the city the belt follows the nearer wall, and is deeper: that side is open land)
    const x = s > 0 || z < WALL.z ? s * rng.range(118, 124.5) : WALL.west - rng.range(2.5, 9);
    if (s < 0 && z >= WALL.z && rng() < .5) { const x2 = WALL.west - rng.range(10, 24); if (occ.get(x2, z) === OCC.FREE) veg.broadleaf(x2, h(x2, z), z, { s: rng.range(1, 1.4), cards: 30, dark: .25 }); }
    if (occ.get(x, z) !== OCC.FREE && occ.get(x, z) !== OCC.YARD) continue;
    veg.broadleaf(x, h(x, z), z, { s: rng.range(.9, 1.3), cards: 30, dark: .2 });
  }
  // Farmland edges and the grassland before the forest.
  for (let i = 0; i < 700; i++) {
    const x = rng.range(-122, 122), z = rng.range(-300, -112);
    if (!free(x, z, 1.5)) continue;
    const field = z > -256, y = h(x, z), r = rng();
    if (field && x < -10 && x > -120 && z < -148) continue;
    if (field && x > 14 && z < -146) { if (r < .2) { veg.bush(x, y, z); claim(x, z, 1.2); } continue; }
    const treeChance = field ? .1 : .14 + smoothstep(-260, -300, z) * .5;
    if (r < treeChance) { veg.broadleaf(x, y, z, { s: rng.range(.85, 1.25) }); claim(x, z, 3); }
    else if (r < treeChance + .2) { veg.bush(x, y, z, { s: rng.range(.8, 1.4) }); claim(x, z, 1); }
    else if (r < treeChance + .32) props.add('rock', x, y + .1, z, { s: rng.range(.3, .9), sy: rng.range(.2, .5), ry: rng() * 6, color: rng.pick(['#969888', '#a8aa92', '#838c7b']) });
    else for (let k = 0; k < 5; k++) props.add('flower', x + rng.range(-1.5, 1.5), y, z + rng.range(-1.5, 1.5), { color: rng.pick(['#e7c54a', '#f0ead2', '#c97aa8', '#d9884a']) });
  }

  // The forest itself.
  const cell = 4.4;
  let trees = 0;
  // (the marsh beyond OLD_MIN_Z has its own scatter, districts/Klong.js)
  for (let gz = -290; gz > OLD_MIN_Z + 2; gz -= cell) for (let gx = BOUNDS.minX; gx < BOUNDS.maxX; gx += cell) {
    const x = gx + rng() * cell, z = gz - rng() * cell, w = wildness(z);
    if (Math.hypot(x - CEMETERY.x, z - CEMETERY.z) < CEMETERY.r + 1.5 || !free(x, z, .9)) continue;
    // Canopies keep back from trails so paths stay readable from above.
    const y = h(x, z), density = .14 + .78 * smoothstep(0, .5, w), open = free(x, z, 2.6);
    if (!open || rng() > density) {
      if (rng() < .45 + .45 * w) (rng() < .55 ? veg.fern : veg.bush).call(veg, x, y, z, { s: rng.range(.8, 1.5), dark: w * .7 });
      else if (rng() < .15) props.add('rock', x, y + .1, z, { s: rng.range(.4, 1.2), sy: rng.range(.3, .6), ry: rng() * 6, color: rng.pick(['#7f8274', '#6d7266', '#8c8e80']) });
      continue;
    }
    const r = rng();
    if (w > .5 && r < .24 && free(x, z, 2.6)) { veg.giant(x, y, z, { s: rng.range(.8, 1.15), dark: .55 + w * .35 }); claim(x, z, 4); }
    else if (w < .55 && r < .1) { veg.bambooGrove(x, y, z, { n: 8, dark: w }); claim(x, z, 2.5); }
    else { veg.broadleaf(x, y, z, { s: rng.range(.95, 1.4), dark: w * .85, cards: 30 }); claim(x, z, 2); }
    trees++;
    if (w > .35 && rng() < .3 + w * .3) for (let k = 0; k < 3; k++) veg.vine(x + rng.range(-2, 2), y + rng.range(5, 8), z + rng.range(-2, 2), { s: rng.range(.6, 1.2) });
    if (rng() < .5) veg.fern(x + rng.range(-1.5, 1.5), y, z + rng.range(-1.5, 1.5), { s: rng.range(.8, 1.3), dark: w * .7 });
    if (rng() < .05 + w * .05) {
      const lx = x + rng.range(2, 3), lz = z + rng.range(-1, 1);
      if (free(lx, lz, 2)) { props.add('log', lx, h(lx, lz), lz, { ry: rng() * 3, s: rng.range(.7, 1.1) }); ctx.collision.addCircle(lx, lz, .9); }
    }
  }

  // Cloth ribbons on sacred trees.
  const bands = structure(null);
  for (const [x, z, s] of ctx.ribbons) [M.cloth.red, M.cloth.yellow, M.cloth.green].forEach((m, i) => cyl(bands, m, x, h(x, z) + .9 + i * .22 + .6, z, .62 * s, .64 * s, .16, 14));
  ctx.place(bands, 0, 0);
  return trees;
}
