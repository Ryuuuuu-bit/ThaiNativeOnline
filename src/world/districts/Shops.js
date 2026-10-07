import * as THREE from 'three';
import { M } from '../materials.js';
import {
  box, cyl, cone, ball, beam, structure, solid, post, deck, prop, glow, smoke, anchor,
  thaiRoof, tieredRoof, shophouseRow, hangingLantern,
} from '../Architecture.js';
import { landmark } from '../../data/landmarks.js';
import { timberWalls, porchFrame, shopCanopy, herbPlaque } from './ShopDetails.js';

// Shops that NPC services will attach to later. Each building exposes anchors
// for its keeper (work spot) and a customer spot in front.

export function forge() {
  const g = structure({ w: 10.5, d: 8.5 });
  for (const x of [-4.2, 0, 4.2]) for (const z of [-3.2, 3.2]) { cyl(g, M.darkWood, x, 1.6, z, .12, .14, 3.2, 6); post(g, x, z, .2); }
  thaiRoof(g, { width: 8.2, depth: 10.2, height: 3.4, y: 3.1, ry: Math.PI / 2, material: M.tileDark, gable: M.wood });
  porchFrame(g, 4.2, 3.2, 3.1);
  for (const s of [-1, 1]) {
    box(g, M.darkWood, s * 4.2, 2.95, 0, .18, .22, 6.5);
    beam(g, M.wood, [s * 4.2, 2.2, -3.2], [s * 3.45, 2.95, -3.2], .07, 4);
  }
  for (let i = 0; i < 7; i++) box(g, i % 2 ? M.brickDark : M.brickOld, -3.8 + i * 1.25, .28, -3.18, 1.15, .23, .08);
  // Brick hearth apron and a recessed iron arch around the furnace mouth.
  box(g, M.brickOld, -2.6, .045, -1.1, 2.5, .09, 1.4);
  for (const s of [-1, 1]) box(g, M.brickDark, -2.6 + s * .55, .75, -1.28, .22, .8, .15);
  box(g, M.brickDark, -2.6, 1.18, -1.28, 1.3, .18, .15);
  box(g, M.darkWood, 2.5, 2.65, 3.32, 1.65, .65, .12);
  box(g, M.iron, 2.5, 2.72, 3.4, .64, .16, .04); box(g, M.woodPale, 2.5, 2.47, 3.4, .12, .4, .04);
  box(g, M.brick, 0, .7, -3.35, 9, 1.4, .3);
  // Furnace, chimney, bellows.
  box(g, M.brick, -2.6, .8, -2.2, 2.2, 1.6, 1.7);
  box(g, M.ember, -2.6, .75, -1.33, .8, .5, .05);
  box(g, M.brickDark, -2.6, 3.4, -2.6, .9, 3.6, .9); box(g, M.brickDark, -2.6, 5.3, -2.6, .7, .4, .7);
  box(g, mLeather, -1, .7, -2.2, .9, .35, .7); beam(g, M.wood, [-1, .9, -2.2], [-.3, 1.3, -2.2], .04);
  prop(g, 'anvil', .2, 0, -.4, { ry: .2 });
  prop(g, 'barrel', 1.6, 0, -1.2); prop(g, 'coal', -3.7, 0, -.6); prop(g, 'coal', -3.3, .2, -.2, { s: .6 });
  // Weapon rack along the right side.
  box(g, M.darkWood, 3.7, 1.3, -.2, .1, .1, 3); box(g, M.darkWood, 3.7, .45, -.2, .1, .1, 3);
  for (let i = 0; i < 7; i++) { box(g, M.steel, 3.65, 1.05, -1.4 + i * .4, .02, 1.1, .07); box(g, M.darkWood, 3.65, .4, -1.4 + i * .4, .05, .25, .1); }
  box(g, M.woodLight, 1.8, .8, 1.6, 1.6, .08, .7); for (const s of [-1, 1]) box(g, M.darkWood, 1.8 + s * .7, .4, 1.6, .06, .8, .5);
  box(g, M.iron, 1.6, .9, 1.6, .5, .08, .1); box(g, M.steel, 2.1, .87, 1.5, .08, .05, .7);
  glow(g, -2.6, .8, -1.2, 1.8, '#ff8a3a', 'fire'); smoke(g, -2.6, 5.7, -2.6, { rate: 2, size: 1.6, color: '#8c8b86' });
  solid(g, -2.6, -2.2, 2.4, 1.9); solid(g, 0, -3.35, 9, .4); solid(g, 3.7, -.2, .5, 3.1); solid(g, 1.8, 1.6, 1.7, .8);
  post(g, .2, -.4, .45); post(g, 1.6, -1.2, .35);
  anchor(g, 'smith', .2, -1.25, 0); anchor(g, 'aisle', -1.1, .5, 0); anchor(g, 'customer', -1.6, 4.4, Math.PI);
  return g;
}
const mLeather = new THREE.MeshStandardMaterial({ color: '#5a3f2a', roughness: .8 });

