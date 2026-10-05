import * as THREE from 'three';
import { random, range, between } from './rng.js';
import { mat, materials } from './materials.js';
import { mesh, cylinder, branchBetween } from './geometry.js';
import { windMaterial } from './wind.js';
import { groundHeight, pathX, inWater, nearLandmark } from './terrainMath.js';
import { obstacles, treePositions, animations } from './state.js';
import { grass as grassData, trees as treeData, bamboo as bambooData, rocks as rockData } from './data/vegetation.js';
import { palette } from './data/palette.js';

const inRect = (x, z, r) => z > r.minZ && z < r.maxZ && x > r.minX && x < r.maxX;

export function makeGrass(scene) {
  const d = grassData;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([-.06, 0, 0, .06, 0, 0, -.038, .23, .01, .038, .23, .01, .035, .49, .04], 3));
  geometry.setIndex([0, 1, 2, 1, 3, 2, 2, 3, 4]); geometry.computeVertexNormals();
  const material = windMaterial(mat(palette.grass, { side: THREE.DoubleSide }), d.windAmplitude, true);
  const grass = new THREE.InstancedMesh(geometry, material, d.count);
  const dummy = new THREE.Object3D(), color = new THREE.Color(); let n = 0;
  for (let i = 0; i < d.count; i++) {
    const x = between(d.xRange), z = between(d.zRange);
    if (inWater(x, z) || Math.abs(x - pathX(z)) < d.pathClearance || nearLandmark(x, z, d.landmarkPadding)) continue;
    if (d.clearings.some(r => inRect(x, z, r))) continue;
    dummy.position.set(x, groundHeight(x, z), z); dummy.rotation.y = range(0, Math.PI * 2);
    const s = between(d.scale); dummy.scale.set(s, s * between(d.heightScale), s); dummy.updateMatrix(); grass.setMatrixAt(n, dummy.matrix);
    color.setHSL(between(d.hue), between(d.saturation), between(d.lightness)); grass.setColorAt(n++, color);
  }
  grass.count = n; grass.receiveShadow = true; grass.frustumCulled = false; scene.add(grass);
  return grass;
}

