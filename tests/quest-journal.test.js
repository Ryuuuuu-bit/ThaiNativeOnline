import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { QuestSystem } from '../src/quest/QuestSystem.js';

// Match the existing UI-test approach: Node loads JS without Vite's CSS imports.
const url = new URL('../src/ui/QuestJournal.js', import.meta.url);
const source = (await readFile(url, 'utf8')).replace(/import '\.\/[^']+\.css';/g, '')
  .replace(/from '(\.[^']+)'/g, (_, path) => `from '${new URL(path, url).href}'`);
const { QuestJournal } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

function harness(t, defs) {
  const listeners = new Map(), controls = new Map();
  const doc = { activeElement: null, addEventListener(type, fn) { listeners.set(type, fn); },
    removeEventListener(type, fn) { if (listeners.get(type) === fn) listeners.delete(type); },
    getElementById: () => ({ append() {} }) };
  function element(dataset = {}) {
    return { dataset, innerHTML: '', value: '', scrollTop: 0, scrollLeft: 0, isConnected: true,
      events: {}, addEventListener(type, fn) { this.events[type] = fn; },
      focus() { doc.activeElement = this; }, getClientRects: () => [1],
      hasAttribute(name) { return name === 'data-journal-locate' && this === controls.get('[data-journal-locate]'); },
      querySelectorAll() {
        return [...this.innerHTML.matchAll(/data-journal-quest="([^"]+)"/g)].map(m => element({ journalQuest: m[1] }));
      }, remove() { this.removed = true; } };
  }
  for (const id of ['[data-journal-close]', '#quest-journal-search', '#quest-journal-filter', '#quest-journal-count',
    '#quest-journal-list', '#quest-journal-detail', '[data-journal-locate]', '[role="dialog"]']) controls.set(id, element());
  controls.get('#quest-journal-filter').value = 'active';
  const root = element(); root.querySelector = s => controls.get(s);
  root.querySelectorAll = () => [controls.get('[data-journal-close]'), controls.get('#quest-journal-search'),
    controls.get('#quest-journal-filter'), ...controls.get('#quest-journal-list').querySelectorAll(),
    controls.get('#quest-journal-detail'), ...(controls.get('#quest-journal-detail').innerHTML.includes('data-journal-locate')
      ? [controls.get('[data-journal-locate]')] : [])];
  root.contains = el => [...controls.values()].includes(el) || el?.dataset?.journalQuest !== undefined;
  doc.createElement = () => root;
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: doc });
  t.after(() => { if (previous) Object.defineProperty(globalThis, 'document', previous); else delete globalThis.document; });
  const quests = new QuestSystem(defs, { storage: null });
  quests.character = { classId: 'warrior', level: 30, jobLevel: 20, countUnlocked: () => 0 };
  let prepares = 0;
  const routes = [], journal = new QuestJournal({ quests, prepare: () => prepares++, locate: id => routes.push(id) });
  return { journal, quests, root, controls, doc, listeners, routes, element, prepares: () => prepares };
}

const quest = (id, extra = {}) => ({ id, title: `เควส ${id}`, giver: 'village_trader',
  objectives: [{ kill: 'boar', count: 2 }], rewards: { gold: 10 }, ...extra });
const activate = (h, id, kills = 0) => { h.quests.state[id] = { status: 'active', kills: { boar: kills } }; };
const event = (key, shiftKey = false) => ({ key, shiftKey, prevented: false, stopped: false,
  preventDefault() { this.prevented = true; }, stopPropagation() { this.stopped = true; } });

test('journal includes every accepted quest, excludes offers, and distinguishes ready and handed-in states', t => {
  const defs = Array.from({ length: 7 }, (_, i) => quest(`q${i}`));
  const h = harness(t, [...defs, quest('offer'), quest('other', { classId: 'hunter' })]);
  defs.forEach(q => activate(h, q.id)); activate(h, 'q1', 2); activate(h, 'other');
  h.quests.state.q2.status = 'done';
  assert.equal(h.journal.entries().length, 7); // no tracker slice or class filter
  h.controls.get('#quest-journal-filter').value = 'ready';
  assert.deepEqual(h.journal.entries().map(e => [e.q.id, e.status]), [['q1', 'ready']]);
  h.controls.get('#quest-journal-filter').value = 'done';
  assert.deepEqual(h.journal.entries().map(e => e.q.id), ['q2']);
  h.controls.get('#quest-journal-filter').value = 'all';
  assert.equal(h.journal.entries().length, 8);
  assert.ok(h.journal.entries().every(e => e.q.id !== 'offer'));
});

