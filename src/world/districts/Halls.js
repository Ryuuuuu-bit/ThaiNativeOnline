import * as THREE from 'three';
import { M } from '../materials.js';
import {
  mesh, box, cyl, cone, ball, beam, structure, solid, post, deck, prop, glow, smoke,
  thaiRoof, leanTo, panelFace, windowFrame, stairs, railing, hangingLantern, spiritHouse,
} from '../Architecture.js';
import { HALLS, hallSpots } from '../../data/halls.js';

// Class training halls (โรงฝึก) of ย่านสำนักครู, one per class, built from the
// records in src/data/halls.js (placement: world-designer). Every hall shares
// one Ayutthaya vocabulary (brick plinth with a sandstone cap, red/teak posts,
// flared tiled or thatched roof, signboard, banners, lanterns) and reads as its
// class through its props. Local space: front (door) faces +z, footprint
// `w` × `d` centred on the origin, the master's spot at (0, d/2 - 2) stays
// clear and walkable, and so does the straight path from it out of the door.
//
// The gameplay camera looks from the south-east, so for halls whose door faces
// west or north the class props sit on the side the camera sees (local +x for
// the west-facing row, the back and local -x for the north-facing ค่ายมวย).
// Nothing here draws from the shared layout sequence (ctx.rng) or the
// vegetation sequence, so the rest of the city lays out exactly as before.

// Shared module materials only, so the halls add no new draw-call buckets.
const leather = M.teak, bagRed = M.woodRed, bone = M.plaster, hide = M.clayLight;
const RING = new THREE.TorusGeometry(1, .14, 5, 16);
const BOW = new THREE.TorusGeometry(1, .035, 4, 10, Math.PI * .7);

// ---------- Shared pieces ----------
// Low plinth with a sandstone cap, a walkable deck and steps in front of the door.
function plinth(g, { x = 0, z = 0, w, d, h, m = M.brick, steps = 2, sw = 2.2 }) {
  box(g, m, x, h / 2, z, w, h, d);
  box(g, M.sandstone, x, h + .02, z, w + .12, .05, d + .12);
  deck(g, x, z, w, d, 0, h + .04, [0, 0]);
  const front = z + d / 2, L = steps * .32;
  stairs(g, M.sandstone, 0, front + L - .16, sw, h, steps);
  deck(g, 0, front, sw, L * 2 + .1, 0, h + .04, [0, L + .05]);
}
// Signboard (ป้าย) with a coloured plaque and gilded edges.
function sign(g, x, y, z, plaque, ry = 0, w = 2) {
  const s = new THREE.Group(); s.position.set(x, y, z); s.rotation.y = ry; g.add(s);
  box(s, M.darkWood, 0, 0, 0, w, .55, .07);
  box(s, plaque, 0, 0, .04, w - .25, .36, .02);
  for (const k of [-1, 1]) box(s, M.gold, 0, k * .24, .05, w - .1, .04, .02);
  return s;
}
// Tall banner pole (ธง) with a long cloth and two trim bands.
function banner(g, x, z, h, cloth, trim, ry = 0) {
  const b = new THREE.Group(); b.position.set(x, 0, z); b.rotation.y = ry; g.add(b);
  cyl(b, M.darkWood, 0, h / 2, 0, .05, .07, h, 6);
  ball(b, M.gold, 0, h + .06, 0, .09);
  box(b, M.darkWood, .34, h - .14, 0, .74, .05, .05);
  const ch = h * .42, cy = h - .2 - ch / 2;
  box(b, cloth, .34, cy, 0, .52, ch, .02);
  for (const k of [-.3, .3]) box(b, trim, .34, cy + k * ch, 0, .53, .08, .03);
  post(g, x, z, .12);
}
// Simple post-and-beam column with a gilded or dark cap.
function column(g, x, z, y0, h, m = M.teak, cap = M.gold, r = .14) {
  cyl(g, m, x, y0 + h / 2, z, r, r + .02, h, 8);
  cyl(g, cap, x, y0 + h - .08, z, r + .05, r + .03, .14, 8);
  post(g, x, z, r + .06);
}
// Lantern on a post beside a door (local), lit after dusk.
function doorLamp(g, x, z, paper = false) {
  cyl(g, M.darkWood, x, 1.1, z, .06, .08, 2.2, 6);
  box(g, M.darkWood, x, 2.2, z - .2, .06, .06, .5);
  cyl(g, paper ? M.lanternPaper : M.lantern, x, 1.95, z - .42, .13, .13, .32, 8);
  glow(g, x, 1.95, z - .42, 1.3);
  post(g, x, z, .12);
}
// A straight blade (ดาบ) standing on its point: blade, guard and hilt.
function sword(g, x, y, z, ry = 0, len = .95) {
  box(g, M.steel, x, y + len / 2, z, .05, len, .02, ry);
  box(g, M.gold, x, y + len + .02, z, .2, .04, .05, ry);
  box(g, M.darkWood, x, y + len + .18, z, .05, .28, .05, ry);
}
// Glaive (ง้าว): a long shaft with a curved blade at the top.
function ngao(g, x, z, y0, lean = .1, h = 2.3) {
  beam(g, M.wood, [x, y0, z], [x, y0 + h, z - lean], .03, 5);
  box(g, M.steel, x, y0 + h + .2, z - lean - .04, .03, .46, .13, 0, -.25);
  box(g, M.gold, x, y0 + h - .02, z - lean, .07, .06, .07);
}
// Round shield (โล่) hung on a wall that faces local direction (nx, nz).
function shield(g, x, y, z, nx, nz, m = leather, r = .36) {
  beam(g, m, [x, y, z], [x + nx * .06, y, z + nz * .06], r, 12);
  beam(g, M.gold, [x + nx * .05, y, z + nz * .05], [x + nx * .09, y, z + nz * .09], r * .3, 8);
}
// Bow (ธนู) hung flat on a wall whose face is the local yz plane (x = const).
function bow(g, x, y, z, s = .55) {
  mesh(g, BOW, M.teak, x, y, z, s, s, s, Math.PI / 2, 0, -Math.PI * .35);
  box(g, M.cloth.white, x, y, z - .454 * s, .01, 1.78 * s, .01);
}
// Bundle of herbs or charms hanging from a beam at y.
function hanging(g, m, x, y, z, len = .45) {
  box(g, M.rope, x, y - .1, z, .02, .2, .02);
  box(g, m, x, y - .2 - len / 2, z, .14, len, .14);
}
// Framed plank walls around a rectangle (x ±hw, z z0..z1) with an optional front doorway.
function walls(g, { hw, z0, z1, y0, h, wall, frame, door = 1.6, windows = [] }) {
  const d = z1 - z0, zc = (z0 + z1) / 2, seg = (hw * 2 - door) / 2;
  box(g, wall, 0, y0 + h / 2, z0 + .07, hw * 2, h, .14);
  for (const s of [-1, 1]) box(g, wall, s * (hw - .07), y0 + h / 2, zc, .14, h, d);
  for (const s of [-1, 1]) box(g, wall, s * (door / 2 + seg / 2), y0 + h / 2, z1 - .07, seg, h, .14);
  box(g, wall, 0, y0 + h - .25, z1 - .07, door, .5, .14);
  box(g, M.darkWood, 0, y0 + (h - .5) / 2, z1 - .5, door, h - .5, .05);
  for (const s of [-1, 1]) box(g, frame, s * (door / 2 + .05), y0 + (h - .5) / 2, z1 + .02, .1, h - .5, .08);
  box(g, frame, 0, y0 + h - .5, z1 + .03, door + .3, .12, .1);
  panelFace(g, frame, 0, z1, 0, hw * 2, y0, h, { skip: [[-door / 2 - .15, door / 2 + .15]] });
  panelFace(g, frame, 0, z0, Math.PI, hw * 2, y0, h, { skip: [[-2.6, -1.4], [1.4, 2.6]] });
  for (const s of [-1, 1]) panelFace(g, frame, s * hw, zc, s * Math.PI / 2, d, y0, h, { skip: [[-.6, .6]] });
  const wy = y0 + h * .55;
  for (const s of [-1, 1]) {
    windowFrame(g, { x: s * 2, y: wy, z: z0, rot: Math.PI, frame, shutter: windows[0] ?? M.teak });
    windowFrame(g, { x: s * hw, y: wy, z: zc, rot: s * Math.PI / 2, frame, shutter: windows[0] ?? M.teak, open: s > 0 });
  }
}

