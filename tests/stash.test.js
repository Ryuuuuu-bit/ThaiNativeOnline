import test from 'node:test';
import assert from 'node:assert/strict';
import { Character } from '../src/character/Character.js';
import { ITEMS } from '../src/character/data/items.js';
import { cleanStashMove, emptyStash, planStashMove, stashIdentity } from '../src/data/stash.js';
import { WARP_SERVICES } from '../src/data/warpServices.js';
import { MemoryStore, PgStore } from '../server/store.js';
import { Accounts } from '../server/accounts.js';
import { StashService, stashWhy } from '../server/stash.js';

const keeper = WARP_SERVICES.find(s => s.map === 'city');
const json = bag => {
  const c = Character.create('VaultHero', 'warrior');
  c.inventory = [...bag, ...Array(24 - bag.length).fill(null)]; c.saveLoadout(0, 'preserved');
  return c.toJSON();
};
const deposit = (s, extra = {}) => ({ npc: keeper.npcId, request: 'request_001', revision: 0, action: 'deposit', index: 0, qty: s.qty, expected: stashIdentity(s), ...extra });
let nextUid = 0;
const uid = () => `entry_${String(++nextUid).padStart(8, '0')}`;
async function fixture(bag = [{ id: 'sacred_ore', qty: 10 }], slot = 0, store = new MemoryStore(), accounts = new Accounts(store)) {
  if (!await store.getAccount('vault')) await store.createAccount('vault', 'test', 'test');
  const character = json(bag);
  await store.putSlot('vault', slot, { 'tno.character.v1': JSON.stringify({ ...character, name: `VaultHero${slot}` }), 'tno.quests.v1': '{}' });
  await accounts.character('vault', slot);
  const state = { c: new Character(character), quests: { json: () => '{}' }, persist: { account: 'vault', slot, inventoryRevision: 0 } };
  const p = { account: 'vault', map: 'city', x: keeper.x, z: keeper.z, f: 0 };
  return { store, accounts, state, p, service: new StashService(accounts) };
}

test('only signed-in alive players near one of six city counters with clear navigation use the vault', async () => {
  const { p, state } = await fixture();
  for (const counter of WARP_SERVICES.filter(s => s.map === 'city')) assert.equal(stashWhy({ ...p, x: counter.x, z: counter.z }, state, counter.npcId), null);
  assert.equal(stashWhy(p, { ...state, persist: null }, keeper.npcId), 'offline');
  assert.equal(stashWhy({ ...p, account: 'other' }, state, keeper.npcId), 'offline');
  assert.equal(stashWhy(p, state, '__proto__'), 'npc');
  assert.equal(stashWhy(p, state, WARP_SERVICES.find(s => s.map !== 'city').npcId), 'npc');
  assert.equal(stashWhy({ ...p, map: 'paddy' }, state, keeper.npcId), 'map');
  assert.equal(stashWhy({ ...p, x: p.x + 5.001 }, state, keeper.npcId), 'far');
  assert.equal(stashWhy({ ...p, x: NaN }, state, keeper.npcId), 'far');
  assert.equal(stashWhy({ ...p, dead: true }, state, keeper.npcId), 'dead');
  for (const key of ['fighting', 'duel', 'trade']) assert.equal(stashWhy(p, state, keeper.npcId, { [key]: true }), 'busy');
  assert.equal(stashWhy(p, { ...state, stashBusy: true }, keeper.npcId), 'busy');
  assert.equal(stashWhy(p, state, keeper.npcId, { navigate: () => ({ clear: () => false }) }), 'blocked');
});

test('malformed quantities, indices, revisions, request IDs and identities fail closed', () => {
  const m = deposit({ id: 'sacred_ore', qty: 2 });
  for (const patch of [{ request: '' }, { request: {} }, { revision: -1 }, { revision: '0' }, { action: 'delete' }, { qty: 0 }, { qty: .5 }, { qty: 1e30 }, { index: -1 }, { index: '0' }, { expected: { id: 'constructor' } }, { expected: { id: 'sacred_ore', locked: 'true' } }]) assert.equal(cleanStashMove({ ...m, ...patch }), null, JSON.stringify(patch));
  assert.deepEqual(cleanStashMove({ ...m, map: 'city', account: 'other', inventory: [{ id: 'potion_s', qty: 999 }] }), cleanStashMove(m));
});

test('partial stack deposits and fixed-UID withdrawals conserve items and preserve matching lock state', () => {
  const c = json([{ id: 'sacred_ore', qty: 10, locked: true }, { id: 'sacred_ore', qty: 3 }]), before = structuredClone(c);
  let result = planStashMove(c, emptyStash(), cleanStashMove(deposit(c.inventory[0], { qty: 4 })), uid);
  assert.equal(result.ok, true); assert.equal(result.inventory[0].qty, 6); assert.equal(result.stash.slots[0].locked, true);
  assert.deepEqual(c, before, 'pure plan never changes source');
  const key = result.stash.slots[0].uid;
  result = planStashMove({ ...c, inventory: result.inventory }, result.stash, { action: 'withdraw', revision: 1, uid: key, qty: 2 }, uid);
  assert.equal(result.inventory[0].qty, 8); assert.equal(result.inventory[1].qty, 3); assert.equal(result.stash.slots[0].qty, 2);
  assert.equal(result.stash.slots[0].uid, key, 'partial transfer retains storage ID');
});

