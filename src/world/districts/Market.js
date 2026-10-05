import { M } from '../materials.js';
import { box, cyl, cone, ball, structure, prop, glow, sala, stall, shophouseRow, lanternPost, post, deck, hangingLantern } from '../Architecture.js';
import { J, ROADS, roadPoints, segmentDistance } from '../CityMap.js';
import { landmark } from '../../data/landmarks.js';

const CENTER = { x: 0, z: 28 };
const RING = roadPoints(ROADS.find(r => r.kind === 'plaza'));
const RING_NODES = ['mkt_n', 'pl_nw', 'mkt_w', 'pl_sw', 'mkt_s', 'pl_se', 'mkt_e', 'pl_ne'];
const ringDistance = (x, z) => Math.min(...RING.slice(1).map((b, i) => segmentDistance(x, z, RING[i][0], RING[i][1], b[0], b[1])));
const nearestRingNode = (x, z) => RING_NODES.reduce((best, id) => (Math.hypot(J[id][0] - x, J[id][1] - z) < Math.hypot(J[best][0] - x, J[best][1] - z) ? id : best));

function addStall(ctx, kind, x, z, rot, name) {
  const a = ctx.place(stall(ctx.rng, kind), x, z, rot);
  const c = Math.cos(rot), s = Math.sin(rot);
  const side = { x: x + 2.1 * c - 1.15 * s, z: z - 2.1 * s - 1.15 * c };
  const corner = { x: x + 2.1 * c + 1.5 * s, z: z - 2.1 * s + 1.5 * c };
  ctx.spot(`${name}_c`, a.customer.x, a.customer.z, a.customer.face, nearestRingNode(a.customer.x, a.customer.z));
  ctx.spot(`${name}_k`, corner.x, corner.z, rot, `${name}_c`);
  ctx.spot(`${name}_s`, side.x, side.z, rot, `${name}_k`);
  ctx.spot(`${name}_v`, a.vendor.x, a.vendor.z, a.vendor.face, `${name}_s`);
  ctx.market.push({ name, kind, x, z });
}

// Wooden bridges over คลองเมือง: a raised deck with ramps and red railings.
function bridge(length, width, height = .7, grand = false) {
  const g = structure(null), ramp = 3, flat = length - ramp * 2, slope = Math.atan2(height, ramp);
  box(g, M.woodLight, 0, height - .06, 0, width, .12, flat);
  for (const s of [-1, 1]) {
    box(g, M.woodLight, 0, height / 2 - .06, s * (flat / 2 + ramp / 2), width, .12, Math.hypot(ramp, height), 0, s * slope);
    for (const x of [-width / 2, width / 2]) {
      box(g, M.woodRed, x, height + .55, 0, .1, .08, flat);
      for (let z = -flat / 2; z <= flat / 2 + .01; z += flat / 4) box(g, M.woodRed, x, height + .28, z, .12, .6, .12);
      cyl(g, M.darkWood, x, -.2, s * flat / 2, .12, .14, 1.8, 6);
    }
  }
  for (let z = -flat / 2 + .3; z < flat / 2; z += .5) box(g, M.wood, 0, height + .005, z, width - .1, .015, .05);
  if (grand) for (const x of [-width / 2, width / 2]) for (const s of [-1, 1]) { cyl(g, M.woodRed, x, height + .8, s * flat / 2, .1, .1, 1.6, 6); hangingLantern(g, x, height + 1.3, s * flat / 2 + s * .25); }
  for (const x of [-width / 2, width / 2]) g.userData.colliders.push({ t: 'box', x, z: 0, w: .2, d: flat, rot: 0 });
  deck(g, 0, 0, width, length, 0, height, [ramp, ramp]);
  return g;
}

