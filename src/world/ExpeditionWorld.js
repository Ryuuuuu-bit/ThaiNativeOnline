import * as THREE from 'three';
import { TerrainData, makeGround, makeGrassField } from './Terrain.js';
import { Collision } from './Collision.js';
import { Atmosphere } from './Atmosphere.js';
import { windUniforms } from './shaders.js';
import { portalPillars } from './portal-layout.js';
import { huntingFor, huntingSign } from '../data/hunting.js';
import { createRng } from './rng.js';
import { box, cyl, cone } from './Architecture.js';
import { mergeObject } from './Batching.js';

// Expedition scenes use an independent layout, never stretch/repeat the old city.
export function buildExpeditionWorld(scene, map) {
 const started=performance.now(),root=new THREE.Group();root.name=`map:${map.id}`;scene.add(root);
 const terrain=new TerrainData(map.view),collision=new Collision(8,map.view),camps=huntingFor(map.id);
 const rng=createRng(800+map.index),stone=new THREE.MeshLambertMaterial({color:map.ground}),trim=new THREE.MeshLambertMaterial({color:map.accent}),wood=new THREE.MeshLambertMaterial({color:'#68523c'});
 const statics=new THREE.Group(),glows=[],spots={};
 const h=(x,z)=>terrain.height(x,z);
 const addPillar=(x,z,height=3)=>{cyl(statics,stone,x,h(x,z)+height/2,z,.45,.6,height,8);cone(statics,trim,x,h(x,z)+height+.3,z,.55,.6,8);collision.addCircle(x,z,.6);};
 // Gate nodes, a connected trail spine, and the supply NPC's rest clearing.
 spots[`${map.id}_entry`]={x:0,z:map.top-24,link:`${map.id}_mid`};
 spots[`${map.id}_mid`]={x:0,z:map.top-120,link:`${map.id}_exit`};
 spots[`${map.id}_exit`]={x:0,z:map.top-216,link:`${map.id}_mid`};
 spots[`${map.id}_supply`]={x:18,z:map.top-24,face:-Math.PI/2,link:`${map.id}_entry`};
 // Small Thai pavilion: raised plinth, four posts and steep gabled roof.
 const sx=23,sz=map.top-25,y=h(sx,sz);
 box(statics,stone,sx,y+.2,sz,9,.4,7);
 for(const dx of [-3.7,3.7])for(const dz of [-2.7,2.7]){cyl(statics,wood,sx+dx,y+1.8,sz+dz,.12,.16,3.6,6);collision.addCircle(sx+dx,sz+dz,.16);}
 for(const side of [-1,1])box(statics,trim,sx+side*2.1,y+4.1,sz,4.8,.18,8,0,0,-side*.55);
 cone(statics,trim,sx,y+5.9,sz,.25,.8,6);
 // Boundary silhouettes and scattered theme props avoid trails, camps and arrivals.
 const clear=(x,z)=>Math.abs(x)<10 || (z>map.top-46) || camps.some(c=>Math.hypot(x-c.x,z-c.z)<18) || map.portals.some(p=>Math.hypot(x-p.at.x,z-p.at.z)<20) || Math.hypot(x-92,z-(map.top-211))<16;
 for(let i=0;i<210;i++){
  const x=rng.range(-132,132),z=rng.range(map.top-248,map.top+8);if(clear(x,z))continue;
  const scale=rng.range(.8,1.6),yy=h(x,z);
  if(['bamboo','forest'].includes(map.scenery)){
   for(let j=0;j<3;j++)cyl(statics,wood,x+j*.35,yy+2.5*scale,z,.09,.13,5*scale,5);
   for(let j=0;j<3;j++)cone(statics,stone,x,yy+(3+j)*scale,z,1.6*scale,(2.5-j*.4)*scale,7);
   collision.addCircle(x,z,.55);
  }else if(['fort','ruins','water'].includes(map.scenery)){
   addPillar(x,z,rng.range(2,5));if(i%3===0)box(statics,stone,x,yy+.6,z,3.5,1.2,1.4,rng()*3);
  }else{
   const rock=new THREE.Mesh(new THREE.IcosahedronGeometry(1,0),stone);rock.position.set(x,yy+scale,z);rock.scale.set(scale*2,scale*(map.scenery==='rift'?3:1.5),scale*1.4);statics.add(rock);collision.addCircle(x,z,scale*1.4);
   if(i%4===0)cone(statics,trim,x,yy+scale*2,z,.25,.8,5);
  }
 }
 // Stone / lantern landmarks punctuate each loop without occupying its combat floor.
 for(const c of camps){for(const side of [-1,1]){const x=c.x+side*14,z=c.z-12;addPillar(x,z,2);glows.push({x,y:h(x,z)+2.3,z,color:map.accent,size:.5,kind:'lantern'});}}
 for(const p of map.portals)for(const a of portalPillars(map,p))collision.addCircle(a.x,a.z,a.r);
 for(const c of camps){const a=huntingSign(c);collision.addCircle(a.x,a.z,.13);}
 const merged=mergeObject(statics);root.add(merged);
 // mergeObject clones source geometry; release originals once, retaining shared materials.
 const originals=new Set();statics.traverse(o=>{if(o.geometry)originals.add(o.geometry);});for(const g of originals)g.dispose();
 const canvas=document.createElement('canvas');canvas.width=canvas.height=768;const g=canvas.getContext('2d'),r=map.view;
 const tx=x=>(x-r.minX)/(r.maxX-r.minX)*768,tz=z=>(z-r.minZ)/(r.maxZ-r.minZ)*768;
 g.fillStyle=map.ground;g.fillRect(0,0,768,768);g.strokeStyle=map.accent;g.lineWidth=18;g.lineJoin='round';
 for(const x of [-76,0,76]){g.beginPath();g.moveTo(tx(x-17),tz(map.top-55));g.lineTo(tx(x-17),tz(map.top-183));g.lineTo(tx(x+17),tz(map.top-183));g.lineTo(tx(x+17),tz(map.top-55));g.closePath();g.stroke();}
 g.lineWidth=22;for(const z of [map.top-40,map.top-195]){g.beginPath();g.moveTo(tx(-93),tz(z));g.lineTo(tx(93),tz(z));g.stroke();}
 g.beginPath();g.moveTo(tx(0),tz(map.top));g.lineTo(tx(0),tz(map.top-240));g.stroke();
 for(let i=0;i<1800;i++){g.fillStyle=i%2?'#ffffff08':'#00000008';g.fillRect(rng()*768,rng()*768,rng()*8+1,2);}
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
 const ground=makeGround(root,terrain,texture);
 const width=280,height=280,data=new Uint8Array(width*height*4);
 for(let j=0;j<height;j++)for(let i=0;i<width;i++){const x=r.minX+i,z=r.minZ+j,k=(j*width+i)*4;data[k]=['forest','bamboo'].includes(map.scenery)&&!clear(x,z)?155:0;data[k+1]=Math.round((h(x,z)+3)/6*255);data[k+2]=130;data[k+3]=255;}
 const maskTexture=new THREE.DataTexture(data,width,height);maskTexture.userData.rect=r;maskTexture.needsUpdate=true;
 const mask={data,width,height,texture:maskTexture},grass=makeGrassField(root,mask,windUniforms);
 const atmosphere=new Atmosphere(root,{terrain,glows,smokes:[]});
 const world={map,root,terrain,collision,ground,mask,grass,atmosphere,spots,footprints:[],market:[],water:{dispose(){}},stats:{houses:1,forestTrees:210,buildMs:Math.round(performance.now()-started)},contains:(x,z)=>map.walk.some(r=>x>=r.minX&&x<=r.maxX&&z>=r.minZ&&z<=r.maxZ),heightAt:h,canStand(x,z,pad=.28){return world.contains(x,z)&&!collision.blocked(x,z,pad);},speedAt:()=>1,update(t,dt,focus,env){windUniforms.uTime.value=t;grass.update(focus);atmosphere.update(t,dt,focus,env);},dispose(){root.removeFromParent();const gs=new Set(),ms=new Set(),ts=new Set();root.traverse(o=>{if(o.geometry)gs.add(o.geometry);for(const m of [].concat(o.material??[]))ms.add(m);for(const t of o.userData?.textures??[])ts.add(t);});for(const m of ms){for(const v of Object.values(m))if(v?.isTexture)ts.add(v);m.dispose();}for(const g of gs)g.dispose();for(const t of ts)t.dispose();return {geometries:gs.size,materials:ms.size,textures:ts.size};}};
 return world;
}
