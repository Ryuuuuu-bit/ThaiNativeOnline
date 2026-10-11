import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { cachedLoader } from '../src/core/retry.js';
import { createNPCModelCache } from '../src/npc/NPCModels.js';
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };

test('invalidating a hung request starts a fresh request; stale rejection expiry cannot evict its success', async () => {
  const old = deferred(), fresh = deferred(); let calls = 0;
  const load = cachedLoader(() => ++calls === 1 ? old.promise : fresh.promise, { tries: 1, retryAfter: 5 });
  const first = load('body.glb');
  const rejected = assert.rejects(first, /old request failed/);
  assert.equal(load('body.glb'), first);
  assert.equal(load.invalidate('body.glb'), true);
  const second = load('body.glb');
  assert.equal(calls, 2);
  assert.notEqual(first, second);
  fresh.resolve('new body');
  assert.equal(await second, 'new body');
  old.reject(new Error('old request failed')); await rejected;
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(load('body.glb'), second);
  assert.equal(load.invalidate('body.glb'), false);
  assert.equal(calls, 2);
});

test('explicit retry bypasses a failed promise retained for automatic retry delay', async () => {
  let calls = 0;
  const load = cachedLoader(() => ++calls === 1 ? Promise.reject(new Error('HTTP 503')) : Promise.resolve('body'), { tries: 1, retryAfter: 5 });
  await assert.rejects(load('body.glb'), /503/);
  assert.equal(load.invalidate('body.glb'), true);
  assert.equal(await load('body.glb'), 'body');
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(await load('body.glb'), 'body');
  assert.equal(calls, 2);
});

test('late successful payload from an invalidated attempt is released without replacing fresh cache', async () => {
  const old = deferred(); let calls = 0, released;
  const load = cachedLoader(() => ++calls === 1 ? old.promise : Promise.resolve('fresh'), { tries: 1, retryAfter: 1, onInvalidated: value => { released = value; } });
  const first = load('body'), rejected = assert.rejects(first, /invalidated/);
  load.invalidate('body'); const second = load('body');
  assert.equal(await second, 'fresh');
  old.resolve('late'); await rejected;
  assert.equal(released, 'late');
  assert.equal(load('body'), second);
});

test('NPC retry starts another source request and releases a late invalidated source', async () => {
  const old = deferred(), fresh = deferred(); let calls = 0, disposed = 0;
  const cache = createNPCModelCache(() => ++calls === 1 ? old.promise : fresh.promise);
  const spec = { url: 'npc.glb', revision: 'approved' }, first = cache.load(spec);
  const rejected = assert.rejects(first, /invalidated/);
  await Promise.resolve();
  assert.equal(cache.invalidate(spec), true);
  const second = cache.load(spec); await Promise.resolve();
  assert.equal(calls, 2);
  const scene = new THREE.Group(), geometry = new THREE.BoxGeometry();
  geometry.addEventListener('dispose', () => disposed++);
  scene.add(new THREE.Mesh(geometry, new THREE.MeshBasicMaterial()));
  const success = { scene: new THREE.Group(), animations: [] };
  fresh.resolve(success); assert.equal(await second, success);
  old.resolve({ scene, animations: [] }); await rejected;
  assert.equal(disposed, 1);
  assert.equal(cache.load(spec), second);
  assert.equal(cache.invalidate(spec), false);
  cache.dispose();
});
