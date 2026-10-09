// Recover the actual exported Blender rest axes before enabling four planted legs.
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {Vector3,Matrix4,Euler} from 'three';
import fs from 'node:fs/promises';
const dir=process.env.MESHY_RIG_OUTPUT??'artifacts/meshy-rig-05/klong';
const input=process.argv[2]??`${dir}/jobs/job_croc_rest_glb/artifact.glb`;
const doc=await new NodeIO().registerExtensions(ALL_EXTENSIONS).read(input);
const skin=doc.getRoot().listSkins().find(s=>s.getName()==='CrocV1Rig');
if(!skin)throw Error('Expected crocodile rest rig');
const joints=skin.listJoints(),bind=skin.getInverseBindMatrices();
const report=JSON.parse(await fs.readFile(`${dir}/croc-rig-report.json`));
const convert=v=>new Vector3(v.x,-v.z,v.y);
const rest=name=>new Matrix4().fromArray(bind.getElement(joints.findIndex(b=>b.getName()===name),[])).invert();
const result={legs:{}};
for(const l of report.legs){
 const m=rest(l.name+'Upper'),x=convert(new Vector3().setFromMatrixColumn(m,0)).normalize();
 const hip=new Vector3(...l.hip),knee=new Vector3(...l.knee),joint=new Vector3(...l.joint),pole=new Vector3(...l.pole);
 const y=knee.clone().sub(hip).normalize(),normal=joint.clone().sub(hip).cross(pole.clone().sub(hip)),projected=normal.cross(y).normalize();
 const distal=rest(l.name+'Foot');
 const rotationMatrix=new Matrix4().makeBasis(...[0,1,2].map(i=>convert(new Vector3().setFromMatrixColumn(distal,i))));
 result.legs[l.name]={poleAngle:-Math.atan2(x.clone().cross(projected).dot(y),x.dot(projected)),rotation:new Euler().setFromRotationMatrix(rotationMatrix,'ZYX').toArray().slice(0,3)};
}
result.bodyDownLocal=new Vector3(0,-1,0).transformDirection(rest('Body').invert()).toArray();
result.tailUpLocal=new Vector3(0,1,0).transformDirection(rest('TailBase').invert()).toArray();
result.pitchDownSigns={};
for(const name of ['Neck','Head','Jaw']){
 const matrix=rest(name),axis=new Vector3().setFromMatrixColumn(matrix,0).normalize();
 const forward=new Vector3().setFromMatrixColumn(matrix,1).normalize();
 result.pitchDownSigns[name]=Math.sign(axis.cross(forward).dot(new Vector3(0,-1,0)));
 if(!result.pitchDownSigns[name])throw Error(`No vertical pitch response for ${name}`);
}
await fs.writeFile(`${dir}/croc-calibration.json`,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result));
