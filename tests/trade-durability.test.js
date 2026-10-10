import test from 'node:test';
import assert from 'node:assert/strict';
import { Character } from '../src/character/Character.js';
import { MemoryStore, PgStore } from '../server/store.js';
import { Accounts } from '../server/accounts.js';
import { SaveQueue } from '../server/save-queue.js';
import { commitTrade } from '../server/trade-service.js';
import { Combatants } from '../server/combatants.js';

const gate = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
async function fixture() {
  const store = new MemoryStore(), accounts = new Accounts(store);
  accounts.writes = new SaveQueue({ retryMs: 1 });
  const states = [];
  for (const [i, account] of ['alice', 'bob'].entries()) {
    await store.createAccount(account, '', '');
    const c = Character.create(`Trader${i}`, 'warrior'); c.gold = 100;
    await store.putSlot(account, 0, { 'tno.character.v1': JSON.stringify(c.toJSON()) });
    states.push({ c, persist: { account, slot: 0, inventoryRevision: 0 }, quests: { json: () => '{}' } });
  }
  const trade = { a: 1, b: 2, offer: { 1: { items: [], gold: 40 }, 2: { items: [], gold: 10 } } };
  const players = states.map(() => ({ map: 'city', x: 0, z: 0, f: 0 }));
  return { store, accounts, states, trade, players };
}

test('trade waits for BOTH earlier saves and locks live state until durable completion', async () => {
  const f = await fixture(), old = gate(), commit = gate();
  f.accounts.writes.run('bob:0', () => old.promise);
  const transfer = f.store.transferTrade.bind(f.store);
  let started = false;
  f.store.transferTrade = async (...args) => { started = true; await commit.promise; return transfer(...args); };
  const task = commitTrade(f.accounts, f.trade, f.states, f.players);
  assert.ok(f.states.every(s => s.tradeBusy));
  assert.equal(commitTrade(f.accounts, f.trade, f.states, f.players), task);
  await new Promise(r => setImmediate(r)); assert.equal(started, false);
  old.resolve(); await new Promise(r => setImmediate(r)); assert.equal(started, true);
  assert.deepEqual(f.states.map(s => s.c.gold), [100, 100]);
  commit.resolve(); assert.equal((await task).ok, true);
  assert.deepEqual(f.states.map(s => s.c.gold), [70, 130]);
  assert.ok(f.states.every(s => !s.tradeBusy && s.persist.inventoryRevision === 1));
});

test('uncertain commit retries receipt once, stale queued snapshot cannot overwrite trade', async () => {
  const f = await fixture(), transfer = f.store.transferTrade.bind(f.store); let calls = 0;
  f.store.transferTrade = async (...args) => { const r = await transfer(...args); if (++calls === 1) throw Error('lost COMMIT response'); return r; };
  const task = commitTrade(f.accounts, f.trade, f.states, f.players);
  const stale = f.accounts.putCharacter('alice', 0, f.states[0].c.toJSON(), '{}', null, { inventoryRevision: 0 });
  const keepAlive = setInterval(() => {}, 10);
  try { assert.equal((await task).replayed, true); assert.equal(await stale, false); }
  finally { clearInterval(keepAlive); }
  assert.equal(calls, 2);
  assert.equal(JSON.parse((await f.store.listSlots('alice'))[0].data['tno.character.v1']).gold, 70);
  assert.equal(f.store.tradeReceipts.size, 1);
});

test('stale participant aborts both writes and receipt rejects altered replay', async () => {
  const f = await fixture();
  const participants = f.states.map((s, i) => ({ ...s.persist, character: s.c.toJSON(), quests: '{}', location: f.players[i] }));
  const stale = structuredClone(participants); stale[1].inventoryRevision = 8;
  assert.equal((await f.store.transferTrade('bad', JSON.stringify(stale), stale)).ok, false);
  assert.equal((await f.store.listSlots('alice'))[0].inventoryRevision, 0);
  assert.equal((await f.store.transferTrade('good', JSON.stringify(participants), participants)).ok, true);
  assert.equal((await f.store.transferTrade('good', 'different', participants)).why, 'request_reused');
  assert.equal((await f.store.transferTrade('good', JSON.stringify(participants), participants)).replayed, true);
});

