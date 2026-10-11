import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ServerAccountStore, startSaveSync } from '../src/account/ServerAccounts.js';
import { SaveSlot } from '../src/core/SaveSlot.js';

const UID = `CHR-${'A'.repeat(32)}`;
const reply = (status = 200, body = { ok: true }) => ({ status, json: async () => body });
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
async function flush() { for (let i = 0; i < 12; i++) await Promise.resolve(); }
class Lifecycle extends EventTarget {
  listeners = new Map();
  visibilityState = 'visible';
  addEventListener(type, listener) { super.addEventListener(type, listener); if (!this.listeners.has(type)) this.listeners.set(type, new Set()); this.listeners.get(type).add(listener); }
  removeEventListener(type, listener) { super.removeEventListener(type, listener); this.listeners.get(type)?.delete(listener); }
}
function harness(t) {
  const values = new Map(), storage = { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, String(v)), removeItem: k => values.delete(k), key: i => [...values.keys()][i], get length() { return values.size; } };
  const store = new ServerAccountStore(storage); store.token = 'first-token'; store.remember('alice'); store.characterUids.set(0, UID); store.renameSlots.add(0);
  const prefix = store.slotPrefix('alice', 0), key = `${prefix}tno.character.v1`;
  storage.setItem(key, JSON.stringify({ name: 'Alice', level: 7 })); SaveSlot.use(prefix);
  const originals = Object.fromEntries(['fetch', 'document', 'window'].map(k => [k, Object.getOwnPropertyDescriptor(globalThis, k)]));
  const doc = new Lifecycle(), win = new Lifecycle(), syncs = [];
  Object.defineProperty(globalThis, 'document', { configurable: true, value: doc });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: win });
  t.after(() => { syncs.forEach(s => s.stop()); SaveSlot.use(''); for (const [k, descriptor] of Object.entries(originals)) { if (descriptor) Object.defineProperty(globalThis, k, descriptor); else delete globalThis[k]; } });
  return { store, storage, key, doc, win, start: every => { const s = startSaveSync(store, 'alice', 0, every); syncs.push(s); return s; } };
}

test('refused active-character deletion retains local saves, incarnation UID and rename metadata', async t => {
  const h = harness(t); globalThis.fetch = async () => reply(409, { ok: false, code: 'in_play' });
  const result = await h.store.deleteSlot('alice', 0);
  assert.equal(result.ok, false); assert.match(result.msg, /ยังอยู่ในเกม|กำลังบันทึก/);
  assert.ok(h.storage.getItem(h.key)); assert.equal(h.store.characterUids.get(0), UID); assert.equal(h.store.renameSlots.has(0), true);
});

test('deletion waits for authoritative success and coalesces duplicate requests', async t => {
  const h = harness(t), held = deferred(); let calls = 0;
  globalThis.fetch = () => { calls++; return held.promise; };
  const a = h.store.deleteSlot('alice', 0), b = h.store.deleteSlot('alice', 0);
  assert.equal(calls, 1); assert.ok(h.storage.getItem(h.key)); assert.equal(h.store.characterUids.get(0), UID);
  held.resolve(reply()); assert.equal((await a).ok, true); assert.equal((await b).ok, true);
  assert.equal(h.storage.getItem(h.key), null); assert.equal(h.store.characterUids.has(0), false); assert.equal(h.store.renameSlots.has(0), false);
});

test('network and HTTP deletion failures never erase the local character', async t => {
  const h = harness(t);
  globalThis.fetch = async () => { throw new Error('offline'); };
  assert.equal((await h.store.deleteSlot('alice', 0)).ok, false); assert.ok(h.storage.getItem(h.key));
  globalThis.fetch = async () => reply(503, { ok: true });
  assert.equal((await h.store.deleteSlot('alice', 0)).ok, false); assert.ok(h.storage.getItem(h.key));
});

for (const [label, status, body] of [
  ['HTTP 500 with success-looking JSON', 500, { ok: true, status: 200 }],
  ['HTTP 200 with rejected JSON', 200, { ok: false }],
]) test(`deletion retains all slot data for ${label}`, async t => {
  const h = harness(t); globalThis.fetch = async () => reply(status, body);
  const result = await h.store.deleteSlot('alice', 0);
  assert.equal(result.ok, false); assert.equal(result.status, status); assert.ok(h.storage.getItem(h.key));
  assert.equal(h.store.characterUids.get(0), UID); assert.equal(h.store.renameSlots.has(0), true);
});

