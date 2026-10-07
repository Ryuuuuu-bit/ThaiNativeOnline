import * as THREE from 'three';
import { M } from '../materials.js';
import { box, cyl, structure, solid, glow, sala, lanternPost } from '../Architecture.js';
import { WALL, riverBank } from '../CityMap.js';
import { OCC } from '../Terrain.js';

// Brick city walls with ใบเสมา merlons, corner forts and the north gate.
function wallRun(ctx, x1, z1, x2, z2) {
  const len = Math.hypot(x2 - x1, z2 - z1), rot = Math.atan2(x2 - x1, z2 - z1), n = Math.ceil(len / 8);
  const g = new THREE.Group();
  for (let i = 0; i < n; i++) {
    const t = (i + .5) / n, x = x1 + (x2 - x1) * t, z = z1 + (z2 - z1) * t, l = len / n + .02;
    box(g, M.brick, x, 1.7, z, 1.6, 3.4, l, rot);
    box(g, M.plaster, x, 3.45, z, 1.8, .16, l, rot);
    box(g, M.brickDark, x, .2, z, 1.9, .4, l, rot);
  }
  ctx.batcher.addObject(g);
  for (let d = .6; d < len; d += 1.25) ctx.props.add('merlon', x1 + (x2 - x1) * d / len, 3.53, z1 + (z2 - z1) * d / len, { ry: rot, color: '#d9cfb8' });
  ctx.collision.addSegment(x1, z1, x2, z2, .95);
  ctx.occ.markRect((x1 + x2) / 2, (z1 + z2) / 2, 2.6, len, rot, OCC.BUILDING);
  ctx.footprints.push({ x: (x1 + x2) / 2, z: (z1 + z2) / 2, w: 2, d: len, rot, paint: 'stone' });
}
function fort(ctx, x, z, r = 3.4, h = 4.8) {
  const g = structure({ w: r * 2 + 1, d: r * 2 + 1 });
  cyl(g, M.brick, 0, h / 2, 0, r, r + .25, h, 8);
  cyl(g, M.plaster, 0, h + .08, 0, r + .15, r + .15, .16, 8);
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; box(g, M.plaster, Math.cos(a) * r * .92, h + .45, Math.sin(a) * r * .92, .6, .7, .45, -a); }
  cyl(g, M.woodRed, 0, h + 1.4, 0, .12, .12, 2.6, 6);
  box(g, M.cloth.red, .45, h + 2.3, 0, .9, .5, .03);
  solid(g, 0, 0, r * 2, r * 2);
  ctx.place(g, x, z, 0, { paint: 'stone' });
}

export function buildWalls(ctx) {
  const Z = WALL.z, gate = 7.6;
  wallRun(ctx, WALL.west, Z, -gate, Z); wallRun(ctx, gate, Z, WALL.x, Z);
  for (const X of [WALL.west, WALL.x]) {
    // Side walls leave a water gate where the canal passes through.
    wallRun(ctx, X, Z, X, -17.5);
    wallRun(ctx, X, 1.5, X, riverBank(X) - 3.5);
    fort(ctx, X, Z); fort(ctx, X, riverBank(X) - 3.5, 2.8, 4.2);
    for (const z of [-17.5, 1.5]) fort(ctx, X, z, 2, 4.2);
  }

  // North gate: two brick towers, a lintel and a gate pavilion above.
  const g = structure({ w: 18, d: 6 });
  for (const s of [-1, 1]) {
    box(g, M.brick, s * 6, 2.6, 0, 3.4, 5.2, 4.2);
    box(g, M.plaster, s * 6, 5.28, 0, 3.6, .16, 4.4);
    box(g, M.woodRed, s * 4.95, 2, 2.3, .2, 4, 2.6, s * .35);
    solid(g, s * 6, 0, 3.4, 4.2);
  }
  box(g, M.brick, 0, 4.7, 0, 8.6, 1.1, 4.2);
  box(g, M.plaster, 0, 5.28, 0, 8.8, .16, 4.4);
  box(g, M.gold, 0, 4.7, 2.12, 2.4, .6, .05);
  const top = sala(ctx.rng, { w: 9, d: 3.2, h: 2.2, tiers: 2, base: .1, roof: M.tileOrange });
  top.position.y = 5.36; g.add(top);
  for (const s of [-1, 1]) { glow(g, s * 3.6, 3.5, 2.5, 1.6); glow(g, s * 3.6, 3.5, -2.5, 1.6); }
  ctx.place(g, 0, Z, 0, { paint: 'stone' });
  const posts = structure(null);
  for (const s of [-1, 1]) { lanternPost(posts, s * 4.6, -100.5); lanternPost(posts, s * 4.6, -121); }
  ctx.place(posts, 0, 0);
}
