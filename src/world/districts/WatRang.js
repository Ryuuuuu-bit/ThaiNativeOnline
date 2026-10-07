import * as THREE from 'three';
import { M, mat, nightGlow } from '../materials.js';
import { box, cyl, ball, beam, cone, mesh, structure, solid, post, wallLine, deck, prop, glow, smoke, chedi, thaiRoof, leanTo } from '../Architecture.js';
import { J } from '../CityMap.js';
import { createRng } from '../rng.js';
import { WAT_RANG } from '../../data/sites.js';

// วัดร้าง: the abandoned temple east of the old cemetery (reserved site WAT_RANG,
// src/data/sites.js). Ayutthaya ruins: a crumbling laterite ordination hall open
// to the sky with a weathered seated Buddha on its dais, a leaning bell-shaped
// chedi with the stucco fallen off its bricks, bone stupas, a half-fallen sala,
// a bodhi tree whose roots grip a broken wall, a low broken boundary wall and a
// ruined gate arch. Quiet and sun-bleached by day; cold ghost lights by night.
//
// Everything draws from its own random sequences (here and veg.isolated), so the
// shared sequence and every later layout (houses, trees) stay as they were. The
// site rectangle is reserved in CityMap PLAZAS (kind 'ruin'), the approach trail
// is the last ROADS entry (cem_e → wat_cw → wat_g).

const S = WAT_RANG, P = S.parts;
const X0 = S.x - S.d / 2, X1 = S.x + S.d / 2, Z0 = S.z - S.w / 2, Z1 = S.z + S.w / 2; // 48 … 104, -572 … -508

// Old paper lanterns that glow a cold blue-green after dusk (Environment drives nightGlow).
const ghostPaper = mat('#c3c6b4', { emissive: '#86e4ff', emissiveIntensity: 0 });
ghostPaper.userData.glow = 1.7; nightGlow.push(ghostPaper);
const GHOST = '#9fe6ff', WISP = '#b6ffd8';

// Bell of the Ayutthaya (Lanka) chedi, and stucco skins that have partly fallen off it.
const BELL = [[0, 0], [1.48, 0], [1.5, .12], [1.36, .2], [1.25, .29], [1.22, .52], [1.13, .77], [.92, 1.15], [.7, 1.49], [.53, 1.62], [.48, 1.72], [.45, 1.82], [0, 1.82]];
const lathe = (pts, seg, a0 = 0, len = Math.PI * 2) => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg, a0, len);
const BELL_CORE = lathe(BELL, 20);
const BELL_SKINS = [
  lathe(BELL.slice(1, 7).map(([x, y]) => [x * 1.03, y]), 8, .3, 1.5),
  lathe(BELL.slice(5, 11).map(([x, y]) => [x * 1.035, y]), 7, 2.4, 1.2),
  lathe(BELL.slice(0, 5).map(([x, y]) => [x * 1.035, y]), 8, 4.3, 1.1),
];
const bellRadius = y => { for (let i = 2; i < BELL.length; i++) if (BELL[i][1] >= y) { const [r0, y0] = BELL[i - 1], [r1, y1] = BELL[i]; return r0 + (r1 - r0) * (y - y0) / (y1 - y0 || 1); } return 0; };
const GARLAND = new THREE.TorusGeometry(.12, .035, 4, 10);

const trianglesOf = group => {
  let n = 0;
  group.traverse(o => { if (o.isMesh) n += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; });
  return n;
};
// Local (structure) → world for a structure placed at (x, z) with yaw rot (as World.place does).
const toWorld = (x, z, rot) => { const c = Math.cos(rot), s = Math.sin(rot); return (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c]; };

function lantern(g, x, y, z) {
  box(g, M.darkWood, x, y + .3, z, .02, .36, .02);
  cyl(g, ghostPaper, x, y, z, .14, .12, .34, 8);
  box(g, M.darkWood, x, y - .19, z, .1, .04, .1);
  glow(g, x, y, z, 1.3, GHOST, 'spirit-night');
}
function bricks(g, rng, x, z, y, n, spread, m = M.brickOld) {
  for (let i = 0; i < n; i++) box(g, rng() > .3 ? m : M.brick, x + rng.range(-spread, spread), y + .06, z + rng.range(-spread, spread), .42, .14, .22, rng() * 6, rng.range(-.3, .3), rng.range(-.3, .3));
}

// Weathered seated Buddha (ปางสมาธิ), intact, under the open sky; scale 1 ≈ 3.6 m.
function seatedBuddha(p, x, y, z, s) {
  const b = new THREE.Group(); b.position.set(x, y, z); b.scale.setScalar(s); p.add(b);
  const skin = M.plasterOld;
  box(b, M.brickOld, 0, .3, 0, 2.6, .6, 1.9);
  box(b, skin, 0, .63, 0, 2.75, .08, 2);
  cyl(b, M.stoneDark, 0, .78, .05, 1.15, .95, .22, 16);
  cyl(b, M.stoneDark, 0, .95, .05, 1.05, 1.18, .14, 16);
  ball(b, skin, 0, 1.2, .12, 1.1, .3, .68);                 // crossed legs
  ball(b, skin, 0, 1.86, -.06, .6, .78, .4);                // torso
  cyl(b, skin, 0, 2.62, -.06, .15, .19, .22, 10);
  ball(b, skin, 0, 2.95, -.04, .33, .4, .35);               // head
  ball(b, skin, 0, 3.27, -.06, .22, .15, .22);              // ushnisha
  cone(b, skin, 0, 3.55, -.06, .08, .42, 8);                // flame (ketumala)
  for (const side of [-1, 1]) {
    box(b, skin, side * .34, 2.88, -.04, .07, .36, .12);    // long ears
    beam(b, skin, [side * .52, 2.3, -.06], [side * .7, 1.56, .1], .15, 8);
    beam(b, skin, [side * .7, 1.56, .1], [side * .16, 1.33, .46], .13, 8);
  }
  ball(b, skin, 0, 1.34, .48, .3, .09, .19);                // hands in the lap
  box(b, M.cloth.saffron, -.2, 1.95, .2, .3, 1.3, .04, 0, -.16, .55); // cloth draped by passers-by
  box(b, M.cloth.saffron, .18, 1.12, .62, 1.3, .05, .3, 0, .1);
  return b;
}