test('late deletion acknowledgement cannot erase a new incarnation or session', async t => {
  const h = harness(t), held = deferred(); globalThis.fetch = () => held.promise;
  const pending = h.store.deleteSlot('alice', 0);
  h.store.clearIdentity(); h.store.token = 'new-token'; const newUid = `CHR-${'B'.repeat(32)}`; h.store.characterUids.set(0, newUid);
  h.storage.setItem(h.key, '{"name":"New character"}'); held.resolve(reply());
  assert.equal((await pending).ok, false); assert.equal(h.store.characterUids.get(0), newUid); assert.match(h.storage.getItem(h.key), /New character/);
});

test('deletion cannot clear replacement UID metadata even with the same session', async t => {
  const h = harness(t), held = deferred(); globalThis.fetch = () => held.promise;
  const pending = h.store.deleteSlot('alice', 0), nextUid = `CHR-${'B'.repeat(32)}`;
  h.store.characterUids.set(0, nextUid); h.storage.setItem(h.key, '{"name":"Replacement"}'); held.resolve(reply());
  assert.equal((await pending).ok, false); assert.equal(h.store.characterUids.get(0), nextUid); assert.match(h.storage.getItem(h.key), /Replacement/);
});

test('Guest deletion remains local and an expired real session cannot delete locally', async t => {
  const h = harness(t); let calls = 0; globalThis.fetch = async () => { calls++; return reply(); };
  h.storage.setItem('tno.character.v1', '{"name":"Guest"}');
  assert.equal((await h.store.deleteSlot('guest', 0)).ok, true); assert.equal(h.storage.getItem('tno.character.v1'), null); assert.equal(calls, 0);
  h.store.token = null; assert.equal((await h.store.deleteSlot('alice', 0)).ok, false); assert.ok(h.storage.getItem(h.key)); assert.equal(calls, 0);
});

test('SaveSync retries an unchanged 503 bundle and acknowledges only the successful retry', async t => {
  const h = harness(t); t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] }); const requests = [];
  globalThis.fetch = async (url, init) => { requests.push(init); return requests.length === 1 ? reply(503, { ok: false }) : reply(); };
  const sync = h.start(20000); await flush();
  await sync.push(); assert.equal(requests.length, 1, 'normal flush cannot bypass retry backoff');
  t.mock.timers.tick(499); await flush(); assert.equal(requests.length, 1);
  t.mock.timers.tick(1); await flush(); assert.equal(requests.length, 2); assert.equal(requests[0].body, requests[1].body);
  t.mock.timers.tick(20000); await flush(); assert.equal(requests.length, 2, 'successful unchanged bundle needs no duplicate write');
});

for (const [label, response] of [
  ['HTTP error despite success-looking JSON', () => reply(503, { ok: true })],
  ['rejected JSON despite HTTP 200', () => reply(200, { ok: false })],
  ['malformed JSON', () => ({ status: 200, json: async () => { throw new Error('JSON'); } })],
  ['network failure', () => { throw new Error('offline'); }],
]) test(`SaveSync retries ${label}`, async t => {
  const h = harness(t); t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] }); let calls = 0;
  globalThis.fetch = async () => ++calls === 1 ? response() : reply();
  h.start(20000); await flush(); t.mock.timers.tick(500); await flush(); assert.equal(calls, 2);
});

test('SaveSync serializes writes and never lets an old acknowledgement swallow newer data', async t => {
  const h = harness(t), held = [], requests = [];
  globalThis.fetch = (url, init) => { requests.push(init); const d = deferred(); held.push(d); return d.promise; };
  const sync = h.start(20000);
  h.storage.setItem(h.key, '{"name":"Alice","level":8}'); sync.push();
  h.storage.setItem(h.key, '{"name":"Alice","level":9}'); sync.push(true);
  assert.equal(requests.length, 1, 'one request at a time, even lifecycle flushes');
  held[0].resolve(reply()); await flush(); assert.equal(requests.length, 2);
  const latest = JSON.parse(requests[1].body); assert.equal(JSON.parse(latest.data['tno.character.v1']).level, 9); assert.equal(requests[1].keepalive, true);
  held[1].resolve(reply()); await flush(); await sync.push(); assert.equal(requests.length, 2);
});

test('retry backoff caps at 10 seconds and resets after success', async t => {
  const h = harness(t); t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] }); let calls = 0, failing = true;
  globalThis.fetch = async () => { calls++; return failing ? reply(503, { ok: false }) : reply(); };
  h.start(600000); await flush();
  for (const delay of [500, 1000, 2000, 4000, 8000, 10000, 10000]) {
    const before = calls; t.mock.timers.tick(delay - 1); await flush(); assert.equal(calls, before);
    t.mock.timers.tick(1); await flush(); assert.equal(calls, before + 1);
  }
  failing = false; t.mock.timers.tick(10000); await flush();
  h.storage.setItem(h.key, '{"name":"Alice","level":8}'); failing = true;
  h.doc.visibilityState = 'hidden'; h.doc.dispatchEvent(new Event('visibilitychange')); await flush();
  const before = calls; t.mock.timers.tick(500); await flush(); assert.equal(calls, before + 1);
});

