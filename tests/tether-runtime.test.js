import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTether, advanceTether } from '../src/training/tether.js';

const effect = { amount: 60, every: .5, duration: 6, near: 3.6, nearMul: 1.5, breakAt: 9.2 };

test('a tether starts with no heal, ticks every half second, and never pays past its lifetime', () => {
  const link = createTether(effect);
  assert.deepEqual(advanceTether(link, .49, 5), { hp: 0, done: false });
  assert.deepEqual(advanceTether(link, .01, 5), { hp: 60, done: false });
  assert.deepEqual(advanceTether(link, 5.5, 5), { hp: 660, done: true });
  assert.deepEqual(advanceTether(link, 10, 5), { hp: 0, done: true });
  assert.equal(effect.elapsed, undefined, 'shared skill definitions stay immutable');
});

test('nearby healing changes with position and an out-of-range link breaks before its next tick', () => {
  const link = createTether(effect);
  assert.equal(advanceTether(link, .5, 3.6).hp, 90);
  assert.equal(advanceTether(link, .5, 5).hp, 60);
  assert.deepEqual(advanceTether(link, .5, 9.3), { hp: 0, done: true });
});

test('frame batching and exact expiry produce the same number of heals', () => {
  const batched = advanceTether(createTether(effect), 100, 0).hp;
  const link = createTether(effect);
  let small = 0;
  for (let i = 0; i < 60; i++) small += advanceTether(link, .1, 0).hp;
  assert.equal(small, batched);
  assert.equal(small, 1080);
  assert.equal(createTether({ ...effect, every: 0 }), null);
});
