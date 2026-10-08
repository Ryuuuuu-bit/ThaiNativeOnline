// Decode review candidates for Blender, preserving the prepared materials.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dequantize, transformPrimitive, prune } from '@gltf-transform/functions';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import fs from 'node:fs/promises';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
await MeshoptDecoder.ready;
await fs.mkdir('artifacts/meshy-rig-01/input', { recursive: true });
for (const type of ['boar', 'fowl', 'crab']) {
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
  await io.write(`artifacts/meshy-rig-01/input/${type}.glb`, doc);
  const p = doc.getRoot().listMeshes()[0].listPrimitives()[0];
  const points = Array.from({ length: p.getAttribute('POSITION').getCount() }, (_, i) => p.getAttribute('POSITION').getElement(i, []));
  await fs.writeFile(`artifacts/meshy-rig-01/input/${type}-positions.json`, JSON.stringify(points));
  console.log(type, points.length);
}
