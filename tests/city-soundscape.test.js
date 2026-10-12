import { test } from 'node:test';
import assert from 'node:assert/strict';
import { citySoundscape } from '../src/audio/citySoundscape.js';

test('town soundscape fades by location and is silent on other maps', () => {
  const dock = citySoundscape('city', 0, 62), temple = citySoundscape('city', -52, -31);
  assert.ok(dock.river > .9); assert.equal(dock.market, 0);
  assert.equal(temple.temple, 1); assert.equal(temple.river, 0);
  assert.equal(citySoundscape('city', 0, 11).market, 1);
  assert.deepEqual(citySoundscape('paddy', 0, 62), { river: 0, market: 0, temple: 0 });
  assert.deepEqual(citySoundscape('city', NaN, 62), { river: 0, market: 0, temple: 0 });
  for (let z = 40; z < 64; z++) assert.ok(citySoundscape('city', 0, z + 1).river >= citySoundscape('city', 0, z).river);
});
