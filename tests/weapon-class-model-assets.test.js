import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { gltfLoader } from '../src/core/gltf.js';
import { WARRIOR_SKILLS } from '../src/classes/warrior-moves.js';
import { HUNTER_SKILLS } from '../src/classes/hunter-moves.js';

for (const [id, skills, budget, weapons, count] of [
  ['warrior', WARRIOR_SKILLS, 2100000, { sword_L: 'LeftHand', sword_R: 'RightHand' }, 15],
  ['hunter', HUNTER_SKILLS, 1700000, { hunter_bow: 'LeftHand' }, 14],
]) test(`${id}: replacement body supports gameplay animations and attached weapons`, async () => {
  const bytes = await readFile(new URL(`../public/models/${id}.glb`, import.meta.url));
  assert.ok(bytes.length < budget, 'mobile download budget');
  // Browser QA decodes the real images; Node validates geometry and animation.
  const loader = gltfLoader().register(() => ({ name: 'QA_TEXTURES', loadTexture: () => Promise.resolve(new THREE.Texture()) }));
  const gltf = await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  const clips = new Map(gltf.animations.map(c => [c.name, c]));
  assert.equal(clips.size, count);
  for (const name of ['idle', 'walk', 'run', 'hurt', 'die', ...skills.map(s => s.clip)]) assert.ok(clips.has(name), name);
  for (const skill of skills) assert.ok(Math.max(...skill.hits) * skill.speed <= clips.get(skill.clip).duration + .035, `${skill.id}: impact lies inside clip`);
  const meshes = [];
  gltf.scene.traverse(o => { if (o.isMesh) meshes.push(o); });
  assert.equal(meshes.length, 1 + Object.keys(weapons).length);
  const bodies = meshes.filter(m => m.isSkinnedMesh);
  assert.equal(bodies.length, 1);
  assert.ok(bodies[0].skeleton.bones.length >= 60);
  assert.ok(meshes.reduce((n, m) => n + m.geometry.index.count / 3, 0) < 40000);
  const hips = bodies[0].skeleton.bones.find(b => /Hips$/.test(b.name));
  const bone = name => bodies[0].skeleton.bones.find(b => b.name.endsWith(name));
  gltf.scene.updateMatrixWorld(true);
  const headBindInverse = bone('Head').getWorldQuaternion(new THREE.Quaternion()).invert();
  for (const [name, hand] of Object.entries(weapons)) {
    const node = gltf.scene.getObjectByName(name);
    assert.ok(node, name);
    let ancestor = node.parent;
    while (ancestor && !ancestor.name.endsWith(hand)) ancestor = ancestor.parent;
    assert.ok(ancestor, `${name}: follows ${hand}`);
  }
  const mixer = new THREE.AnimationMixer(gltf.scene), v = new THREE.Vector3(), center = new THREE.Vector3();
  for (const clip of clips.values()) {
    for (const track of clip.tracks) assert.ok(Array.from(track.values).every(Number.isFinite), clip.name);
    mixer.stopAllAction(); mixer.clipAction(clip).setLoop(THREE.LoopOnce, 1).reset().play();
    for (const fraction of [0, .25, .5, .75, .99]) {
      mixer.setTime(fraction * clip.duration); gltf.scene.updateMatrixWorld(true);
      hips.getWorldPosition(center);
      for (const mesh of meshes) {
        mesh.skeleton?.update();
        for (let i = 0; i < mesh.geometry.attributes.position.count; i += 47) {
          mesh.getVertexPosition(i, v); mesh.localToWorld(v);
          assert.ok(v.toArray().every(Number.isFinite) && v.distanceTo(center) < 2, `${clip.name}: body/weapon bounds`);
        }
      }
    }
    if (id === 'warrior' && !['hurt', 'die'].includes(clip.name)) {
      // Finite vertices alone missed the previous visibly bent wrists/head.
      // Inspect every authored frame, including spin and leap transitions.
      for (let t = 0; t < clip.duration; t += 1 / 30) {
        mixer.setTime(t); gltf.scene.updateMatrixWorld(true);
        const headDelta = bone('Head').getWorldQuaternion(new THREE.Quaternion()).multiply(headBindInverse);
        const e = new THREE.Euler().setFromQuaternion(headDelta, 'YXZ');
        assert.ok(Math.abs(e.z) < .05 && Math.abs(e.x) < .185, `${clip.name}: head tilt`);
        for (const side of ['Left', 'Right']) {
          const p = name => bone(side + name).getWorldPosition(new THREE.Vector3());
          const fore = p('Hand').sub(p('ForeArm')), knuckles = p('HandMiddle1').sub(p('Hand'));
          assert.ok(fore.angleTo(knuckles) < .53, `${clip.name}: wrist bends beyond sword grip limit`);
        }
      }
    }
  }
  for (const track of clips.get('idle').tracks) {
    const width = track.getValueSize();
    for (let i = 0; i < width; i++) assert.ok(Math.abs(track.values[i] - track.values[track.values.length - width + i]) < .0001, 'idle seam');
  }
});
