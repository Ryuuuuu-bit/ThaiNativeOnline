import * as THREE from 'three';
import { buildWorld } from '../src/world/World.js';
import { COMPACT_CITY, compactCityCanStand } from '../src/world/compact-city.js';
import { MAPS, npcsForMap } from '../src/world/maps.js';
import { NPCS } from '../src/data/npcs.js';
import { NPCManager } from '../src/npc/NPCManager.js';
import { WorldClock } from '../src/core/WorldClock.js';
import { Environment } from '../src/world/Environment.js';
import { CameraController } from '../src/core/CameraController.js';
import { findPath } from '../src/core/GridPath.js';
import { paintBase } from '../src/ui/minimap/paintBase.js';
import { themeFor } from '../src/ui/minimap/mapStyle.js';
import { Portals } from '../src/world/Portals.js';

// Isolated, reproducible review harness using production renderer, lighting,
// orthographic camera, canonical navigation and the current NPC renderer/models.
// ?capture=1 emits the VERIFY.md CDP contract; ?npcs=0 isolates environment cost.
const params=new URLSearchParams(location.search),host=document.querySelector('#stage');
const status=document.querySelector('#status'),out=document.querySelector('#out');
const result={steps:[],shots:{},errors:[]};
const publish=()=>{out.textContent='QA_RESULT '+JSON.stringify(result);};
const step=(name,value)=>{result.steps.push([name,value]);publish();};
const frame=()=>new Promise(resolve=>setTimeout(resolve,0));
window.addEventListener('error',e=>{result.errors.push(e.message);publish();});
window.addEventListener('unhandledrejection',e=>{result.errors.push(String(e.reason));publish();});
const views=[
  ['plaza',0,8,1,10],['shops',-12,-13,1,10],['temple',-52,-31,1,10],
  ['temple-complex',-52,-35,.65,10],['waterfront',0,62,1,10],
  ['harbor-overview',0,67,.60,10],['harbor-evening',0,64,.8,19],
  ['home-boundaries',-53,41,1.1,10],['east-boundaries',51,14,1,10],
  ['city-gate',0,-60,.65,10],
  ['forge',-23,-13,1.4,10],['pharmacy',23,-13,1.4,10],
  ['general',-23,15,1.4,10],['depot',23,15,1.4,10],
  ['north-halls',0,-39,1,10],['hunter',41,-43,1,10],['herbalist',43,-15,1,10],
  ['shaman',-42,12,1,10],['assassin',43,35,1,10],['residential',-54,47,1,10],
  ['port',0,55,1,10],['night-plaza',0,8,1,22],['overview',0,0,.20,10],
];
try {
  const renderer=new THREE.WebGLRenderer({antialias:true});
  renderer.setPixelRatio(1);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;host.append(renderer.domElement);
  const scene=new THREE.Scene(),view=new CameraController(renderer,host),env=new Environment(scene,renderer);
  const world=await buildWorld(scene,text=>{status.textContent=text;},'city');
  const portals=new Portals(world.root,MAPS.city,(x,z)=>world.heightAt(x,z));
  world.atmosphere.setEnabled(false);world.grass.mesh.geometry.instanceCount=56000;
  step('world-contract',{buildings:world.footprints.length,stats:world.stats,flat:world.heightAt(0,8)===0,ground:world.ground.isMesh,grassSettings:true});
  const routes=COMPACT_CITY.pois.map(p=>({id:p.id,standing:world.canStand(p.x,p.z),route:!!findPath((x,z)=>world.canStand(x,z,.35),COMPACT_CITY.spawn,p,{step:.5,margin:30})}));
  step('routes',routes);
  if(routes.some(r=>!r.standing||!r.route))result.errors.push('Unreachable canonical POI');
  let mismatch=0;
  for(let z=-64;z<=64;z+=.5)for(let x=-72;x<=72;x+=.5){
    if(world.canStand(x,z)!==compactCityCanStand(x,z))mismatch++;
  }
  step('navigation-extra-blocked-samples',{mismatch,expected:'only portal pillar reservations'});
  const minimap=paintBase({world,bounds:COMPACT_CITY.bounds,theme:themeFor(MAPS.city)});
  result.shots.minimap=minimap.canvas.toDataURL('image/jpeg',.92);step('minimap',{width:minimap.canvas.width,height:minimap.canvas.height});
  let npcs=null;
  const clock=new WorldClock({hour:10,minutesPerSecond:0});
  if(params.get('npcs')!=='0'){
    npcs=new NPCManager(world.root,world,npcsForMap(NPCS,'city',id=>!!world.spots[id]),clock,{camera:()=>view.camera});
    await npcs.renderer.modelRenderer?.criticalReady();
    for(let i=0;i<3;i++){npcs.update(1/60,i/60,view.focus);renderer.render(scene,view.camera);await frame();}
    step('production-npcs',{count:npcs.npcs.length,criticalModels:'ready'});
  }
  let current=views[0],elapsed=0;
  function render(entry=current){
    const [name,x,z,zoom,hour]=entry;current=entry;
    clock.set(hour);
    // Match the normal gameplay angle and zoom; the overview is explicitly
    // composed as an atlas shot, with a longer far plane for the whole city.
    view.zoom=zoom;view.updateProjection();view.camera.far=500;view.camera.updateProjectionMatrix();
    view.offset.set(15,23,22);if(zoom<.5)view.offset.multiplyScalar(4);
    view.snap(new THREE.Vector3(x,0,z));
    const state=env.update(hour,view.focus,'city');scene.fog.density=zoom<.5?.002:scene.fog.density;
    // A capture is a phase fixture: finish pending phase changes immediately
    // instead of retaining the preceding shot's randomly staggered schedule.
    for(const npc of npcs?.npcs??[])if(npc.pending)npc.pending.delay=0;
    world.update(elapsed,0,view.focus,state);npcs?.update(1/60,elapsed,view.focus);portals.update(elapsed,view.focus);
    renderer.render(scene,view.camera);
    status.textContent=`${name} · (${x}, ${z}) · ${hour}:00\n${world.stats.buildings} buildings · ${renderer.info.render.calls} calls · ${Math.round(renderer.info.render.triangles/1000)}k triangles`;
    return renderer.domElement.toDataURL('image/jpeg',.92);
  }
  for(const entry of views){const button=document.createElement('button');button.textContent=entry[0];button.onclick=()=>render(entry);document.querySelector('#views').append(button);}
  window.compactCityReview={world,scene,renderer,view,npcs,clock,render,result};
  if(params.has('capture')){
    const selected=params.get('views')?.split(',');
    for(const entry of views.filter(v=>!selected||selected.includes(v[0]))){await frame();result.shots[entry[0]]=render(entry);step('view:'+entry[0],{calls:renderer.info.render.calls,triangles:renderer.info.render.triangles});}
    npcs?.dispose();
    const baseline=renderer.info.memory.geometries;
    const disposed=world.dispose();renderer.render(scene,view.camera);
    const after=renderer.info.memory.geometries;
    step('dispose',{baseline,after,released:disposed,idempotent:world.dispose()});
    const again=await buildWorld(scene,()=>{},'city');
    again.update(0,0,new THREE.Vector3(),env.state);renderer.render(scene,view.camera);
    step('rebuild',{stats:again.stats,geometries:renderer.info.memory.geometries});again.dispose();
    step('done',{ok:!result.errors.length});
  }else {
    render();renderer.setAnimationLoop(()=>{elapsed+=1/60;const state=env.update(current[4],view.focus,'city');world.update(elapsed,1/60,view.focus,state);npcs?.update(1/60,elapsed,view.focus);portals.update(elapsed,view.focus);renderer.render(scene,view.camera);});
    window.addEventListener('resize',()=>{view.resize();render();});
  }
}catch(error){result.errors.push(error.stack??String(error));status.textContent=String(error);step('done',{ok:false});}
