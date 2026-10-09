import * as THREE from 'three';
import { makeMonsterFallback } from '/src/combat/CombatView.js';
import { gltfLoader } from '/src/core/gltf.js';
import { makeMonsterModel } from '/src/combat/MonsterModels.js';
import { MONSTERS } from '/src/combat/data/monsters.js';
import { MAP_BOSSES, BOSS_SKILLS } from '/src/combat/data/boss-skills.js';
import { MAPS } from '/src/world/maps.js';
import { BossTelegraphs } from '/src/combat/BossTelegraphs.js';
import { disposeCombatModel } from '/src/combat/CombatResources.js';

const canvas=document.querySelector('canvas'),host=canvas.parentElement;
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
const scene=new THREE.Scene();scene.background=new THREE.Color('#6f8274');
scene.add(new THREE.HemisphereLight('#e4ecda','#56634c',2.6));
const sun=new THREE.DirectionalLight('#ffebc9',2.7);sun.position.set(-12,24,15);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.normalBias=.035;
Object.assign(sun.shadow.camera,{left:-16,right:16,top:16,bottom:-16});scene.add(sun);
const root=new THREE.Group();scene.add(root);
let slope=false;
const height=(x,z)=>slope?x*.06+z*.03:0;
const groundGeometry=new THREE.PlaneGeometry(80,80,32,32);groundGeometry.rotateX(-Math.PI/2);
const ground=new THREE.Mesh(groundGeometry,new THREE.MeshStandardMaterial({color:'#748269',roughness:1}));ground.receiveShadow=true;scene.add(ground);
const telegraphs=new BossTelegraphs(root,height),camera=new THREE.OrthographicCamera(-10,10,7,-7,.1,120);
const params=new URLSearchParams(location.search),staticStudy=params.get('static')==='1',allTypes=Object.values(MAP_BOSSES),types=staticStudy?[params.get('type')||'chalawan']:allTypes,mapIds=Object.keys(MAP_BOSSES);
let current=types.includes(params.get('type'))?params.get('type'):'chalawan',skillIndex=0,stage=params.get('motion')==='1'?'cycle':'windup',view='game',paused=false,time=0,loop=0;
let castSerial=0,activeCast=null,released=false;
let bodyFocus=params.get('motion')==='1';
document.querySelector('#body-focus').checked=bodyFocus;
const models=new Map();
document.querySelector('#bosses').innerHTML=types.map(type=>`<button data-type="${type}">${MONSTERS[type].name}</button>`).join('');
for(const type of types) {
  let model;
  if(staticStudy) {
    const gltf=await gltfLoader().loadAsync('/tools/monster-models/meshy/'+type+'.glb');
    const asset=gltf.scene,box=new THREE.Box3().setFromObject(asset),size=box.getSize(new THREE.Vector3()),target={chalawan:1.4,bamboo_grave_3:1.7,sealed_mine_3:1.9,sunken_city_3:1.6,dusk_fort_3:1.8,giant_valley_3:2.1,himmapan_3:1.9,fallen_city_3:1.9,demon_rift_3:2.1}[type];
    model=new THREE.Group();asset.position.set(-(box.min.x+box.max.x)/2,-box.min.y,-(box.min.z+box.max.z)/2);model.add(asset);model.scale.setScalar(target/size.y);model.userData.modelLoaded=true;
    const pivot=new THREE.Group();pivot.add(model);model=pivot;
  } else model=makeMonsterModel(type,makeMonsterFallback(MONSTERS[type]),'boss-review-'+type);
  if(model.userData.ready)await model.userData.ready;
  if(model.userData.motionsReady)await model.userData.motionsReady;
  if(model.userData.ready&&!model.userData.modelLoaded)throw Error('Boss asset failed: '+type);
  model.scale.setScalar(MONSTERS[type].size);model.visible=false;models.set(type,model);root.add(model);
}
function castData(){const skill=BOSS_SKILLS[current][skillIndex];return {...skill,x:0,z:skill.aim==='target'?2:0,facing:0,phase:1,serial:castSerial};}
function motionEvent(nextStage,cast){models.get(current).userData.bossMotionEvent?.({stage:nextStage,cast});}
function drawMarker(){
  telegraphs.clear();loop=0;released=false;activeCast=null;
  if(['windup','impact','cycle'].includes(stage)){
    castSerial++;activeCast=castData();activeCast.remaining=activeCast.windup;
    motionEvent('windup',activeCast);
    if(stage==='impact'){activeCast.remaining=0;motionEvent('impact',activeCast);released=true;}
    telegraphs.event({monster:{id:1,type:current},stage:stage==='impact'?'impact':'windup',cast:activeCast});
  }
}
function fit(bodyOnly=bodyFocus){
  const model=models.get(current);model.updateMatrixWorld(true);
  const box=new THREE.Box3().setFromObject(model,true),s=box.getSize(new THREE.Vector3());
  const casting=!bodyOnly&&['windup','impact','cycle'].includes(stage);
  const radius=casting?castData().radius+1.5:Math.max(s.x,s.z)*.6+1;
  const aspect=host.clientWidth/host.clientHeight;
  const half=(staticStudy||!casting)?Math.max(s.y*.57,Math.max(s.x,s.z)*.56/aspect):Math.max(s.y*.7+1,radius*.8,radius/aspect);
  renderer.setSize(host.clientWidth,host.clientHeight,false);Object.assign(camera,{left:-half*aspect,right:half*aspect,top:half,bottom:-half});
  const offsets={game:[15,23,22],front:[0,3,38],side:[38,3,0],back:[0,3,-38],top:[.001,40,0]};
  const target=(staticStudy||!casting)?box.getCenter(new THREE.Vector3()):new THREE.Vector3(0,s.y*.24,1);
  camera.up.set(0,view==='top'?0:1,view==='top'?-1:0);camera.position.copy(target).add(new THREE.Vector3(...offsets[view]));camera.lookAt(target);camera.updateProjectionMatrix();
  if(staticStudy||!casting) {
    camera.updateMatrixWorld(true);let extentY=0,extentX=0;
    for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){
      const point=new THREE.Vector3(x,y,z).applyMatrix4(camera.matrixWorldInverse);
      extentY=Math.max(extentY,Math.abs(point.y));extentX=Math.max(extentX,Math.abs(point.x));
    }
    const framed=Math.max(extentY,extentX/aspect)*1.12;
    Object.assign(camera,{left:-framed*aspect,right:framed*aspect,top:framed,bottom:-framed});camera.updateProjectionMatrix();
  }
}
function select(type=current,index=skillIndex,nextStage=stage,nextView=view){
  if(activeCast)motionEvent('cancel',activeCast);
  current=type;skillIndex=index;stage=nextStage;view=nextView;
  document.querySelector('.caption').style.display=staticStudy||view!=='game'?'none':'';
  for(const [id,m] of models){m.visible=id===current;m.position.set(0,height(0,0),0);m.rotation.y=0;}
  document.querySelector('#map').textContent=MAPS[mapIds[allTypes.indexOf(current)]].name+' · Lv.'+MONSTERS[current].level+(staticStudy?' · ตรวจร่าง Meshy':'');
  document.querySelector('#name').textContent=MONSTERS[current].name;
  document.querySelector('#skill-name').textContent=({idle:'ท่ายืน',walk:'ท่าเดิน',attack:'ท่าโจมตี',hurt:'เมื่อโดนตี',die:'ท่าพ่ายแพ้'})[stage]??BOSS_SKILLS[current][skillIndex].name;
  document.querySelector('#skills').innerHTML=BOSS_SKILLS[current].map((s,i)=>`<button data-skill="${i}" class="${i===skillIndex?'active':''}">${s.name}</button>`).join('');
  document.querySelectorAll('[data-type]').forEach(b=>b.classList.toggle('active',b.dataset.type===current));
  document.querySelectorAll('[data-stage]').forEach(b=>b.classList.toggle('active',b.dataset.stage===stage));
  document.querySelector('#view').value=view;drawMarker();fit();render(0);
}
function render(dt){
  time+=dt;loop+=dt;
  if(stage==='cycle'&&activeCast){
    if(loop>=activeCast.windup&&!released){
      released=true;activeCast.remaining=0;motionEvent('impact',activeCast);
      telegraphs.event({monster:{id:1,type:current},stage:'impact',cast:activeCast});
    }
    if(loop>activeCast.windup+1.6)drawMarker();
    if(!released)activeCast.remaining=Math.max(0,activeCast.windup-loop);
  }
  if(stage==='windup'&&activeCast)activeCast.remaining=Math.max(0,activeCast.windup-loop);
  const model=models.get(current);
  model.userData.animate?.(time,stage==='walk',false,{hurt:false,dying:false,bossCast:activeCast&&!released?activeCast:null});
  const item=telegraphs.items.get(1);
  if(item){
    // Cycle follows the same warning duration and event order as combat.
    // Individual stage buttons retain an isolated production-marker witness.
    if(stage==='cycle')telegraphs.update(dt,{x:0,z:0});
    else{item.elapsed=item.duration*(stage==='windup'?.58:.38);telegraphs.update(0,{x:0,z:0});}
  }
  renderer.render(scene,camera);
}
document.querySelector('#bosses').onclick=e=>{const b=e.target.closest('[data-type]');if(b)select(b.dataset.type,0);};
document.querySelector('#skills').onclick=e=>{const b=e.target.closest('[data-skill]');if(b)select(current,+b.dataset.skill);};
document.querySelectorAll('[data-stage]').forEach(b=>b.onclick=()=>select(current,skillIndex,b.dataset.stage));
document.querySelector('#view').onchange=e=>select(current,skillIndex,stage,e.target.value);
document.querySelector('#pause').onclick=()=>{paused=!paused;document.querySelector('#pause').textContent=paused?'เล่นต่อ':'หยุดภาพ';};
document.querySelector('#body-focus').onchange=e=>{bodyFocus=e.target.checked;fit();render(0);};
document.querySelector('#slope').onchange=e=>{
  slope=e.target.checked;const p=ground.geometry.attributes.position;for(let i=0;i<p.count;i++)p.setY(i,height(p.getX(i),p.getZ(i)));p.needsUpdate=true;ground.geometry.computeVertexNormals();select();
};
window.addEventListener('resize',fit);
window.bossReview={types,models,telegraphs,renderer,camera,select,render,setTime(t){time=t;render(0);},
 async motionPose(type,index,nextPhase,at,nextView='game',bodyOnly=false){
  if(!['windup','impact','cancel'].includes(nextPhase)||!Number.isFinite(at)||at<0||at>5)throw Error('Invalid bounded motion witness');
  renderer.setAnimationLoop(null);paused=true;
  const old=models.get(type);root.remove(old);disposeCombatModel(old);
  const model=makeMonsterModel(type,new THREE.Group(),'motion-'+type);await model.userData.ready;
  await model.userData.motionsReady;
  if(!model.userData.modelLoaded)throw Error('Missing approved boss body');
  model.scale.setScalar(MONSTERS[type].size);models.set(type,model);root.add(model);time=0;
  select(type,index,'windup',nextView);
  model.userData.animate(0,false,false,{bossCast:activeCast});
  const warning=activeCast.windup,prepare=nextPhase==='windup'?at:warning;
  for(let frame=1;frame<=Math.ceil(prepare*30);frame++){
    time=Math.min(frame/30,prepare);activeCast.remaining=Math.max(0,warning-time);
    model.userData.animate(time,false,false,{bossCast:activeCast});
  }
  if(nextPhase!=='windup'){
    motionEvent(nextPhase,activeCast);released=true;stage=nextPhase;
    telegraphs.event({monster:{id:1,type:current},stage:nextPhase,cast:activeCast});
    for(let frame=1;frame<=Math.ceil(at*30);frame++)model.userData.animate(warning+Math.min(frame/30,at),false,false,{bossCast:null});
  }
  const marker=telegraphs.items.get(1);
  if(marker){marker.elapsed=nextPhase==='windup'?Math.min(at,warning):Math.min(at,marker.duration);telegraphs.update(0,{x:0,z:0});}
  model.updateMatrixWorld(true);model.traverse(o=>o.skeleton?.update());fit(bodyOnly);renderer.render(scene,camera);
  return model.userData.animationState?.();
 },
 async pose(type,clip,at,nextView='game'){
  renderer.setAnimationLoop(null);paused=true;
  const old=models.get(type);root.remove(old);
  disposeCombatModel(old);
  const model=makeMonsterModel(type,new THREE.Group(),'pose-'+type+'-'+clip);await model.userData.ready;
  await model.userData.motionsReady;
  if(!model.userData.modelLoaded)throw Error('Missing rigged pose asset');
  model.scale.setScalar(MONSTERS[type].size);models.set(type,model);root.add(model);
  time=0;
  select(type,0,clip,nextView);
  for(let frame=0;frame<=Math.ceil(at*24);frame++)model.userData.animate(Math.min(frame/24,at),clip==='walk',clip==='attack',{hurt:clip==='hurt',dying:clip==='die'});
  model.updateMatrixWorld(true);model.traverse(o=>o.skeleton?.update());fit();renderer.render(scene,camera);
 },get state(){return {type:current,index:skillIndex,stage,view};},capture(){render(0);return canvas.toDataURL('image/png');}};
