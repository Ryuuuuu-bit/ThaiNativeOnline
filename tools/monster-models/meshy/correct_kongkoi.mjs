// Repair the reconstructed extra leg before binding. Preserve the surviving
// textured leg; close the removed thigh opening beneath the original loincloth.
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {weld,prune} from '@gltf-transform/functions';
import {BufferGeometry,BufferAttribute} from 'three';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
const dir=process.env.MESHY_RIG_OUTPUT??'artifacts/meshy-rig-03/deep-forest';
const input=process.argv[2]??`${dir}/input/kongkoi.glb`,output=`${dir}/kongkoi-anatomy-corrected.glb`;
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS),doc=await io.read(input),root=doc.getRoot();
const p=root.listMeshes()[0].listPrimitives()[0],pos=p.getAttribute('POSITION'),uv=p.getAttribute('TEXCOORD_0'),idx=Array.from(p.getIndices().getArray());
const pts=Array.from({length:pos.getCount()},(_,i)=>pos.getElement(i,[])),uvs=Array.from({length:uv.getCount()},(_,i)=>uv.getElement(i,[]));
const key=p=>p.map(v=>Math.round(v*1e5)).join(','),keys=pts.map(key),graph=new Map(),cut=.65;
for(let i=0;i<idx.length;i+=3)for(let e=0;e<3;e++){
 const a=idx[i+e],b=idx[i+(e+1)%3];if(pts[a][1]>=cut||pts[b][1]>=cut)continue;
 for(const[x,y]of[[a,b],[b,a]]){if(!graph.has(keys[x]))graph.set(keys[x],new Set());graph.get(keys[x]).add(keys[y]);}
}
const seen=new Set(),groups=[];
for(const k of graph.keys()){if(seen.has(k))continue;const stack=[k],g=[];while(stack.length){const a=stack.pop();if(seen.has(a))continue;seen.add(a);g.push(a);stack.push(...graph.get(a));}groups.push(g);}
const legs=groups.filter(g=>g.length>100&&Math.min(...g.map(k=>+k.split(',')[1]/1e5))<.05);
if(legs.length!==2)throw Error(`Expected exactly two reconstructed legs; got ${legs.length}. Inspect before editing.`);
const meanX=g=>g.reduce((n,k)=>n+(+k.split(',')[0]/1e5)/g.length,0);
legs.sort((a,b)=>meanX(a)-meanX(b));const retained=new Set(legs[0]),removed=new Set(legs[1]);
const kept=[];let removedTriangles=0;
for(let i=0;i<idx.length;i+=3){const t=idx.slice(i,i+3);if(t.some(i=>removed.has(keys[i])))removedTriangles++;else kept.push(...t);}
// Close only newly cut edges. Original cloth hems and UV seam duplicates must
// never be joined to a thigh cap; that creates long protruding triangles.
function edgesOf(indices){const edges=new Map();for(let i=0;i<indices.length;i+=3)for(let e=0;e<3;e++){
 const a=indices[i+e],b=indices[i+(e+1)%3],k=[keys[a],keys[b]].sort().join('|');
 const rec=edges.get(k)??{count:0,a,b};rec.count++;edges.set(k,rec);
}return edges;}
const originalEdges=edgesOf(idx),edges=edgesOf(kept);
const boundary=[...edges.entries()].filter(([k,e])=>e.count===1&&originalEdges.get(k).count===2).map(([,e])=>e);
if(boundary.length<3||boundary.length>80)throw Error('Unexpected thigh boundary; inspect rather than forcing a cap');
const unvisited=new Set(boundary),loops=[];
while(unvisited.size){const first=unvisited.values().next().value,loop=[first];unvisited.delete(first);let end=keys[first.b];
 while(end!==keys[first.a]){const next=[...unvisited].find(e=>keys[e.a]===end);if(!next)throw Error('Cut boundary is not a closed oriented loop');loop.push(next);unvisited.delete(next);end=keys[next.b];}
 loops.push(loop);
}
for(const loop of loops){
 const capIds=loop.map(e=>e.a),centre=[0,0,0],centreUV=[0,0];
 for(const i of capIds){pts[i].forEach((v,j)=>centre[j]+=v/capIds.length);uvs[i].forEach((v,j)=>centreUV[j]+=v/capIds.length);}
 const ci=pts.length;pts.push(centre);uvs.push(centreUV);for(const e of loop)kept.push(e.b,e.a,ci);
}
// Move only the preserved leg component. The disconnected cloth stays intact.
for(let i=0;i<keys.length;i++){if(!retained.has(keys[i]))continue;const v=pts[i],t=Math.max(0,Math.min(1,(cut-v[1])/.10)),w=t*t*(3-2*t);v[0]+=.06*w;v[2]-=.08*w;}
const g=new BufferGeometry();g.setAttribute('position',new BufferAttribute(new Float32Array(pts.flat()),3));g.setIndex(kept);g.computeVertexNormals();
const buffer=root.listBuffers()[0];
p.setAttribute('POSITION',doc.createAccessor().setType('VEC3').setArray(g.attributes.position.array).setBuffer(buffer));
p.setAttribute('NORMAL',doc.createAccessor().setType('VEC3').setArray(g.attributes.normal.array).setBuffer(buffer));
p.setAttribute('TEXCOORD_0',doc.createAccessor().setType('VEC2').setArray(new Float32Array(uvs.flat())).setBuffer(buffer));
p.setAttribute('TANGENT',null);p.setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(kept)).setBuffer(buffer));
await doc.transform(weld(),prune());await io.write(output,doc);
const report={reason:'Both Meshy reconstructions invented a second leg; repair the reviewed anatomy locally, with no further paid generation.',sourceSha256:createHash('sha256').update(await fs.readFile(input)).digest('hex'),removedTriangles,capTriangles:boundary.length,capLoops:loops.length,preservedOriginalClothBoundaries:true,singleLegShift:[.06,0,-.08],triangles:p.getIndices().getCount()/3,outputSha256:createHash('sha256').update(await fs.readFile(output)).digest('hex')};
await fs.writeFile(new URL('./kongkoi-correction.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
