// Read-only shipping check. Visual approval comes from recorded review, not this script.
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { parseGLB, sha256 } from './glb.mjs';
import { NPC_MODELS, registerBundledNPCModelProfiles } from '../../src/npc/NPCModels.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const directory = path.join(root, 'src/npc/model-profiles');
const files = (await readdir(directory)).filter(f => f.endsWith('.json'));
assert.equal(files.length, Object.keys(NPC_MODELS).length, 'All seventeen important families must be approved together');
const deps = createRequire(path.join(process.env.NPC_MODEL_DEPS ?? path.join(root, 'tools/monster-models'), 'package.json'));
const sharp = deps('sharp'), profiles = {}, output = [];
for (const file of files.sort()) {
  const p = JSON.parse(await readFile(path.join(directory, file), 'utf8'));
  assert.equal(file, `${p.family}.json`); assert.equal(p.qaApproved, true);
  assert.ok(NPC_MODELS[p.family]);
  const bytes = await readFile(path.join(root, 'public/models/npcs', file.replace('.json', '.glb')));
  assert.equal(sha256(bytes), p.assetSha256, `${p.family}: shipping hash mismatch`);
  assert.ok(bytes.length < 800000, `${p.family}: byte budget exceeded`);
  const { json, bin } = parseGLB(bytes);
  assert.equal(json.materials.length, 1); assert.equal(json.materials[0].alphaMode ?? 'OPAQUE', 'OPAQUE');
  assert.equal(json.images.length, 1); assert.equal(json.skins.length, 1); assert.equal(json.skins[0].joints.length, 24);
  const image = json.bufferViews[json.images[0].bufferView], texture = await sharp(bin.subarray(image.byteOffset ?? 0, (image.byteOffset ?? 0) + image.byteLength)).metadata();
  assert.equal(texture.width, 1024); assert.equal(texture.height, 1024);
  let triangles = 0;
  for (const mesh of json.meshes) for (const primitive of mesh.primitives) {
    assert.equal(primitive.mode ?? 4, 4); triangles += json.accessors[primitive.indices].count / 3;
  }
  assert.ok(triangles <= 16000, `${p.family}: triangle budget exceeded`);
  for (const clip of ['idle', 'walk', 'run']) assert.ok(json.animations.some(a => a.name === clip), `${p.family}: missing ${clip}`);
  const authoring = await readFile(path.join(root, 'tools/npc-models/source', file.replace('.json', '.glb')));
  const editable = parseGLB(authoring);
  assert.ok(!editable.json.extensionsUsed?.includes('EXT_meshopt_compression'), `${p.family}: editable source must be unpacked`);
  profiles[`./model-profiles/${file}`] = p;
  output.push({ family: p.family, sha256: p.assetSha256, bytes: bytes.length, triangles, editableSha256: sha256(authoring), npcIds: NPC_MODELS[p.family].npcIds });
}
const unregister = registerBundledNPCModelProfiles(profiles); unregister();
assert.equal(new Set(output.flatMap(o => o.npcIds)).size, 34);
console.log(JSON.stringify({ passed: true, families: output.length, identities: 34, totalBytes: output.reduce((s, o) => s + o.bytes, 0), assets: output }, null, 2));