// ---------- ค่ายมวยไทย ----------
// Open-sided sala across the front (the master's side) on a long brick plinth;
// behind it, open to the sky so the gameplay camera sees it, the raised ring
// framed by bunting and lantern poles, and a frame of heavy bags.
function muaythaiHall({ w, d }) {
  const g = structure({ w, d });
  const base = .35, colH = 3.1, top = base + colH, z0 = .6, z1 = 4.6;
  plinth(g, { w: 14, d: 10, h: base, sw: 3 });
  for (const x of [-6.6, -3.3, 0, 3.3, 6.6]) for (const z of [z0, z1]) {
    if (z === z1 && x === 0) continue;
    column(g, x, z, base, colH, M.woodRed, M.gold, .15);
    // Red and white cloth bands (ประเจียด) on every post.
    cyl(g, M.cloth.red, x, base + 1.2, z, .19, .19, .22, 8); cyl(g, M.cloth.white, x, base + 1.42, z, .19, .19, .1, 8);
  }
  for (const z of [z0, z1]) box(g, M.darkWood, 0, top, z, 13.5, .2, .16);
  for (const s of [-1, 1]) box(g, M.darkWood, s * 6.6, top, (z0 + z1) / 2, .16, .2, 4.3);
  // Stepped roof: the middle bay rises above the two side bays.
  const roof = { material: M.tile, gable: M.woodRed, trim: M.darkWood, battens: M.gold, pattern: 'sun', ry: Math.PI / 2, z: (z0 + z1) / 2 };
  thaiRoof(g, { ...roof, width: 6.6, depth: 6.8, height: 3.6, y: top + .4 });
  for (const s of [-1, 1]) thaiRoof(g, { ...roof, x: s * 5.45, width: 6.2, depth: 4.7, height: 3.3, y: top, ends: [s] });
  // The ring (เวที): red apron, blue canvas, coloured corners and three ropes.
  const rx = -2.6, rz = -2.35, rs = 5.2, rh = base + .65, e = rs / 2 - .12;
  box(g, M.cloth.red, rx, (base + rh) / 2, rz, rs, rh - base, rs);
  box(g, M.cloth.blue, rx, rh + .02, rz, rs - .08, .05, rs - .08);
  box(g, M.cloth.white, rx, rh - .05, rz, rs + .04, .06, rs + .04);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const corner = sx === sz ? (sx < 0 ? M.cloth.red : M.cloth.blue) : M.cloth.white;
    cyl(g, M.darkWood, rx + sx * e, rh + .7, rz + sz * e, .07, .07, 1.4, 6);
    cyl(g, corner, rx + sx * e, rh + .8, rz + sz * e, .13, .13, 1, 8);
  }
  [M.cloth.red, M.cloth.white, M.cloth.blue].forEach((m, i) => {
    const y = rh + .45 + i * .36;
    for (const s of [-1, 1]) { box(g, m, rx, y, rz + s * e, rs - .24, .05, .05); box(g, m, rx + s * e, y, rz, .05, .05, rs - .24); }
  });
  for (let i = 0; i < 2; i++) box(g, M.wood, rx + rs / 2 + .2 + i * .3, base + .12 + (1 - i) * .2, rz, .32, .24 + (1 - i) * .4, 1);
  solid(g, rx, rz, rs, rs); solid(g, rx + rs / 2 + .35, rz, .6, 1);
  // Lantern poles at the back corners of the ring, strung with red and white bunting (ธงราว).
  const poles = [[-5.7, -4.75], [.55, -4.75]], by = 3.1;
  for (const [x, z] of poles) {
    cyl(g, M.darkWood, x, base + 1.6, z, .06, .08, 3.2, 6); ball(g, M.gold, x, base + 3.25, z, .08);
    box(g, M.darkWood, x, base + 2.9, z + .2, .05, .05, .45); cyl(g, M.lantern, x, base + 2.6, z + .4, .13, .13, .3, 8);
    glow(g, x, base + 2.6, z + .4, 1.4); post(g, x, z, .14);
  }
  const string = (a, b) => {
    beam(g, M.rope, a, b, .012, 3);
    const n = Math.round(Math.hypot(b[0] - a[0], b[2] - a[2]) / .5);
    for (let i = 1; i < n; i++) { const t = i / n; box(g, i % 2 ? M.cloth.white : M.cloth.red, a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - .14 - Math.sin(t * Math.PI) * .25, a[2] + (b[2] - a[2]) * t, .2, .22, .01, Math.atan2(b[0] - a[0], b[2] - a[2]) + Math.PI / 2); }
  };
  string([poles[0][0], base + by, poles[0][1]], [poles[1][0], base + by, poles[1][1]]);
  string([poles[0][0], base + by, poles[0][1]], [-6.6, top - .1, z0]);
  string([poles[1][0], base + by, poles[1][1]], [0, top - .1, z0]);
  // Heavy bags (กระสอบทราย) on an open frame beside the ring.
  for (const x of [1.9, 6.5]) { cyl(g, M.darkWood, x, base + 1.5, -3.2, .1, .12, 3, 6); post(g, x, -3.2, .16); }
  box(g, M.darkWood, 4.2, base + 2.95, -3.2, 4.9, .16, .16);
  for (const x of [2.95, 4.2, 5.45]) {
    box(g, M.rope, x, base + 2.6, -3.2, .03, .6, .03);
    cyl(g, M.darkWood, x, base + 2.27, -3.2, .2, .2, .08, 8);
    cyl(g, bagRed, x, base + 1.65, -3.2, .27, .25, 1.2, 10);
    cyl(g, M.darkWood, x, base + 1.55, -3.2, .275, .275, .08, 10);
    post(g, x, -3.2, .32);
  }
  prop(g, 'bench', 4.2, base, -1.2); solid(g, 4.2, -1.2, 1.6, .6);
  prop(g, 'bigJar', 6.4, base, -1.1, { s: .8 }); post(g, 6.4, -1.1, .45);
  // Drum corner (กลองแขก, ฉิ่ง) at the back right of the sala.
  box(g, M.darkWood, 5.2, base + .25, 1.35, 1.7, .08, 1.2);
  for (const s of [-1, 1]) box(g, M.darkWood, 5.2 + s * .75, base + .12, 1.35, .08, .24, 1.1);
  [[1.1, .21], [1.65, .18]].forEach(([z, r]) => {
    beam(g, M.teak, [4.6, base + .29 + r, z], [5.8, base + .29 + r, z], r, 10);
    for (const x of [4.58, 5.82]) beam(g, M.cloth.cream, [x - .02, base + .29 + r, z], [x + .02, base + .29 + r, z], r + .01, 10);
  });
  cyl(g, M.gold, 5.6, base + .32, 1.9, .07, .09, .04, 8); cyl(g, M.gold, 5.75, base + .32, 1.9, .07, .09, .04, 8);
  solid(g, 5.2, 1.35, 1.7, 1.2);
  // Teacher's shelf (หิ้งไหว้ครู) with the mongkol, a gilded figure and candles.
  const ax = -4.9, az = .9;
  box(g, M.teak, ax, base + 1.05, az, 1.5, .08, .5);
  for (const s of [-1, 1]) box(g, M.darkWood, ax + s * .65, base + .52, az, .07, 1.04, .4);
  box(g, M.cloth.red, ax, base + .85, az + .23, 1.5, .4, .02);
  box(g, M.cloth.white, ax, base + 1.0, az + .24, 1.5, .08, .02);
  cyl(g, M.gold, ax - .3, base + 1.25, az - .05, .1, .14, .32, 8); ball(g, M.gold, ax - .3, base + 1.48, az - .05, .09);
  mesh(g, RING, M.cloth.white, ax + .25, base + 1.12, az, .17, .17, .17, 0, Math.PI / 2);
  box(g, M.cloth.red, ax + .42, base + 1.11, az, .2, .03, .04);
  for (let i = 0; i < 3; i++) prop(g, 'candle', ax - .05 + i * .2, base + 1.09, az + .13);
  glow(g, ax + .15, base + 1.3, az + .15, .9, '#ffc46a', 'candle');
  solid(g, ax, az, 1.5, .5);
  // Benches for the trainees, banners, signs and lanterns.
  prop(g, 'bench', -5.7, base, 3.3, { ry: Math.PI / 2 }); solid(g, -5.7, 3.3, .6, 1.6);
  prop(g, 'bench', 5.5, base, 3.5, { ry: Math.PI / 2 }); solid(g, 5.5, 3.5, .6, 1.6);
  for (const s of [-1, 1]) banner(g, s * 7.1, 5.05, 5.2, M.cloth.red, M.cloth.white, s > 0 ? 0 : Math.PI);
  sign(g, 0, top + .32, z1 + .12, M.cloth.red, 0, 2.4);
  sign(g, 0, top + .32, z0 - .12, M.cloth.red, Math.PI, 2.4);
  for (const [x, z] of [[-1.65, z1], [1.65, z1], [-1.65, z0], [1.65, z0]]) hangingLantern(g, x, top - .5, z);
  return g;
}