test('gear keeps cards, refinement and locked metadata, always occupies its own slot', () => {
  const gear = { id: 'iron_dap', qty: 1, plus: 7, cards: ['card_boar'], locked: true };
  const c = json([gear, { ...gear, locked: false }]);
  const a = planStashMove(c, emptyStash(), cleanStashMove(deposit(gear)), uid);
  const b = planStashMove({ ...c, inventory: a.inventory }, a.stash, cleanStashMove(deposit(c.inventory[1], { index: 1, request: 'request_002', revision: 1 })), uid);
  assert.equal(b.stash.slots.filter(Boolean).length, 2);
  const back = planStashMove({ ...c, inventory: b.inventory }, b.stash, { action: 'withdraw', revision: 2, uid: b.stash.slots[0].uid, qty: 1 }, uid);
  assert.deepEqual(back.inventory[0], gear); assert.deepEqual(back.inventory[1], null);
  assert.equal(planStashMove(c, emptyStash(), cleanStashMove(deposit(gear, { expected: { ...stashIdentity(gear), plus: 6 } })), uid).why, 'item_changed');
});

test('deposit all is all-or-nothing, material-only, excludes locked materials and merges into a full vault when possible', () => {
  const c = json([{ id: 'sacred_ore', qty: 4 }, { id: 'gold_leaf', qty: 3, locked: true }, { id: 'potion_s', qty: 2 }]);
  const move = { revision: 0, action: 'deposit_materials' }, r = planStashMove(c, emptyStash(), move, uid);
  assert.equal(r.moved, 4); assert.equal(r.inventory[0], null); assert.deepEqual(r.inventory.slice(1, 3), c.inventory.slice(1, 3));
  const full = { revision: 0, slots: Array.from({ length: 120 }, (_, i) => ({ id: 'iron_dap', qty: 1, uid: `entry_full_${i}` })) };
  assert.equal(planStashMove(c, full, move, uid).why, 'stash_full');
  full.slots[0] = { id: 'sacred_ore', qty: 1, uid: 'entry_existing' };
  const merged = planStashMove(c, full, move, uid); assert.equal(merged.ok, true); assert.equal(merged.stash.slots[0].qty, 5);
  const two = json([{ id: 'sacred_ore', qty: 4 }, { id: 'gold_leaf', qty: 3 }]);
  assert.equal(planStashMove(two, full, move, uid).why, 'stash_full');
  assert.equal(full.slots[0].qty, 1); assert.equal(two.inventory[0].qty, 4);
});

test('withdraw checks bag slots, weight and whole gear quantities without partial grants', () => {
  const full = json(Array.from({ length: 24 }, () => ({ id: 'iron_dap', qty: 1 })));
  const heavyId = Object.keys(ITEMS).find(id => ITEMS[id].type === 'material' && ITEMS[id].weight > 0);
  const vault = { revision: 0, slots: [{ id: heavyId, qty: 100000, uid: 'entry_potion' }, ...Array(119).fill(null)] };
  const m = { revision: 0, action: 'withdraw', uid: 'entry_potion', qty: 1 };
  assert.equal(planStashMove(full, vault, m, uid).why, 'bag_full');
  assert.equal(planStashMove(json([]), vault, { ...m, qty: 100000 }, uid).why, 'overweight');
  assert.equal(planStashMove(json([]), vault, { ...m, qty: 100001 }, uid).why, 'quantity');
  assert.equal(vault.slots[0].qty, 100000);
});

test('atomic memory transfer preserves other save fields; same-ID retry and changed-ID payload are safe', async () => {
  const h = await fixture(), m = deposit(h.state.c.inventory[0]);
  const r = await h.service.move(h.p, h.state, m); assert.equal(r.ok, true);
  const stored = await h.accounts.character('vault', 0);
  assert.equal(stored.inventory[0], null); assert.deepEqual(stored.loadouts, json([]).loadouts);
  assert.equal(h.state.persist.inventoryRevision, 1);
  assert.equal((await h.service.move(h.p, h.state, m)).replayed, true);
  assert.equal((await h.store.getStash('vault')).slots[0].qty, 10);
  assert.equal((await h.service.move(h.p, h.state, { ...m, qty: 1 })).why, 'request_reused');
  assert.equal((await h.service.move(h.p, h.state, { ...m, request: 'request_new' })).why, 'stale');
});

