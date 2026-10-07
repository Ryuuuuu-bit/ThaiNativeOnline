import { M } from '../materials.js';
import { box, cyl, beam, structure, prop, glow, railing, stiltHouse, spiritHouse } from '../Architecture.js';
import { J, BOUNDS, KLONG, NONGS, OLD_MIN_Z, nongDistance, klongDistance } from '../CityMap.js';
import { OCC } from '../Terrain.js';
import { createRng } from '../rng.js';

// คลองหนองบึง (map `klong`): the marsh north of วัดร้าง. A plank bridge crosses the klong,
// a deserted stilt hamlet stands east of the arrival trail, a banana grove hides นางตานี,
// and ชาละวัน's lagoon lies at the far south-east under dead trees. Reeds crowd the pool
// rims, sugar palms and a few big trees stand on the dry ground.
// Everything draws from its own random sequences (here and veg.isolated) so every older
// map lays out exactly as before.
export function buildKlong(ctx) {
  const { veg, terrain, occ } = ctx, rng = createRng(77031), h = (x, z) => terrain.height(x, z);
  let placed = 0;

  // ---- plank bridge over the klong ----
  const [bx, bz0] = J.kb_s, bz1 = J.kb_n[1], by = Math.max(h(bx, bz0), h(bx, bz1)) + .35;
  const bridge = structure(null), mid = (bz0 + bz1) / 2, len = Math.abs(bz1 - bz0);
  box(bridge, M.wood, bx, by - .06, mid, 2.6, .14, len);
  for (let z = bz1 + .6; z < bz0; z += .55) box(bridge, M.darkWood, bx, by + .02, z, 2.7, .04, .42);
  for (const s of [-1, 1]) {
    for (let z = bz1 + 1; z < bz0; z += 2.4) cyl(bridge, M.darkWood, bx + s * 1.3, by - .9, z, .1, .12, 2.2, 6);
    railing(bridge, M.darkWood, bx + s * 1.25, bz1 + .4, bx + s * 1.25, bz0 - .4, by + .02);
  }
  ctx.place(bridge, 0, 0);
  ctx.collision.addDeck(bx, mid, 2.6, len - .3, 0, by + .05, [2, 2]);
  for (const s of [-1, 1]) ctx.collision.addSegment(bx + s * 1.45, bz1 + .5, bx + s * 1.45, bz0 - .5, .15);

  // ---- the deserted stilt hamlet (เรือนเสาสูงร้าง) east of the arrival ----
  for (const [x, z, r] of [[30, -622, .2], [47, -616, -.3], [56, -632, .5], [36, -638, -.1]]) {
    if (!occ.rectFree(x, z, 8, 7, r, .5)) continue;
    const house = stiltHouse(rng, { thatch: true });
    // abandoned: a broken wall plank or two and a sagging roof
    for (let i = 0; i < 4; i++) box(house, M.darkWood, rng.range(-2.5, 2.5), rng.range(.1, .3), rng.range(-2, 2), rng.range(.8, 1.8), .06, .2, rng() * 3);
    house.rotation.z = rng.range(-.03, .03);
    ctx.place(house, x, z, r, { y: h(x, z) });
  }
  const sh = structure(null);
  spiritHouse(26, -630, sh);
  ctx.place(sh, 0, 0, 0, { y: h(26, -630) });
  ctx.collision.addCircle(26, -630, .7);
  const jars = structure(null);
  for (let i = 0; i < 6; i++) { const x = 40 + rng.range(-4, 4), z = -628 + rng.range(-3, 3); prop(jars, 'urn', x, h(x, z), z, { s: rng.range(.6, 1), ry: rng() * 6, color: '#8a6a4a' }); }
  ctx.place(jars, 0, 0);

  // ---- นางตานี's banana grove (kt2) ----
  veg.isolated(77032, v => {
    for (let i = 0; i < 14; i++) {
      const a = i / 14 * Math.PI * 2 + rng() * .3, r = rng.range(3, 7), x = J.kt2[0] - 6 + Math.cos(a) * r, z = J.kt2[1] - 4 + Math.sin(a) * r;
      if (occ.get(x, z) !== OCC.FREE) continue;
      v.banana(x, h(x, z), z, { s: rng.range(1, 1.4) }); occ.markEllipse(x, z, 1, 1, OCC.BUILDING);
    }
  });
  const shrine = structure(null);
  for (let i = 0; i < 3; i++) box(shrine, [M.cloth.red, M.cloth.yellow, M.cloth.green][i], J.kt2[0] - 6, h(J.kt2[0] - 6, J.kt2[1] - 4) + 1 + i * .2, J.kt2[1] - 4, .5, .14, .5);
  glow(shrine, J.kt2[0] - 6, h(J.kt2[0] - 6, J.kt2[1] - 4) + 1.8, J.kt2[1] - 4, 1.2, '#b6ffd8', 'spirit-night');
  ctx.place(shrine, 0, 0);

  // ---- ชาละวัน's lagoon: dead trees and the bones of its prey ----
  const lagoon = NONGS.find(n => n.lagoon);
  veg.isolated(77033, v => {
    for (let i = 0; i < 9; i++) {
      const a = rng() * Math.PI * 2, x = lagoon.x + Math.cos(a) * lagoon.rx * rng.range(1.25, 1.6), z = lagoon.z + Math.sin(a) * lagoon.rz * rng.range(1.25, 1.6);
      if (z < BOUNDS.minZ + 6 || occ.get(x, z) !== OCC.FREE) continue;
      v.deadTree(x, h(x, z), z, { s: rng.range(1, 1.5) }); occ.markEllipse(x, z, 1.2, 1.2, OCC.BUILDING);
    }
  });
  const bones = structure(null);
  for (let i = 0; i < 16; i++) {
    const a = rng() * Math.PI * 2, x = lagoon.x + Math.cos(a) * lagoon.rx * rng.range(1.1, 1.35), z = lagoon.z + Math.sin(a) * lagoon.rz * rng.range(1.1, 1.35);
    prop(bones, 'slab', x, h(x, z) - .05, z, { s: rng.range(.3, .6), sy: .3, ry: rng() * 6, color: '#d8d0b8' });
  }
  ctx.place(bones, 0, 0);

  // ---- the marsh itself: reeds in the shallows, palms and trees on the dry ground ----
  veg.isolated(77034, v => {
    const r = v.rng, cell = 3.6;
    for (let gz = OLD_MIN_Z; gz > BOUNDS.minZ + 2; gz -= cell) for (let gx = BOUNDS.minX; gx < BOUNDS.maxX; gx += cell) {
      const x = gx + r() * cell, z = gz - r() * cell, y = h(x, z), o = occ.get(x, z);
      const n = nongDistance(x, z), k = klongDistance(x, z);
      if (o === OCC.PADDY || (n > .85 && n < 1.45) || (k > KLONG.half - .2 && k < KLONG.half + 2.5)) {
        // reed beds along every shore
        if (o !== OCC.ROAD && o !== OCC.WATER && r() < .75) { v.bambooGrove(x, y, z, { n: 5, s: r.range(.35, .55), dark: .5 }); placed++; }
        continue;
      }
      if (o !== OCC.FREE) continue;
      const roll = r();
      // open country: scattered sugar palms, the odd big tree, low scrub
      if (roll < .025) { v.sugarPalm(x, y, z, { s: r.range(.9, 1.25) }); occ.markEllipse(x, z, 1.5, 1.5, OCC.BUILDING); placed++; }
      else if (roll < .04) { v.broadleaf(x, y, z, { s: r.range(1, 1.3), dark: .45, cards: 28 }); occ.markEllipse(x, z, 2, 2, OCC.BUILDING); placed++; }
      else if (roll < .06) { v.deadTree(x, y, z, { s: r.range(.8, 1.2) }); placed++; }
      else if (roll < .08) { v.bambooGrove(x, y, z, { n: 4, s: r.range(.4, .55), dark: .4 }); placed++; }
      else if (roll < .3) v.fern(x, y, z, { s: r.range(.9, 1.4), dark: .4 });
      else if (roll < .42) v.bush(x, y, z, { s: r.range(.8, 1.2), dark: .35 });
    }
  });
  // lotus pads on the pools (flower props floating at the water line)
  const lotus = structure(null);
  for (const n of NONGS) for (let i = 0; i < 10; i++) {
    const a = rng() * Math.PI * 2, d = Math.sqrt(rng()) * .7, x = n.x + Math.cos(a) * n.rx * d, z = n.z + Math.sin(a) * n.rz * d;
    prop(lotus, 'flower', x, -.58, z, { color: rng.pick(['#f0b8c8', '#f4f0e0', '#e894b0']), s: 1.3 });
  }
  ctx.place(lotus, 0, 0);
  // the signpost spots and a mooring post with a sunk boat by the bridge
  const wreck = structure(null);
  beam(wreck, M.darkWood, [bx - 9, -.7, bz0 - 6], [bx - 4.5, -.3, bz0 - 7.5], .35, 6);
  for (const s of [-1, 1]) cyl(wreck, M.darkWood, bx + s * 4, -.2, bz0 - 2, .12, .14, 2, 6);
  ctx.place(wreck, 0, 0);
  return placed;
}
