// Local source-indexed garment repair. Original geometry, rig and inputs stay intact.
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { GLBBuilder, sha256 } from './glb.mjs';
import { THREE, loadRig, worldVertices, canonicalFrame, assertNativeContract } from './rig.mjs';
import { surfaceGraph, continuousFourWeights } from './weights.mjs';
import { candidateDirectory } from './prepare.mjs';

const smooth = x => { const t = THREE.MathUtils.clamp(x, 0, 1); return t*t*(3-2*t); };

export async function repairSeams({ body, precondition, calibration, patches, family, out }) {
  const rig = await loadRig(body), base = await loadRig(precondition);
  const profile = JSON.parse(await readFile(calibration, 'utf8'));
  const original = worldVertices(rig), rest = worldVertices(base), frame = canonicalFrame(original, profile, profile.height);
  if (original.length !== rest.length) throw Error('Precondition changed vertex count');
  let matchError = 0;
  for (let i=0;i<original.length;i+=3) matchError=Math.max(matchError,new THREE.Vector3().fromArray(original,i).applyMatrix4(frame.matrix).distanceTo(new THREE.Vector3().fromArray(rest,i)));
  if (matchError > 1e-5) throw Error('Source/precondition shape or vertex order differs');
  const graph = surfaceGraph(rig, frame), sourceNames = rig.mesh.skeleton.bones.map(b=>rig.objectNames.get(b));
  const baseNames = base.mesh.skeleton.bones.map(b=>base.objectNames.get(b));
  const fields = graph.points.map(()=>new Float64Array(sourceNames.length)), counts=new Uint32Array(fields.length);
  for(let i=0;i<graph.vertexWeld.length;i++) {
    const n=graph.vertexWeld[i];counts[n]++;
    for(let k=0;k<4;k++) {
      const name=baseNames[base.mesh.geometry.attributes.skinIndex.getComponent(i,k)],j=sourceNames.indexOf(name);
      if(j<0)throw Error('Precondition bone contract changed');
      fields[n][j]+=base.mesh.geometry.attributes.skinWeight.getComponent(i,k);
    }
  }
  for(let i=0;i<fields.length;i++)for(let j=0;j<sourceNames.length;j++)fields[i][j]/=counts[i];
  const patchReports=[];
  for(const patch of patches) {
    if(!patch.reason||!Array.isArray(patch.center)||patch.center.length!==3||!patch.center.every(Number.isFinite)||!(patch.core>0&&patch.feather>patch.core&&patch.feather<=.4))throw Error('Inspected bounded seam patch required');
    const center=new THREE.Vector3(...patch.center),seeds=[];
    for(let i=0;i<graph.points.length;i++)if(graph.points[i].distanceTo(center)<=patch.core)seeds.push(i);
    if(seeds.length<2)throw Error('Patch lacks actual surface seeds');
    const target=new Float64Array(sourceNames.length);
    for(const i of seeds)for(let j=0;j<target.length;j++)target[j]+=fields[i][j]/seeds.length;
    if(patch.target) {
      target.fill(0);
      for(const [name,weight]of Object.entries(patch.target)) {
        const j=sourceNames.indexOf(name);
        if(j<0||!Number.isFinite(weight)||weight<0||weight>1)throw Error('Unknown anatomical target bone/weight');
        target[j]=weight;
      }
      if(Math.abs(target.reduce((a,b)=>a+b,0)-1)>1e-6)throw Error('Anatomical target must sum to one');
    }
    const target4=continuousFourWeights(target);target.fill(0);for(const w of target4)target[w.j]=w.v;
    const distance=new Float64Array(fields.length).fill(Infinity),queue=[...seeds];for(const i of seeds)distance[i]=0;
    for(let q=0;q<queue.length;q++)for(const j of graph.adjacent[queue[q]]) {
      const d=distance[queue[q]]+graph.points[queue[q]].distanceTo(graph.points[j]);
      if(d<distance[j]&&d<=patch.feather){distance[j]=d;queue.push(j);}
    }
    let changed=0;
    for(let i=0;i<fields.length;i++)if(distance[i]<patch.feather) {
      const amount=1-smooth(distance[i]/patch.feather);
      for(let j=0;j<target.length;j++)fields[i][j]=fields[i][j]*(1-amount)+target[j]*amount;
      changed++;
    }
    patchReports.push({...patch,seeds:seeds.length,changedSurfaceVertices:changed,fittedInfluences:target4.map(w=>({bone:sourceNames[w.j],weight:w.v}))});
  }
  const joints=new Uint16Array(graph.vertexWeld.length*4),weights=new Float32Array(joints.length);
  for(let i=0;i<graph.vertexWeld.length;i++) {const four=continuousFourWeights(fields[graph.vertexWeld[i]]);for(let k=0;k<4;k++){joints[i*4+k]=four[k].j;weights[i*4+k]=four[k].v;}}
  const builder=new GLBBuilder();builder.json=structuredClone(rig.json);builder.parts=[Buffer.from(rig.bin)];builder.length=rig.bin.length;
  const primitive=builder.json.meshes[0].primitives[0];primitive.attributes.JOINTS_0=builder.accessor(joints,'VEC4');primitive.attributes.WEIGHTS_0=builder.accessor(weights,'VEC4');
  const output=await candidateDirectory(out),file=path.join(output,'seam-body.glb');await writeFile(file,builder.encode());
  const result=await loadRig(file);assertNativeContract(rig,result);const after=worldVertices(result);let restSkinDrift=0;
  for(let i=0;i<original.length;i+=3)restSkinDrift=Math.max(restSkinDrift,Math.hypot(...[0,1,2].map(k=>original[i+k]-after[i+k])));
  if(restSkinDrift>1e-5)throw Error('Repair moved actual rest geometry');
  for(const r of [rig,base])if(sha256(await readFile(r===rig?body:precondition))!==r.sha256)throw Error('Input changed');
  const receipt={schema:1,family,passed:true,method:'Position-welded actual indexed-surface geodesic feather of measured garment seams toward their existing regional averages or explicit inspected anatomical influences. Four weights remain continuous; no hard region border or across-air adjacency.',input:path.resolve(body),inputSHA256:rig.sha256,precondition:path.resolve(precondition),preconditionSHA256:base.sha256,output:file,outputSHA256:result.sha256,geometryUVIndexNormalTextureAndRigBuffersUnchanged:true,restSkinDrift,matchError,patches:patchReports,limitations:['Rest/provenance checks only; frozen full movement audit required before acceptance.']};
  const receiptPath=path.join(output,'seam-repair-receipt.json');await writeFile(receiptPath,JSON.stringify(receipt,null,2)+'\n');
  return {...receipt,receiptPath,receiptSHA256:sha256(await readFile(receiptPath))};
}
