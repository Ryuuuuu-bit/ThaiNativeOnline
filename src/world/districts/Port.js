import * as THREE from 'three';
import { M } from '../materials.js';
import {
  box, cyl, beam, structure, solid, post, deck, prop, glow, anchor,
  thaiRoof, sala, warehouse, stiltHouse, hangingLantern, lanternPost, fence,
} from '../Architecture.js';
import { riverBank } from '../CityMap.js';

// A wooden pier: local origin on the bank, extending along +z into the river.
function pier(length, width, h = .55, { crane = false } = {}) {
  const g = structure({ w: width + .6, d: length + 1, z: length / 2 });
  box(g, M.woodLight, 0, h - .07, length / 2 - .5, width, .14, length + 1);
  for (let z = -.6; z < length; z += .55) box(g, M.wood, 0, h + .006, z, width - .05, .015, .05);
  for (let z = 1.2; z <= length; z += 2.6) for (const s of [-1, 1]) cyl(g, M.darkWood, s * (width / 2 - .05), h / 2 - .6, z, .1, .12, h + 1.4, 6);
  for (let z = 3.5; z < length - 1; z += 5) for (const s of [-1, 1]) prop(g, 'mooring', s * (width / 2 + .08), h - .45, z);
  deck(g, 0, length / 2 - .5, width, length + 1, 0, h, [1.4, 0]);
  if (crane) {
    const mx = width / 2 - .45, mz = length - 1.2;
    cyl(g, M.teak, mx, h + 3, mz, .16, .2, 6, 7);
    beam(g, M.teak, [mx, h + 2.2, mz], [mx + 4.2, h + 5.3, mz + 1.5], .1);
    beam(g, M.rope, [mx, h + 5.8, mz], [mx + 4.2, h + 5.3, mz + 1.5], .025, 4);
    beam(g, M.rope, [mx + 4.2, h + 5.3, mz + 1.5], [mx + 4.2, h + 2.4, mz + 1.5], .02, 4);
    prop(g, 'crate', mx + 4.2, h + 1.8, mz + 1.5, { ry: .4 });
    post(g, mx, mz, .3);
  }
  return g;
}

