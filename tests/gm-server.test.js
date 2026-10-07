import test from 'node:test';
import assert from 'node:assert/strict';
import { Character } from '../src/character/Character.js';
import { POINTS_PER_LEVEL } from '../src/character/data/classes.js';
import { adminIds, runGm, GM_PREFIX } from '../server/gm.js';

const hero = () => Character.create('ทดสอบ', 'muaythai', 'male');

test('admin ids come from ADMIN_IDS and GM_ID', () => {
  assert.deepEqual([...adminIds({ ADMIN_IDS: ' A, b ', GM_ID: 'gm_admin' })].sort(), ['a', 'b', 'gm_admin']);
  assert.equal(adminIds({}).size, 0);
});

test('GM prefix only matches /gm', () => {
  assert.ok(GM_PREFIX.test('/gm gold') && GM_PREFIX.test('/GM'));
  assert.ok(!GM_PREFIX.test('/gmx') && !GM_PREFIX.test('hi /gm'));
});

test('gold, level, item, say', () => {
  const c = hero(), g = c.gold;
  assert.equal(runGm(c, '/gm gold 500').ok, true); assert.equal(c.gold, g + 500);
  const p = c.points, r = runGm(c, '/gm level 10');
  assert.equal(c.level, 10); assert.equal(r.level, 10); assert.equal(c.points, p + 9 * POINTS_PER_LEVEL);
  assert.equal(runGm(c, '/gm item potion_s 3').ok, true); assert.ok(c.count('potion_s') >= 3);
  assert.equal(runGm(c, '/gm item nope').ok, false);
  assert.equal(runGm(c, '/gm say สวัสดี ทุกคน').say, 'สวัสดี ทุกคน');
  assert.match(runGm(c, '/gm').msg, /\/gm gold/);
});
