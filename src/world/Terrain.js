import * as THREE from 'three';
import {
  BOUNDS, ROADS, PLAZAS, PADDIES, CHANNELS, CANAL, STREAM, POND, CEMETERY,
  roadPoints, terrainHeight, waterAt, riverBank, farBank, wildness, insideWalls,
} from './CityMap.js';
import { createRng } from './rng.js';

const W = BOUNDS.maxX - BOUNDS.minX, H = BOUNDS.maxZ - BOUNDS.minZ;
const span = rect => ({ x0: rect.minX, z0: rect.minZ, w: rect.maxX - rect.minX, h: rect.maxZ - rect.minZ });

// Height and water sampled once on a 1-unit grid over `rect` (one map's built
// extent); queries are bilinear lookups. Outside the grid the analytic shape in
// CityMap.js answers, so builders may still ask about the neighbouring map.
export class TerrainData {
  constructor(rect = BOUNDS) {
    this.rect = rect; const { x0, z0, w, h } = span(rect);
    Object.assign(this, { x0, z0, w, h });
    this.gw = w + 1; this.gh = h + 1;
    this.heights = new Float32Array(this.gw * this.gh); this.deep = new Float32Array(this.gw * this.gh); this.shallow = new Uint8Array(this.gw * this.gh);
    for (let j = 0; j < this.gh; j++) for (let i = 0; i < this.gw; i++) {
      const x = x0 + i, z = z0 + j, k = j * this.gw + i, water = waterAt(x, z);
      this.heights[k] = terrainHeight(x, z); this.deep[k] = water === 2 ? 1 : 0; this.shallow[k] = water === 1 ? 1 : 0;
    }
  }
  inside(x, z) { return x >= this.x0 && x <= this.x0 + this.w && z >= this.z0 && z <= this.z0 + this.h; }
  sample(array, x, z) {
    const fx = Math.min(Math.max(x - this.x0, 0), this.w - .001), fz = Math.min(Math.max(z - this.z0, 0), this.h - .001);
    const i = Math.floor(fx), j = Math.floor(fz), tx = fx - i, tz = fz - j, k = j * this.gw + i;
    const a = array[k] + (array[k + 1] - array[k]) * tx, b = array[k + this.gw] + (array[k + this.gw + 1] - array[k + this.gw]) * tx;
    return a + (b - a) * tz;
  }
  height(x, z) { return this.inside(x, z) ? this.sample(this.heights, x, z) : terrainHeight(x, z); }
  isDeep(x, z) { return this.inside(x, z) ? this.sample(this.deep, x, z) > .5 : waterAt(x, z) === 2; }
  isShallow(x, z) { return this.inside(x, z) ? this.shallow[Math.round(z - this.z0) * this.gw + Math.round(x - this.x0)] === 1 : waterAt(x, z) === 1; }
}

