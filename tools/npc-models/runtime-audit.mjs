// Independent read-only production pose audit. No family/profile/public writes.
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NPC } from '../../src/entities/NPC.js';
import { NPCS } from '../../src/data/npcs.js';
import { makeLook } from '../../src/npc/NPCData.js';
import { NPC_MODELS, NPC_PROP_FRAMES, createMeshy24NPCPoseAdapter } from '../../src/npc/NPCModels.js';
import { NPCModelRenderer } from '../../src/npc/NPCModelRenderer.js';
import { GEAR_PARTS } from '../../src/npc/body/gearParts.js';
import { THREE, loadRig, worldVertices, sampleTimes } from './rig.mjs';
import { LIMITS, indexEdges, edgeStrain, kneeMetrics } from './audit.mjs';
import { REPO, candidateDirectory } from './prepare.mjs';
import { sha256 } from './glb.mjs';

const root=path.join(REPO,'artifacts/city-npc-models');
const point=(values,i)=>new THREE.Vector3().fromArray(values,i*3);
const pos=b=>b.getWorldPosition(new THREE.Vector3());
const round=n=>Number.isFinite(n)?+n.toFixed(7):String(n);

function scenarios(spec) {
  const result=new Map(),add=(id,state,anim,carrying=false,kind='authored-role')=>{
    const key=[state,anim,carrying].join(':');
    if(!result.has(key))result.set(key,{id,state,anim,carrying,kind});
  };
  for(const id of spec.npcIds) {
    const def=NPCS.find(n=>n.id===id);if(!def)throw Error('Missing actual NPC '+id);
    for(const activity of Object.values(def.schedule??{})) {
      if(activity.do==='stay')add(id,activity.state??'idle',activity.anim??'look');
      else if(activity.do==='route')for(const stop of activity.stops??[])if(typeof stop==='object')add(id,stop.state??'idle',stop.anim??'look',!!activity.carry);
    }
  }
  add(spec.npcIds[0],'idle','look',false,'available-idle');
  add(spec.npcIds[0],'talk','talk',false,'actual-interaction');
  add(spec.npcIds[0],'walk','walk',false,'native-phase');
  add(spec.npcIds[0],'walk','run',false,'available-native-phase');
  return [...result.values()];
}

function roleTimes(npc,duration,hz) {
  const times=new Set([0,duration]);
  for(let i=0;i<=Math.floor(duration*hz);i++)times.add(i/hz);
  // Also witness exact sine extrema from the authored pose cycles, including
  // slower look/rest/idle periods extending beyond the bounded dense window.
  const frequencies={look:[.4,2],guard:[.35],pray:[],lean:[.5],talk:[3.1,[2.3,1],1.3,4],sell:[2.4,.5,.9],hammer:[5],sweep:[3],grind:[6],gather:[.8,2],box:[6,3],sword:[2.6],aim:[.7],chant:[2.4],rest:[.3],work:[1.5,2.5]};
  for(const cycle of [...(frequencies[npc.anim]??[]),...(npc.state==='idle'?[2*Math.PI/4.4,2*Math.PI/7.6]:[])]) {
    const [w,phase]=Array.isArray(cycle)?cycle:[cycle,0];
    const end=Math.max(duration,2*Math.PI/w);
    for(let k=Math.ceil((w*npc.seed+phase-Math.PI/2)/Math.PI);;k++){
      const t=(Math.PI/2+k*Math.PI-phase)/w-npc.seed;
      if(t>end+1e-7)break;if(t>=0)times.add(t);
    }
  }
  return [...times].sort((a,b)=>a-b);
}

