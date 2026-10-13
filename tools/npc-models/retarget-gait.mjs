// Retarget a mocap clip (ActionForge / Quaternius CC0 exports) onto one of our rigs, adding or
// replacing a single clip. The target model keeps its meshes, textures, skin and other clips
// byte for byte.
//
//   node tools/npc-models/retarget-gait.mjs <source.glb> <model.glb> [out.glb] [--clip walk] [--from name] [--rig ue|mixamo]
//     --rig ue      (default) UE-mannequin source → Meshy-24 NPC rig
//     --rig mixamo  Mixamo source (the 85-clip pack) → our Mixamo class rigs (warrior, hunter …)
//     --from        source clip name (default: the source's first clip)
//   → writes out.glb (default: in place) and prints { stride } — metres the body travels per
//     cycle at the target's normalized height, which the NPC renderer uses to keep feet planted.
//
// Method: a bone's world rotation in the source is carried to the target through each side's
// rest pose, after aligning the two bodies (up, left, facing) and each bone's rest direction
// (so an A-pose and a T-pose arm agree):  Rt(t) = Rs(t) · Rs0⁻¹ · C · Rt0,  C·dirT0 = dirS0.
// The source's forward root motion is removed (the game moves the NPC); hip bob and sway are
// kept, scaled by hip height.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import * as THREE from 'three';

const RIGS = {
  ue: { // target (Meshy-24) ← source (UE mannequin)
    map: {
      Hips: 'pelvis', Spine02: 'spine_01', Spine01: 'spine_02', Spine: 'spine_03', neck: 'neck_01', Head: 'Head',   // Meshy's spine counts down: Hips › Spine02 › Spine01 › Spine
      LeftShoulder: 'clavicle_l', LeftArm: 'upperarm_l', LeftForeArm: 'lowerarm_l', LeftHand: 'hand_l',
      RightShoulder: 'clavicle_r', RightArm: 'upperarm_r', RightForeArm: 'lowerarm_r', RightHand: 'hand_r',
      LeftUpLeg: 'thigh_l', LeftLeg: 'calf_l', LeftFoot: 'foot_l', LeftToeBase: 'ball_l',
      RightUpLeg: 'thigh_r', RightLeg: 'calf_r', RightFoot: 'foot_r', RightToeBase: 'ball_r',
    },
    // the next bone along each chain, for the rest-direction alignment (none: keep the body alignment)
    next: { Spine02: 'Spine01', Spine01: 'Spine', Spine: 'neck', neck: 'Head', LeftShoulder: 'LeftArm', LeftArm: 'LeftForeArm',
      LeftForeArm: 'LeftHand', RightShoulder: 'RightArm', RightArm: 'RightForeArm', RightForeArm: 'RightHand',
      LeftUpLeg: 'LeftLeg', LeftLeg: 'LeftFoot', LeftFoot: 'LeftToeBase', RightUpLeg: 'RightLeg', RightLeg: 'RightFoot', RightFoot: 'RightToeBase' },
    body: { t: ['Hips', 'Head', 'LeftUpLeg', 'RightUpLeg', 'LeftFoot', 'RightFoot'], s: ['pelvis', 'Head', 'thigh_l', 'thigh_r', 'foot_l', 'foot_r'] },
  },
  mixamo: (() => { // same names on both sides; fingers stay at the target's rest
    const m = n => `mixamorig:${n}`, bones = ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head',
      ...['Left', 'Right'].flatMap(k => ['Shoulder', 'Arm', 'ForeArm', 'Hand', 'UpLeg', 'Leg', 'Foot', 'ToeBase'].map(b => k + b))];
    const chain = { Spine: 'Spine1', Spine1: 'Spine2', Spine2: 'Neck', Neck: 'Head',
      ...Object.fromEntries(['Left', 'Right'].flatMap(k => [['Shoulder', 'Arm'], ['Arm', 'ForeArm'], ['ForeArm', 'Hand'], ['Hand', 'HandMiddle1'], ['UpLeg', 'Leg'], ['Leg', 'Foot'], ['Foot', 'ToeBase']].map(([a, b]) => [k + a, k + b]))) };
    return {
      map: Object.fromEntries(bones.map(b => [m(b), m(b)])),
      next: Object.fromEntries(Object.entries(chain).map(([a, b]) => [m(a), m(b)])),
      body: { t: ['Hips', 'Head', 'LeftUpLeg', 'RightUpLeg', 'LeftFoot', 'RightFoot'].map(m), s: ['Hips', 'Head', 'LeftUpLeg', 'RightUpLeg', 'LeftFoot', 'RightFoot'].map(m) },
    };
  })(),
};
const FPS = 30;

