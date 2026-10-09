// Decode review candidates for Blender, preserving the prepared materials.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dequantize, transformPrimitive, prune } from '@gltf-transform/functions';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import fs from 'node:fs/promises';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
await MeshoptDecoder.ready;
const types=process.argv.slice(2).length?process.argv.slice(2):['boar','fowl','crab'];
if(types.some(type=>!['boar','fowl','crab','cobra','monkey','dhole','phibpa','buffalo','kongkoi','monitor','pray','khamot','winyan','takian','headless', 'pret', 'krahang', 'krasue', 'phitaihong', 'soldier', 'pusom', 'croc', 'chalawan', 'bamboo_grave_3', 'sealed_mine_3', 'sunken_city_3', 'dusk_fort_3', 'giant_valley_3', 'himmapan_3', 'fallen_city_3', 'demon_rift_3'].includes(type)))throw Error('Unknown creature');
const outputRoot=process.env.MESHY_RIG_OUTPUT??'artifacts/meshy-rig-01';
await fs.mkdir(`${outputRoot}/input`, { recursive: true });
for (const type of types) {
  // A refined review surface may have different vertex ordering. An explicit
  // bind-input directory retains the original topology used by weight patches.
  const bindInput=process.env.MESHY_BIND_INPUTS ? `${process.env.MESHY_BIND_INPUTS}/${type}.glb` : null;
  const useBindInput=bindInput && await fs.access(bindInput).then(()=>true,()=>false);
  const doc = await io.read(useBindInput ? bindInput : `tools/monster-models/meshy/${type}.glb`);
  for (const ext of doc.getRoot().listExtensionsUsed()) if (ext.extensionName === 'EXT_meshopt_compression') ext.dispose();
  await doc.transform(dequantize());
  const root = doc.getRoot(), scene = root.listScenes()[0];
  const source = root.listNodes().find(n => n.getMesh());
  for (const p of source.getMesh().listPrimitives()) transformPrimitive(p, source.getWorldMatrix());
  if(['chalawan','bamboo_grave_3','sealed_mine_3', 'sunken_city_3', 'dusk_fort_3', 'giant_valley_3', 'himmapan_3', 'fallen_city_3', 'demon_rift_3'].includes(type)) {
    // Positions already include the source world transform. Measuring the scene
    // here would apply gltfpack's quantization scale a second time.
    let minY=Infinity,maxY=-Infinity;
    for(const p of source.getMesh().listPrimitives()) {
      const a=p.getAttribute('POSITION');for(let i=0;i<a.getCount();i++){const y=a.getElement(i,[])[1];minY=Math.min(minY,y);maxY=Math.max(maxY,y);}
    }
    const scale=1.9/(maxY-minY);
    for(const p of source.getMesh().listPrimitives()) {
      const a=p.getAttribute('POSITION');for(let i=0;i<a.getCount();i++) {
        const v=a.getElement(i,[]).map(v=>v*scale);
        // Chalawan's large tail moves its bounding-box centre away from the
        // standing body. Measured foot/body origin keeps the collision root
        // beneath the humanoid, rather than beneath the tail's midpoint.
        if(type==='chalawan'){v[0]+=.095;v[2]-=.775;}
        a.setElement(i,v);
      }
    }
  }
  const node = doc.createNode(`${type}Source`).setMesh(source.getMesh());
  for (const child of scene.listChildren()) scene.removeChild(child);
  scene.addChild(node);
  for (const old of root.listNodes()) if (old !== node) old.dispose();
  await doc.transform(prune());
  await io.write(`${outputRoot}/input/${type}.glb`, doc);
  const p = doc.getRoot().listMeshes()[0].listPrimitives()[0];
  const points = Array.from({ length: p.getAttribute('POSITION').getCount() }, (_, i) => p.getAttribute('POSITION').getElement(i, []));
  await fs.writeFile(`${outputRoot}/input/${type}-positions.json`, JSON.stringify(points));
  await fs.writeFile(`${outputRoot}/input/${type}-indices.json`, JSON.stringify(Array.from(p.getIndices().getArray())));
  console.log(type, points.length);
}
