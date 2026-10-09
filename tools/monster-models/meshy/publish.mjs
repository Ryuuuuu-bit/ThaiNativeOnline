// Package a reviewed, Harness-exported animal rig for the game's shared loader.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune } from '@gltf-transform/functions';
import sharp from 'sharp';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
const type=process.argv[2];
if(!['boar','fowl','crab','cobra','monkey','dhole','phibpa'].includes(type))throw Error('Unknown creature');
const require=createRequire(import.meta.url), io=new NodeIO().registerExtensions(ALL_EXTENSIONS);
const outputRoot=process.env.MESHY_RIG_OUTPUT??'artifacts/meshy-rig-01';
const rigVersion=process.argv[3]??'v5';
const input=`${outputRoot}/${type}-animated.glb`,doc=await io.read(input),root=doc.getRoot();
if(root.listSkins().length!==1 || root.listMeshes().length!==1)throw Error('Expected one reviewed skinned surface');
if(root.listAnimations().map(a=>a.getName()).sort().join(',')!=='attack,die,hurt,idle,walk')throw Error('Five independent game clips are required');
for(const node of root.listNodes())if(/(?:Target|Pole)$/.test(node.getName()))node.dispose();
for(const material of root.listMaterials()){
 const texture=material.getBaseColorTexture();
 if(texture&&texture.getMimeType()!=='image/jpeg')texture.setImage(await sharp(texture.getImage()).jpeg({quality:92,chromaSubsampling:'4:4:4'}).toBuffer()).setMimeType('image/jpeg');
}
root.setExtras({creature:type,provider:'Meshy',rig:'species-specific Blender Harness',rigVersion,clips:['idle','walk','attack','hurt','die']});
await doc.transform(prune());await io.write(input,doc);
const output=`public/models/monsters/${type}.glb`;
const packed=spawnSync(process.execPath,[require.resolve('gltfpack/cli.js'),'-i',input,'-o',output,'-cc','-kn','-ke'],{encoding:'utf8'});
if(packed.status!==0)throw Error(packed.stderr);
const bytes=await fs.readFile(output);
const report={type,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),triangles:root.listMeshes().flatMap(m=>m.listPrimitives()).reduce((n,p)=>n+p.getIndices().getCount()/3,0),bones:root.listSkins()[0].listJoints().length,clips:root.listAnimations().map(a=>a.getName())};
await fs.writeFile(`tools/monster-models/meshy/${type}-animated.json`,JSON.stringify(report,null,2)+'\n');console.log(report);
