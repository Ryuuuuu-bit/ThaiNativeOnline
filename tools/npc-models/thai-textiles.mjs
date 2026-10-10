// Local Thai-inspired woven borders. Only embedded colour bytes are replaced.
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRig, THREE, worldVertices } from './rig.mjs';
import { parseGLB, sha256, GLBBuilder } from './glb.mjs';
import { candidateDirectory, packingDependencies } from './prepare.mjs';

export function replaceColour(bytes, colour) {
  const source = parseGLB(bytes), json = structuredClone(source.json);
  if (json.images.length !== 1) throw Error('Inspect multiple texture assets separately');
  const id = json.images[0].bufferView, view = json.bufferViews[id];
  if (view.buffer !== 0) throw Error('Expected embedded colour in real binary buffer');
  const start = view.byteOffset ?? 0, end = start + Math.ceil(view.byteLength / 4) * 4;
  const padded = Buffer.concat([colour, Buffer.alloc((4 - colour.length % 4) % 4)]);
  const delta = padded.length - (end - start);
  for (let i = 0; i < json.bufferViews.length; i++) {
    const v = json.bufferViews[i], ranges = [v, v.extensions?.EXT_meshopt_compression].filter(Boolean);
    for (const r of ranges) {
      if (r.buffer !== 0 || i === id && r === v) continue;
      const offset = r.byteOffset ?? 0;
      if (offset < end && offset + r.byteLength > start) throw Error('Colour overlaps non-texture data');
      if (offset >= end) r.byteOffset = offset + delta;
    }
  }
  view.byteLength = colour.length; json.images[0].mimeType = 'image/jpeg';
  json.buffers[0].byteLength += delta;
  const bin = Buffer.concat([source.bin.subarray(0, start), padded, source.bin.subarray(end)]);
  const builder = new GLBBuilder(); builder.json = json; builder.parts = [bin]; builder.length = bin.length;
  const result = builder.encode(), actual = parseGLB(result);
  const before = [], after = [];
  for (let i = 0; i < source.json.bufferViews.length; i++) {
    if (i === id) continue;
    const a = source.json.bufferViews[i], b = actual.json.bufferViews[i];
    for (const [ra, rb] of [[a, b], [a.extensions?.EXT_meshopt_compression, b.extensions?.EXT_meshopt_compression]]) {
      if (!ra || ra.buffer !== 0) continue;
      before.push(sha256(source.bin.subarray(ra.byteOffset ?? 0, (ra.byteOffset ?? 0) + ra.byteLength)));
      after.push(sha256(actual.bin.subarray(rb.byteOffset ?? 0, (rb.byteOffset ?? 0) + rb.byteLength)));
    }
  }
  if (JSON.stringify(before) !== JSON.stringify(after)) throw Error('Non-texture binary data changed');
  for (const key of ['nodes', 'skins', 'animations', 'accessors', 'meshes']) if (JSON.stringify(source.json[key]) !== JSON.stringify(actual.json[key])) throw Error(`${key} changed`);
  return { bytes: result, unchangedDataHashes: before };
}

export function motif(u, v, kind = 'P') {
  if (kind === 'S') return false; // Plain cloth recolour/ornament removal.
  const x = ((u % 1 + 1) % 1 - .5) * 2, y = (v - .5) * 2;
  const edge = Math.abs(y) > .84;
  if (kind === 'T') return edge;
  const diamond = Math.abs(Math.abs(x) + Math.abs(y) - .80) < .07;
  // Four broad pointed petals and open corners, inspired by prajam yam.
  const petal = Math.abs(x)/.19 + Math.abs(Math.abs(y)-.32)/.26 < 1 || Math.abs(y)/.19 + Math.abs(Math.abs(x)-.32)/.26 < 1;
  const centre = x*x + y*y < .025;
  return edge || diamond || kind === 'P' && (petal || centre) || kind === 'W' && Math.abs(Math.abs(x) + Math.abs(y) - .40) < .09;
}

// These bands are measured on the actual keeper's rest mesh, in canonical metres.
// Other bodies need their own inspected garment profile; no guessed shared mask.
export const KEEPER = {
  family: 'warp_keeper', revision: 'woven-v4', ink: [228, 210, 159], ground: [47, 91, 72],
  regions: [{ name: 'woven-lower-wrap', minY: .185, maxY: .26, maxX: .24, repeat: .095, motif: 'P' },
    { name: 'waistband', minY: .925, maxY: .97, maxX: .25, repeat: .075, motif: 'W', greenOnly: true }],
};