function enhanceForge() {
  const g = structure({ w: 11, d: 10 });
  box(g, M.brick, 0, .25, 0, 9.6, .5, 8.6); box(g, M.sandstone, 0, .52, 0, 9.8, .06, 8.8);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    cyl(g, M.woodRed, sx * 3.8, 2.3, sz * 3.2, .2, .22, 3.6, 10); cyl(g, M.gold, sx * 3.8, 3.95, sz * 3.2, .3, .24, .3, 10); cyl(g, M.gold, sx * 3.8, .7, sz * 3.2, .26, .3, .3, 10);
    post(g, sx * 3.8, sz * 3.2, .3);
  }
  tieredRoof(g, { width: 9.6, depth: 9, y: 4.1, tiers: 2, material: M.tileGreen, edge: M.tileOrange, trim: M.goldBright });
  // Sacred crucible with a spirit-blue flame.
  cyl(g, M.stone, 0, 1.2, -.8, 1.2, 1.45, 1.4, 16); cyl(g, M.goldBright, 0, 1.95, -.8, 1.32, 1.32, .14, 20);
  cyl(g, M.iron, 0, 1.9, -.8, 1.05, 1.05, .1, 16);
  cone(g, M.spiritFlame, 0, 2.55, -.8, .62, 1.3, 10); cone(g, M.spiritFlame, .3, 2.3, -.6, .3, .7, 8);
  // Sacred white threads (สายสิญจน์) from each pillar to the crucible.
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) beam(g, M.cloth.white, [sx * 3.8, 3.4, sz * 3.2], [0, 2.1, -.8], .012, 3);
  for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; prop(g, 'ore', Math.cos(a) * 1.9, .7, -.8 + Math.sin(a) * 1.6, { s: .6 + (i % 3) * .25, ry: a }); }
  prop(g, 'anvil', 2, .55, .9, { ry: -.3 }); prop(g, 'crate', -2.9, .55, 1.6); prop(g, 'crate', -2.9, 1.1, 1.6, { s: .8, ry: .5 });
  // Display of enhanced blades with gold hilts.
  box(g, M.darkWood, -3, 1.9, -2.6, 2.4, .1, .1);
  for (let i = 0; i < 5; i++) { box(g, M.steel, -4 + i * .5, 1.35, -2.55, .05, 1.1, .08); box(g, M.goldBright, -4 + i * .5, .72, -2.55, .18, .18, .12); }
  for (const s of [-1, 1]) {
    cyl(g, M.darkWood, s * 5.4, 3.2, 4.4, .06, .07, 6.4, 5);
    box(g, s > 0 ? M.cloth.red : M.cloth.yellow, s * 5.4 + s * .45, 4.2, 4.4, .02, 3.2, .7);
  }
  glow(g, 0, 2.6, -.8, 4, '#7fe8ff', 'spirit'); smoke(g, 0, 3.4, -.8, { rate: 1.2, size: 1.2, color: '#9fc6d4' });
  post(g, 0, -.8, 1.6); solid(g, -3, -2.6, 2.6, .5); solid(g, -2.9, 1.6, .8, .8); post(g, 2, .9, .4);
  deck(g, 0, 0, 9.6, 8.6, 0, .5, [1, 1]);
  anchor(g, 'master', 2, 2.1, Math.PI * .85); anchor(g, 'customer', 0, 5.6, Math.PI);
  return g;
}

