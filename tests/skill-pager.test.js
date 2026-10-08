import { test } from 'node:test';
import assert from 'node:assert/strict';
import { skillPages } from '../src/ui/SkillPager.js';

test('touch paging excludes unlearned slots without changing controller indices', () => {
  const slots = Array.from({ length: 10 }, (_, id) => ({ id }));
  assert.deepEqual(skillPages(slots, i => [0, 2, 3, 5, 7, 9].includes(i) ? 1 : 0), [[0, 2, 3, 5, 7], [9]]);
  assert.deepEqual(skillPages(slots), [[0, 1, 2, 3, 4], [5, 6, 7, 8, 9]]);
  assert.deepEqual(skillPages(slots, () => 0), [[]]);
  assert.deepEqual(skillPages([], () => 0), [[]]);
});