export function buildMarket(ctx) {
  const { rng } = ctx;
  ctx.place(bridge(18, 6, .8, true), 0, -10);
  ctx.place(bridge(18, 3.6), -60, -8);
  ctx.place(bridge(18, 3.6), 62, -8);
  // The great market pavilion: the landmark at the heart of the city.
  const pavilion = sala(rng, { w: 16, d: 11, h: 3.4, tiers: 3, base: .5, roof: M.tile });
  for (let i = 0; i < 6; i++) prop(pavilion, 'sack', -5 + (i % 3) * .8, .5 + (i > 2 ? .4 : 0), -2.5, { ry: i });
  for (let i = 0; i < 5; i++) prop(pavilion, 'fruitBasket', 2 + i * .9, .5, 2.6, { color: ['#d6a23c', '#8fae45', '#c8572f', '#e2c25a', '#6f9a3c'][i] });
  for (let i = 0; i < 4; i++) prop(pavilion, 'jar', -5.5 + i * .9, .5, 2.8, { s: .8 });
  for (const x of [-5.5, 0, 5.5]) for (const z of [-4.5, 4.5]) box(pavilion, M.darkWood, x, 3.65, z, .02, .4, .02);
  for (const x of [-5.5, 0, 5.5]) for (const z of [-4.5, 4.5]) glow(pavilion, x, 3.3, z, 1.4);
  for (const x of [-5.5, 0, 5.5]) for (const z of [-4.5, 4.5]) cyl(pavilion, M.lantern, x, 3.3, z, .14, .14, .34, 8);
  ctx.place(pavilion, CENTER.x, CENTER.z);

  // Named stalls between the pavilion and the walking ring.
  const inner = [['weapons', -11.6, 20.5, -Math.PI / 2], ['armor', -11.6, 28, -Math.PI / 2], ['charms', -11.6, 35.5, -Math.PI / 2],
    ['fruit', 11.6, 20.5, Math.PI / 2], ['veg', 11.6, 28, Math.PI / 2], ['rice', 11.6, 35.5, Math.PI / 2],
    ['pottery', -5, 17, Math.PI], ['cloth', 5, 17, Math.PI], ['lanterns', -5, 39, 0], ['herbs', 5, 39, 0]];
  for (const [kind, x, z, rot] of inner) addStall(ctx, kind, x, z, rot, `stall_${kind}`);
  // Outer stalls follow the plaza edge and face inward.
  const kinds = ['fruit', 'cloth', 'pottery', 'veg', 'lanterns', 'rice', 'fish', 'herbs'];
  let n = 0;
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 16) {
    const x = CENTER.x + Math.cos(a) * 26.6, z = CENTER.z + Math.sin(a) * 20.8;
    if (ringDistance(x, z) < 3 || Math.min(...RING_NODES.map(id => Math.hypot(J[id][0] - x, J[id][1] - z))) < 4.5) continue;
    addStall(ctx, kinds[n % kinds.length], x, z, Math.atan2(CENTER.x - x, CENTER.z - z), `stall_o${n++}`);
  }

  // Shophouse rows wrap the square, angled to its curve.
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 14) {
    const x = CENTER.x + Math.cos(a) * 35.5, z = CENTER.z + Math.sin(a) * 29.5, rot = Math.atan2(CENTER.x - x, CENTER.z - z);
    const units = rng.chance(.5) ? 3 : 2;
    if (!ctx.occ.rectFree(x, z, units * 3.6 + .6, 6, rot, .4)) continue;
    const goods = Array.from({ length: units }, () => [{ name: rng.pick(['jar', 'basket', 'sack', 'crate', 'pot']), x: rng.range(-1, 1) }, { name: rng.pick(['fruitBasket', 'basket', 'pot']), x: rng.range(-1, 1), color: rng.pick(['#d6a23c', '#8fae45', '#c8572f']) }]);
    ctx.place(shophouseRow(rng, units, { goods }), x, z, rot);
  }
  const lamps = structure(null);
  for (const id of RING_NODES) { const [x, z] = J[id], k = 1 + 2.4 / Math.hypot(x - CENTER.x, z - CENTER.z); lanternPost(lamps, CENTER.x + (x - CENTER.x) * k, CENTER.z + (z - CENTER.z) * k); }
  ctx.place(lamps, 0, 0);

  // City pillar shrine (ศาลหลักเมือง) beside the central plaza.
  const L = landmark('city_pillar');
  const shrine = sala(rng, { w: 4.4, d: 4.4, h: 2.8, tiers: 2, base: .6, roof: M.tileOrange, columns: M.plaster });
  const spire = [[3.2, .9], [2.4, .7], [1.6, .55], [1, .42]];
  spire.forEach(([y0, r], i) => cyl(shrine, M.goldBright, 0, 3.4 + y0 + i * .3, 0, r * .8, r, .55, 8));
  cone(shrine, M.goldBright, 0, 8.6, 0, .32, 1.8, 8);
  cyl(shrine, M.woodRed, 0, 1.8, 0, .28, .3, 2.4, 12); cyl(shrine, M.goldBright, 0, 3.1, 0, .2, .3, .4, 12); ball(shrine, M.goldBright, 0, 3.4, 0, .2);
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; prop(shrine, 'flower', Math.cos(a) * .45, .5, Math.sin(a) * .45, { color: i % 2 ? '#e7c54a' : '#e9e2c9', s: 1.3 }); }
  for (let i = 0; i < 5; i++) prop(shrine, 'candle', -.6 + i * .3, .6, 1.4);
  glow(shrine, 0, .9, 1.4, 1.6, '#ffc46a', 'candle'); post(shrine, 0, 0, .45);
  ctx.place(shrine, L.x, L.z);
  ctx.spot('pillar_pray', L.x, L.z + 4.1, Math.PI, 'center');
  ctx.spot('pillar_pray2', L.x - 1.6, L.z + 4.2, Math.PI, 'center');
  const benches = structure(null);
  for (const [x, z, r] of [[-9, -24, .3], [-9, -36, -.3], [9, -24, -.3]]) { prop(benches, 'bench', x, 0, z, { ry: r }); post(benches, x, z, .6); }
  ctx.place(benches, 0, 0);
  ctx.spot('center_bench', -9, -24.6, Math.PI + .3, 'center');
}
