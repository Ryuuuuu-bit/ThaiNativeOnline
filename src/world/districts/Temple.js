import * as THREE from 'three';
import { M } from '../materials.js';
import { box, cyl, structure, solid, post, prop, glow, sala, ubosot, bigGoldenChedi, bellTower, kuti, chedi, tieredRoof } from '../Architecture.js';
import { POND } from '../CityMap.js';
import { OCC } from '../Terrain.js';

const T = { x0: 26, x1: 100, z0: -98, z1: -24 };

// Low white temple wall with a tiled coping.
function templeWall(ctx, x1, z1, x2, z2) {
  const len = Math.hypot(x2 - x1, z2 - z1), rot = Math.atan2(x2 - x1, z2 - z1), g = new THREE.Group();
  const n = Math.ceil(len / 8);
  for (let i = 0; i < n; i++) {
    const t = (i + .5) / n, x = x1 + (x2 - x1) * t, z = z1 + (z2 - z1) * t, l = len / n + .02;
    box(g, M.plaster, x, .8, z, .6, 1.6, l, rot);
    box(g, M.tileOrange, x, 1.68, z, .9, .14, l, rot);
  }
  ctx.batcher.addObject(g);
  ctx.collision.addSegment(x1, z1, x2, z2, .4);
  ctx.occ.markRect((x1 + x2) / 2, (z1 + z2) / 2, 1.2, len, rot, OCC.BUILDING);
}
function gateArch(rng) {
  const g = structure({ w: 6, d: 2 });
  for (const s of [-1, 1]) { box(g, M.plaster, s * 2.2, 1.6, 0, .9, 3.2, 1.1); cyl(g, M.gold, s * 2.2, 3.35, 0, .2, .4, .3, 8); solid(g, s * 2.2, 0, .9, 1.1); }
  box(g, M.plaster, 0, 3.3, 0, 5.4, .4, 1.2);
  tieredRoof(g, { width: 3.6, depth: 2.2, y: 3.5, tiers: 2, material: M.tileOrange, edge: M.tileGreen, x: 0, z: 0, ry: Math.PI / 2 });
  return g;
}

export function buildTemple(ctx) {
  const { rng } = ctx;
  templeWall(ctx, T.x0, T.z1, T.x1, T.z1); templeWall(ctx, T.x1, T.z1, T.x1, T.z0); templeWall(ctx, T.x1, T.z0, T.x0, T.z0);
  templeWall(ctx, T.x0, T.z0, T.x0, -55.6); templeWall(ctx, T.x0, -48.4, T.x0, T.z1);
  ctx.place(gateArch(rng), T.x0, -52, Math.PI / 2, { paint: 'paved' });

  ctx.place(ubosot(rng), 48, -52, -Math.PI / 2, { paint: 'paved' });
  ctx.place(bigGoldenChedi(rng), 78, -58, 0, { paint: 'paved' });
  ctx.place(bellTower(), 33, -32, 0, { paint: 'paved' });
  const rest = sala(rng, { w: 6, d: 3.6, h: 2.6, roof: M.tileOrange });
  prop(rest, 'bench', 0, .35, 0);
  ctx.place(rest, 52, -31, 0, { paint: 'paved' });
  const stupas = structure(null);
  for (const [x, z] of [[68, -33], [78, -31.5], [88, -33], [70, -83], [79, -85.5]]) { chedi(stupas, { x, z, scale: .5, body: M.plaster, base: M.plaster, spire: M.goldBright }); post(stupas, x, z, 1.4); }
  ctx.place(stupas, 0, 0);
  ctx.place(kuti(rng), 92.5, -91.5, -Math.PI / 2);
  ctx.place(kuti(rng), 96.5, -81, -Math.PI / 2);

  // Lotus pond with a stone rim and a raised bodhi-tree platform.
  const pond = structure(null);
  for (let i = 0; i < 40; i++) { const a = i / 40 * Math.PI * 2; box(pond, M.sandstone, POND.x + Math.cos(a) * (POND.rx + .9), .02, POND.z + Math.sin(a) * (POND.rz + .9), 1.6, .4, .5, -a + Math.PI / 2); }
  for (let i = 0; i < 26; i++) {
    const a = rng() * Math.PI * 2, r = Math.sqrt(rng()) * .85;
    const x = POND.x + Math.cos(a) * POND.rx * r, z = POND.z + Math.sin(a) * POND.rz * r;
    prop(pond, 'lotusPad', x, -.3, z, { s: rng.range(.8, 1.4) });
    if (i % 3 === 0) prop(pond, 'lotus', x, -.27, z);
  }
  cyl(pond, M.brick, 58, .3, -85, 3.2, 3.3, .6, 20); cyl(pond, M.plaster, 58, .62, -85, 3.3, 3.3, .06, 20);
  ctx.place(pond, 0, 0);
  ctx.collision.addCircle(58, -85, 2.6);
  ctx.veg.broadleaf(58, .6, -85, { s: 1.5, cards: 48 });
  ctx.ribbons.push([58, -85, 1.15]);

  const offerings = structure(null);
  for (let i = 0; i < 9; i++) prop(offerings, 'candle', 33.6 + (i % 3) * .3, .02, -48.8 + Math.floor(i / 3) * .4);
  glow(offerings, 33.9, .35, -48.4, 1.6, '#ffc46a', 'candle');
  ctx.place(offerings, 0, 0);

  ctx.spot('temple_pray', 35.4, -50.4, Math.PI / 2, 't1');
  ctx.spot('temple_pray2', 35.4, -53.8, Math.PI / 2, 't1');
  ctx.spot('temple_sweep', 70, -40, 0, 'cs');
  ctx.spot('temple_sala', 52, -29.4, Math.PI, 'tb');
  ctx.spot('kuti_a', 88.4, -91.5, -Math.PI / 2, 'tk');
  ctx.spot('kuti_b', 92.4, -81, -Math.PI / 2, 'c_ne');
  ctx.spot('bodhi_seat', 54.2, -82, Math.PI * .7, 'td');
}
