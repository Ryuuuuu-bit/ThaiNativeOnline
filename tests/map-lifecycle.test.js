import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { transitionMap } from '../src/world/MapTransition.js';
import { disposeResources } from '../src/world/ResourceLifecycle.js';

function fixture() {
  const events = [], oldWorld = {}, map = { id: 'city' };
  const next = { map: { id: 'paddy' }, world: {} };
  const manager = {
    map, world: oldWorld, busy: false, armed: true,
    onLeave: () => events.push('leave'), fade: on => events.push(`fade:${on}`),
    prepare: async () => { events.push('prepare'); return next; },
    unload() { events.push('unload'); this.world = null; },
    install(prepared) { events.push('install'); Object.assign(this, prepared); },
    place: () => events.push('place'), onChange: () => events.push('enter'),
  };
  return { manager, events, oldWorld, next };
}

test('failed map build keeps old world and clears fade and busy without entering another room', async () => {
  const { manager, events, oldWorld } = fixture();
  manager.prepare = async () => { throw new Error('load failed'); };
  const originalError = console.error; console.error = () => {};
  try {
    assert.equal(await transitionMap(manager, { arrive: {} }, { id: 'paddy' }, async () => {}), false);
  } finally { console.error = originalError; }
  assert.equal(manager.world, oldWorld);
  assert.equal(manager.map.id, 'city');
  assert.equal(manager.busy, false);
  assert.equal(manager.armed, false); // must leave the portal before auto travel can retry
  assert.deepEqual(events, ['leave', 'fade:true', 'fade:false']);
  assert.equal(manager.lastTravelError.message, 'load failed');
});

test('successful transition prepares before releasing old world and enters room after placing player', async () => {
  const { manager, events, next } = fixture();
  assert.equal(await transitionMap(manager, { arrive: {} }, next.map, async () => {}), true);
  assert.equal(manager.world, next.world);
  assert.equal(manager.busy, false);
  assert.deepEqual(events, ['leave', 'fade:true', 'prepare', 'unload', 'install', 'place', 'enter', 'fade:false']);
});

test('busy or unknown destinations do not start a transition', async () => {
  const { manager, events } = fixture();
  assert.equal(await transitionMap(manager, {}, null, async () => {}), false);
  manager.busy = true;
  assert.equal(await transitionMap(manager, {}, { id: 'paddy' }, async () => {}), false);
  assert.deepEqual(events, []);
});

test('map resource disposal frees every instance buffer and deduplicates shared resources on repeat calls', () => {
  const root = new THREE.Group(), geometry = new THREE.BoxGeometry(), texture = new THREE.Texture();
  const material = new THREE.MeshBasicMaterial({ map: texture });
  const counts = { geometry: 0, material: 0, texture: 0, instances: 0 };
  geometry.addEventListener('dispose', () => counts.geometry++);
  material.addEventListener('dispose', () => counts.material++);
  texture.addEventListener('dispose', () => counts.texture++);
  for (let i = 0; i < 2; i++) {
    const mesh = new THREE.InstancedMesh(geometry, material, 4);
    mesh.addEventListener('dispose', () => counts.instances++);
    root.add(mesh);
  }
  const result = disposeResources(root);
  assert.deepEqual(result, { geometries: 1, materials: 1, textures: 1 });
  assert.equal(disposeResources(root), result);
  assert.deepEqual(counts, { geometry: 1, material: 1, texture: 1, instances: 2 });
});