select();let previous=performance.now();renderer.setAnimationLoop(now=>{const dt=Math.min(.05,(now-previous)/1000);previous=now;if(!paused)render(dt);});
if(['1','2'].includes(params.get('gallery'))) {
  renderer.setAnimationLoop(null);
  const main=document.querySelector('main');
  main.querySelectorAll('nav,.stage,.controls,.note').forEach(e=>e.remove());
  const gallery=document.createElement('section');gallery.className='gallery';
  const second=params.get('gallery')==='2', galleryTypes=second?['sunken_city_3','dusk_fort_3','giant_valley_3','himmapan_3','fallen_city_3','demon_rift_3']:['chalawan','bamboo_grave_3','sealed_mine_3'],folder=second?'boss-detail-02':'boss-detail';
  document.querySelector('h1').textContent=second?'บอสแห่งดินแดนไทย · Lv.50–100':'บอสใหม่ · Lv.25–40';
  document.querySelector('header p').textContent=second?'นาคราช · อสูรสนธยา · ยักษ์หุบเขา · ปักษาทมิฬ · ขุนพลอาคม · อสูรรอยแยก':'ชาละวัน · เจ้าป่าช้า · ผู้พิทักษ์เหมือง';
  gallery.innerHTML=galleryTypes.map(type=>`<article><img alt="${MONSTERS[type].name}" src="/docs/art/${folder}/${type}-model.png"><p>${MONSTERS[type].name}<span>${MAPS[mapIds[allTypes.indexOf(type)]] .name} · Lv.${MONSTERS[type].level}</span></p></article>`).join('');
  main.append(gallery);
}
