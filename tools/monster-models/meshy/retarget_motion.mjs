// Offline Meshy overlays. No file/network operations run when this module is imported.
// Keep approved bodies immutable: output contains rest nodes and animations only.
import { Quaternion, Matrix4, Vector3 } from 'three';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const BIPED_TYPES = Object.freeze(['chalawan', 'bamboo_grave_3', 'sealed_mine_3', 'dusk_fort_3', 'giant_valley_3', 'himmapan_3', 'fallen_city_3', 'demon_rift_3']);
export const JOINT_CAPS = Object.freeze({ Body: .03, Head: .06, ArmLUpper: .08, ArmRUpper: .08, ArmLLower: .12, ArmRLower: .12 });
export const BONE_MAP = Object.freeze({ Body: 'Spine', Head: 'Head', ArmLUpper: 'LeftArm', ArmRUpper: 'RightArm', ArmLLower: 'LeftForeArm', ArmRLower: 'RightForeArm' });
export const ACTIONS = Object.freeze([
  Object.freeze({ id: 0, clip: 'Idle', name: 'idle-meshy', base: 'idle' }),
  Object.freeze({ id: 125, clip: 'Charged_Spell_Cast', name: 'cast-meshy', base: 'attack' }),
  Object.freeze({ id: 126, clip: 'Charged_Spell_Cast_1', name: 'ritual-meshy', base: 'attack' }),
  Object.freeze({ id: 219, clip: 'Right_Hand_Sword_Slash', name: 'slash-meshy', base: 'attack' }),
]);
const PROVENANCE = Object.freeze({ provider: 'Meshy', rigTaskId: '01a11b9d-af9e-770f-b66d-b8ccb4fbdf43', animationTaskId: '01a1213d-1018-725f-9018-1e81e24c9a8a', actionIds: [0, 125, 126, 219], credits: 12 });
const COMPONENTS = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
const TYPES = { 5120: [Int8Array, 'getInt8', 1, 127], 5121: [Uint8Array, 'getUint8', 1, 255], 5122: [Int16Array, 'getInt16', 2, 32767], 5123: [Uint16Array, 'getUint16', 2, 65535], 5125: [Uint32Array, 'getUint32', 4, 4294967295], 5126: [Float32Array, 'getFloat32', 4, 1] };
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const copy = value => structuredClone(value);
const identity = () => new Quaternion();

export function parseGLB(bytes) {
  const b = Buffer.from(bytes);
  if (b.length < 20 || b.readUInt32LE(0) !== 0x46546c67 || b.readUInt32LE(4) !== 2 || b.readUInt32LE(8) !== b.length) throw Error('Expected a complete glTF 2 GLB');
  let json, bin = Buffer.alloc(0);
  for (let at = 12; at < b.length;) {
    if (at + 8 > b.length) throw Error('Truncated GLB chunk');
    const length = b.readUInt32LE(at), type = b.readUInt32LE(at + 4); at += 8;
    if (at + length > b.length || length % 4) throw Error('Invalid GLB chunk');
    if (type === 0x4e4f534a) { if (json) throw Error('Duplicate JSON chunk'); json = JSON.parse(b.subarray(at, at + length).toString('utf8').trim()); }
    else if (type === 0x004e4942) bin = b.subarray(at, at + length);
    else throw Error('Unsupported GLB chunk');
    at += length;
  }
  if (!json || json.asset?.version !== '2.0' || json.buffers?.some(b => b.uri)) throw Error('Only self-contained GLBs are supported');
  return { json, bin };
}

function packGLB(json, bin) {
  const content = Buffer.from(JSON.stringify(json)), padding = (4 - content.length % 4) % 4;
  const text = Buffer.concat([content, Buffer.alloc(padding, 32)]), data = Buffer.concat([bin, Buffer.alloc((4 - bin.length % 4) % 4)]);
  const result = Buffer.alloc(12 + 8 + text.length + 8 + data.length);
  result.writeUInt32LE(0x46546c67, 0); result.writeUInt32LE(2, 4); result.writeUInt32LE(result.length, 8);
  result.writeUInt32LE(text.length, 12); result.writeUInt32LE(0x4e4f534a, 16); text.copy(result, 20);
  const at = 20 + text.length; result.writeUInt32LE(data.length, at); result.writeUInt32LE(0x004e4942, at + 4); data.copy(result, at + 8);
  return result;
}