export async function paintTextiles(sourceFile, profile = KEEPER) {
  const rig = await loadRig(sourceFile), geom = rig.mesh.geometry, uv = geom.attributes.uv;
  const image = rig.json.images[0], view = rig.json.bufferViews[image.bufferView];
  const { sharp } = packingDependencies();
  const decoded = await sharp(rig.bin.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = decoded.info;
  if (width !== 1024 || height !== 1024 || channels !== 3) throw Error('Expected shipped 1024 RGB texture');
  const data = Buffer.from(decoded.data), mask = Buffer.alloc(width * height), owner = new Int8Array(width * height).fill(-1);
  const transform = rig.json.materials[0].pbrMetallicRoughness.baseColorTexture.extensions?.KHR_texture_transform ?? {};
  if (transform.rotation || transform.texCoord) throw Error('Inspect rotated or alternate texture coordinates');
  const uvScale = transform.scale ?? [1,1], uvOffset = transform.offset ?? [0,0];
  const positions = worldVertices(rig), points = Array.from({ length: positions.length / 3 }, (_, i) => new THREE.Vector3().fromArray(positions, i*3));
  const normalMatrix=new THREE.Matrix3().getNormalMatrix(rig.mesh.matrixWorld);
  const normals=points.map((_,i)=>new THREE.Vector3().fromBufferAttribute(geom.attributes.normal,i).applyMatrix3(normalMatrix).normalize());
  const fabric = rgb => rgb[1]/Math.max(1,rgb[0])>=.75 && rgb[2]/Math.max(1,rgb[0])>=.50;
  const regions=profile.regions.map(r=>{
    if(!r.hand) return r;
    const hand=rig.mesh.skeleton.bones.find(b=>b.name===r.hand), forearm=rig.mesh.skeleton.bones.find(b=>b.name===r.forearm);
    if(!hand||!forearm) throw Error('Measured sleeve joints missing');
    const centre=hand.getWorldPosition(new THREE.Vector3()),axis=forearm.getWorldPosition(new THREE.Vector3()).sub(centre).normalize();
    const tangent=new THREE.Vector3(0,1,0).cross(axis).normalize(),bitangent=axis.clone().cross(tangent).normalize();
    const result={...r,centre,axis,tangent,bitangent};
    if(r.edgeWidth) {
      const sectors=Array(24).fill(Infinity);
      for(let id=0;id<points.length;id++) {
        const p=points[id].clone().sub(centre),t=p.dot(axis),radius=p.clone().addScaledVector(axis,-t).length();
        if(t<r.minDistance||t>r.maxDistance||radius>r.radius) continue;
        const x=Math.min(width-1,Math.max(0,Math.floor((uv.getX(id)*uvScale[0]+uvOffset[0])*width))),y=Math.min(height-1,Math.max(0,Math.floor((uv.getY(id)*uvScale[1]+uvOffset[1])*height)));
        if(!fabric(decoded.data.subarray((y*width+x)*3,(y*width+x)*3+3))) continue;
        const sector=Math.min(23,Math.floor((Math.atan2(p.dot(tangent),p.dot(bitangent))+Math.PI)/(2*Math.PI)*24));
        sectors[sector]=Math.min(sectors[sector],t);
      }
      if(sectors.filter(Number.isFinite).length<12) throw Error('Insufficient inspected cloth-edge samples');
      const filled=sectors.map((value,i)=>Number.isFinite(value)?value:sectors.find((v,j)=>Number.isFinite(v)&&Math.min(Math.abs(j-i),24-Math.abs(j-i))<=2)??r.maxDistance);
      result.edge=filled.map((v,i)=>[filled[(i+23)%24],v,filled[(i+1)%24]].sort((a,b)=>a-b)[1]);
    }
    return result;
  });
  const index = geom.index.array;
  let conflicts = 0;
  const selected = (p, rgb, triangle) => regions.findIndex(r => {
    if(r.triangles && !r.triangles.includes(triangle)) return false;
    if(r.matteAccessoryOnly && !(Math.max(...rgb)<55 || Math.max(...rgb)-Math.min(...rgb)<32)) return false;
    if(r.ivoryOnly && !fabric(rgb)) return false;
    if(r.creamOnly && !(rgb[1]>rgb[0]*.88 && rgb[2]>rgb[0]*.75)) return false;
    if(r.goldOnly && !(rgb[0]>rgb[2]*1.28 && rgb[1]>rgb[2]*1.12 && rgb[0]>rgb[1]*.95)) return false;
    if(r.redOnly && !(rgb[0]>rgb[1]*1.25 && rgb[0]>rgb[2]*1.25)) return false;
    if(r.blueOnly && !(rgb[2]>rgb[0]*1.08 && rgb[2]>rgb[1]*.98)) return false;
    if(Math.abs(p.x)<(r.minX??0) || p.z<(r.minZ??-Infinity) || p.z>(r.maxZ??Infinity)) return false;
    if(r.centre) { const relative=p.clone().sub(r.centre),t=relative.dot(r.axis),angle=Math.atan2(relative.dot(r.tangent),relative.dot(r.bitangent)),sector=Math.min(23,Math.floor((angle+Math.PI)/(2*Math.PI)*24)),begin=r.edge?.[sector]??r.minDistance,end=r.edge?begin+r.edgeWidth:r.maxDistance;return t>=begin && t<=end && relative.addScaledVector(r.axis,-t).length()<r.radius; }
    return Math.abs(p.x)<r.maxX && p.y>=r.minY && p.y<=r.maxY && (!r.greenOnly||rgb[1]>rgb[0]*.93 && rgb[1]>rgb[2]*1.08);
  });
  for (let i = 0; i < index.length; i += 3) {
    const ids = [index[i],index[i+1],index[i+2]], ps = ids.map(id => points[id]), ts = ids.map(id => [(uv.getX(id)*uvScale[0]+uvOffset[0])*width-.5, (uv.getY(id)*uvScale[1]+uvOffset[1])*height-.5]);
    const [a,b,c] = ts, d = (b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);
    if (Math.abs(d) < 1e-8) continue;
    const x0=Math.max(0,Math.floor(Math.min(...ts.map(t=>t[0])))),x1=Math.min(width-1,Math.ceil(Math.max(...ts.map(t=>t[0]))));
    const y0=Math.max(0,Math.floor(Math.min(...ts.map(t=>t[1])))),y1=Math.min(height-1,Math.ceil(Math.max(...ts.map(t=>t[1]))));
    for(let y=y0;y<=y1;y++) for(let x=x0;x<=x1;x++) {
      const w0=((b[1]-c[1])*(x-c[0])+(c[0]-b[0])*(y-c[1]))/d,w1=((c[1]-a[1])*(x-c[0])+(a[0]-c[0])*(y-c[1]))/d,w2=1-w0-w1;
      if(Math.min(w0,w1,w2)<-1e-5) continue;
      const p=ps[0].clone().multiplyScalar(w0).addScaledVector(ps[1],w1).addScaledVector(ps[2],w2), at=y*width+x, rgb=Array.from(decoded.data.subarray(at*3,at*3+3)), region=selected(p,rgb,i/3);
      const mark=region>=0?1:0;
      if(owner[at]!==-1 && owner[at]!==mark) { conflicts++; owner[at]=2; continue; }
      if(owner[at]===2) continue;
      owner[at]=mark;
      if(region<0) continue;
      const r=regions[region],relative=r.centre?p.clone().sub(r.centre):null;
      const angle=relative?Math.atan2(relative.dot(r.tangent),relative.dot(r.bitangent)):Math.atan2(p.x,p.z);
      const sector=Math.min(23,Math.floor((angle+Math.PI)/(2*Math.PI)*24)),begin=r.edge?.[sector]??r.minDistance;
      const v=relative?(relative.dot(r.axis)-begin)/(r.edgeWidth??(r.maxDistance-r.minDistance)):(p.y-r.minY)/(r.maxY-r.minY);
      // Cylindrical coordinate follows the wrap circumference through UV charts.
      const repeats=Math.max(1,Math.round(2*Math.PI*(r.circumferenceRadius??(relative?.053:.21))/r.repeat));
      const u=angle/(2*Math.PI)*repeats;
      const colour=motif(u,v,r.motif)?(r.ink??profile.ink):(r.ground??profile.ground);
      const n=normals[ids[0]].clone().multiplyScalar(w0).addScaledVector(normals[ids[1]],w1).addScaledVector(normals[ids[2]],w2).normalize();
      const shade=r.shadeMode==='geometry'?.82+.13*Math.max(0,n.y)+.07*Math.max(0,n.z):Math.max(.45,Math.min(1.13,(rgb[0]+rgb[1]+rgb[2])/420));
      const strength=r.strength??profile.strength??.82;
      for(let ch=0;ch<3;ch++) data[at*3+ch]=Math.round(rgb[ch]*(1-strength)+colour[ch]*shade*strength);
      mask[at]=255;
    }
  }
  // A boundary pixel is excluded when another face maps it outside the garment.
  // Any ambiguity is recorded, and original colour is restored rather than leaked.
  for(let at=0;at<owner.length;at++) if(owner[at]===2) { decoded.data.copy(data,at*3,at*3,at*3+3);mask[at]=0; }
  let paddedPixels=0;
  if(profile.chartPadding) {
    if(!Number.isInteger(profile.chartPadding)||profile.chartPadding<1||profile.chartPadding>8) throw Error('Bounded chart padding required');
    const protectedDistance=new Uint8Array(owner.length).fill(255);
    for(let at=0;at<owner.length;at++) if(owner[at]>=0 && !mask[at]) protectedDistance[at]=0;
    const neighbours=(at)=>[at-1,at+1,at-width,at+width].filter(n=>n>=0&&n<owner.length&&!(Math.abs(n-at)===1&&Math.floor(n/width)!==Math.floor(at/width)));
    for(let pass=1;pass<=profile.chartPadding;pass++) {
      const previous=Uint8Array.from(protectedDistance);
      for(let at=0;at<owner.length;at++) if(previous[at]>pass&&neighbours(at).some(n=>previous[n]===pass-1)) protectedDistance[at]=pass;
    }
    const distance=new Uint8Array(owner.length).fill(255);
    for(let at=0;at<owner.length;at++) if(mask[at]) distance[at]=0;
    for(let pass=1;pass<=profile.chartPadding;pass++) {
      const previous=Uint8Array.from(distance),colour=Buffer.from(data);
      for(let at=0;at<owner.length;at++) {
        // Extend ONLY into unused chart gutter. Another face, including skin,
        // owns its own nearest gutter; ties keep the original texture colour.
        if(owner[at]!==-1||previous[at]!==255||protectedDistance[at]<=pass) continue;
        const n=neighbours(at).find(n=>previous[n]===pass-1);if(n===undefined) continue;
        colour.copy(data,at*3,n*3,n*3+3);distance[at]=pass;mask[at]=255;paddedPixels++;
      }
    }
  }
  const changed=mask.reduce((sum,v)=>sum+(v>0),0);
  if(changed<100) throw Error('No verified garment mask');
  const jpeg=await sharp(data,{raw:{width,height,channels:3}}).jpeg({quality:90,chromaSubsampling:'4:4:4'}).toBuffer();
  const packed=replaceColour(await readFile(sourceFile),jpeg);
  if(packed.bytes.length>=800000) throw Error('Shipping byte budget exceeded');
  if(!/^[a-z0-9_-]+$/.test(profile.family)||!/^[a-z0-9_-]+$/.test(profile.revision)) throw Error('Explicit safe textile family/revision required');
  const out=await candidateDirectory(`artifacts/city-npc-models/textiles/${profile.family}/${profile.revision}`);
  try { const previous=await readFile(path.join(out,`${profile.family}.glb`)); if(sha256(previous)!==sha256(packed.bytes)) throw Error('Use a fresh textile revision; previous candidate is immutable'); } catch(error) { if(error.code!=='ENOENT') throw error; }
  await writeFile(path.join(out,`${profile.family}.glb`),packed.bytes);
  await sharp(mask,{raw:{width,height,channels:1}}).png().toFile(path.join(out,'garment-mask.png'));
  await writeFile(path.join(out,'colour.jpg'),jpeg);
  const report={schema:1,family:profile.family,sourceSHA256:rig.sha256,sha256:sha256(packed.bytes),textureSHA256:sha256(jpeg),bytes:packed.bytes.length,width,height,changedPixels:changed,paddedPixels,excludedOverlapPixels:conflicts,regions:profile.regions,unchangedDataHashes:packed.unchangedDataHashes,geometryRigAnimationUnchanged:true,visualReview:'pending'};
  await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
  return report;
}

if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  if(!process.argv[2]) throw Error('Usage: thai-textiles.mjs prepared.glb [inspected-profile.json]');
  const profile=process.argv[3]?JSON.parse(await readFile(process.argv[3],'utf8')):KEEPER;
  console.log(JSON.stringify(await paintTextiles(process.argv[2],profile)));
}