const args = process.argv.slice(2), flag = k => { const i = args.indexOf(k); return i >= 0 ? args.splice(i, 2)[1] : null; };
const clipName = flag('--clip') ?? 'walk', fromName = flag('--from'), rig = RIGS[flag('--rig') ?? 'ue'];
if (!rig) throw new Error('--rig must be ue or mixamo');
const { map: MAP, next: NEXT, body: BODY } = rig;
const [sourcePath, targetPath, outPath = targetPath] = args;
await MeshoptDecoder.ready; await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });

// node tree with rest TRS and parent links
function tree(doc) {
  const nodes = new Map(), parent = new Map();
  const visit = (n, p) => { nodes.set(n.getName(), n); parent.set(n, p); for (const c of n.listChildren()) visit(c, n); };
  for (const s of doc.getRoot().listScenes()) for (const n of s.listChildren()) visit(n, null);
  return { nodes, parent };
}
// local matrix of a node at time t (animation samplers if given, else rest)
function sampler(anim) {
  const tracks = new Map();
  for (const ch of anim?.listChannels() ?? []) {
    const s = ch.getSampler(), key = ch.getTargetNode();
    const entry = tracks.get(key) ?? {}; entry[ch.getTargetPath()] = { t: s.getInput().getArray(), v: s.getOutput().getArray(), step: s.getInterpolation() === 'STEP' };
    tracks.set(key, entry);
  }
  const at = (track, time, size) => {
    const { t, v } = track; let i = 0; while (i < t.length - 2 && t[i + 1] <= time) i++;
    const k = t.length > 1 ? THREE.MathUtils.clamp((time - t[i]) / ((t[i + 1] - t[i]) || 1), 0, 1) : 0, j = Math.min(i + 1, t.length - 1);
    if (size === 4) return new THREE.Quaternion().fromArray(v, i * 4).slerp(new THREE.Quaternion().fromArray(v, j * 4), k);
    return new THREE.Vector3().fromArray(v, i * 3).lerp(new THREE.Vector3().fromArray(v, j * 3), k);
  };
  return (node, time) => {
    const tr = tracks.get(node);
    const p = tr?.translation ? at(tr.translation, time, 3) : new THREE.Vector3(...node.getTranslation());
    const q = tr?.rotation ? at(tr.rotation, time, 4) : new THREE.Quaternion(...node.getRotation());
    const s = tr?.scale ? at(tr.scale, time, 3) : new THREE.Vector3(...node.getScale());
    return new THREE.Matrix4().compose(p, q, s);
  };
}
function worlds(t, local) {
  const cache = new Map();
  const world = n => { if (!n) return new THREE.Matrix4(); if (cache.has(n)) return cache.get(n);
    const m = world(t.parent.get(n)).clone().multiply(local(n)); cache.set(n, m); return m; };
  return world;
}
const rotOf = m => { const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(); m.decompose(p, q, s); return q; };
const posOf = m => new THREE.Vector3().setFromMatrixPosition(m);
// a body frame from up (hips→head) and left (right hip→left hip)
function basis(world, n) {
  const up = posOf(world(n.head)).sub(posOf(world(n.hips))).normalize();
  const left = posOf(world(n.lhip)).sub(posOf(world(n.rhip)));
  left.addScaledVector(up, -left.dot(up)).normalize();
  const fwd = new THREE.Vector3().crossVectors(left, up).normalize();   // left × up = forward for a +Y-up, +Z-front body
  return new THREE.Matrix4().makeBasis(left, up, fwd);
}