for (const [label, change] of [
  ['token', h => { h.store.token = 'new-token'; }],
  ['identity epoch', h => { h.store.identityEpoch++; }],
  ['account', h => { h.store.remember('bob'); }],
  ['character UID', h => { h.store.characterUids.set(0, `CHR-${'B'.repeat(32)}`); }],
  ['active slot', () => { SaveSlot.use('tno.alice.1/'); }],
]) test(`old SaveSync stops after ${label} changes, including late responses`, async t => {
  const h = harness(t); t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] }); const held = deferred(), requests = [];
  globalThis.fetch = (url, init) => { requests.push(init); return held.promise; };
  const sync = h.start(20000); change(h); h.storage.setItem(h.key, '{"name":"Alice","level":8}');
  h.win.dispatchEvent(new Event('pagehide')); assert.equal(h.doc.listeners.get('visibilitychange').size, 0); assert.equal(h.win.listeners.get('pagehide').size, 0);
  held.resolve(reply()); await flush(); t.mock.timers.tick(30000); await flush(); await sync.push(true);
  assert.equal(requests.length, 1); assert.equal(requests[0].headers.authorization, 'Bearer first-token');
});

test('stop removes lifecycle handlers and cancels retry, pending response and public push', async t => {
  const h = harness(t); t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] }); let calls = 0;
  globalThis.fetch = async () => { calls++; return reply(503, { ok: false }); };
  const sync = h.start(20000); await flush(); sync.stop();
  assert.equal(h.doc.listeners.get('visibilitychange').size, 0); assert.equal(h.win.listeners.get('pagehide').size, 0);
  h.doc.visibilityState = 'hidden'; h.doc.dispatchEvent(new Event('visibilitychange')); h.win.dispatchEvent(new Event('pagehide'));
  t.mock.timers.tick(40000); await flush(); await sync.push(true); assert.equal(calls, 1);
});

test('stop while a request is pending ignores its late success and newer local changes', async t => {
  const h = harness(t), held = deferred(); let calls = 0;
  globalThis.fetch = () => { calls++; return held.promise; };
  const sync = h.start(20000); sync.stop(); h.storage.setItem(h.key, '{"name":"Alice","level":8}');
  held.resolve(reply()); await flush(); await sync.push(true); assert.equal(calls, 1);
  assert.equal(h.doc.listeners.get('visibilitychange').size, 0); assert.equal(h.win.listeners.get('pagehide').size, 0);
});

test('replacement sync waits for the preceding in-flight write and captures the new token', async t => {
  const h = harness(t), held = deferred(), requests = [];
  globalThis.fetch = (url, init) => { requests.push(init); return requests.length === 1 ? held.promise : Promise.resolve(reply()); };
  h.start(20000); h.store.token = 'second-token'; h.store.identityEpoch++;
  h.storage.setItem(h.key, '{"name":"Alice","level":8}'); h.start(20000);
  assert.equal(requests.length, 1, 'replacement waits rather than overlapping');
  held.resolve(reply()); await flush(); assert.equal(requests.length, 2); assert.equal(requests[1].headers.authorization, 'Bearer second-token');
  assert.equal(JSON.parse(JSON.parse(requests[1].body).data['tno.character.v1']).level, 8);
  assert.equal(h.doc.listeners.get('visibilitychange').size, 1); assert.equal(h.win.listeners.get('pagehide').size, 1);
});

test('lifecycle flush retains keepalive and a replacement sync deactivates the previous one', async t => {
  const h = harness(t), requests = []; globalThis.fetch = async (url, init) => { requests.push(init); return reply(); };
  const old = h.start(20000); await flush(); h.storage.setItem(h.key, '{"name":"Alice","level":8}');
  h.doc.visibilityState = 'hidden'; h.doc.dispatchEvent(new Event('visibilitychange')); await flush(); assert.equal(requests[1].keepalive, true);
  h.start(20000); await flush(); assert.equal(h.doc.listeners.get('visibilitychange').size, 1); assert.equal(h.win.listeners.get('pagehide').size, 1);
  const before = requests.length; h.storage.setItem(h.key, '{"name":"Alice","level":9}'); await old.push(true); assert.equal(requests.length, before);
  h.win.dispatchEvent(new Event('pagehide')); await flush(); assert.equal(requests.at(-1).keepalive, true);
});