test('search uses existing objective/reward/NPC presentation and does not mutate quests', t => {
  const h = harness(t, [quest('target', { turnIn: 'unique_receiver', objectives: [{ collect: 'unique_item', count: 2 }] }), quest('second')]);
  activate(h, 'target'); activate(h, 'second');
  const before = structuredClone(h.quests.state);
  for (const query of [' unique_RECEIVER ', 'unique_item', '10 ตำลึง']) {
    h.controls.get('#quest-journal-search').value = query;
    assert.ok(h.journal.entries().some(e => e.q.id === 'target'));
  }
  h.controls.get('#quest-journal-search').value = 'nothing matches';
  h.journal.show(); assert.deepEqual(h.journal.entries(), []);
  assert.match(h.controls.get('#quest-journal-list').innerHTML, /ไม่พบเควส/);
  assert.deepEqual(h.quests.state, before);
});

test('dynamic titles, IDs, hints, rewards and NPC text are escaped; completed material objectives remain fulfilled', t => {
  const unsafe = '<img src=x onerror="bad()">';
  const q = quest(unsafe, { title: unsafe, offer: unsafe, guide: unsafe, turnIn: unsafe,
    objectives: [{ collect: unsafe, count: 3, hint: unsafe }], rewards: { items: [[unsafe, 2]] } });
  const h = harness(t, [q]); h.quests.state[q.id] = { status: 'done' };
  h.controls.get('#quest-journal-filter').value = 'done'; h.journal.show();
  const html = h.controls.get('#quest-journal-detail').innerHTML;
  assert.doesNotMatch(html, /<img/); assert.match(html, /&lt;img/);
  assert.match(html, /class="fulfilled"/); assert.match(html, /3 \/ 3/);
  assert.match(h.controls.get('#quest-journal-list').innerHTML, /data-journal-quest="&lt;img/);
  assert.doesNotMatch(html, /data-action="(?:accept|complete)"/);
});

test('change refreshes only while open and preserves selection, query, list scroll and detail scroll', t => {
  const h = harness(t, [quest('a'), quest('b')]); activate(h, 'a'); activate(h, 'b');
  let renders = 0; const render = h.journal.render.bind(h.journal);
  h.journal.render = () => { renders++; render(); };
  h.quests.emit('change'); assert.equal(renders, 0);
  h.journal.show(); h.journal.selectedId = 'b'; h.journal.render();
  h.controls.get('#quest-journal-list').scrollTop = 80;
  h.controls.get('#quest-journal-detail').scrollTop = 40;
  h.controls.get('#quest-journal-search').value = 'เควส';
  h.quests.emit('change');
  assert.equal(h.journal.selectedId, 'b');
  assert.equal(h.controls.get('#quest-journal-list').scrollTop, 80);
  assert.equal(h.controls.get('#quest-journal-detail').scrollTop, 40);
  assert.equal(h.controls.get('#quest-journal-search').value, 'เควส');
  h.journal.close(); const count = renders;
  h.quests.emit('change'); assert.equal(renders, count);
  h.journal.show(); assert.equal(h.journal.selectedId, 'b');
  h.quests.state.b.status = 'done'; h.quests.emit('change'); assert.equal(h.journal.selectedId, 'a');
});

test('open is idempotent, focus wraps both ways, Escape returns focus, and destroy unsubscribes', t => {
  const h = harness(t, []), opener = h.element(); opener.focus();
  h.journal.show(); h.journal.show(); assert.equal(h.prepares(), 1);
  assert.equal(h.doc.activeElement, h.controls.get('#quest-journal-search'));
  const first = h.controls.get('[data-journal-close]'), last = h.controls.get('#quest-journal-detail');
  first.focus(); const back = event('Tab', true); h.journal.onKeydown(back);
  assert.equal(h.doc.activeElement, last); assert.equal(back.prevented, true);
  const next = event('Tab'); h.journal.onKeydown(next); assert.equal(h.doc.activeElement, first);
  h.listeners.get('focusin')({ target: opener }); assert.equal(h.doc.activeElement, first);
  const escape = event('Escape'); h.journal.onKeydown(escape);
  assert.equal(h.journal.open, false); assert.equal(h.doc.activeElement, opener);
  assert.equal(escape.stopped, true); assert.equal(h.listeners.has('focusin'), false);
  h.journal.destroy(); assert.equal(h.root.removed, true); assert.equal(h.quests.handlers.change.length, 0);
});

test('map action closes journal before passing turn-in NPC ID and never completes a ready quest', t => {
  const h = harness(t, [quest('ready', { turnIn: 'master_sword' })]); activate(h, 'ready', 2);
  h.quests.accept = h.quests.complete = () => assert.fail('journal must be read-only');
  h.journal.show();
  const target = { closest: s => s === '[data-journal-locate]' ? {} : null };
  h.root.events.click({ target });
  assert.equal(h.journal.open, false); assert.deepEqual(h.routes, ['master_sword']);
  assert.equal(h.quests.status('ready'), 'active');
});
