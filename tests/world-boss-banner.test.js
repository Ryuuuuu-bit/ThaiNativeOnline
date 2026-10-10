import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const url = new URL('../src/ui/WorldBossBanner.js', import.meta.url);
const source = (await readFile(url, 'utf8')).replace(/import '\.\/[^']+\.css';/g, '')
  .replace(/from '(\.[^']+)'/g, (_, path) => `from '${new URL(path, url).href}'`);
const { WorldBossBanner } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

function harness(t) {
  const timeouts = new Map(), intervals = [], nodes = new Map(); let id = 0, allowed = true, joins = 0;
  function node() {
    const classes = new Set(), attrs = {}, events = {};
    return { hidden: false, textContent: '', attrs, offsetWidth: 200,
      classList: { contains: c => classes.has(c), add: c => classes.add(c), remove: c => classes.delete(c),
        toggle(c, on) { if (on) classes.add(c); else classes.delete(c); } },
      setAttribute(k, v) { attrs[k] = v; }, addEventListener(k, fn) { events[k] = fn; },
      click() { events.click(); }, querySelector(k) { if (!nodes.has(k)) nodes.set(k, node()); return nodes.get(k); } };
  }
  for (const [key, value] of Object.entries({ document: { createElement: node, body: { appendChild() {} } },
    setTimeout: (fn, delay) => { timeouts.set(++id, { fn, delay }); return id; },
    clearTimeout: key => timeouts.delete(key), setInterval: fn => { intervals.push(fn); return intervals.length; } })) {
    const prior = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, value });
    t.after(() => { if (prior) Object.defineProperty(globalThis, key, prior); else delete globalThis[key]; });
  }
  const banner = new WorldBossBanner({ canJoin: () => allowed, onJoin: () => joins++ });
  return { banner, nodes, intervals, timeouts, allow(value) { allowed = value; }, get joins() { return joins; },
    advance(delay) { for (const [key, timer] of [...timeouts]) if (timer.delay === delay) { timeouts.delete(key); timer.fn(); } } };
}

test('urgent news retains chat deduplication, timed folding and keyboard disclosure state', t => {
  const h = harness(t), b = h.banner;
  const line = b.show({ state: 'open' });
  assert.match(line, /บอสโลก/); assert.equal(b.live, line); assert.equal(b.el.hidden, false);
  assert.equal(b.show({ state: 'open' }), null); assert.equal(h.joins, 0);
  h.advance(20000);
  assert.equal(b.el.classList.contains('wb-folded'), true);
  assert.equal(b.toggle.attrs['aria-expanded'], 'false'); assert.equal(h.nodes.get('.wb-text').hidden, true);
  b.toggle.click(); assert.equal(b.toggle.attrs['aria-expanded'], 'true'); assert.equal(h.nodes.get('.wb-text').hidden, false);
  b.toggle.click(); assert.equal(b.toggle.attrs['aria-expanded'], 'false');
});

test('explicit expansion cancels pending folding and join rechecks eligibility', t => {
  const h = harness(t), b = h.banner; b.show({ state: 'open' });
  b.toggle.click(); b.toggle.click(); h.advance(20000);
  assert.equal(b.el.classList.contains('wb-folded'), false);
  h.allow(false); b.button.click(); assert.equal(h.joins, 0);
  h.intervals[0](); assert.equal(b.button.hidden, true);
  h.allow(true); h.intervals[0](); assert.equal(b.button.hidden, false);
  b.button.click(); assert.equal(h.joins, 1); assert.equal(b.button.hidden, true);
});

test('brief refusal suppresses join until standing news returns folded', t => {
  const h = harness(t), b = h.banner; const live = b.show({ state: 'open' });
  assert.ok(b.show({ state: 'closed' })); assert.equal(b.live, live); assert.equal(b.toggle.hidden, true);
  h.intervals[0](); assert.equal(b.button.hidden, true); b.button.click(); assert.equal(h.joins, 0);
  h.advance(6000); assert.equal(h.nodes.get('.wb-text').textContent, live);
  assert.equal(b.el.classList.contains('wb-folded'), true); assert.equal(b.button.hidden, false);
});

test('dismissal survives arrival reminders and brief restoration; new urgent news reopens', t => {
  const h = harness(t), b = h.banner; b.show({ state: 'open' });
  h.nodes.get('.wb-dismiss').click(); assert.equal(b.el.hidden, true); assert.ok(b.live);
  assert.equal(b.show({ state: 'open' }), null); assert.equal(b.el.hidden, true);
  b.show({ state: 'closed' }); h.nodes.get('.wb-dismiss').click(); h.advance(6000);
  assert.equal(b.el.hidden, true);
  assert.ok(b.show({ state: 'rage', type: 'ghost_red' })); assert.equal(b.el.hidden, false);
});

test('down/dawn clear standing news and expire; unknown messages do not disturb timers', t => {
  for (const state of ['down', 'dawn']) {
    const h = harness(t), b = h.banner; b.show({ state: 'open' });
    assert.ok(b.show({ state, mvp: 'QA' })); assert.equal(b.live, null); assert.equal(b.button.hidden, true);
    const timers = h.timeouts.size; assert.equal(b.show({ state: 'unknown' }), null); assert.equal(h.timeouts.size, timers);
    h.advance(6000); assert.equal(b.el.hidden, true);
  }
});