// ---------- สำนักดาบนักรบ ----------
// Solid red-lacquered hall with a deep verandah of sword and glaive racks; the
// practice yard with its posts and dummy lies on the camera side (local +x).
function warriorHall({ w, d }) {
  const g = structure({ w, d });
  const base = .5, wh = 2.7, top = base + wh, bw = 8, bz0 = -5, bz1 = 1.2;
  plinth(g, { z: -.1, w: 8.8, d: 10.2, h: base, sw: 2.4 });
  walls(g, { hw: bw / 2, z0: bz0, z1: bz1, y0: base, h: wh, wall: M.woodRed, frame: M.darkWood, door: 1.8 });
  solid(g, 0, (bz0 + bz1) / 2, bw, bz1 - bz0);
  // Shields and crossed spears on both side walls.
  for (const s of [-1, 1]) for (const z of [-3.8, -.2]) {
    beam(g, M.wood, [s * 4.05, base + .6, z - .55], [s * 4.05, base + 2.4, z + .55], .025, 4);
    beam(g, M.wood, [s * 4.05, base + .6, z + .55], [s * 4.05, base + 2.4, z - .55], .025, 4);
    shield(g, s * 4.04, base + 1.5, z, s, 0, z < -1 ? leather : M.woodRed);
  }
  for (const x of [-3.9, -1.5, 1.5, 3.9]) column(g, x, 4.7, base, wh);
  box(g, M.darkWood, 0, top, 4.7, 8.4, .18, .16);
  thaiRoof(g, { width: 9.6, depth: 11.4, height: 5.4, y: top, z: -.1, material: M.tile, gable: M.woodRed, trim: M.darkWood, battens: M.gold, pattern: 'sun' });
  // Verandah racks: swords (ดาบ) on the left, glaives (ง้าว) on the right.
  for (const y of [base + .45, base + 1.35]) box(g, M.darkWood, -2.9, y, 1.5, 2.3, .07, .07);
  for (const s of [-1, 1]) box(g, M.darkWood, -2.9 + s * 1.15, base + .75, 1.5, .08, 1.5, .08);
  for (let i = 0; i < 6; i++) sword(g, -3.85 + i * .38, base + .1, 1.56);
  for (const s of [-1, 1]) box(g, M.darkWood, 2.9 + s * 1.15, base + 1.1, 1.45, .08, 2.2, .08);
  box(g, M.darkWood, 2.9, base + 1.9, 1.45, 2.4, .07, .07);
  for (let i = 0; i < 4; i++) ngao(g, 2.2 + i * .45, 1.6, base + .05, .12);
  solid(g, -2.9, 1.6, 2.4, .5); solid(g, 2.9, 1.6, 2.4, .5);
  // Practice yard: a rope-wrapped striking post, a standing rack and a straw dummy.
  cyl(g, M.wood, 5.4, .95, 2.6, .14, .17, 1.9, 8); cyl(g, M.rope, 5.4, 1.1, 2.6, .18, .18, .6, 8);
  for (const y of [1.3, .7]) beam(g, M.wood, [5.4, y, 2.15], [5.4, y + .05, 3.05], .05, 5);
  post(g, 5.4, 2.6, .3);
  for (const z of [-1.7, .5]) cyl(g, M.darkWood, 5.5, .75, z, .06, .07, 1.5, 6);
  for (const y of [.45, 1.35]) box(g, M.darkWood, 5.5, y, -.6, .07, .07, 2.3);
  for (let i = 0; i < 4; i++) sword(g, 5.5, .1, -1.35 + i * .35, Math.PI / 2);
  for (let i = 0; i < 2; i++) ngao(g, 5.6, .15 + i * .5, 0, -.12);
  shield(g, 5.85, .55, -1.2, 1, 0, M.woodRed, .3); shield(g, 5.85, .55, -.1, 1, 0, leather, .3);
  solid(g, 5.55, -.6, .7, 2.4);
  cyl(g, M.wood, 5.4, .9, -3.4, .14, .16, 1.8, 8); box(g, M.wood, 5.4, 1.3, -3.4, .12, .12, 1.1);
  ball(g, M.hay, 5.4, 1.95, -3.4, .22); cyl(g, M.hay, 5.4, 1.35, -3.4, .25, .22, .7, 8);
  post(g, 5.4, -3.4, .3);
  // Bench and jar on the far side, banners, sign and lanterns.
  prop(g, 'bench', -5.5, 0, 1.6, { ry: Math.PI / 2 }); solid(g, -5.5, 1.6, .6, 1.6);
  prop(g, 'bigJar', -5.6, 0, -2.6, { s: .9 }); post(g, -5.6, -2.6, .5);
  for (const s of [-1, 1]) banner(g, s * 6.1, 4.9, 5.4, M.cloth.indigo, M.cloth.red, s > 0 ? 0 : Math.PI);
  banner(g, 6.1, -4.9, 4.6, M.cloth.red, M.cloth.yellow, -Math.PI / 2);
  sign(g, 0, top + .4, 5.15, M.cloth.indigo);
  for (const s of [-1, 1]) hangingLantern(g, s * 2.7, top - .5, 4.7);
  for (const s of [-1, 1]) doorLamp(g, s * 2.3, 6.3);
  return g;
}

