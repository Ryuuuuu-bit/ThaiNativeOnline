// Every class has a male and a female body (public/models/classes/<class>-<gender>.glb): each
// carries all the clips of the class's original model, its weapons, a whole skinned body and
// stays inside the mobile download budget; avatarFor picks the body by the character's gender.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { gltfLoader } from '../src/core/gltf.js';
import { AVATARS, avatarFor } from '../src/data/training.js';

const loader = gltfLoader().register(() => ({ name: 'QA_TEXTURES', loadTexture: () => Promise.resolve(new THREE.Texture()) }));
const parse = async path => {
  const bytes = await readFile(new URL(`../public/${path}`, import.meta.url));
  return { size: bytes.length, gltf: await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '') };
};
const ORIGINAL = { muaythai: 'muay-thai-fighter', herbalist: 'herbalist', hunter: 'hunter', warrior: 'warrior', shaman: 'shaman' };
const PROPS = { warrior: ['sword_L', 'sword_R'], hunter: ['hunter_bow'] };

test('avatarFor picks the body by gender, male by default, one object per class and gender', () => {
  for (const id of Object.keys(ORIGINAL)) {
    assert.equal(avatarFor(id).url, AVATARS[id].models.male);
    assert.equal(avatarFor(id, 'male'), AVATARS[id]);
    assert.equal(avatarFor(id, 'female').url, AVATARS[id].models.female);
    assert.equal(avatarFor(id, 'female'), avatarFor(id, 'female'));
    assert.equal(avatarFor(id, 'female').skills, AVATARS[id].skills);
    assert.equal(avatarFor(id, 'other'), AVATARS[id]);
  }
  assert.equal(avatarFor('nobody', 'female').skills, avatarFor('muaythai', 'female').skills, 'unknown classes fall back');
});

for (const [id, file] of Object.entries(ORIGINAL)) test(`${id}: male and female bodies keep every clip and weapon of the original`, async () => {
  const { gltf: original } = await parse(`models/${file}.glb`);
  const wanted = original.animations.map(c => c.name).sort();
  for (const gender of ['male', 'female']) {
    const { size, gltf } = await parse(AVATARS[id].models[gender]), tag = `${id} ${gender}`;
    assert.ok(size < 1700000, `${tag} download ${size}`);
    assert.deepEqual(gltf.animations.map(c => c.name).sort(), wanted, tag);
    for (const clip of gltf.animations) {
      const before = original.animations.find(c => c.name === clip.name);
      assert.ok(Math.abs(clip.duration - before.duration) < .05, `${tag} ${clip.name} timing`);
      for (const track of clip.tracks) assert.ok(Array.from(track.values).every(Number.isFinite), `${tag} ${track.name}`);
    }
    const skinned = []; gltf.scene.traverse(o => { if (o.isSkinnedMesh) skinned.push(o); });
    assert.equal(skinned.length, 1, tag);
    const bones = skinned[0].skeleton.bones.map(b => b.name);
    for (const b of ['Hips', 'Head', 'LeftHand', 'RightHand', 'LeftHandIndex1', 'RightFoot']) assert.ok(bones.some(n => n.endsWith(b)), `${tag} ${b}`);
    for (const prop of PROPS[id] ?? []) assert.ok(gltf.scene.getObjectByName(prop), `${tag} ${prop}`);
    // standing height: about 1.8 m tall after the game's height fit, feet on the ground
    const box = new THREE.Box3().setFromObject(skinned[0]);
    assert.ok(box.max.y - box.min.y > .5, `${tag} has a body`);
  }
});

// Anatomy guards (tools/class-models/retarget.mjs): idle soles on the ground, and no sword or
// bow passing through the head (with its hair) in any clip.
for (const [id] of Object.entries(ORIGINAL)) test(`${id}: feet stand on the ground and weapons clear the head`, async () => {
  for (const gender of ['male', 'female']) {
    const { gltf } = await parse(AVATARS[id].models[gender]), root = gltf.scene, tag = `${id} ${gender}`;
    root.updateMatrixWorld(true);
    const bone = n => { let b; root.traverse(o => { if (!b && o.name.replace(/^mixamorig:?/, '') === n) b = o; }); return b; };
    const feet = ['LeftFoot', 'RightFoot', 'LeftToeBase', 'RightToeBase'].map(bone), head = bone('Head'), top = bone('HeadTop_End');
    const low = () => Math.min(...feet.map(f => f.getWorldPosition(new THREE.Vector3()).y));
    const box = new THREE.Box3().setFromObject(root), scale = 1.8 / (box.max.y - box.min.y), rest = low();
    const mixer = new THREE.AnimationMixer(root);
    const idle = gltf.animations.find(c => c.name === 'idle');
    mixer.clipAction(idle).play(); mixer.setTime(.3); root.updateMatrixWorld(true);
    assert.ok(Math.abs(low() - rest) * scale < .015, `${tag} idle feet ${((low() - rest) * scale * 100).toFixed(1)} cm off the ground`);
    const meshes = []; for (const prop of PROPS[id] ?? []) root.getObjectByName(prop).traverse(o => { if (o.isMesh) meshes.push(o); });
    if (!meshes.length) continue;
    const pts = meshes.flatMap(m => { const p = m.geometry.getAttribute('position'), out = []; for (let i = 0; i < p.count; i += Math.max(1, Math.floor(p.count / 150))) out.push([m, new THREE.Vector3().fromBufferAttribute(p, i)]); return out; });
    for (const clip of gltf.animations) {
      mixer.stopAllAction(); mixer.clipAction(clip).reset().play();
      for (let i = 0; i <= 20; i++) {
        mixer.setTime(clip.duration * i / 20); root.updateMatrixWorld(true);
        const h = head.getWorldPosition(new THREE.Vector3()), t = top.getWorldPosition(new THREE.Vector3()), c = h.clone().lerp(t, .5), r = h.distanceTo(t) * .8;
        for (const [m, v] of pts) assert.ok(v.clone().applyMatrix4(m.matrixWorld).distanceTo(c) > r, `${tag} ${clip.name} @${(clip.duration * i / 20).toFixed(2)}: ${m.name} through the head`);
      }
    }
  }
});