// 1-unit occupancy grid used while laying out the city so procedural buildings,
// trees and props never land on roads, water or each other.
export const OCC = { FREE: 0, ROAD: 1, BUILDING: 2, WATER: 3, PADDY: 4, OPEN: 5, YARD: 6 };
export class Occupancy {
  constructor() { this.cells = new Uint8Array(W * H); }
  index(x, z) {
    const i = Math.floor(x - BOUNDS.minX), j = Math.floor(z - BOUNDS.minZ);
    return i < 0 || j < 0 || i >= W || j >= H ? -1 : j * W + i;
  }
  get(x, z) { const i = this.index(x, z); return i < 0 ? 255 : this.cells[i]; }
  forRect(x, z, w, d, rot, pad, fn) {
    const c = Math.cos(rot), s = Math.sin(rot), hw = w / 2 + pad, hd = d / 2 + pad, R = Math.hypot(hw, hd);
    for (let cz = Math.floor(z - R); cz <= z + R; cz++) for (let cx = Math.floor(x - R); cx <= x + R; cx++) {
      const dx = cx + .5 - x, dz = cz + .5 - z;
      if (Math.abs(dx * c - dz * s) <= hw && Math.abs(dx * s + dz * c) <= hd) { const i = this.index(cx + .5, cz + .5); if (fn(i) === false) return false; }
    }
    return true;
  }
  markRect(x, z, w, d, rot, value, pad = 0) { this.forRect(x, z, w, d, rot, pad, i => { if (i >= 0 && this.cells[i] < value) this.cells[i] = value; }); }
  rectFree(x, z, w, d, rot = 0, pad = 0, allowYard = false) {
    return this.forRect(x, z, w, d, rot, pad, i => i >= 0 && (this.cells[i] === OCC.FREE || (allowYard && this.cells[i] === OCC.YARD)));
  }
  markPolyline(pts, half, value) {
    for (let k = 1; k < pts.length; k++) {
      const [ax, az] = pts[k - 1], [bx, bz] = pts[k], len = Math.hypot(bx - ax, bz - az), rot = Math.atan2(bx - ax, bz - az);
      this.markRect((ax + bx) / 2, (az + bz) / 2, half * 2, len + half * 2, rot, value);
    }
  }
  markEllipse(x, z, rx, rz, value) {
    for (let cz = Math.floor(z - rz); cz <= z + rz; cz++) for (let cx = Math.floor(x - rx); cx <= x + rx; cx++) {
      if (((cx + .5 - x) / rx) ** 2 + ((cz + .5 - z) / rz) ** 2 <= 1) { const i = this.index(cx + .5, cz + .5); if (i >= 0 && this.cells[i] < value) this.cells[i] = value; }
    }
  }
}

export function seedOccupancy(occ) {
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const w = waterAt(BOUNDS.minX + i + .5, BOUNDS.minZ + j + .5);
    if (w) occ.cells[j * W + i] = w === 2 ? OCC.WATER : OCC.PADDY;
  }
  // Keep a margin along the river and canal banks.
  for (let x = BOUNDS.minX; x < BOUNDS.maxX; x++) occ.markRect(x + .5, riverBank(x) - .5, 1, 3, 0, OCC.OPEN);
  occ.markPolyline(CANAL.pts, CANAL.half + 1.5, OCC.OPEN);
  for (const road of ROADS) occ.markPolyline(roadPoints(road), road.w / 2 + (road.kind === 'trail' ? .5 : 1), OCC.ROAD);
  for (const p of PLAZAS) {
    if (p.kind === 'temple' || p.kind === 'grave') continue;
    // Rect plazas (the training-hall yards; world-designer hook) reserve their whole rectangle.
    if (p.rect) occ.markRect(p.x, p.z, p.rx * 2, p.rz * 2, 0, OCC.ROAD);
    else occ.markEllipse(p.x, p.z, p.rx, p.rz, OCC.ROAD);
  }
}

// ---------- Ground painting ----------
const COLOR_SCALE = 4, MASK_SCALE = 2;
const ROAD_STYLES = {
  road: ['#9b9c7040', '#b0a77c55', '#b5a97c70', '#c3b58b98', '#cdbd92', '#c9b88e'],
  plaza: ['#c5b38c60', '#c9b78f'],
  paved: ['#8f7f6240', '#a8917055', '#b49c79', '#c0a885', '#c8b18e', '#c3aa86'],
  bund: ['#7f915840', '#8e9c6455', '#9aa46d', '#a6aa76'],
  trail: ['#4b513a40', '#5a5a4255', '#67614a80', '#736a50b0'],
};
// Stops are laid out over the whole world so every map gets the same colours.
function gradientByZ(ctx, pz, stops) {
  const g = ctx.createLinearGradient(0, pz(BOUNDS.minZ), 0, pz(BOUNDS.maxZ));
  for (const [z, color] of stops) g.addColorStop((z - BOUNDS.minZ) / H, color);
  return g;
}

