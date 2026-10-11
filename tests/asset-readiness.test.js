import test from 'node:test';
import assert from 'node:assert/strict';
import { boundedReady, loadingTask } from '../src/core/AssetReadiness.js';
import { transitionMap } from '../src/world/MapTransition.js';
import { commitPreparedMap } from '../src/world/MapCommit.js';

test('a delayed readiness promise cannot report completion early', async () => {
  let resolve;
  const delayed = new Promise(done => { resolve = done; });
  const events = [];
  const screen = { start: id => events.push(`start:${id}`), complete: id => events.push(`done:${id}`) };
  const loading = loadingTask(screen, 'avatar', () => delayed);
  await Promise.resolve();
  assert.deepEqual(events, ['start:avatar']);
  resolve('model');
  assert.equal(await loading, 'model');
  assert.deepEqual(events, ['start:avatar', 'done:avatar']);
});

test('failed assets reject readiness and never count as completed', async () => {
  let completed = false;
  await assert.rejects(loadingTask({ start() {}, complete() { completed = true; } }, 'avatar',
    () => Promise.reject(new Error('missing GLB'))), /missing GLB/);
  assert.equal(completed, false);
});

test('timeout cleans a late result and does not retry or hide any overlay', async () => {
  let resolve, cleaned = null;
  const work = new Promise(done => { resolve = done; });
  await assert.rejects(boundedReady(work, 'map', { timeout: 5, onLate: value => { cleaned = value; } }), /หมดเวลารอ/);
  resolve('stale world');
  await Promise.resolve();
  assert.equal(cleaned, 'stale world');
});

test('local readiness has no dependency on an unresolved optional network promise', async () => {
  const network = new Promise(() => {});
  const result = await boundedReady(Promise.resolve('local render'), 'render', { timeout: 100 });
  assert.equal(result, 'local render');
  assert.ok(network instanceof Promise);
});

test('failed travel keeps error overlay pending and explicit retry prepares again', async () => {
  let attempts = 0, retry, pending = false;
  const old = { id: 'city' }, next = { map: { id: 'paddy' }, world: {} };
  const manager = {
    map: old, world: old, busy: false,
    onLeave() {}, onChange() {},
    fade(on) { if (on) pending = true; else if (!this.lastTravelError) pending = false; },
    loadingScreen: { start() {}, complete() {}, fail(_, options) { retry = options.retry; } },
    prepare() { attempts++; return attempts === 1 ? Promise.reject(new Error('failed')) : Promise.resolve(next); },
    unload() {}, install(value) { Object.assign(this, value); }, place() {},
    travel(portal) { return transitionMap(this, portal, next.map, async () => {}); },
  };
  const log = console.error; console.error = () => {};
  try { assert.equal(await manager.travel({ arrive: {} }), false); } finally { console.error = log; }
  assert.equal(manager.map, old);
  assert.equal(manager.busy, false);
  assert.equal(pending, true);
  assert.equal(await retry(), true);
  assert.equal(manager.map, next.map);
  assert.equal(attempts, 2);
  assert.equal(pending, false);
});

function commitFixture() {
  const events = [];
  const world = name => ({ root: { visible: true, removeFromParent() { events.push(`detach:${name}`); } }, dispose() { events.push(`dispose:${name}`); } });
  const manager = { map: { id: 'city' }, world: world('city'), npcs: { dispose() { events.push('dispose:old NPC'); } }, respawn: { x: 4, z: 5 },
    player: { position: { x: 1, z: 2 }, group: { rotation: { y: 3 } } },
    install(value) { Object.assign(this, value); }, place(value) { this.player.position.x = value.x; this.player.position.z = value.z; },
    onChange({ map }) { events.push(`change:${map.id}`); }, renderReady() { events.push('render'); },
    releaseMonsters() { events.push('release:monsters'); }, onCommitted() { events.push('network:commit'); } };
  const prepared = { map: { id: 'paddy' }, world: world('paddy'), npcs: {}, respawn: { x: 9, z: 9 } };
  return { manager, prepared, events };
}

test('render failure restores old map, location and respawn without releasing old resources or changing network room', async () => {
  const { manager, prepared, events } = commitFixture(), old = manager.world;
  manager.renderReady = () => Promise.reject(new Error('shader failed'));
  await assert.rejects(commitPreparedMap(manager, prepared, { x: 9, z: 9 }, manager.map), /shader failed/);
  assert.equal(manager.world, old);
  assert.equal(old.root.visible, true);
  assert.deepEqual(manager.respawn, { x: 4, z: 5 });
  assert.deepEqual(manager.player.position, { x: 1, z: 2 });
  assert.deepEqual(events, ['change:paddy', 'detach:paddy', 'change:city']);
});

test('successful map commit renders before releasing old resources and changing network room', async () => {
  const { manager, prepared, events } = commitFixture();
  await commitPreparedMap(manager, prepared, { x: 9, z: 9 }, manager.map);
  assert.equal(manager.world, prepared.world);
  assert.deepEqual(events, ['change:paddy', 'render', 'release:monsters', 'dispose:old NPC', 'dispose:city', 'network:commit']);
});