const src = await io.read(sourcePath), tgt = await io.read(targetPath);
const S = tree(src), T = tree(tgt);
const anim = fromName ? src.getRoot().listAnimations().find(a => a.getName() === fromName) : src.getRoot().listAnimations()[0];
if (!anim) throw new Error(`source clip missing: ${fromName}`);
const duration = Math.max(...anim.listChannels().map(c => { const a = c.getSampler().getInput().getArray(); return a[a.length - 1]; }));
const srcAt = sampler(anim), srcRest = worlds(S, n => new THREE.Matrix4().compose(new THREE.Vector3(...n.getTranslation()), new THREE.Quaternion(...n.getRotation()), new THREE.Vector3(...n.getScale())));
const tgtRest = worlds(T, n => new THREE.Matrix4().compose(new THREE.Vector3(...n.getTranslation()), new THREE.Quaternion(...n.getRotation()), new THREE.Vector3(...n.getScale())));
const sN = name => { const n = S.nodes.get(name); if (!n) throw new Error(`source bone missing: ${name}`); return n; };
const tN = name => { const n = T.nodes.get(name); if (!n) throw new Error(`target bone missing: ${name}`); return n; };

// align the bodies: G turns the source's rest body frame into the target's
const [tHips, tHead, tLHip, tRHip, tLFoot, tRFoot] = BODY.t.map(tN), [sHips, sHead, sLHip, sRHip, sLFoot, sRFoot] = BODY.s.map(sN);
const Bs = basis(srcRest, { head: sHead, hips: sHips, lhip: sLHip, rhip: sRHip });
const Bt = basis(tgtRest, { head: tHead, hips: tHips, lhip: tLHip, rhip: tRHip });
const G = new THREE.Matrix4().multiplyMatrices(Bt, Bs.clone().invert()), Gq = rotOf(G);
// hip height (rest, above the lower foot) for the translation scale
const footY = (world, a, b) => Math.min(posOf(world(a)).y, posOf(world(b)).y);
const srcHip = posOf(srcRest(sHips)).applyMatrix4(G).y - footY(n => srcRest(n).clone().premultiply(G), sLFoot, sRFoot);
const tgtHip = posOf(tgtRest(tHips)).y - footY(tgtRest, tLFoot, tRFoot);
const scale = tgtHip / srcHip;

// per-bone rest alignment C (target rest direction → source rest direction, both in the target's world)
const C = {};
for (const [t, s] of Object.entries(MAP)) {
  C[t] = new THREE.Quaternion();
  const next = NEXT[t]; if (!next) continue;
  const dT = posOf(tgtRest(tN(next))).sub(posOf(tgtRest(tN(t)))).normalize();
  const dS = posOf(srcRest(sN(MAP[next] ?? next)))   // (a chain end outside the map: same name on both sides)
    .sub(posOf(srcRest(sN(s)))).applyQuaternion(Gq).normalize();
  C[t].setFromUnitVectors(dT, dS);
}
const Rs0 = Object.fromEntries(Object.entries(MAP).map(([t, s]) => [t, Gq.clone().multiply(rotOf(srcRest(sN(s))))]));
const Rt0 = Object.fromEntries(Object.keys(MAP).map(t => [t, rotOf(tgtRest(tN(t)))]));