// ---------- ทับนายพราน ----------
// Rustic thatched hut raised on stilts with a bamboo terrace; target butts,
// hide frames and the dog's kennel on the camera side, a fire pit in front.
function hunterHall({ w, d }) {
  const g = structure({ w, d });
  const fh = 1.5, wh = 2, top = fh + wh, hx = 3.6;
  for (const x of [-3.4, 0, 3.4]) for (const z of [-4.8, -.2]) cyl(g, M.darkWood, x, top / 2, z, .1, .13, top, 6);
  for (const x of [-3.4, 3.4]) cyl(g, M.darkWood, x, (fh + 1) / 2, 1.9, .08, .1, fh + 1, 6);
  for (const z of [-4.8, -.2, 1.9]) box(g, M.darkWood, 0, fh - .2, z, 7.3, .14, .14);
  box(g, M.wood, 0, fh, -2.5, 7.4, .16, 5.2);
  box(g, M.woodPale, 0, fh - .02, 1, 7.2, .14, 2);
  for (let i = 1; i < 5; i++) box(g, M.wood, 0, fh + .052, i * .4, 7.1, .012, .035);
  walls(g, { hw: hx, z0: -5, z1: 0, y0: fh + .08, h: wh - .08, wall: M.woodPale, frame: M.wood, door: 1.1, windows: [M.wood] });
  thaiRoof(g, { width: 8, depth: 8.8, height: 5, y: top - .05, z: -1.6, ry: Math.PI / 2, material: M.thatch, gable: M.woodPale, trim: M.darkWood, pattern: 'panel', battens: M.wood });
  // Deer antlers on a board, on the camera-side gable.
  const ay = top + 2.3, ax = 4.42;
  box(g, M.darkWood, ax, ay, -1.6, .05, .42, .3);
  for (const s of [-1, 1]) {
    beam(g, M.woodPale, [ax + .05, ay + .1, -1.6 + s * .06], [ax + .08, ay + .6, -1.6 + s * .42], .035, 4);
    beam(g, M.woodPale, [ax + .07, ay + .35, -1.6 + s * .22], [ax + .08, ay + .62, -1.6 + s * .14], .025, 4);
  }
  railing(g, M.wood, -2, 1.95, 3.55, 1.95, fh);
  for (const s of [-1, 1]) railing(g, M.wood, s * 3.55, .1, s * 3.55, 1.9, fh, .5);
  stairs(g, M.wood, -2.6, 2 + 5 * .32 - .16, .9, fh, 5);
  for (const s of [-1, 1]) beam(g, M.wood, [-2.6 + s * .48, .05, 3.6], [-2.6 + s * .48, fh, 2], .045, 4);
  solid(g, 0, -1.6, 7.4, 7.2);
  // Bows and a quiver on the camera-side wall.
  for (const z of [-4.1, -.9]) bow(g, hx + .08, fh + 1.1, z);
  cyl(g, leather, hx + .15, fh + .8, -3.4, .1, .09, .7, 8);
  for (let i = 0; i < 4; i++) box(g, M.woodPale, hx + .15 + (i % 2) * .04 - .02, fh + 1.25, -3.45 + i * .03, .02, .3, .02);
  // Fire pit in front.
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; prop(g, 'rock', 1.7 + Math.cos(a) * .55, .08, 4.3 + Math.sin(a) * .55, { s: .18, color: '#8a877a' }); }
  box(g, M.darkWood, 1.7, .1, 4.3, .8, .1, .1, .6); box(g, M.darkWood, 1.7, .12, 4.3, .8, .1, .1, -.6);
  for (const s of [-1, 1]) beam(g, M.darkWood, [1.7 + s * .7, 0, 4.3], [1.7 + s * .35, 1.2, 4.3], .03, 4);
  box(g, M.darkWood, 1.7, 1.15, 4.3, 1.1, .04, .04);
  glow(g, 1.7, .35, 4.3, 1.3, '#ff9a4a', 'fire'); smoke(g, 1.7, .7, 4.3, { rate: .6, size: .8, color: '#9a978f' });
  post(g, 1.7, 4.3, .65);
  // Target butts (เป้า) at the back of the camera-side strip, facing the front.
  for (const x of [4.6, 5.9]) {
    for (const s of [-1, 1]) beam(g, M.darkWood, [x + s * .45, 0, -4.6], [x + s * .25, 1.5, -4.35], .04, 4);
    const face = new THREE.Group(); face.position.set(x, 1.15, -4.25); face.rotation.x = Math.PI / 2 - .15; g.add(face);
    cyl(face, M.hay, 0, 0, 0, .55, .55, .2, 14); cyl(face, M.cloth.white, 0, -.11, 0, .36, .36, .02, 14); cyl(face, M.cloth.red, 0, -.12, 0, .14, .14, .02, 10);
    for (let i = 0; i < 2; i++) beam(g, M.woodPale, [x - .1 + i * .25, 1.1 + i * .12, -4.1], [x - .14 + i * .25, 1.12 + i * .12, -3.6], .012, 3);
    post(g, x, -4.4, .45);
  }
  // Hides stretched on pole frames.
  for (const z of [-2, -.3]) {
    for (const s of [-1, 1]) cyl(g, M.darkWood, 5.2, .85, z + s * .7, .04, .05, 1.7, 5);
    box(g, M.darkWood, 5.2, 1.65, z, .05, .05, 1.5);
    box(g, hide, 5.24, 1, z, .02, 1.05, 1.05, 0, 0, .08);
    post(g, 5.2, z, .4);
  }
  // Dog kennel with a bowl.
  box(g, M.woodPale, 5.3, .4, 2.7, 1, .8, 1.1);
  box(g, M.darkWood, 5.81, .32, 2.7, .02, .5, .45);
  for (const s of [-1, 1]) box(g, M.thatch, 5.3 + s * .3, .95, 2.7, .75, .06, 1.25, 0, 0, -s * .65);
  prop(g, 'pot', 6, 0, 3.5, { s: .7 });
  solid(g, 5.3, 2.7, 1.1, 1.2);
  // Firewood, traps and baskets on the far side.
  for (let i = 0; i < 6; i++) box(g, M.branch, -5.1, .08 + (i > 2 ? .15 : 0), -2.6 + (i > 2 ? i - 3.5 : i) * .17, 1.4, .15, .15, Math.PI / 2);
  solid(g, -5.1, -2.4, 1.4, .8);
  prop(g, 'trap', -5.2, 0, 1, { ry: .4 }); prop(g, 'basket', -5.4, 0, 2.2);
  for (const s of [-1, 1]) hangingLantern(g, s * 3.2, top - .7, 1.9, M.lanternPaper);
  banner(g, 6.1, 4.7, 4.4, M.cloth.green, leather, 0);
  sign(g, .8, fh + .55, 2.08, M.cloth.green, 0, 1.6);
  for (const s of [-1, 1]) doorLamp(g, s * 2.3, 6.3, true);
  return g;
}

