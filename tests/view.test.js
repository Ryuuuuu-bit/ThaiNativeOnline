// HUD scale follows the screen size and the player's HUD size setting.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hudScale } from '../src/ui/viewPrefs.js';

test('HUD scale fits the screen within limits', () => {
  assert.equal(hudScale(1600, 900), 1);
  assert.equal(hudScale(1920, 1080), 1.2);
  assert.ok(hudScale(1366, 768) < 1);
  assert.equal(hudScale(844, 390), .7, 'phones stay readable');
  assert.equal(hudScale(3840, 2160), 1.4, 'big screens are capped');
  assert.equal(hudScale(1600, 900, 1.3), 1.3, 'the HUD size setting multiplies');
  assert.equal(hudScale(844, 390, .85), .6, 'never below the floor');
});
