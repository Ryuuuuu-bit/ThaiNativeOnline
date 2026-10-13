// Meshopt-packed GLB → plain GLB (a donor for retarget.mjs): node tools/class-models/unpack.mjs in.glb out.glb
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { dequantize } from '@gltf-transform/functions';
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const doc = await io.read(process.argv[2]);
for (const e of doc.getRoot().listExtensionsUsed()) if (/meshopt|quantization/.test(e.extensionName)) e.dispose();
await doc.transform(dequantize());
await io.write(process.argv[3], doc);
console.log('wrote', process.argv[3]);