// ---------- สำนักหมอยา ----------
// Teak medicine house with a green-tiled roof: shelves of jars, the mortar
// (ครก) and grinding trough on the verandah, herb bundles under the eaves,
// raised herb beds, a drying rack and a simmering stove on the camera side.
function herbalistHall({ w, d }) {
  const g = structure({ w, d });
  const base = .4, wh = 2.6, top = base + wh, bw = 8, bz0 = -5, bz1 = 1;
  plinth(g, { z: -.1, w: 8.8, d: 10.2, h: base, m: M.stone, sw: 2.2 });
  walls(g, { hw: bw / 2, z0: bz0, z1: bz1, y0: base, h: wh, wall: M.woodLight, frame: M.teak, door: 1.6, windows: [M.woodRed] });
  solid(g, 0, (bz0 + bz1) / 2, bw, bz1 - bz0);
  for (const x of [-3.9, -1.5, 1.5, 3.9]) column(g, x, 4.6, base, wh, M.teak, M.darkWood);
  box(g, M.darkWood, 0, top, 4.6, 8.4, .18, .16);
  thaiRoof(g, { width: 9.6, depth: 11.2, height: 5.2, y: top, z: -.1, material: M.tileGreen, gable: M.woodLight, trim: M.darkWood, battens: M.teak, pattern: 'panel' });
  // Shelves of medicine jars against the front wall.
  for (let level = 0; level < 3; level++) {
    box(g, M.darkWood, -2.85, base + .5 + level * .62, 1.3, 2.2, .05, .45);
    for (let i = 0; i < 5; i++) prop(g, level === 1 ? 'jar' : 'pot', -3.7 + i * .42, base + .53 + level * .62, 1.3, { s: level === 1 ? .38 : .55 });
  }
  for (const s of [-1, 1]) box(g, M.darkWood, -2.85 + s * 1.1, base + .85, 1.3, .06, 1.7, .45);
  solid(g, -2.85, 1.35, 2.3, .55);
  // Mortar and pestle, and a boat-shaped grinding trough (รางบดยา).
  box(g, M.woodLight, 2.7, base + .2, 2.9, .7, .4, .7);
  prop(g, 'mortar', 2.7, base + .4, 2.9, { s: 1.8 });
  beam(g, M.wood, [2.75, base + .55, 2.9], [2.95, base + 1.5, 2.75], .05, 6);
  box(g, M.stoneDark, 2.8, base + .16, 1.55, 1.3, .3, .4);
  beam(g, M.stoneDark, [2.65, base + .42, 1.55], [2.75, base + .42, 1.55], .24, 12);
  box(g, M.wood, 2.7, base + .42, 1.55, .7, .04, .04);
  solid(g, 2.7, 2.9, .8, .8); solid(g, 2.8, 1.55, 1.4, .5);
  // Herb bundles drying under the front beam, clear of the doorway.
  const herbs = [M.moss, M.hay, M.cloth.green, M.moss, M.rope];
  for (let i = 0; i < 6; i++) for (const s of [-1, 1]) hanging(g, herbs[(i + (s > 0 ? 2 : 0)) % herbs.length], s * (1.1 + i * .45), top - .1, 4.6, .4 + (i % 2) * .12);
  // A gourd (น้ำเต้า), the healer's sign, hung from the right front post.
  box(g, M.rope, 1.5, top - .35, 4.85, .02, .4, .02);
  ball(g, M.clayLight, 1.5, top - .85, 4.85, .2, .24, .2); ball(g, M.clayLight, 1.5, top - .55, 4.85, .12);
  // Raised herb beds (แปลงสมุนไพร) on the camera side and one on the far side.
  const greens = ['#5d8a3c', '#6f9a3c', '#4f7a36', '#7a9a45', '#8aa04a'];
  for (const [bx, bz] of [[5.3, 2.4], [5.3, -.6], [-5.4, -1]]) {
    for (const s of [-1, 1]) { box(g, M.brick, bx + s * .8, .14, bz, .14, .28, 2.3); box(g, M.brick, bx, .14, bz + s * 1.08, 1.6, .28, .14); }
    box(g, M.earth, bx, .2, bz, 1.5, .1, 2.1);
    for (let i = 0; i < 8; i++) {
      const hx = bx + (i % 2 ? .35 : -.35), hz = bz - .8 + Math.floor(i / 2) * .53;
      prop(g, 'herb', hx, .25, hz, { s: .8 + (i % 3) * .15, color: greens[i % greens.length] });
      if (i % 3 === 0) prop(g, 'flower', hx + .05, .25, hz + .05, { color: i % 2 ? '#e2c25a' : '#d9573f' });
    }
    solid(g, bx, bz, 1.7, 2.3);
  }
  // Tiered drying rack of flat baskets.
  for (const s of [-1, 1]) for (const t of [-1, 1]) cyl(g, M.darkWood, 5.3 + s * .6, .75, -3.7 + t * .6, .04, .05, 1.5, 5);
  for (const y of [.55, 1.05, 1.5]) {
    box(g, M.woodPale, 5.3, y, -3.7, 1.3, .04, 1.3);
    for (let i = 0; i < 4; i++) prop(g, 'basket', 5.3 + (i % 2 ? .3 : -.3), y + .02, -3.7 + (i > 1 ? .3 : -.3), { s: .9, sy: .25 });
    for (let i = 0; i < 4; i++) prop(g, 'pile', 5.3 + (i % 2 ? .3 : -.3), y + .06, -3.7 + (i > 1 ? .3 : -.3), { s: .7, sy: .3, color: greens[(i + Math.round(y * 2)) % greens.length] });
  }
  solid(g, 5.3, -3.7, 1.4, 1.4);
  // Clay stove (เตาอั้งโล่) with a simmering pot, and big water jars.
  cyl(g, M.clay, 4.8, .3, 4.5, .28, .32, .6, 10); cyl(g, M.clayLight, 4.8, .72, 4.5, .26, .2, .3, 10);
  box(g, M.ember, 4.8, .25, 4.79, .2, .14, .02);
  glow(g, 4.8, .5, 4.6, .8, '#ff9a4a', 'fire'); smoke(g, 4.8, 1, 4.5, { rate: .5, size: .6, color: '#b8b6a6', rise: .6 });
  post(g, 4.8, 4.5, .4);
  prop(g, 'bigJar', 6.1, 0, 4.4, { s: .85 }); prop(g, 'jar', 6.2, 0, 3.5, { s: .8 }); post(g, 6.1, 4.1, .55);
  prop(g, 'bigJar', -5.8, 0, 2.6); post(g, -5.8, 2.6, .5);
  for (let i = 0; i < 3; i++) prop(g, 'plantPot', -5.2 + i * .45, 0, 4.6, { s: 1 });
  sign(g, 0, top + .4, 5.05, M.cloth.green);
  for (const s of [-1, 1]) hangingLantern(g, s * 2.7, top - .5, 4.6, M.lanternPaper);
  for (const s of [-1, 1]) doorLamp(g, s * 2.2, 6.3, true);
  return g;
}

