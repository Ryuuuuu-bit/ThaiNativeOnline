import * as THREE from 'three';
import { M } from '../materials.js';
import { box, beam, ball, thaiRoof } from '../Architecture.js';

// Cosmetic modules stay inside the existing wall/column collision envelopes.
// Reuse the world palette so StaticBatcher can merge them with the building.
export function timberWalls(g, w, d, bottom, height, timber = M.woodLight) {
  const wall = (width, depth, rotation, x, z) => {
    const p = new THREE.Group(); p.position.set(x, bottom, z); p.rotation.y = rotation; g.add(p);
    box(p, M.darkWood, 0, height / 2, 0, width, height, depth);
    const count = Math.ceil(width / .42);
    for (let i = 0; i < count; i++) box(p, i % 4 === 0 ? M.woodPale : timber, -width / 2 + (i + .5) * width / count, height / 2, .015, width / count - .022, height - .12, depth);
    for (const y of [.12, height - .12]) box(p, M.darkWood, 0, y, .09, width + .08, .13, .14);
    for (let i = 0; i <= 2; i++) box(p, M.darkWood, (i - 1) * (width / 2 - .07), height / 2, .09, .12, height, .14);
    return p;
  };
  wall(w, .14, Math.PI, 0, -d / 2);
  for (const s of [-1, 1]) {
    const p = wall(d, .14, s * Math.PI / 2, s * w / 2, 0);
    // Dark recessed opening, thick lintel, sill and paired timber shutters.
    box(p, M.darkWood, 0, height * .55, .105, 1.55, 1.3, .08);
    for (const x of [-.83, .83]) box(p, M.wood, x, height * .55, .18, .13, 1.5, .18);
    for (const y of [-.72, .72]) box(p, M.wood, 0, height * .55 + y, .18, 1.8, .14, .22);
    for (const x of [-.58, .58]) {
      box(p, timber, x, height * .55, .23, .34, 1.22, .12, x > 0 ? -.22 : .22);
      for (let i = 0; i < 5; i++) box(p, M.darkWood, x, height * .55 - .4 + i * .2, .31, .29, .025, .02);
    }
  }
}

export function porchFrame(g, halfWidth, front, eave, floor = 0, accent = M.wood) {
  box(g, M.darkWood, 0, eave - .12, front, halfWidth * 2 + .2, .24, .24);
  for (const s of [-1, 1]) {
    box(g, M.stoneDark, s * halfWidth, floor + .1, front, .34, .2, .34);
    box(g, accent, s * halfWidth, (floor + eave) / 2, front, .2, eave - floor, .2);
    beam(g, accent, [s * halfWidth, eave - .85, front], [s * (halfWidth - .7), eave - .15, front], .065, 4);
    box(g, accent, s * halfWidth, eave - .32, front, .34, .13, .34);
  }
  for (let i = -3; i <= 3; i++) box(g, M.darkWood, i * halfWidth / 3.5, eave - .2, front - .4, .08, .13, 1.1);
}

export function shopCanopy(g, width, front, y, roof, trim = M.darkWood) {
  thaiRoof(g, { width: 1.8, depth: width, height: .36, y, z: front, ry: Math.PI / 2, material: roof, trim, gable: null, pattern: null, tips: false });
}

export function herbPlaque(g) {
  box(g, M.darkWood, 0, 3.08, 4, 1.8, .65, .12);
  box(g, M.woodPale, 0, 3.08, 4.07, 1.63, .48, .03);
  beam(g, M.moss, [0, 2.9, 4.11], [.1, 3.28, 4.11], .025, 5);
  for (const s of [-1, 1]) { const leaf = ball(g, M.moss, s * .15, 3.1, 4.12, .18, .085, .025); leaf.rotation.z = s * .4; }
}
