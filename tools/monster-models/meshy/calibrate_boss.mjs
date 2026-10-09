// Recover IK and arm axes from the exact registered-Harness rest export.
import {Vector3,Matrix4,Euler} from 'three';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

export const BIPED_BOSS_TYPES=Object.freeze(['chalawan','bamboo_grave_3','sealed_mine_3',
 'dusk_fort_3','giant_valley_3','himmapan_3','fallen_city_3','demon_rift_3']);
const REST_ADDUCTION=Object.freeze({chalawan:.24,bamboo_grave_3:.16,sealed_mine_3:.12,
 dusk_fort_3:.12,giant_valley_3:.12,himmapan_3:.12,fallen_city_3:.12,demon_rift_3:.12});

// No input reads, writes, GLB dependencies or scene connections on import.
export async function calibrateBoss(type,{dir,tag='rest'}={}) {
if(!dir||!BIPED_BOSS_TYPES.includes(type))throw Error('Explicit approved biped output directory/type required; Naga needs a serpent rig');
const report=JSON.parse(await fs.readFile(`${dir}/${type}-rig-report.json`));
const journal=JSON.parse(await fs.readFile(`${dir}/${type}-${tag}-export.json`));
const receipt=journal.jobs.find(j=>j.format==='glb')?.verifiedStatus?.artifact;
if(!receipt)throw Error('Rest export must complete and verify before calibration');
const bytes=await fs.readFile(receipt.path),hash=createHash('sha256').update(bytes).digest('hex');
if(hash!==receipt.sha256)throw Error('Rest snapshot hash changed');
const [{NodeIO},{ALL_EXTENSIONS}]=await Promise.all([import('@gltf-transform/core'),import('@gltf-transform/extensions')]);
const doc=await new NodeIO().registerExtensions(ALL_EXTENSIONS).read(receipt.path);
const skin=doc.getRoot().listSkins().find(s=>s.getName()===report.rigName);
if(!skin)throw Error('Expected this exact authored rest rig');
const joints=skin.listJoints(),bind=skin.getInverseBindMatrices();
const rest=name=>{const i=joints.findIndex(b=>b.getName()===name);if(i<0)throw Error('Missing rest bone '+name);return new Matrix4().fromArray(bind.getElement(i,[])).invert();};
const convert=v=>new Vector3(v.x,-v.z,v.y);
const result={restGlbSha256:hash,anatomySha256:report.inputHashes.anatomy,legs:{},arms:{}};
for(const l of report.legs){
 const matrix=rest(l.upper),x=convert(new Vector3().setFromMatrixColumn(matrix,0)).normalize();
 const hip=new Vector3(...l.hip),knee=new Vector3(...l.knee),joint=new Vector3(...l.joint),pole=new Vector3(...l.pole);
 const y=knee.clone().sub(hip).normalize(),normal=joint.clone().sub(hip).cross(pole.clone().sub(hip)),projected=normal.cross(y).normalize();
 const rotationMatrix=new Matrix4().makeBasis(...[0,1,2].map(i=>convert(new Vector3().setFromMatrixColumn(rest(l.foot),i))));
 result.legs[l.name]={poleAngle:-Math.atan2(x.clone().cross(projected).dot(y),x.dot(projected)),rotation:new Euler().setFromRotationMatrix(rotationMatrix,'ZYX').toArray().slice(0,3)};
}
const bones=new Map(report.bones.map(b=>[b.name,b]));
for(const arm of report.arms){
 const entry={};
 for(const segment of ['upper','lower']){
  const bone=bones.get(arm[segment]);
  const direction=new Vector3(bone.tail[0]-bone.head[0],bone.tail[2]-bone.head[2],-(bone.tail[1]-bone.head[1]));
  const m=rest(arm[segment]);let best=null;
  for(const axis of [0,1,2])for(const sign of [-1,1]){
   const velocity=new Vector3().setFromMatrixColumn(m,axis).normalize().cross(direction).multiplyScalar(sign);
   const score=velocity.z*.85+velocity.y*.35;
   if(!best||score>best.score)best={axis,sign,score};
  }
  entry[segment+'Axis']=best.axis;entry[segment+'Sign']=best.sign;
  const base=[0,0,0];
  if(segment==='upper'){
   let down=null;
   for(const axis of [0,1,2])for(const sign of [-1,1]){
    const velocity=new Vector3().setFromMatrixColumn(m,axis).normalize().cross(direction).multiplyScalar(sign);
    const score=-velocity.y-.3*Math.sign(bone.head[0])*velocity.x;
    if(!down||score>down.score)down={axis,sign,score};
   }
   base[down.axis]=down.sign*REST_ADDUCTION[type];
  }else base[best.axis]=best.sign*.04;
  entry[segment+'RestRotation']=base;
 }
 result.arms[arm.name]=entry;
}
const rootName=report.bones.find(b=>b.parent===null&&!b.deform)?.name;
if(!rootName)throw Error('Expected the authored nondeforming root');
result.rootDownLocal=new Vector3(0,-1,0).transformDirection(rest(rootName).invert()).toArray();
if(report.tail.length){
 result.tailUpLocal=new Vector3(0,1,0).transformDirection(rest(report.tail[0]).invert()).toArray();
 result.tailRotationAxes=Object.fromEntries(report.tail.map(name=>[name,new Vector3(0,1,0).transformDirection(rest(name).invert()).toArray()]));
}
await fs.writeFile(`${dir}/${type}-calibration.json`,JSON.stringify(result,null,2)+'\n');
return result;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href) {
 try {console.log(JSON.stringify(await calibrateBoss(process.argv[2],{tag:process.argv[3]??'rest',dir:process.env.MESHY_RIG_OUTPUT})));}
 catch(error) {console.error(error.message);process.exitCode=1;}
}