// ---------- ตำหนักหมอผี ----------
// Dark-timber shrine house on a black stone plinth with a steep dark roof:
// yantra cloths between the posts, charms and clay pots under the eaves,
// candle tables, a buffalo skull on the gable and a spirit house by the steps.
function shamanHall({ w, d }) {
  const g = structure({ w, d });
  const base = .5, wh = 2.6, top = base + wh, bw = 7.2, bz0 = -4, bz1 = .6;
  plinth(g, { z: -.55, w: 8.6, d: 7.5, h: base, m: M.stoneDark, sw: 2 });
  walls(g, { hw: bw / 2, z0: bz0, z1: bz1, y0: base, h: wh, wall: M.darkWood, frame: M.woodRed, door: 1.4, windows: [M.darkWood] });
  solid(g, 0, (bz0 + bz1) / 2, bw, bz1 - bz0);
  for (const x of [-3.9, -1.4, 1.4, 3.9]) {
    column(g, x, 2.9, base, wh, M.darkWood, M.woodRed, .13);
    cyl(g, M.cloth.red, x, base + 1.5, 2.9, .16, .16, .3, 8);
  }
  box(g, M.woodRed, 0, top, 2.9, 8.3, .18, .16);
  const rz = -.5, rd = 8.6;
  thaiRoof(g, { width: 9.2, depth: rd, height: 6.2, y: top, z: rz, material: M.tileDark, gable: M.darkWood, trim: M.woodRed, battens: M.woodRed, pattern: 'sun' });
  // Buffalo skull on the front gable.
  const gz = rz + rd / 2 - .06, sy = top + 1.5;
  ball(g, bone, 0, sy, gz, .24, .3, .12);
  for (const s of [-1, 1]) { box(g, M.darkWood, s * .09, sy + .05, gz + .1, .07, .07, .02); beam(g, bone, [s * .18, sy + .18, gz], [s * .5, sy + .48, gz + .05], .05, 5); beam(g, bone, [s * .5, sy + .48, gz + .05], [s * .48, sy + .72, gz + .06], .035, 5); }
  // Yantra cloths (ผ้ายันต์) between the front posts, a small one over the steps.
  for (const s of [-1, 1]) for (const k of [-.45, .45]) box(g, M.yantra, s * 2.65 + k, top - .58, 2.92, .52, .78, .01);
  box(g, M.yantra, 0, top - .38, 2.92, .5, .4, .01);
  // A string of charms: small clay pots and bone tokens.
  for (let i = 0; i < 7; i++) {
    const x = -3.4 + i * 1.13; if (Math.abs(x) < .9) continue;
    box(g, M.rope, x, top - .25, 3.05, .015, .35, .015);
    if (i % 2) prop(g, 'pot', x, top - .75, 3.05, { s: .5 }); else box(g, bone, x, top - .5, 3.05, .07, .16, .04);
  }
  // Candle tables either side of the master, with incense and one small skull.
  for (const s of [-1, 1]) {
    const tx = s * 2.5;
    box(g, M.darkWood, tx, base + .5, 1.5, 1.4, .07, .6);
    for (const k of [-1, 1]) box(g, M.darkWood, tx + k * .6, base + .25, 1.5, .06, .5, .5);
    box(g, M.cloth.red, tx, base + .45, 1.81, 1.4, .14, .02);
    for (let i = 0; i < 5; i++) prop(g, 'candle', tx - .5 + i * .25, base + .54, 1.4 + (i % 2) * .2);
    glow(g, tx, base + .8, 1.5, 1.1, '#ffbf6a', 'candle');
    solid(g, tx, 1.5, 1.5, .7);
  }
  prop(g, 'pot', 2.95, base + .54, 1.55, { s: .45 }); smoke(g, 2.95, base + .9, 1.55, { rate: .7, size: .5, color: '#b9b3a8', rise: .5 });
  ball(g, bone, -2.95, base + .66, 1.5, .11, .1, .12);
  for (const s of [-1, 1]) box(g, M.darkWood, -2.99 + s * .04, base + .68, 1.61, .03, .03, .01);
  // A pale spirit light in the doorway after dark.
  glow(g, 0, base + 1.1, .4, 1.5, '#8fe6d6', 'spirit-night');
  // Hanging clay pots along the camera-side eave.
  for (const z of [-3.2, -2, -.8]) { box(g, M.rope, -4.1, top - .2, z, .015, .4, .015); prop(g, 'pot', -4.1, top - .75, z, { s: .55 }); }
  // Spirit house (ศาลพระภูมิ) by the steps; a yantra flag pole opposite.
  spiritHouse(-4.6, 3.75, g);
  banner(g, 4.7, 3.8, 4.6, M.yantra, M.cloth.black, 0);
  for (const s of [-1, 1]) hangingLantern(g, s * 3.6, top - .55, 2.9, M.lanternPaper);
  sign(g, 0, top + .35, 3.0, M.cloth.black, 0, 1.6);
  return g;
}

