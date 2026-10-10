// Additive opt-in for measured Meshy export noise. Raw files are never written.
// Unit rig frames are admitted only after real Three skin round-trip proof.
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GLBBuilder, sha256 } from './glb.mjs';
import { THREE, loadRig, restoreRest, worldVertices, restGeometryMatrix, sampleTimes, clampedSampler, assertNativeContract, rigContract } from './rig.mjs';
import { candidateDirectory } from './prepare.mjs';

function rigidWorlds(rig, evidence) {
  const result = new Map();
  for (const o of rig.objects) {
    const p=new THREE.Vector3(),q=new THREE.Quaternion(),s=new THREE.Vector3();o.matrixWorld.decompose(p,q,s);q.normalize();
    const scale=(s.x+s.y+s.z)/3;
    if(!(scale>0)||![...p,...q,...s].every(Number.isFinite))throw Error('Invalid original source frame');
    const unit=new THREE.Matrix4().compose(p,q,new THREE.Vector3(1,1,1)),scaled=new THREE.Matrix4().compose(p,q,new THREE.Vector3(scale,scale,scale));
    let residual=0;for(const i of [0,1,2,4,5,6,8,9,10])residual=Math.max(residual,Math.abs(o.matrixWorld.elements[i]-scaled.elements[i])/scale);
    evidence.maxBasisResidual=Math.max(evidence.maxBasisResidual,residual);
    if(residual>.0001)throw Error(`Measured scale/shear exceeds normalization allowance: ${rig.objectNames.get(o)}`);
    result.set(o,unit);
  }
  return result;
}
function local(rig,worlds){return rig.objects.map(o=>{
  const matrix=worlds.has(o.parent)?worlds.get(o.parent).clone().invert().multiply(worlds.get(o)):worlds.get(o),p=new THREE.Vector3(),q=new THREE.Quaternion(),s=new THREE.Vector3();matrix.decompose(p,q,s);q.normalize();
  const rebuilt=new THREE.Matrix4().compose(p,q,new THREE.Vector3(1,1,1));if(matrix.elements.some((v,i)=>Math.abs(v-rebuilt.elements[i])>1e-7))throw Error('Normalized local frame is not rigid');
  return {o,p,q};
});}
function maxVertexDrift(a,b){if(a.length!==b.length)throw Error('Geometry vertex count changed');let max=0;for(let i=0;i<a.length;i+=3)max=Math.max(max,Math.hypot(a[i]-b[i],a[i+1]-b[i+1],a[i+2]-b[i+2]));return max;}

