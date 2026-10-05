import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { M, mat } from '../materials.js';
import { box, cyl, cone, beam, structure, solid, post, prop, thaiRoof, fence, spiritHouse, anchor } from '../Architecture.js';
import { PADDIES, paddyAt } from '../CityMap.js';
import { InstanceSet } from '../Batching.js';
import { patchMaterial } from '../shaders.js';
import { OCC } from '../Terrain.js';

function riceGeometry() {
  const blades = [];
  for (let i = 0; i < 7; i++) {
    const a = i / 7 * Math.PI * 2, lean = .18 + (i % 3) * .06, g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([-.045, 0, 0, .045, 0, 0, Math.sin(lean) * .5, .8, Math.cos(lean) * .05], 3));
    g.computeVertexNormals(); g.rotateY(a); blades.push(g);
  }
  return mergeGeometries(blades, false);
}

function fieldHut() {
  const g = structure({ w: 4, d: 4 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) cyl(g, M.darkWood, sx * 1.2, 1.4, sz * 1, .07, .08, 2.8, 5);
  box(g, M.woodPale, 0, 1.2, 0, 2.7, .1, 2.3);
  thaiRoof(g, { width: 3.4, depth: 3.2, height: 1.8, y: 2.6, material: M.thatch, gable: false, trim: M.wood });
  for (let i = 0; i < 4; i++) box(g, M.wood, 1.6, .25 + i * .3, .4, .5, .05, .08);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) post(g, sx * 1.2, sz * 1, .15);
  anchor(g, 'seat', .3, 1.9, Math.PI);
  return g;
}
function granary() {
  const g = structure({ w: 5, d: 5 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) cyl(g, M.darkWood, sx * 1.6, .7, sz * 1.4, .12, .12, 1.4, 6);
  box(g, M.woodLight, 0, 1.45, 0, 3.6, .14, 3.2);
  box(g, M.wood, 0, 2.4, 0, 3.4, 1.8, 3);
  for (let i = 0; i < 6; i++) box(g, M.darkWood, -1.5 + i * .6, 2.4, 1.52, .04, 1.8, .04);
  thaiRoof(g, { width: 4.4, depth: 4.2, height: 2.4, y: 3.25, material: M.thatch, gable: M.woodLight });
  solid(g, 0, 0, 3.6, 3.2);
  return g;
}
function ricePounder() {
  const g = structure({ w: 4, d: 2 });
  cyl(g, M.wood, -1.3, .3, 0, .35, .3, .6, 10);
  beam(g, M.woodLight, [-1.3, .9, 0], [1.6, .45, 0], .07);
  box(g, M.darkWood, .3, .4, 0, .2, .8, .3);
  solid(g, 0, 0, 3.2, .8);
  return g;
}
function scarecrow(color) {
  const g = structure(null);
  cyl(g, M.darkWood, 0, .9, 0, .04, .05, 1.8, 5); box(g, M.darkWood, 0, 1.35, 0, 1.3, .05, .05);
  box(g, color, 0, 1.25, 0, .8, .55, .2); cone(g, M.hay, 0, 1.8, 0, .4, .22, 10);
  return g;
}

function banyan(ctx, x, z) {
  const g = structure({ w: 12, d: 12 });
  const y = ctx.terrain.height(x, z);
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; beam(g, M.bark, [Math.cos(a) * 1.2, 0, Math.sin(a) * 1.2], [Math.cos(a) * .3, 7, Math.sin(a) * .3], .75, 8); }
  for (let i = 0; i < 9; i++) {
    const a = i / 9 * Math.PI * 2 + .2, r = 6 + (i % 3);
    beam(g, M.branch, [0, 6, 0], [Math.cos(a) * r, 9 + (i % 2), Math.sin(a) * r], .3);
    for (let k = 0; k < 2; k++) { const rr = r * (.45 + k * .3); beam(g, M.bark, [Math.cos(a) * rr, 7.4 + k * .9, Math.sin(a) * rr], [Math.cos(a) * rr * 1.05, 0, Math.sin(a) * rr * 1.05], .07 + k * .03, 5); }
  }
  // Coloured cloth ribbons around the trunk and a small spirit shrine at its foot.
  [M.cloth.red, M.cloth.yellow, M.cloth.green].forEach((m, i) => cyl(g, m, 0, 1 + i * .25, 0, 1.75, 1.8, .18, 16));
  spiritHouse(-2.6, 2.4, g);
  for (let i = 0; i < 6; i++) prop(g, 'flower', -2.2 + i * .2, .1, 3.1, { color: i % 2 ? '#e7c54a' : '#d2523d', s: 1.4 });
  solid(g, 0, 0, 3.6, 3.6);
  ctx.place(g, x, z, 0, { y });
  ctx.veg.canopy(x, y + 10.5, z, 150, 9, 1.8, -.05, .1);
  ctx.veg.canopy(x, y + 8, z, 40, 6, 1.4, .05, .1);
}