// frames
const frames = Math.round(duration * FPS), times = [], out = Object.fromEntries(Object.keys(MAP).map(t => [t, []])), hipsPos = [];
const pelvisPath = [];
for (let f = 0; f <= frames; f++) {
  const time = Math.min(duration, f / FPS); times.push(f / FPS * (duration * FPS / frames));
  const sw = worlds(S, n => srcAt(n, time));
  pelvisPath.push(posOf(sw(sHips)).applyMatrix4(G));
  // target worlds are built top-down from the rotations just decided
  const tWorld = new Map();
  const targetWorld = n => { if (!n) return new THREE.Matrix4(); if (tWorld.has(n)) return tWorld.get(n);
    const m = targetWorld(T.parent.get(n)).clone().multiply(new THREE.Matrix4().compose(new THREE.Vector3(...n.getTranslation()), new THREE.Quaternion(...n.getRotation()), new THREE.Vector3(...n.getScale())));
    tWorld.set(n, m); return m; };
  const order = Object.keys(MAP).sort((a, b) => depth(tN(a)) - depth(tN(b)));
  for (const t of order) {
    const node = tN(t), Rs = Gq.clone().multiply(rotOf(sw(sN(MAP[t]))));
    const Rt = Rs.multiply(Rs0[t].clone().invert()).multiply(C[t]).multiply(Rt0[t]);
    const parentWorld = targetWorld(T.parent.get(node)), parentQ = rotOf(parentWorld);
    const local = parentQ.clone().invert().multiply(Rt).normalize();
    out[t].push(local);
    // record this bone's new world for its children
    const m = parentWorld.clone().multiply(new THREE.Matrix4().compose(new THREE.Vector3(...node.getTranslation()), local, new THREE.Vector3(...node.getScale())));
    tWorld.set(node, m);
  }
}
function depth(n) { let d = 0; for (let p = T.parent.get(n); p; p = T.parent.get(p)) d++; return d; }
// root motion: the straight line from the first to the last frame is the travel; the rest is sway/bob.
// All of it, height included: a source body that leans a little in its rest pose gets a travel
// that climbs or sinks once aligned, and leaving that in would lift the hips a few cm over each
// cycle and drop them back at the loop (a stumble every step).
const travel = pelvisPath.at(-1).clone().sub(pelvisPath[0]);
const hipsNode = tHips, hipsParentInv = tgtRest(T.parent.get(hipsNode)).clone().invert(), hipsRestWorld = posOf(tgtRest(hipsNode));
for (let f = 0; f <= frames; f++) {
  const k = f / frames, along = travel.clone().multiplyScalar(k);
  const sway = pelvisPath[f].clone().sub(pelvisPath[0]).sub(along).multiplyScalar(scale);
  hipsPos.push(hipsRestWorld.clone().add(sway).applyMatrix4(hipsParentInv));
}
const stride = Math.hypot(travel.x, travel.z) * scale;   // metres per cycle in the target's units

// replace the target clip
const root = tgt.getRoot(), buffer = root.listBuffers()[0];
const old = root.listAnimations().find(a => a.getName() === clipName);
if (old) {
  const accessors = new Set(old.listSamplers().flatMap(s => [s.getInput(), s.getOutput()]));
  for (const c of old.listChannels()) c.dispose(); for (const s of old.listSamplers()) s.dispose(); old.dispose();
  for (const a of accessors) if (a && !a.listParents().some(p => p.propertyType !== 'Root')) a.dispose();
}
const clip = tgt.createAnimation(clipName);
const input = tgt.createAccessor().setType('SCALAR').setArray(new Float32Array(times)).setBuffer(buffer);
const add = (node, path, type, array) => {
  const s = tgt.createAnimationSampler().setInput(input).setOutput(tgt.createAccessor().setType(type).setArray(array).setBuffer(buffer)).setInterpolation('LINEAR');
  clip.addSampler(s).addChannel(tgt.createAnimationChannel().setTargetNode(node).setTargetPath(path).setSampler(s));
};
add(hipsNode, 'translation', 'VEC3', new Float32Array(hipsPos.flatMap(v => [v.x, v.y, v.z])));
for (const t of Object.keys(MAP)) add(tN(t), 'rotation', 'VEC4', new Float32Array(out[t].flatMap(q => [q.x, q.y, q.z, q.w])));
await io.write(outPath, tgt);
console.log(JSON.stringify({ clip: clipName, duration: +duration.toFixed(3), frames: frames + 1, stride: +stride.toFixed(4), scale: +scale.toFixed(4) }));