// โบสถ์ร้าง: platform, broken walls and columns, no roof, the Buddha on its dais at the back.
function ruinedHall(rng) {
  const { w: W, d: D } = P.ubosot, hw = W / 2, hd = D / 2, top = .9;
  const g = structure({ w: W + 1, d: D + 1 });
  box(g, M.brickOld, 0, (top - .7) / 2, 0, W + 1, top + .7, D + 1);
  box(g, M.stoneDark, 0, top + .01, 0, W + .7, .06, D + .7);
  for (let i = 0; i < 26; i++) box(g, rng() > .5 ? M.brickOld : M.stone, rng.range(-hw, hw), top + .03, rng.range(-hd, hd), rng.range(.6, 1.4), .05, rng.range(.6, 1.2), rng() * .3);
  // Front stairs and cheek walls (the deck ramp runs over them).
  for (let i = 0; i < 3; i++) { const h = top * (3 - i) / 3; box(g, M.stone, 0, (h - .3) / 2, hd + .8 + i * .6, 4, h + .3, .62); }
  for (const s of [-1, 1]) { box(g, M.brickOld, s * 2.3, .35, hd + 1.4, .5, 1.1, 1.9, 0, -.2); solid(g, s * 2.3, hd + 1.4, .5, 1.9); }
  deck(g, 0, .9, W + 1, D + 2.8, 0, top, [0, 1.8]);
  // Walls: laterite and brick, stucco only in patches, broken at every height.
  const chunk = (x, z, h, along, thick = .8) => {
    const sx = along === 'z' ? thick : 1.1, sz = along === 'z' ? 1.1 : thick;
    box(g, rng() > .3 ? M.brickOld : M.brick, x, top + h / 2, z, sx, h, sz);
    if (rng() < .45) box(g, M.plasterOld, x + (along === 'z' ? Math.sign(x) * .41 : 0), top + h * rng.range(.25, .6), z + (along === 'z' ? 0 : Math.sign(z) * .41), along === 'z' ? .04 : .9, h * rng.range(.25, .5), along === 'z' ? .9 : .04);
    if (h > .5 && rng() < .5) box(g, M.moss, x, top + h + .03, z, sx * .9, .06, sz * .9);
    if (h > 2.6 && rng() < .6) box(g, M.darkBark, x + (along === 'z' ? Math.sign(x) * .41 : 0), top + 1.7, z + (along === 'z' ? 0 : Math.sign(z) * .41), along === 'z' ? .03 : .2, 1, along === 'z' ? .2 : .03); // slit window
    solid(g, x, z, sx, sz);
  };
  for (const side of [-1, 1]) for (let z = -hd + .55; z < hd; z += 1.1) {
    const k = (z + hd) / D, wave = .5 + .5 * Math.sin(k * 7 + side * 1.3) * Math.cos(k * 3.1 + side);
    if (rng() < (side < 0 ? .3 : .18)) { bricks(g, rng, side * (hw - .2), z, top, 3, .6); continue; }
    chunk(side * (hw - .4), z, Math.max(.35, (side < 0 ? .4 : .7) + wave * 3.2 * rng.range(.6, 1.1)), 'z');
  }
  for (let x = -hw + .55; x < hw; x += 1.1) {
    chunk(x, -hd + .4, 2.4 + 2.8 * (1 - Math.abs(x) / hw) * rng.range(.7, 1.05), 'x');          // back wall behind the Buddha
    if (Math.abs(x) < 1.9) continue;                                                         // the door
    if (rng() < .22) { bricks(g, rng, x, hd - .3, top, 3, .5); continue; }
    chunk(x, hd - .4, Math.abs(x) < 3 ? 3.8 : rng.range(.6, 3), 'x');
  }
  // Two rows of octagonal columns: a few still carry their lotus capitals.
  for (const sx of [-1, 1]) for (const z of [-7.6, -3.6, .4, 4.4, 8.4]) {
    const r = rng(), x = sx * 3.3;
    if (r < .15) { bricks(g, rng, x, z, top, 4, .7, M.plasterOld); continue; }
    const h = r > .62 ? 5.2 : rng.range(.9, 3.4);
    cyl(g, M.plasterOld, x, top + h / 2, z, .36, .42, h, 8);
    cyl(g, M.brickOld, x, top + .12, z, .5, .52, .24, 8);
    if (r > .62) { cyl(g, M.plasterOld, x, top + h + .2, z, .55, .36, .42, 8); box(g, M.brickOld, x, top + h + .48, z, .9, .14, .9); }
    else { cyl(g, M.brick, x, top + h + .05, z, .28, .34, .14, 8); bricks(g, rng, x + sx * .9, z, top, 3, .5, M.plasterOld); }
    post(g, x, z, .5);
  }
  // A fallen column by the south wall, drums still in a line.
  for (let i = 0; i < 3; i++) beam(g, M.plasterOld, [hw - 1.6, top + .4, -1 + i * 1.25], [hw - 1.45 + (i % 2) * .15, top + .4, .15 + i * 1.25], .4, 8);
  wallLine(g, hw - 1.55, -1.1, hw - 1.55, 3.9, .45);
  // The roof is gone: a few charred rafters lean against the walls, old tiles in heaps.
  for (const [x1, y1, z1, x2, z2] of [[-hw + .5, 3.4, -5, -hw + 2.6, -4.2], [hw - .5, 3.6, 6.5, hw - 2.4, 7.6], [-hw + .5, 2.8, 6, -hw + 2.2, 4.4], [hw - .5, 3.9, -8.6, hw - 2.6, -9.6]]) {
    beam(g, M.darkWood, [x1, top + y1, z1], [x2, top + .1, z2], .11, 5);
    post(g, x2, z2, .2);
  }
  for (const [x, z] of [[-hw + 1.5, 9.5], [hw - 1.4, -5.2], [-hw + 1.4, -2]]) for (let i = 0; i < 7; i++) box(g, M.tileDark, x + rng.range(-.7, .7), top + .08 + rng() * .12, z + rng.range(-.6, .6), .4, .05, .3, rng() * 6, rng.range(-.4, .4));
  // The dais and the Buddha, facing the door; old offerings at its feet.
  box(g, M.brickOld, 0, top + .5, -8.3, 5.2, 1, 3.4);
  box(g, M.plasterOld, 0, top + 1.03, -8.3, 5.4, .1, 3.6);
  seatedBuddha(g, 0, top + 1.08, -8.6, 1.45);
  solid(g, 0, -8.3, 5.4, 3.6);
  for (let i = 0; i < 5; i++) prop(g, 'candle', -.8 + i * .4, top + 1.08, -6.75);
  for (let i = 0; i < 3; i++) mesh(g, GARLAND, i % 2 ? M.cloth.cream : M.cloth.yellow, -.5 + i * .5, top + 1.12, -6.85, 1, 1, 1, 0, Math.PI / 2);
  prop(g, 'pot', 0, top + 1.08, -7, { s: 1.2 });
  glow(g, 0, top + 1.6, -6.6, 1.8, GHOST, 'spirit-night');
  glow(g, -2.6, top + 2.2, -1, 1, WISP, 'spirit-night'); glow(g, 2.4, top + 1.6, 5, 1, GHOST, 'spirit-night');
  lantern(g, 2.1, top + 3.1, hd - .1);
  return g;
}

