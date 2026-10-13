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
