// Recover the imported buffalo's exact bone roll and distal rest orientation.
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {Vector3,Matrix4,Euler} from 'three';
import fs from 'node:fs/promises';
const dir=process.env.MESHY_RIG_OUTPUT??'artifacts/meshy-rig-02/paddy-buffalo';
const doc=await new NodeIO().registerExtensions(ALL_EXTENSIONS).read(`${dir}/buffalo-rig-rest.glb`);
const skin=doc.getRoot().listSkins()[0],joints=skin.listJoints(),bind=skin.getInverseBindMatrices();
const report=JSON.parse(await fs.readFile(`${dir}/buffalo-rig-report.json`)),result={};
const convert=v=>new Vector3(v.x,-v.z,v.y);
function rest(name){return new Matrix4().fromArray(bind.getElement(joints.findIndex(b=>b.getName()===name),[])).invert();}
for(const l of report.legs){
 const matrix=rest(l.name+'Upper'),x=convert(new Vector3().setFromMatrixColumn(matrix,0)).normalize();
 const hip=new Vector3(...l.hip),knee=new Vector3(...l.knee),joint=new Vector3(...l.joint),pole=new Vector3(...l.pole);
 const y=knee.clone().sub(hip).normalize(),normal=joint.clone().sub(hip).cross(pole.clone().sub(hip)),projected=normal.cross(y).normalize();
 const distal=rest(l.name+(l.name.startsWith('Hind')?'Pastern':'Foot'));
 const basis=new Matrix4().makeBasis(convert(new Vector3().setFromMatrixColumn(distal,0)),convert(new Vector3().setFromMatrixColumn(distal,1)),convert(new Vector3().setFromMatrixColumn(distal,2)));
 result[l.name]={poleAngle:-Math.atan2(x.clone().cross(projected).dot(y),x.dot(projected)),rotation:new Euler().setFromRotationMatrix(basis,'ZYX').toArray().slice(0,3)};
}
await fs.writeFile(new URL('./pole-angles-buffalo.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result));
