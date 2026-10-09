import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { gltfLoader } from '../src/core/gltf.js';

const TYPES = ['kongkoi', 'pray', 'winyan', 'takian', 'headless','pret','krahang','krasue','phitaihong','soldier','pusom','croc'];
const CLIPS = ['attack', 'die', 'hurt', 'idle', 'walk'];
const SAMPLE_HZ = 24;
// Metres in the exported glTF scene, after node transforms. A whole centimetre
// of extension AND >100% strain on a >=5mm edge is a large surface distortion,
// not ordinary joint blending or quantization noise. No bone names/weights
// participate in this acceptance rule.
const MIN_EDGE_METRES = .005;
const MAX_STRETCH_RATIO = 2;
const MIN_EXTENSION_METRES = .01;
const POSITION_EPSILON_METRES = .000001;

const rounded = value => Number(value.toFixed(5));
const xyz = (points, index) => Array.from(points.subarray(index * 3, index * 3 + 3), rounded);
const length = (points, a, b) => Math.hypot(
  points[a * 3] - points[b * 3],
  points[a * 3 + 1] - points[b * 3 + 1],
  points[a * 3 + 2] - points[b * 3 + 2],
);

function surfaceEdges(mesh, rest) {
  const index = mesh.geometry.index;
  assert.ok(index, 'Expected indexed compressed runtime geometry');
  const geometricIds = new Map(), ids = [];
  for (let i = 0; i < rest.length; i += 3) {
    const key = [rest[i], rest[i + 1], rest[i + 2]]
      .map(value => Math.round(value / POSITION_EPSILON_METRES)).join(',');
    if (!geometricIds.has(key)) geometricIds.set(key, geometricIds.size);
    ids.push(geometricIds.get(key));
  }
  const seen = new Set(), edges = [];
  for (let i = 0; i < index.count; i += 3) for (let corner = 0; corner < 3; corner++) {
    let a = index.getX(i + corner), b = index.getX(i + (corner + 1) % 3);
    if (a > b) [a, b] = [b, a];
    const key = `${a},${b}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const restLength = length(rest, a, b);
    if (restLength < MIN_EDGE_METRES) continue;
    // Count UV-seam copies as one geometric edge, but evaluate EVERY actual
    // vertex pair: copies can carry different skin weights. Do not average
    // them, keep only a representative, or invent edges between nearby shells.
    edges.push({ a, b, restLength, geometricKey: [ids[a], ids[b]].sort((a, b) => a - b).join(',') });
  }
  assert.ok(edges.length > 0, 'No physically meaningful surface edges were checked');
  return edges;
}

function sampleTimes(clip) {
  const times = new Set([0, clip.duration]);
  for (let frame = 0; frame <= Math.ceil(clip.duration * SAMPLE_HZ); frame++) {
    times.add(Math.min(frame / SAMPLE_HZ, clip.duration));
  }
  // Include exported keys as well as the 24Hz grid: packing may resample the
  // original animation, and the final frame must be checked with clamping.
  for (const track of clip.tracks) for (const time of track.times) {
    times.add(Math.max(0, Math.min(time, clip.duration)));
  }
  return [...times].sort((a, b) => a - b);
}

for (const type of TYPES) test(`Meshy ${type}: compressed skin preserves surface edges in every clip`, async t => {
  const bytes = await readFile(new URL(`../public/models/monsters/${type}.glb`, import.meta.url));
  const json = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)));
  assert.ok(json.extensionsRequired?.includes('EXT_meshopt_compression'), 'Test the compressed public GLB');
  // Use the game's meshopt decoder and skinning path. Only texture decoding is
  // stubbed because Node has no image decoder; texture pixels are irrelevant here.
  const loader = gltfLoader().register(() => ({
    name: 'QA_TEXTURES', loadTexture: () => Promise.resolve(new THREE.Texture()),
  }));
  const gltf = await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  assert.deepEqual(gltf.animations.map(clip => clip.name).sort(), CLIPS);
  const meshes = [];
  gltf.scene.traverse(object => { if (object.isMesh) meshes.push(object); });
  assert.equal(meshes.length, 1, 'Expected one runtime surface');
  const mesh = meshes[0];
  assert.ok(mesh.isSkinnedMesh, 'Expected a runtime skin');
  const position = mesh.geometry.getAttribute('position');
  const rest = new Float64Array(position.count * 3), posed = new Float64Array(rest.length);
  const point = new THREE.Vector3();
  gltf.scene.updateMatrixWorld(true);
  for (let i = 0; i < position.count; i++) {
    point.fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld);
    point.toArray(rest, i * 3);
  }
  // This decoded, unskinned bind geometry stays the reference for ALL clips;
  // an already damaged attack frame must never become its own baseline.
  const edges = surfaceEdges(mesh, rest), summaries = [];
  let worst = null, violationSamples = 0;
  function measure(clip, time, failures) {
    gltf.scene.updateMatrixWorld(true);
    mesh.skeleton.update();
    for (let i = 0; i < position.count; i++) {
      mesh.getVertexPosition(i, point);
      mesh.localToWorld(point);
      assert.ok(Number.isFinite(point.x) && Number.isFinite(point.y) && Number.isFinite(point.z), `Non-finite skinned vertex ${i}`);
      point.toArray(posed, i * 3);
    }
    let maxRatio = 0;
    for (const edge of edges) {
      const posedLength = length(posed, edge.a, edge.b);
      const ratio = posedLength / edge.restLength, extension = posedLength - edge.restLength;
      maxRatio = Math.max(maxRatio, ratio);
      if (ratio <= MAX_STRETCH_RATIO || extension <= MIN_EXTENSION_METRES) continue;
      failures.add(edge.geometricKey);
      violationSamples++;
      if (!worst || extension > worst.extension) worst = {
        clip, time, ...edge, posedLength, ratio, extension,
        posedEndpoints: [xyz(posed, edge.a), xyz(posed, edge.b)],
      };
    }
    return maxRatio;
  }
  const neutralFailures = new Set();
  summaries.push({ clip: 'neutral', samples: 1, maxRatio: rounded(measure('neutral', 0, neutralFailures)), failingEdges: neutralFailures.size });
  const mixer = new THREE.AnimationMixer(gltf.scene);
  for (const clip of gltf.animations) {
    mixer.stopAllAction();
    const action = mixer.clipAction(clip).reset().setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    action.play();
    const times = sampleTimes(clip), failures = new Set();
    let maxRatio = 0;
    for (const time of times) {
      mixer.setTime(time);
      maxRatio = Math.max(maxRatio, measure(clip.name, time, failures));
    }
    summaries.push({ clip: clip.name, samples: times.length, maxRatio: rounded(maxRatio), failingEdges: failures.size });
  }
  const influences = index => [0, 1, 2, 3].map(component => ({
    bone: mesh.skeleton.bones[mesh.geometry.attributes.skinIndex.getComponent(index, component)].name,
    weight: rounded(mesh.geometry.attributes.skinWeight.getComponent(index, component)),
  })).filter(influence => influence.weight > 0).sort((a, b) => b.weight - a.weight);
  t.diagnostic(JSON.stringify({
    type, sha256: createHash('sha256').update(bytes).digest('hex'),
    surfaceEdges: new Set(edges.map(edge => edge.geometricKey)).size,
    thresholds: { minEdgeMetres: MIN_EDGE_METRES, maxRatio: MAX_STRETCH_RATIO, minExtensionMetres: MIN_EXTENSION_METRES },
    frames: summaries,
    worst: worst && {
      clip: worst.clip, time: rounded(worst.time), ratio: rounded(worst.ratio),
      restMetres: rounded(worst.restLength), posedMetres: rounded(worst.posedLength),
      endpoints: [worst.a, worst.b].map((index, endpoint) => ({
        index, rest: xyz(rest, index), posed: worst.posedEndpoints[endpoint], influences: influences(index),
      })),
    },
  }));
  assert.equal(violationSamples, 0, worst
    ? `${type} ${worst.clip} at ${rounded(worst.time)}s: vertices ${worst.a}/${worst.b} stretch ${rounded(worst.ratio)}x (${rounded(worst.restLength)}m -> ${rounded(worst.posedLength)}m); see surface/influence diagnostic`
    : 'Surface edges must preserve their length within the generous distortion limit');
});
