import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Emitter } from '../src/character/Emitter.js';
import { Character } from '../src/character/Character.js';
import { attachNetProgress } from '../src/net/NetProgress.js';
import { writeSession } from '../src/account/session.js';
import { WARP_SERVICES } from '../src/data/warpServices.js';

const url = new URL('../src/ui/StoragePanel.js', import.meta.url);
const source = (await readFile(url, 'utf8')).replace(/import '\.\/[^']+\.css';/g, '')
  .replace(/from '(\.[^']+)'/g, (_, path) => `from '${new URL(path, url).href}'`);
const { StoragePanel } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

function harness(t, construct = false) {
  const c = Character.create('QA', 'warrior'); c.addItem('hide', 8);
  const panel = construct ? new StoragePanel({ character: () => c, prepare() {}, note() {} }) : Object.create(StoragePanel.prototype), sent = [];
  const net = new Emitter(); net.online = true; net.send = m => sent.push(structuredClone(m));
  const on = net.on.bind(net); net.on = (type, fn) => { on(type, fn); return net; };
  attachNetProgress(net, c); net.emit('sync', { c: { ...c.toJSON(), ack: 0 } });
  Object.assign(panel, { character: () => c, root: { hidden: false }, render() {}, note() {}, prepare() {}, npc: 'warp_city_market',
    vault: { revision: 0, slots: Array(120).fill(null) }, $: () => ({ value: '3', focus() {} }) });
  panel.connect(net); t.after(() => clearTimeout(panel.timer));
  return { c, panel, net, sent };
}

const sync = (h, inventory = h.c.inventory, ack = 0) => h.net.emit('sync', { c: { ...h.c.toJSON(), inventory, ack } });

function tabStorage(t) {
  const fakeStorage = () => { const data = new Map(); return { data, getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, v), removeItem: k => data.delete(k) }; };
  const tab = fakeStorage(), local = fakeStorage();
  const controls = { addEventListener() {}, focus() {} }, root = { addEventListener() {}, querySelector: () => controls };
  for (const [key, value] of Object.entries({ sessionStorage: tab, localStorage: local,
    document: { activeElement: null, createElement: () => root, getElementById: () => ({ append() {} }) } })) {
    const prior = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, value });
    t.after(() => { if (prior) Object.defineProperty(globalThis, key, prior); else delete globalThis[key]; });
  }
  writeSession({ id: 'account-A', guest: false, slot: 0, token: 'must-not-be-saved-in-the-request' });
  return { tab, key: 'tno.stash.pending.v1/account-A/0' };
}

test('storage sends one move and waits for result, vault and character sync without locally removing items', t => {
  const h = harness(t), index = h.c.inventory.findIndex(s => s?.id === 'hide');
  h.panel.selected = { side: 'bag', key: String(index) };
  h.panel.move(); h.panel.move();
  assert.equal(h.sent.length, 1); assert.equal(h.c.count('hide'), 8);
  const msg = h.sent[0]; assert.equal(msg.action, 'deposit'); assert.equal(msg.qty, 3); assert.equal(msg.expected.id, 'hide');
  h.net.emit('stash_result', { request: msg.request, ok: true, moved: 3 });
  assert.ok(h.panel.pending);
  h.net.emit('stash', { revision: 1, slots: [] }); assert.ok(h.panel.pending);
  const inventory = structuredClone(h.c.inventory); inventory[index].qty -= 3;
  sync(h, inventory); assert.equal(h.c.count('hide'), 5); assert.equal(h.panel.pending, null); assert.match(h.panel.status, /เซฟแล้ว/);
});

test('lost acknowledgement and reconnect reuse the same idempotency identity, even if displayed bag changes', t => {
  const h = harness(t); h.panel.move('deposit_materials'); const original = h.sent[0];
  h.net.online = false; h.net.emit('status', false); assert.ok(h.panel.pending.uncertain);
  h.c.addItem('hide', 1);
  h.net.online = true; h.net.emit('status', true);
  assert.deepEqual(h.sent[1], original); assert.ok(h.panel.pending); assert.equal(h.panel.vault, null);
  h.net.emit('stash_result', { request: original.request, ok: true, moved: 8, replayed: true });
  h.net.emit('stash', { revision: 1, slots: [] }); sync(h);
  assert.equal(h.panel.pending, null); assert.match(h.panel.status, /8/);
});