// The broken main chedi: square laterite terraces, round tiers and the bell with
// brick showing through, leaning a little; the spire has snapped off.
function mainChedi(rng) {
  const r = P.chedi.r, g = structure({ w: r * 2, d: r * 2 + 2 });
  box(g, M.brickOld, 0, .2, 0, r * 2, 1.4, r * 2);
  box(g, M.stoneDark, 0, .95, 0, r * 2 - .3, .14, r * 2 - .3);
  box(g, M.brickDark, 0, 1.45, 0, r * 2 - 2, .9, r * 2 - 2);
  box(g, M.plasterOld, 0, 1.95, 0, r * 2 - 1.8, .12, r * 2 - 1.8);
  for (let i = 0; i < 24; i++) { const s = rng() > .5 ? 1 : -1, along = rng.range(-r + 1.2, r - 1.2), side = rng() > .5; box(g, rng() > .5 ? M.brick : M.brickOld, side ? s * (r - .98) : along, rng.range(1.1, 1.8), side ? along : s * (r - .98), side ? .06 : rng.range(.5, 1.2), rng.range(.2, .45), side ? rng.range(.5, 1.2) : .06); }
  for (let i = 0; i < 3; i++) box(g, M.stone, 0, .15 + i * .3, r + .9 - i * .45, 2.6, .3 + i * .3 + .3, .5);
  for (let i = 0; i < 18; i++) { const a = rng() * Math.PI * 2, e = rng.range(r - 1.6, r - .2); box(g, M.moss, Math.cos(a) * e, .99, Math.sin(a) * e, rng.range(.6, 1.6), .06, rng.range(.4, 1)); }
  for (let i = 0; i < 14; i++) { const s = rng() > .5 ? 1 : -1, along = rng.range(-r + 1, r - 1); box(g, M.plasterOld, rng() > .5 ? s * (r + .01) : along, rng.range(-.2, .7), rng() > .5 ? along : s * (r + .01), .8, .5, .8); }
  const up = new THREE.Group(); up.position.y = 2; up.rotation.set(-.04, 0, .09); g.add(up);
  [[4.3, .5, M.brickDark], [3.9, .45, M.plasterOld], [3.5, .45, M.brickOld]].forEach(([rad, h, m], i) => cyl(up, m, 0, .25 + i * .47, 0, rad - .12, rad, h, 20));
  const bell = 2.15, tall = bell * 1.55, crown = 1.4 + 1.82 * tall;
  mesh(up, BELL_CORE, M.brickDark, 0, 1.4, 0, bell, tall, bell);
  BELL_SKINS.forEach((skin, i) => mesh(up, skin, M.plasterOld, 0, 1.4, 0, bell, tall, bell, i * .9));
  for (let i = 0; i < 16; i++) { const a = rng() * Math.PI * 2, t = rng.range(.15, .8), rad = bellRadius(t * 1.6) * bell + .04; box(up, rng() > .5 ? M.brick : M.brickOld, Math.cos(a) * rad, 1.4 + t * 1.6 * tall, Math.sin(a) * rad, .5, .22, .5, -a, 0, rng.range(-.2, .2)); }
  box(up, M.brickOld, 0, crown + .32, 0, 1.8, .65, 1.8);
  box(up, M.plasterOld, 0, crown + .7, 0, 2, .12, 2);
  for (let i = 0; i < 7; i++) cyl(up, i % 2 ? M.brickOld : M.plasterOld, 0, crown + .95 + i * .38, 0, .6 - i * .055, .66 - i * .055, .38, 12);
  for (let i = 0; i < 5; i++) box(up, M.brick, rng.range(-.22, .22), crown + 3.6 + rng() * .25, rng.range(-.22, .22), .28, .16, .2, rng() * 3, rng.range(-.3, .3));
  for (let i = 0; i < 7; i++) { const a = rng() * Math.PI * 2; box(up, M.moss, Math.cos(a) * 3, 1.75, Math.sin(a) * 3, .9, .1, .6, -a); }
  solid(g, 0, .6, r * 2, r * 2 + 1.2);
  return g;
}

