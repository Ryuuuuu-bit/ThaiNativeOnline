// Correct AI-painted clothing on the actual bare Meshy torso. No API calls.
// A geometry/UV mask protects the face, hands, trousers, wraps and ornaments.
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { loadRig, THREE, worldVertices } from './rig.mjs';
import { candidateDirectory, packingDependencies } from './prepare.mjs';
import { sha256 } from './glb.mjs';

const bodyFile = process.argv[2];
if (!bodyFile) throw Error('Usage: node tools/npc-models/muay-texture.mjs actual-rigged-body.glb');
const output = await candidateDirectory('artifacts/city-npc-models/muay-texture');
const rig = await loadRig(bodyFile), geometry = rig.mesh.geometry, uv = geometry.attributes.uv;
const material = rig.json.materials[0], texture = rig.json.textures[material.pbrMetallicRoughness.baseColorTexture.index];
const image = rig.json.images[texture.source], bufferView = rig.json.bufferViews[image.bufferView];
const embedded = rig.bin.subarray(bufferView.byteOffset ?? 0, (bufferView.byteOffset ?? 0) + bufferView.byteLength);
const { sharp } = packingDependencies('D:/Project/ThaiNativeOnline/tools/monster-models');
const decoded = await sharp(embedded).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const { width, height, channels } = decoded.info;
if (channels !== 3 || !uv || rig.json.meshes.length !== 1) throw Error('Expected single Meshy colour map with ordinary UVs');
const positions = worldVertices(rig), points = Array.from({ length: positions.length / 3 }, (_, i) => new THREE.Vector3().fromArray(positions, i * 3));
const box = new THREE.Box3().setFromPoints(points), h = box.max.y - box.min.y;
if (Math.abs(h - 1.72) > .02) throw Error('Inspect source height before using the metre-based torso selection');
const normalized = points.map(p => p.clone().sub(new THREE.Vector3((box.min.x + box.max.x) / 2, box.min.y, 0)));
const normalMatrix = new THREE.Matrix3().getNormalMatrix(rig.mesh.matrixWorld);
const vertexNormals = Array.from({ length: points.length }, (_, i) => new THREE.Vector3().fromBufferAttribute(geometry.attributes.normal, i).applyMatrix3(normalMatrix).normalize());
const pixel = (u, v) => (Math.min(height - 1, Math.max(0, Math.floor(v * height))) * width + Math.min(width - 1, Math.max(0, Math.floor(u * width)))) * 3;
const samples = [];
for (let i = 0; i < normalized.length; i++) {
  const p = normalized[i];
  if (Math.abs(p.x) > .18 || p.y < .97 || p.y > 1.11 || p.z < .02) continue;
  const at = pixel(uv.getX(i), uv.getY(i)), rgb = Array.from(decoded.data.subarray(at, at + 3));
  if (rgb[0] > 125 && rgb[0] > rgb[1] * 1.1 && rgb[1] > rgb[2] * 1.1) samples.push(rgb);
}
if (samples.length < 20) throw Error('No adequate bare abdomen skin samples; inspect UV orientation/source first');
const skin = [0, 1, 2].map(c => samples.map(s => s[c]).sort((a, b) => a - b)[Math.floor(samples.length / 2)]);
const result = Buffer.from(decoded.data), mask = Buffer.alloc(width * height), indices = geometry.index.array;
let triangles = 0;
function selected(p) { return Math.abs(p.x) < .27 && p.y > 1.015 && p.y < 1.49; }
for (let i = 0; i < indices.length; i += 3) {
  const ids = [indices[i], indices[i + 1], indices[i + 2]], ps = ids.map(id => normalized[id]);
  if (!ps.some(selected)) continue;
  const ts = ids.map(id => [uv.getX(id) * width - .5, uv.getY(id) * height - .5]);
  const [a, b, c] = ts, denominator = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
  if (Math.abs(denominator) < 1e-8) continue;
  const minX = Math.max(0, Math.floor(Math.min(...ts.map(t => t[0])))), maxX = Math.min(width - 1, Math.ceil(Math.max(...ts.map(t => t[0]))));
  const minY = Math.max(0, Math.floor(Math.min(...ts.map(t => t[1])))), maxY = Math.min(height - 1, Math.ceil(Math.max(...ts.map(t => t[1]))));
  triangles++;
  for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
    const w0 = ((b[1] - c[1]) * (x - c[0]) + (c[0] - b[0]) * (y - c[1])) / denominator;
    const w1 = ((c[1] - a[1]) * (x - c[0]) + (a[0] - c[0]) * (y - c[1])) / denominator, w2 = 1 - w0 - w1;
    if (Math.min(w0, w1, w2) < -1e-5) continue;
    const point = ps[0].clone().multiplyScalar(w0).addScaledVector(ps[1], w1).addScaledVector(ps[2], w2);
    if (!selected(point)) continue;
    const at = (y * width + x) * 3;
    const normal = vertexNormals[ids[0]].clone().multiplyScalar(w0).addScaledVector(vertexNormals[ids[1]], w1).addScaledVector(vertexNormals[ids[2]], w2).normalize();
    // Keep restrained muscle shading from the generated geometry's surface.
    // No global colour replacement and no dark-shirt luminance copied into skin.
    const shade = .91 + .07 * Math.max(0, normal.y) + .04 * Math.max(0, normal.z);
    for (let channel = 0; channel < 3; channel++) result[at + channel] = Math.min(255, Math.round(skin[channel] * shade));
    mask[y * width + x] = 255;
  }
}
// Four pixels of island padding prevent the previous black garment from
// bleeding back through linear filtering and mipmaps at UV seams.
for (let pass = 0; pass < 4; pass++) {
  const previous = Buffer.from(mask), previousColour = Buffer.from(result);
  for (let y = 1; y < height - 1; y++) for (let x = 1; x < width - 1; x++) {
    const at = y * width + x;
    if (previous[at]) continue;
    const neighbours = [at - 1, at + 1, at - width, at + width].filter(n => previous[n]);
    if (!neighbours.length) continue;
    for (let c = 0; c < 3; c++) result[at * 3 + c] = Math.round(neighbours.reduce((n, id) => n + previousColour[id * 3 + c], 0) / neighbours.length);
    mask[at] = 255;
  }
}
const selectedPixels = mask.reduce((n, v) => n + (v ? 1 : 0), 0);
if (selectedPixels < 1000 || selectedPixels > width * height * .3) throw Error('Torso mask is empty or implausibly broad');
const png = await sharp(result, { raw: { width, height, channels: 3 } }).png().toBuffer();
await writeFile(path.join(output, 'colour.png'), png);
await writeFile(path.join(output, 'before.png'), await sharp(embedded).png().toBuffer());
await writeFile(path.join(output, 'mask.png'), await sharp(mask, { raw: { width, height, channels: 1 } }).png().toBuffer());
const report = { source: path.resolve(bodyFile), sourceSHA256: rig.sha256, imageSHA256: sha256(embedded), outputSHA256: sha256(png), width, height,
  selection: 'Actual torso faces |x| < .27, 1.015 < y < 1.49 m, smooth normals and four-pixel UV padding; no geometry, UV or bone edits', skinSamples: samples.length, sampledSkinRGB: skin, selectedTriangles: triangles, selectedPixels,
  limitations: ['Requires front/back/side inspection after candidate preparation.', 'No anatomy or deformation approval is implied by texture correction.'] };
await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
if (sha256(await readFile(bodyFile)) !== rig.sha256) throw Error('Source changed during texture preparation');
console.log(JSON.stringify({ output, textureSHA256: report.outputSHA256, selectedPixels, skinSamples: samples.length }));