// Use the same Meshopt decoder as unpack.mjs. Do not dequantize/repack body data.
export async function readMotionGLB(bytes) {
  const doc = parseGLB(bytes), views = new Map(), accessors = new Map();
  let decoder;
  const view = async index => {
    if (views.has(index)) return views.get(index);
    const v = doc.json.bufferViews?.[index]; if (!v) throw Error(`Missing bufferView ${index}`);
    const ext = v.extensions?.EXT_meshopt_compression;
    let data;
    if (ext) {
      if (ext.buffer !== 0) throw Error('Meshopt data must be embedded');
      decoder ??= (await import('three/addons/libs/meshopt_decoder.module.js')).MeshoptDecoder;
      await decoder.ready;
      data = Buffer.alloc(ext.count * ext.byteStride);
      decoder.decodeGltfBuffer(data, ext.count, ext.byteStride, doc.bin.subarray(ext.byteOffset ?? 0, (ext.byteOffset ?? 0) + ext.byteLength), ext.mode, ext.filter);
    } else {
      if (v.buffer !== 0) throw Error('External/fallback buffer has no embedded data');
      const start = v.byteOffset ?? 0;
      if (start + v.byteLength > doc.bin.length) throw Error('bufferView exceeds embedded data');
      data = doc.bin.subarray(start, start + v.byteLength);
    }
    views.set(index, data); return data;
  };
  doc.accessor = async index => {
    if (accessors.has(index)) return accessors.get(index);
    const a = doc.json.accessors?.[index], components = COMPONENTS[a?.type], info = TYPES[a?.componentType];
    if (!a || !components || !info || !Number.isSafeInteger(a.count) || a.count < 1) throw Error(`Unsupported motion accessor ${index}`);
    const [ArrayType, getter, size, divisor] = info, element = components * size;
    const raw = Buffer.alloc(a.count * element);
    if (a.bufferView !== undefined) {
      const bytes = await view(a.bufferView), stride = doc.json.bufferViews[a.bufferView].byteStride ?? element, offset = a.byteOffset ?? 0;
      if (stride < element || offset + (a.count - 1) * stride + element > bytes.length) throw Error('Motion accessor exceeds bufferView');
      for (let i = 0; i < a.count; i++) bytes.copy(raw, i * element, offset + i * stride, offset + i * stride + element);
    }
    if (a.sparse) {
      const s = a.sparse, spec = TYPES[s.indices.componentType];
      if (![5121, 5123, 5125].includes(s.indices.componentType)) throw Error('Invalid sparse indices');
      const indices = await view(s.indices.bufferView), values = await view(s.values.bufferView), d = new DataView(indices.buffer, indices.byteOffset, indices.byteLength);
      for (let i = 0; i < s.count; i++) {
        const n = d[spec[1]]((s.indices.byteOffset ?? 0) + i * spec[2], true), start = (s.values.byteOffset ?? 0) + i * element;
        if (n >= a.count || start + element > values.length) throw Error('Sparse motion data exceeds accessor');
        values.copy(raw, n * element, start, start + element);
      }
    }
    const data = new DataView(raw.buffer, raw.byteOffset, raw.byteLength), array = new ArrayType(a.count * components), values = new Float64Array(array.length);
    for (let i = 0; i < array.length; i++) { array[i] = data[getter](i * size, true); values[i] = a.normalized ? Math.max(info[0] === Int8Array || info[0] === Int16Array ? -1 : 0, array[i] / divisor) : array[i]; }
    const result = { meta: a, raw, array, values, components, count: a.count }; accessors.set(index, result); return result;
  };
  return doc;
}

function builder() {
  const chunks = [], bufferViews = [], accessors = []; let length = 0;
  return { bufferViews, accessors,
    add(meta, raw) {
      const pad = (4 - length % 4) % 4; if (pad) { chunks.push(Buffer.alloc(pad)); length += pad; }
      const index = accessors.length, view = bufferViews.length;
      bufferViews.push({ buffer: 0, byteOffset: length, byteLength: raw.length }); chunks.push(raw); length += raw.length;
      const { bufferView, byteOffset, sparse, extensions, ...keep } = meta;
      accessors.push({ ...copy(keep), bufferView: view }); return index;
    }, finish() { return Buffer.concat(chunks); },
  };
}

