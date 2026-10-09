import * as THREE from 'three';
import { gltfLoader } from '/src/core/gltf.js';
import { makeMonsterModel, MONSTER_MODELS } from '/src/combat/MonsterModels.js';
import { MONSTERS } from '/src/combat/data/monsters.js';
const params=new URLSearchParams(location.search),set=params.get('set')||'1';
const watRang=set==='6';
const klong=set==='7',fittedSet=watRang||klong,useBaseline=!klong||params.get('baseline')==='1';
const types=({'1':['boar','fowl','crab'],'2':['cobra','monkey'],'3':['dhole','phibpa'],'4':['buffalo'],'5':['kongkoi','monitor','pray','khamot','winyan','takian'],'6':['headless','pret','krahang','krasue','phitaihong','soldier','pusom'],'7':['croc']}[set]||['boar','fowl','crab']), canvas=document.querySelector('canvas'),host=canvas.parentElement;
document.querySelector('.creatures').innerHTML='<button data-type="all" class="active">ดูทั้งชุด</button>'+types.map(id=>`<button data-type="${id}">${MONSTERS[id].name} · Lv.${MONSTERS[id].level}</button>`).join('');
if(set==='2'||set==='3'){document.querySelector('header p').textContent=set==='2'?'งูเห่านา · ลิงกัง — Lv.2':'หมาไน · ผีป่า — Lv.3';document.querySelector('header small').textContent=`THAI NATIVE ONLINE · CREATURE MOTION 0${set}`;}
if(set==='4'){document.querySelector('header p').textContent='บอสทุ่งนา · ควายป่า Lv.4';document.querySelector('header small').textContent='THAI NATIVE ONLINE · PADDY BOSS';}
if(set==='5'){document.querySelector('header h1').textContent='ผู้พิทักษ์แห่งป่าลึก';document.querySelector('header p').textContent='ชุดป่าลึก · มอนสเตอร์ Lv.4–6';document.querySelector('header small').textContent='THAI NATIVE ONLINE · DEEP FOREST';}
if(watRang){document.title='Thai Native Online · Wat Rang motion';document.querySelector('header h1').textContent='วิญญาณแห่งวัดร้าง';document.querySelector('header p').textContent='ชุดวัดร้าง · มอนสเตอร์ Lv.6–10';document.querySelector('header small').textContent='THAI NATIVE ONLINE · WAT RANG';document.body.style.background='#172b29';}
if(klong){document.title='Thai Native Online · Klong Croc motion';document.querySelector('header h1').textContent='คลองหนองบึง';document.querySelector('header p').textContent='จระเข้บึง · Lv.13';document.querySelector('header small').textContent='THAI NATIVE ONLINE · KLONG';document.body.style.background='#203329';}
if(!useBaseline){document.querySelector('#compare').disabled=true;document.querySelector('#compare').parentElement.title='ยังไม่มีโมเดลเดิมให้เทียบ';}
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.18;
const scene=new THREE.Scene();scene.background=new THREE.Color('#73845b');scene.add(new THREE.HemisphereLight('#dde8d3','#5e6244',2.5));
const sun=new THREE.DirectionalLight('#fff0c6',3.1);sun.position.set(-3,8,4);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.normalBias=.025;Object.assign(sun.shadow.camera,{left:-8,right:8,top:6,bottom:-6});scene.add(sun);
const ground=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.MeshStandardMaterial({color:'#657a4b',roughness:1}));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);
if(watRang){scene.background.set('#69736d');ground.material.color.set('#58645a');}
if(klong){scene.background.set('#788679');ground.material.color.set('#64775d');}
const camera=new THREE.OrthographicCamera(-5,5,3,-3,.05,100),dirs={game:[15,23,22],front:[0,3,28],side:[28,3,0],back:[0,3,-28],top:[.001,28,0]};
const initialType=new URLSearchParams(location.search).get('type');
const models=[],originals=[],footprints=[];let type=types.includes(initialType)?initialType:klong||innerWidth<650?types[0]:'all',view='game',clip='idle',paused=false,spin=false,comparison=false,clock=0,start=0;
for(const id of types){
 const model=makeMonsterModel(id,new THREE.Group(),'motion-'+id);scene.add(model);models.push(model);await model.userData.ready;
 if(!model.userData.modelLoaded)throw Error(`Could not load ${id}`);
 const outerScale=fittedSet?MONSTERS[id].size:1;model.scale.setScalar(outerScale);model.updateMatrixWorld(true);
 if(klong)model.userData.sweptVisibleBounds=await crocSweptBounds(id);
 const modelSize=new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
 if(!useBaseline){const group=new THREE.Group();scene.add(group);originals.push(group);footprints.push(Math.max(1.1,Math.hypot(modelSize.x,modelSize.z)/2));continue;}
 const gltf=await gltfLoader().loadAsync(`./baseline/${id}.glb`),original=gltf.scene;
 original.updateMatrixWorld(true);const b=new THREE.Box3().setFromObject(original),size=b.getSize(new THREE.Vector3());
 const group=new THREE.Group();group.scale.setScalar(MONSTER_MODELS[id].height*outerScale/size.y);original.position.set(-(b.min.x+b.max.x)/2,-b.min.y,-(b.min.z+b.max.z)/2);group.add(original);scene.add(group);originals.push(group);
 footprints.push(Math.max(1.1,Math.hypot(modelSize.x,modelSize.z)/2,Math.hypot(size.x,size.z)*group.scale.x/2));
}
function arrange(){
 document.querySelectorAll('[data-type]').forEach(b=>b.classList.toggle('active',b.dataset.type===type));
 const offset=new THREE.Vector3(...dirs[view]),right=new THREE.Vector3(offset.z||1,0,-offset.x).normalize();
 for(let i=0;i<types.length;i++){models[i].visible=type==='all'||types[i]===type;models[i].position.copy(right).multiplyScalar(type==='all'?(i-(types.length-1)/2)*3.4:comparison?1.4:0);originals[i].visible=comparison&&models[i].visible;originals[i].position.copy(models[i].position).add(type==='all'?new THREE.Vector3(-right.z,0,right.x).multiplyScalar(-2.4):right.clone().multiplyScalar(-2.8));}
 if(fittedSet){const gap=.65,total=footprints.reduce((sum,radius)=>sum+radius*2+gap,-gap);let cursor=-total/2;
  const shadowHalf=type==='all'?total/2+4:comparison?Math.max(5,Math.max(...footprints)*3+2):5;Object.assign(sun.shadow.camera,{left:-shadowHalf,right:shadowHalf,top:shadowHalf,bottom:-shadowHalf});sun.shadow.camera.updateProjectionMatrix();
  for(let i=0;i<types.length;i++){const radius=footprints[i],distance=type==='all'?cursor+radius:comparison?radius+.5:0;cursor+=radius*2+gap;
   models[i].position.copy(right).multiplyScalar(distance);
   originals[i].position.copy(type==='all'?models[i].position.clone().add(new THREE.Vector3(-right.z,0,right.x).multiplyScalar(-Math.max(...footprints)*2-.75)):right.clone().multiplyScalar(-distance));
   originals[i].position.y=(MONSTER_MODELS[types[i]].lift??0)*MONSTERS[types[i]].size;
  }
 }
 document.querySelector('#labels').innerHTML=(type==='all'?types:[type]).map(id=>`<div><strong>${MONSTERS[id].name}</strong><span>Lv.${MONSTERS[id].level} · ${MONSTERS[id].hp} HP</span></div>`).join('');
 renderer.setSize(host.clientWidth,host.clientHeight,false);const aspect=host.clientWidth/host.clientHeight,height=type==='all'?2:MONSTER_MODELS[type].height,forestSingle=set==='5'&&type!=='all';
 if(fittedSet){fitWatRangCamera(aspect);return;}
 const width=type==='all'?3.4*types.length+.2:comparison?5.6:forestSingle?(type==='monitor'?3.8:Math.max(2.4,height*1.35)):3.2,half=Math.max(width/2/aspect,forestSingle?height*.70+.12:set==='5'?1.8:type==='all'?1.7:set==='3'||set==='4'?1.4:1.15,view==='top'?(type==='monitor'?1.9:set==='4'?1.8:0):0);
 Object.assign(camera,{left:-half*aspect,right:half*aspect,top:half,bottom:-half});camera.up.set(0,1,0);if(view==='top')camera.up.set(0,0,-1);const target=new THREE.Vector3(0,forestSingle?height*.55:set==='5'?1.0:set==='3'||set==='4'?.85:.5,0);camera.position.copy(target).add(offset);camera.lookAt(target);camera.updateProjectionMatrix();
}
function fitWatRangCamera(aspect){
 const offset=new THREE.Vector3(...dirs[view]),forward=offset.clone().normalize();camera.up.set(0,view==='top'?0:1,view==='top'?-1:0);
 const right=new THREE.Vector3().crossVectors(camera.up,forward).normalize(),up=new THREE.Vector3().crossVectors(forward,right),boxes=[],bounds=new THREE.Box3();
 for(let i=0;i<models.length;i++)for(const model of [models[i],originals[i]]){
  if(!model.visible)continue;const box=klong&&model.userData.sweptVisibleBounds?model.userData.sweptVisibleBounds.clone().applyMatrix4(new THREE.Matrix4().makeRotationY(model.rotation.y)).translate(model.position):new THREE.Box3().setFromObject(model),size=box.getSize(new THREE.Vector3()),radius=Math.hypot(size.x,size.z)/2+.06;
  if(!klong||spin){const sweptRadius=klong?Math.hypot(Math.max(Math.abs(box.min.x-model.position.x),Math.abs(box.max.x-model.position.x)),Math.max(Math.abs(box.min.z-model.position.z),Math.abs(box.max.z-model.position.z)))+.06:radius;box.min.x=model.position.x-sweptRadius;box.max.x=model.position.x+sweptRadius;box.min.z=model.position.z-sweptRadius;box.max.z=model.position.z+sweptRadius;}
  box.min.y=Math.min(0,box.min.y);boxes.push(box);bounds.union(box);
 }
 const target=bounds.getCenter(new THREE.Vector3());let halfWidth=0,halfHeight=0;
 for(const box of boxes)for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){
  const point=new THREE.Vector3(x,y,z).sub(target);halfWidth=Math.max(halfWidth,Math.abs(point.dot(right)));halfHeight=Math.max(halfHeight,Math.abs(point.dot(up)));
 }
 let half=Math.max((halfWidth*1.2+.2)/aspect,halfHeight*1.3+.2);
 if(klong){const stage=host.getBoundingClientRect(),status=document.querySelector('#status').getBoundingClientRect(),labels=document.querySelector('#labels').getBoundingClientRect(),top=Math.max(0,status.bottom-stage.top)+12,bottom=Math.max(0,stage.bottom-labels.top)+12;half=Math.max(half,(halfHeight*1.3+.2)*stage.height/Math.max(1,stage.height-top-bottom));target.addScaledVector(up,(top-bottom)*half/stage.height);}
 Object.assign(camera,{left:-half*aspect,right:half*aspect,top:half,bottom:-half});camera.position.copy(target).add(offset);camera.lookAt(target);camera.updateProjectionMatrix();
}
// Private controller instances sample Croc's actual deformed vertices once.
// The visible model keeps its own clock, skeleton and five-clip controller.
async function crocSweptBounds(id){
 const gltf=await gltfLoader().loadAsync(MONSTER_MODELS[id].url),bounds=new THREE.Box3(),point=new THREE.Vector3();
 for(const name of ['idle','walk','attack','hurt','die']){
  const clip=gltf.animations.find(clip=>clip.name===name);if(!clip||!Number.isFinite(clip.duration)||clip.duration<=0||clip.duration>10)throw Error(`Missing/bounded Croc clip: ${name}`);
  const model=makeMonsterModel(id,new THREE.Group(),`bounds-${id}-${name}`);await model.userData.ready;if(!model.userData.modelLoaded)throw Error('Croc framing model unavailable');model.scale.setScalar(MONSTERS[id].size);
  const duration=clip.duration/(name==='die'?1.4:1)+.2,times=new Set([0,duration]);for(let frame=0;frame<=Math.ceil(duration*24);frame++)times.add(Math.min(frame/24,duration));for(const track of clip.tracks)for(const time of track.times)times.add(Math.min(duration,time/(name==='die'?1.4:1)));
  for(const time of [...times].sort((a,b)=>a-b)){
   model.userData.animate(time,name==='walk',name==='attack',{hurt:name==='hurt',dying:name==='die'});model.updateMatrixWorld(true);
   model.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;mesh.skeleton.update();for(let index=0;index<mesh.geometry.attributes.position.count;index++){mesh.getVertexPosition(index,point);mesh.localToWorld(point);if(![point.x,point.y,point.z].every(Number.isFinite))throw Error('Nonfinite Croc framing vertex');bounds.expandByPoint(point);}});
  }
  model.traverse(mesh=>{if(mesh.isMesh)for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material])material.dispose();});
 }
 return bounds;
}
function update(dt){clock+=dt;const phase=clock-start;
 for(const model of models){model.userData.animate(clock,clip==='walk',clip==='attack'&&phase%1.4<.7,{hurt:clip==='hurt'&&phase%.8<.4,dying:clip==='die'});if(spin)model.rotation.y+=dt*.35;}
 renderer.render(scene,camera);
}
function selectClip(name){clip=name;start=clock;document.querySelectorAll('[data-clip]').forEach(b=>b.classList.toggle('active',b.dataset.clip===name));}
document.querySelectorAll('[data-type]').forEach(b=>b.onclick=()=>{type=b.dataset.type;document.querySelectorAll('[data-type]').forEach(n=>n.classList.toggle('active',n===b));arrange();});
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{view=b.dataset.view;document.querySelectorAll('[data-view]').forEach(n=>n.classList.toggle('active',n===b));arrange();});
document.querySelectorAll('[data-clip]').forEach(b=>b.onclick=()=>selectClip(b.dataset.clip));
document.querySelector('#pause').onclick=()=>{paused=!paused;document.querySelector('#pause').textContent=paused?'เล่นต่อ':'หยุดภาพ';};
document.querySelector('#spin').onclick=()=>{spin=!spin;if(klong)arrange();};document.querySelector('#compare').onchange=e=>{comparison=e.target.checked;arrange();};addEventListener('resize',arrange);
arrange();update(0);let previous=performance.now();renderer.setAnimationLoop(now=>{const dt=Math.min(.1,(now-previous)/1000);previous=now;update(paused?0:dt);});
document.querySelector('#status').textContent='ตรวจท่าทาง · ยืน / เดิน / โจมตี / โดนตี / ล้ม';
window.monsterMotion={models,originals,scene,camera,renderer,types,selectClip,step:update,pause:()=>{paused=true;},reset:()=>location.reload()};window.reviewReady=true;
