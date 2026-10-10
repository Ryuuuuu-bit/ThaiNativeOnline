// Local per-body topology/UV cloth selection, preserving original GLB buffers.
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {GLBBuilder,sha256} from './glb.mjs';
import {loadRig,worldVertices,THREE,canonicalFrame,canonicalWorlds,assertNativeContract} from './rig.mjs';
import {surfaceGraph,continuousFourWeights} from './weights.mjs';
import {candidateDirectory,packingDependencies} from './prepare.mjs';

const median=values=>values.sort((a,b)=>a-b)[Math.floor(values.length/2)];
const colourDistance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
const smooth=(a,b,x)=>{const t=THREE.MathUtils.clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};

export async function repairCloth({body,precondition,calibration,family,out,deps,thighShare=.15,feather=.08,transition=.45}){
 const rig=await loadRig(body),base=await loadRig(precondition),profile=JSON.parse(await readFile(calibration,'utf8')),before=worldVertices(rig),baseVertices=worldVertices(base);
 if(before.length!==baseVertices.length)throw Error('Precondition changed vertex count');
 const frame=canonicalFrame(before,profile,profile.height),worlds=canonicalWorlds(rig,frame),at=n=>new THREE.Vector3().setFromMatrixPosition(worlds.get(n)),scale=profile.height/1.72,hip=at('Hips');
 let matchError=0;for(let i=0;i<before.length;i+=3)matchError=Math.max(matchError,new THREE.Vector3().fromArray(before,i).applyMatrix4(frame.matrix).distanceTo(new THREE.Vector3().fromArray(baseVertices,i)));
 if(matchError>.00001)throw Error(`Precondition/source vertex order/shape differs ${matchError}`);
 const graph=surfaceGraph(rig,frame),{sharp}=packingDependencies(deps),material=rig.json.materials[0],image=rig.json.images[rig.json.textures[material.pbrMetallicRoughness.baseColorTexture.index].source],view=rig.json.bufferViews[image.bufferView];
 const {data,info}=await sharp(rig.bin.subarray(view.byteOffset??0,(view.byteOffset??0)+view.byteLength)).removeAlpha().raw().toBuffer({resolveWithObject:true});
 const uv=rig.mesh.geometry.attributes.uv,transform=material.pbrMetallicRoughness.baseColorTexture.extensions?.KHR_texture_transform??{},repeat=transform.scale??[1,1],offset=transform.offset??[0,0];
 const colour=i=>{const x=THREE.MathUtils.clamp(Math.floor((offset[0]+uv.getX(i)*repeat[0])*info.width),0,info.width-1),y=THREE.MathUtils.clamp(Math.floor((offset[1]+uv.getY(i)*repeat[1])*info.height),0,info.height-1);return [...data.subarray((y*info.width+x)*info.channels,(y*info.width+x)*info.channels+3)];};
 const sourceNames=rig.mesh.skeleton.bones.map(o=>rig.objectNames.get(o)),baseNames=base.mesh.skeleton.bones.map(o=>base.objectNames.get(o)),handIds=new Set(['LeftHand','RightHand'].map(n=>sourceNames.indexOf(n))),skinColours=[],clothColours=[];
 const bodyHalf=Math.abs(at('LeftArm').x-at('RightArm').x)*.65;
 for(let i=0;i<before.length/3;i++){
  const p=graph.points[graph.vertexWeld[i]],c=colour(i);let handWeight=0;for(let k=0;k<4;k++)if(handIds.has(rig.mesh.geometry.attributes.skinIndex.getComponent(i,k)))handWeight+=rig.mesh.geometry.attributes.skinWeight.getComponent(i,k);
  if(handWeight>.995&&Math.min(p.distanceTo(at('LeftHand')),p.distanceTo(at('RightHand')))>.075*scale)skinColours.push(c);
  if(p.y>hip.y-.14*scale&&p.y<hip.y+.18*scale&&Math.abs(p.x-hip.x)<bodyHalf*.90)clothColours.push(c);
 }
 if(skinColours.length<20||clothColours.length<30)throw Error('Insufficient actual skin/cloth UV seeds');
 const skin=Array.from({length:3},(_,k)=>median(skinColours.map(c=>c[k]))),bins=new Map();
 for(const c of clothColours){const key=c.map(v=>Math.floor(v/32)).join(':');if(!bins.has(key))bins.set(key,[]);bins.get(key).push(c);}
 const palette=[...bins.values()].sort((a,b)=>b.length-a.length).slice(0,8).map(group=>Array.from({length:3},(_,k)=>median(group.map(c=>c[k]))));
 const ids=rig.mesh.geometry.index.array,mask=new Uint8Array(graph.points.length);let faces=0;
 for(let t=0;t<ids.length;t+=3){const indices=[ids[t],ids[t+1],ids[t+2]],points=indices.map(i=>graph.points[graph.vertexWeld[i]]),centre=points.reduce((s,p)=>s.add(p),new THREE.Vector3()).divideScalar(3),c=indices.map(colour).reduce((s,c)=>s.map((v,k)=>v+c[k]/3),[0,0,0]);
  if(centre.y<Math.max(.20*scale,hip.y-.70*scale)||centre.y>at('Spine').y-.04*scale||Math.abs(centre.x-hip.x)>bodyHalf+.09*scale)continue;
  const clothDistance=Math.min(...palette.map(p=>colourDistance(p,c))),skinDistance=colourDistance(skin,c);
  if(clothDistance>skinDistance*.95+5)continue;
  faces++;for(const i of indices)mask[graph.vertexWeld[i]]=1;
 }
 const domains=['body','head','LeftArm','RightArm','LeftLeg','RightLeg'],seeds=Object.fromEntries(domains.map(n=>[n,new Set()]));
 for(let i=0;i<before.length/3;i++){
  const node=graph.vertexWeld[i],p=graph.points[node];
  if(p.y>hip.y-.08*scale&&p.y<hip.y+.08*scale&&Math.abs(p.x-hip.x)<bodyHalf*.75)seeds.body.add(node);
  for(let k=0;k<4;k++){const name=sourceNames[rig.mesh.geometry.attributes.skinIndex.getComponent(i,k)],w=rig.mesh.geometry.attributes.skinWeight.getComponent(i,k);if(w<.995)continue;
   if(['Head','head_end','headfront'].includes(name)&&p.y>at('neck').y+.08*scale)seeds.head.add(node);
   for(const side of ['Left','Right']){if(name===side+'Hand'&&p.distanceTo(at(side+'Hand'))>.075*scale)seeds[side+'Arm'].add(node);if([side+'Foot',side+'ToeBase',side+'Leg'].includes(name)&&p.y<at(side+'Leg').y-.10*scale)seeds[side+'Leg'].add(node);}
  }
 }
 const geodesic={};
 for(const domain of domains){
  if(!seeds[domain].size)throw Error(`Actual source lacks ${domain} topology seed`);
  const distance=new Float64Array(graph.points.length).fill(Infinity),queue=[...seeds[domain]];for(const i of queue)distance[i]=0;
  for(let q=0;q<queue.length;q++){const i=queue[q];for(const j of graph.adjacent[i]){const d=distance[i]+graph.points[i].distanceTo(graph.points[j]);if(d+1e-12<distance[j]){distance[j]=d;queue.push(j);}}}
  geodesic[domain]=distance;
 }
 // Distance on actual indexed cloth topology: source UV/face border feathers
 // toward the original skin, never across air or nearby fingers/other legs.
 const distance=new Float64Array(graph.points.length).fill(Infinity),queue=[];
 for(let i=0;i<mask.length;i++)if(!mask[i]||[...graph.adjacent[i]].some(j=>!mask[j])){distance[i]=0;queue.push(i);}
 const limit=feather*scale;
 for(let q=0;q<queue.length;q++){const i=queue[q];for(const j of graph.adjacent[i])if(mask[j]){const d=distance[i]+graph.points[i].distanceTo(graph.points[j]);if(d<distance[j]&&d<=limit){distance[j]=d;queue.push(j);}}}
 const originalBase=base.mesh.geometry.attributes,indices=new Uint16Array(before.length/3*4),weights=new Float32Array(indices.length);let changed=0;
 const clothIds=[];
 for(let i=0;i<before.length/3;i++){
  const node=graph.vertexWeld[i],p=graph.points[node],old=new Float64Array(sourceNames.length);for(let k=0;k<4;k++){const name=baseNames[originalBase.skinIndex.getComponent(i,k)],j=sourceNames.indexOf(name);if(j<0)throw Error('Precondition joint disappeared');old[j]+=originalBase.skinWeight.getComponent(i,k);}
  const bodyDistance=geodesic.body[node],otherDistance=Math.min(...domains.filter(n=>n!=='body').map(n=>geodesic[n][node]));
  const amount=Number.isFinite(bodyDistance)&&Number.isFinite(otherDistance)?smooth(-transition*scale,transition*scale,otherDistance-bodyDistance):0,field=old.slice();
  if(amount>0){const torso=smooth(hip.y+.02*scale,hip.y+.22*scale,p.y),side=smooth(hip.x-.05*scale,hip.x+.05*scale,p.x),target=new Float64Array(sourceNames.length);
   target[sourceNames.indexOf('Spine02')]=torso;target[sourceNames.indexOf('Hips')]=(1-torso)*(1-thighShare);target[sourceNames.indexOf('LeftUpLeg')]=(1-torso)*thighShare*side;target[sourceNames.indexOf('RightUpLeg')]=(1-torso)*thighShare*(1-side);
   for(let j=0;j<field.length;j++)field[j]=field[j]*(1-amount)+target[j]*amount;changed++;clothIds.push(i);
  }
  // Opposite distal limb influence is excluded by actual surface-route distance,
  // with a continuous transition through the shared pelvis/shoulder topology.
  for(let j=0;j<field.length;j++)for(const kind of ['Arm','Leg']){
   const isMember=kind==='Arm'?/(Shoulder|Arm|Hand)$/.test(sourceNames[j]):/(UpLeg|Leg|Foot|ToeBase)$/.test(sourceNames[j]);
   if(!isMember)continue;const side=sourceNames[j].startsWith('Left')?'Left':sourceNames[j].startsWith('Right')?'Right':null;if(!side)continue;
   const mine=geodesic[side+kind][node],other=geodesic[(side==='Left'?'Right':'Left')+kind][node];if(Number.isFinite(mine)&&Number.isFinite(other))field[j]*=1-smooth(.10*scale,.35*scale,mine-other);
  }
  const w=continuousFourWeights(field);for(let k=0;k<4;k++){indices[i*4+k]=w[k].j;weights[i*4+k]=w[k].v;}
 }
 const builder=new GLBBuilder();builder.json=structuredClone(rig.json);builder.parts=[Buffer.from(rig.bin)];builder.length=rig.bin.length;
 const primitive=builder.json.meshes[0].primitives[0];primitive.attributes.JOINTS_0=builder.accessor(indices,'VEC4');primitive.attributes.WEIGHTS_0=builder.accessor(weights,'VEC4');
 const output=await candidateDirectory(out),file=path.join(output,'cloth-body.glb');await writeFile(file,builder.encode());
 const result=await loadRig(file),after=worldVertices(result);assertNativeContract(rig,result);let restSkinDrift=0;for(let i=0;i<before.length;i+=3)restSkinDrift=Math.max(restSkinDrift,Math.hypot(before[i]-after[i],before[i+1]-after[i+1],before[i+2]-after[i+2]));
 if(restSkinDrift>1e-5)throw Error('Cloth repair moved original rest shape');
 if(sha256(await readFile(body))!==rig.sha256||sha256(await readFile(precondition))!==base.sha256)throw Error('Original input changed');
 const report={schema:1,family,passed:true,method:'Actual source indexed-surface geodesic anatomical domains seeded at verified waist/head/hands/distal legs; smooth body-to-limb routing preserves garment/skin boundaries; lower wrap Hips plus its own thigh, torso Spine02; original source-buffer geometry/rig/textures preserved; movement QA still required',input:path.resolve(body),inputSHA256:rig.sha256,precondition:path.resolve(precondition),preconditionSHA256:base.sha256,output:file,outputSHA256:result.sha256,limits:{restSkinDrift:1e-5,sourceMatchError:1e-5},restSkinDrift,matchError,parameters:{thighShare,feather,transition},mask:{faces,vertices:changed,skinPalette:skin,clothPalette:palette,bodyHalf,seeds:Object.fromEntries(domains.map(n=>[n,seeds[n].size]))},maskSourceVertexIndices:clothIds};
 const reportPath=path.join(output,'cloth-repair-receipt.json');await writeFile(reportPath,JSON.stringify(report,null,2)+'\n');return{...report,reportPath,reportSHA256:sha256(await readFile(reportPath))};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{const args=process.argv.slice(2),o={};for(let i=0;i<args.length;i+=2)o[args[i].slice(2)]=args[i+1];if(o['thigh-share'])o.thighShare=+o['thigh-share'];if(o.feather)o.feather=+o.feather;const r=await repairCloth(o);console.log(JSON.stringify({family:r.family,output:r.output,sha256:r.outputSHA256,mask:r.mask,restSkinDrift:r.restSkinDrift,report:r.reportPath}));}catch(e){console.error(e.stack);process.exitCode=1;}
}