// `extent` is the painted area (one map's view). Random detail is drawn from the
// same sequence for every map, so the ground matches across the seam.
export function paintGround(footprints, extent = BOUNDS) {
  const rng = createRng(90210), { x0, z0, w: RW, h: RH } = span(extent);
  const canvas = document.createElement('canvas'); canvas.width = RW * COLOR_SCALE; canvas.height = RH * COLOR_SCALE;
  const ctx = canvas.getContext('2d'), S = COLOR_SCALE;
  const px = x => (x - x0) * S, pz = z => (z - z0) * S;
  const near = (x, z, m = 16) => x > x0 - m && x < x0 + RW + m && z > z0 - m && z < z0 + RH + m;
  const line = (pts, width, style) => {
    ctx.strokeStyle = style; ctx.lineWidth = width * S; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath();
    pts.forEach(([x, z], i) => (i ? ctx.lineTo(px(x), pz(z)) : ctx.moveTo(px(x), pz(z)))); ctx.stroke();
  };
  const ellipse = (x, z, rx, rz, style) => { ctx.fillStyle = style; ctx.beginPath(); ctx.ellipse(px(x), pz(z), rx * S, rz * S, 0, 0, Math.PI * 2); ctx.fill(); };
  const rect = (x, z, w, d, rot, style) => {
    ctx.save(); ctx.translate(px(x), pz(z)); ctx.rotate(-rot); ctx.fillStyle = style; ctx.fillRect(-w / 2 * S, -d / 2 * S, w * S, d * S); ctx.restore();
  };

  ctx.fillStyle = gradientByZ(ctx, pz, [
    [-610, '#30392c'], [-480, '#38432f'], [-410, '#3f4c35'], [-360, '#4d5d3f'], [-310, '#61734a'], [-280, '#768751'],
    [-250, '#7c8c55'], [-120, '#7b8b56'], [-104, '#7e8a57'], [150, '#83895a'], [268, '#7f8a5b'],
  ]);
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < 60000; i++) {
    const x = rng.range(BOUNDS.minX, BOUNDS.maxX), z = rng.range(BOUNDS.minZ, BOUNDS.maxZ), w = wildness(z);
    const style = rng() > .5 ? `rgba(255,250,215,${rng.range(.03, .09) * (1 - w * .6)})` : `rgba(28,36,18,${rng.range(.04, .12)})`;
    const rx = rng.range(1, 14), ry = rng.range(1, 6), rot = rng() * Math.PI;
    if (!near(x, z, 4)) continue;
    ctx.fillStyle = style; ctx.beginPath(); ctx.ellipse(px(x), pz(z), rx, ry, rot, 0, Math.PI * 2); ctx.fill();
  }
  // Forest floor: leaf litter and darker hollows.
  for (let i = 0; i < 26000; i++) {
    const x = rng.range(BOUNDS.minX, BOUNDS.maxX), z = rng.range(BOUNDS.minZ, -290);
    const style = rng() > .4 ? `rgba(${110 + rng() * 40},${80 + rng() * 30},${40 + rng() * 20},.22)` : 'rgba(18,24,14,.18)';
    const w = rng.range(1, 4), h = rng.range(1, 3);
    if (!near(x, z, 2)) continue;
    ctx.fillStyle = style; ctx.fillRect(px(x), pz(z), w, h);
  }
  // Worn, dusty ground around city streets.
  for (const road of ROADS) {
    const pts = roadPoints(road);
    if (road.kind !== 'trail' && road.kind !== 'bridge' && insideWalls(pts[0][0], pts[0][1])) line(pts, road.w + 6, '#a39a7120');
  }
  // River banks, far shore and canal embankments.
  const bank = [], far = [];
  for (let x = BOUNDS.minX - 4; x <= BOUNDS.maxX + 4; x += 2) { bank.push([x, riverBank(x) - 1.5]); far.push([x, farBank(x) + 1.5]); }
  line(bank, 9, '#b8a98088'); line(bank, 5, '#c4b48c'); line(far, 6, '#b4a57d');
  line(CANAL.pts, CANAL.half * 2 + 3.2, '#9c937b'); line(CANAL.pts, CANAL.half * 2 + 1.4, '#857c66');
  ellipse(POND.x, POND.z, POND.rx + 1.6, POND.rz + 1.6, '#958d76');
  line(STREAM.pts, STREAM.half * 2 + 5, '#3d3b2e80'); line(STREAM.pts, STREAM.half * 2 + 2, '#4a4635');
  // Farmland, orchards and herb beds.
  for (const p of PADDIES) { rect((p.x0 + p.x1) / 2, (p.z0 + p.z1) / 2, p.x1 - p.x0 + .8, p.z1 - p.z0 + .8, 0, '#6a7448'); rect((p.x0 + p.x1) / 2, (p.z0 + p.z1) / 2, p.x1 - p.x0, p.z1 - p.z0, 0, '#56603d'); }
  for (const c of CHANNELS) line(c.pts, c.half * 2 + 1, '#5a5a40');
  for (let z = -156; z > -252; z -= 6) line([[16, z], [118, z + rng.range(-1, 1)]], 1.6, '#6b6a4466');
  for (let i = 0; i < 14; i++) rect(40 + (i % 7) * 4.2, -128 - Math.floor(i / 7) * 5.5, 3, 4, 0, '#6e5c40');
  // Cemetery ground.
  ellipse(CEMETERY.x, CEMETERY.z, CEMETERY.r + 8, CEMETERY.r + 8, '#45493d90');
  ellipse(CEMETERY.x, CEMETERY.z, CEMETERY.r, CEMETERY.r, '#4f5246');
  const cemetery = near(CEMETERY.x, CEMETERY.z, CEMETERY.r + 4);
  for (let i = 0; i < 1500; i++) {
    const a = rng() * Math.PI * 2, r = Math.sqrt(rng()) * CEMETERY.r;
    const style = rng() > .5 ? '#5d5f5240' : '#2e322950', rx = rng.range(2, 10), ry = rng.range(1, 5), rot = rng() * 3;
    if (!cemetery) continue;
    ctx.fillStyle = style; ctx.beginPath(); ctx.ellipse(px(CEMETERY.x + Math.cos(a) * r), pz(CEMETERY.z + Math.sin(a) * r), rx, ry, rot, 0, Math.PI * 2); ctx.fill();
  }
  // Plazas.
  for (const p of PLAZAS) {
    if (p.kind === 'grave') continue;
    if (p.kind === 'ruin') { if (near(p.x, p.z, Math.max(p.rx, p.rz))) paintRuin(ctx, p, px, pz, S); continue; }
    const colors = { paved: ['#b09a7470', '#b9a27e'], earth: ['#a8976e60', '#ad9b72'], temple: ['#c3b08a50', '#c6b48f'] }[p.kind];
    if (p.rect) { rect(p.x, p.z, p.rx * 2 + 2, p.rz * 2 + 2, 0, colors[0]); rect(p.x, p.z, p.rx * 2, p.rz * 2, 0, colors[1]); }
    else { ellipse(p.x, p.z, p.rx + 1.5, p.rz + 1.5, colors[0]); ellipse(p.x, p.z, p.rx, p.rz, colors[1]); }
    if (p.kind === 'paved') for (let i = 0, on = near(p.x, p.z, Math.max(p.rx, p.rz)); i < p.rx * p.rz * 3; i++) {
      const a = rng() * Math.PI * 2, r = Math.sqrt(rng()), style = rng() > .5 ? '#9f866440' : '#e2cfa540';
      if (!on) continue;
      ctx.fillStyle = style; ctx.fillRect(px(p.x + Math.cos(a) * r * p.rx), pz(p.z + Math.sin(a) * r * p.rz), S * .9, S * .45);
    }
  }
  // Roads in layers from soft verge to firm centre.
  for (const road of ROADS) {
    if (road.kind === 'bridge') continue;
    const layers = ROAD_STYLES[road.kind], pts = roadPoints(road);
    layers.forEach((style, l) => line(pts, road.w + (layers.length - 1 - l) * .9, style));
  }
  for (const f of footprints) if (f.paint) rect(f.x, f.z, f.w + 1.6, f.d + 1.6, f.rot, { earth: '#a2936c', paved: '#bba580', dark: '#5d5a4a', stone: '#a49d84' }[f.paint] + 'b0');

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 8;
  return { texture, canvas };
}

