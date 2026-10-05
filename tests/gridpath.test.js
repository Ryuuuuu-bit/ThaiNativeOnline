// Click-to-walk route planning (src/core/GridPath.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findPath, clearLine } from '../src/core/GridPath.js';

// A wall along z = 0 from x = -6 to 6, like the ruined wall that used to trap clicks.
const wall = (x, z) => !(Math.abs(z) < .6 && Math.abs(x) < 6);

test('an open line needs no search', () => {
  assert.deepEqual(findPath(() => true, { x: 0, z: 0 }, { x: 5, z: 5 }), [{ x: 5, z: 5 }]);
});

test('a route walks around a wall and every leg is clear', () => {
  const from = { x: 0, z: 4 }, to = { x: 0, z: -4 }, route = findPath(wall, from, to);
  assert.ok(route, 'route exists');
  assert.deepEqual(route.at(-1), to);
  let at = from;
  for (const p of route) { assert.ok(clearLine(wall, at.x, at.z, p.x, p.z), `blocked leg to ${p.x},${p.z}`); at = p; }
  assert.ok(route.length <= 4, `route should be shortened, got ${route.length} points`);
});

test('an enclosed goal has no route', () => {
  const ring = (x, z) => { const d = Math.hypot(x, z); return d < 3 || d > 4; };
  assert.equal(findPath(ring, { x: 10, z: 0 }, { x: 0, z: 0 }), null);
});

test('a blocked goal has no route', () => {
  assert.equal(findPath(wall, { x: 0, z: 4 }, { x: 0, z: 0 }), null);
});