// ---------- เรือนโจรป่า ----------
// Rough lean-to of dark planks under a sagging thatch, half hidden behind
// cloth: hanging knives, crates, a knife-throwing board and a lookout ladder.
function assassinHall({ w, d }) {
  const g = structure({ w, d });
  for (const x of [-3.9, -1.3, 1.3, 3.9]) { cyl(g, M.darkWood, x, 1.68, -4, .09, .11, 3.36, 6); post(g, x, -4, .15); }
  for (const x of [-3.9, -1.4, 1.4, 3.9]) { cyl(g, M.darkWood, x, 1.12, 2.4, .08, .1, 2.24, 6); post(g, x, 2.4, .14); }
  box(g, M.darkWood, 0, 3.3, -4, 8.2, .14, .14); box(g, M.darkWood, 0, 2.2, 2.4, 8.2, .14, .14);
  for (const x of [-3.9, -1.3, 1.3, 3.9]) beam(g, M.darkWood, [x, 3.38, -4.4], [x, 2.24, 2.9], .05, 4);
  leanTo(g, M.thatchDark, 0, 8.2, -4.5, 3.5, 3.05, 2.15, M.darkWood);
  // Rough plank walls: the back and the camera-side end.
  for (let i = 0; i < 16; i++) {
    const x = -3.75 + i * .5, h = 3.1 + ((i * 7) % 5) * .05;
    box(g, i % 3 ? M.darkWood : M.teak, x, h / 2, -4.12, .48, h, .08);
  }
  for (let i = 0; i < 7; i++) {
    const z = -3.75 + i * .5, h = 2.8 + ((i * 3) % 4) * .06;
    box(g, i % 2 ? M.darkWood : M.teak, -4.02, h / 2, z, .08, h, .48);
  }
  solid(g, 0, -4.12, 8.1, .3); solid(g, -4.02, -2.25, .3, 3.7);
  // Black cloth half rolled on the camera side; indigo curtain on the far side; a ragged valance in front.
  box(g, M.cloth.black, -4.0, 1.75, .8, .02, 1, 2.6); cyl(g, M.cloth.black, -4.0, 2.28, .8, .1, .1, 2.6, 6).rotation.x = Math.PI / 2;
  box(g, M.cloth.indigo, 4.0, 1.6, -.9, .02, 1.6, 6);
  for (let i = 0; i < 12; i++) { const x = -3.85 + i * .7; if (Math.abs(x) < .8) continue; box(g, i % 2 ? M.cloth.indigo : M.cloth.black, x, 1.95 - (i % 3) * .04, 3.0, .62, .32 + (i % 3) * .06, .02); }
  // Knives (มีด) on a bar along the back wall and two crossed short swords.
  box(g, M.darkWood, -2, 1.75, -3.98, 3.2, .06, .06);
  for (let i = 0; i < 8; i++) { const x = -3.4 + i * .4; box(g, M.steel, x, 1.45 - (i % 3) * .04, -3.95, .05, .38 + (i % 2) * .1, .02); box(g, M.darkWood, x, 1.72, -3.94, .045, .14, .045); }
  for (const s of [-1, 1]) beam(g, M.steel, [1.5 - s * .45, 1.1, -3.96], [1.5 + s * .45, 2, -3.96], .025, 4);
  // Crates, a barrel, sacks and rope in the back corner.
  prop(g, 'crate', 2.9, 0, -3.3, { ry: .2 }); prop(g, 'crate', 3.55, 0, -3.25, { ry: -.1 }); prop(g, 'crate', 3.2, .55, -3.3, { s: .85, ry: .5 });
  prop(g, 'barrel', 3.5, 0, -2.3); prop(g, 'sack', 2.7, 0, -2.4, { ry: .8 }); prop(g, 'rope', 2.3, 0, -3.5);
  solid(g, 3.1, -2.95, 1.7, 1.6);
  // Low table with an oil lamp and a map.
  box(g, M.darkWood, -2, .45, -1.4, 1.4, .07, .8);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(g, M.darkWood, -2 + sx * .6, .22, -1.4 + sz * .32, .06, .44, .06);
  box(g, M.cloth.cream, -1.85, .5, -1.4, .55, .01, .4, .3);
  prop(g, 'candle', -2.5, .49, -1.3); glow(g, -2.5, .7, -1.3, .7, '#ffb060', 'candle');
  prop(g, 'stump', -2, 0, -.5, { s: .7 }); prop(g, 'stump', -1.1, 0, -1.4, { s: .7 });
  solid(g, -2, -1.4, 1.5, .9);
  // Knife-throwing board on the outside of the camera-side wall.
  beam(g, M.woodLight, [-4.07, 1.4, -2.2], [-4.17, 1.4, -2.2], .42, 12);
  for (const [dy, dz] of [[.1, -.08], [-.12, .12], [.18, .2]]) { box(g, M.steel, -4.27, 1.4 + dy, -2.2 + dz, .2, .03, .02); box(g, M.darkWood, -4.42, 1.4 + dy, -2.2 + dz, .12, .04, .04); }
  // Lookout platform (หอดู) on stilts at the back corner, with a ladder.
  const tx = -4.5, tz = -3.95, th = 4.4;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) cyl(g, M.darkWood, tx + sx * .4, th / 2 + .25, tz + sz * .4, .06, .07, th + .5, 5);
  box(g, M.darkWood, tx, th, tz, 1.15, .1, 1.15);
  for (const s of [-1, 1]) { box(g, M.darkWood, tx, th + .45, tz + s * .55, 1.1, .06, .06); box(g, M.darkWood, tx + s * .55, th + .45, tz, .06, .06, 1.1); }
  cone(g, M.thatchDark, tx, th + 1.15, tz, .95, .75, 4).rotation.y = Math.PI / 4;
  for (const s of [-1, 1]) beam(g, M.wood, [tx + s * .22, 0, tz + 1.5], [tx + s * .22, th, tz + .55], .03, 4);
  for (let i = 1; i < 11; i++) { const t = i / 11; box(g, M.wood, tx, th * t, tz + 1.5 - .95 * t, .44, .04, .04); }
  hangingLantern(g, tx, th + .55, tz, M.lantern);
  banner(g, tx + .5, tz - .5, th + 1.6, M.cloth.black, M.cloth.red, Math.PI);
  solid(g, tx, tz, .95, .95); post(g, tx, tz + 1.45, .2);
  // One dim lantern at the front.
  hangingLantern(g, 2.2, 1.65, 2.5);
  return g;
}

const BUILDERS = { muaythai: muaythaiHall, warrior: warriorHall, hunter: hunterHall, herbalist: herbalistHall, shaman: shamanHall, assassin: assassinHall };

const trianglesOf = group => {
  let n = 0;
  group.traverse(o => { if (o.isMesh) n += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; });
  return n;
};

// Builds every hall and registers its NPC spots (<id>_master → <id>_door →
// junction). Runs before reserveSpotLinks/fillBuildings; the yards are
// already reserved in the occupancy grid (CityMap PLAZAS), so the city's
// house layout is unchanged. Returns { count, triangles, props }.
export function buildHalls(ctx) {
  let triangles = 0, props = 0;
  for (const h of HALLS) {
    const build = BUILDERS[h.classId];
    if (!build) { console.warn(`[halls] no builder for ${h.classId}`); continue; }
    const g = build(h);
    triangles += trianglesOf(g); props += g.userData.props.length;
    ctx.place(g, h.x, h.z, h.facing, { paint: 'earth', home: false });
  }
  for (const s of hallSpots()) ctx.spot(s.id, s.x, s.z, s.face, s.link);
  return { count: HALLS.length, triangles, props };
}
