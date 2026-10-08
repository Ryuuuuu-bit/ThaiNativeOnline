import * as THREE from 'three';
import { gltfLoader } from '/src/core/gltf.js';
import { makeMonsterModel, MONSTER_MODELS } from '/src/combat/MonsterModels.js';
import { MONSTERS } from '/src/combat/data/monsters.js';
const types=['boar','fowl','crab'], canvas=document.querySelector('canvas'),host=canvas.parentElement;
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.18;
const scene=new THREE.Scene();scene.background=new THREE.Color('#73845b');scene.add(new THREE.HemisphereLight('#dde8d3','#5e6244',2.5));
const sun=new THREE.DirectionalLight('#fff0c6',3.1);sun.position.set(-3,8,4);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.normalBias=.025;Object.assign(sun.shadow.camera,{left:-8,right:8,top:6,bottom:-6});scene.add(sun);
const ground=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.MeshStandardMaterial({color:'#657a4b',roughness:1}));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);
const camera=new THREE.OrthographicCamera(-5,5,3,-3,.05,100),dirs={game:[15,23,22],front:[0,3,28],side:[28,3,0],back:[0,3,-28],top:[.001,28,0]};
const initialType=new URLSearchParams(location.search).get('type');
const models=[],originals=[];let type=types.includes(initialType)?initialType:innerWidth<650?'boar':'all',view='game',clip='idle',paused=false,spin=false,comparison=false,clock=0,start=0;
for(const id of types){
 const model=makeMonsterModel(id,new THREE.Group(),'motion-'+id);scene.add(model);models.push(model);await model.userData.ready;
 if(!model.userData.modelLoaded)throw Error(`Could not load ${id}`);
 const gltf=await gltfLoader().loadAsync(`./baseline/${id}.glb`),original=gltf.scene;
 original.updateMatrixWorld(true);const b=new THREE.Box3().setFromObject(original),size=b.getSize(new THREE.Vector3());
 const group=new THREE.Group();group.scale.setScalar(MONSTER_MODELS[id].height/size.y);original.position.set(-(b.min.x+b.max.x)/2,-b.min.y,-(b.min.z+b.max.z)/2);group.add(original);scene.add(group);originals.push(group);
}
function arrange(){
 document.querySelectorAll('[data-type]').forEach(b=>b.classList.toggle('active',b.dataset.type===type));
 const offset=new THREE.Vector3(...dirs[view]),right=new THREE.Vector3(offset.z||1,0,-offset.x).normalize();
 for(let i=0;i<3;i++){models[i].visible=type==='all'||types[i]===type;models[i].position.copy(right).multiplyScalar(type==='all'?(i-1)*3.4:comparison?1.4:0);originals[i].visible=comparison&&models[i].visible;originals[i].position.copy(models[i].position).add(type==='all'?new THREE.Vector3(-right.z,0,right.x).multiplyScalar(-2.4):right.clone().multiplyScalar(-2.8));}
 document.querySelector('#labels').innerHTML=(type==='all'?types:[type]).map(id=>`<div><strong>${MONSTERS[id].name}</strong><span>Lv.${MONSTERS[id].level} · ${MONSTERS[id].hp} HP</span></div>`).join('');
 renderer.setSize(host.clientWidth,host.clientHeight,false);const aspect=host.clientWidth/host.clientHeight,width=type==='all'?10.4:comparison?5.6:3.2,half=Math.max(width/2/aspect,type==='all'?1.7:1.15);
 Object.assign(camera,{left:-half*aspect,right:half*aspect,top:half,bottom:-half});camera.up.set(0,1,0);if(view==='top')camera.up.set(0,0,-1);const target=new THREE.Vector3(0,.5,0);camera.position.copy(target).add(offset);camera.lookAt(target);camera.updateProjectionMatrix();
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
document.querySelector('#spin').onclick=()=>{spin=!spin;};document.querySelector('#compare').onchange=e=>{comparison=e.target.checked;arrange();};addEventListener('resize',arrange);
arrange();update(0);let previous=performance.now();renderer.setAnimationLoop(now=>{const dt=Math.min(.1,(now-previous)/1000);previous=now;update(paused?0:dt);});
document.querySelector('#status').textContent='ตรวจท่าทาง · ยืน / เดิน / โจมตี / โดนตี / ล้ม';
window.monsterMotion={models,originals,scene,camera,renderer,types,selectClip,step:update,pause:()=>{paused=true;},reset:()=>location.reload()};window.reviewReady=true;
