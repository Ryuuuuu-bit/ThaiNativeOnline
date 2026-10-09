import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { Quaternion, Vector3, AnimationMixer, LoopOnce } from 'three';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { gltfLoader } from '../src/core/gltf.js';
import { ACTIONS, BIPED_TYPES, BONE_MAP, JOINT_CAPS, parseGLB, readMotionGLB, extractMotionSkeleton, retargetMotion } from '../tools/monster-models/meshy/retarget_motion.mjs';

const motionPath = new URL('../tools/monster-models/meshy/motions/meshy-boss-actions.glb', import.meta.url);
const source = await fs.readFile(motionPath);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const channels = doc => clip => new Map(clip.channels.map(c => [`${doc.json.nodes[c.target.node].name}:${c.target.path}`, c]));
const rotation = value => new Quaternion(...value).normalize();
const turn = (axis, angle) => new Quaternion().setFromAxisAngle(new Vector3(...axis), angle);

test('skeleton donor is compact, reproducible and contains four exact Meshy actions without geometry or credentials', async () => {
  const doc = parseGLB(source), manifest = JSON.parse(await fs.readFile(new URL('../tools/monster-models/meshy/motions/meshy-boss-actions-manifest.json', import.meta.url)));
  assert.equal(hash(source), manifest.motionSHA256); assert.equal(manifest.provider, 'Meshy');
  assert.deepEqual(manifest.actionIds, [0, 125, 126, 219]); assert.equal(manifest.credits, 12);
  assert.equal(manifest.rigTaskId, '01a11b9d-af9e-770f-b66d-b8ccb4fbdf43');
  assert.deepEqual(doc.json.animations.map(a => a.name), ACTIONS.map(a => a.clip));
  assert.ok(source.length < 220000); assert.equal(doc.json.meshes, undefined); assert.equal(doc.json.skins, undefined);
  for (const key of ['materials', 'images', 'textures']) assert.equal(doc.json[key], undefined);
  assert.ok(doc.json.nodes.every(n => n.mesh === undefined && n.skin === undefined));
  assert.doesNotMatch(JSON.stringify(manifest), /https?:|Signature|credential|token/i);
  const again = await extractMotionSkeleton(source); assert.deepEqual(again.glb, source);
});

