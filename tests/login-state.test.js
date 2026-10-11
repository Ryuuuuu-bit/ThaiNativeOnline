import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LoginQueue, loginPosition, waitForLoginSave } from '../server/login-state.js';
import { Accounts } from '../server/accounts.js';
import { MemoryStore } from '../server/store.js';
import { MAPS } from '../src/world/maps.js';

const navigation = () => ({ canStand: (x, z) => x !== 999 && Number.isFinite(x) && Number.isFinite(z) });
test('authenticated login takes stored coordinates/facing; invalid or blocked rows use safe spawn', () => {
  assert.deepEqual(loginPosition({ map: 'paddy', x: 4, z: -130, facing: 1 }, navigation), { map: 'paddy', x: 4, z: -130, f: 1 });
  for (const saved of [null, {}, { map: 'constructor', x: 0, z: 52 }, { map: 'unknown', x: 0, z: 52 }, { map: 'paddy', x: NaN, z: 1 }]) {
    assert.deepEqual(loginPosition(saved, navigation), { map: 'city', x: MAPS.city.spawn.x, z: MAPS.city.spawn.z, f: MAPS.city.spawn.facing });
  }
  assert.deepEqual(loginPosition({ map: 'paddy', x: 999, z: -130 }, navigation), { map: 'paddy', x: MAPS.paddy.spawn.x, z: MAPS.paddy.spawn.z, f: MAPS.paddy.spawn.facing });
  assert.equal(loginPosition({ map: 'fields', x: 4, z: -130 }, navigation).map, 'paddy');
});

test('one stored row supplies coherent character, quests, position and incarnation metadata', async () => {
  const store = new MemoryStore(), accounts = new Accounts(store);
  const data = { 'tno.character.v1': JSON.stringify({ name: 'LoginQA', classId: 'warrior' }),
    'tno.location.v3': JSON.stringify({ map: 'city', x: -6, z: 52, facing: 1 }), 'tno.quests.v1': '{}' };
  assert.ok((await accounts.save('loginaudit', 0, data)).ok);
  const state = await accounts.joinState('loginaudit', 0);
  assert.equal(state.character.name, 'LoginQA');
  assert.deepEqual(state.location, { map: 'city', x: -6, z: 52, facing: 1 });
  assert.equal(state.characterUid, accounts.characterUid('loginaudit', 0));
  assert.equal(state.inventoryRevision, accounts.inventoryRevision('loginaudit', 0));
  assert.equal(state.quests, '{}');
  const row = (await store.listSlots('loginaudit'))[0];
  await store.putSlot('loginaudit', 0, { ...row.data, 'tno.location.v1': '{broken' }, { characterUid: row.characterUid });
  assert.equal((await accounts.joinState('loginaudit', 0)).location, null, 'bad canonical location does not adopt a competing legacy key');
  assert.equal(await accounts.joinState('loginaudit', 1), null);
});

test('same-slot logins serialize final-save/read/adoption; other accounts continue independently', async () => {
  const queue = new LoginQueue(), events = [];
  let release;
  const hold = new Promise(r => { release = r; });
  const first = queue.run('one:0', async () => { events.push('first'); await hold; events.push('saved'); });
  const second = queue.run('one:0', () => { events.push('second'); });
  await queue.run('two:0', () => { events.push('other'); });
  assert.deepEqual(events, ['first', 'other']);
  release(); await Promise.all([first, second]);
  assert.deepEqual(events, ['first', 'other', 'saved', 'second']);
  await queue.run('one:0', () => { throw Error('read failed'); }).catch(() => {});
  await queue.run('one:0', () => { events.push('recovered'); });
  await Promise.resolve();
  assert.equal(events.at(-1), 'recovered');
  assert.equal(queue.pending.size, 0);
});

test('login final-save wait fails closed on a stalled transaction and clears its timer', async () => {
  await waitForLoginSave(Promise.resolve());
  await assert.rejects(waitForLoginSave(new Promise(() => {}), 5), /Login save timeout/);
  await assert.rejects(waitForLoginSave(Promise.reject(Error('storage unavailable'))), /storage unavailable/);
});