function parentsOf(nodes) {
  const parents = Array(nodes.length).fill(-1);
  nodes.forEach((n, p) => (n.children ?? []).forEach(i => { if (!nodes[i] || parents[i] !== -1) throw Error('Invalid/non-tree node hierarchy'); parents[i] = p; }));
  return parents;
}

async function skeletonPack(doc, animations) {
  const nodes = doc.json.nodes, parents = parentsOf(nodes), keep = new Set(doc.json.skins?.flatMap(s => s.joints) ?? nodes.map((_, i) => i));
  for (const a of animations) for (const c of a.channels) keep.add(c.target.node);
  for (const i of [...keep]) { const visited = new Set(); for (let p = i; p !== -1; p = parents[p]) { if (!nodes[p] || visited.has(p)) throw Error('Cyclic/missing motion node'); visited.add(p); keep.add(p); } }
  const indices = [...keep].sort((a, b) => a - b), remap = new Map(indices.map((n, i) => [n, i]));
  const rest = indices.map(i => {
    const n = nodes[i], clean = {};
    for (const key of ['name', 'translation', 'rotation', 'scale', 'matrix']) if (n[key] !== undefined) clean[key] = copy(n[key]);
    const children = (n.children ?? []).filter(n => keep.has(n)).map(n => remap.get(n)); if (children.length) clean.children = children;
    return clean;
  });
  const b = builder(), used = new Map();
  const add = async index => { if (!used.has(index)) { const a = await doc.accessor(index); used.set(index, b.add(a.meta, a.raw)); } return used.get(index); };
  const clips = [];
  for (const a of animations) {
    const samplers = [];
    for (const s of a.samplers) samplers.push({ input: await add(s.input), output: await add(s.output), interpolation: s.interpolation ?? 'LINEAR' });
    clips.push({ name: a.name, samplers, channels: a.channels.map(c => ({ sampler: c.sampler, target: { node: remap.get(c.target.node), path: c.target.path } })) });
  }
  const bin = b.finish(), json = { asset: { version: '2.0', generator: 'ThaiNativeOnline offline Meshy motion' }, scene: 0, scenes: [{ nodes: indices.filter(i => parents[i] === -1).map(i => remap.get(i)) }], nodes: rest, animations: clips, buffers: [{ byteLength: bin.length }], bufferViews: b.bufferViews, accessors: b.accessors };
  return packGLB(json, bin);
}

export async function extractMotionSkeleton(source) {
  const doc = await readMotionGLB(source);
  if (!doc.json.animations?.length) throw Error('Donor has no animation');
  const glb = await skeletonPack(doc, doc.json.animations);
  return { glb, manifest: { ...PROVENANCE, sourceSHA256: sha(source), motionSHA256: sha(glb), bytes: glb.length, clips: doc.json.animations.map(a => a.name), skeletonOnly: true } };
}

