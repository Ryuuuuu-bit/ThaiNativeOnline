import { M, mat, nightGlow } from '../materials.js';
import { box, cyl, beam, structure, solid, post, wallLine, glow } from '../Architecture.js';
import { RUEN_HO } from '../maps.js';
import { createRng } from '../rng.js';

// เรือนหอร้าง (map ruen_ho): the world boss room of the ghost sisters (src/combat/data/worldBoss.js),
// sized for a crowd. A wide teak gallery (ระเบียง) under carved arches, candle niches along its
// north wall, opening at its east end into the bridal hall: a raised bridal bed under a red
// canopy against the far wall, four red pillars to fight around, red sacred thread hanging
// from the dark, wedding trays left to rot. No roof (the camera looks down); everything around
// it is bare dark earth. Sizes come from RUEN_HO (src/world/maps.js, the walk areas).
// Built only for its own map (its band lies beyond every other map's view), with its own
// random sequence, so no other map's layout or collision changes.

const red = mat('#7d0f0d', { side: 2 }), redDark = mat('#4a0808', { side: 2 }), lacquer = mat('#2a1610');
const thread = mat('#c01a12', { emissive: '#ff2a18', emissiveIntensity: 0 });
thread.userData.glow = .9; nightGlow.push(thread);
const wax = mat('#efe4c8', { emissive: '#ffb45a', emissiveIntensity: 0 });
wax.userData.glow = 1.4; nightGlow.push(wax);