function portTower() {
  const g = structure({ w: 6, d: 6 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) cyl(g, M.teak, sx * 1.6, 5.6, sz * 1.6, .16, .2, 11.2, 7);
  for (const y of [3.6, 7.2]) {
    box(g, M.woodLight, 0, y, 0, 4, .18, 4);
    for (const s of [-1, 1]) { beam(g, M.darkWood, [s * 1.6, y - 3.4, -1.6], [s * 1.6, y - .2, 1.6], .06); beam(g, M.darkWood, [-1.6, y - 3.4, s * 1.6], [1.6, y - .2, s * 1.6], .06); }
  }
  box(g, M.woodLight, 0, 10.4, 0, 4.4, .2, 4.4);
  for (const s of [-1, 1]) { box(g, M.wood, s * 2.15, 10.9, 0, .08, .9, 4.4); box(g, M.wood, 0, 10.9, s * 2.15, 4.4, .9, .08); }
  for (let y = .3; y < 10.4; y += .4) box(g, M.wood, 2.25, y, .6, .5, .05, .08);
  thaiRoof(g, { width: 5.4, depth: 5.4, height: 3.2, y: 11.3, material: M.tileOrange, style: 'temple', trim: M.gold, gable: M.woodRed, finials: true });
  cyl(g, M.darkWood, 0, 16.4, 0, .05, .06, 3, 5);
  box(g, M.cloth.red, .9, 17.3, 0, 1.7, .4, .03); box(g, M.cloth.yellow, .7, 16.8, 0, 1.3, .3, .03);
  hangingLantern(g, 1.8, 10.2, 1.8); hangingLantern(g, -1.8, 10.2, -1.8);
  glow(g, 0, 11.8, 0, 3, '#ffc070', 'beacon');
  solid(g, 0, 0, 3.8, 3.8);
  return g;
}

function fishShed(rng, w = 13, d = 5.5) {
  const g = structure({ w: w + 1, d: d + 1 });
  for (let x = -w / 2 + .3; x <= w / 2; x += w / 4 - .15) for (const s of [-1, 1]) { cyl(g, M.darkWood, x, 1.4, s * (d / 2 - .2), .1, .11, 2.8, 6); post(g, x, s * (d / 2 - .2), .15); }
  thaiRoof(g, { width: d + 1.4, depth: w + .8, height: 2.6, y: 2.7, ry: Math.PI / 2, material: M.thatch, gable: M.wood });
  for (let i = 0; i < 3; i++) {
    const x = -w / 3 + i * w / 3;
    box(g, M.woodLight, x, .75, -.6, 3, .1, 1.1);
    for (const lx of [-1.3, 1.3]) box(g, M.darkWood, x + lx, .37, -.6, .08, .74, .9);
    for (let k = 0; k < 3; k++) prop(g, 'fishBasket', x - .9 + k * .9, .8, -.6);
    prop(g, 'jar', x + 1.2, 0, .6, { s: .75 });
    for (let k = 0; k < 6; k++) prop(g, 'fishDry', x - 1 + k * .4, 2.45, -1.6);
    anchor(g, `vendor${i}`, x, -1.6, 0); anchor(g, `buyer${i}`, x, .9, Math.PI);
    anchor(g, 'endE', w / 2 + .9, -1.6, 0); anchor(g, 'endW', -w / 2 - .9, -1.6, 0);
    hangingLantern(g, x, 2.2, .8);
    solid(g, x, -.6, 3, 1.1);
  }
  return g;
}

function oxCart() {
  const g = structure({ w: 2.4, d: 4 });
  box(g, M.woodLight, 0, 1, 0, 1.5, .1, 2.6);
  for (const s of [-1, 1]) { box(g, M.wood, s * .72, 1.3, 0, .06, .5, 2.6); beam(g, M.wood, [s * .35, .95, 1.2], [s * .25, .6, 3.2], .05); }
  for (const s of [-1, 1]) {
    const wheel = new THREE.Group(); wheel.position.set(s * .95, .8, -.2); wheel.rotation.z = Math.PI / 2; g.add(wheel);
    cyl(wheel, M.teak, 0, 0, 0, .8, .8, .1, 16); cyl(wheel, M.darkWood, 0, 0, 0, .14, .14, .22, 8);
  }
  for (let i = 0; i < 3; i++) prop(g, 'sack', -.3 + i * .3, 1.08, -.6 + i * .5, { ry: 1.4 });
  solid(g, 0, 0, 2, 3.4);
  return g;
}

function netRack(rng) {
  const g = structure({ w: 5, d: 1.4 });
  for (const s of [-1, 1]) cyl(g, M.darkWood, s * 2.2, 1.1, 0, .05, .06, 2.2, 5);
  box(g, M.darkWood, 0, 2.15, 0, 4.6, .06, .06);
  box(g, M.net, 0, 1.25, 0, 4.3, 1.75, .02, 0, .08);
  post(g, -2.2, 0, .15); post(g, 2.2, 0, .15);
  return g;
}
function fishRack() {
  const g = structure({ w: 4, d: 2 });
  for (const s of [-1, 1]) for (const z of [-.6, .6]) cyl(g, M.darkWood, s * 1.7, .7, z, .04, .05, 1.4, 5);
  for (const z of [-.6, .6]) box(g, M.woodPale, 0, 1.38, z, 3.6, .05, .05);
  for (let i = 0; i < 9; i++) for (const z of [-.6, .6]) prop(g, 'fishDry', -1.6 + i * .4, 1.36, z);
  solid(g, 0, 0, 3.6, 1.4);
  return g;
}
function boatOnStocks() {
  const g = structure({ w: 4, d: 12 });
  beam(g, M.teak, [0, .9, -5], [0, .9, 5], .12);
  for (let i = 0; i < 9; i++) {
    const z = -4 + i, w = 1.4 * Math.sin(Math.PI * (i + .5) / 9) + .3;
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(-w, 2, z), new THREE.Vector3(-w * .7, 1.1, z), new THREE.Vector3(0, .85, z), new THREE.Vector3(w * .7, 1.1, z), new THREE.Vector3(w, 2, z)]);
    const rib = new THREE.Mesh(new THREE.TubeGeometry(curve, 8, .05, 4, false), M.woodLight); rib.castShadow = true; g.add(rib);
  }
  for (const s of [-1, 1]) box(g, M.woodLight, s * 1.05, 1.55, 0, .08, .35, 6.5);
  for (const z of [-3, 0, 3]) box(g, M.darkWood, 0, .4, z, 2.2, .8, .4);
  solid(g, 0, 0, 3, 11);
  return g;
}

