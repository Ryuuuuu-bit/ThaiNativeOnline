// Remove the hanging bells on both hands; preserve all original rig/clip binary bytes.
// Run after packing. See README.md for the rest-pose region and review evidence.
import fs from 'node:fs';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
await MeshoptDecoder.ready;
const path=process.argv[2]??'public/models/shaman.glb';const out=process.argv[3]??path;
const b=fs.readFileSync(path),n=b.readUInt32LE(12),j=JSON.parse(b.subarray(20,20+n)),raw=b.subarray(28+n);
const prim=j.meshes[0].primitives[0],pa=j.accessors[prim.attributes.POSITION],ia=j.accessors[prim.indices];
function view(a){const v=j.bufferViews[a.bufferView],e=v.extensions?.EXT_meshopt_compression;if(e){const d=new Uint8Array(e.count*e.byteStride);MeshoptDecoder.decodeGltfBuffer(d,e.count,e.byteStride,raw.subarray(e.byteOffset,e.byteOffset+e.byteLength),e.mode,e.filter);return {d,stride:e.byteStride}}return {d:raw.subarray(v.byteOffset??0,(v.byteOffset??0)+v.byteLength),stride:v.byteStride??(a.type==='VEC3'?12:(a.componentType===5125?4:2))}}
const pv=view(pa),iv=view(ia);const node=j.nodes.find(n=>n.mesh===0);const pos=[];
for(let i=0;i<pa.count;i++){const d=new DataView(pv.d.buffer,pv.d.byteOffset);pos.push([0,1,2].map(k=>pa.componentType===5126?d.getFloat32(i*pv.stride+k*4,true):d.getUint16(i*pv.stride+k*2,true)*(node.scale?.[k]??1)+(node.translation?.[k]??0)))}
const dv=new DataView(iv.d.buffer,iv.d.byteOffset),indices=[];let removed=0;const sides={right:0,left:0};
for(let i=0;i<ia.count;i+=3){const t=[0,1,2].map(k=>ia.componentType===5125?dv.getUint32((i+k)*iv.stride,true):dv.getUint16((i+k)*iv.stride,true));const v=t.map(k=>pos[k]);const side=v.every(p=>p[0]>-.31&&p[0]<-.26)?"right":v.every(p=>p[0]>.263&&p[0]<.314)?"left":null;const bell=side&&v.some(p=>p[1]<.744)&&v.every(p=>p[1]>.65&&p[1]<.75);if(bell){removed++;sides[side]++;}else indices.push(...t)}
for(const [side,count] of Object.entries(sides))if(count!==0&&count!==110)throw Error('Expected 0 or 110 '+side+' bell triangles, found '+count+'; review asset before changing selector');
if(!removed){if(out!==path)fs.copyFileSync(path,out);console.log(JSON.stringify({removed:0,sides,alreadyClean:true}));process.exit(0);}
const data=Buffer.from(new Uint16Array(indices).buffer),offset=(raw.length+3)&~3,bin=Buffer.concat([raw,Buffer.alloc(offset-raw.length),data,Buffer.alloc((4-data.length%4)%4)]);
ia.componentType=5123;ia.bufferView=j.bufferViews.length;ia.byteOffset=0;ia.count=indices.length;delete ia.min;delete ia.max;j.bufferViews.push({buffer:0,byteOffset:offset,byteLength:data.length,target:34963});j.buffers[0].byteLength=bin.length;
const json=Buffer.from(JSON.stringify(j));const js=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);const head=Buffer.alloc(20);head.writeUInt32LE(0x46546c67);head.writeUInt32LE(2,4);head.writeUInt32LE(28+js.length+bin.length,8);head.writeUInt32LE(js.length,12);head.writeUInt32LE(0x4e4f534a,16);const bh=Buffer.alloc(8);bh.writeUInt32LE(bin.length);bh.writeUInt32LE(0x004e4942,4);fs.writeFileSync(out,Buffer.concat([head,js,bh,bin]));console.log(JSON.stringify({before:ia.count/3+removed,removed,sides,after:indices.length/3,bytes:fs.statSync(out).size}));



