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
  gltf.scene.updateMatrixWorld(true);
  const bone = name => meshes[0].skeleton.bones.find(b => b.name.endsWith(name));
  const position = name => bone(name).getWorldPosition(new THREE.Vector3());
  const fingerHinges = [];
  if (id === 'shaman') for (const side of ['Left', 'Right']) {
    const along = position(side + 'HandMiddle1').sub(position(side + 'Hand')).normalize();
    const across = position(side + 'HandPinky1').sub(position(side + 'HandIndex1')).normalize();
    const palm = along.cross(across).normalize(); if (palm.y > 0) palm.negate();
    for (const digit of ['Index', 'Middle', 'Ring', 'Pinky']) for (let j = 1; j <= 3; j++) {
      const name = side + 'Hand' + digit + j, node = bone(name);
      const direction = j < 3 ? position(side + 'Hand' + digit + (j + 1)).sub(position(name)) : position(name).sub(position(side + 'Hand' + digit + '2'));
      const axis = direction.normalize().cross(palm).normalize().applyQuaternion(node.getWorldQuaternion(new THREE.Quaternion()).invert());
      fingerHinges.push({ node, axis, rest: node.quaternion.clone(), limit: [1.15, 1.4, .85][j - 1] });
    }
  }
  const mixer = new THREE.AnimationMixer(gltf.scene), v = new THREE.Vector3();
  for (const clip of clips.values()) {
    for (const track of clip.tracks) assert.ok(Array.from(track.values).every(Number.isFinite), clip.name);
    mixer.stopAllAction(); mixer.clipAction(clip).setLoop(THREE.LoopOnce, 1).reset().play();
    const steps = Math.ceil(clip.duration * 30);
    const samples = id === 'shaman' ? Array.from({ length: steps + 1 }, (_, i) => Math.min(.999999, i / steps)) : [0, .25, .5, .75, .99];
    for (const t of samples) {
      mixer.setTime(t * clip.duration); gltf.scene.updateMatrixWorld(true);
      for (const { node, axis, rest, limit } of fingerHinges) {
        const delta = rest.clone().invert().multiply(node.quaternion);
        if (delta.w < 0) delta.set(-delta.x, -delta.y, -delta.z, -delta.w);
        const vector = new THREE.Vector3(delta.x, delta.y, delta.z);
        const angle = 2 * Math.atan2(vector.dot(axis), delta.w);
        assert.ok(angle >= -.01 && angle <= limit + .01, `${clip.name}: ${node.name} flexes into palm within joint limit`);
        assert.ok(vector.clone().cross(axis).length() < .01, `${clip.name}: finger hinge has no sideways twist`);
      }
      if (id === 'shaman') for (const side of ['Left', 'Right']) {
        const dir = (a, b) => position(side + b).sub(position(side + a)).normalize();
        assert.ok(dir('Arm', 'ForeArm').angleTo(dir('ForeArm', 'Hand')) < THREE.MathUtils.degToRad(150), `${clip.name}: elbow range`);
        assert.ok(dir('UpLeg', 'Leg').angleTo(dir('Leg', 'Foot')) < THREE.MathUtils.degToRad(150), `${clip.name}: knee range`);
        assert.ok(dir('ForeArm', 'Hand').angleTo(dir('Hand', 'HandMiddle1')) < THREE.MathUtils.degToRad(60), `${clip.name}: wrist alignment`);
      }
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
  if (id === 'shaman') {
    mixer.stopAllAction(); mixer.clipAction(clips.get('idle')).reset().play();
    mixer.setTime(0); gltf.scene.updateMatrixWorld(true);
    const pos = name => meshes[0].skeleton.bones.find(b => b.name.endsWith(name)).getWorldPosition(new THREE.Vector3());
    assert.ok(pos('RightHand').y - pos('LeftHand').y > .15, 'raised casting hand has a distinct silhouette');
    assert.ok(Math.abs(pos('LeftFoot').z - pos('RightFoot').z) > .06, 'staggered feet');
    // Returning from any spell must restore the same ready pose, including fingers.
    const neutral = new Map(clips.get('idle').tracks.map(t => [t.name, t]));
    for (const skill of skills) for (const track of clips.get(skill.clip).tracks) {
      const idle = neutral.get(track.name); if (!idle) continue;
      const width = track.getValueSize();
      for (const offset of [0, track.values.length - width]) for (let i = 0; i < width; i++) {
        assert.ok(Math.abs(track.values[offset + i] - idle.values[i]) < .001, `${skill.clip}: continuous ready pose`);
      }
    }
  }
});