for (const type of BIPED_TYPES) test(`${type}: optional motion preserves protected component arrays/rest graph and binds to the approved body`, async t => {
  const file = new URL(`../public/models/monsters/${type}.glb`, import.meta.url), target = await fs.readFile(file), before = hash(target);
  const result = await retargetMotion({ source, target, type }), body = await readMotionGLB(target), motion = await readMotionGLB(result.glb);
  assert.equal(hash(target), before); assert.equal(hash(await fs.readFile(file)), before);
  assert.equal(result.manifest.bodySHA256, before); assert.equal(result.manifest.motionSHA256, hash(result.glb));
  assert.ok(result.glb.length < 100000); assert.equal(motion.json.meshes, undefined); assert.equal(motion.json.skins, undefined);
  for (const key of ['materials', 'textures', 'images']) assert.equal(motion.json[key], undefined);
  assert.deepEqual(motion.json.animations.map(a => a.name), ACTIONS.map(a => a.name));
  assert.deepEqual(body.json.animations.map(a => a.name), ['idle', 'walk', 'attack', 'hurt', 'die']);
  for (const n of motion.json.nodes) {
    const original = body.json.nodes.find(b => b.name === n.name); assert.ok(original, `no donor rest node: ${n.name}`);
    for (const key of ['rotation', 'translation', 'scale', 'matrix']) assert.deepEqual(n[key], original[key]);
  }
  const baseChannels = channels(body), motionChannels = channels(motion);
  for (const action of ACTIONS) {
    const clip = motion.json.animations.find(a => a.name === action.name), base = body.json.animations.find(a => a.name === action.base), prior = baseChannels(base);
    assert.equal(clip.channels.length, base.channels.length);
    assert.ok(result.manifest.clips.find(c => c.id === action.id).upperBody.some(b => b.maximumDelta > .0001), 'each optional clip adds real donor motion');
    for (const [key, c] of motionChannels(clip)) {
      const name = motion.json.nodes[c.target.node].name, s = clip.samplers[c.sampler], a = await motion.accessor(s.input), b = await motion.accessor(s.output), original = prior.get(key);
      assert.ok(original, `no donor translation/finger/leg channel: ${key}`);
      if (c.target.path === 'rotation' && name in JOINT_CAPS) {
        assert.ok(a.count > 2); assert.ok(a.values.every((t, i) => Number.isFinite(t) && (!i || t > a.values[i - 1])));
        for (let i = 0; i < b.count; i++) assert.ok(Math.abs(Math.hypot(...b.values.slice(i * 4, i * 4 + 4)) - 1) < 1e-6);
        const receipt = result.manifest.clips.find(c => c.id === action.id).upperBody.find(b => b.bone === name);
        assert.ok(receipt.maximumDelta >= 0); assert.ok(receipt.maximumDelta <= JOINT_CAPS[name] * .5 + 1e-7);
      } else {
        const os = base.samplers[original.sampler], oa = await body.accessor(os.input), ob = await body.accessor(os.output);
        assert.deepEqual(a.raw, oa.raw, `${key} times are byte exact`); assert.deepEqual(b.raw, ob.raw, `${key} values are byte exact`);
        for (const meta of ['componentType', 'normalized', 'type', 'count']) { assert.equal(a.meta[meta], oa.meta[meta]); assert.equal(b.meta[meta], ob.meta[meta]); }
        assert.equal(s.interpolation, os.interpolation ?? 'LINEAR');
      }
    }
  }
  const loader = gltfLoader().register(() => ({ name: 'QA_TEXTURES', loadTexture: () => Promise.resolve(null) }));
  const bodyGltf = await loader.parseAsync(target.buffer.slice(target.byteOffset, target.byteOffset + target.byteLength), '');
  const motionGltf = await loader.parseAsync(result.glb.buffer.slice(result.glb.byteOffset, result.glb.byteOffset + result.glb.byteLength), '');
  const first = clone(bodyGltf.scene), second = clone(bodyGltf.scene), a = new AnimationMixer(first), b = new AnimationMixer(second);
  const protectedNames = body.json.nodes.filter(n => /^(Root|Pelvis|Leg)/.test(n.name)).map(n => n.name);
  const actual = new Vector3(), expected = new Vector3(); let maxFootDifference = 0, maxSegmentDifference = 0;
  for (const action of ACTIONS) {
    a.stopAllAction(); b.stopAllAction();
    const base = bodyGltf.animations.find(c => c.name === action.base), overlay = motionGltf.animations.find(c => c.name === action.name);
    assert.equal(overlay.duration, base.duration);
    for (const [m, clip] of [[a, base], [b, overlay]]) { const act = m.clipAction(clip); act.setLoop(LoopOnce, 1); act.clampWhenFinished = true; act.play(); }
    for (let frame = 0; frame <= Math.ceil(base.duration * 24); frame++) {
      const at = Math.min(base.duration, frame / 24); a.setTime(at); b.setTime(at); first.updateMatrixWorld(true); second.updateMatrixWorld(true);
      for (const name of protectedNames) {
        const left = first.getObjectByName(name), right = second.getObjectByName(name);
        maxFootDifference = Math.max(maxFootDifference, left.getWorldPosition(expected).distanceTo(right.getWorldPosition(actual)));
      }
      for (const name of ['ArmLLower', 'ArmRLower', 'HandL', 'HandR']) {
        const left = first.getObjectByName(name), right = second.getObjectByName(name);
        const leftLength = left.getWorldPosition(expected).distanceTo(left.parent.getWorldPosition(new Vector3()));
        const rightLength = right.getWorldPosition(actual).distanceTo(right.parent.getWorldPosition(new Vector3()));
        maxSegmentDifference = Math.max(maxSegmentDifference, Math.abs(leftLength - rightLength));
      }
      for (const name of ['HandL', 'HandR', 'Club', 'Sword', 'WingL', 'WingR']) {
        const left = first.getObjectByName(name), right = second.getObjectByName(name); if (!left) continue;
        assert.deepEqual(right.position.toArray(), left.position.toArray()); assert.deepEqual(right.quaternion.toArray(), left.quaternion.toArray()); assert.deepEqual(right.scale.toArray(), left.scale.toArray());
      }
    }
  }
  assert.ok(maxFootDifference < 1e-7, `root/leg/foot changed by ${maxFootDifference}`);
  // Compare against playback of the original quantized base clip with the
  // unchanged 5 mm production limb-length gate; this is not a skin-edge audit.
  t.diagnostic(JSON.stringify({ type, maxFootDifference, maxSegmentDifference, limbLengthGate: .005 }));
  assert.ok(maxSegmentDifference <= .005, `limb length changed by ${maxSegmentDifference}`);
});

