// Run with @gltf-transform/core and @gltf-transform/functions available.
// Blender exports identity mesh nodes sharing one skin; consolidate by material
// and split the authored timeline into independent game clips at 24 fps.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, resample, joinPrimitives, weld } from '@gltf-transform/functions';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Quaternion } from 'three';

const [input, output] = process.argv.slice(2);
if (!input || !output) throw new Error('Usage: prepare.mjs input.glb output.glb');
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS), doc = await io.read(input), root = doc.getRoot();
const nodes = root.listNodes().filter(n => n.getMesh());
const skin = nodes[0]?.getSkin();
if (!skin || nodes.some(n => n.getSkin() !== skin || n.getTranslation().some(v => Math.abs(v) > 1e-6) || n.getScale().some(v => Math.abs(v-1) > 1e-6) || n.getRotation().some((v,i) => Math.abs(v-(i===3?1:0)) > 1e-6))) {
  throw new Error('Only identity mesh nodes sharing one skin can be consolidated');
}
const groups = new Map();
for (const n of nodes) for (const p of n.getMesh().listPrimitives()) {
  const list = groups.get(p.getMaterial()) ?? []; list.push(p); groups.set(p.getMaterial(), list);
}
const mesh = doc.createMesh('MonsterMesh');
for (const primitives of groups.values()) mesh.addPrimitive(joinPrimitives(primitives));
const parent = nodes[0].getParentNode() ?? nodes[0].listParents().find(p => p.propertyType === 'Scene');
if (!parent) throw new Error('Missing mesh parent');
parent.addChild(doc.createNode('MonsterMesh').setMesh(mesh).setSkin(skin));
for (const n of nodes) n.dispose();

const authored = root.listAnimations();
const source = authored.find(a => a.getName() === `${skin.getName()}Action`);
if (!source) throw new Error('Missing authored animation');
const ranges = { idle:[1,49], walk:[51,75], attack:[81,105], hurt:[111,121], die:[131,155] };
const buffer = root.listBuffers()[0];
for (const [name,[first,last]] of Object.entries(ranges)) {
  const animation = doc.createAnimation(name), start=(first-1)/24, end=(last-1)/24;
  for (const channel of source.listChannels()) {
    const s=channel.getSampler(), input=s.getInput(), output=s.getOutput();
    if (s.getInterpolation() === 'CUBICSPLINE') throw new Error('Bake animation before splitting');
    const times=input.getArray(), values=output.getArray(), stride=output.getElementSize();
    const sampleTimes=Array.from({length:last-first+1},(_,i)=>start+i/24);
    const sampled=sampleTimes.flatMap(t=>{
      let hi=Array.from(times).findIndex(v=>v>=t); if(hi<0)hi=times.length-1;
      const lo=Math.max(0,hi-1), a=Array.from(values.slice(lo*stride,(lo+1)*stride)), b=Array.from(values.slice(hi*stride,(hi+1)*stride));
      const k=times[hi]===times[lo]?0:Math.min(1,Math.max(0,(t-times[lo])/(times[hi]-times[lo])));
      if(channel.getTargetPath()==='rotation')return new Quaternion().fromArray(a).slerp(new Quaternion().fromArray(b),k).toArray();
      return a.map((v,i)=>v+(b[i]-v)*(s.getInterpolation()==='STEP'?0:k));
    });
    if (name==='idle' || name==='walk') sampled.splice(sampled.length-stride,stride,...sampled.slice(0,stride));
    const slicedInput=doc.createAccessor().setType('SCALAR').setArray(new Float32Array(sampleTimes.map(t=>t-start))).setBuffer(buffer);
    const slicedOutput=doc.createAccessor().setType(output.getType()).setArray(new Float32Array(sampled)).setBuffer(buffer);
    const sampler=doc.createAnimationSampler().setInput(slicedInput).setOutput(slicedOutput).setInterpolation(s.getInterpolation());
    animation.addSampler(sampler).addChannel(doc.createAnimationChannel().setTargetNode(channel.getTargetNode()).setTargetPath(channel.getTargetPath()).setSampler(sampler));
  }
}
for (const animation of authored) animation.dispose();
await doc.transform(weld(), resample(), dedup(), prune());
await fs.mkdir(path.dirname(output),{recursive:true});
await io.write(output,doc);
const primitives=root.listMeshes().flatMap(m=>m.listPrimitives());
const triangles=primitives.reduce((sum,p)=>sum+p.getIndices().getCount()/3,0);
console.log(JSON.stringify({output,bytes:(await fs.stat(output)).size,triangles,drawCalls:primitives.length,clips:root.listAnimations().map(a=>a.getName())}));