export function buildRuenHo(ctx) {
  const { x: X, z: Z } = RUEN_HO, G = { ...RUEN_HO.gallery, x0: RUEN_HO.gallery.x0 - .6 }, C = RUEN_HO.hall;
  if (!ctx.keep(X, Z)) return null;
  const rng = createRng(90021), y = ctx.terrain.height(X, Z), site = structure(null);
  const stats = { candles: 0 };
  // bare dark ground over the whole built extent: no grass, no paths
  const v = ctx.map.view;
  ctx.footprints.push({ x: (v.minX + v.maxX) / 2, z: (v.minZ + v.maxZ) / 2, w: v.maxX - v.minX, d: v.maxZ - v.minZ, rot: 0, paint: 'earth' });
  const candle = (x, cy, z, size = .5) => { cyl(site, wax, x, cy, z, .05, .055, .24, 8); glow(site, x, cy + .2, z, size, '#ffa040', 'lantern'); stats.candles++; };

  // ---- floors: teak planks, a step up into the hall ----
  box(site, M.teak, (G.x0 + G.x1) / 2, y + .06, Z, G.x1 - G.x0 + .4, .12, G.half * 2 + 1.2);
  for (let x = G.x0; x < G.x1; x += .55) box(site, M.darkWood, x, y + .125, Z, .03, .01, G.half * 2 + 1.1);
  box(site, M.wood, (C.x0 + C.x1) / 2, y + .1, Z, C.x1 - C.x0 + .6, .2, C.half * 2 + .6);
  for (let z = Z - C.half; z < Z + C.half; z += .6) box(site, M.darkWood, (C.x0 + C.x1) / 2, y + .205, z, C.x1 - C.x0 + .5, .01, .03);

  // ---- gallery: north wall with candle niches, carved arches, a low rail on the south ----
  const zN = Z - G.half - .45, zS = Z + G.half + .45;
  box(site, lacquer, (G.x0 + G.x1) / 2, y + 1.6, zN, G.x1 - G.x0, 3.2, .3);
  wallLine(site, G.x0, zN, G.x1, zN, .3);
  for (let x = G.x0 + 2; x < G.x1 - 1; x += 3.2) {
    box(site, M.darkWood, x, y + 1.35, zN + .17, .7, 1.05, .06);
    box(site, mat('#120806'), x, y + 1.35, zN + .19, .56, .9, .04);
    cyl(site, wax, x, y + 1.08, zN + .3, .045, .05, .24, 8);
    glow(site, x, y + 1.32, zN + .32, .7, '#ffb04a', 'lantern'); stats.candles++;
    box(site, mat('#0b0705'), x, y + 2.25, zN + .17, .5, .7, .02);
  }
  for (let x = G.x0 + .5; x <= G.x1; x += 4) {
    // arch frame: two posts, a carved lintel, a hanging red cloth
    for (const zz of [Z - G.half - .15, Z + G.half + .15]) { box(site, M.woodRed, x, y + 1.5, zz, .22, 3, .22); post(site, x, zz, .16); }
    box(site, M.woodRed, x, y + 3.05, Z, .26, .22, G.half * 2 + .6);
    beam(site, M.gold, [x, y + 2.9, Z - G.half + .1], [x, y + 2.5, Z], .03); beam(site, M.gold, [x, y + 2.5, Z], [x, y + 2.9, Z + G.half - .1], .03);
    if (rng() < .7) box(site, rng() < .5 ? red : redDark, x + .05, y + 2.3, Z + rng.range(-G.half + .8, G.half - .8), .02, 1.4, .7, 0, 0, rng.range(-.08, .08));
  }
  box(site, M.darkWood, (G.x0 + G.x1) / 2, y + .55, zS, G.x1 - G.x0, .08, .1);
  for (let x = G.x0; x < G.x1; x += .9) box(site, M.darkWood, x, y + .3, zS, .06, .5, .06);
  wallLine(site, G.x0, zS, G.x1 - .6, zS, .2);
  // the door at the west end (the portal back to วัดร้าง sits in front of it)
  box(site, M.teak, G.x0 - .25, y + 1.6, Z, .3, 3.2, G.half * 2 + 1.2);
  box(site, M.darkWood, G.x0 - .1, y + 1.2, Z, .1, 2.4, 1.6);

  // ---- bridal hall ----
  const W = C.x1 - C.x0, cx = (C.x0 + C.x1) / 2;
  for (const [x1, z1, x2, z2] of [[C.x0, Z - C.half - .3, C.x1 + .3, Z - C.half - .3], [C.x0, Z + C.half + .3, C.x1 + .3, Z + C.half + .3], [C.x1 + .3, Z - C.half - .3, C.x1 + .3, Z + C.half + .3]]) {
    const len = Math.hypot(x2 - x1, z2 - z1), along = Math.abs(x2 - x1) > .1;
    box(site, lacquer, (x1 + x2) / 2, y + 1.9, (z1 + z2) / 2, along ? len : .3, 3.8, along ? .3 : len);
    wallLine(site, x1, z1, x2, z2, .3);
  }
  // the hall's open side towards the gallery: walls either side of it
  const stub = C.half - G.half - .2, sz = G.half + .2 + stub / 2;
  for (const s of [-1, 1]) { box(site, lacquer, C.x0, y + 1.9, Z + s * sz, .3, 3.8, stub); solid(site, C.x0, Z + s * sz, .3, stub); }
  // red curtains all round, candle niches between them
  for (let x = C.x0 + 1.2; x < C.x1 - .5; x += 1.6) for (const s of [-1, 1]) {
    box(site, (Math.round(x * 10) % 2) ? red : redDark, x, y + 2.1, Z + s * (C.half + .1), 1.35, 3.3, .04);
    if (Math.round(x / 1.6) % 3 === 0) candle(x + .8, y + 1.2, Z + s * (C.half - .05), .55);
  }
  for (let z = Z - C.half + 1; z < Z + C.half - .5; z += 1.9) box(site, (Math.round(z) % 2) ? red : redDark, C.x1 + .1, y + 2.1, z, .04, 3.3, 1.7);
  // four red lacquer pillars carrying a gilded beam: cover for a crowd fighting the sisters
  const P = [[C.x0 + W * .3, -C.half * .45], [C.x0 + W * .3, C.half * .45], [C.x0 + W * .68, -C.half * .45], [C.x0 + W * .68, C.half * .45]];
  for (const [px, pz] of P) {
    cyl(site, M.woodRed, px, y + 2.1, Z + pz, .32, .36, 4.2, 12); cyl(site, M.gold, px, y + .32, Z + pz, .46, .5, .24, 12); cyl(site, M.gold, px, y + 4.1, Z + pz, .42, .34, .2, 12);
    post(site, px, Z + pz, .42);
    box(site, red, px, y + 3.2, Z + pz + .4, .02, 1.6, .5);
  }
  for (const s of [-1, 1]) box(site, M.woodRed, (P[0][0] + P[2][0]) / 2, y + 4.25, Z + s * C.half * .45, P[2][0] - P[0][0] + .8, .3, .3);
  // the bridal bed against the far wall: a carved platform, a red mattress, four posts and a sagging canopy
  const bx = C.x1 - 3;
  box(site, M.woodRed, bx, y + .5, Z, 3.4, .6, 4.2); box(site, M.gold, bx, y + .82, Z, 3.45, .05, 4.25);
  box(site, red, bx, y + .95, Z, 3, .22, 3.8); box(site, M.cloth.white, bx + 1.1, y + 1.12, Z, .6, .16, 2.8);
  for (const [dx, dz] of [[-1.6, -2], [1.6, -2], [-1.6, 2], [1.6, 2]]) { box(site, M.woodRed, bx + dx, y + 1.9, Z + dz, .14, 3.2, .14); post(site, bx + dx, Z + dz, .14); }
  box(site, redDark, bx, y + 3.45, Z, 3.4, .05, 4.2);
  for (const s of [-1, 1]) box(site, red, bx + s * 1.65, y + 2.6, Z, .02, 1.6, 4.1, 0, 0, s * .08);
  solid(site, bx, Z, 3.4, 4.2);
  // wedding trays and offerings, overturned, scattered over the floor
  for (let i = 0; i < 14; i++) {
    const tx = rng.range(C.x0 + 1.5, bx - 2.5), tz = Z + rng.range(-C.half + 1.5, C.half - 1.5);
    cyl(site, M.gold, tx, y + .25, tz, .32, .26, .06, 12);
    if (rng() < .6) cyl(site, mat('#d8c9a3'), tx + .1, y + .32, tz, .07, .07, .1, 8);
  }
  // red sacred thread hanging from the dark over the hall
  for (let i = 0; i < 60; i++) {
    const tx = rng.range(C.x0 + .5, C.x1 - .3), tz = Z + rng.range(-C.half + .4, C.half - .4), len = rng.range(1.4, 3.2);
    cyl(site, thread, tx, y + 4.6 - len / 2, tz, .012, .012, len, 4);
  }
  // candles in a wide ring before the bed
  for (let i = 0; i < 15; i++) {
    const a = Math.PI / 2 + (i / 14 - .5) * Math.PI * 1.15;
    candle(bx - 3.2 - Math.cos(a) * 1.8, y + .32, Z + Math.sin(a) * 4.2);
  }
  glow(site, cx, y + 4, Z, 2.4, '#ff3020', 'spirit-night');
  glow(site, bx - 2, y + 3.4, Z, 1.6, '#ff3020', 'spirit-night');

  ctx.place(site, 0, 0);
  return stats;
}