// Small, deliberately different rest rolls/first donor poses catch a naïve
// absolute/local quaternion copy. Source root animation is never transferred.
function fixture(donor) {
  const nodeNames = donor ? ['Hips', 'Spine', 'Head', 'LeftArm', 'LeftForeArm', 'RightArm', 'RightForeArm', 'LeftHand', 'LeftLeg'] : ['Root', 'Body', 'Head', 'ArmLUpper', 'ArmLLower', 'ArmRUpper', 'ArmRLower', 'HandL', 'LegLFoot'];
  const nodes = nodeNames.map(name => ({ name }));
  nodes[0].rotation = turn([0, 0, 1], donor ? .4 : -.6).toArray(); nodes[0].children = [1, 8];
  nodes[1].rotation = turn([0, 1, 0], donor ? .2 : .3).toArray(); nodes[1].children = [2, 3, 5];
  nodes[3].rotation = turn([0, 0, 1], donor ? -.7 : 1.1).toArray(); nodes[3].children = [4]; nodes[4].children = [7]; nodes[5].children = [6];
  const accessors = [], bufferViews = [], chunks = []; let length = 0;
  const add = (values, type) => { const raw = Buffer.from(new Float32Array(values).buffer), index = accessors.length; bufferViews.push({ buffer: 0, byteOffset: length, byteLength: raw.length }); accessors.push({ bufferView: index, componentType: 5126, type, count: values.length / (type === 'VEC4' ? 4 : type === 'VEC3' ? 3 : 1) }); chunks.push(raw); length += raw.length; return index; };
  const input = add([0, .5, 1], 'SCALAR');
  const animations = (donor ? ACTIONS.map(a => a.clip) : ['idle', 'walk', 'attack', 'hurt', 'die']).map(name => {
    const samplers = [], channels = [];
    for (let i = 1; i <= 8; i++) {
      const first = donor && i === 1 ? turn([0, 1, 0], .8) : rotation(nodes[i].rotation ?? [0, 0, 0, 1]);
      const middle = donor && i === 3 ? first.clone().multiply(turn([1, 0, 0], .6)) : first;
      const output = add([...first.toArray(), ...middle.toArray(), ...first.toArray()], 'VEC4');
      channels.push({ sampler: samplers.length, target: { node: i, path: 'rotation' } }); samplers.push({ input, output, interpolation: 'LINEAR' });
    }
    const output = add(donor ? [900, 1000, 1100, 400, 500, 600, 100, 200, 300] : [0, 0, 0, .1, 0, .2, 0, 0, 0], 'VEC3');
    channels.push({ sampler: samplers.length, target: { node: 0, path: 'translation' } }); samplers.push({ input, output, interpolation: 'LINEAR' });
    return { name, channels, samplers };
  });
  const json = { asset: { version: '2.0' }, nodes, scene: 0, scenes: [{ nodes: [0] }], animations, accessors, bufferViews, buffers: [{ byteLength: length }] }, content = Buffer.from(JSON.stringify(json)), padded = Buffer.concat([content, Buffer.alloc((4 - content.length % 4) % 4, 32)]), bin = Buffer.concat(chunks), header = Buffer.alloc(20);
  header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4); header.writeUInt32LE(20 + padded.length + 8 + bin.length, 8); header.writeUInt32LE(padded.length, 12); header.writeUInt32LE(0x4e4f534a, 16);
  const h = Buffer.alloc(8); h.writeUInt32LE(bin.length, 0); h.writeUInt32LE(0x004e4942, 4); return Buffer.concat([header, padded, h, bin]);
}

