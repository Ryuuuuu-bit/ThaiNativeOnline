import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { gltfLoader } from '../src/core/gltf.js';

for (const type of ['boar','fowl','crab','cobra','monkey','dhole','phibpa','buffalo','kongkoi','monitor','pray','khamot','winyan','takian','headless','pret','krahang','krasue','phitaihong','soldier','pusom','croc']) test(`Meshy ${type}: neutral anatomy, planted idle feet and ground contact survive export`, async t => {
  const bytes=await fs.readFile(new URL(`../public/models/monsters/${type}.glb`,import.meta.url));
  const report=JSON.parse(await fs.readFile(new URL(`../tools/monster-models/meshy/${type}-animated.json`,import.meta.url)));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),report.sha256);
  assert.ok(bytes.length<1800000);
  const loader=gltfLoader().register(()=>({name:'QA_TEXTURES',loadTexture:()=>Promise.resolve(new THREE.Texture())}));
  const gltf=await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  let mesh;gltf.scene.traverse(o=>{if(o.isMesh){assert.ok(!mesh,'one material draw');mesh=o;}assert.ok(!/(Target|Pole)$/.test(o.name),'authoring controls stay out of runtime');});
  assert.equal(mesh.skeleton.bones.length,report.bones);
  const feet=mesh.skeleton.bones.filter(b=>b.name.endsWith('Foot'));
  assert.equal(feet.length,{boar:4,fowl:2,crab:8,cobra:0,monkey:4,dhole:4,phibpa:0,buffalo:4,kongkoi:1,monitor:4,pray:0,khamot:0,winyan:0,takian:0,headless:2,pret:2,krahang:2,krasue:0,phitaihong:2,soldier:2,pusom:2,croc:4}[type]);
  const forest=['kongkoi','monitor','pray','khamot','winyan','takian','headless','pret','krahang','krasue','phitaihong','soldier','pusom','croc'].includes(type);
  // These two hover with a source-space bob; runtime lift is measured separately
  // in the map review. Their moving foot bones are not planted ground contacts.
  const airborne=type==='krahang'||type==='krasue';
  if(['kongkoi','pray','winyan','takian'].includes(type)){
    assert.equal(mesh.skeleton.bones.filter(b=>/^Arm[LR](Upper|Lower)$/.test(b.name)).length,4);
    assert.equal(mesh.skeleton.bones.filter(b=>/^Hand[LR]$/.test(b.name)).length,2);
  }
  if(type==='kongkoi')assert.equal(mesh.skeleton.bones.filter(b=>/^Leg(Upper|Lower|Foot)$/.test(b.name)).length,3,'one intentional leg, without a second leg chain');
  if(type==='monitor'||type==='croc')assert.equal(mesh.skeleton.bones.filter(b=>/^Tail(Base|Mid|Tip)$/.test(b.name)).length,3);
  if(type==='takian')assert.ok(!mesh.skeleton.bones.some(b=>/^(Leg|Hem)/.test(b.name)),'stationary root base stays intact');
  if(type==='dhole'||type==='buffalo')assert.equal(mesh.skeleton.bones.filter(b=>b.name.endsWith('Pastern')).length,2,'retain two distinct hind hocks');
  if(type==='phibpa'){
    assert.equal(mesh.skeleton.bones.filter(b=>/^Arm[LR](Upper|Lower)$/.test(b.name)).length,4);
    assert.equal(mesh.skeleton.bones.filter(b=>/^Hand[LR]$/.test(b.name)).length,2,'two intact open hands');
    assert.equal(mesh.skeleton.bones.filter(b=>b.name.startsWith('RootTassel')).length,3,'root clusters instead of human legs');
  }
  const mixer=new THREE.AnimationMixer(gltf.scene),position=mesh.geometry.attributes.position;
  const rest=Array.from({length:position.count},(_,i)=>new THREE.Vector3().fromBufferAttribute(position,i).applyMatrix4(mesh.matrixWorld));
  const point=new THREE.Vector3(),footStart=new Map();let neutralError=0,idleDrift=0,minimum=Infinity,segmentError=0,deathFootLift=0;
  const snakeLengths=new Map(),clipGround={};
  for(const clip of gltf.animations){
    clipGround[clip.name]={minimum:Infinity,frame:0,vertex:0};
    const clipStart=[],motion={maximum:0};
    mixer.stopAllAction();const action=mixer.clipAction(clip);action.setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.reset().play();
    for(let frame=0;frame<=Math.round(clip.duration*24);frame++){
      mixer.setTime(Math.min(clip.duration,frame/24));gltf.scene.updateMatrixWorld(true);mesh.skeleton.update();
      if(forest||type==='cobra'||type==='phibpa'||type==='dhole'||type==='buffalo')for(const joint of mesh.skeleton.bones){
        if(!joint.parent?.isBone)continue;
        if(type!=='cobra'&&!/(Lower|Pastern|Foot)$/.test(joint.name)&&!/^Hand[LR]$/.test(joint.name))continue;
        const length=joint.getWorldPosition(new THREE.Vector3()).distanceTo(joint.parent.getWorldPosition(new THREE.Vector3()));
        if(!snakeLengths.has(joint.name))snakeLengths.set(joint.name,length);
        segmentError=Math.max(segmentError,Math.abs(length-snakeLengths.get(joint.name)));
      }
      if(clip.name==='idle')for(const foot of feet){foot.getWorldPosition(point);if(frame===0)footStart.set(foot.name,point.clone());else idleDrift=Math.max(idleDrift,point.distanceTo(footStart.get(foot.name)));}
      if((type==='dhole'||type==='buffalo')&&clip.name==='die')for(const foot of feet){foot.getWorldPosition(point);deathFootLift=Math.max(deathFootLift,Math.abs(point.y-footStart.get(foot.name).y));}
      for(let i=0;i<position.count;i++){
        mesh.getVertexPosition(i,point);mesh.localToWorld(point);minimum=Math.min(minimum,point.y);
        if(point.y<clipGround[clip.name].minimum)clipGround[clip.name]={minimum:point.y,frame,vertex:i};
        if(frame===0)clipStart[i]=point.clone();else motion.maximum=Math.max(motion.maximum,point.distanceTo(clipStart[i]));
        if(clip.name==='idle'&&frame===0)neutralError=Math.max(neutralError,point.distanceTo(rest[i]));
      }
    }
    clipGround[clip.name].maximumDisplacement=motion.maximum;
    if(forest)assert.ok(motion.maximum>(clip.name==='idle'?.001:.004),`${type} ${clip.name} lost its authored movement during export: ${motion.maximum}m`);
  }
  t.diagnostic(JSON.stringify({type,neutralError,idleDrift,minimum,segmentError,deathFootLift,clipGround}));
  if(type==='cobra'){assert.equal(mesh.skeleton.bones.filter(b=>b.name.startsWith('Coil')).length,5);assert.ok(segmentError<.001,'snake centre-line must not stretch');}
  if(forest||type==='phibpa'||type==='dhole'||type==='buffalo')assert.ok(segmentError<.005,'limb segments must retain their length');
  if(type==='dhole'||type==='buffalo')assert.ok(deathFootLift<.003,'crouching must not lift the feet off the ground');
  assert.ok(neutralError<.004,`neutral pose distorts source anatomy by ${neutralError}m`);
  assert.ok(idleDrift<(airborne?.08:.0015),`idle feet drift ${idleDrift}m`);
  assert.ok(minimum>(airborne?-.15:forest?-.01:-.015),`animated skin penetrates ground: ${minimum}m`);
});
