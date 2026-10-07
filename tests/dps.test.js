// The DPS meter's sum (src/net/CombatMeters.js dpsOf).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dpsOf, DPS_WINDOW } from '../src/net/CombatMeters.js';

test('DPS: damage a second over the last window, per player; old blows drop out', () => {
  const log = [{ t: 0, by: 1, amount: 100 }, { t: 4, by: 1, amount: 100 }, { t: 3, by: 2, amount: 300 }, { t: -20, by: 3, amount: 999 }];
  const d = dpsOf(log, 4);
  assert.equal(d.get(1), 200 / 4, 'two blows over 4 s');
  assert.equal(d.get(2), 300 / 2, 'a short fight counts at least 2 s');
  assert.equal(d.has(3), false, `older than ${DPS_WINDOW} s`);
  assert.equal(dpsOf(log, 30).size, 0);
});
