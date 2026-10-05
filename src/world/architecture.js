// Ayutthaya-inspired structures: brick chedi, teak sala with layered Thai
// roofs, a spirit shrine and crumbling temple walls.
import * as THREE from 'three';
import { random, range } from './rng.js';
import { materials } from './materials.js';
import { mesh, box, cylinder } from './geometry.js';
import { obstacles } from './state.js';
import { landmarkById } from './data/landmarks.js';
import { ruins as ruinData } from './data/scenery.js';

const blockLandmark = l => obstacles.push({ x: l.x, z: l.z, radius: l.obstacleRadius });

export function makeChedi(scene, landmark = landmarkById('old-chedi')) {
  const group = new THREE.Group(); group.position.set(landmark.x, .02, landmark.z); scene.add(group);
  // Raised brick plinth, weathered terraces and a bell-shaped stupa.
  box(group, materials.brick, 0, .2, 0, 4.8, .4, 4.8);
  box(group, materials.stone, 0, .48, 0, 4.2, .16, 4.2);
  box(group, materials.brick, 0, .73, 0, 3.75, .4, 3.75);
  box(group, materials.sandstone, 0, .99, 0, 3.85, .12, 3.85);
  cylinder(group, materials.sandstone, 0, 1.15, 0, 1.6, 1.8, .25, 32);
  const profile = [[0, 1.23], [1.48, 1.23], [1.5, 1.35], [1.36, 1.43], [1.25, 1.52], [1.22, 1.75], [1.13, 2], [.92, 2.38], [.7, 2.72], [.53, 2.85], [.48, 2.95], [.45, 3.05]];
  mesh(new THREE.LatheGeometry(profile.map(([x, y]) => new THREE.Vector2(x, y)), 32), materials.sandstone, group);
  box(group, materials.sandstone, 0, 3.15, 0, .7, .28, .7);
  for (let i = 0; i < 8; i++) cylinder(group, i % 2 ? materials.sandstone : materials.stone, 0, 3.4 + i * .15, 0, .37 - i * .037, .42 - i * .039, .15, 20);
  cylinder(group, materials.gold, 0, 4.95, 0, .012, .12, 1.05, 12);
  for (let i = 0; i < 5; i++) box(group, materials.brick, 0, .1 + i * .1, 2.6 - i * .16, 1.4, .2, .5);
  // Exposed joints and scattered fallen bricks.
  for (let i = 0; i < 45; i++) {
    const side = i % 4, a = range(-2.25, 2.25), y = i % 3 === 0 ? .12 : .3;
    const b = side < 2 ? box(group, materials.darkWood, a, y, side === 0 ? 2.405 : -2.405, .022, .12, .01) : box(group, materials.darkWood, side === 2 ? 2.405 : -2.405, y, a, .01, .12, .022);
    b.castShadow = false;
  }
  for (let i = 0; i < 22; i++) {
    const x = range(-3.5, 3.5), z = range(-3.5, 3.5); if (Math.abs(x) < 2.6 && Math.abs(z) < 2.6) continue;
    const brick = box(group, materials.brick, x, .08, z, .38, .17, .22); brick.rotation.y = random() * 6;
  }
  for (const [x, z] of [[-2.8, -1.5], [2.8, -1.5]]) {
    cylinder(group, materials.stone, x, .55, z, .22, .3, 1, 8);
    mesh(new THREE.SphereGeometry(.2, 8, 6), materials.sandstone, group, x, 1.2, z);
  }
  blockLandmark(landmark);
  return group;
}

/** Steep Thai gable roof with upswept eaves, gilded bargeboards and finials. */
export function thaiRoof(parent, width, depth, y, material) {
  const vertices = [], indices = [];
  // Curving eaves and a steep ridge; cross-section is mirrored.
  const cross = [[-width / 2, 0.22], [-width * .38, 0], [-width * .19, .55], [0, 1.65], [width * .19, .55], [width * .38, 0], [width / 2, .22]];
  for (const z of [-depth / 2, depth / 2]) for (const [x, h] of cross) vertices.push(x, y + h, z);
  for (let i = 0; i < 6; i++) indices.push(i, i + 1, i + 7, i + 1, i + 8, i + 7);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); g.setIndex(indices); g.computeVertexNormals();
  const roof = mesh(g, material, parent); roof.material.side = THREE.DoubleSide;
  for (const end of [-depth / 2, depth / 2]) {
    const curve = new THREE.CatmullRomCurve3(cross.map(([x, h]) => new THREE.Vector3(x, y + h + .045, end)));
    mesh(new THREE.TubeGeometry(curve, 24, .05, 5, false), materials.gold, parent);
    const finial = new THREE.CatmullRomCurve3([new THREE.Vector3(0, y + 1.55, end), new THREE.Vector3(0, y + 1.85, end + Math.sign(end) * .13), new THREE.Vector3(0, y + 2.22, end + Math.sign(end) * .26)]);
    mesh(new THREE.TubeGeometry(finial, 12, .065, 5, false), materials.gold, parent);
  }
  for (let z = -depth / 2 + .14; z < depth / 2; z += .24) {
    const curve = new THREE.CatmullRomCurve3(cross.map(([x, h]) => new THREE.Vector3(x, y + h + .015, z)));
    const seam = mesh(new THREE.TubeGeometry(curve, 14, .015, 3, false), materials.roof, parent); seam.castShadow = false;
  }
}

