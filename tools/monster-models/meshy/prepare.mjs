// Preserve Meshy's geometry/UVs; resize embedded texture payloads for review.
// npm ci --prefix tools/monster-models
// node tools/monster-models/meshy/prepare.mjs boar
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { center, dedup, getBounds, prune, weld } from '@gltf-transform/functions';
import sharp from 'sharp';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { Quaternion, Vector3 } from 'three';

const name = process.argv[2];
if (!['boar', 'fowl', 'crab', 'cobra', 'monkey', 'dhole', 'phibpa'].includes(name)) throw Error('Unknown study creature');
const dest = new URL('./', import.meta.url), tmp = new URL(`../../../artifacts/meshy-monsters/${name}/`, import.meta.url);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const correctedInput=process.argv[3];
const doc = await io.read(correctedInput??fileURLToPath(new URL('original.glb', tmp)));
const root = doc.getRoot();
if (root.listSkins().length || root.listAnimations().length) throw Error('Expected the untouched static generation');
// Meshy reconstructed the macaque's torso along -X. The game faces +Z.
if(name==='monkey'&&!correctedInput){
  const yaw=new Quaternion().setFromAxisAngle(new Vector3(0,1,0),Math.PI/2);
  for(const scene of root.listScenes())for(const node of scene.listChildren()){
    node.setRotation(yaw.clone().multiply(new Quaternion().fromArray(node.getRotation())).toArray());
    node.setTranslation(new Vector3(...node.getTranslation()).applyQuaternion(yaw).toArray());
  }
}
// Organic creatures have no metal. Controlled broad roughness and a gentler
// normal map fit the game's hand-painted materials under its strong daylight.
for (const material of root.listMaterials()) material.setMetallicRoughnessTexture(null)
  .setMetallicFactor(0).setRoughnessFactor(name === 'crab' ? .68 : .9).setNormalScale(.5);
await doc.transform(prune());
const colorTextures = new Set(root.listMaterials().flatMap(m => [m.getBaseColorTexture(), m.getEmissiveTexture()]).filter(Boolean));
const alphaTextures = new Set(root.listMaterials().filter(m => m.getAlphaMode() !== 'OPAQUE').map(m => m.getBaseColorTexture()).filter(Boolean));
for (const texture of root.listTextures()) {
  const bytes = texture.getImage();
  if (!bytes) throw Error('All textures must be embedded');
  const input = sharp(bytes), edge = colorTextures.has(texture) ? 1024 : 512;
  const resized = input.resize({ width: edge, height: edge, fit: 'inside', withoutEnlargement: true });
  if (!alphaTextures.has(texture)) resized.removeAlpha();
  // Normal and metallic/roughness data retain lossless PNG channels.
  if (colorTextures.has(texture) && !alphaTextures.has(texture)) {
    texture.setImage(await resized.jpeg({ quality: 92, chromaSubsampling: '4:4:4' }).toBuffer()).setMimeType('image/jpeg');
  } else {
    texture.setImage(await resized.png({ compressionLevel: 9 }).toBuffer()).setMimeType('image/png');
  }
}
await doc.transform(weld(), dedup(), prune(), center({ pivot: 'below' }));
root.setExtras({ ...root.getExtras(), creature: name, stage: 'static geometry candidate; rig pending', provider: 'Meshy' });
const output = new URL(`${name}.glb`, dest);
await io.write(fileURLToPath(output), doc);
const packed = new URL(`${name}.packed.glb`, dest);
const require = createRequire(import.meta.url);
const pack = spawnSync(process.execPath, [require.resolve('gltfpack/cli.js'), '-i', fileURLToPath(output), '-o', fileURLToPath(packed), '-cc', '-kn', '-ke'], { encoding: 'utf8' });
if (pack.status !== 0) throw Error(pack.stderr || 'gltfpack failed');
await fs.rename(packed, output);
const bytes = await fs.readFile(output);
const meshes = root.listMeshes(), primitives = meshes.flatMap(m => m.listPrimitives());
const triangles = primitives.reduce((sum, p) => sum + (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3, 0);
const report = {
  creature: name, bytes: bytes.length, triangles, meshes: meshes.length,
  materialDraws: primitives.length, materials: root.listMaterials().length,
  textures: root.listTextures().map(t => ({ mime: t.getMimeType(), size: t.getSize() })),
  bounds: getBounds(root.listScenes()[0]), sha256: createHash('sha256').update(bytes).digest('hex'),
  stage: 'static geometry candidate; rig pending',
  geometryCompression: 'EXT_meshopt_compression',
};
if (triangles > 15000 || bytes.length > 5000000 || primitives.length > 4) throw Error('Review candidate exceeds its budget');
await fs.writeFile(new URL(`${name}-prepared.json`, dest), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