// Half-fallen sala: the west posts gave way and the roof slid down onto them.
function brokenSala(rng) {
  const { w, d } = P.sala, base = .4, h = 2.7;
  const g = structure({ w: w + .6, d: d + .6 });
  box(g, M.brickDark, 0, (base - .5) / 2, 0, w + .6, base + .5, d + .6);
  box(g, M.brickOld, 0, base + .01, 0, w + .4, .05, d + .4);
  deck(g, 0, 0, w + .6, d + .6, 0, base, [.8, .8]);
  for (const x of [-w / 2, -w / 6, w / 6, w / 2]) for (const z of [-d / 2, d / 2]) {
    if (x < -w / 3) { cyl(g, M.darkWood, x, base + .3, z, .13, .14, .6, 6); box(g, M.darkWood, x, base + .62, z, .2, .06, .2, rng(), .4); post(g, x, z, .25); continue; }
    if (x < 0) { beam(g, M.darkWood, [x, base, z], [x - .35, base + 2.05, z + Math.sign(z) * .15], .12, 6); post(g, x, z, .2); continue; } // leaning under the weight
    cyl(g, M.darkWood, x, base + h / 2, z, .12, .14, h, 6); post(g, x, z, .2);
  }
  // The broken west posts lie where they fell.
  beam(g, M.darkWood, [-w / 2 - .5, .1, -d / 2 + .5], [-w / 2 + 2.1, .15, -d / 2 - .5], .12, 6);
  beam(g, M.darkWood, [-w / 2 - 1.6, .1, d / 2 + .2], [-w / 2 + .4, .12, d / 2 - 1.2], .12, 6);
  // The roof broke its back: the east half still sits on its posts, the west half
  // hinges down from the break and its eave rests on the ground.
  const roof = (x0, x1, pivot, rz) => {
    const t = new THREE.Group(); t.position.set(pivot, base + h, 0); t.rotation.set(rz * .12, 0, rz); g.add(t);
    const len = x1 - x0, cx = (x0 + x1) / 2 - pivot;
    for (const z of [-d / 2, d / 2]) box(t, M.darkWood, cx, 0, z, len, .16, .14);
    thaiRoof(t, { width: d + 1.4, depth: len, height: 1.9, y: .05, x: cx, ry: Math.PI / 2, material: M.tileDark, style: 'temple', trim: M.darkWood, gable: false });
    return t;
  };
  roof(-.2, w / 2 + .6, w / 6, .05);
  const fallen = roof(-w / 2 - .6, -.2, -.2, .5);
  for (let i = 0; i < 4; i++) beam(fallen, M.darkWood, [-.6 - i * .9, 1.9, 0], [-.9 - i * .9, .3, d / 2 + .6], .05, 4); // bare rafters where tiles slid off
  wallLine(g, -w / 2 - .5, -d / 2 - .7, -w / 2 - .5, d / 2 + .7, .5);
  for (let i = 0; i < 14; i++) box(g, M.tileDark, -w / 2 - rng.range(.6, 2.2), .06, rng.range(-d / 2 - .5, d / 2 + .5), .4, .05, .3, rng() * 6, rng.range(-.4, .4));
  lantern(g, w / 2 - .2, base + h - .5, d / 2 + .25);
  prop(g, 'bench', 1.4, base, -.6, { ry: .1 });
  return g;
}

function gateArch(rng) {
  // Two brick pillars of the west gate; the corbelled arch has fallen.
  const g = structure(null), gap = 2.7;
  for (const s of [-1, 1]) {
    const h = s < 0 ? 4.2 : 3;
    box(g, M.brickOld, 0, h / 2 - .2, s * gap, 1.4, h + .4, 1.4);
    box(g, M.plasterOld, .71, h * .45, s * gap, .04, h * .5, 1);
    box(g, M.moss, 0, h + .03, s * gap, 1.2, .08, 1.2);
    solid(g, 0, s * gap, 1.4, 1.4);
  }
  for (let i = 0; i < 4; i++) box(g, M.brickOld, 0, 3.1 + i * .27, -gap + .85 + i * .3, 1.2, .27, .3 + i * .6);
  for (let i = 0; i < 2; i++) box(g, M.brickOld, 0, 2.45 + i * .27, gap - .85 - i * .3, 1.2, .27, .3 + i * .6);
  box(g, M.stone, 0, .02, 0, 1.6, .12, gap * 2 - 1.4);
  lantern(g, -.1, 2.6, -gap + 1.6);
  glow(g, -1.2, 1.4, gap + 1.2, .9, WISP, 'spirit-night');
  return g;
}