export async function auditRuntimeFamily({family,record,profile,hz=30,duration=8}) {
  const spec=NPC_MODELS[family],file=record.outputs.candidate.path,rig=await loadRig(file),sha=record.outputs.candidate.sha256;
  if(rig.sha256!==sha)throw Error('Frozen body SHA changed');
  const adapter=JSON.parse(await readFile(record.outputs.adapter.path,'utf8'));
  if(sha256(await readFile(record.outputs.adapter.path))!==record.outputs.adapter.sha256)throw Error('Frozen adapter SHA changed');
  if(profile.geometryAssetSha256!==sha)throw Error('Runtime profile belongs to another geometry revision');
  for(const [name,node]of Object.entries(adapter.nodes))for(const key of ['idleWorld','bindWorld'])if(JSON.stringify(node[key])!==JSON.stringify(profile.calibration.nodes?.[name]?.[key]))throw Error('Runtime/frozen calibration mismatch: '+name+'/'+key);
  const rest=worldVertices(rig),edges=indexEdges(rig.mesh.geometry,rest),results=[];
  const options={...profile,qaApproved:true,revision:spec.revision,assetSha256:sha,geometryAssetSha256:sha};
  for(const scenario of scenarios(spec)) {
    const def=NPCS.find(n=>n.id===scenario.id),npc=new NPC(def,makeLook(def),{});
    Object.assign(npc,{shown:true,dirty:true,seed:npc.seed,state:scenario.state,anim:scenario.anim,carrying:scenario.carrying,x:0,y:0,z:0,yaw:0,distance:0});
    if(scenario.state==='talk')npc.talkTarget={x:0,z:1};
    const errors=[],scene=new THREE.Scene(),source={...rig.gltf,assetSha256:sha};
    const renderer=new NPCModelRenderer(scene,[npc],{loadModel:()=>source,createAdapter:(model,context)=>createMeshy24NPCPoseAdapter(model,context,profile.calibration,options),onError:(_spec,e)=>errors.push(e.message)});
    await renderer.ready;
    const entry=renderer.entries.get(npc);
    if(!entry?.model)throw Error('Actual renderer preparation failed: '+errors.join(';'));
    const policies={roleMotion:entry.adapter.roleMotion,activityPoses:entry.adapter.activityPoses,toolFit:entry.adapter.toolFit};
    let mesh;entry.model.traverse(o=>{if(o.isSkinnedMesh)mesh=o;});
    const runtimeRig={gltf:{scene},mesh},bones=new Map(mesh.skeleton.bones.map(b=>[b.name,b]));
    const floorParts = ({monk_novice:['broom'],boatman:['paddle'],city_guard:['spear','spearTip'],gate_supplier:['basket'],
      master_sword:['sword','swordScabbard'],master_bandit:['knife','knifeScabbard'],enhancer:['hammer'],master_hunter:['bow']})[family] ?? [];
    const propGeometry = new Map(floorParts.map(name => [name, GEAR_PARTS.find(p=>p.name===name).geo()]));
    const segments=[];for(const side of ['Left','Right'])for(const [a,b]of [['Arm','ForeArm'],['ForeArm','Hand'],['UpLeg','Leg'],['Leg','Foot']])segments.push({a:side+a,b:side+b,length:pos(rig.names.get(side+a)).distanceTo(pos(rig.names.get(side+b)))});
    const names=rig.mesh.skeleton.bones.map(b=>rig.objectNames.get(b)),hands=[];
    for(let i=0;i<rest.length/3;i++)for(const name of ['LeftHand','RightHand']){let w=0;for(let k=0;k<4;k++)if(names[rig.mesh.geometry.attributes.skinIndex.getComponent(i,k)]===name)w+=rig.mesh.geometry.attributes.skinWeight.getComponent(i,k);if(w>=.999999)hands.push({i,name,local:point(rest,i).applyMatrix4(rig.names.get(name).matrixWorld.clone().invert())});}
    const moving=scenario.state==='walk',clip=rig.gltf.animations.find(c=>c.name===(moving?scenario.anim:'idle'));
    const times=moving?[...new Set([...sampleTimes(clip,hz),Math.max(0,clip.duration-1e-5)])].sort((a,b)=>a-b):roleTimes(npc,duration,hz);
    const metrics={samples:0,activeSamples:0,edgeViolations:0,maxEdgeRatio:1,maxEdgeExtension:0,maxSegmentDrift:0,maxRigidHandDrift:0,backwardKneeSamples:0,minFloor:Infinity,maxFootDriftFromFirst:0,maxHandTravelFromFirst:0};
    let worst=null,worstFloor=null,firstFeet,firstHands,broomFloor=Infinity;const failures=new Set(), propFloors={};
    try {
      for(const time of times) {
        const dt=metrics.samples?time-times[metrics.samples-1]:0;
        if(moving)npc.walkPhase=time/clip.duration*2*Math.PI;
        npc.animate(time,0,scenario.state,scenario.anim);renderer.update(dt,time);metrics.samples++;
        const status=renderer.status(npc);
        if(!status.active){failures.add('actual renderer '+(status.reason??'inactive')+(status.error?': '+status.error:''));continue;}
        metrics.activeSamples++;
        const values=worldVertices(runtimeRig),strain=edgeStrain(values,edges);
        if(!Array.from(values).every(Number.isFinite)){failures.add('nonfinite actual skin');continue;}
        metrics.edgeViolations+=strain.violations;metrics.maxEdgeRatio=Math.max(metrics.maxEdgeRatio,strain.maxRatio);metrics.maxEdgeExtension=Math.max(metrics.maxEdgeExtension,strain.maxExtension);
        for(let i=1;i<values.length;i+=3)if(values[i]<metrics.minFloor){metrics.minFloor=values[i];worstFloor={time,vertex:(i-1)/3,rest:point(rest,(i-1)/3).toArray(),posed:point(values,(i-1)/3).toArray()};}
        for(const s of segments)metrics.maxSegmentDrift=Math.max(metrics.maxSegmentDrift,Math.abs(pos(bones.get(s.a)).distanceTo(pos(bones.get(s.b)))-s.length));
        const inverseHands=new Map(['LeftHand','RightHand'].map(n=>[n,bones.get(n).matrixWorld.clone().invert()]));
        for(const h of hands)metrics.maxRigidHandDrift=Math.max(metrics.maxRigidHandDrift,point(values,h.i).applyMatrix4(inverseHands.get(h.name)).distanceTo(h.local));
        for(const side of ['Left','Right'])if(kneeMetrics(pos(bones.get(side+'UpLeg')),pos(bones.get(side+'Leg')),pos(bones.get(side+'Foot')),new THREE.Vector3(0,0,1)).backward)metrics.backwardKneeSamples++;
        const feet=['LeftFoot','RightFoot'].map(n=>pos(bones.get(n)));firstFeet??=feet.map(p=>p.clone());if(!moving)for(let i=0;i<2;i++)metrics.maxFootDriftFromFirst=Math.max(metrics.maxFootDriftFromFirst,feet[i].distanceTo(firstFeet[i]));
        const handPositions=['LeftHand','RightHand'].map(n=>pos(bones.get(n)));firstHands??=handPositions.map(p=>p.clone());for(let i=0;i<2;i++)metrics.maxHandTravelFromFirst=Math.max(metrics.maxHandTravelFromFirst,handPositions[i].distanceTo(firstHands[i]));
        for (const [name, geometry] of propGeometry) if (entry.visibleParts.has(name)) {
          const p=new THREE.Vector3(), a=geometry.attributes.position;
          for(let i=0;i<a.count;i++) propFloors[name]=Math.min(propFloors[name]??Infinity,p.fromBufferAttribute(a,i).applyMatrix4(npc.frames[NPC_PROP_FRAMES[name]]).y-npc.y);
        }
        broomFloor=propFloors.broom??Infinity;
        if(strain.violations)for(const e of edges){const a=point(values,e.a),b=point(values,e.b),length=a.distanceTo(b),ratio=length/e.length,extension=length-e.length;if(ratio>LIMITS.edgeRatio&&extension>LIMITS.edgeExtension&&(!worst||ratio>worst.ratio)){const skin=i=>Array.from({length:4},(_,k)=>({bone:mesh.skeleton.bones[mesh.geometry.attributes.skinIndex.getComponent(i,k)].name,weight:mesh.geometry.attributes.skinWeight.getComponent(i,k)})).filter(w=>w.weight>0);worst={time,edge:[e.a,e.b],ratio,extension,rest:[point(rest,e.a).toArray(),point(rest,e.b).toArray()],posed:[a.toArray(),b.toArray()],skin:[skin(e.a),skin(e.b)]};}}
      }
    }finally{renderer.dispose();for(const geometry of propGeometry.values())geometry.dispose();}
    if(metrics.edgeViolations)failures.add('indexed edge strain');
    for (const [name, floor] of Object.entries(propFloors)) if (floor < -.01) failures.add(name+' penetrates local floor');
    if(metrics.maxSegmentDrift>LIMITS.segmentDrift)failures.add('limb length drift');
    if(metrics.maxRigidHandDrift>LIMITS.handDrift)failures.add('rigid hand skin drift');
    if(metrics.backwardKneeSamples)failures.add('backwards knee flexion');
    if(metrics.minFloor<LIMITS.floor)failures.add('floor penetration');
    if(Number.isFinite(broomFloor)){metrics.minimumBroomFloor=broomFloor;if(broomFloor<LIMITS.floor)failures.add('broom floor penetration');}
    const result={...scenario,passed:failures.size===0,failures:[...failures],...policies,propFloors:Object.fromEntries(Object.entries(propFloors).map(([k,v])=>[k,round(v)])),metrics:Object.fromEntries(Object.entries(metrics).map(([k,v])=>[k,round(v)])),worst,worstFloor};results.push(result);
    if(!result.passed)console.log(JSON.stringify({family,id:scenario.id,state:scenario.state,anim:scenario.anim,passed:false,failures:result.failures,edges:metrics.edgeViolations,worst:worst?{time:worst.time,edge:worst.edge,ratio:round(worst.ratio),extension:round(worst.extension),rest:worst.rest}:null}));
  }
  for(const r of Object.values(record.outputs))if(sha256(await readFile(r.path))!==r.sha256)throw Error('Frozen family output changed during audit');
  return {family,canonicalCandidate:file,sha256:sha,profileHash:sha256(Buffer.from(JSON.stringify(profile))),passed:results.every(r=>r.passed),results};
}