test('concurrent characters share a serialized vault revision and cannot both withdraw one item', async () => {
  const a = await fixture(), b = await fixture([], 1, a.store, new Accounts(a.store));
  await a.service.move(a.p, a.state, deposit(a.state.c.inventory[0]));
  const vault = await a.store.getStash('vault'), uid = vault.slots[0].uid;
  const move = { npc: keeper.npcId, action: 'withdraw', uid, qty: 10, revision: 1 };
  const results = await Promise.all([a.service.move(a.p, a.state, { ...move, request: 'withdraw_A' }), b.service.move(b.p, b.state, { ...move, request: 'withdraw_B' })]);
  assert.equal(results.filter(r => r.ok).length, 1); assert.equal(results.find(r => !r.ok).why, 'stale');
  assert.equal((await a.store.getStash('vault')).slots.filter(Boolean).length, 0);
  assert.equal([a, b].reduce((n, h) => n + h.state.c.count('sacred_ore'), 0), 10);
});

test('pre-transfer snapshots and HTTP live saves queued after transfer cannot restore deposited items', async () => {
  const h = await fixture(), before = h.state.c.toJSON();
  const transfer = h.service.move(h.p, h.state, deposit(before.inventory[0]));
  const flush = h.accounts.putCharacter('vault', 0, before, '{}', null, { inventoryRevision: 0 });
  const api = h.accounts.save('vault', 0, { 'tno.character.v1': JSON.stringify(before) }, { c: before, quests: '{}', inventoryRevision: 0 });
  assert.equal((await transfer).ok, true); assert.equal(await flush, false); assert.equal((await api).code, 'stale_save');
  assert.equal((await h.accounts.character('vault', 0)).inventory[0], null);
  assert.equal((await h.store.getStash('vault')).slots[0].qty, 10);
  assert.equal(await h.accounts.putCharacter('vault', 0, h.state.c.toJSON(), '{}', null, { inventoryRevision: 1 }), true);
});

test('uncertain committed response retries the same receipt and adopts exactly once', async () => {
  const h = await fixture(); h.accounts.writes.retryMs = 5;
  const transfer = h.store.transferStash.bind(h.store); let attempts = 0;
  h.store.transferStash = async (...args) => { const r = await transfer(...args); if (++attempts === 1) throw Error('commit response lost'); return r; };
  const pending = h.service.move(h.p, h.state, deposit(h.state.c.inventory[0]));
  await h.accounts.writes.wait(null, 2000); const r = await pending;
  assert.equal(r.ok, true); assert.equal(r.replayed, true); assert.equal(attempts, 2);
  assert.equal(h.state.c.inventory[0], null); assert.equal(h.state.persist.inventoryRevision, 1);
  assert.equal((await h.store.getStash('vault')).slots[0].qty, 10); assert.equal(h.state.stashBusy, false);
});

test('foreign account vault and request IDs remain isolated', async () => {
  const h = await fixture(); await h.service.move(h.p, h.state, deposit(h.state.c.inventory[0]));
  assert.deepEqual(await h.store.getStash('another'), emptyStash());
  assert.equal((await h.service.move({ ...h.p, account: 'another' }, h.state, deposit({ id: 'sacred_ore', qty: 10 }))).why, 'offline');
});

test('Postgres locks account and character and uses one connection for bag, vault and receipt; failures roll back', async () => {
  const character = json([{ id: 'sacred_ore', qty: 10 }]), row = { data: { 'tno.character.v1': JSON.stringify(character) }, inventoryRevision: '0' };
  for (const fail of [false, true]) {
    const calls = [], client = { async query(sql, args) {
      calls.push({ sql, args });
      if (sql.startsWith('select data')) return { rows: [row] };
      if (fail && sql.startsWith('insert into account_stashes')) throw Error('disk failure');
      return { rows: [], rowCount: 1 };
    }, release() { calls.push({ sql: 'release' }); } };
    const store = new PgStore({ connect: async () => client, query() { throw Error('must use transaction client'); } });
    const move = cleanStashMove(deposit(character.inventory[0])), snapshot = { character, inventoryRevision: 0, quests: '{}', location: { map: 'city', x: 0, z: 0 } };
    const operation = store.transferStash('vault', 0, move, 'fingerprint', snapshot, (s, v) => planStashMove(s.character, v, move, uid));
    if (fail) await assert.rejects(operation, /disk failure/); else assert.equal((await operation).ok, true);
    assert.equal(calls[0].sql, 'begin'); assert.match(calls[1].sql, /accounts.*for update/); assert.match(calls[2].sql, /characters.*for update/);
    assert.equal(calls.at(-2).sql, fail ? 'rollback' : 'commit'); assert.equal(calls.at(-1).sql, 'release');
    if (!fail) assert.deepEqual(calls.filter(c => /^(update characters|insert into)/.test(c.sql)).map(c => c.sql.split(' ')[2]), ['set', 'account_stashes', 'stash_receipts']);
  }
});
