// City NPC bodies carry retargeted ActionForge motion (tools/npc-models/retarget-gait.mjs): a
// mocap walk, a standing idle and a talking loop. Standing and talking are driven by those clips
// (NPCModels: mocapClips), so arms hang and move naturally instead of holding the measured stance.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import * as THREE from 'three';
import { gltfLoader } from '../src/core/gltf.js';

const dir = new URL('../src/npc/model-profiles/', import.meta.url);
const profiles = await Promise.all((await readdir(dir)).filter(f => f.endsWith('.json')).map(async f => JSON.parse(await readFile(new URL(f, dir), 'utf8'))));
// gate_supplier's Meshy skeleton does not follow its body (shoulders and shins point the wrong
// way), so any retargeted motion folds it: it keeps its native clips and measured stance.
const NATIVE = ['gate_supplier'];

test('every city NPC body but the native ones carries mocap walk, idle and talk clips', async () => {
  assert.equal(profiles.length, 17);
  for (const p of profiles) {
    if (NATIVE.includes(p.family)) { assert.equal(p.mocapClips, undefined, p.family); assert.equal(p.walkStride, undefined, p.family); continue; }
    assert.deepEqual(p.mocapClips, ['idle', 'talk'], p.family);
    assert.ok(p.walkStride > .8 && p.walkStride < 1.6, `${p.family} stride ${p.walkStride}`);
    const bytes = await readFile(new URL(`../public/models/npcs/${p.family}.glb`, import.meta.url));
    const gltf = await gltfLoader().register(() => ({ name: 'QA', loadTexture: () => Promise.resolve(new THREE.Texture()) }))
      .parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
    const clips = Object.fromEntries(gltf.animations.map(c => [c.name, c]));
    assert.ok(Math.abs(clips.idle.duration - 2.5) < .05, `${p.family} idle is the 2.5 s mocap loop`);
    assert.ok(Math.abs(clips.talk.duration - 2.93) < .05, `${p.family} talk`);
    assert.ok(Math.abs(clips.walk.duration - 1.33) < .05, `${p.family} walk`);
    for (const name of ['idle', 'talk', 'walk']) {
      const c = clips[name];
      assert.ok(c.tracks.length >= 20 && c.tracks.every(t => Array.from(t.values).every(Number.isFinite)), `${p.family} ${name}`);
      // loops: the last frame comes back to the first (no hitch at the seam)
      const hips = c.tracks.find(t => t.name.endsWith('Hips.position')), v = hips.values, n = v.length;
      assert.ok(Math.abs(v[1] - v[n - 2]) < .02, `${p.family} ${name} hips height loops`);
    }
  }
});