export function buildCountryside(ctx) {
  const { rng, veg, props } = ctx;
  // Rice paddies, with a few plots being planted where the farmers work.
  const riceMat = patchMaterial(mat('#ffffff', { side: THREE.DoubleSide }), { wind: .14, instanced: true });
  const rice = new InstanceSet(riceGeometry(), riceMat, { castShadow: false, keep: ctx.keep });
  ctx.sets.push(rice);
  const planting = [[-45, -176], [-72, -210], [-30, -240], [-84, -176]];
  for (const [x, z] of planting) { const p = paddyAt(x, z); if (p) p.state = 'young'; }
  const style = {
    young: { step: .9, h: [.35, .5], color: ['#8fbf4a', '#a3c95a'] }, growing: { step: .66, h: [.8, 1.05], color: ['#6f9a3a', '#7fa646'] },
    ripe: { step: .66, h: [.85, 1.05], color: ['#c9a84a', '#d4b55a'] }, flooded: { step: 3.2, h: [.2, .3], color: ['#8fbf4a', '#8fbf4a'] },
  };
  for (const p of PADDIES) {
    const st = style[p.state], c = new THREE.Color();
    for (let x = p.x0 + .45; x < p.x1 - .3; x += st.step) for (let z = p.z0 + .45; z < p.z1 - .3; z += st.step) {
      if (p.state === 'young' && planting.some(([px, pz]) => x < px + 1 && Math.abs(z - pz) < 2.5)) continue;
      c.set(st.color[rng() > .5 ? 1 : 0]).offsetHSL(rng.range(-.02, .02), 0, rng.range(-.05, .05));
      rice.add(x + rng.range(-.12, .12), -.22, z + rng.range(-.12, .12), { ry: rng() * 6, s: rng.range(.85, 1.1), sy: rng.range(...st.h), color: c });
    }
  }
  ctx.spot('paddy_a', -45, -176, Math.PI / 2, 'fb1'); ctx.spot('paddy_b', -72, -210, -Math.PI / 2, 'fc2');
  ctx.spot('paddy_c', -30, -240, Math.PI / 2, 'fd1'); ctx.spot('paddy_d', -84, -176, Math.PI / 2, 'fb2');
  for (const [x, z, id, link] of [[-98.5, -190.5, 'hut_a', 'fc3'], [-44.5, -165, 'hut_b', 'fb1'], [-31.5, -219, 'hut_c', 'fc1']]) {
    const a = ctx.place(fieldHut(), x, z, rng.range(-.3, .3));
    ctx.spot(id, a.seat.x, a.seat.z, a.seat.face, link);
  }
  ctx.spot('hut_b_ground', -42.8, -163.2, Math.PI, 'fb1');
  for (const [x, z] of [[-58, -185], [-25, -200], [-110, -228], [-75, -246]]) ctx.place(scarecrow(rng.pick([M.cloth.indigo, M.cloth.red, M.cloth.white])), x, z, rng() * 3);
  // Sugar palms (ต้นตาล) along the bunds: the signature silhouette of the fields.
  for (let i = 0; i < 34; i++) {
    const x = rng.range(-118, -14), z = rng.range(-252, -150);
    if (!paddyAt(x, z) && ctx.occ.get(x, z) === OCC.FREE) veg.sugarPalm(x, ctx.terrain.height(x, z), z, { s: rng.range(.85, 1.15) });
  }

  // Farmers' village yard.
  ctx.place(granary(), -82, -125.5);
  ctx.place(granary(), -48, -124, .1);
  ctx.place(ricePounder(), -60, -125, .2);
  const yard = structure(null);
  for (const [x, z, s] of [[-72, -122.5, 1.2], [-69, -121.8, 1], [-54, -130.5, 1.1]]) { prop(yard, 'hay', x, 0, z, { s }); post(yard, x, z, s * .95); }
  for (let i = 0; i < 6; i++) prop(yard, 'sack', -64 + i * .6, 0, -121.8, { ry: i });
  for (let i = 0; i < 4; i++) prop(yard, 'basket', -66 + i * .7, 0, -131);
  fence(yard, M.darkWood, -104, -121, -92, -121); fence(yard, M.darkWood, -104, -121, -104, -130); fence(yard, M.darkWood, -92, -121, -92, -130); fence(yard, M.darkWood, -104, -130, -97, -130);
  ctx.place(yard, 0, 0);
  for (const [x1, z1, x2, z2] of [[-104, -121, -92, -121], [-104, -121, -104, -130], [-92, -121, -92, -130], [-104, -130, -97, -130]]) ctx.collision.addSegment(x1, z1, x2, z2, .15);
  ctx.occ.markRect(-98, -125.5, 13, 10, 0, OCC.BUILDING);
  ctx.pens.push({ x: -98, z: -125.5, rx: 4.5, rz: 3 });
  ctx.spot('village_yard', -61.5, -128.2, -Math.PI / 2, 'fv2');
  ctx.spot('pounder', -58.4, -126.6, -Math.PI / 2, 'fv2');

  // Orchards: rows of mango trees with banana clumps; herb beds near the road.
  for (let x = 20; x < 117; x += 7) for (let z = -149; z > -253; z -= 6.5) {
    const ox = x + rng.range(-.6, .6), oz = z + rng.range(-.6, .6);
    if (ctx.occ.get(ox, oz) !== OCC.FREE || ctx.occ.get(ox + 1.5, oz) !== OCC.FREE || ctx.occ.get(ox - 1.5, oz) !== OCC.FREE) continue;
    if (ox > 34 && ox < 82 && oz > -137) continue;
    const y = ctx.terrain.height(ox, oz);
    if (Math.round(x / 7) % 5 === 0) { for (let k = 0; k < 3; k++) veg.banana(ox + rng.range(-1, 1), y, oz + rng.range(-1, 1), { s: rng.range(.8, 1.1) }); }
    else veg.fruitTree(ox, y, oz, { s: rng.range(.85, 1.15), fruit: rng.pick(['#d9b23d', '#c8a03a', '#9fb84a']) });
  }
  for (let z = -126; z > -254; z -= 9) veg.palm(119, ctx.terrain.height(119, z), z + rng.range(-2, 2), { s: rng.range(.9, 1.15) });
  for (let i = 0; i < 14; i++) {
    const bx = 40 + (i % 7) * 4.2, bz = -128 - Math.floor(i / 7) * 5.5;
    for (let k = 0; k < 6; k++) props.add('herb', bx - .7 + (k % 2) * 1.4, -.02, bz - 1.3 + Math.floor(k / 2) * 1.3, { s: rng.range(.8, 1.2), ry: rng() * 3, color: rng.pick(['#5e8a3a', '#7a9a45', '#4d7a4a', '#8a6f8a']) });
  }
  const hut = structure({ w: 6, d: 5 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) cyl(hut, M.darkWood, sx * 2.2, 1.2, sz * 1.6, .09, .09, 2.4, 5);
  thaiRoof(hut, { width: 4.6, depth: 5.6, height: 2.2, y: 2.3, ry: Math.PI / 2, material: M.thatch, gable: false, trim: M.wood });
  for (const s of [-1, 1]) { box(hut, M.darkWood, s * 1.2, 1.8, -1.4, 1.8, .05, .05); for (let i = 0; i < 5; i++) box(hut, M.moss, s * 1.2 - .7 + i * .35, 1.55, -1.4, .12, .45, .12); }
  prop(hut, 'mortar', 0, 0, .4); prop(hut, 'basket', .8, 0, .6); prop(hut, 'jar', -1.6, 0, .8, { s: .8 });
  solid(hut, 0, -1.4, 4.4, .6);
  ctx.place(hut, 74, -129);
  ctx.spot('herb_gather', 48, -130.8, 0, 'herb'); ctx.spot('orchard_pick', 60, -203.5, Math.PI, 'oc1');

  // The ancient banyan marks the road toward the forest.
  banyan(ctx, 12, -284);
  ctx.spot('banyan_pray', 8.6, -281, Math.PI * .75, 'n6');
  // Forest gate: a spirit shrine and a sacred rope across the trail.
  const gate = structure(null);
  spiritHouse(8, -306, gate);
  for (const s of [-1, 1]) cyl(gate, M.darkWood, s * 3.6, 1.4, -305, .1, .12, 2.8, 6);
  beam(gate, M.rope, [-3.6, 2.6, -305], [3.6, 2.6, -305], .03, 4);
  for (let i = 0; i < 9; i++) box(gate, [M.cloth.red, M.cloth.yellow, M.cloth.white][i % 3], -3 + i * .75, 2.25, -305, .12, .6, .01);
  box(gate, M.darkWood, -5.2, 1.4, -304, .1, 1.4, .1); box(gate, M.woodLight, -5.2, 2, -304, 1.2, .5, .06, .15);
  post(gate, -3.6, -305, .2); post(gate, 3.6, -305, .2);
  ctx.place(gate, 0, 0);
}