export async function runRuntimeAudit({families,hz=30,duration=8,out,wai=false}={}) {
  if(!Number.isInteger(hz)||hz<16||hz>30||duration<2||duration>16)throw Error('Bounded actual sampling required');
  const frozen=JSON.parse(await readFile(path.join(root,'passing-bodies-freeze.json'),'utf8')),catalogBytes=await readFile(path.join(root,'candidate-profiles.json')),catalog=JSON.parse(catalogBytes),rows=new Map(frozen.families.map(r=>[r.family,r.receipt]));rows.set('warp_keeper',path.join(root,'warp_keeper/freeze-receipt.json'));
  // Weight-corrected monks have a forward promotion receipt. Never rewrite
  // historical freezes to pretend the initial geometry passed the new pose.
  const promotion = JSON.parse(await readFile(path.join(root, 'monk-root-promotion/3120ac7501fe946156dec51c9af20be4ec691dd777e25a8d1c0e190e54448cbb/promotion-receipt.json')));
  if (promotion.status !== 'MONK2_PREPARATION_ROOT_PROMOTION_COMPLETE') throw Error('Monk promotion incomplete');
  for (const result of promotion.results) {
    const record = result.record;
    for (const key of ['candidate', 'qa', 'adapter', 'calibration', 'guide']) {
      const pin = record.outputs[key];
      if (sha256(await readFile(pin.path)) !== pin.sha256) throw Error('Promoted monk input changed: ' + key);
    }
    rows.set(record.family ?? result.family, record);
  }
  // Accept a specialist's frozen native receipt without creating or changing
  // that family's outputs. Every input is pinned exactly as for the baseline.
  for(const p of catalog.families)if(!rows.has(p.family)){
    if(!NPC_MODELS[p.family])throw Error('Unknown staged family');
    const dir=path.join(root,p.family),receiptPath=path.join(dir,'validation-receipt.json'),v=JSON.parse(await readFile(receiptPath,'utf8'));
    if(v.schema!==1||v.family!==p.family||v.status!=='FROZEN_NATIVE_PASS'||v.assetSha256!==p.geometryAssetSha256)throw Error('Staged body lacks matching frozen native receipt');
    const outputs={};for(const[key,suffix,pin]of [['candidate','.glb','assetSha256'],['qa','-qa.json','qaSha256'],['calibration','-calibration.json','calibrationSha256'],['adapter','-adapter.json','adapterSha256'],['guide','-guide.json','guideSha256']]){
      const file=path.join(dir,p.family+suffix);if(sha256(await readFile(file))!==v[pin])throw Error('Frozen specialist input changed: '+file);outputs[key]={path:file,sha256:v[pin]};
    }
    if(JSON.parse(await readFile(outputs.qa.path,'utf8')).audit?.passed!==true)throw Error('Native body QA not passed');
    outputs.validation={path:receiptPath,sha256:sha256(await readFile(receiptPath))};rows.set(p.family,{outputs});
  }
  const activityEnabled=wai||catalog.families.some(p=>p.activityPoses?.wai===true);
  const selected=families?families.split(','):[...rows.keys()],output=await candidateDirectory(out??path.join(root,'runtime-qa')),runtimeFiles=['src/entities/NPC.js','src/npc/NPCModels.js','src/npc/NPCModelRenderer.js','src/npc/NPCData.js','src/npc/body/rig.js','src/npc/body/gearParts.js','src/data/npcs.js'],pins={};
  runtimeFiles.push('src/npc/body/blade.js', 'src/npc/NPCToolPresentation.js');
  if(activityEnabled)runtimeFiles.push('src/npc/NPCActivityPoses.js');
  for(const file of runtimeFiles)pins[file]=sha256(await readFile(path.join(REPO,file)));
  const results=[];
  for(const family of selected){
    try {
      if(!rows.has(family))throw Error('Family lacks frozen passing receipt');const row=rows.get(family),record=typeof row==='string'?JSON.parse(await readFile(row,'utf8')):row;
      let profile=catalog.families.find(p=>p.family===family);
      if(!profile){const contactFile=path.join(root,`contacts/${family}-${record.outputs.candidate.sha256.slice(0,12)}-contacts.json`),contact=JSON.parse(await readFile(contactFile,'utf8'));profile={family,geometryAssetSha256:record.outputs.candidate.sha256,assetSha256:record.outputs.candidate.sha256,calibration:JSON.parse(await readFile(record.outputs.adapter.path,'utf8')),...contact.profileFields};if(contact.assetSha256!==record.outputs.candidate.sha256)throw Error('Contact receipt SHA mismatch');}
      if(wai&&['monk_elder','monk_novice'].includes(family))profile={...profile,activityPoses:{...profile.activityPoses,wai:true}};
      const result=await auditRuntimeFamily({family,record,profile,hz,duration});results.push(result);await writeFile(path.join(output,`${family}-runtime.json`),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({family,passed:result.passed,scenarios:result.results.length,samples:result.results.reduce((n,r)=>n+r.metrics.samples,0)}));
    }catch(e){results.push({family,passed:false,blocked:e.message});console.log(JSON.stringify({family,blocked:e.message}));}
  }
  for(const[file,hash]of Object.entries(pins))if(sha256(await readFile(path.join(REPO,file)))!==hash)throw Error('Runtime changed during audit; repeat against a frozen runtime revision');
  const helperBytes=await readFile(fileURLToPath(import.meta.url)),helperSnapshot=path.join(output,'runtime-audit-helper.snapshot.mjs'),catalogSnapshot=path.join(output,'catalog.snapshot.json');
  await writeFile(helperSnapshot,helperBytes);await writeFile(catalogSnapshot,catalogBytes);
  const receipt={schema:1,passed:results.every(r=>r.passed),runtime:pins,auditHelperSHA256:sha256(helperBytes),auditHelperSnapshot:helperSnapshot,catalogSHA256:sha256(catalogBytes),catalogSnapshot,limits:LIMITS,sampling:{hz,denseRoleSeconds:duration,additionalAuthoredSineExtrema:true,nativeKeys:true,nativeEndpoint:'actual production modulo wrap, plus pre-end sample',canonicalBodies:true},scope:'Actual NPC.animate + NPCModelRenderer + createMeshy24NPCPoseAdapter; isolated QA approval/hash injection only, no registration/publication or family writes',results,limitations:['Representative actual identity per distinct authored state/animation/carrying; not every seed or possible future clock time.','No city navigation/terrain/browser rendering or prop geometry/contact collision audit.','Numeric skin evidence does not grant visual Art approval.']};const file=path.join(output,'runtime-audit.json');await writeFile(file,JSON.stringify(receipt,null,2)+'\n');return{passed:receipt.passed,file,families:results.length,failed:results.filter(r=>!r.passed).map(r=>r.family)};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{const options={},args=process.argv.slice(2);for(let i=0;i<args.length;i+=2){const key=args[i].slice(2);if(!['families','hz','duration','out','wai'].includes(key)||!args[i+1])throw Error('Usage: runtime-audit.mjs [--families LIST --hz 30 --duration 8 --out ignored-directory --wai true]');if(key==='wai'&&!['true','false'].includes(args[i+1]))throw Error('Wai opt-in must be true/false');options[key]=['hz','duration'].includes(key)?+args[i+1]:key==='wai'?args[i+1]==='true':args[i+1];}const result=await runRuntimeAudit(options);console.log(JSON.stringify(result));if(!result.passed)process.exitCode=1;}catch(e){console.error(e.stack);process.exitCode=1;}
}
