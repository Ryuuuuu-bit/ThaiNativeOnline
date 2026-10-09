import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { CombatView } from '../src/combat/CombatView.js';

function fixture() {
  const state = { x: 2, z: 3, facing: 0, moving: false, attackTimer: 0, frenzy: 0 };
  const dog = new THREE.Group(), poses = [];
  dog.userData.animate = (...args) => poses.push(args);
  const view = { combat: { pet: state, world: { playerPos: () => ({ x: 0, z: 0 }) }, monsters: [] },
    bossTelegraphs: { update() {} }, views: new Map(), root: new THREE.Group(),
    pet: dog, groundHeight: () => 0, targetRing: new THREE.Group(), effects: [] };
  return { state, view, poses, step(dt, elapsed) { CombatView.prototype.update.call(view, dt, elapsed); return poses.at(-1); } };
}

test('pet strikes on cooldown reset at any world clock and recovers without changing combat state', () => {
  for (const elapsed of [.02, 107.3, 916.88]) for (const cooldown of [1.3, .22]) {
    const f = fixture();
    assert.equal(f.step(.016, elapsed)[3].bite, undefined, 'idle has no bite');
    f.state.attackTimer = cooldown;
    const before = structuredClone(f.state);
    assert.equal(f.step(.016, elapsed + .016)[3].bite, .55, 'normal and fast attacks start at contact');
    assert.deepEqual(f.state, before, 'presentation does not roll damage or alter cooldown');
    f.state.attackTimer = Math.max(0, cooldown - .1);
    const recovery = f.step(.1, elapsed + .116)[3].bite;
    assert.ok(recovery > .55 && recovery < 1);
    f.state.attackTimer = 0;
    assert.equal(f.step(.16, elapsed + .276)[3].bite, undefined, 'returns to locomotion');
    f.state.attackTimer = cooldown;
    assert.equal(f.step(.016, elapsed + .292)[3].bite, .55, 'next bite restarts independently');
  }
});

test('ordinary cooldown countdown does not repeatedly restart the attack', () => {
  const f = fixture();
  f.state.attackTimer = 1.3; f.step(.016, 0);
  const phases = [];
  for (let i = 1; i <= 10; i++) {
    f.state.attackTimer = 1.3 - i * .03;
    phases.push(f.step(.03, i * .03)[3].bite);
  }
  const active = phases.filter(value => value !== undefined);
  assert.ok(active.every((value, i) => i === 0 || value > active[i - 1]), 'continuous recovery');
  assert.equal(phases.at(-1), undefined);
});
