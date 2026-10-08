import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createClassDetail, withClassDetail } from '../src/classes/fx/class-detail.js';

function fixture(low = false) {
  globalThis.document = { getElementById: () => ({ value: low ? 'low' : 'high' }),
    createElement: () => ({ getContext: () => new Proxy({}, { get: (t, k) => t[k] ?? (() => {}), set: (t, k, v) => { t[k] = v; return true; } }) }) };
  const root = new THREE.Group(), tasks = [], hits = [];
  const fx = { root, camera: new THREE.PerspectiveCamera(), glowTex: new THREE.Texture(),
    add: o => root.add(o), kill: o => root.remove(o), toLocal: p => p.clone(),
    addTask: fn => tasks.push(fn), after: (seconds, fn) => tasks.push((dt, t) => { if (t >= seconds) { fn(); return false; } }),
    impact: (...args) => { hits.push(args); return 42; }, emit() {}, slashArc: (p, aim, options) => options };
  const finish = () => { for (const task of tasks.splice(0)) task(2, 2); };
  return { fx, root, hits, finish, player: new THREE.Object3D() };
}
test('local and remote class details share a bounded budget and release it on completion', () => {
  for (const [low, cap] of [[false, 16], [true, 6]]) {
    const f = fixture(low), a = createClassDetail(f.fx, 'muaythai', f.player), b = createClassDetail(f.fx, 'warrior', f.player);
    for (let i = 0; i < 30; i++) (i % 2 ? a : b).cast(1);
    assert.equal(f.fx.detailState.live, cap); assert.equal(f.root.children.length, cap);
    f.finish(); assert.equal(f.fx.detailState.live, 0); assert.equal(f.root.children.length, 0);
    a.cast(1); assert.equal(f.fx.detailState.live, 1); f.finish();
  }
});
test('class palette is scoped and impacts preserve the original result and parameters', () => {
  const f = fixture(), a = createClassDetail(f.fx, 'muaythai', f.player), b = createClassDetail(f.fx, 'warrior', f.player), p = new THREE.Vector3();
  assert.equal(a.fx.slashArc(p,p,{pal:'blue'}).pal,'copper');
  assert.equal(b.fx.slashArc(p,p,{pal:'blue'}).pal,'blue');
  assert.equal(b.fx.slashArc(p,p,{pal:'red'}).pal,'gold');
  assert.equal(a.fx.impact(p,1,'test'),42); assert.deepEqual(f.hits,[[p,1,'test']]); f.finish();
});
test('every playable class releases its ornaments and ground seal', () => {
  for (const id of ['muaythai','warrior','hunter','shaman','herbalist']) {
    const f=fixture(), detail=createClassDetail(f.fx,id,f.player); detail.cast(1);
    assert.ok(f.root.children.length>0); f.finish();
    assert.equal(f.root.children.length,0); assert.equal(f.fx.detailState.live,0);
  }
});
test('rejected casts do not allocate visual details; accepted casts preserve receiver and timing', () => {
  const f = fixture(), wrapped = withClassDetail('muaythai', () => ({ accepted: false, cast() { return this.accepted ? .8 : false; } }));
  const runner = wrapped({ fx: f.fx, player: f.player });
  assert.equal(runner.cast('jab'),false); assert.equal(f.root.children.length,0);
  runner.accepted=true; assert.equal(runner.cast('jab'),.8); assert.equal(f.root.children.length,1); f.finish();
});