// Small weathered spirit house (ศาลพระภูมิ) left behind.
function oldSpiritHouse(g, x, y, z, ry) {
  const s = new THREE.Group(); s.position.set(x, y, z); s.rotation.y = ry; g.add(s);
  cyl(s, M.plasterOld, 0, .7, 0, .1, .13, 1.4, 6);
  box(s, M.darkWood, 0, 1.43, 0, .95, .08, .85);
  box(s, M.plasterOld, 0, 1.73, 0, .6, .52, .5);
  box(s, M.darkBark, 0, 1.7, .26, .2, .3, .02);
  thaiRoof(s, { width: .95, depth: .85, height: .65, y: 2, material: M.tileDark, style: 'temple', trim: M.darkWood, gable: M.plasterOld, trimR: .02, pattern: false });
  mesh(s, GARLAND, M.cloth.cream, .22, 1.5, .34, 1, 1, 1, 0, Math.PI / 2);
  const [cx, cz] = toWorld(x, z, ry)(-.2, .32);
  prop(g, 'candle', cx, y + 1.47, cz);
}

export function buildWatRang(ctx) {
  const { terrain, veg } = ctx, h = (x, z) => terrain.height(x, z);
  const rng = createRng(54021), stats = { triangles: 0, props: 0, glows: 0 };
  const place = (g, x, z, rot = 0, opts = {}) => { stats.triangles += trianglesOf(g); stats.props += g.userData.props.length; stats.glows += g.userData.glows.length; return ctx.place(g, x, z, rot, { home: false, ...opts }); };
  const facing = S.facing;
  const site = structure(null); // world-space pieces

  // ---- Ordination hall (boss arena) and its boundary stones ----
  const U = P.ubosot, toU = toWorld(U.x, U.z, U.facing);
  place(ruinedHall(rng), U.x, U.z, U.facing, { y: h(U.x, U.z), paint: 'stone' });
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [-1, 0], [1, 0], [0, -1]]) {
    const [x, z] = toU(sx * (U.w / 2 + 2.4), sz * (U.d / 2 + 1.8)), y = h(x, z), lean = rng.range(-.22, .22);
    box(site, M.brickOld, x, y + .12, z, .95, .45, .95, rng() * .3);
    const st = new THREE.Group(); st.position.set(x, y + .32, z); st.rotation.set(rng.range(-.15, .15), Math.atan2(sx, sz) + U.facing, lean); site.add(st);
    box(st, M.sandstone, 0, .42, 0, .6, .84, .15);
    cone(st, M.sandstone, 0, 1.03, 0, .3, .4, 4).scale.z = .07;
    box(st, M.moss, 0, .1, 0, .64, .2, .17);
    post(site, x, z, .55);
  }

  // ---- Main chedi, leaning, with creepers ----
  const C = P.chedi, cy = h(C.x, C.z);
  place(mainChedi(rng), C.x, C.z, facing, { y: cy, paint: 'stone' });
  veg.isolated(54022, v => {
    for (let i = 0; i < 9; i++) { const a = rng() * Math.PI * 2, rr = rng.range(4, 4.6); v.bush(C.x + Math.cos(a) * rr, cy + 1.9, C.z + Math.sin(a) * rr, { s: rng.range(.7, 1.1), dark: .35 }); }
    for (let i = 0; i < 14; i++) { const a = rng() * Math.PI * 2, rr = rng.range(5.2, 5.7); v.fern(C.x + Math.cos(a) * rr, cy + .9, C.z + Math.sin(a) * rr, { s: rng.range(.7, 1.1), dark: .3 }); }
    for (let i = 0; i < 6; i++) { const a = rng() * Math.PI * 2; v.bush(C.x + Math.cos(a) * 6.5, cy, C.z + Math.sin(a) * 6.5, { s: rng.range(.8, 1.2), dark: .3 }); }
  });

  // ---- Bone stupas (the rare spot lies among them) ----
  const stupas = [[58, -561, 1], [73.5, -565.5, .5], [P.stupas[2].x, P.stupas[2].z, 1]];
  stupas.forEach(([x, z, broken], i) => {
    const g = structure(null), s = [.6, .52, .56][i];
    chedi(g, { scale: s, body: M.plasterOld, base: M.brickOld, spire: M.stoneDark, low: true, broken }).rotation.set(rng.range(-.06, .06), rng() * 3, rng.range(-.08, .08));
    for (let k = 0; k < 4; k++) box(g, M.moss, rng.range(-1, 1), .25, rng.range(-1, 1), .7, .06, .5);
    for (let k = 0; k < 3; k++) prop(g, 'urn', Math.cos(k * 2.1 + i) * 2, 0, Math.sin(k * 2.1 + i) * 2, { s: .55, rz: k === 1 ? 1.45 : rng.range(-.1, .1), ry: rng() * 6, color: '#8a877a' });
    prop(g, 'flower', 1.4, 0, 1.2, { color: '#c9b9a0' }); prop(g, 'flower', 1.6, 0, 1, { color: '#d8c38a' });
    glow(g, 0, 3.4, 0, 1.1, i % 2 ? WISP : GHOST, 'spirit-night');
    post(g, 0, 0, s * 2.6);
    for (let k = 0; k < 3; k++) post(g, Math.cos(k * 2.1 + i) * 2, Math.sin(k * 2.1 + i) * 2, .4);
    place(g, x, z, 0, { y: h(x, z) });
  });

  // ---- Half-fallen sala, turned toward the courtyard ----
  place(brokenSala(rng), P.sala.x, P.sala.z, Math.PI, { y: h(P.sala.x, P.sala.z) });

  // ---- Bodhi tree growing out of a broken wall (north-east, behind the hall) ----
  // The trunk rises from the wall top; roots run along it and pour down both faces.
  const T = { x: 94, z: -564 }, ty = h(T.x, T.z), wtop = 2.2;
  veg.isolated(54023, v => v.giant(T.x, ty, T.z, { s: 1.1, dark: .35 }));
  for (let x = 89.6; x < 98.6; x += .95) {
    if (Math.abs(x - T.x) < .8) continue;
    const hh = wtop - .5 + .7 * Math.cos((x - T.x) * .35) * rng.range(.75, 1), y = h(x, T.z);
    box(site, rng() > .25 ? M.brickOld : M.brick, x, y + hh / 2 - .2, T.z, .93, hh + .4, 1, rng.range(-.04, .04));
    if (rng() < .5) box(site, M.moss, x, y + hh + .02, T.z, .8, .06, .9);
  }
  wallLine(site, 89.2, T.z, 98.8, T.z, .65);
  for (let i = 0; i < 12; i++) {
    const side = i % 2 ? 1 : -1, dir = i % 4 < 2 ? 1 : -1, reach = rng.range(.9, 4), r = rng.range(.11, .19);
    const x0 = T.x + dir * .45, x1 = T.x + dir * reach, x2 = x1 + dir * rng.range(-.2, .5), x3 = x2 + dir * rng.range(.1, .8);
    const y0 = ty + wtop + .7, y1 = h(x1, T.z) + wtop - .05 - (reach - .9) * .12, gy = h(x3, T.z + side * 2);
    beam(site, M.darkBark, [x0, y0, T.z + side * .25], [x1, y1 + .12, T.z + side * .32], r, 5);
    beam(site, M.darkBark, [x1, y1 + .12, T.z + side * .32], [x2, y1 - .25, T.z + side * .6], r * .9, 5);
    beam(site, M.darkBark, [x2, y1 - .25, T.z + side * .6], [x3, gy + .5, T.z + side * .62], r * .85, 5);
    beam(site, M.darkBark, [x3, gy + .5, T.z + side * .62], [x3 + rng.range(-.6, .6), gy - .05, T.z + side * rng.range(1.4, 2.4)], r * .75, 5);
  }
  for (const side of [-1, 1]) for (let k = 0; k < 3; k++) beam(site, M.darkBark, [T.x + (k - 1) * .45, ty + wtop + .4, T.z + side * .5], [T.x + (k - 1) * .7, ty - .05, T.z + side * (1.4 + k * .3)], .22, 5);
  cyl(site, M.cloth.saffron, T.x, ty + wtop + 1.1, T.z, .84, .86, .26, 14);
  cyl(site, M.cloth.white, T.x, ty + wtop + 1.42, T.z, .8, .82, .1, 14);
  for (let i = 0; i < 5; i++) { const a = .9 + i * .45; box(site, i % 2 ? M.cloth.saffron : M.cloth.yellow, T.x + Math.cos(a) * .9, ty + wtop + .7, T.z + Math.sin(a) * .9, .14, .75, .02, -a, 0, rng.range(-.2, .2)); }
  lantern(site, T.x - 2.4, ty + 4, T.z + 1.9);
  // Offering shelf with old garlands, a spirit house beside it.
  const sx = 91, sz = -560.6, sy = h(sx, sz);
  box(site, M.darkWood, sx, sy + .62, sz, 1.5, .07, .6, .1);
  for (const [dx, dz] of [[-.6, -.2], [.6, .2], [-.6, .2], [.6, -.2]]) box(site, M.darkWood, sx + dx, sy + .3, sz + dz, .07, .6, .07, .1);
  for (let i = 0; i < 4; i++) mesh(site, GARLAND, [M.cloth.cream, M.cloth.yellow, M.cloth.white, M.cloth.cream][i], sx - .5 + i * .33, sy + .69, sz + .12 - i * .1, 1, 1, 1, 0, Math.PI / 2);
  for (let i = 0; i < 3; i++) prop(site, 'candle', sx - .3 + i * .3, sy + .66, sz - .1);
  prop(site, 'pot', sx + .5, sy + .66, sz - .2);
  solid(site, sx, sz, 1.6, .7, .1);
  oldSpiritHouse(site, 97.6, h(97.6, -561.4), -561.4, 0); post(site, 97.6, -561.4, .35);
  glow(site, T.x - 1.2, ty + 2, T.z + 2.2, 1, WISP, 'spirit-night');

  // ---- Boundary wall (กำแพงแก้ว), low and broken, with the ruined west gate ----
  const i0 = P.wall.inset, wx0 = X0 + i0, wx1 = X1 - i0, wz0 = Z0 + i0, wz1 = Z1 - i0, gate = S.gate.z, gap = 3.4;
  const runs = [[wx0, wz1, wx0, gate + gap], [wx0, gate - gap, wx0, wz0], [wx0, wz0, wx1, wz0], [wx1, wz0, wx1, wz1], [wx1, wz1, wx0, wz1]];
  runs.forEach(([x1, z1, x2, z2], ri) => {
    const len = Math.hypot(x2 - x1, z2 - z1), n = Math.max(1, Math.round(len / 1.2)), ry = Math.atan2(x2 - x1, z2 - z1);
    let start = null, last = null;
    const close = () => { if (start) wallLine(site, start[0], start[1], last[0], last[1], .5); start = null; };
    for (let k = 0; k < n; k++) {
      const t0 = k / n, t1 = (k + 1) / n, t = (k + .5) / n, x = x1 + (x2 - x1) * t, z = z1 + (z2 - z1) * t, y = h(x, z);
      const wave = .5 + .5 * Math.sin(k * .55 + ri * 2) * Math.cos(k * .21 + ri);
      if (rng() < .12 + (1 - wave) * .12) { close(); bricks(site, rng, x, z, y, 3, .7); continue; }
      const hh = .3 + 1.1 * wave * rng.range(.6, 1.1);
      box(site, rng() > .25 ? M.brickOld : M.brick, x, y + hh / 2 - .15, z, .7, hh + .3, len / n + .02, ry);
      if (hh > .8 && rng() < .6) box(site, M.plasterOld, x, y + hh + .05, z, .82, .14, len / n * .9, ry);
      else if (rng() < .4) box(site, M.moss, x, y + hh - .1, z, .74, .06, len / n * .8, ry);
      if (!start) start = [x1 + (x2 - x1) * t0, z1 + (z2 - z1) * t0];
      last = [x1 + (x2 - x1) * t1, z1 + (z2 - z1) * t1];
    }
    close();
  });
  place(gateArch(rng), wx0, gate, 0, { y: h(wx0, gate) });
  bricks(site, rng, wx0 - 1.6, gate - 5, h(wx0 - 1.6, gate - 5), 14, 1.1);
  bricks(site, rng, wx0 + 1.2, gate + 4.6, h(wx0 + 1.2, gate + 4.6), 8, .9);

  // ---- Broken paving: causeway gate → chedi → hall, and a ring round the chedi ----
  const slab = (x, z, rot = 0) => {
    if (rng() < .27) return;
    box(site, rng.pick([M.brickOld, M.stone, M.sandstone, M.brickOld]), x + rng.range(-.06, .06), h(x, z) - .02, z + rng.range(-.06, .06), .86, .12, .86, rot + rng.range(-.08, .08), rng.range(-.03, .03));
  };
  for (let x = wx0 + 1; x < C.x - C.r - .4; x += .92) for (let z = -1.5; z <= 1.5; z += .92) slab(x, gate + z);
  for (let x = C.x + C.r + 2.2; x < U.x - U.d / 2 - 2.4; x += .92) for (let z = -1.5; z <= 1.5; z += .92) slab(x, gate + z);
  for (let a = -C.r - 3; a <= C.r + 3; a += .92) for (const o of [C.r + 1.6, C.r + 2.5]) {
    slab(C.x + a, C.z - o); slab(C.x + a, C.z + o);
    if (Math.abs(a) < C.r + 1.2) { slab(C.x - o, C.z + a); slab(C.x + o + .4, C.z + a); }
  }

  // ---- Yard debris: fallen bricks, overturned urns and jars ----
  for (let i = 0; i < 26; i++) {
    const x = rng.range(X0 + 3, X1 - 4), z = rng.range(Z0 + 3, Z1 - 3);
    if (Math.abs(z - gate) < 2.5 || Math.hypot(x - C.x, z - C.z) < C.r + 3.5 || (Math.abs(x - U.x) < U.d / 2 + 3 && Math.abs(z - U.z) < U.w / 2 + 3)) continue;
    bricks(site, rng, x, z, h(x, z), rng.int(3, 7), .8);
  }
  for (const [x, z, tipped] of [[54, -531, 1], [54, -554.5, 0], [76, -556, 1], [79.5, -526, 0], [69, -514, 1], [100, -527, 1], [52.5, -560, 0], [83, -566, 1]]) {
    prop(site, rng() > .4 ? 'urn' : 'bigJar', x, h(x, z) + (tipped ? .28 : 0), z, { s: rng.range(.75, 1), rz: tipped ? 1.45 : rng.range(-.08, .08), ry: rng() * 6, color: rng.pick(['#8f8d80', '#7c7a6e', '#9a968a']) });
    post(site, x, z, .55);
  }
  // A few more spirit houses: outside the gate and among the stupas.
  oldSpiritHouse(site, 46.8, h(46.8, -546), -546, -Math.PI / 2); post(site, 46.8, -546, .35);
  glow(site, 46.8, h(46.8, -546) + 1.7, -545.6, .8, GHOST, 'spirit-night');
  oldSpiritHouse(site, 54.5, h(54.5, -567), -567, Math.PI * .8); post(site, 54.5, -567, .35);
  // Wisps along the causeway after dark.
  for (const [x, z] of [[53.5, -538.5], [72, -542], [62, -531], [66, -551]]) glow(site, x, h(x, z) + 1.2, z, .8, WISP, 'spirit-night');

  // ---- The hunters' camp between the cemetery and the gate ----
  const fx = 38.3, fz = -551.6, fy = h(fx, fz);
  for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; prop(site, 'rock', fx + Math.cos(a) * .75, fy + .08, fz + Math.sin(a) * .75, { s: .3, sy: .2, ry: a, color: '#6f7266' }); }
  box(site, M.ember, fx, fy + .05, fz, .6, .06, .5, .5); box(site, M.darkBark, fx, fy + .16, fz, 1.1, .12, .14, .4); box(site, M.darkBark, fx, fy + .16, fz, 1.1, .12, .14, -.6);
  for (const s of [-1, 1]) beam(site, M.darkWood, [fx + s * .7, fy, fz + .35 * s], [fx, fy + 1.3, fz], .04, 4);
  beam(site, M.darkWood, [fx, fy, fz - .8], [fx, fy + 1.3, fz], .04, 4);
  prop(site, 'pot', fx, fy + .45, fz, { s: 1.3 });
  glow(site, fx, fy + .3, fz, .9, '#ff9a4a', 'fire');
  smoke(site, fx, fy + .4, fz, { rate: .6, size: .8, color: '#8f8c84' });
  prop(site, 'log', fx - .4, h(fx - .4, fz - 1.9), fz - 1.9, { ry: .2, s: .6 }); prop(site, 'log', fx + 1.9, h(fx + 1.9, fz + .2), fz + .2, { ry: 1.7, s: .55 });
  post(site, fx, fz, .85); post(site, fx - .4, fz - 1.9, .45); post(site, fx + 1.9, fz + .2, .45);
  const camp = structure(null), lx = 35.6, lz = -554.2, ly = h(lx, lz);
  for (const s of [-1, 1]) cyl(camp, M.darkWood, s * 1.2, 1.05, 1, .06, .07, 2.1, 5);
  box(camp, M.darkWood, 0, 2.05, 1, 2.6, .08, .08);
  leanTo(camp, M.thatchDark, 0, 2.8, 1, 2.05, -1.2, .1);
  box(camp, M.cloth.indigo, .2, .06, -.1, 1.8, .08, .8, .1);                 // bedroll
  box(camp, M.cloth.red, -1.15, 1.2, 1.05, .04, .9, .5);                   // a cloth hung to dry
  prop(camp, 'basket', .9, 0, .3); prop(camp, 'sack', -.6, 0, -.3, { ry: .5 }); prop(camp, 'trap', 1.6, 0, -.6, { ry: 1 });
  solid(camp, 0, -.1, 2.7, 2.2);
  place(camp, lx, lz, .5, { y: ly });

  // ---- Breach in the cemetery wall where the trail goes through ----
  const [bx, bz] = J.wat_cw;
  for (const s of [-1, 1]) bricks(site, rng, bx + rng.range(-.6, .6), bz + s * 2.4, h(bx, bz + s * 2.4), 7, .7);

  // ---- Overgrowth: trees in the corners, ferns and bushes along the walls ----
  veg.isolated(54024, v => {
    for (const [x, z, kind, s] of [[53, -567, 'broadleaf', 1.1], [100.5, -512.5, 'broadleaf', 1.2], [53.5, -512.5, 'broadleaf', 1], [51.5, -527, 'dead', 1], [86, -514, 'broadleaf', .9]]) {
      if (kind === 'dead') v.deadTree(x, h(x, z), z, { s }); else v.broadleaf(x, h(x, z), z, { s, dark: .55, cards: 30 });
    }
    for (const [x1, z1, x2, z2] of runs) {
      const len = Math.hypot(x2 - x1, z2 - z1);
      for (let d = 0; d < len; d += rng.range(1.4, 3.2)) {
        const t = d / len, ox = rng.range(-1.4, 1.4), x = x1 + (x2 - x1) * t + (z2 === z1 ? 0 : ox), z = z1 + (z2 - z1) * t + (z2 === z1 ? ox : 0);
        if (Math.abs(z - gate) < 5 && x < wx0 + 3) continue;
        if (rng() < .5) v.fern(x, h(x, z), z, { s: rng.range(.8, 1.4), dark: .5 }); else v.bush(x, h(x, z), z, { s: rng.range(.8, 1.4), dark: .4 });
      }
    }
    for (let i = 0; i < 16; i++) { const [x, z] = toU((rng() > .5 ? 1 : -1) * (U.w / 2 + rng.range(.9, 1.6)), rng.range(-U.d / 2 + 1, U.d / 2 - 1)); (rng() < .5 ? v.fern : v.bush).call(v, x, h(x, z), z, { s: rng.range(.8, 1.3), dark: .45 }); }
  });

  place(site, 0, 0);

  // ---- Spots: the five from sites.js plus the walk between them ----
  // boss → door → court_n → yard_npc → court_w → gate → wat_g; rare → court_s → court_w;
  // gate_npc, camp → wat_g. Links go round the chedi, never through it.
  const id = k => `${S.id}_${k}`, sp = S.spots;
  ctx.spot(id('gate'), S.gate.x, S.gate.z, facing, 'wat_g');
  ctx.spot(id('court_w'), 52.5, S.z, facing + Math.PI, id('gate'));
  ctx.spot(id('court_s'), 56, -551, facing + Math.PI, id('court_w'));
  ctx.spot(id('court_n'), 72, -528.5, Math.PI, id('yard_npc'));
  ctx.spot(id('door'), 73.5, S.z, facing + Math.PI, id('court_n'));
  ctx.spot(id('boss'), sp.boss.x, sp.boss.z, sp.boss.face, id('door'));
  ctx.spot(id('rare'), sp.rare.x, sp.rare.z, sp.rare.face, id('court_s'));
  ctx.spot(id('gate_npc'), sp.gate_npc.x, sp.gate_npc.z, sp.gate_npc.face, 'wat_g');
  ctx.spot(id('yard_npc'), sp.yard_npc.x, sp.yard_npc.z, sp.yard_npc.face, id('court_w'));
  ctx.spot(id('camp'), sp.camp.x, sp.camp.z, sp.camp.face, 'wat_g');
  return { triangles: Math.round(stats.triangles), props: stats.props, glows: stats.glows };
}