export function herbShop() {
  const g = structure({ w: 8, d: 9 });
  box(g, M.woodLight, 0, .2, 0, 7.2, .4, 5.4);
  timberWalls(g, 7, 5.2, .2, 2.8);
  porchFrame(g, 3.4, 2.6, 2.95, .4);
  for (const s of [-1, 1]) cyl(g, M.darkWood, s * 3.4, 1.5, 2.6, .1, .1, 2.6, 6);
  thaiRoof(g, { width: 6.8, depth: 8.2, height: 3, y: 2.95, ry: Math.PI / 2, material: M.tile, gable: M.woodLight });
  shopCanopy(g, 7.8, 3.1, 2.8, M.tileGreen);
  herbPlaque(g);
  for (let i = 0; i < 12; i++) box(g, M.darkWood, 0, .407, -2.45 + i * .44, 6.9, .014, .018);
  // Shelves of medicine jars.
  for (let level = 0; level < 3; level++) {
    box(g, M.darkWood, 0, .9 + level * .7, -2.3, 6.2, .06, .5);
    for (let i = 0; i < 9; i++) prop(g, 'pot', -2.8 + i * .7, .93 + level * .7, -2.3, { s: .55 + ((i + level) % 3) * .1 });
  }
  box(g, M.woodLight, 0, .75, .6, 2.4, .08, 1); for (const s of [-1, 1]) box(g, M.darkWood, s * 1.1, .55, .6, .06, .4, .8);
  prop(g, 'mortar', -.6, .79, .6); beam(g, M.wood, [-.6, .95, .6], [-.4, 1.25, .45], .03, 5);
  for (let i = 0; i < 3; i++) prop(g, 'fruitBasket', .3 + i * .5, .79, .6, { s: .7, color: ['#8a6a3a', '#6e7a3c', '#a0794a'][i] });
  // Drying racks with hanging bundles in the front yard.
  for (const s of [-1, 1]) {
    for (const lx of [-1, 1]) cyl(g, M.darkWood, s * 2.4 + lx * 1.1, 1, 3.8, .04, .05, 2, 5);
    box(g, M.darkWood, s * 2.4, 1.95, 3.8, 2.4, .05, .05);
    for (let i = 0; i < 6; i++) box(g, i % 2 ? M.moss : M.hay, s * 2.4 - 1 + i * .4, 1.65, 3.8, .14, .5, .14);
    post(g, s * 2.4, 3.8, .5);
  }
  for (let i = 0; i < 4; i++) prop(g, 'jar', -3 + i * .45, .4, 2.2, { s: .55 });
  prop(g, 'bigJar', 3.2, 0, 3.2);
  hangingLantern(g, 2.4, 2.4, 2.4, M.lanternPaper);
  solid(g, 0, -1.4, 7.2, 2.6); solid(g, 0, .6, 2.6, 1.1);
  for (const s of [-1, 1]) solid(g, s * 3.5, 0, .3, 5.2);
  anchor(g, 'keeper', 0, -.3, 0); anchor(g, 'customer', 0, 2.9, Math.PI);
  deck(g, 0, 0, 7.2, 5.4, 0, .4, [0, 1]);
  return g;
}

