// Derive updated static bind surfaces from the same verified Harness export
// as the runtime files, after topology-preserving contour / shield edits.
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {prune,transformPrimitive} from '@gltf-transform/functions';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
const dir=process.env.MESHY_RIG_OUTPUT??'artifacts/meshy-rig-04/wat-rang';
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS);
for(const type of ['krasue','soldier']){
 const input=`${dir}/${type}-rig-production.glb`,doc=await io.read(input),root=doc.getRoot();
 const source=root.listNodes().find(n=>n.getMesh()),mesh=source.getMesh();
 for(const p of mesh.listPrimitives()){
  p.setAttribute('JOINTS_0',null).setAttribute('WEIGHTS_0',null);
  transformPrimitive(p,source.getWorldMatrix());
 }
 const node=doc.createNode(type+'Source').setMesh(mesh),scene=root.listScenes()[0];
 for(const a of root.listAnimations())a.dispose();
 for(const s of root.listSkins())s.dispose();
 for(const s of root.listScenes())for(const child of s.listChildren())s.removeChild(child);
 scene.addChild(node);for(const n of root.listNodes())if(n!==node)n.dispose();
 await doc.transform(prune());await io.write(`${dir}/${type}-refined-static.glb`,doc);
 await fs.writeFile(`${dir}/${type}-static-derivation.json`,JSON.stringify({type,sourceSha256:createHash('sha256').update(await fs.readFile(input)).digest('hex'),method:'bind geometry from verified Harness snapshot; skin and animation removed'},null,2)+'\n');
}