// A ruined temple site (PLAZAS kind 'ruin'): weathered laterite ground over the
// rectangle and broken brick paving in the courtyard. Its own random sequence, so
// the rest of the ground keeps its detail.
function paintRuin(ctx, p, px, pz, S) {
  const rng = createRng(4471), x0 = p.x - p.rx, z0 = p.z - p.rz;
  const blot = (x, z, rx, rz, rot, style) => { ctx.fillStyle = style; ctx.beginPath(); ctx.ellipse(px(x), pz(z), rx * S, rz * S, rot, 0, Math.PI * 2); ctx.fill(); };
  ctx.fillStyle = '#5a4a3a38'; ctx.fillRect(px(x0 - 1.5), pz(z0 - 1.5), (p.rx * 2 + 3) * S, (p.rz * 2 + 3) * S);
  ctx.fillStyle = '#6a5642'; ctx.fillRect(px(x0), pz(z0), p.rx * 2 * S, p.rz * 2 * S);
  // Leaf litter and moss creeping in from the forest.
  for (let i = 0; i < 520; i++) {
    const x = x0 + rng() * p.rx * 2, z = z0 + rng() * p.rz * 2;
    blot(x, z, rng.range(.6, 3.2), rng.range(.4, 1.8), rng() * 3, rng.pick(['#3e4a2c50', '#4c563440', '#2e352650', '#7a644a40']));
  }
  const y = p.yard;
  if (!y) return;
  blot(y.x, y.z, y.rx + 1.2, y.rz + 1.2, 0, '#7b604870');
  blot(y.x, y.z, y.rx, y.rz, 0, '#8a6c52');
  // Paving slabs: laterite and brick, many missing, grass in the cracks.
  for (let i = 0; i < 2600; i++) {
    const a = rng() * Math.PI * 2, r = Math.sqrt(rng()), x = y.x + Math.cos(a) * r * y.rx, z = y.z + Math.sin(a) * r * y.rz;
    const style = rng.pick(['#9a7458', '#a67e5e', '#8a6248', '#7a5a44', '#b08a68', '#6e5240']), w = rng.range(.5, 1.1), d = rng.range(.4, .8);
    if (rng() < .22) continue;
    ctx.fillStyle = style; ctx.fillRect(px(x - w / 2), pz(z - d / 2), w * S * .92, d * S * .92);
  }
  for (let i = 0; i < 260; i++) {
    const a = rng() * Math.PI * 2, r = Math.sqrt(rng()), x = y.x + Math.cos(a) * r * y.rx, z = y.z + Math.sin(a) * r * y.rz;
    blot(x, z, rng.range(.4, 1.6), rng.range(.3, 1), rng() * 3, rng.pick(['#4a5a3070', '#3b4a2a80', '#5b5f3a60']));
  }
}