export function makePavilion(scene, landmark = landmarkById('canal-pavilion')) {
  const { x: px, z: pz } = landmark;
  const group = new THREE.Group(); group.position.set(px, 0, pz); scene.add(group);
  box(group, materials.wood, 0, .7, 0, 4.2, .24, 3.7);
  for (const x of [-1.7, 1.7]) for (const z of [-1.4, 1.4]) {
    box(group, materials.darkWood, x, 1.8, z, .18, 3.6, .18);
    box(group, materials.gold, x, 3.1, z, .21, .12, .21);
  }
  for (let x = -2; x < 2; x += .23) box(group, materials.darkWood, x, .83, 0, .018, .015, 3.6);
  for (const z of [-1.45, 1.45]) {
    box(group, materials.wood, 0, 1.35, z, 3.5, .09, .09);
    for (let x = -1.7; x < 1.8; x += .35) if (!(z > 0 && Math.abs(x) < .6)) box(group, materials.wood, x, 1.1, z, .055, .55, .055);
  }
  thaiRoof(group, 5.1, 4.7, 3.15, materials.tile);
  thaiRoof(group, 3.6, 3.5, 4.05, materials.roof);
  for (let i = 0; i < 4; i++) box(group, materials.wood, 0, .12 + i * .17, 2.1 - i * .15, 1.25, .2, .45);
  // Pier leading east towards the lotus canal.
  for (let i = 0; i < 17; i++) box(scene, materials.wood, px + 2 + i * .25, .65, pz, .22, .14, 1.35);
  for (const x of [2, 4, 6]) for (const z of [-.55, .55]) box(scene, materials.darkWood, px + x, .5, pz + z, .12, 1, .12);
  blockLandmark(landmark);
  return group;
}

export function makeShrine(scene, landmark = landmarkById('forest-shrine')) {
  const g = new THREE.Group(); g.position.set(landmark.x, 0, landmark.z); scene.add(g);
  cylinder(g, materials.stone, 0, .65, 0, .28, .38, 1.3, 8);
  box(g, materials.wood, 0, 1.4, 0, 1.5, .15, 1.3);
  box(g, materials.brick, 0, 1.8, -.25, 1.1, .8, .8);
  box(g, materials.darkWood, 0, 1.8, .17, .32, .48, .02);
  thaiRoof(g, 1.9, 1.7, 2.17, materials.tile);
  for (const x of [-.6, .6]) box(g, materials.wood, x, 1.85, .48, .09, .85, .09);
  for (let i = 0; i < 3; i++) cylinder(g, materials.gold, -.3 + i * .28, 1.57, .48, .05, .06, .12, 8);
  blockLandmark(landmark);
  return g;
}

export function makeRuins(scene) {
  const d = ruinData;
  for (const [x, z, length, rotation] of d.walls) {
    const wall = new THREE.Group(); wall.position.set(x, 0, z); wall.rotation.y = rotation; scene.add(wall);
    for (let row = 0; row < d.rows; row++) for (let col = 0; col < Math.floor(length / d.brickPitch); col++) {
      if (random() < row * d.missingPerRow) continue;
      box(wall, random() > d.mossChance ? materials.brick : materials.moss, -length / 2 + col * d.brickPitch + (row % 2) * .22, .12 + row * .24, 0, .49, .21, .5);
    }
    for (let i = 0; i < d.rubblePerWall; i++) { const b = box(wall, materials.brick, range(-length / 2, length / 2), .08, range(-.9, .9), .4, .16, .23); b.rotation.y = random() * 6; }
    // Broken walls also block movement, matching their visible layout.
    for (let offset = -length / 2; offset < length / 2; offset += d.obstacleStep) obstacles.push({ x: x + Math.cos(rotation) * offset, z: z - Math.sin(rotation) * offset, radius: d.obstacleRadius });
  }
}
