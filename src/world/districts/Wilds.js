import * as THREE from 'three';
import { M } from '../materials.js';
import { box, cyl, ball, beam, structure, solid, post, deck, prop, glow, thaiRoof, chedi, spiritHouse } from '../Architecture.js';
import { CEMETERY, J, ROADS, roadPoints, polylineDistance } from '../CityMap.js';
import { OCC } from '../Terrain.js';

// Broken brick walls, carried over from the first forest prototype.
function ruinWall(ctx, x, z, length, rotation, rng) {
  const wall = new THREE.Group(); wall.position.set(x, ctx.terrain.height(x, z), z); wall.rotation.y = rotation;
  for (let row = 0; row < 4; row++) for (let col = 0; col < Math.floor(length / .52); col++) {
    if (rng() < row * .17) continue;
    box(wall, rng() > .15 ? M.brick : M.moss, -length / 2 + col * .52 + (row % 2) * .22, .12 + row * .24, 0, .49, .21, .5);
  }
  for (let i = 0; i < 10; i++) box(wall, M.brick, rng.range(-length / 2, length / 2), .08, rng.range(-.9, .9), .4, .16, .23, rng() * 6);
  ctx.batcher.addObject(wall);
  for (let o = -length / 2; o < length / 2; o += .5) ctx.collision.addCircle(x + Math.cos(rotation) * o, z - Math.sin(rotation) * o, .42);
}
// The forest shrine from the prototype, now weathered and abandoned.
function oldShrine(rng) {
  const g = structure({ w: 3, d: 3 });
  cyl(g, M.stoneDark, 0, .65, 0, .28, .38, 1.3, 8);
  box(g, M.darkWood, 0, 1.4, 0, 1.5, .15, 1.3, 0, 0, .06);
  box(g, M.brickOld, 0, 1.8, -.25, 1.1, .8, .8);
  box(g, M.darkWood, 0, 1.8, .17, .32, .48, .02);
  const roof = thaiRoof(g, { width: 1.9, depth: 1.7, y: 2.17, height: .9, material: M.tileDark, style: 'temple', trim: M.goldDim ?? M.gold, gable: M.darkWood });
  roof.rotation.z = .08;
  for (const x of [-.6, .6]) box(g, M.wood, x, 1.85, .48, .09, .85, .09);
  for (let i = 0; i < 3; i++) cyl(g, M.gold, -.3 + i * .28, 1.57, .48, .05, .06, .12, 8);
  for (let i = 0; i < 4; i++) box(g, M.moss, rng.range(-.6, .6), 1.5, rng.range(-.5, .5), .3, .06, .3);
  prop(g, 'candle', .25, 1.48, .4); glow(g, .25, 1.68, .4, .8, '#ffc46a', 'candle-always');
  post(g, 0, 0, 1.1);
  return g;
}

function ruinedUbosot(rng) {
  const g = structure({ w: 13, d: 19 });
  box(g, M.brickOld, 0, .4, 0, 10, .8, 16);
  deck(g, 0, 0, 10, 16, 0, .8, [0, 1.5]);
  for (const s of [-1, 1]) for (let z = -7.5; z < 7.5; z += .9) {
    if (rng() < .25) continue;
    const h = rng.range(.6, 3.2) * (1 - Math.abs(z) / 14);
    box(g, rng() > .2 ? M.brickOld : M.moss, s * 4.7, .8 + h / 2, z, .6, h, .9);
    solid(g, s * 4.7, z, .6, .9);
  }
  for (let x = -4.4; x < 4.5; x += .9) if (rng() > .3) { const h = rng.range(1, 3); box(g, M.brickOld, x, .8 + h / 2, -7.7, .9, h, .6); solid(g, x, -7.7, .9, .6); }
  for (const s of [-1, 1]) for (let z = -5; z <= 5; z += 2.5) {
    const h = rng.range(.4, 2.6); cyl(g, M.plasterOld, s * 2.2, .8 + h / 2, z, .32, .36, h, 10); post(g, s * 2.2, z, .4);
  }
  box(g, M.plasterOld, 0, 1.2, -5.8, 2.6, .8, 1.6); box(g, M.plasterOld, 0, 1.75, -5.8, 2, .3, 1.2); solid(g, 0, -5.8, 2.6, 1.6);
  for (let i = 0; i < 4; i++) beam(g, M.darkWood, [rng.range(-4, 4), .85, rng.range(-6, 6)], [rng.range(-4, 4), rng.range(.9, 2.4), rng.range(-6, 6)], .12);
  for (let i = 0; i < 30; i++) box(g, M.brickOld, rng.range(-6, 6), .1, rng.range(-9, 9), .4, .16, .23, rng() * 6);
  for (let i = 0; i < 6; i++) prop(g, 'candle', -.8 + i * .3, 1.6, -4.9);
  glow(g, 0, 1.9, -4.9, 1.6, '#9fdcff', 'spirit-night');
  return g;
}

