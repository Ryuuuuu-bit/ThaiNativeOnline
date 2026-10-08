import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {Vector3,Matrix4} from 'three';
import fs from 'node:fs/promises';
const rootDir=process.env.MESHY_RIG_OUTPUT??'artifacts/meshy-rig-02';
const doc=await new NodeIO().registerExtensions(ALL_EXTENSIONS).read(`${rootDir}/monkey-rig-v1.glb`),skin=doc.getRoot().listSkins()[0],joints=skin.listJoints(),bind=skin.getInverseBindMatrices();
const report=JSON.parse(await fs.readFile(`${rootDir}/monkey-rig-report.json`));const result={};
for(const l of report.legs){const idx=joints.findIndex(b=>b.getName()===l.name+'Upper'),m=new Matrix4().fromArray(bind.getElement(idx,[])).invert(),basis=new Vector3().setFromMatrixColumn(m,0),x=new Vector3(basis.x,-basis.z,basis.y).normalize(),hip=new Vector3(...l.hip),knee=new Vector3(...l.knee),ankle=new Vector3(...l.ankle),pole=new Vector3(...l.pole),y=knee.clone().sub(hip).normalize(),normal=ankle.clone().sub(hip).cross(pole.clone().sub(hip)),projected=normal.cross(y).normalize();result[l.name]=-Math.atan2(x.clone().cross(projected).dot(y),x.dot(projected));}
await fs.writeFile(new URL('./pole-angles-level2.json',import.meta.url),JSON.stringify(result,null,2));console.log(result);
