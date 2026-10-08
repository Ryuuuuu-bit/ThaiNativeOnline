// Decode review candidates for Blender, preserving the prepared materials.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dequantize, transformPrimitive, prune } from '@gltf-transform/functions';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import fs from 'node:fs/promises';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
await MeshoptDecoder.ready;
const types=process.argv.slice(2).length?process.argv.slice(2):['boar','fowl','crab'];
if(types.some(type=>!['boar','fowl','crab','cobra','monkey'].includes(type)))throw Error('Unknown creature');
const outputRoot=process.env.MESHY_RIG_OUTPUT??'artifacts/meshy-rig-01';
await fs.mkdir(`${outputRoot}/input`, { recursive: true });
for (const type of types) {
  const doc = await io.read(`tools/monster-models/meshy/${type}.glb`);
  for (const ext of doc.getRoot().listExtensionsUsed()) if (ext.extensionName === 'EXT_meshopt_compression') ext.dispose();
  await doc.transform(dequantize());
  const root = doc.getRoot(), scene = root.listScenes()[0];
  const source = root.listNodes().find(n => n.getMesh());
  for (const p of source.getMesh().listPrimitives()) transformPrimitive(p, source.getWorldMatrix());
  const node = doc.createNode(`${type}Source`).setMesh(source.getMesh());
  for (const child of scene.listChildren()) scene.removeChild(child);
  scene.addChild(node);
  for (const old of root.listNodes()) if (old !== node) old.dispose();
  await doc.transform(prune());
  await io.write(`${outputRoot}/input/${type}.glb`, doc);
  const p = doc.getRoot().listMeshes()[0].listPrimitives()[0];
  const points = Array.from({ length: p.getAttribute('POSITION').getCount() }, (_, i) => p.getAttribute('POSITION').getElement(i, []));
  await fs.writeFile(`${outputRoot}/input/${type}-positions.json`, JSON.stringify(points));
  console.log(type, points.length);
}
