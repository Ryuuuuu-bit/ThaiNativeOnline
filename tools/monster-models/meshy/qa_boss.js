import * as THREE from '/node_modules/three/build/three.module.js';
import { clone } from '/node_modules/three/examples/jsm/utils/SkeletonUtils.js';
import { gltfLoader } from '/src/core/gltf.js';
import { makeMonsterModel, MONSTER_MODELS } from '/src/combat/MonsterModels.js';
import { MONSTERS } from '/src/combat/data/monsters.js';

const clips = ['idle', 'walk', 'attack', 'hurt', 'die'];
const meshesOf = root => { const result=[]; root.traverse(mesh=>{if(mesh.isMesh)result.push(mesh);});return result; };
const update = root => { root.updateMatrixWorld(true); for(const mesh of meshesOf(root))mesh.skeleton?.update(); };
const timesOf = clip => {
  if(!Number.isFinite(clip.duration)||clip.duration<=0||clip.duration>10)throw Error(`Unbounded clip ${clip.name}`);
  const times=new Set([0,clip.duration]);for(let frame=0;frame<=Math.ceil(clip.duration*24);frame++)times.add(Math.min(frame/24,clip.duration));
  for(const track of clip.tracks)for(const time of track.times){if(!Number.isFinite(time)||time<0||time>clip.duration+1e-5)throw Error('Invalid animation key');times.add(Math.min(time,clip.duration));}
  return [...times].sort((a,b)=>a-b);
};
function positions(mesh){
  const values=new Float64Array(mesh.geometry.attributes.position.count*3),point=new THREE.Vector3();
  for(let i=0;i<values.length/3;i++){mesh.getVertexPosition(i,point);mesh.localToWorld(point);if(![point.x,point.y,point.z].every(Number.isFinite))throw Error('Nonfinite deformed vertex');point.toArray(values,i*3);}
  return values;
}
const distance=(p,a,b)=>Math.hypot(p[a*3]-p[b*3],p[a*3+1]-p[b*3+1],p[a*3+2]-p[b*3+2]);
const materials=mesh=>Array.isArray(mesh.material)?mesh.material:[mesh.material];
function edgesOf(mesh,rest){
  if(!mesh.geometry.index)throw Error('Indexed surface required');const index=mesh.geometry.index,seen=new Set(),edges=[];
  for(let i=0;i<index.count;i+=3){const tri=[index.getX(i),index.getX(i+1),index.getX(i+2)];for(let j=0;j<3;j++){
    const a=Math.min(tri[j],tri[(j+1)%3]),b=Math.max(tri[j],tri[(j+1)%3]),key=`${a}:${b}`;if(seen.has(key))continue;seen.add(key);
    const length=distance(rest,a,b);if(length>=.005)edges.push({a,b,length});
  }}return edges;
}
function triangleArea(p,a,b,c){
  const ab=new THREE.Vector3(p[b*3]-p[a*3],p[b*3+1]-p[a*3+1],p[b*3+2]-p[a*3+2]),ac=new THREE.Vector3(p[c*3]-p[a*3],p[c*3+1]-p[a*3+1],p[c*3+2]-p[a*3+2]);return ab.cross(ac).length()/2;
}
export async function auditBoss(type,rig){
  const failures=[],result={type,sampling:'all exported keys + 24 Hz; actual indexed edges >= 5 mm',thresholds:{edgeRatio:2,edgeExtensionSourceMetres:.01,limbLengthSourceMetres:.005,idleFootDriftSourceMetres:.0015,flatGroundRuntimeMetres:-.01},failures,clips:[]};
  const spec=MONSTER_MODELS[type],outerSize=MONSTERS[type].size;
  if(!spec)throw Error('Missing approved boss spec');
  result.runtimeSpec={...spec,outerSize,worldTargetHeight:spec.height*outerSize};
  const serpent=type==='sunken_city_3'; const count=serpent?0:2; if(rig?.taxon!==(serpent?'serpent':'humanoid-biped')||!Array.isArray(rig.legs)||rig.legs.length!==count||new Set(rig.legs.map(leg=>leg.name)).size!==count||!Array.isArray(rig.bones)||serpent&&rig.arms.length)throw Error('Authoritative measured species report unavailable');
  const response=await fetch(spec.url);if(!response.ok)throw Error(`Boss fetch failed: ${response.status}`);
  const bytes=await response.arrayBuffer(),hash=await crypto.subtle.digest('SHA-256',bytes);
  result.asset={url:spec.url,bytes:bytes.byteLength,sha256:[...new Uint8Array(hash)].map(n=>n.toString(16).padStart(2,'0')).join('')};
  const gltf=await gltfLoader().parseAsync(bytes,spec.url.slice(0,spec.url.lastIndexOf('/')+1));
  if(gltf.animations.map(clip=>clip.name).sort().join(',')!==clips.slice().sort().join(','))throw Error('Expected exactly five exported clips');
  const source=clone(gltf.scene);update(source);const all=meshesOf(source),skinned=all.filter(mesh=>mesh.isSkinnedMesh);
  if(all.length!==1||skinned.length!==1)throw Error('Expected one actual skinned surface');const mesh=skinned[0],geometry=mesh.geometry;
  const draws=Array.isArray(mesh.material)?geometry.groups.filter(group=>group.count>0).length:1,triangles=(geometry.index?.count??geometry.attributes.position.count)/3;
  result.budget={triangles,materialDraws:draws,maximumTriangles:15000,maximumMaterialDraws:1};if(triangles>15000||draws!==1)failures.push('Actual surface triangle/draw budget');
  const textures=[];for(const material of materials(mesh))for(const slot of ['map','normalMap','roughnessMap','metalnessMap'])if(material[slot]){
    const image=material[slot].image;const width=image?.width??0,height=image?.height??0;textures.push({slot,width,height});if(!width||!height)failures.push(`Undecoded ${slot}`);
  }result.decodedTextures=textures;if(!textures.some(texture=>texture.slot==='map'))failures.push('No decoded base colour texture');
  const weights=geometry.attributes.skinWeight,indices=geometry.attributes.skinIndex;if(!weights||!indices||weights.count!==geometry.attributes.position.count||indices.count!==weights.count||weights.itemSize!==4||indices.itemSize!==4)throw Error('Invalid skin attributes');
  let maxSumError=0;for(let i=0;i<weights.count;i++){let sum=0;for(let slot=0;slot<4;slot++){
    const weight=weights.getComponent(i,slot),index=indices.getComponent(i,slot);if(!Number.isFinite(weight)||weight<0||weight>1||!Number.isInteger(index)||index<0||index>=mesh.skeleton.bones.length)throw Error(`Invalid bone influence at ${i}`);sum+=weight;
  }maxSumError=Math.max(maxSumError,Math.abs(sum-1));}result.weights={vertices:weights.count,maxSumError,limit:1e-5};if(maxSumError>1e-5)failures.push('Weights are not normalized');
  const bones=new Map(mesh.skeleton.bones.map(bone=>[bone.name,bone])),definitions=new Map(rig.bones.map(bone=>[bone.name,bone])),limbs=[];
  for(const leg of [...rig.legs,...(rig.arms??[])])for(const [part,next] of [['Upper','Lower'],['Lower',rig.legs.includes(leg)?'Foot':'Hand']]){
    const name=leg.name+part,childName=next==='Hand'?leg.hand:leg.name+next,bone=bones.get(name),child=bones.get(childName),definition=definitions.get(name),childDefinition=definitions.get(childName);
    if(!bone||!child||!definition||!childDefinition||child.parent!==bone)throw Error(`Missing limb hierarchy ${name}/${childName}`);
    if(new THREE.Vector3(...definition.tail).distanceTo(new THREE.Vector3(...childDefinition.head))>1e-5)throw Error(`Noncontiguous source limb ${name}`);
    limbs.push({name,childName,bone,child,expected:new THREE.Vector3(...definition.head).distanceTo(new THREE.Vector3(...definition.tail))});
  }
  const attachments=rig.bones.filter(b=>['Club','Sword','WingL','WingR'].includes(b.name)).map(b=>({name:b.name,parent:b.parent}));
  for(const attachment of attachments){
    const expected=/Wing/.test(attachment.name)?'Body':'HandR';
    if(attachment.parent!==expected||bones.get(attachment.name)?.parent!==bones.get(expected))throw Error('Invalid rigid attachment hierarchy '+attachment.name);
  }
  const feet=rig.legs.map(leg=>{const bone=bones.get(leg.name+'Foot');if(!bone)throw Error(`Missing foot ${leg.name}`);return{name:bone.name,bone};});
  const rest=positions(mesh),edges=edgesOf(mesh,rest),index=geometry.index,restAreas=[];for(let i=0;i<index.count;i+=3)restAreas.push(triangleArea(rest,index.getX(i),index.getX(i+1),index.getX(i+2)));
  const contactVertices=[];
  if(serpent){
    for(let i=0;i<weights.count;i++)for(let slot=0;slot<4;slot++)if(mesh.skeleton.bones[indices.getComponent(i,slot)].name==='GroundCoil'&&weights.getComponent(i,slot)>.999)contactVertices.push(i);
    if(contactVertices.length<100)throw Error('Measured grounded coil mask missing');
  }
  result.sourceRest={height:new THREE.Box3().setFromObject(source).getSize(new THREE.Vector3()).y,indexedEdges:edges.length};
  for(const name of clips){
    // A fresh exported-clip clone gives exact source timeline samples independent
    // of controller cross-fades. Native controller clearance is checked below.
    const raw=clone(gltf.scene);update(raw);const rawMesh=meshesOf(raw)[0],rawBones=new Map(rawMesh.skeleton.bones.map(bone=>[bone.name,bone])),clip=gltf.animations.find(clip=>clip.name===name),mixer=new THREE.AnimationMixer(raw),action=mixer.clipAction(clip);
    action.setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.play();
    const values={name,duration:clip.duration,samples:0,edgesOverLimits:0,maxEdgeRatio:1,worstEdge:null,maxLimbLengthError:0,limbWorst:null,idleFootDrift:[],minimumTriangleAreaRatio:1,areaWorst:null,rigidAttachments:attachments.map(a=>({...a,maximumSkinMatrixDifference:0,limit:.0001}))};
    const footStart=new Map();let maxMotion=0,groundedCoilDrift=0;
    for(const time of timesOf(clip)){
      mixer.setTime(time);update(raw);const current=positions(rawMesh);values.samples++;
      for(const attachment of values.rigidAttachments){
        const transform=bone=>new THREE.Matrix4().multiplyMatrices(rawBones.get(bone).matrixWorld,rawMesh.skeleton.boneInverses[rawMesh.skeleton.bones.findIndex(b=>b.name===bone)]);
        const owned=transform(attachment.name).elements,parent=transform(attachment.parent).elements;
        attachment.maximumSkinMatrixDifference=Math.max(attachment.maximumSkinMatrixDifference,...owned.map((v,i)=>Math.abs(v-parent[i])));
      }
      for(const i of contactVertices)groundedCoilDrift=Math.max(groundedCoilDrift,Math.hypot(...[0,1,2].map(axis=>current[i*3+axis]-rest[i*3+axis])));
      for(const edge of edges){const length=distance(current,edge.a,edge.b),ratio=length/edge.length,extension=length-edge.length;values.maxEdgeRatio=Math.max(values.maxEdgeRatio,ratio);
        if(ratio>2&&extension>.01){values.edgesOverLimits++;if(!values.worstEdge||extension>values.worstEdge.extension)values.worstEdge={time,indices:[edge.a,edge.b],rest:edge.length,length,ratio,extension,sourceCoordinates:[edge.a,edge.b].map(i=>Array.from(rest.slice(i*3,i*3+3))),weights:[edge.a,edge.b].map(i=>Array.from({length:4},(_,slot)=>({bone:rawMesh.skeleton.bones[rawMesh.geometry.attributes.skinIndex.getComponent(i,slot)].name,weight:rawMesh.geometry.attributes.skinWeight.getComponent(i,slot)})))};}
      }
      for(const limb of limbs){const length=rawBones.get(limb.name).getWorldPosition(new THREE.Vector3()).distanceTo(rawBones.get(limb.childName).getWorldPosition(new THREE.Vector3())),error=Math.abs(length-limb.expected);if(error>values.maxLimbLengthError){values.maxLimbLengthError=error;values.limbWorst={name:limb.name,time,sourceLength:limb.expected,actualLength:length};}}
      if(name==='idle')for(const foot of feet){const position=rawBones.get(foot.name).getWorldPosition(new THREE.Vector3());if(!footStart.has(foot.name))footStart.set(foot.name,{position,maximum:0});const first=footStart.get(foot.name);first.maximum=Math.max(first.maximum,position.distanceTo(first.position));}
      // Area contraction is reported honestly, without inventing an acceptance
      // threshold that would substitute for the independent anatomy/art gate.
      for(let i=0;i<restAreas.length;i++){if(restAreas[i]<1e-8)continue;const ratio=triangleArea(current,index.getX(i*3),index.getX(i*3+1),index.getX(i*3+2))/restAreas[i];if(ratio<values.minimumTriangleAreaRatio){values.minimumTriangleAreaRatio=ratio;const vertices=[index.getX(i*3),index.getX(i*3+1),index.getX(i*3+2)];values.areaWorst={time,triangle:i,restArea:restAreas[i],ratio,sourceCoordinates:vertices.map(v=>Array.from(rest.slice(v*3,v*3+3))),deformedCoordinates:vertices.map(v=>Array.from(current.slice(v*3,v*3+3)))};}}
      for(let i=0;i<current.length;i++)maxMotion=Math.max(maxMotion,Math.abs(current[i]-rest[i]));
    }
    values.idleFootDrift=[...footStart].map(([name,value])=>({name,maximum:value.maximum}));values.maximumSourceVertexMotion=maxMotion;
    if(serpent){values.groundedCoil={vertices:contactVertices.length,maximumDrift:groundedCoilDrift,limit:.0015};if(groundedCoilDrift>.0015)failures.push(`${name}: grounded coil drift exceeds source 1.5 mm`);}
    if(values.edgesOverLimits)failures.push(`${name}: ${values.edgesOverLimits} indexed edge/sample failures`);
    for(const attachment of values.rigidAttachments)if(attachment.maximumSkinMatrixDifference>attachment.limit)failures.push(`${name}: ${attachment.name} differs from its rigid ${attachment.parent} ownership`);
    if(values.maxLimbLengthError>.005)failures.push(`${name}: limb length error ${values.maxLimbLengthError}`);
    if(values.idleFootDrift.some(foot=>foot.maximum>.0015))failures.push('idle: foot drift exceeds source 1.5 mm');
    if(maxMotion<.0001)failures.push(`${name}: no measurable exported surface motion`);
    mixer.stopAllAction();mixer.uncacheRoot(raw);
    const runtime=makeMonsterModel(type,new THREE.Group(),`qa-${type}-${name}`);await runtime.userData.ready;if(!runtime.userData.modelLoaded)throw Error('Native boss controller unavailable');runtime.scale.setScalar(outerSize);
    const duration=clip.duration/(name==='die'?1.4:1)+.2,nativeTimes=new Set([0,duration]);for(let frame=0;frame<=Math.ceil(duration*24);frame++)nativeTimes.add(Math.min(frame/24,duration));for(const time of timesOf(clip))nativeTimes.add(time/(name==='die'?1.4:1));
    let minimum=Infinity,samples=0;for(const time of [...nativeTimes].sort((a,b)=>a-b)){
      runtime.userData.animate(time,name==='walk',name==='attack',{hurt:name==='hurt',dying:name==='die'});update(runtime);for(const mesh of meshesOf(runtime)){const points=positions(mesh);for(let i=1;i<points.length;i+=3)minimum=Math.min(minimum,points[i]);}samples++;
    }values.nativeFlatClearance={minimum,samples};if(minimum<-.01)failures.push(`${name}: native flat-ground clearance ${minimum}`);
    for(const mesh of meshesOf(runtime))for(const material of materials(mesh))material.dispose();result.clips.push(values);
  }
  result.limbSampling={chains:rig.legs.map(leg=>leg.name),segments:limbs.map(limb=>({name:limb.name,expectedSourceLength:limb.expected})),idleContactScope:serpent?'rigid grounded coil source vertices; no invented feet':'two exported foot bone origins; surface toe contact and locomotion stance require visual review'};
  result.acceptance='Independent species anatomy, prop, wing, coil and sole visual review required; numerical pass does not establish art acceptance';return result;
}