function foliageTexture() {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d');
  for (let i = 0; i < 210; i++) {
    const angle = random() * Math.PI * 2, r = Math.sqrt(random()) * 94;
    const x = 128 + Math.cos(angle) * r, y = 128 + Math.sin(angle) * r;
    const brightness = Math.floor(range(145, 235));
    ctx.save(); ctx.translate(x, y); ctx.rotate(range(-Math.PI, Math.PI));
    ctx.fillStyle = `rgb(${brightness},${Math.min(255, brightness + 14)},${Math.floor(brightness * .75)})`;
    ctx.beginPath(); ctx.ellipse(0, 0, range(8, 17), range(4, 9), 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = palette.foliageVein; ctx.lineWidth = .7; ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(8, 0); ctx.stroke(); ctx.restore();
  }
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; return texture;
}

function treeLayout() {
  const r = treeData.random, positions = treeData.fixed.map(p => [...p]);
  for (let i = 0; i < r.attempts; i++) {
    const x = between(r.xRange), z = between(r.zRange);
    if (Math.abs(x - pathX(z)) > r.minPathDistance && !inWater(x, z) && !nearLandmark(x, z, r.landmarkPadding) && Math.hypot(x, z) > r.minCenterDistance) positions.push([x, z]);
  }
  return positions;
}

function makeTree(scene, foliage, start, x, z, index) {
  const d = treeData, dummy = new THREE.Object3D(), color = new THREE.Color(); let count = start;
  const s = between(d.scale), h = between(d.height) * s, y = groundHeight(x, z);
  treePositions.push({ x, z, radius: d.canopyRadius * s }); obstacles.push({ x, z, radius: d.trunkRadius * s });
  const tree = new THREE.Group(); tree.position.set(x, y, z); scene.add(tree);
  const trunk = cylinder(tree, materials.bark, 0, h * .38, 0, .19 * s, .43 * s, h * .76, 8);
  trunk.rotation.z = range(-.07, .07);
  for (let root = 0; root < d.roots; root++) {
    const angle = root * Math.PI * .4 + random();
    branchBetween(tree, [Math.cos(angle) * .8 * s, .06, Math.sin(angle) * .8 * s], [0, .7 * s, 0], .16 * s);
  }
  for (let b = 0; b < d.branches; b++) {
    const angle = b / d.branches * Math.PI * 2 + range(-.3, .3), reach = range(1.1, 2.1) * s;
    branchBetween(tree, [0, h * .47, 0], [Math.cos(angle) * reach, h * .8, Math.sin(angle) * reach], .12 * s);
  }
  // Clustered small crowns read as broadleaf trees rather than stacked cones.
  for (let j = 0; j < d.leavesPerTree; j++) {
    const angle = random() * Math.PI * 2, r = Math.sqrt(random()) * 2.3 * s;
    dummy.position.set(x + Math.cos(angle) * r, y + h + range(-.9, .6) * s - r * .22, z + Math.sin(angle) * r);
    dummy.rotation.set(-.72 + range(-.12, .12), .60 + range(-.12, .12), range(-Math.PI, Math.PI));
    const size = range(.65, 1.15) * s; dummy.scale.set(size * 1.1, size, size); dummy.updateMatrix();
    foliage.setMatrixAt(count, dummy.matrix);
    color.setHSL(between(d.leafHue), between(d.leafSaturation), between(d.leafLightness) + (index % 3 === 0 ? .045 : 0)); foliage.setColorAt(count++, color);
  }
  animations.push({ object: tree, phase: random() * 6, strength: d.swayStrength });
  return count;
}

function makeBambooGrove(scene, foliage, start, x, z) {
  const d = bambooData, dummy = new THREE.Object3D(), leafColor = new THREE.Color(palette.bambooLeaf);
  const stalkMaterial = mat(palette.bambooStalk); let count = start;
  const grove = new THREE.Group(); grove.position.set(x, 0, z); scene.add(grove);
  for (let b = 0; b < d.stalksPerGrove; b++) {
    const bx = range(-.6, .6), bz = range(-.6, .6), h = between(d.height);
    cylinder(grove, stalkMaterial, bx, h / 2, bz, .045, .065, h, 5);
    for (let ring = .4; ring < h; ring += .48) cylinder(grove, materials.moss, bx, ring, bz, .073, .073, .035, 5);
    for (let j = 0; j < d.leavesPerStalk; j++) {
      dummy.position.set(x + bx + range(-.7, .7), h * .65 + range(0, h * .4), z + bz + range(-.7, .7));
      dummy.scale.set(.55, .13, .22); dummy.rotation.set(0, range(0, 6), range(-.8, .8)); dummy.updateMatrix();
      foliage.setMatrixAt(count, dummy.matrix); foliage.setColorAt(count++, leafColor);
    }
  }
  animations.push({ object: grove, phase: range(0, 6), strength: d.swayStrength });
  return count;
}

export function makeTrees(scene) {
  const leafGeo = new THREE.PlaneGeometry(2.5, 2.5);
  const leafMaterial = windMaterial(mat('#ffffff', { map: foliageTexture(), alphaTest: .45, side: THREE.DoubleSide }), treeData.windAmplitude, true);
  const foliage = new THREE.InstancedMesh(leafGeo, leafMaterial, treeData.maxLeafInstances);
  foliage.castShadow = true; foliage.receiveShadow = true;
  let count = 0;
  treeLayout().forEach(([x, z], index) => { count = makeTree(scene, foliage, count, x, z, index); });
  foliage.count = count; scene.add(foliage);
  for (const [x, z] of bambooData.groves) count = makeBambooGrove(scene, foliage, count, x, z);
  foliage.count = count; foliage.instanceMatrix.needsUpdate = true;
}

export function makeRocks(scene) {
  const d = rockData, geometry = new THREE.DodecahedronGeometry(1, 0);
  const rockMaterials = palette.rocks.map(color => mat(color, { flatShading: true }));
  for (let i = 0; i < d.attempts; i++) {
    const x = between(d.xRange), z = between(d.zRange);
    if (Math.abs(x - pathX(z)) < d.pathClearance || nearLandmark(x, z, d.landmarkPadding)) continue;
    const size = between(d.size);
    const rock = mesh(geometry, rockMaterials[i % rockMaterials.length], scene, x, size * .35, z, [size * 1.3, size * .7, size]);
    rock.rotation.set(range(-.3, .3), random() * 6, range(-.3, .3));
    obstacles.push({ x, z, radius: size * .9 });
    if (i % d.mossEvery === 0) mesh(geometry, materials.moss, scene, x - .12, size * .65, z, [size * .75, size * .12, size * .7]);
  }
}
