// Accounts, character slots and the save-slot prefix, without a browser.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AccountStore } from '../src/account/AccountStore.js';
import { SaveSlot, slotStorage } from '../src/core/SaveSlot.js';
import { ACCOUNTS } from '../src/data/accounts.js';

// Minimal Storage (getItem/setItem/removeItem/key/length) backed by a Map.
function memoryStorage() {
  const m = new Map();
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), key: i => [...m.keys()][i] ?? null, get length() { return m.size; }, map: m };
}

test('register, then log in with the right password only', async () => {
  const s = memoryStorage(), store = new AccountStore(s);
  assert.deepEqual(await store.register('Somchai_1', 'secret12'), { ok: true, id: 'somchai_1' });
  assert.equal((await store.register('somchai_1', 'another1')).ok, false, 'duplicate id');
  assert.equal((await store.login('somchai_1', 'wrong-pass')).ok, false);
  assert.equal((await store.login('nobody', 'secret12')).msg, (await store.login('somchai_1', 'nope')).msg, 'same message for unknown id and bad password');
  assert.deepEqual(await store.login(' SOMCHAI_1 ', 'secret12'), { ok: true, id: 'somchai_1' });
  // Persisted: a fresh store over the same storage remembers the account and last id.
  const again = new AccountStore(s);
  assert.equal(again.lastId, 'somchai_1');
  assert.equal((await again.login('somchai_1', 'secret12')).ok, true);
  assert.ok(!s.getItem('tno.accounts.v1').includes('secret12'), 'password is never stored');
});

test('registration rules', async () => {
  const store = new AccountStore(memoryStorage());
  assert.equal((await store.register('ab', 'secret12')).ok, false, 'too short');
  assert.equal((await store.register('ชื่อไทย', 'secret12')).ok, false, 'not latin');
  assert.equal((await store.register('guest', 'secret12')).ok, false, 'reserved');
  assert.equal((await store.register('valid_id', '123')).ok, false, `password under ${ACCOUNTS.minPassword}`);
});

test('slots: guest slot 0 is the pre-account save; others are prefixed', () => {
  const s = memoryStorage(), store = new AccountStore(s);
  s.setItem('tno.character.v1', JSON.stringify({ name: 'เก่า', classId: 'muaythai', level: 7 }));
  s.setItem('tno.mali.2/tno.character.v1', JSON.stringify({ name: 'มะลิ', classId: 'herbalist', level: 3 }));
  const guest = store.slots('guest');
  assert.equal(guest.length, ACCOUNTS.slots);
  assert.equal(guest[0].prefix, '');
  assert.equal(guest[0].character.name, 'เก่า');
  assert.equal(guest[1].character, null);
  const mali = store.slots('mali');
  assert.equal(mali[2].character.name, 'มะลิ');
  assert.equal(mali[0].prefix, 'tno.mali.0/');
});

test('deleteSlot removes only that slot', () => {
  const s = memoryStorage(), store = new AccountStore(s);
  for (const k of ['tno.character.v1', 'tno.quests.v1', 'tno.location.v1']) s.setItem(k, '{}');
  for (const k of ['tno.mali.1/tno.character.v1', 'tno.mali.1/tno.quests.v1', 'tno.mali.2/tno.character.v1']) s.setItem(k, '{}');
  s.setItem('tno.accounts.v1', '{"accounts":{},"last":null}');
  store.deleteSlot('mali', 1);
  assert.deepEqual([...s.map.keys()].sort(), ['tno.accounts.v1', 'tno.character.v1', 'tno.location.v1', 'tno.mali.2/tno.character.v1', 'tno.quests.v1']);
  store.deleteSlot('guest', 0);
  assert.deepEqual([...s.map.keys()].sort(), ['tno.accounts.v1', 'tno.mali.2/tno.character.v1']);
});

test('slotStorage prefixes keys with the active slot', () => {
  const s = memoryStorage(), had = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { value: s, configurable: true });
  try {
    SaveSlot.use('tno.mali.1/');
    slotStorage.setItem('tno.quests.v1', '{"a":1}');
    assert.equal(s.getItem('tno.mali.1/tno.quests.v1'), '{"a":1}');
    assert.equal(slotStorage.getItem('tno.quests.v1'), '{"a":1}');
    SaveSlot.use('');
    assert.equal(slotStorage.getItem('tno.quests.v1'), null);
  } finally {
    SaveSlot.use('');
    if (had) Object.defineProperty(globalThis, 'localStorage', had); else delete globalThis.localStorage;
  }
});
