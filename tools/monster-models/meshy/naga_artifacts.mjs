// Rest-bound serpent axes or verified source extraction. Never biped retarget.
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {prune} from '@gltf-transform/functions';
import {Matrix4,Vector3} from 'three';
const dir=process.env.MESHY_RIG_OUTPUT,type='sunken_city_3',mode=process.argv[2],tag=process.argv[3]??(mode==='calibrate'?'rest':'final-v1');
if(!dir||!['calibrate','extract'].includes(mode))throw Error('Explicit serpent output directory/mode required');
const report=JSON.parse(await fs.readFile(`${dir}/${type}-rig-report.json`));
if(report.taxon!=='serpent'||report.legs.length||report.arms.length)throw Error('Expected limb-free Naga report');
const journal=JSON.parse(await fs.readFile(`${dir}/${type}-${tag}-export.json`));
const receipt=journal.jobs.find(j=>j.format==='glb')?.verifiedStatus?.artifact;
if(!receipt)throw Error('Recorded serpent GLB export must verify first');
const hash=b=>createHash('sha256').update(b).digest('hex'),bytes=await fs.readFile(receipt.path);
if(hash(bytes)!==receipt.sha256)throw Error('Serpent export hash mismatch');
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS),doc=await io.read(receipt.path),root=doc.getRoot();
const skin=root.listSkins().find(s=>s.getName()===report.rigName);
if(!skin)throw Error('Exact measured serpent skin required');
if(mode==='calibrate'){
 const joints=skin.listJoints(),bind=skin.getInverseBindMatrices(),axes={};
 for(const bone of report.bones.filter(b=>b.deform)){
  const i=joints.findIndex(n=>n.getName()===bone.name);if(i<0)throw Error('Missing source bone '+bone.name);
  const inverseRest=new Matrix4().fromArray(bind.getElement(i,[]));
  axes[bone.name]=[[1,0,0],[0,0,-1],[0,1,0]].map(v=>new Vector3(...v).transformDirection(inverseRest).toArray());
 }
 await fs.writeFile(`${dir}/${type}-calibration.json`,JSON.stringify({type,restGlbSha256:receipt.sha256,anatomySha256:report.inputHashes.anatomy,axes},null,2)+'\n');
 console.log(JSON.stringify({type,mode,bones:Object.keys(axes),restGlbSha256:receipt.sha256}));
}else{
 const rig=root.listNodes().find(n=>n.getName()===report.rigName),surface=root.listNodes().find(n=>n.getName()===report.surfaceName);
 if(surface?.getParentNode()!==rig||surface.getSkin()!==skin)throw Error('Exact serpent surface hierarchy required');
 const keep=new Set();function visit(n){keep.add(n);n.listChildren().forEach(visit)}visit(rig);
 const scene=root.listScenes()[0];for(const s of root.listScenes())for(const n of s.listChildren())s.removeChild(n);scene.addChild(rig);
 for(const a of root.listAnimations())if(a.getName()!==report.rigName+'Action')a.dispose();
 for(const n of root.listNodes())if(!keep.has(n))n.dispose();await doc.transform(prune());
 if(root.listMeshes().length!==1||root.listSkins().length!==1||root.listAnimations().length!==1)throw Error('One authored serpent timeline required');
 const output=`${dir}/${type}-rig-production.glb`;await io.write(output,doc);
 await fs.writeFile(`${dir}/${type}-production-extract.json`,JSON.stringify({type,sourceSha256:receipt.sha256,outputSha256:hash(await fs.readFile(output))},null,2)+'\n');console.log(output);
}
