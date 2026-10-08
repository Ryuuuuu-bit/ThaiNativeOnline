import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { gltfLoader } from '../src/core/gltf.js';

for (const type of ['boar','fowl','crab']) test(`Meshy ${type}: neutral anatomy, planted idle feet and ground contact survive export`, async () => {
  const bytes=await fs.readFile(new URL(`../public/models/monsters/${type}.glb`,import.meta.url));
  const report=JSON.parse(await fs.readFile(new URL(`../tools/monster-models/meshy/${type}-animated.json`,import.meta.url)));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),report.sha256);
  assert.ok(bytes.length<1800000);
  const loader=gltfLoader().register(()=>({name:'QA_TEXTURES',loadTexture:()=>Promise.resolve(new THREE.Texture())}));
  const gltf=await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  let mesh;gltf.scene.traverse(o=>{if(o.isMesh){assert.ok(!mesh,'one material draw');mesh=o;}assert.ok(!/(Target|Pole)$/.test(o.name),'authoring controls stay out of runtime');});
  assert.equal(mesh.skeleton.bones.length,report.bones);
  const feet=mesh.skeleton.bones.filter(b=>b.name.endsWith('Foot'));
  assert.equal(feet.length,{boar:4,fowl:2,crab:8}[type]);
  const mixer=new THREE.AnimationMixer(gltf.scene),position=mesh.geometry.attributes.position;
  const rest=Array.from({length:position.count},(_,i)=>new THREE.Vector3().fromBufferAttribute(position,i).applyMatrix4(mesh.matrixWorld));
  const point=new THREE.Vector3(),footStart=new Map();let neutralError=0,idleDrift=0,minimum=Infinity;
  for(const clip of gltf.animations){
    mixer.stopAllAction();const action=mixer.clipAction(clip);action.setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.reset().play();
    for(let frame=0;frame<=Math.round(clip.duration*24);frame++){
      mixer.setTime(Math.min(clip.duration,frame/24));gltf.scene.updateMatrixWorld(true);mesh.skeleton.update();
      if(clip.name==='idle')for(const foot of feet){foot.getWorldPosition(point);if(frame===0)footStart.set(foot.name,point.clone());else idleDrift=Math.max(idleDrift,point.distanceTo(footStart.get(foot.name)));}
      for(let i=0;i<position.count;i++){
        mesh.getVertexPosition(i,point);mesh.localToWorld(point);minimum=Math.min(minimum,point.y);
        if(clip.name==='idle'&&frame===0)neutralError=Math.max(neutralError,point.distanceTo(rest[i]));
      }
    }
  }
  assert.ok(neutralError<.004,`neutral pose distorts source anatomy by ${neutralError}m`);
  assert.ok(idleDrift<.0015,`idle feet drift ${idleDrift}m`);
  assert.ok(minimum>-.015,`animated skin penetrates ground: ${minimum}m`);
});