export function charmShop() {
  const g = structure({ w: 7, d: 8 });
  box(g, M.darkWood, 0, .25, 0, 5.6, .5, 5);
  timberWalls(g, 5.4, 4.7, .5, 2.6, M.teak);
  porchFrame(g, 2.6, 2.4, 3.05, .5, M.woodRed);
  for (let i = 0; i < 10; i++) box(g, M.wood, 0, .507, -2.2 + i * .47, 5.2, .014, .018);
  for (const s of [-1, 1]) cyl(g, M.woodRed, s * 2.6, 1.6, 2.4, .1, .1, 2.6, 6);
  thaiRoof(g, { width: 6.4, depth: 6.6, height: 3.6, y: 3.05, ry: Math.PI / 2, material: M.tileDark, gable: M.woodRed, trim: M.woodRed });
  box(g, M.cloth.red, 0, 2.95, 3.1, 5.6, .04, 1.4, 0, .35);
  // Hanging yantra cloths, talismans and candles.
  for (let i = 0; i < 5; i++) box(g, M.yantra, -2 + i, 2.25, 2.55, .55, .7, .01);
  for (let i = 0; i < 9; i++) box(g, i % 3 ? M.cloth.yellow : M.cloth.red, -2.2 + i * .55, 2.75, 2.45, .12, .22, .01);
  box(g, M.darkWood, 0, .95, 1, 3, .08, .9); for (const s of [-1, 1]) box(g, M.darkWood, s * 1.35, .72, 1, .08, .45, .7);
  for (let i = 0; i < 7; i++) prop(g, 'candle', -1.2 + i * .4, .99, 1.2 + (i % 2) * .2);
  glow(g, 0, 1.25, 1.2, 2.2, '#ffc46a', 'candle');
  prop(g, 'pot', 1.1, .99, .8, { s: .5 }); smoke(g, 1.1, 1.3, .8, { rate: .8, size: .5, color: '#b9b3a8', rise: .5 });
  for (let i = 0; i < 4; i++) box(g, M.darkWood, -1 + i * .08, 1.03 + i * .05, .8, .7, .05, .35, .1 * i);
  for (let level = 0; level < 2; level++) {
    box(g, M.darkWood, 0, 1.2 + level * .8, -2.1, 4.6, .05, .4);
    for (let i = 0; i < 8; i++) prop(g, i % 2 ? 'pot' : 'candle', -2 + i * .55, 1.23 + level * .8, -2.1, { s: .45 });
  }
  hangingLantern(g, -2.3, 2.3, 2.9); hangingLantern(g, 2.3, 2.3, 2.9);
  solid(g, 0, -1.3, 5.6, 2.4); solid(g, 0, 1, 3.1, 1);
  for (const s of [-1, 1]) solid(g, s * 2.7, 0, .3, 4.8);
  anchor(g, 'keeper', 0, .2, 0); anchor(g, 'customer', 0, 3.2, Math.PI);
  deck(g, 0, 0, 5.6, 5, 0, .5, [0, 1]);
  return g;
}

function boxingRing() {
  const g = structure({ w: 7.5, d: 7.5 });
  box(g, M.woodLight, 0, .3, 0, 6, .6, 6);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { cyl(g, sx * sz > 0 ? M.cloth.red : M.cloth.blue, sx * 2.85, 1.2, sz * 2.85, .09, .09, 1.6, 6); post(g, sx * 2.85, sz * 2.85, .2); }
  for (const y of [1, 1.35, 1.7]) for (const s of [-1, 1]) { box(g, M.rope, 0, y, s * 2.85, 5.7, .04, .04); box(g, M.rope, s * 2.85, y, 0, .04, .04, 5.7); }
  stairs4(g);
  deck(g, 0, 0, 6, 6, 0, .6, [0, 0]);
  anchor(g, 'master', 0, 0, Math.PI);
  return g;
}
function stairs4(g) { for (let i = 0; i < 3; i++) box(g, M.wood, 0, .1 + i * .2, 3.6 - i * .3, 1.4, .2, .32); deck(g, 0, 3.5, 1.4, 1.4, 0, .6, [0, 1.2]); }