function quaternion(value) {
  if (!value || value.length !== 4 || value.some(n => !Number.isFinite(n))) throw Error('Invalid rotation');
  const q = new Quaternion(...value); if (q.lengthSq() < 1e-12) throw Error('Zero rotation'); return q.normalize();
}
function restRotation(node) {
  if (!node.matrix) return quaternion(node.rotation ?? [0, 0, 0, 1]);
  const q = identity(); new Matrix4().fromArray(node.matrix).decompose(new Vector3(), q, new Vector3()); return q.normalize();
}
function worldFrames(nodes, local) {
  const parents = parentsOf(nodes), result = new Map(), visiting = new Set();
  const get = i => { if (result.has(i)) return result.get(i); if (visiting.has(i)) throw Error('Cyclic rig'); visiting.add(i); const q = (parents[i] === -1 ? identity() : get(parents[i]).clone()).multiply(local.get(i) ?? restRotation(nodes[i])).normalize(); result.set(i, q); visiting.delete(i); return q; };
  nodes.forEach((_, i) => get(i)); return result;
}
async function rotationTracks(doc, clip) {
  const result = new Map();
  for (const c of clip.channels) if (c.target.path === 'rotation') {
    if (result.has(c.target.node)) throw Error('Duplicate rotation channel');
    const s = clip.samplers[c.sampler], input = await doc.accessor(s.input), output = await doc.accessor(s.output);
    if (input.components !== 1 || output.components !== 4 || input.count !== output.count || !['LINEAR', 'STEP'].includes(s.interpolation ?? 'LINEAR')) throw Error('Bake cubic/invalid rotation tracks before retargeting');
    const times = [...input.values];
    if (times.some((t, i) => !Number.isFinite(t) || t < 0 || (i && t <= times[i - 1]))) throw Error('Animation times must increase');
    const rotations = times.map((_, i) => quaternion([...output.values.slice(i * 4, i * 4 + 4)]));
    result.set(c.target.node, { times, rotations, interpolation: s.interpolation ?? 'LINEAR' });
  }
  return result;
}
function sample(track, time) {
  if (time <= track.times[0]) return track.rotations[0].clone();
  let i = 0; while (i + 1 < track.times.length && track.times[i + 1] <= time) i++;
  if (i + 1 === track.times.length || track.interpolation === 'STEP') return track.rotations[i].clone();
  return track.rotations[i].clone().slerp(track.rotations[i + 1], (time - track.times[i]) / (track.times[i + 1] - track.times[i])).normalize();
}
async function rangeOf(doc, clip) {
  let start = Infinity, end = -Infinity;
  for (const s of clip.samplers) { const a = await doc.accessor(s.input); for (const t of a.values) { if (!Number.isFinite(t)) throw Error('Nonfinite clip time'); start = Math.min(start, t); end = Math.max(end, t); } }
  if (!(end > start) || start < 0) throw Error('Clip has no positive duration'); return { start, end, duration: end - start };
}