export function buildWilds(ctx) {
  const { rng, veg, terrain } = ctx;
  const h = (x, z) => terrain.height(x, z);

  // Ruined chedi in the dense forest (the prototype's landmark).
  const ruins = structure({ w: 8, d: 8 });
  chedi(ruins, { body: M.sandstone, base: M.brick, broken: .5 });
  for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; beam(ruins, M.bark, [Math.cos(a) * 3.8, 0, Math.sin(a) * 3.8], [Math.cos(a) * 1.2, 2.2 + (i % 3) * .5, Math.sin(a) * 1.2], .12, 5); }
  for (const [x, z] of [[-2.8, -1.5], [2.8, -1.5]]) { cyl(ruins, M.stone, x, .55, z, .22, .3, 1, 8); ball(ruins, M.sandstone, x, 1.2, z, .2); }
  solid(ruins, 0, 0, 5, 5);
  ctx.place(ruins, -56, -373, .3, { y: h(-56, -373) });
  for (const [dx, dz, len, rot] of [[-2.6, -4.6, 8, 0], [-5.6, -.6, 5, Math.PI / 2], [6.4, -6.6, 5, 0], [10.4, -4.6, 3, Math.PI / 2]]) ruinWall(ctx, -56 + dx, -373 + dz, len, rot, rng);
  ctx.spot('ruin_chedi', -48.6, -368.6, -Math.PI * .7, 'rc2');

  // Log bridge over the forest stream.
  const [bx, bz0] = J.sb_s, bz1 = J.sb_n[1], by = Math.max(h(bx, bz0 + 2), h(bx, bz1 - 2)) + .3;
  const bridge = structure(null);
  for (let i = -1; i <= 1; i++) cyl(bridge, M.darkBark, i * .55, by - .1, (bz0 + bz1) / 2, .27, .27, Math.abs(bz1 - bz0) - 1, 8).rotation.x = Math.PI / 2;
  for (const s of [-1, 1]) for (const z of [bz0 - 2.5, bz1 + 2.5]) cyl(bridge, M.darkWood, bx + s * 1.1, by, z, .08, .09, 1.6, 5);
  ctx.place(bridge, bx, 0);
  ctx.collision.addDeck(bx, (bz0 + bz1) / 2, 2.2, Math.abs(bz1 - bz0) - .4, 0, by + .15, [2, 2]);
  const stones = structure(null);
  for (let i = 0; i < 6; i++) prop(stones, 'rock', 58 + i * 1.1, h(58 + i * 1.1, -409) - .3, -410 + i * .9 - 2.5, { s: .5, sy: .35, color: '#7d7f72' });
  ctx.place(stones, 0, 0);

  // Abandoned forest shrine.
  ctx.place(oldShrine(rng), -38, -478, .5, { y: h(-38, -478) });
  ruinWall(ctx, -42, -483, 6, .4, rng); ruinWall(ctx, -33, -484, 4, -.6, rng);
  const sh = structure(null);
  spiritHouse(-43, -474, sh);
  for (let i = 0; i < 5; i++) box(sh, M.cloth.white, -36 + i * .6, h(-36, -472) + 2.1, -472, .1, .7, .01);
  beam(sh, M.rope, [-36.5, h(-36, -472) + 2.5, -472], [-33, h(-33, -472) + 2.5, -472], .02, 4);
  ctx.place(sh, 0, 0, 0, { y: h(-40, -474) });
  veg.deadTree(-31, h(-31, -481), -481, { s: 1.2 });
  ctx.spot('shrine_front', -35.4, -475.6, -Math.PI * .65, 'as2');

  // สุสานเก่าแห่งอโยธยา: broken perimeter wall, graves, reliquary stupas and a ruined ordination hall.
  const C = CEMETERY, graves = structure(null), step = Math.PI * 2 / 40;
  for (let a = 0; a < Math.PI * 2 - .01; a += step) {
    if (Math.abs(a + step / 2 - Math.PI / 2) < step * .9 || rng() < .22) continue;
    const x1 = C.x + Math.cos(a) * C.r, z1 = C.z + Math.sin(a) * C.r, x2 = C.x + Math.cos(a + step) * C.r, z2 = C.z + Math.sin(a + step) * C.r;
    const len = Math.hypot(x2 - x1, z2 - z1), rot = Math.atan2(x2 - x1, z2 - z1), y = h((x1 + x2) / 2, (z1 + z2) / 2);
    const rows = rng.int(1, 4);
    for (let r = 0; r < rows; r++) box(graves, rng() > .2 ? M.brickOld : M.moss, (x1 + x2) / 2, y + .2 + r * .4, (z1 + z2) / 2, .7, .4, len * rng.range(.6, 1), rot);
    ctx.collision.addSegment(x1, z1, x2, z2, .45);
  }
  for (const s of [-1, 1]) { box(graves, M.brickOld, s * 2.6, h(s * 2.6, -508) + 1.3, -508.2, 1.1, 2.6, 1.1); ctx.collision.addCircle(s * 2.6, -508.2, .8); }
  box(graves, M.brickOld, 3.6, h(3.6, -506) + .3, -506, 4.2, .6, .9, .5);
  const trails = ROADS.filter(r => r.kind === 'trail' && r.pts.some(p => String(p).startsWith('cem') || p === 'cg')).map(roadPoints);
  const placed = [];
  for (let i = 0; i < 420 && placed.length < 95; i++) {
    const a = rng() * Math.PI * 2, r = Math.sqrt(rng()) * (C.r - 3), x = C.x + Math.cos(a) * r, z = C.z + Math.sin(a) * r;
    if (trails.some(t => polylineDistance(x, z, t) < 2.6) || (Math.abs(x) < 7.5 && z < -558) || placed.some(([px, pz]) => Math.hypot(px - x, pz - z) < 2.3)) continue;
    placed.push([x, z]);
    const y = h(x, z), kind = rng(), tone = rng.pick(['#8f8d80', '#7c7a6e', '#9a968a', '#6f7560', '#85837a']);
    if (kind < .38) { prop(graves, 'urn', x, y, z, { ry: rng() * 6, s: rng.range(.7, 1.15), rz: rng.range(-.08, .08), color: tone }); ctx.collision.addCircle(x, z, .55); }
    else if (kind < .78) { prop(graves, 'slab', x, y - .05, z, { ry: rng.range(-.3, .3), rx: rng.range(-.35, .35), rz: rng.range(-.3, .3), s: rng.range(.8, 1.2), color: tone }); ctx.collision.addCircle(x, z, .45); }
    else { chedi(graves, { x, z, scale: rng.range(.24, .42), body: M.plasterOld, base: M.brickOld, spire: M.stoneDark, low: true, broken: rng() < .5 ? 1 : 0 }).position.y = y; ctx.collision.addCircle(x, z, 1); }
    if (rng() < .3) prop(graves, 'flower', x + .3, y, z + .3, { color: '#c9b9a0' });
  }
  ctx.place(graves, 0, 0);
  ctx.occ.markEllipse(C.x, C.z, C.r, C.r, OCC.YARD);
  ctx.place(ruinedUbosot(rng), 0, -568, 0, { y: h(0, -568) });
  const sala = structure(null), sy = h(20, -528);
  for (const [x, z, t] of [[18, -527, .25], [22, -527, -.1], [18, -530, .05], [22, -530.5, .35]]) { cyl(sala, M.darkWood, x, sy + 1.1, z, .1, .1, 2.2, 6).rotation.z = t; post(sala, x, z, .2); }
  thaiRoof(sala, { width: 5, depth: 4.6, height: 2, y: sy + .3, x: 20.5, z: -528.5, material: M.thatchDark, gable: false, trim: M.darkWood }).rotation.z = .5;
  for (let i = 0; i < 4; i++) prop(sala, 'candle', -7 + i * .3, h(-6, -536) + .72, -536);
  box(sala, M.darkWood, -6.5, h(-6, -536) + .35, -536, 1.6, .7, .7);
  glow(sala, -6.5, h(-6, -536) + .95, -536, 1.3, '#a9e4ff', 'spirit-night');
  ctx.place(sala, 0, 0);
  ctx.collision.addBox(-6.5, -536, 1.6, .7, 0);
  for (const [x, z] of [[-26, -526], [24, -556], [-20, -566], [14, -514], [-28, -548], [28, -536]]) veg.giant(x, h(x, z), z, { s: rng.range(.85, 1.1), dark: .85 });
  for (let i = 0; i < 9; i++) { const a = rng() * 6.28, r = rng.range(8, 30), x = C.x + Math.cos(a) * r, z = C.z + Math.sin(a) * r; if (!placed.some(([px, pz]) => Math.hypot(px - x, pz - z) < 2.5) && !trails.some(t => polylineDistance(x, z, t) < 2.5)) veg.deadTree(x, h(x, z), z, { s: rng.range(.9, 1.4) }); }
  ctx.spot('cemetery_gate', 0, -506, Math.PI, 'cg');
}
