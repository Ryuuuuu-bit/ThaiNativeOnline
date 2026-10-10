// Read-only edge witnesses from actual packed skin; never edits gates or assets.
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { loadRig, worldVertices, clampedSampler, sampleTimes, restoreRest } from './rig.mjs';
import { indexEdges, LIMITS } from './audit.mjs';
import { candidateDirectory } from './prepare.mjs';

const file=process.argv[2];if(!file)throw Error('Usage: diagnose.mjs candidate.glb');
const rig=await loadRig(file);restoreRest(rig);const rest=worldVertices(rig),edges=indexEdges(rig.mesh.geometry,rest),reports=[];
const geom=rig.mesh.geometry;
function skin(id){const joints=geom.attributes.skinIndex,weights=geom.attributes.skinWeight;return [0,1,2,3].map(c=>({bone:rig.mesh.skeleton.bones[joints.getComponent(id,c)].name,weight:weights.getComponent(id,c)})).filter(w=>w.weight>1e-5);}
for(const clip of rig.gltf.animations){
 const sampler=clampedSampler(rig,clip),worst=new Map();
 try{for(const time of sampleTimes(clip)){sampler.at(time);const points=worldVertices(rig);
 for(const edge of edges){const a=edge.a*3,b=edge.b*3,length=Math.hypot(points[a]-points[b],points[a+1]-points[b+1],points[a+2]-points[b+2]),ratio=length/edge.length,extension=length-edge.length;
 if(ratio<=LIMITS.edgeRatio||extension<=LIMITS.edgeExtension)continue;
 const key=`${edge.a}:${edge.b}`,previous=worst.get(key);if(previous&&previous.ratio>=ratio)continue;
 worst.set(key,{...edge,time,ratio,extension,restA:Array.from(rest.subarray(a,a+3)),restB:Array.from(rest.subarray(b,b+3)),posedA:Array.from(points.subarray(a,a+3)),posedB:Array.from(points.subarray(b,b+3)),skinA:skin(edge.a),skinB:skin(edge.b)});}
 }}finally{sampler.dispose();}
 reports.push({clip:clip.name,distinctBadEdges:worst.size,worst:[...worst.values()].sort((a,b)=>b.ratio-a.ratio).slice(0,12)});
}
const out=await candidateDirectory('artifacts/city-npc-models/edge-witnesses'),family=path.basename(file,'.glb');
await writeFile(path.join(out,`${family}-${rig.sha256.slice(0,12)}.json`),JSON.stringify({sourceSHA256:rig.sha256,reports},null,2)+'\n');
console.log(JSON.stringify({family,sha256:rig.sha256,clips:reports.map(c=>({...c,worst:c.worst.slice(0,1)}))}));
