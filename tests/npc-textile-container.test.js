import test from 'node:test';
import assert from 'node:assert/strict';
import { GLBBuilder, parseGLB } from '../tools/npc-models/glb.mjs';
import { replaceColour, motif } from '../tools/npc-models/thai-textiles.mjs';

test('NPC colour replacement preserves compressed geometry, skin and animation bytes', () => {
  const builder = new GLBBuilder(), image = builder.view(Buffer.from([1,2,3,4,5]));
  const geometry = builder.view(Buffer.from([21,22,23,24,25,26,27,28]));
  const compressed = builder.json.bufferViews[geometry];
  builder.json.bufferViews.push({ buffer:1, byteOffset:0, byteLength:48,
    extensions:{EXT_meshopt_compression:{buffer:0,byteOffset:compressed.byteOffset,byteLength:8,byteStride:16,count:3,mode:'ATTRIBUTES'}} });
  builder.json.buffers.push({byteLength:48,extensions:{EXT_meshopt_compression:{fallback:true}}});
  builder.json.images=[{bufferView:image,mimeType:'image/jpeg'}];
  builder.json.nodes=[{name:'MeasuredWrist',translation:[1,2,3]}];
  builder.json.skins=[{joints:[0]}]; builder.json.animations=[{name:'walk',channels:[],samplers:[]}];
  const original=builder.encode(), newColour=Buffer.from([90,91,92,93,94,95,96,97,98,99,100]);
  const {bytes,unchangedDataHashes}=replaceColour(original,newColour), result=parseGLB(bytes), source=parseGLB(original);
  assert.deepEqual(result.json.nodes,source.json.nodes); assert.deepEqual(result.json.skins,source.json.skins); assert.deepEqual(result.json.animations,source.json.animations);
  const oldView=source.json.bufferViews[geometry], newView=result.json.bufferViews[geometry];
  assert.deepEqual(result.bin.subarray(newView.byteOffset,newView.byteOffset+8),source.bin.subarray(oldView.byteOffset,oldView.byteOffset+8));
  assert.equal(result.json.bufferViews[2].extensions.EXT_meshopt_compression.byteOffset,newView.byteOffset);
  assert.equal(result.json.buffers[1].byteLength,48); assert.equal(unchangedDataHashes.length,2);
});

test('NPC textile replacement rejects image bytes aliased by geometry',()=>{
  const b=new GLBBuilder(),image=b.view(Buffer.from([1,2,3,4]));
  b.json.images=[{bufferView:image,mimeType:'image/jpeg'}];
  b.json.bufferViews.push({...b.json.bufferViews[image]});
  assert.throws(()=>replaceColour(b.encode(),Buffer.from([5,6,7,8])),/overlaps/);
});

test('monastic textile treatment has plain edges and no rosette field',()=>{
  assert.equal(motif(.5,.5,'T'),false); assert.equal(motif(.4,.2,'T'),false); assert.equal(motif(.5,.97,'T'),true);
});