function archeryTarget() {
  const g = structure({ w: 2, d: 1.5 });
  for (const s of [-1, 1]) beam(g, M.darkWood, [s * .5, 0, -.3], [s * .3, 1.6, 0], .05);
  const face = new THREE.Group(); face.position.set(0, 1.3, .05); face.rotation.x = Math.PI / 2 - .15; g.add(face);
  cyl(face, M.hay, 0, 0, 0, .7, .7, .2, 16); cyl(face, M.cloth.white, 0, -.11, 0, .45, .45, .02, 16); cyl(face, M.cloth.red, 0, -.12, 0, .18, .18, .02, 12);
  post(g, 0, 0, .5);
  return g;
}
function camp(kind) {
  const g = structure({ w: 6, d: 5 });
  for (const s of [-1, 1]) { cyl(g, M.darkWood, s * 2, 1.2, -1.4, .07, .08, 2.4, 5); cyl(g, M.darkWood, s * 2, .6, 1, .06, .07, 1.2, 5); }
  box(g, kind === 'bandit' ? M.cloth.indigo : M.thatch, 0, 1.75, -.2, 4.4, .06, 2.8, 0, -.42);
  // Fire pit with stones.
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; prop(g, 'rock', Math.cos(a) * .6, .1, 2.3 + Math.sin(a) * .6, { s: .2, color: '#8a877a' }); }
  box(g, M.darkWood, 0, .1, 2.3, .8, .1, .1, .6); box(g, M.darkWood, 0, .12, 2.3, .8, .1, .1, -.6);
  glow(g, 0, .35, 2.3, 1.6, '#ff9a4a', 'fire'); smoke(g, 0, .7, 2.3, { rate: .7, size: .9, color: '#9a978f' });
  prop(g, 'log', -2.4, 0, 2.6, { ry: Math.PI / 2 + .4, s: .5 });
  if (kind === 'hunter') {
    for (let i = 0; i < 3; i++) box(g, mLeather, -1 + i, 1.1, -1.35, .7, .9, .03);
    box(g, M.darkWood, 1.6, .9, .4, .08, 1.6, .08);
    for (let i = 0; i < 3; i++) beam(g, M.wood, [1.4, .3, .1 + i * .3], [1.6, 1.6, .1 + i * .3], .025, 4);
  } else {
    for (let i = 0; i < 4; i++) prop(g, 'crate', -1.6 + (i % 2) * .7, (i > 1 ? .55 : 0), -.6, { ry: i * .4 });
    prop(g, 'jar', 1.5, 0, -.8, { s: .7 });
  }
  solid(g, 0, -1, 4.4, 1.2);
  anchor(g, 'seat', -1.6, 2.6, Math.PI * .6); anchor(g, 'stand', 1.2, 2.8, -Math.PI * .6);
  return g;
}
function shamanHut() {
  const g = structure({ w: 6, d: 6 });
  box(g, M.darkWood, 0, .3, 0, 4, .6, 4);
  box(g, M.thatchDark, 0, 1.5, -1.8, 3.6, 1.8, .1);
  for (const s of [-1, 1]) box(g, M.thatchDark, s * 1.8, 1.5, 0, .1, 1.8, 3.6);
  thaiRoof(g, { width: 4.8, depth: 4.8, height: 3.8, y: 2.3, material: M.thatchDark, gable: M.darkWood });
  for (let i = 0; i < 5; i++) { box(g, M.rope, -1.6 + i * .8, 2.1, 2.1, .02, .5, .02); prop(g, 'pot', -1.6 + i * .8, 1.6, 2.1, { s: .45 }); }
  for (let i = 0; i < 3; i++) box(g, i % 2 ? M.cloth.white : M.cloth.red, -1 + i, 1.9, 1.95, .5, .9, .02);
  for (let i = 0; i < 5; i++) prop(g, 'candle', -.8 + i * .4, .6, 1.4);
  glow(g, 0, .85, 1.4, 1.4, '#ffbf6a', 'candle'); smoke(g, .9, 1, 1.4, { rate: .6, size: .6, color: '#a9a39a' });
  solid(g, 0, -.4, 4, 3);
  anchor(g, 'master', 0, 2.8, Math.PI);
  deck(g, 0, 0, 4, 4, 0, .6, [0, 1]);
  return g;
}

