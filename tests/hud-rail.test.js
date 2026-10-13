import { test } from 'node:test';
import assert from 'node:assert/strict';
import { railLayout, RAIL_GAP, RAIL_MIN } from '../src/ui/hudRail.js';

const rect = (left, top, width, height) => ({ left, top, right: left + width, bottom: top + height, width, height });

test('right-column widgets stack below one another without overlapping', () => {
  const plan = railLayout({ width: 1280, height: 720, start: 444, right: 19,
    items: [{ width: 50, height: 44, tightHeight: 44 }, { width: 240, height: 104, tightHeight: 70, canTighten: true }],
    floors: [rect(1210, 650, 54, 54)] });
  assert.equal(plan[0].top, 444);
  assert.equal(plan[1].top, 444 + 44 + RAIL_GAP);
  assert.ok(plan.every(p => !p.wait && !p.tight && p.max == null));
});

test('a widget that would reach the bottom controls folds, then scrolls, then waits', () => {
  const floors = [rect(1210, 600, 54, 54)];
  const fold = railLayout({ width: 1280, height: 720, start: 450, right: 19, floors, items: [{ width: 240, height: 170, tightHeight: 90, canTighten: true }] })[0];
  assert.equal(fold.tight, true); assert.equal(fold.max, null);
  const scroll = railLayout({ width: 1280, height: 720, start: 520, right: 19, floors, items: [{ width: 240, height: 170, tightHeight: 90, canTighten: true }] })[0];
  assert.equal(scroll.tight, true); assert.equal(scroll.max, 600 - RAIL_GAP - 520);
  const wait = railLayout({ width: 1280, height: 720, start: 600 - RAIL_GAP - RAIL_MIN + 1, right: 19, floors, items: [{ width: 240, height: 170, tightHeight: 90, canTighten: true }] })[0];
  assert.equal(wait.wait, true);
});

test('controls outside the column span do not limit it; phones can start folded', () => {
  const plan = railLayout({ width: 1280, height: 720, start: 300, right: 19,
    floors: [rect(260, 400, 700, 80)], items: [{ width: 240, height: 200, tightHeight: 80, canTighten: true }] });
  assert.equal(plan[0].tight, false);
  const phone = railLayout({ width: 390, height: 844, start: 220, right: 12, preferTight: true,
    items: [{ width: 200, height: 170, tightHeight: 90, canTighten: true }] });
  assert.equal(phone[0].tight, true);
});
