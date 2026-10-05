import * as THREE from 'three';
import { random, range, between } from './rng.js';
import { mat } from './materials.js';
import { mesh } from './geometry.js';
import { groundHeight, pathX } from './terrainMath.js';
import { terrain, terrainTexture as tex } from './data/terrain.js';
import { palette } from './data/palette.js';

function paintGroundTexture() {
  const res = tex.resolution, size = terrain.size, half = size / 2;
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = res;
  const ctx = canvas.getContext('2d'); ctx.fillStyle = palette.terrainBase; ctx.fillRect(0, 0, res, res);
  for (let i = 0; i < tex.speckles; i++) {
    const shade = Math.floor(between(tex.speckleShade));
    ctx.fillStyle = `rgba(${shade + 16},${shade + 24},${Math.floor(shade * .66)},${between(tex.speckleAlpha)})`;
    ctx.beginPath(); ctx.ellipse(range(0, res), range(0, res), between(tex.speckleRadiusX), between(tex.speckleRadiusY), random() * Math.PI, 0, Math.PI * 2); ctx.fill();
  }
  // Dirt meanders through the glade, with soft irregular edges and branch trails.
  const px = x => (x / size + .5) * res, pz = z => (z / size + .5) * res;
  const layers = palette.pathLayers, last = layers.length - 1;
  const drawPath = (points, width) => {
    for (let layer = 0; layer < layers.length; layer++) {
      ctx.strokeStyle = layers[layer];
      ctx.lineWidth = width + (last - layer) * 9; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath();
      points.forEach(([x, z], i) => i ? ctx.lineTo(px(x), pz(z)) : ctx.moveTo(px(x), pz(z))); ctx.stroke();
    }
  };
  const n = tex.mainPath.points;
  drawPath(Array.from({ length: n }, (_, i) => { const z = -half + i * size / (n - 1); return [pathX(z), z]; }), tex.mainPath.width);
  for (const side of tex.sidePaths) drawPath([[pathX(side.fromZ), side.fromZ], ...side.points], side.width);
  const spread = tex.pathSpeckleSpread;
  for (let i = 0; i < tex.pathSpeckles; i++) {
    const z = between(tex.pathSpeckleZ), x = pathX(z) + range(-spread, spread);
    ctx.fillStyle = random() > .5 ? palette.pathSpeckles[0] : palette.pathSpeckles[1];
    ctx.fillRect(px(x), pz(z), range(1, 4), range(1, 3));
  }
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 8;
  return texture;
}

export function makeTerrain(scene) {
  const geometry = new THREE.PlaneGeometry(terrain.size, terrain.size, terrain.segments, terrain.segments);
  geometry.rotateX(-Math.PI / 2);
  const p = geometry.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, groundHeight(p.getX(i), p.getZ(i)));
  geometry.computeVertexNormals();
  const material = mat('#ffffff', { map: paintGroundTexture() });
  const ground = mesh(geometry, material, scene); ground.castShadow = false;
  return ground;
}
