// Read-only authoring calculation. Registered L3 refinement applies the targets.
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {Vector3,Matrix4} from 'three';
import fs from 'node:fs/promises';
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS),dir=process.env.MESHY_RIG_OUTPUT??'artifacts/meshy-rig-04/wat-rang';
const orig=await io.read(dir+'/input/soldier.glb'),cur=await io.read(dir+'/soldier-rig-production.glb');
const a=orig.getRoot().listMeshes()[0].listPrimitives()[0],source=cur.getRoot().listNodes().find(n=>n.getMesh()),b=source.getMesh().listPrimitives()[0],world=new Matrix4().fromArray(source.getWorldMatrix());
const key=uv=>uv.map(v=>Math.round(v*100000)).join(',');
const map=new Map();for(let i=0;i<b.getAttribute('POSITION').getCount();i++){const k=key(b.getAttribute('TEXCOORD_0').getElement(i,[])),p=new Vector3().fromArray(b.getAttribute('POSITION').getElement(i,[])).applyMatrix4(world).toArray();if(!map.has(k))map.set(k,[]);map.get(k).push(p);}
let missing=0,ambiguous=0;const deltas=[],current=[],origUV=a.getAttribute('TEXCOORD_0'),curUV=b.getAttribute('TEXCOORD_0');
for(let i=0;i<a.getAttribute('POSITION').getCount();i++){
 const uv=origUV.getElement(i,[]),p=a.getAttribute('POSITION').getElement(i,[]);let ps=map.get(key(uv));
 if(!ps){let d=Infinity,best=[];for(let j=0;j<curUV.getCount();j++){const q=curUV.getElement(j,[]),e=Math.hypot(q[0]-uv[0],q[1]-uv[1]);if(e<d-1e-9){d=e;best=[new Vector3().fromArray(b.getAttribute('POSITION').getElement(j,[])).applyMatrix4(world).toArray()];}else if(Math.abs(e-d)<1e-9)best.push(new Vector3().fromArray(b.getAttribute('POSITION').getElement(j,[])).applyMatrix4(world).toArray());}if(d>2e-5){missing++;continue;}ps=best;}
 ps.sort((u,v)=>Math.hypot(...u.map((x,j)=>x-p[j]))-Math.hypot(...v.map((x,j)=>x-p[j])));const q=ps[0];
 if(ps.length>1&&Math.abs(Math.hypot(...ps[0].map((x,j)=>x-p[j]))-Math.hypot(...ps[1].map((x,j)=>x-p[j])))<1e-7&&Math.hypot(...q.map((v,j)=>v-ps[1][j]))>.0001)ambiguous++;
 deltas.push(p.map((v,j)=>v-q[j]));current.push(q);
}
console.log({missing,ambiguous,count:deltas.length});if(missing||ambiguous)throw Error('UV mapping ambiguous');await fs.writeFile(dir+'/soldier-original-restoration-deltas.json',JSON.stringify(deltas));await fs.writeFile(dir+'/soldier-current-positions.json',JSON.stringify(current));
const originals=Array.from({length:a.getAttribute('POSITION').getCount()},(_,i)=>a.getAttribute('POSITION').getElement(i,[]));
const pivot=[.39,.94,-.18],angle=-Math.atan2(.845,.494),c=Math.cos(angle),sn=Math.sin(angle),shieldVertices=[],targets=[];
for(let i=0;i<originals.length;i++){const [x,y,z]=originals[i],p=[x,y,z];if(x>.24&&y>.69&&y<1.235&&.85*x+.53*z>.24){shieldVertices.push(i);const dx=x-pivot[0],dz=z-pivot[2];p[0]=pivot[0]+c*dx+sn*dz;p[2]=pivot[2]-sn*dx+c*dz;}targets.push(p);}
const displacement=targets.map((p,i)=>p.map((v,j)=>v-current[i][j]));
await fs.writeFile(dir+'/soldier-candidate-positions.json',JSON.stringify(targets));
await fs.writeFile(dir+'/soldier-final-guard-targets.json',JSON.stringify({angle,pivot,shieldVertices,deltas:displacement}));
