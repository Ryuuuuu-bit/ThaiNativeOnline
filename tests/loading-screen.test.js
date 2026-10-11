import test from 'node:test';
import assert from 'node:assert/strict';
import { createLoadingScreen } from '../src/ui/LoadingScreen.js';

function overlay() {
  const node = () => ({ dataset: {}, textContent: '', attributes: {}, children: [],
    hidden: false, disabled: false, listeners: {},
    style: { setProperty(key, value) { this[key] = value; } },
    setAttribute(key, value) { this.attributes[key] = value; },
    append(...children) { this.children.push(...children); },
    replaceChildren(...children) { this.children = children; },
    addEventListener(type, callback) { this.listeners[type] = callback; } });
  const parts = Object.fromEntries(['title', 'text', 'track', 'count', 'percent', 'steps', 'retry', 'cancel'].map(key => [key, node()]));
  const root = node(), classes = new Set();
  root.classList = { add: key => classes.add(key), remove: key => classes.delete(key) };
  root.ownerDocument = { createElement: node };
  root.querySelector = selector => parts[selector.match(/data-loading-(\w+)/)?.[1]];
  return { root, parts, screen: createLoadingScreen({ element: root }) };
}
const plan = { title: 'นครอโยธยา', steps: [{ id: 'map', label: 'แผนที่' }, { id: 'avatar', label: 'ตัวละคร' }] };

test('loading counts finished stages and refuses entry while avatar is pending', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { screen, root, parts } = overlay();
  const run = screen.begin(plan);
  run.start('map');
  assert.equal(parts.percent.textContent, '0%');
  run.complete('map'); run.start('avatar');
  assert.equal(parts.percent.textContent, '50%');
  assert.equal(run.finish(), false);
  assert.equal(root.hidden, false); assert.equal(screen.pending, true);
  run.complete('avatar'); assert.equal(run.finish(), true);
  assert.equal(parts.track.attributes['aria-valuenow'], '100');
  t.mock.timers.tick(350); assert.equal(root.hidden, true);
});

test('failed loading stays visible and one retry cannot be completed by the old attempt', async () => {
  const { screen, root, parts } = overlay();
  const old = screen.begin(plan); old.start('avatar');
  let retried, calls = 0;
  old.fail('โหลดตัวละครไม่สำเร็จ', { retry: () => { calls++; retried = screen.begin(plan); } });
  old.complete('avatar');
  assert.equal(screen.state, 'error'); assert.equal(root.hidden, false);
  assert.equal(parts.text.textContent, 'โหลดตัวละครไม่สำเร็จ');
  assert.equal(parts.retry.hidden, false);
  parts.retry.listeners.click(); parts.retry.listeners.click();
  assert.equal(calls, 1); assert.equal(screen.state, 'loading');
  old.complete('map'); old.complete('avatar'); old.fail('ข้อความเก่า');
  assert.equal(parts.percent.textContent, '0%');
  retried.complete('map'); assert.equal(parts.percent.textContent, '50%');
});

test('a finished overlay cannot hide a newer map loading attempt', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { screen, root, parts } = overlay();
  const first = screen.begin(plan); first.complete('map'); first.complete('avatar'); first.finish();
  const next = screen.begin({ ...plan, title: 'ป่าลึก' });
  t.mock.timers.tick(1000);
  assert.equal(root.hidden, false); assert.equal(parts.title.textContent, 'ป่าลึก');
  first.complete('map'); assert.equal(parts.percent.textContent, '0%');
  next.start('map'); assert.equal(parts.text.textContent, 'แผนที่');
});

test('failed travel can resume the retained map without accepting late completion', async () => {
  const { screen, root, parts } = overlay();
  const run = screen.begin(plan); run.start('map');
  let restored = false;
  run.fail('โหลดแผนที่ไม่สำเร็จ', { cancel: () => { restored = true; } });
  assert.equal(parts.cancel.hidden, false); assert.equal(screen.pending, true);
  await parts.cancel.listeners.click();
  assert.equal(restored, true); assert.equal(root.hidden, true); assert.equal(screen.pending, false);
  run.complete('map'); assert.equal(screen.state, 'idle');
  screen.begin(plan); assert.equal(root.hidden, false); assert.equal(parts.cancel.hidden, true);
});