export async function retargetMotion({ source, target, type, actions = ACTIONS, caps = {}, gain = .5, actionGains = {}, sampleRate = 24 }) {
  if (!BIPED_TYPES.includes(type)) throw Error('Only the eight approved biped types can be retargeted');
  if (!Number.isFinite(gain) || gain <= 0 || gain > 1 || !Number.isInteger(sampleRate) || sampleRate < 24 || sampleRate > 120) throw Error('Invalid bounded gain/sample rate');
  if (Object.keys(caps).some(k => !(k in JOINT_CAPS))) throw Error('Cannot animate a protected joint');
  const limits = { ...JOINT_CAPS, ...caps };
  for (const [key, value] of Object.entries(limits)) if (!Number.isFinite(value) || value < 0 || value > JOINT_CAPS[key]) throw Error(`Cap exceeds approved limit: ${key}`);
  if (!Array.isArray(actions) || !actions.length || actions.some(a => !ACTIONS.some(b => b.id === a.id && b.clip === a.clip && b.name === a.name && b.base === a.base)) || new Set(actions.map(a => a.id)).size !== actions.length) throw Error('Actions must explicitly match the inspected Meshy clips');
  if (!actionGains || typeof actionGains !== 'object' || Array.isArray(actionGains) || Object.entries(actionGains).some(([id, value]) => !actions.some(a => String(a.id) === id) || !Number.isFinite(value) || value <= 0 || value > 1)) throw Error('Invalid bounded per-action gain');
  const donor = await readMotionGLB(source), body = await readMotionGLB(target), originalClips = body.json.animations;
  if (originalClips.map(a => a.name).sort().join(',') !== 'attack,die,hurt,idle,walk') throw Error('Approved body must retain its five original clips');
  const named = nodes => { const map = new Map(); nodes.forEach((n, i) => { if (!n.name) return; if (map.has(n.name)) throw Error(`Ambiguous bone name: ${n.name}`); map.set(n.name, i); }); return map; };
  const sourceNames = named(donor.json.nodes), targetNames = named(body.json.nodes), targetWorld = worldFrames(body.json.nodes, new Map());
  for (const [t, s] of Object.entries(BONE_MAP)) if (!targetNames.has(t) || !sourceNames.has(s)) throw Error(`Missing mapped bone ${t}/${s}`);
  const built = builder(), generated = [], receipts = [];
  // Reuse original accessors directly for every protected track; skeletonPack
  // copies their decoded component bytes exactly, without resampling/normalizing.
  const offset = body.json.accessors.length;
  for (const action of actions) {
    const actionGain = actionGains[action.id] ?? gain;
    const sourceClip = donor.json.animations.find(a => a.name === action.clip), base = originalClips.find(a => a.name === action.base);
    if (!sourceClip) throw Error(`Missing donor clip: ${action.clip}`);
    const sourceTracks = await rotationTracks(donor, sourceClip), baseTracks = await rotationTracks(body, base);
    const sr = await rangeOf(donor, sourceClip), br = await rangeOf(body, base);
    const first = new Map([...sourceTracks].map(([i, t]) => [i, sample(t, sr.start)])), sourceWorld = worldFrames(donor.json.nodes, first);
    const clip = copy(base); clip.name = action.name;
    const receipt = { ...action, gain: actionGain, baseDuration: br.duration, sourceDuration: sr.duration, upperBody: [], protectedTracks: [] };
    for (const channel of clip.channels) {
      const name = body.json.nodes[channel.target.node].name, sourceName = BONE_MAP[name];
      if (channel.target.path !== 'rotation' || !sourceName) {
        const sampler = base.samplers[channel.sampler], input = await body.accessor(sampler.input), output = await body.accessor(sampler.output);
        receipt.protectedTracks.push({ bone: name, path: channel.target.path, inputSHA256: sha(input.raw), outputSHA256: sha(output.raw), interpolation: sampler.interpolation ?? 'LINEAR' }); continue;
      }
      const si = sourceNames.get(sourceName), ti = channel.target.node, st = sourceTracks.get(si), bt = baseTracks.get(ti);
      if (!st || !bt) throw Error(`Missing rotation channel for ${name}/${sourceName}`);
      // Deduplicate AFTER Float32 rounding: nearly coincident donor/base keys
      // must not become duplicate input times when written to the GLB.
      const times = [...new Set([...bt.times, ...st.times.map(t => br.start + (t - sr.start) / sr.duration * br.duration), ...Array.from({ length: Math.ceil(br.duration * sampleRate) + 1 }, (_, i) => Math.min(br.end, br.start + i / sampleRate))].map(Math.fround))].sort((a, b) => a - b);
      const output = new Float32Array(times.length * 4), sourceFirstInverse = first.get(si).clone().invert(), sourceFrame = sourceWorld.get(si), targetFrame = targetWorld.get(ti);
      let previous, maximumDelta = 0;
      for (let i = 0; i < times.length; i++) {
        const phase = Math.max(0, Math.min(1, (times[i] - br.start) / br.duration)), at = sr.start + phase * sr.duration;
        // Donor local delta -> world axis -> target rest local axis. Conjugation
        // retains the approved target roll instead of copying donor resting pose.
        const delta = sourceFirstInverse.clone().multiply(sample(st, at)).normalize();
        delta.premultiply(sourceFrame).multiply(sourceFrame.clone().invert());
        delta.premultiply(targetFrame.clone().invert()).multiply(targetFrame).normalize();
        const angle = identity().angleTo(delta), envelope = Math.sin(Math.PI * phase) ** 2;
        const bounded = identity().slerp(delta, angle > 1e-12 ? Math.min(1, limits[name] / angle) * actionGain * envelope : 0);
        const pose = sample(bt, times[i]), result = pose.clone().multiply(bounded).normalize();
        maximumDelta = Math.max(maximumDelta, pose.angleTo(result));
        if (previous && previous.dot(result) < 0) result.set(-result.x, -result.y, -result.z, -result.w);
        result.toArray(output, i * 4); previous = result;
      }
      const input = built.add({ componentType: 5126, type: 'SCALAR', count: times.length, min: [times[0]], max: [times.at(-1)] }, Buffer.from(new Float32Array(times).buffer));
      const out = built.add({ componentType: 5126, type: 'VEC4', count: times.length }, Buffer.from(output.buffer));
      channel.sampler = clip.samplers.length; clip.samplers.push({ input: offset + input, output: offset + out, interpolation: 'LINEAR' });
      receipt.upperBody.push({ bone: name, sourceBone: sourceName, cap: limits[name], maximumDelta, keys: times.length });
    }
    if (receipt.upperBody.length !== 6) throw Error('Expected all six upper-body overlays');
    // Remove unused copies of replaced samplers so no unreferenced motion leaks.
    const used = [...new Set(clip.channels.map(c => c.sampler))], remap = new Map(used.map((n, i) => [n, i]));
    clip.samplers = used.map(i => clip.samplers[i]); clip.channels.forEach(c => { c.sampler = remap.get(c.sampler); });
    generated.push(clip); receipts.push(receipt);
  }
  const originalRead = body.accessor, added = built.accessors, addedBin = built.finish();
  body.accessor = async i => i < offset ? originalRead(i) : { meta: added[i - offset], raw: addedBin.subarray(built.bufferViews[added[i - offset].bufferView].byteOffset, built.bufferViews[added[i - offset].bufferView].byteOffset + built.bufferViews[added[i - offset].bufferView].byteLength) };
  const glb = await skeletonPack(body, generated);
  const manifest = { version: 1, ...PROVENANCE, type, actionIds: actions.map(a => a.id), sourceSHA256: sha(source), bodySHA256: sha(target), motionSHA256: sha(glb), bytes: glb.length, skeletonOnly: true, originalBodyClips: originalClips.map(a => a.name), gain, actionGains: copy(actionGains), sampleRate, caps: limits, boneMap: BONE_MAP, method: 'first-key-relative rotations; world-axis conjugation; bounded additive overlay; sine-squared endpoint envelope; donor phase mapped to unchanged base timing', clips: receipts };
  return { glb, manifest };
}