test('ambiguous database failure keeps the request; definite refusal does not show success', t => {
  const h = harness(t); h.panel.move('deposit_materials'); const msg = h.sent[0];
  h.net.emit('stash_result', { request: msg.request, ok: false, why: 'storage_unavailable' });
  assert.ok(h.panel.pending.uncertain); h.panel.retry(); assert.deepEqual(h.sent[1], msg);
  h.net.emit('stash_result', { request: 'unrelated', ok: true, moved: 99 }); assert.equal(h.panel.pending.result, null);
  h.net.emit('stash_result', { request: msg.request, ok: false, why: 'stale' });
  h.net.emit('stash', { revision: 2, slots: [] }); sync(h);
  assert.equal(h.panel.pending, null); assert.match(h.panel.status, /ข้อมูลคลังเปลี่ยน/); assert.doesNotMatch(h.panel.status, /สำเร็จ|เซฟแล้ว/);
});

test('invalid quantity or disconnected client creates no transfer', t => {
  const h = harness(t); h.panel.selected = { side: 'bag', key: String(h.c.inventory.findIndex(s => s?.id === 'hide')) };
  h.panel.$ = () => ({ value: '100' }); h.panel.move(); assert.equal(h.sent.length, 0);
  h.net.online = false; h.panel.move('deposit_materials'); assert.equal(h.sent.length, 0);
});

test('discarded or empty raw sync cannot confirm storage; server-sync observes the adopted bag', t => {
  const h = harness(t), index = h.c.inventory.findIndex(s => s?.id === 'hide');
  h.c.points = 1; assert.ok(h.c.allocate('str')); // ack 1 is still outstanding
  h.panel.selected = { side: 'bag', key: String(index) }; h.panel.move();
  const msg = h.sent.find(m => m.t === 'stash_move'), observed = [];
  h.c.on('server-sync', e => observed.push({ ack: e.ack, qty: h.c.count('hide') }));
  h.net.emit('stash_result', { request: msg.request, ok: true, moved: 3 });
  h.net.emit('stash', { revision: 1, slots: [] });
  const inventory = structuredClone(h.c.inventory); inventory[index].qty -= 3;
  h.net.emit('sync', {}); sync(h, inventory, 0);
  assert.ok(h.panel.pending); assert.equal(h.c.count('hide'), 8); assert.deepEqual(observed, []);
  sync(h, inventory, 1);
  assert.equal(h.panel.pending, null); assert.equal(h.c.count('hide'), 5);
  assert.deepEqual(observed, [{ ack: 1, qty: 5 }]);
});

test('unrelated results and adopted sync before the matching UUID cannot finish storage', t => {
  const h = harness(t); h.panel.move('deposit_materials'); const msg = h.sent[0];
  h.net.emit('stash_result', { request: 'different-UUID', ok: true, moved: 99 });
  sync(h); assert.ok(h.panel.pending); assert.equal(h.panel.pending.sync, false);
  h.net.emit('stash_result', { request: msg.request, ok: true, moved: 8 });
  h.net.emit('stash', { revision: 1, slots: [] }); assert.ok(h.panel.pending);
  sync(h); assert.equal(h.panel.pending, null);
});