export function buildShops(ctx) {
  const { rng } = ctx;
  const L = id => landmark(id);
  let a = ctx.place(forge(), L('forge').x, L('forge').z, 0);
  ctx.spot('forge_smith', a.smith.x, a.smith.z, a.smith.face, 'forge_aisle'); ctx.spot('forge_aisle', a.aisle.x, a.aisle.z, 0, 'forge_customer'); ctx.spot('forge_customer', a.customer.x, a.customer.z, a.customer.face, 'bl2');
  a = ctx.place(enhanceForge(), L('enhance').x, L('enhance').z, Math.PI);
  ctx.spot('enhance_master', a.master.x, a.master.z, a.master.face, 'enh_front'); ctx.spot('enh_front', a.customer.x, a.customer.z, a.customer.face, 'bl2');

  // General store and more shophouses along the merchants' street.
  const goods = [[{ name: 'torch', x: -.8, z: -.2 }, { name: 'torch', x: -.6, z: -.1 }, { name: 'rope', x: .2 }, { name: 'rope', x: .4, y: .14 }, { name: 'sack', x: 1, ry: .4 }],
    [{ name: 'crate', x: -.8 }, { name: 'crate', x: -.8, y: .55, s: .8 }, { name: 'jar', x: .3, s: .8 }, { name: 'basket', x: 1 }]];
  a = ctx.place(shophouseRow(rng, 2, { goods, awning: M.cloth.green }), L('general').x, L('general').z, Math.PI / 2);
  ctx.spot('general_keeper', L('general').x + 3.2, L('general').z, Math.PI / 2, 'shops_m');
  ctx.spot('general_customer', L('general').x + 5.6, L('general').z + .6, -Math.PI / 2, 'shops_m');
  a = ctx.place(herbShop(), L('herbalist').x, L('herbalist').z, -Math.PI / 2);
  ctx.spot('herb_keeper', a.keeper.x, a.keeper.z, a.keeper.face, 'herb_customer'); ctx.spot('herb_customer', a.customer.x, a.customer.z, a.customer.face, 'shops_m');
  a = ctx.place(charmShop(), L('occult').x, L('occult').z, -Math.PI / 2);
  ctx.spot('occult_keeper', a.keeper.x, a.keeper.z, a.keeper.face, 'occult_customer'); ctx.spot('occult_customer', a.customer.x, a.customer.z, a.customer.face, 'shops_s');
  ctx.place(shophouseRow(rng, 2, { goods: [[{ name: 'pot', x: -.5 }, { name: 'pot', x: .3, s: 1.2 }], [{ name: 'jar', x: 0 }, { name: 'jar', x: .9, s: .8 }]] }), -9, 81, Math.PI / 2);
  ctx.place(shophouseRow(rng, 2, { goods: [[{ name: 'basket', x: 0 }], [{ name: 'fruitBasket', x: .3, color: '#c8572f' }]] }), -9, 98, Math.PI / 2);
  ctx.place(shophouseRow(rng, 2, { goods: [[{ name: 'sack', x: 0 }, { name: 'sack', x: .7 }], [{ name: 'crate', x: 0 }]] }), 10, 99, -Math.PI / 2);

  // Training grounds of the class masters.
  a = ctx.place(boxingRing(), 39, 59, 0);
  ctx.spot('boxing_master', 39, 59, Math.PI, 'tr_yard'); ctx.spot('tr_yard', 39, 64.8, 0, 'tr2');
  // (the row of training dummies here is live: src/training/TrainingGround.js, TRAINING.dummy.spots)
  ctx.spot('sword_master', 52, 58.8, Math.PI, 'tr_yard2'); ctx.spot('tr_yard2', 52, 64, 0, 'tr2');
  for (let i = 0; i < 3; i++) ctx.place(archeryTarget(), 59.5, 61 + i * 3.4, -Math.PI / 2);
  ctx.spot('hunter_master', 47, 67.6, Math.PI / 2, 'tr2');
  const rack = structure(null);
  box(rack, M.darkWood, 42.5, .9, 68.2, 2.4, .1, .1); for (let i = 0; i < 5; i++) box(rack, M.steel, 41.7 + i * .4, .8, 68.2, .04, 1.1, .05);
  ctx.place(rack, 0, 0); ctx.collision.addBox(42.5, 68.2, 2.6, .5, 0);
  a = ctx.place(camp('hunter'), 30, 95, Math.PI * 1.1);
  ctx.spot('hunter_camp', a.seat.x, a.seat.z, a.seat.face, 'tr2');
  a = ctx.place(shamanHut(), 58, 96, Math.PI);
  ctx.spot('shaman_master', a.master.x, a.master.z, a.master.face, 'tr3');
  a = ctx.place(camp('bandit'), 76, 86, -Math.PI * .35);
  ctx.spot('bandit_master', a.stand.x, a.stand.z, a.stand.face, 'tr3');
}