export function buildPort(ctx) {
  const { rng } = ctx;
  const bank = riverBank;
  // Stone quay along the busiest stretch of bank.
  const quay = new THREE.Group();
  for (let x = -52; x < 62; x += 3) box(quay, M.sandstone, x + 1.5, -.05, bank(x + 1.5) - .2, 3.05, .55, 1.2, -Math.atan((bank(x + 3) - bank(x)) / 3));
  ctx.batcher.addObject(quay);

  // Piers.
  ctx.place(pier(18, 4.5, .55, { crane: true }), -22, bank(-22) - 1.2);
  ctx.place(pier(14, 3.5), 6, bank(6) - 1.2);
  const dockB = pier(15, 6);
  box(dockB, M.woodLight, 0, .48, 15.5, 12, .14, 4); deck(dockB, 0, 15.5, 12, 4, 0, .55, [0, 0]);
  for (const x of [-5.5, -2, 2, 5.5]) cyl(dockB, M.darkWood, x, -.3, 17.3, .1, .12, 1.8, 6);
  ctx.place(dockB, 30, bank(30) - 1.2);
  ctx.place(pier(10, 2.6, .5), -46, bank(-46) - 1.2);

  ctx.spot('dockA_land', -21, 160.5, Math.PI, 'port_w');
  ctx.spot('dockA_end', -21, bank(-22) + 14.5, 0, 'dockA_land');
  ctx.spot('pdock_land', 6, 165.5, 0, 'port_c');
  ctx.spot('pdock_end', 6.6, bank(6) + 11.5, 0, 'pdock_land');
  ctx.spot('dockB_land', 30, 166, 0, 'port_e');
  ctx.spot('dockB_end', 27, bank(30) + 15.5, 0, 'dockB_land');
  ctx.spot('dockB_end2', 33.5, bank(30) + 15.5, 0, 'dockB_land');
  ctx.spot('fishdock_land', -46, bank(-46) - 1.5, 0, 'port_w');
  ctx.spot('fishdock_end', -46, bank(-46) + 8, 0, 'fishdock_land');

  // Warehouses, cart and cargo piles.
  ctx.place(warehouse(rng, 12, 7), -34, 133.5);
  ctx.spot('warehouseA', -34, 138.6, 0, 'port_w');
  ctx.place(warehouse(rng, 11, 7), 38, 133.5);
  ctx.spot('warehouseB', 38, 138.6, 0, 'port_e');
  ctx.place(oxCart(), -22, 137, .4);
  const piles = structure(null);
  for (const [x, z] of [[-28, 158], [-15, 156], [20, 164.5], [38, 162], [-40, 157]]) {
    for (let i = 0; i < 5; i++) prop(piles, i % 2 ? 'crate' : 'sack', x + (i % 3) * .75, i > 2 ? .55 : 0, z + Math.floor(i / 3) * .8, { ry: rng() });
    ctx.collision.addCircle(x + .8, z + .4, 1.2);
  }
  for (let i = 0; i < 6; i++) prop(piles, 'jar', 12 + i * .9, 0, 158 + (i % 2) * .8, { s: .9 });
  for (let i = 0; i < 8; i++) prop(piles, 'mooring', -50 + i * 15, -.1, bank(-50 + i * 15) - .6);
  ctx.place(piles, 0, 0);
  ctx.collision.addCircle(15, 158.5, 2.4);

  // Passenger sala and the port tower landmark.
  const waiting = sala(rng, { w: 4.4, d: 3.2, h: 2.4, roof: M.tileOrange });
  prop(waiting, 'bench', 0, .3, 0);
  ctx.place(waiting, -3, 161.5);
  ctx.spot('sala_seat', -3, 161.5, Math.PI / 2, 'port_c');
  ctx.place(portTower(), 18, 159.5);
  const lamps = structure(null);
  for (const x of [-38, -10, 14, 46]) lanternPost(lamps, x, 141);
  ctx.place(lamps, 0, 0);

  // Fish market: two open sheds either side of the south road.
  for (const [x, name] of [[-11, 'fishW'], [11, 'fishE']]) {
    const a = ctx.place(fishShed(rng), x, 124);
    const end = x < 0 ? a.endE : a.endW;
    ctx.spot(`${name}_end`, end.x, end.z, 0, 'fishmkt');
    for (let i = 0; i < 3; i++) { ctx.spot(`${name}_v${i}`, a[`vendor${i}`].x, a[`vendor${i}`].z, a[`vendor${i}`].face, `${name}_end`); ctx.spot(`${name}_b${i}`, a[`buyer${i}`].x, a[`buyer${i}`].z, a[`buyer${i}`].face, 'fishmkt'); }
  }
  ctx.spot('bank_seat', -8, bank(-8) - 1.4, 0, 'port_c');
  ctx.spot('kid_watch', 13, bank(13) - 1.4, 0, 'port_c');
  ctx.spot('trader_a', -14, 140.5, Math.PI / 2, 'port_c');
  ctx.spot('trader_b', -12.4, 140.5, -Math.PI / 2, 'port_c');

  // Fishing village west of the port.
  for (const [x, rot] of [[-113, 0], [-84, 0], [-70, .1]]) {
    const z = bank(x) - 1.4;
    ctx.place(stiltHouse(rng, { thatch: true }), x, z, Math.PI + rot);
  }
  for (const [x, z] of [[-104, 154], [-92, 156.5]]) ctx.place(netRack(rng), x, z, rng.range(-.2, .2));
  ctx.place(fishRack(), -76, 152.5);
  ctx.place(pier(9, 2.4, .5), -96, bank(-96) - 1.2);
  ctx.spot('fv_net', -104, 155.6, 0, 'fv_m');
  ctx.spot('fv_rack', -76, 150.9, Math.PI, 'fv_e');
  ctx.spot('fv_dock', -95.6, bank(-96) + 7.5, 0, 'fv_m');
  ctx.spot('fv_boat', -100, bank(-100) - 1.8, .3, 'fv_m');
  const village = structure(null);
  for (let i = 0; i < 8; i++) prop(village, 'trap', -110 + i * 1.1, 0, 151 + (i % 2), { ry: rng() * 3 });
  for (let i = 0; i < 4; i++) prop(village, 'fishBasket', -88 + i * .8, 0, 151.2);
  fence(village, M.darkWood, -117, 138, -107, 138);
  ctx.place(village, 0, 0);

  // Boatyard on the east bank.
  const yard = boatOnStocks();
  for (let i = 0; i < 4; i++) prop(yard, 'log', 3.2, .3 + (i > 2 ? .55 : 0), -3 + i * .9, { ry: Math.PI / 2 });
  ctx.place(yard, 98, 156, Math.PI / 2 + .1);
  const shed = structure({ w: 6, d: 5 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) cyl(shed, M.darkWood, sx * 2.4, 1.3, sz * 1.8, .1, .1, 2.6, 6);
  thaiRoof(shed, { width: 5, depth: 6, height: 2.4, y: 2.5, material: M.thatch, gable: M.wood });
  box(shed, M.woodLight, 0, .8, 0, 3, .1, 1.2);
  solid(shed, 0, 0, 4.8, 3.6);
  ctx.place(shed, 108, 151);
  ctx.spot('boatyard', 101, 152, Math.PI / 2, 'er_m');
}