async function main(args) {
  const options = {};
  for (let i = 0; i < args.length; i += 2) { if (!['--input', '--target', '--type', '--dest', '--gain', '--action-gains', '--motion-source'].includes(args[i]) || !args[i + 1] || options[args[i]]) throw Error('Usage: --input donor.glb --type TYPE --dest candidate-motion.glb [--target approved-body.glb] [--gain .5] [--action-gains gains.json] [--motion-source skeleton-donor.glb]'); options[args[i]] = args[i + 1]; }
  if (!options['--input'] || !options['--type'] || !options['--dest']) throw Error('Explicit --input, --type and --dest are required');
  const input = path.resolve(options['--input']), type = options['--type'], target = path.resolve(options['--target'] ?? `public/models/monsters/${type}.glb`), dest = path.resolve(options['--dest']);
  if (dest === input || dest === target || dest.split(path.sep).includes('public')) throw Error('Write candidates outside public; parent owns publication');
  const actionGains = options['--action-gains'] ? JSON.parse(await fs.readFile(options['--action-gains'], 'utf8')) : {};
  const source = await fs.readFile(input), body = await fs.readFile(target), result = await retargetMotion({ source, target: body, type, gain: options['--gain'] === undefined ? .5 : Number(options['--gain']), actionGains });
  await fs.mkdir(path.dirname(dest), { recursive: true }); await fs.writeFile(dest, result.glb); await fs.writeFile(dest.replace(/\.glb$/i, '') + '-manifest.json', JSON.stringify(result.manifest, null, 2) + '\n');
  if (options['--motion-source']) {
    const out = path.resolve(options['--motion-source']); if (out === input || out === target || out === dest || out.split(path.sep).includes('public')) throw Error('Invalid skeleton source destination');
    const motion = await extractMotionSkeleton(source); await fs.mkdir(path.dirname(out), { recursive: true }); await fs.writeFile(out, motion.glb); await fs.writeFile(out.replace(/\.glb$/i, '') + '-manifest.json', JSON.stringify(motion.manifest, null, 2) + '\n');
  }
  console.log(JSON.stringify({ type, dest, bytes: result.glb.length, sha256: result.manifest.motionSHA256, clips: result.manifest.clips.map(c => c.name) }));
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main(process.argv.slice(2)).catch(error => { console.error(error.message); process.exitCode = 1; });