test('relative first-key world-axis conjugation preserves target rest roll and obeys joint cap/endpoints', async () => {
  const target = fixture(false), donor = fixture(true), result = await retargetMotion({ source: donor, target, type: 'dusk_fort_3', gain: 1 }), output = await readMotionGLB(result.glb);
  const clip = output.json.animations[0], channel = clip.channels.find(c => output.json.nodes[c.target.node].name === 'ArmLUpper'), s = clip.samplers[channel.sampler], times = await output.accessor(s.input), values = await output.accessor(s.output), at = [...times.values].indexOf(.5);
  const sourceFrame = turn([0, 0, 1], .4).multiply(turn([0, 1, 0], .8)).multiply(turn([0, 0, 1], -.7));
  const targetFrame = turn([0, 0, 1], -.6).multiply(turn([0, 1, 0], .3)).multiply(turn([0, 0, 1], 1.1));
  const localDelta = targetFrame.clone().invert().multiply(sourceFrame).multiply(turn([1, 0, 0], .08)).multiply(sourceFrame.clone().invert()).multiply(targetFrame);
  const expected = turn([0, 0, 1], 1.1).multiply(localDelta).normalize();
  assert.ok(expected.angleTo(rotation([...values.values.slice(at * 4, at * 4 + 4)])) < 1e-6);
  for (const i of [0, values.count - 1]) assert.ok(turn([0, 0, 1], 1.1).angleTo(rotation([...values.values.slice(i * 4, i * 4 + 4)])) < 1e-6);
  const root = clip.channels.find(c => output.json.nodes[c.target.node].name === 'Root');
  assert.deepEqual([...((await output.accessor(clip.samplers[root.sampler].output)).values)], [0, 0, 0, Math.fround(.1), 0, Math.fround(.2), 0, 0, 0]);
});

test('protected joints, excessive/invalid limits, unrelated species and ambiguous action selection fail closed', async () => {
  const input = { source: fixture(true), target: fixture(false), type: 'dusk_fort_3' };
  for (const caps of [{ Body: .031 }, { Head: NaN }, { ArmLUpper: -.1 }, { LegLFoot: .1 }, { HandL: .1 }]) await assert.rejects(retargetMotion({ ...input, caps }));
  for (const gain of [0, -1, 1.1, NaN]) await assert.rejects(retargetMotion({ ...input, gain }));
  for (const actionGains of [null, [], { 125: 0 }, { 125: NaN }, { 219: 1.1 }, { 999: .1 }, { 'cast-meshy': .1 }]) await assert.rejects(retargetMotion({ ...input, actionGains }));
  for (const type of ['sunken_city_3', 'buffalo', 'takian', 'pusom']) await assert.rejects(retargetMotion({ ...input, type }));
  await assert.rejects(retargetMotion({ ...input, actions: [{ ...ACTIONS[0], clip: 'clip0' }] }));
  await assert.rejects(retargetMotion({ ...input, actions: [ACTIONS[0], ACTIONS[0]] }));
});

for (const [type, actionGains] of [['sealed_mine_3', { 125: .1, 219: .1 }], ['giant_valley_3', { 125: .1 }], ['demon_rift_3', { 125: .025, 219: .025 }]]) test(`${type}: explicit reduced gains change only requested upper-body tracks and retain accepted clips byte exactly`, async () => {
  const target = await fs.readFile(new URL(`../public/models/monsters/${type}.glb`, import.meta.url));
  const before = await retargetMotion({ source, target, type }), after = await retargetMotion({ source, target, type, actionGains });
  const first = await readMotionGLB(before.glb), second = await readMotionGLB(after.glb);
  assert.deepEqual(first.json.nodes, second.json.nodes); assert.equal(before.manifest.bodySHA256, after.manifest.bodySHA256);
  assert.deepEqual(after.manifest.actionGains, actionGains); assert.equal(second.json.animations.length, 4);
  for (const action of ACTIONS) {
    const oldClip = first.json.animations.find(c => c.name === action.name), newClip = second.json.animations.find(c => c.name === action.name), prior = channels(first)(oldClip);
    const changed = actionGains[action.id] !== undefined, receipt = after.manifest.clips.find(c => c.id === action.id); let changes = 0;
    assert.equal(receipt.gain, actionGains[action.id] ?? .5);
    for (const [key, c] of channels(second)(newClip)) {
      const oldChannel = prior.get(key), os = oldClip.samplers[oldChannel.sampler], ns = newClip.samplers[c.sampler];
      assert.deepEqual((await second.accessor(ns.input)).raw, (await first.accessor(os.input)).raw);
      const a = (await second.accessor(ns.output)).raw, b = (await first.accessor(os.output)).raw;
      const editable = c.target.path === 'rotation' && Object.hasOwn(JOINT_CAPS, second.json.nodes[c.target.node].name);
      if (!changed || !editable) assert.deepEqual(a, b, `${action.name} ${key} stays byte exact`);
      else if (!a.equals(b)) changes++;
    }
    if (changed) assert.ok(changes > 0);
    for (const bone of receipt.upperBody) assert.ok(bone.maximumDelta <= JOINT_CAPS[bone.bone] * receipt.gain + 1e-7);
  }
});
