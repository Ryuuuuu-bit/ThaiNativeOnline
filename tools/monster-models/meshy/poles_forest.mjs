// Recover rest bases before enabling planted IK chains and local crouch offsets.
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {Vector3,Matrix4,Euler} from 'three';
import fs from 'node:fs/promises';
const dir=process.env.MESHY_RIG_OUTPUT??'artifacts/meshy-rig-03/deep-forest';
const type=process.argv[2]??'monitor';
const doc=await new NodeIO().registerExtensions(ALL_EXTENSIONS).read(process.argv[3]??`${dir}/${type}-rig-production.glb`);
const skin=doc.getRoot().listSkins()[0],joints=skin.listJoints(),bind=skin.getInverseBindMatrices();
const report=JSON.parse(await fs.readFile(`${dir}/${type}-rig-report.json`)),result={legs:{}};
const convert=v=>new Vector3(v.x,-v.z,v.y);
function rest(name){return new Matrix4().fromArray(bind.getElement(joints.findIndex(b=>b.getName()===name),[])).invert();}
for(const l of report.legs){
 const matrix=rest(l.name+'Upper'),x=convert(new Vector3().setFromMatrixColumn(matrix,0)).normalize();
 const hip=new Vector3(...l.hip),knee=new Vector3(...l.knee),joint=new Vector3(...l.joint),pole=new Vector3(...l.pole);
 const y=knee.clone().sub(hip).normalize(),normal=joint.clone().sub(hip).cross(pole.clone().sub(hip)),projected=normal.cross(y).normalize();
 const distal=rest(l.name+'Foot');
 const rotationMatrix=new Matrix4().makeBasis(convert(new Vector3().setFromMatrixColumn(distal,0)),convert(new Vector3().setFromMatrixColumn(distal,1)),convert(new Vector3().setFromMatrixColumn(distal,2)));
 result.legs[l.name]={poleAngle:-Math.atan2(x.clone().cross(projected).dot(y),x.dot(projected)),rotation:new Euler().setFromRotationMatrix(rotationMatrix,'ZYX').toArray().slice(0,3)};
}
result.bodyDownLocal=new Vector3(0,-1,0).transformDirection(rest('Body').invert()).toArray();
if(type==='monitor') result.tailUpLocal=new Vector3(0,1,0).transformDirection(rest('TailBase').invert()).toArray();
const file=new URL('./pole-angles-forest.json',import.meta.url);
const saved=JSON.parse(await fs.readFile(file));
await fs.writeFile(file,JSON.stringify({...saved,[type]:result},null,2)+'\n');console.log(JSON.stringify(result));
