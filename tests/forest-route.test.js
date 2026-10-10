import { test } from 'node:test';
import assert from 'node:assert/strict';
import { forestTrailDryGround, FOREST_NORTH_TRAIL } from '../src/world/forest-route.js';
import { terrainHeight, WATER_Y, STREAM, polylineDistance, waterAt } from '../src/world/CityMap.js';

test('north forest trail stays dry through its low-ground depression', () => {
  let belowOldWaterCutoff = 0;
  for (let i = 0; i <= 100; i++) {
    const x = -4 + 15 * i / 100, z = -414 - 20 * i / 100;
    assert.equal(forestTrailDryGround(x, z), true, `${x},${z}`);
    assert.equal(waterAt(x, z), 0);
    assert.ok(polylineDistance(x, z, STREAM.pts) > STREAM.half + .6);
    if (terrainHeight(x, z) < WATER_Y - .22) belowOldWaterCutoff++;
  }
  assert.ok(belowOldWaterCutoff > 80, 'regression fixture exercises the former dry-land blockage');
  for (let i = 0; i <= 100; i++) {
    assert.equal(forestTrailDryGround(11 - 2.5 * i / 100, -434 - 5 * i / 100), true);
  }
});

test('dry-ground exception is bounded to the authored three-metre trail', () => {
  assert.deepEqual(FOREST_NORTH_TRAIL, [[-4,-414],[11,-434],[8.5,-439]]);
  // Midpoint, offset normal to the diagonal by 1.4 / 1.6 m.
  assert.equal(forestTrailDryGround(3.5 + 1.4*.8, -424 + 1.4*.6), true);
  assert.equal(forestTrailDryGround(3.5 + 1.6*.8, -424 + 1.6*.6), false);
  for (const [x,z] of [[-4,-405],[0,190],[48,-423],[-52,-428],[8.5,-450],[NaN,-424],[0,Infinity]]) {
    assert.equal(forestTrailDryGround(x,z), false, `${x},${z}`);
  }
});

test('rendered stream fringes remain outside the dry-trail exception', () => {
  const x = -20, z = -408;
  assert.equal(waterAt(x,z), 0, 'deep-water mask is inset from the visible ribbon');
  assert.ok(polylineDistance(x,z,STREAM.pts) < STREAM.half + .6);
  assert.ok(terrainHeight(x,z) < WATER_Y - .22, 'existing wading-depth guard must remain effective here');
  assert.equal(forestTrailDryGround(x,z), false);
});