async function normalizeOne(input,output){
  const rig=await loadRig(input),before=worldVertices(rig),evidence={maxBasisResidual:0},rest=rigidWorlds(rig,evidence),restPose=local(rig,rest),nodeIds=new Map(rig.objects.map(o=>[o,rig.gltf.parser.associations.get(o).nodes]));
  const builder=new GLBBuilder();builder.json=structuredClone(rig.json);builder.parts=[Buffer.from(rig.bin)];builder.length=rig.bin.length;
  builder.json.asset.generator='ThaiNativeOnline measured NPC source normalization';
  const meshId=rig.gltf.parser.associations.get(rig.mesh).nodes,meshNode=builder.json.nodes[meshId];
  for(const n of builder.json.nodes)if(n.children)n.children=n.children.filter(i=>i!==meshId);
  for(const scene of builder.json.scenes)if(!scene.nodes.includes(meshId))scene.nodes.push(meshId);
  delete meshNode.matrix;meshNode.translation=[0,0,0];meshNode.rotation=[0,0,0,1];meshNode.scale=[1,1,1];
  for(const pose of restPose){const n=builder.json.nodes[nodeIds.get(pose.o)];delete n.matrix;n.translation=pose.p.toArray();n.rotation=pose.q.toArray();n.scale=[1,1,1];}
  const primitive=builder.json.meshes[meshNode.mesh].primitives[0],geometry=rig.mesh.geometry;
  primitive.attributes.POSITION=builder.accessor(new Float32Array(before),'VEC3',{bounds:true});
  const normalMatrix=new THREE.Matrix3().getNormalMatrix(restGeometryMatrix(rig)),normals=new Float32Array(before.length),v=new THREE.Vector3();
  for(let i=0;i<geometry.attributes.normal.count;i++)v.fromBufferAttribute(geometry.attributes.normal,i).applyNormalMatrix(normalMatrix).toArray(normals,i*3);
  primitive.attributes.NORMAL=builder.accessor(normals,'VEC3');
  const ibms=new Float32Array(rig.mesh.skeleton.bones.length*16);rig.mesh.skeleton.bones.forEach((o,i)=>rest.get(o).clone().invert().toArray(ibms,i*16));
  builder.json.skins[meshNode.skin].inverseBindMatrices=builder.accessor(ibms,'MAT4');
  builder.json.animations=[];
  for(const clip of rig.gltf.animations){
    const times=sampleTimes(clip),sampler=clampedSampler(rig,clip),poses=[];
    try{for(const t of times){sampler.at(t);poses.push(local(rig,rigidWorlds(rig,evidence)));}}finally{sampler.dispose();}
    const inputAccessor=builder.accessor(new Float32Array(times),'SCALAR',{bounds:true}),animation={name:clip.name,samplers:[],channels:[]};
    for(let n=0;n<rig.objects.length;n++)for(const [property,key,type,size]of[['translation','p','VEC3',3],['rotation','q','VEC4',4]]){
      const values=new Float32Array(times.length*size);let previous;
      for(let i=0;i<times.length;i++){const value=poses[i][n][key].clone();if(key==='q'&&previous&&previous.dot(value)<0)value.set(-value.x,-value.y,-value.z,-value.w);value.toArray(values,i*size);previous=value;}
      const samplerIndex=animation.samplers.length;animation.samplers.push({input:inputAccessor,output:builder.accessor(values,type),interpolation:'LINEAR'});animation.channels.push({sampler:samplerIndex,target:{node:nodeIds.get(rig.objects[n]),path:property}});
    }
    builder.json.animations.push(animation);
  }
  await writeFile(output,builder.encode());const normalized=await loadRig(output),restDrift=maxVertexDrift(before,worldVertices(normalized));
  if(restDrift>1e-5)throw Error(`Normalized rest skin moved ${restDrift}m`);
  const contract=rigContract(rig),actual=rigContract(normalized);if(contract.length!==actual.length||contract.some(n=>!actual.some(a=>a.name===n.name&&a.parent===n.parent&&a.joint===n.joint)))throw Error('Normalized rig names/ancestry changed');
  let maxSkinDrift=0,maxJointDrift=0,samples=0;
  for(const clip of rig.gltf.animations){const a=clampedSampler(rig,clip),b=clampedSampler(normalized,normalized.gltf.animations.find(c=>c.name===clip.name));
    try{for(const t of sampleTimes(clip)){a.at(t);b.at(t);samples++;maxSkinDrift=Math.max(maxSkinDrift,maxVertexDrift(worldVertices(rig),worldVertices(normalized)));for(const o of rig.mesh.skeleton.bones)maxJointDrift=Math.max(maxJointDrift,new THREE.Vector3().setFromMatrixPosition(o.matrixWorld).distanceTo(new THREE.Vector3().setFromMatrixPosition(normalized.names.get(rig.objectNames.get(o)).matrixWorld)));}}finally{a.dispose();b.dispose();}}
  if(maxSkinDrift>.0001||maxJointDrift>1e-5)throw Error(`Normalized animation round-trip exceeds limits: skin ${maxSkinDrift}, joints ${maxJointDrift}`);
  if(sha256(await readFile(input))!==rig.sha256)throw Error('Raw input changed during normalization');
  return {input:path.resolve(input),rawSHA256:rig.sha256,output:path.resolve(output),normalizedSHA256:normalized.sha256,vertices:before.length/3,joints:24,samples,restSkinDrift:restDrift,maxAnimationSkinDrift:maxSkinDrift,maxJointDrift,...evidence,geometryUVIndexWeightAndTextureBuffersPreserved:true,passed:true};
}

export async function normalizeSources(files,out){
  const output=await candidateDirectory(out),raw={};for(const[role,file]of Object.entries(files))raw[role]=await loadRig(file);
  for(const role of ['walk','run'])assertNativeContract(raw.body,raw[role]);
  const records={};for(const[role,file]of Object.entries(files))records[role]=await normalizeOne(file,path.join(output,`${role}-normalized.glb`));
  const normalized={};for(const[role,r]of Object.entries(records))normalized[role]=await loadRig(r.output);for(const role of ['walk','run'])assertNativeContract(normalized.body,normalized[role]);
  const report={schema:1,passed:true,method:'Actual rest skinned positions baked in metres; measured <=100ppm basis residual projected to rigid bone frames; recomputed inverse binds; every native key plus 30Hz re-baked with clamped real skin round-trip proof',limits:{restSkinDrift:1e-5,animationSkinDrift:.0001,jointDrift:1e-5,basisResidual:.0001},records};
  const reportPath=path.join(output,'normalization-receipt.json');await writeFile(reportPath,JSON.stringify(report,null,2)+'\n');return {reportPath,reportSHA256:sha256(await readFile(reportPath)),...report};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{const args=process.argv.slice(2),options={};for(let i=0;i<args.length;i+=2)options[args[i].slice(2)]=args[i+1];const result=await normalizeSources({body:options.body,walk:options.walk,run:options.run},options.out);console.log(JSON.stringify(result));}catch(e){console.error(e.stack);process.exitCode=1;}
}