// Grass density (R), height (G) and wildness (B) for the GPU grass field.
// Covers the terrain's own grid (`terrain.rect`).
export function buildGrassMask(terrain, footprints) {
  const { x0, z0, w: RW, h: RH } = span(terrain.rect);
  const S = MASK_SCALE, canvas = document.createElement('canvas'); canvas.width = RW * S; canvas.height = RH * S;
  // Read back on the CPU: an accelerated canvas makes getImageData very slow.
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const px = x => (x - x0) * S, pz = z => (z - z0) * S;
  ctx.fillStyle = gradientByZ(ctx, pz, [[-610, '#5a5a5a'], [-470, '#606060'], [-380, '#909090'], [-300, '#e8e8e8'], [-260, '#ffffff'], [-113, '#ffffff'], [-105, '#a8a8a8'], [160, '#ababab'], [268, '#d0d0d0']]);
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#c8c8c8'; ctx.beginPath(); ctx.ellipse(px(CEMETERY.x), pz(CEMETERY.z), CEMETERY.r * S, CEMETERY.r * S, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#000'; ctx.fillStyle = '#000'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const line = (pts, width) => { ctx.lineWidth = width * S; ctx.beginPath(); pts.forEach(([x, z], i) => (i ? ctx.lineTo(px(x), pz(z)) : ctx.moveTo(px(x), pz(z)))); ctx.stroke(); };
  for (const road of ROADS) if (road.kind !== 'bridge') line(roadPoints(road), road.w + (road.kind === 'trail' ? -.4 : .6));
  for (const p of PLAZAS) {
    if (p.kind === 'grave') continue;
    if (p.kind === 'ruin') {
      // Abandoned ground: thin grass over the whole site, sparse tufts through the old paving.
      ctx.fillStyle = '#3c3c3c'; ctx.fillRect(px(p.x - p.rx), pz(p.z - p.rz), p.rx * 2 * S, p.rz * 2 * S);
      if (p.yard) { ctx.fillStyle = '#161616'; ctx.beginPath(); ctx.ellipse(px(p.yard.x), pz(p.yard.z), p.yard.rx * S, p.yard.rz * S, 0, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = '#000';
      continue;
    }
    if (p.rect) ctx.fillRect(px(p.x - p.rx), pz(p.z - p.rz), p.rx * 2 * S, p.rz * 2 * S);
    else { ctx.beginPath(); ctx.ellipse(px(p.x), pz(p.z), p.rx * S, p.rz * S, 0, 0, Math.PI * 2); ctx.fill(); }
  }
  for (const p of PADDIES) ctx.fillRect(px(p.x0 - .2), pz(p.z0 - .2), (p.x1 - p.x0 + .4) * S, (p.z1 - p.z0 + .4) * S);
  for (const c of CHANNELS) line(c.pts, c.half * 2 + .6);
  line(CANAL.pts, CANAL.half * 2 + 1.6); line(STREAM.pts, STREAM.half * 2 + .6);
  ctx.beginPath(); ctx.ellipse(px(POND.x), pz(POND.z), (POND.rx + 1) * S, (POND.rz + 1) * S, 0, 0, Math.PI * 2); ctx.fill();
  for (const f of footprints) { ctx.save(); ctx.translate(px(f.x), pz(f.z)); ctx.rotate(-f.rot); ctx.fillRect(-(f.w / 2 + .4) * S, -(f.d / 2 + .4) * S, (f.w + .8) * S, (f.d + .8) * S); ctx.restore(); }

  const image = ctx.getImageData(0, 0, canvas.width, canvas.height).data, data = new Uint8Array(image.length);
  const banks = Float32Array.from({ length: canvas.width }, (_, i) => riverBank(x0 + (i + .5) / S) - .3);
  const { heights, deep, gw } = terrain;
  for (let j = 0; j < canvas.height; j++) {
    const z = z0 + (j + .5) / S, wild = Math.round(wildness(z) * 255), fz = z - z0, gj = Math.min(terrain.gh - 2, Math.floor(fz)), tz = fz - gj;
    for (let i = 0; i < canvas.width; i++) {
      const fx = (i + .5) / S, gi = Math.min(gw - 2, Math.floor(fx)), tx = fx - gi, k = (j * canvas.width + i) * 4, g = gj * gw + gi;
      const h = (heights[g] * (1 - tx) + heights[g + 1] * tx) * (1 - tz) + (heights[g + gw] * (1 - tx) + heights[g + gw + 1] * tx) * tz;
      data[k] = deep[Math.round(fz) * gw + Math.round(fx)] > .5 || z > banks[i] ? 0 : image[k];
      data[k + 1] = Math.round(Math.min(1, Math.max(0, (h + 3) / 6)) * 255);
      data[k + 2] = wild; data[k + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(data, canvas.width, canvas.height, THREE.RGBAFormat);
  texture.userData.rect = terrain.rect;
  texture.magFilter = texture.minFilter = THREE.LinearFilter; texture.generateMipmaps = false; texture.needsUpdate = true;
  return { texture, data, width: canvas.width, height: canvas.height, density(x, z) {
    const i = Math.floor((x - x0) * S), j = Math.floor((z - z0) * S);
    return i < 0 || j < 0 || i >= canvas.width || j >= canvas.height ? 0 : data[(j * canvas.width + i) * 4] / 255;
  } };
}

function detailTexture() {
  const rng = createRng(7), canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d'); ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2600; i++) {
    const v = Math.floor(rng.range(40, 220)), x = rng() * 256, y = rng() * 256, rx = rng.range(1, 9), ry = rng.range(1, 5), a = rng() * Math.PI;
    ctx.fillStyle = `rgba(${v},${v},${v},.35)`;
    for (const ox of [-256, 0, 256]) for (const oy of [-256, 0, 256]) { ctx.beginPath(); ctx.ellipse(x + ox, y + oy, rx, ry, a, 0, Math.PI * 2); ctx.fill(); }
  }
  const t = new THREE.CanvasTexture(canvas); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

// The ground mesh covers the terrain's grid; the detail texture is kept in
// userData so the map can be disposed completely.
export function makeGround(scene, terrain, colorTexture) {
  const { x0, z0, w: RW, h: RH } = span(terrain.rect);
  const step = 1.5, geometry = new THREE.PlaneGeometry(RW, RH, Math.round(RW / step), Math.round(RH / step));
  geometry.rotateX(-Math.PI / 2); geometry.translate(x0 + RW / 2, 0, z0 + RH / 2);
  const p = geometry.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, terrain.height(p.getX(i), p.getZ(i)));
  geometry.computeVertexNormals();
  const detail = detailTexture();
  const material = new THREE.MeshStandardMaterial({ color: '#ffffff', map: colorTexture, roughness: 1 });
  material.onBeforeCompile = shader => {
    shader.uniforms.uDetail = { value: detail };
    shader.vertexShader = 'varying vec2 vGroundXZ;\n' + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvGroundXZ = (modelMatrix * vec4(transformed, 1.0)).xz;');
    shader.fragmentShader = 'uniform sampler2D uDetail;\nvarying vec2 vGroundXZ;\n' + shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
      float dA = texture2D(uDetail, vGroundXZ * .29).r, dB = texture2D(uDetail, vGroundXZ * .061 + .37).r;
      diffuseColor.rgb *= .8 + .3 * dA + .22 * (dB - .5);`);
  };
  const ground = new THREE.Mesh(geometry, material);
  ground.userData.textures = [detail];
  ground.receiveShadow = true; ground.matrixAutoUpdate = false; scene.add(ground);
  return ground;
}

// A fixed pool of grass blades wraps around the camera focus on the GPU; the
// mask decides where blades are visible, so the field costs the same anywhere.
export function makeGrassField(scene, mask, wind) {
  const SIZE = 96, COUNT = 56000, rng = createRng(31337);
  const blade = new THREE.BufferGeometry();
  blade.setAttribute('position', new THREE.Float32BufferAttribute([-.075, 0, 0, .075, 0, 0, -.048, .23, .01, .048, .23, .01, .035, .49, .04], 3));
  blade.setIndex([0, 1, 2, 1, 3, 2, 2, 3, 4]);
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.index = blade.index; geometry.setAttribute('position', blade.attributes.position);
  const offsets = new Float32Array(COUNT * 3);
  for (let i = 0; i < COUNT; i++) { offsets[i * 3] = rng() * SIZE; offsets[i * 3 + 1] = rng() * SIZE; offsets[i * 3 + 2] = rng(); }
  geometry.setAttribute('aOffset', new THREE.InstancedBufferAttribute(offsets, 3));
  geometry.instanceCount = COUNT;
  const uniforms = {
    uCenter: { value: new THREE.Vector2() }, uSize: { value: SIZE }, uMask: { value: mask.texture },
    uMaskRect: { value: (({ x0, z0, w, h }) => new THREE.Vector4(x0, z0, w, h))(span(mask.texture.userData.rect ?? BOUNDS)) },
    uLush: { value: new THREE.Color('#4f6a22') }, uDry: { value: new THREE.Color('#6f7034') }, uWild: { value: new THREE.Color('#2a4022') },
  };
  const material = new THREE.MeshStandardMaterial({ color: '#ffffff', side: THREE.DoubleSide, roughness: 1 });
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms, wind);
    shader.vertexShader = `uniform vec2 uCenter; uniform float uSize; uniform sampler2D uMask; uniform vec4 uMaskRect; uniform float uTime; uniform float uWind;
      uniform vec3 uLush; uniform vec3 uDry; uniform vec3 uWild; attribute vec3 aOffset; varying vec3 vGrassTint;\n${shader.vertexShader}`
      .replace('#include <beginnormal_vertex>', 'vec3 objectNormal = vec3(0.0, 1.0, 0.0);')
      .replace('#include <begin_vertex>', `
        vec2 gxz = aOffset.xy + uSize * floor((uCenter - aOffset.xy) / uSize + .5);
        vec4 gm = texture2D(uMask, (gxz - uMaskRect.xy) / uMaskRect.zw);
        float rnd = aOffset.z;
        float edge = 1. - smoothstep(uSize * .36, uSize * .5, length(gxz - uCenter));
        float sc = mix(.55, 1.3, fract(rnd * 13.7)) * step(rnd, gm.r * .97) * edge;
        float ang = fract(rnd * 61.3) * 6.2832;
        vec3 bp = position * vec3(sc, sc * mix(.75, 1.6, fract(rnd * 7.31)), sc);
        bp.xz = vec2(bp.x * cos(ang) - bp.z * sin(ang), bp.x * sin(ang) + bp.z * cos(ang));
        float bend = pow(max(position.y, 0.) / .49, 1.5);
        float gust = sin(uTime * 1.35 + gxz.x * .32 + gxz.y * .24) + .4 * sin(uTime * 2.1 + gxz.y * .7);
        bp.x += gust * uWind * .22 * bend; bp.z += cos(uTime + gxz.x * .4) * uWind * .09 * bend;
        vec3 transformed = vec3(gxz.x, gm.g * 6. - 3., gxz.y) + bp;
        vec3 tone = mix(mix(uLush, uDry, smoothstep(.35, .75, fract(rnd * 3.7)) * .7), uWild, gm.b);
        vGrassTint = tone * mix(.72, 1.3, fract(rnd * 5.3)) * mix(.5, 1., position.y / .49);`);
    shader.fragmentShader = 'varying vec3 vGrassTint;\n' + shader.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= vGrassTint;')
      .replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\nnormal = normalize((viewMatrix * vec4(0., 1., 0., 0.)).xyz);');
  };
  const mesh = new THREE.Mesh(geometry, material);
  mesh.userData.textures = [mask.texture];
  mesh.frustumCulled = false; mesh.receiveShadow = true; scene.add(mesh);
  return { mesh, uniforms, update(focus) { uniforms.uCenter.value.set(focus.x, focus.z); } };
}

