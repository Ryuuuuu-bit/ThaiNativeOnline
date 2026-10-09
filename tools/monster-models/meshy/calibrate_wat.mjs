// Recover Blender rest bases from the L3 rest snapshot before adding IK.
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {Vector3,Matrix4,Euler} from 'three';
import fs from 'node:fs/promises';
const dir=process.env.MESHY_RIG_OUTPUT??'artifacts/meshy-rig-04/wat-rang';
const doc=await new NodeIO().registerExtensions(ALL_EXTENSIONS).read(`${dir}/jobs/job_wat_rest_glb/artifact.glb`);
const all={};
const convert=v=>new Vector3(v.x,-v.z,v.y);
for(const type of ['headless','pret','krahang','phitaihong','soldier','pusom']){
 const report=JSON.parse(await fs.readFile(`${dir}/${type}-rig-report.json`));
 const skin=doc.getRoot().listSkins().find(s=>s.getName()===type[0].toUpperCase()+type.slice(1)+'V1Rig');
 const joints=skin.listJoints(),bind=skin.getInverseBindMatrices(),result={legs:{}};
 const rest=name=>new Matrix4().fromArray(bind.getElement(joints.findIndex(b=>b.getName()===name),[])).invert();
 for(const l of report.legs){
  const matrix=rest(l.name+'Upper'),x=convert(new Vector3().setFromMatrixColumn(matrix,0)).normalize();
  const hip=new Vector3(...l.hip),knee=new Vector3(...l.knee),joint=new Vector3(...l.joint),pole=new Vector3(...l.pole);
  const y=knee.clone().sub(hip).normalize(),normal=joint.clone().sub(hip).cross(pole.clone().sub(hip)),projected=normal.cross(y).normalize(),distal=rest(l.name+'Foot');
  const rotationMatrix=new Matrix4().makeBasis(...[0,1,2].map(i=>convert(new Vector3().setFromMatrixColumn(distal,i))));
  result.legs[l.name]={poleAngle:-Math.atan2(x.clone().cross(projected).dot(y),x.dot(projected)),rotation:new Euler().setFromRotationMatrix(rotationMatrix,'ZYX').toArray().slice(0,3)};
 }
 all[type]=result;
}
await fs.writeFile(`${dir}/calibration.json`,JSON.stringify(all,null,2)+'\n');console.log('Calibrated',Object.keys(all));