test('offline refusal needs no missing sync: retain UUID, prompt sign-in, retry after authenticated adoption', t => {
  const h = harness(t); h.panel.move('deposit_materials'); const msg = structuredClone(h.sent[0]);
  h.net.emit('stash_result', { request: msg.request, ok: false, why: 'offline' });
  assert.ok(h.panel.pending.uncertain); assert.ok(h.panel.pending.awaitingSignIn);
  assert.deepEqual(h.panel.pending.message, msg); assert.match(h.panel.status, /เข้าสู่ระบบ/);
  assert.equal(h.panel.vault, null); assert.equal(h.panel.pending.result, null);
  h.net.emit('sync', {}); assert.equal(h.sent.length, 1);
  sync(h); assert.deepEqual(h.sent[1], msg); assert.ok(h.panel.pending);
  h.net.emit('stash_result', { request: msg.request, ok: true, moved: 8, replayed: true });
  h.net.emit('stash', { revision: 1, slots: [] });
  const inventory = h.c.inventory.map(s => s?.id === 'hide' ? null : s);
  sync(h, inventory); assert.equal(h.panel.pending, null); assert.equal(h.c.count('hide'), 0);
});

test('reconnecting the panel removes its previous character sync subscription', t => {
  const h = harness(t); h.panel.connect(h.net);
  assert.equal(h.c.handlers['server-sync'].length, 1);
  sync(h); assert.equal(h.panel.pending, undefined);
});

test('reload restores only the signed account/slot request, rebinds the counter and clears storage after adoption', t => {
  const { tab, key } = tabStorage(t), first = harness(t);
  first.panel.move('deposit_materials'); const original = structuredClone(first.sent[0]);
  assert.deepEqual(JSON.parse(tab.getItem(key)), original);
  assert.doesNotMatch(tab.getItem(key), /token|must-not-be-saved/);
  first.net.emit('stash_result', { request: original.request, ok: false, why: 'offline' });
  assert.deepEqual(JSON.parse(tab.getItem(key)), original);
  const reloaded = harness(t, true);
  assert.deepEqual(reloaded.panel.pending.message, original); assert.ok(reloaded.panel.pending.uncertain);
  const other = WARP_SERVICES.find(s => s.map === 'city' && s.npcId !== original.npc);
  reloaded.panel.show({ id: other.npcId, def: { storageService: true } });
  const rebound = { ...original, npc: other.npcId };
  assert.deepEqual(JSON.parse(tab.getItem(key)), rebound);
  sync(reloaded); assert.deepEqual(reloaded.sent[0], rebound);
  reloaded.net.emit('stash_result', { request: original.request, ok: true, moved: 8, replayed: true });
  reloaded.net.emit('stash', { revision: 1, slots: [] });
  const inventory = reloaded.c.inventory.map(s => s?.id === 'hide' ? null : s);
  sync(reloaded, inventory);
  assert.equal(reloaded.panel.pending, null); assert.equal(reloaded.c.count('hide'), 0); assert.equal(tab.getItem(key), null);
});

test('another account, slot or guest neither restores nor retries the original pending request', t => {
  const { tab, key } = tabStorage(t), original = harness(t); original.panel.move('deposit_materials');
  for (const session of [{ id: 'account-A', guest: false, slot: 1 }, { id: 'account-B', guest: false, slot: 0 }, { id: 'account-A', guest: true, slot: 0 }]) {
    writeSession(session); const other = harness(t, true);
    assert.equal(other.panel.pending, undefined); assert.ok(tab.getItem(key));
    const count = original.sent.length; original.panel.retry();
    assert.equal(original.sent.length, count); assert.ok(original.panel.pending.awaitingSignIn);
  }
});

test('invalid stored requests are removed and unavailable tab storage leaves in-memory retries usable', t => {
  const { tab, key } = tabStorage(t); tab.setItem(key, JSON.stringify({ t: 'stash_move', request: 'bad' }));
  const h = harness(t, true); assert.equal(h.panel.pending, undefined); assert.equal(tab.getItem(key), null);
  tab.setItem = () => { throw Error('storage blocked'); };
  h.panel.move('deposit_materials'); const msg = structuredClone(h.sent[0]);
  h.net.emit('stash_result', { request: msg.request, ok: false, why: 'offline' }); h.panel.retry();
  assert.deepEqual(h.sent[1], msg); assert.ok(h.panel.pending);
});
