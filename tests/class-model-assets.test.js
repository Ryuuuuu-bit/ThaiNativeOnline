import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { gltfLoader } from '../src/core/gltf.js';
import { SHAMAN_SKILLS } from '../src/classes/shaman-moves.js';
import { HERBALIST_SKILLS } from '../src/classes/herbalist-moves.js';

for (const [id, skills] of [['shaman', SHAMAN_SKILLS], ['herbalist', HERBALIST_SKILLS]]) test(`${id}: supplied model retains every gameplay clip and valid animated skin`, async () => {
  const bytes = await readFile(new URL(`../public/models/${id}.glb`, import.meta.url));
  assert.ok(bytes.length < 1600000, 'mobile download budget');
  // Node has no browser image decoder; browser QA renders the real textures.
  const loader = gltfLoader().register(() => ({ name: 'QA_TEXTURES', loadTexture: () => Promise.resolve(new THREE.Texture()) }));
  const gltf = await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  const clips = new Map(gltf.animations.map(c => [c.name, c]));
  for (const name of ['idle', 'walk', 'run', 'hurt', 'die', ...skills.map(s => s.clip)]) assert.ok(clips.has(name), name);
  for (const skill of skills) assert.ok(Math.abs(clips.get(skill.clip).duration - skill.authored) < .035, `${skill.id} effect timing`);
  const meshes = []; gltf.scene.traverse(o => { if (o.isMesh) meshes.push(o); assert.ok(!/^staff$/i.test(o.name)); });
  assert.equal(meshes.length, 1); assert.ok(meshes[0].isSkinnedMesh);
  assert.ok(meshes[0].skeleton.bones.length >= 60);
  assert.ok((meshes[0].geometry.index.count / 3) < 30000);
  const mixer = new THREE.AnimationMixer(gltf.scene), v = new THREE.Vector3();
  for (const clip of clips.values()) {
    for (const track of clip.tracks) assert.ok(Array.from(track.values).every(Number.isFinite), clip.name);
    mixer.stopAllAction(); mixer.clipAction(clip).setLoop(THREE.LoopOnce, 1).reset().play();
    for (const t of [0, .25, .5, .75, .99]) {
      mixer.setTime(t * clip.duration); gltf.scene.updateMatrixWorld(true);
      for (const mesh of meshes) {
        mesh.skeleton.update();
        for (let i = 0; i < mesh.geometry.attributes.position.count; i += 47) {
          mesh.getVertexPosition(i, v); mesh.localToWorld(v);
          // Locomotion sources travel; the game pins horizontal hips motion at load.
          const hips = mesh.skeleton.bones.find(b => /Hips$/i.test(b.name));
          const center = hips.getWorldPosition(new THREE.Vector3());
          assert.ok(v.toArray().every(Number.isFinite) && v.distanceTo(center) < 2, `${clip.name}: invalid bind or pose`);
        }
      }
    }
  }
  for (const track of clips.get('idle').tracks) {
    const width = track.getValueSize();
    for (let i = 0; i < width; i++) assert.ok(Math.abs(track.values[i] - track.values[track.values.length - width + i]) < .0001, 'idle loop seam');
    if (id === 'shaman' && /Hips|Foot|Leg|Toe/.test(track.name)) {
      for (let i = width; i < track.values.length; i++) assert.ok(Math.abs(track.values[i] - track.values[i % width]) < .0001, 'planted idle lower body');
    }
  }
});