test('uncertain committed gear and material exchange conserves socket metadata', async () => {
  const f = await fixture(), gear = { id: 'iron_dap', qty: 1, plus: 7, cards: ['card_boar'] };
  f.states[0].c.inventory = [structuredClone(gear), ...Array(23).fill(null)];
  f.states[1].c.inventory = [{ id: 'sacred_ore', qty: 10 }, ...Array(23).fill(null)];
  f.trade.offer[1].items = [structuredClone(gear)];
  f.trade.offer[2].items = [{ id: 'sacred_ore', qty: 4 }];
  const transfer = f.store.transferTrade.bind(f.store); let calls = 0;
  f.store.transferTrade = async (...args) => {
    const result = await transfer(...args);
    if (++calls === 1) throw Error('lost item COMMIT response');
    return result;
  };
  const keepAlive = setInterval(() => {}, 10);
  try { assert.equal((await commitTrade(f.accounts, f.trade, f.states, f.players)).replayed, true); }
  finally { clearInterval(keepAlive); }
  const saved = await Promise.all(['alice', 'bob'].map(async account => JSON.parse((await f.store.listSlots(account))[0].data['tno.character.v1'])));
  const sum = id => saved.reduce((n, c) => n + c.inventory.reduce((qty, s) => qty + (s?.id === id ? s.qty : 0), 0), 0);
  assert.equal(sum('iron_dap'), 1); assert.equal(sum('sacred_ore'), 10);
  assert.equal(saved[0].inventory.find(s => s?.id === 'sacred_ore').qty, 4);
  assert.equal(saved[1].inventory.find(s => s?.id === 'sacred_ore').qty, 6);
  assert.deepEqual(saved[1].inventory.find(s => s?.id === 'iron_dap'), gear);
  assert.deepEqual(f.states[1].c.inventory.find(s => s?.id === 'iron_dap'), gear);
  assert.ok(!f.states[0].c.inventory.some(s => s?.id === 'iron_dap'));
  assert.equal(calls, 2); assert.equal(f.store.tradeReceipts.size, 1);
});

test('overlapping reverse barriers complete without deadlock and serialize later work', async () => {
  const q = new SaveQueue(), events = [];
  await Promise.all([q.runMany(['a', 'b'], () => events.push('first')), q.runMany(['b', 'a'], () => events.push('second')), q.run('a', () => events.push('last'))]);
  assert.deepEqual(events, ['first', 'second', 'last']); await q.wait();
});

test('disconnect retains committed inventory and deferred reward before the final save', async () => {
  const f = await fixture(), cs = new Combatants(), paused = gate();
  f.states.forEach((s, i) => cs.list.set(i + 1, s));
  const transfer = f.store.transferTrade.bind(f.store);
  f.store.transferTrade = async (...args) => { await paused.promise; return transfer(...args); };
  const task = commitTrade(f.accounts, f.trade, f.states, f.players, { reward: (s, { id, k }) => cs.rewardState(s, id, k) });
  cs.reward(1, { gold: 5, exp: 0, drops: [] });
  cs.drop(1);
  const final = task.then(() => f.accounts.putCharacter('alice', 0, f.states[0].c.toJSON(), '{}', null, { inventoryRevision: f.states[0].persist.inventoryRevision }));
  paused.resolve(); await final; await f.accounts.writes.wait();
  assert.equal(f.states[0].c.gold, 75);
  assert.equal(JSON.parse((await f.store.listSlots('alice'))[0].data['tno.character.v1']).gold, 75);
});

test('pending trade freezes regen, aid, damage and inventory operations and defers rewards', async () => {
  const f = await fixture(), cs = new Combatants();
  const s = f.states[0]; s.tradeBusy = true; s.c.hp = 10; s.fightAt = -Infinity;
  cs.list.set(1, s);
  assert.equal(cs.aid(1, { hp: 100 }), null);
  assert.equal(cs.swing(1, { atk: 100, level: 1 }), null);
  assert.equal(cs.op(1, { op: 'sort' }), false);
  cs.tick(10, false); assert.equal(s.c.hp, 10);
  assert.equal(cs.reward(1, { gold: 5 }).deferred, true);
  assert.equal(s.c.gold, 100); assert.equal(s.tradeRewards.length, 1);
});

test('pending trade freezes world boss percent damage, death and cast state', async () => {
  const f = await fixture(), cs = new Combatants();
  const s = f.states[0]; s.tradeBusy = true; s.c.hp = 10; s.c.sitting = true; s.fightAt = -Infinity;
  cs.list.set(1, s);
  assert.equal(cs.pctHit(1, 1), null);
  cs.touch(1); cs.fall(1);
  assert.equal(s.c.hp, 10); assert.equal(s.c.alive, true);
  assert.equal(s.c.sitting, true); assert.equal(s.fightAt, -Infinity);
  assert.deepEqual(cs.cast(1, 'not_learnt'), { ok: false, why: 'trade_busy' });
  assert.equal(s.dirty, undefined);
  s.tradeBusy = false;
  assert.equal(cs.pctHit(1, 1).dead, true);
});

test('PostgreSQL rolls back both character writes when the second update fails', async () => {
  const f = await fixture(), queries = [], participants = f.states.map((s, i) => ({ ...s.persist, character: s.c.toJSON(), quests: '{}', location: f.players[i] }));
  let updates = 0;
  const client = { release() {}, async query(sql) {
    queries.push(sql);
    if (sql.startsWith('select data')) return { rows: [{ data: { 'tno.character.v1': JSON.stringify(participants[queries.filter(q => q.startsWith('select data')).length - 1].character) }, inventoryRevision: 0 }] };
    if (sql.startsWith('update characters') && ++updates === 2) throw Error('write failed');
    return { rows: [] };
  } };
  const store = new PgStore({ connect: async () => client });
  await assert.rejects(store.transferTrade('request', 'fp', participants), /write failed/);
  assert.equal(queries.at(-1), 'rollback'); assert.ok(!queries.includes('commit'));
});
