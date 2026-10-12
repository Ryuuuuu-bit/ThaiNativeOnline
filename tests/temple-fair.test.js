import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { TempleFairService, FAIR_REQUEST_LIMIT, FAIR_MESSAGE_LIMIT } from '../server/temple-fair.js';
import { FAIR_LIMITS, DICE_SYMBOLS, targetAt } from '../src/fair/fairRules.js';
import { FAIR_SITES, FAIR_RANGE } from '../src/fair/fairSites.js';
import { Character } from '../src/character/Character.js';
import { Accounts } from '../server/accounts.js';
import { MemoryStore } from '../server/store.js';
import { SaveQueue } from '../server/save-queue.js';
import { Combatants } from '../server/combatants.js';
import { navigation } from '../server/navigation.js';

const gate = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const tick = () => new Promise(r => setImmediate(r));
async function fixture({ gold = 1000, faces = [0, 1, 2], reward } = {}) {
  const store = new MemoryStore(), accounts = new Accounts(store);
  accounts.writes = new SaveQueue({ retryMs: 1, maxRetryMs: 2 });
  await store.createAccount('fair', '', '');
  const c = Character.create('FairPlayer', 'warrior'); c.gold = gold;
  await store.putSlot('fair', 0, { 'tno.character.v1': JSON.stringify(c.toJSON()) });
  const saved = await accounts.joinState('fair', 0);
  const s = { c, quests: { json: () => '{"fair":"preserved"}' }, fightAt: -Infinity,
    persist: { account: 'fair', slot: 0, characterUid: saved.characterUid, inventoryRevision: 0 } };
  const p = { id: 1, account: 'fair', map: 'city', ch: 1, room: 'city:1', f: 0,
    ...FAIR_SITES.find(site => site.id === 'dice').approach };
  let time = 100000, draws = 0;
  const service = new TempleFairService(accounts, { now: () => time, reward,
    randomInt: max => max === 6 ? faces[draws++ % faces.length] : 12345 });
  const context = { hour: 17, fighting: false, duel: false, trade: false,
    navigate: () => ({ canStand: () => true, clear: () => true }) };
  const f = { store, accounts, s, p, service, context, get draws() { return draws; },
    advance: (ms = FAIR_LIMITS.shotIntervalMs) => { time += ms; },
    send: (message, state = s, player = p) => service.handle(player, state,
      { t: 'fair', request: randomUUID(), ...message }, context),
    start: (game = 'dice', extra = {}) => {
      Object.assign(p, FAIR_SITES.find(site => site.id === game).approach);
      return f.send({ action: 'start', game, stake: 20, ...(game === 'dice' ? { symbol: 'gourd' } : {}), ...extra });
    },
    saved: async () => JSON.parse((await store.listSlots('fair'))[0].data['tno.character.v1']),
  };
  return f;
}

async function shoot(f, round, hit = false, extra = {}) {
  const target = targetAt(round.game,
    round.seed, round.shots, round.elapsedMs + FAIR_LIMITS.shotIntervalMs);
  f.advance();
  return f.send({ action: 'shot', round: round.id,
    x: hit ? target.x : 0, y: hit ? target.y : 0, ...extra });
}

test('skill start, cancellation, expiry and process restart never debit gold', async () => {
  const f = await fixture();
  let start = await f.start('balloons');
  assert.equal(start.ok, true); assert.equal(f.s.c.gold, 1000);
  assert.equal((await f.send({ action: 'cancel', round: start.round.id })).ok, true);
  f.advance(3000); start = await f.start('dolls');
  f.advance(FAIR_LIMITS.roundMs);
  assert.equal((await f.send({ action: 'shot', round: start.round.id, x: 0, y: 0 })).why, 'round_missing');
  start = await f.start('balloons');
  const restarted = new TempleFairService(f.accounts);
  const r = await restarted.handle(f.p, f.s, { t: 'fair', request: randomUUID(), action: 'shot', round: start.round.id, x: 0, y: 0 }, f.context);
  assert.equal(r.why, 'round_missing'); assert.equal((await f.saved()).gold, 1000);
  assert.equal(f.store.tradeReceipts, undefined);
});

test('five server-judged hits refund at most the stake for both skill games', async () => {
  for (const game of ['balloons', 'dolls']) {
    const f = await fixture(); let { round } = await f.start(game, { stake: 100 });
    for (let i = 0; i < 5; i++) {
      const response = await shoot(f, round, true);
      assert.equal(response.ok, true);
      if (i < 4) { round = response.round; assert.equal(f.s.c.gold, 1000); }
      else {
        assert.equal(response.result.hits, 5); assert.equal(response.result.gross, 100);
        assert.equal(response.result.net, 0); assert.equal(response.round, null);
      }
    }
    assert.equal((await f.saved()).gold, 1000);
    assert.equal(f.s.persist.inventoryRevision, 1);
    assert.equal(f.store.tradeReceipts.size, 1);
  }
});

test('every skill score/tier charges exactly the published nonnegative completion fee', async () => {
  for (const stake of [20, 50, 100]) for (let hits = 0; hits <= 5; hits++) {
    const f = await fixture(); let { round } = await f.start('balloons', { stake });
    for (let i = 0; i < 5; i++) {
      const r = await shoot(f, round, i < hits); round = r.round;
      if (i === 4) {
        const refund = Math.floor(stake * [0, 0, 25, 50, 75, 100][hits] / 100);
        assert.equal(r.result.hits, hits); assert.equal(r.result.gross, refund);
        assert.equal(r.result.net, refund - stake);
        assert.equal((await f.saved()).gold, 1000 - stake + refund);
      }
    }
  }
});

test('moving targets are judged at server receipt time despite forged client elapsed time', async () => {
  const f = await fixture(); const { round } = await f.start('dolls');
  const old = targetAt('dolls', round.seed, 0, 0);
  f.advance(1100);
  const current = targetAt('dolls', round.seed, 0, 1100);
  assert.ok(Math.hypot(old.x - current.x, old.y - current.y) > current.radius);
  const r = await f.send({ action: 'shot', round: round.id, x: old.x, y: old.y,
    elapsedMs: 0, seed: round.seed, hit: true });
  assert.equal(r.round.shots, 1); assert.equal(r.round.hits, 0);
  assert.equal(r.round.elapsedMs, 1100);
});

test('forged scores, payout, target, sequence and elapsed time cannot create hits', async () => {
  const f = await fixture(); let { round } = await f.start('dolls');
  for (let i = 0; i < 5; i++) {
    const response = await shoot(f, round, false, { hits: 5, score: 999, gross: 99999,
      hit: true, targetId: 0, shotIndex: 0, elapsedMs: 0, time: 0 });
    assert.equal(response.ok, true);
    if (i < 4) round = response.round;
    else { assert.equal(response.result.hits, 0); assert.equal(response.result.net, -20); }
  }
  assert.equal((await f.saved()).gold, 980);
});

test('shot cadence, finite normalized aim and five-shot budget are enforced', async () => {
  const f = await fixture(); const { round } = await f.start('balloons');
  for (const [x, y] of [[NaN, 0], [Infinity, 0], [0, -Infinity], [-.01, 0], [0, 1.01], ['.5', .5], [null, .5]])
    assert.equal((await f.send({ action: 'shot', round: round.id, x, y })).why, 'bad_aim');
  const first = await f.send({ action: 'shot', round: round.id, x: 0, y: 0 });
  assert.equal(first.round.shots, 1);
  assert.equal((await f.send({ action: 'shot', round: round.id, x: 0, y: 0 })).why, 'shot_rate');
  let current = first.round;
  for (let i = 1; i < 5; i++) current = (await shoot(f, current)).round;
  assert.equal((await f.send({ action: 'shot', round: round.id, x: 0, y: 0 })).why, 'round_missing');
  assert.equal(f.store.tradeReceipts.size, 1);
});

test('admission follows evening/night boundaries, while admitted rounds may finish after close', async () => {
  const f = await fixture();
  for (const hour of [5, 12, 16.499, 24, -1, NaN, undefined]) {
    f.context.hour = hour;
    assert.equal((await f.start()).why, 'closed');
  }
  for (const hour of [16.5, 19.5, 23.99, 0, 4.999]) {
    f.context.hour = hour; f.advance(3000);
    assert.equal((await f.start()).ok, true);
  }
  f.advance(3000); let { round } = await f.start('balloons'); f.context.hour = 5;
  for (let i = 0; i < 5; i++) {
    const r = await shoot(f, round); assert.equal(r.ok, true); round = r.round;
  }
});

test('authorization requires matching account, loaded incarnation and live persisted state', async () => {
  const f = await fixture(), message = { action: 'start', game: 'dice', stake: 20, symbol: 'gourd' };
  assert.equal((await f.send(message, { c: f.s.c })).why, 'auth');
  assert.equal((await f.send(message, f.s, { ...f.p, account: 'other' })).why, 'auth');
  assert.equal((await f.send(message, { ...f.s, persist: { ...f.s.persist, characterUid: 'stale' } })).why, 'auth');
  assert.equal((await f.send(message, { ...f.s, persist: { ...f.s.persist, slot: -1 } })).why, 'auth');
  assert.equal(f.draws, 0);
});

test('city proximity, player standing and unobstructed approach are all authoritative', async () => {
  const f = await fixture(), message = { action: 'start', game: 'dice', stake: 20, symbol: 'gourd' };
  for (const patch of [{ map: 'field' }, { x: NaN }, { x: Infinity }, { x: f.p.x + FAIR_RANGE + .01 }])
    assert.equal((await f.send(message, f.s, { ...f.p, ...patch })).why, 'range');
  f.context.navigate = () => ({ canStand: () => false, clear: () => true });
  assert.equal((await f.send(message)).why, 'blocked');
  f.context.navigate = () => ({ canStand: () => true, clear: () => false });
  assert.equal((await f.send(message)).why, 'blocked');
  f.context.navigate = () => null;
  assert.equal((await f.send(message)).why, 'blocked');
  f.context.navigate = navigation;
  assert.equal((await f.send(message)).ok, true);
});

test('dead, fighting, duel, trade and stash states cannot play', async () => {
  const f = await fixture();
  for (const key of ['fighting', 'duel', 'trade']) {
    f.context[key] = true; assert.equal((await f.start()).why, 'busy'); f.context[key] = false;
  }
  for (const key of ['tradeBusy', 'stashBusy']) {
    f.s[key] = true; assert.equal((await f.start()).why, 'busy'); f.s[key] = false;
  }
  f.p.dead = true; assert.equal((await f.start()).why, 'dead'); f.p.dead = false;
  f.s.c.hp = 0; assert.equal((await f.start()).why, 'dead');
  assert.equal(f.draws, 0);
});

test('interrupted skill rounds are discarded on range, activity and room changes', async () => {
  for (const interrupt of [f => { f.p.x += 20; }, f => { f.context.duel = true; },
    f => { f.p.ch = 2; }, f => { f.p.room = 'city:2'; }, f => { f.s.c.hp = 0; }]) {
    const f = await fixture(); const { round } = await f.start('balloons'); interrupt(f);
    assert.equal((await f.send({ action: 'shot', round: round.id, x: 0, y: 0 })).ok, false);
    assert.equal(f.s.c.gold, 1000); assert.equal(f.store.tradeReceipts, undefined);
    assert.equal((await f.send({ action: 'status' })).round, null);
  }
});

test('stakes, symbols, game, action, request and round UUIDs reject malformed values', async () => {
  const f = await fixture();
  for (const stake of [0, -20, 19, 20.1, 1_000_001, 1e12, '20', NaN, Infinity, null])
    assert.equal((await f.start('dice', { stake })).why, 'bad_stake');
  f.advance(1000);
  for (const symbol of [-1, 6, .5, '0', NaN, null, undefined])
    assert.equal((await f.start('dice', { symbol })).why, 'bad_symbol');
  assert.equal((await f.send({ action: 'start', game: '__proto__', stake: 20 })).why, 'bad_game');
  assert.equal((await f.send({ action: 'payout' })).why, 'bad_action');
  assert.equal((await f.send({ action: 'status', request: 'x' })).why, 'bad_request');
  assert.equal((await f.send({ action: 'shot', round: 'x', x: 0, y: 0 })).why, 'bad_round');
  assert.equal(f.draws, 0);
});

test('all 216 dice rolls follow published returns with no dynamic odds', async () => {
  const faces = [];
  for (let a = 0; a < 6; a++) for (let b = 0; b < 6; b++) for (let c = 0; c < 6; c++) faces.push(a, b, c);
  const f = await fixture({ faces, gold: 100000 }); let total = 0;
  const counts = [0, 0, 0, 0];
  for (let i = 0; i < 216; i++) {
    f.advance(3000); const response = await f.start('dice', { stake: 100 });
    assert.equal(response.ok, true);
    const rolled = faces.slice(i * 3, i * 3 + 3), matches = rolled.filter(x => x === 0).length;
    const gross = matches ? (matches + 1) * 100 : 0;
    assert.deepEqual(response.result.faces, rolled.map(n => DICE_SYMBOLS[n])); assert.equal(response.result.gross, gross);
    counts[matches]++; total += gross;
  }
  assert.deepEqual(counts, [125, 75, 15, 1]); assert.equal(total, 19900);
  assert.equal(f.draws, 648); assert.equal(f.s.c.gold, 100000 + 19900 - 21600);
  assert.equal((await f.saved()).gold, f.s.c.gold);
});

test('duplicate dice request replays immutable result without reroll, even after close', async () => {
  const f = await fixture(), request = randomUUID();
  const original = await f.start('dice', { request });
  const expected = structuredClone(original); original.result.faces[0] = 99;
  f.context.hour = 12; f.advance(3000);
  const replay = await f.start('dice', { request });
  assert.deepEqual(replay, expected); assert.equal(f.draws, 3);
  assert.equal(f.store.tradeReceipts.size, 1);
  assert.equal((await f.start('dice', { request, stake: 50 })).why, 'request_reused');
});

test('status recovers current round or completed result without creating a paid action', async () => {
  const f = await fixture(); const dice = await f.start();
  const status = await f.send({ action: 'status' });
  assert.equal(status.round, null); assert.deepEqual(status.result, dice.result);
  status.result.faces[0] = 'forged';
  assert.deepEqual((await f.send({ action: 'status' })).result, dice.result);
  f.advance(3000); const start = await f.start('dolls'); f.advance(1000);
  const active = await f.send({ action: 'status' });
  assert.equal(active.result, null); assert.equal(active.round.id, start.round.id);
  assert.equal(active.round.elapsedMs, 1000); assert.equal(active.round.shotIndex, 0);
  assert.equal(active.round.shotsRemaining, 5); assert.equal(f.draws, 3);
  assert.equal(f.store.tradeReceipts.size, 1);
});

test('duplicate shots consume one budget unit and final duplicate charges exactly once', async () => {
  const f = await fixture(); let { round } = await f.start('balloons');
  for (let i = 0; i < 5; i++) {
    const request = randomUUID(), id = round.id;
    const first = await shoot(f, round, false, { request });
    const duplicate = await f.send({ action: 'shot', round: id, x: 0, y: 0, request });
    assert.deepEqual(duplicate, first); round = first.round;
  }
  assert.equal(f.s.c.gold, 980); assert.equal(f.store.tradeReceipts.size, 1);
});

test('state object identity prevents recycled socket IDs or changed incarnations from taking rounds', async () => {
  const f = await fixture(); const { round } = await f.start('dolls');
  const replacement = { ...f.s, persist: { ...f.s.persist } };
  assert.equal((await f.send({ action: 'shot', round: round.id, x: 0, y: 0 }, replacement)).why, 'round_missing');
  const original = f.s.persist.characterUid;
  f.s.persist.characterUid = 'replacement'; f.accounts.characterUids.set('fair:0', 'replacement');
  assert.equal((await f.send({ action: 'status' })).why, 'character_stale');
  f.s.persist.characterUid = original;
});

test('one live round and round cooldown prevent repeated starts', async () => {
  const f = await fixture(); const { round } = await f.start('balloons');
  assert.equal((await f.start('balloons')).why, 'round_active');
  await f.send({ action: 'cancel', round: round.id });
  assert.equal((await f.start('balloons')).why, 'cooldown');
  f.advance(3000); assert.equal((await f.start('dice')).ok, true);
  assert.equal((await f.start('dice')).why, 'cooldown');
});

test('simultaneous duplicates share settlement and other requests/states see busy', async () => {
  const f = await fixture(), hold = gate(), request = randomUUID();
  const transfer = f.store.transferTrade.bind(f.store);
  f.store.transferTrade = async (...args) => { await hold.promise; return transfer(...args); };
  const first = f.start('dice', { request });
  assert.equal(f.s.tradeBusy, true); assert.ok(f.s.tradeTask instanceof Promise);
  const duplicate = f.start('dice', { request });
  assert.equal((await f.start()).why, 'busy');
  const replacement = { ...f.s, tradeBusy: false, persist: { ...f.s.persist } };
  assert.equal((await f.send({ action: 'start', game: 'dice', stake: 20, symbol: 'gourd' }, replacement)).why, 'busy');
  hold.resolve(); assert.deepEqual(await duplicate, await first);
  assert.equal(f.draws, 3); assert.equal(f.store.tradeReceipts.size, 1); assert.equal(f.s.tradeBusy, false);
});

test('pending FIFO captures after earlier writes and adoption precedes reward flush and final save', async () => {
  const cs = new Combatants(), f = await fixture({ reward: (s, { id, k }) => cs.rewardState(s, id, k) });
  cs.list.set(1, f.s);
  const old = gate(); f.accounts.writes.run('fair:0', () => old.promise);
  let captured = false; const transfer = f.store.transferTrade.bind(f.store);
  f.store.transferTrade = (...args) => { captured = true; return transfer(...args); };
  const task = f.start();
  cs.reward(1, { gold: 7, exp: 0, drops: [] }); cs.drop(1);
  assert.equal(f.s.tradeRewards.length, 1); assert.equal(f.s.c.gold, 1000);
  await tick(); assert.equal(captured, false);
  const final = f.s.tradeTask.then(() => f.accounts.putCharacter('fair', 0, f.s.c.toJSON(), '{}', null,
    { inventoryRevision: f.s.persist.inventoryRevision }));
  old.resolve(); assert.equal((await task).ok, true); await final;
  assert.equal(f.s.c.gold, 1027); assert.equal((await f.saved()).gold, 1027);
  assert.deepEqual(f.s.tradeRewards, []);
});

test('lost commit response retries identical receipt/snapshot and blocks stale queued gold save', async () => {
  const f = await fixture(), transfer = f.store.transferTrade.bind(f.store), calls = [];
  f.store.transferTrade = async (...args) => {
    calls.push(structuredClone(args)); const result = await transfer(...args);
    if (calls.length === 1) throw Error('COMMIT response lost'); return result;
  };
  const alive = setInterval(() => {}, 10);
  try {
    const task = f.start();
    const stale = f.accounts.putCharacter('fair', 0, f.s.c.toJSON(), '{}', null, { inventoryRevision: 0 });
    assert.equal((await task).ok, true); assert.equal(await stale, false);
  } finally { clearInterval(alive); }
  assert.equal(calls.length, 2); assert.deepEqual(calls[0], calls[1]);
  assert.equal(calls[0][2].length, 1);
  assert.deepEqual(calls[0][2][0].fair.faces, ['gourd', 'crab', 'fish']);
  assert.equal(calls[0][2][0].fair.symbol, 'gourd');
  assert.equal(f.draws, 3); assert.equal(f.store.tradeReceipts.size, 1);
  assert.equal((await f.saved()).gold, 1020); assert.equal(f.s.persist.inventoryRevision, 1);
  const row = (await f.store.listSlots('fair'))[0];
  assert.equal(row.data['tno.quests.v1'], '{"fair":"preserved"}');
  assert.equal(JSON.parse(row.data['tno.location.v1']).map, 'city');
});

test('concurrent fifth shots and an unknown skill commit cannot double-charge or add a sixth shot', async () => {
  const f = await fixture(), hold = gate(); let { round } = await f.start('dolls');
  for (let i = 0; i < 4; i++) round = (await shoot(f, round)).round;
  const transfer = f.store.transferTrade.bind(f.store), calls = [];
  f.store.transferTrade = async (...args) => {
    calls.push(structuredClone(args)); await hold.promise;
    const result = await transfer(...args);
    if (calls.length === 1) throw Error('response lost'); return result;
  };
  f.advance(); const message = { action: 'shot', round: round.id, x: 0, y: 0, request: randomUUID() };
  const first = f.send(message), duplicate = f.send(message);
  assert.equal(f.s.tradeBusy, true); assert.ok(f.s.tradeTask instanceof Promise);
  assert.equal((await f.send({ ...message, request: randomUUID() })).why, 'busy');
  assert.equal(f.s.c.gold, 1000);
  const alive = setInterval(() => {}, 10);
  try { hold.resolve(); assert.deepEqual(await duplicate, await first); }
  finally { clearInterval(alive); }
  assert.equal(f.s.c.gold, 980); assert.equal((await f.saved()).gold, 980);
  assert.equal(calls.length, 2); assert.deepEqual(calls[0], calls[1]);
  assert.equal(f.store.tradeReceipts.size, 1);
});

test('insufficient gold and stale revisions cannot award rolled winnings', async () => {
  const poor = await fixture({ gold: 19, faces: [0, 0, 0] });
  assert.equal((await poor.start()).why, 'gold'); assert.equal(poor.draws, 0);
  const stale = await fixture({ faces: [0, 0, 0] }); stale.s.persist.inventoryRevision = 10;
  assert.equal((await stale.start()).why, 'character_stale');
  assert.equal(stale.s.c.gold, 1000); assert.equal((await stale.saved()).gold, 1000);
  assert.equal(stale.s.tradeBusy, false);
});

test('capture rechecks identity and balance after waiting for earlier queue entries', async () => {
  for (const mutate of [f => { f.s.c.gold = 0; }, f => { f.s.persist = { ...f.s.persist }; }]) {
    const f = await fixture(), old = gate(); f.accounts.writes.run('fair:0', () => old.promise);
    const task = f.start(); mutate(f); old.resolve();
    assert.equal((await task).ok, false); assert.equal((await f.saved()).gold, 1000);
    assert.equal(f.store.tradeReceipts, undefined); assert.equal(f.s.tradeBusy, false);
  }
});

test('parallel accounts unlock and flush rewards only for their own committed state', async () => {
  const flushed = [], f = await fixture({ reward: (s, entry) => flushed.push([s.persist.account, entry]) });
  await f.store.createAccount('other', '', '');
  const c = Character.create('OtherFair', 'warrior'); c.gold = 1000;
  await f.store.putSlot('other', 0, { 'tno.character.v1': JSON.stringify(c.toJSON()) });
  const loaded = await f.accounts.joinState('other', 0);
  const other = { c, quests: f.s.quests,
    persist: { account: 'other', slot: 0, characterUid: loaded.characterUid, inventoryRevision: 0 } };
  const held = gate(), transfer = f.store.transferTrade.bind(f.store);
  f.store.transferTrade = async (...args) => {
    if (args[2][0].account === 'fair') await held.promise;
    return transfer(...args);
  };
  const first = f.start(); f.s.tradeRewards = ['first'];
  const second = f.send({ action: 'start', game: 'dice', stake: 20, symbol: 'gourd' }, other,
    { ...f.p, id: 2, account: 'other' }); other.tradeRewards = ['second'];
  assert.equal((await second).ok, true);
  assert.equal(f.s.tradeBusy, true); assert.equal(other.tradeBusy, false);
  assert.deepEqual(flushed, [['other', 'second']]);
  held.resolve(); assert.equal((await first).ok, true);
  assert.deepEqual(flushed, [['other', 'second'], ['fair', 'first']]);
});

test('synchronous transaction setup failure releases guards, flushes rewards and caches refusal', async () => {
  const flushed = [], f = await fixture({ reward: (s, entry) => flushed.push([s, entry]) });
  f.accounts.trade = () => { throw Error('transaction setup failed'); };
  const request = randomUUID(), task = f.start('dice', { request });
  assert.equal(f.s.tradeBusy, true); assert.ok(f.s.tradeTask instanceof Promise);
  f.s.tradeRewards = ['deferred'];
  const result = await task;
  assert.equal(result.ok, false); assert.equal(result.why, 'storage_unavailable');
  assert.equal(f.s.tradeBusy, false); assert.equal(f.service.pending.size, 0);
  assert.deepEqual(flushed, [[f.s, 'deferred']]); assert.deepEqual(f.s.tradeRewards, []);
  assert.deepEqual(await f.start('dice', { request }), result);
  assert.equal(f.draws, 3); assert.equal((await f.saved()).gold, 1000);
});

test('request cache and packet budget are bounded without evicting dice replay protection', async () => {
  const f = await fixture(), request = randomUUID(); const first = await f.start('dice', { request });
  for (let i = 1; i < FAIR_REQUEST_LIMIT; i++) {
    f.advance(1000); assert.equal((await f.send({ action: 'status' })).ok, true);
  }
  assert.equal((await f.start()).why, 'request_limit');
  assert.deepEqual(await f.start('dice', { request }), first); assert.equal(f.draws, 3);
  const rate = await fixture();
  for (let i = 0; i < FAIR_MESSAGE_LIMIT; i++) assert.equal((await rate.send({ action: 'status' })).ok, true);
  assert.equal((await rate.start()).why, 'rate_limit'); assert.equal(rate.draws, 0);
});

test('a settled request replayed after a reconnect or restart returns its durable outcome once', async () => {
  const f = await fixture({ faces: [0, 0, 1] }), request = randomUUID();
  const message = { t: 'fair', request, action: 'start', game: 'dice', stake: 20, symbol: 'gourd' };
  const first = await f.service.handle(f.p, f.s, message, f.context);
  assert.equal(first.ok, true); assert.equal(first.result.net, 40); assert.equal(f.s.c.gold, 1040);
  // reconnect: a new live state object, same service — answered from the settled index
  const rejoined = { ...f.s, persist: { ...f.s.persist } };
  assert.deepEqual(await f.service.handle(f.p, rejoined, message, f.context), first);
  assert.equal(f.draws, 3);
  // restart: a new service; the store refuses the reused receipt key and its meta answers
  const restarted = new TempleFairService(f.accounts, { randomInt: () => 5 });
  assert.deepEqual(await restarted.handle(f.p, rejoined, message, f.context), first);
  assert.equal((await f.saved()).gold, 1040); assert.equal(f.store.tradeReceipts.size, 1);
  // the same request ID with another payload is refused, never settled
  const reused = await restarted.handle(f.p, { ...rejoined }, { ...message, symbol: 'crab' }, f.context);
  assert.equal(reused.ok, false); assert.equal(reused.why, 'request_reused');
  assert.equal((await f.saved()).gold, 1040);
});

test('a millionaire can stake any whole amount up to 1,000,000 and settles exactly', async () => {
  const f = await fixture({ gold: 5_000_000, faces: [0, 0, 0] });
  const win = await f.start('dice', { stake: 1_000_000 });
  assert.equal(win.ok, true); assert.equal(win.result.gross, 4_000_000); assert.equal(win.result.net, 3_000_000);
  assert.equal(f.s.c.gold, 8_000_000); assert.equal((await f.saved()).gold, 8_000_000);
  f.advance(FAIR_LIMITS.roundCooldownMs);
  let { round } = await f.start('balloons', { stake: 123_457 });
  for (let i = 0; i < 5; i++) { const r = await shoot(f, round, i < 3); round = r.round; if (i === 4) {
    assert.equal(r.result.net, -(123_457 - Math.floor(123_457 * 50 / 100))); } }
  assert.equal(f.s.c.gold, 8_000_000 - 61_729);
  f.advance(FAIR_LIMITS.roundCooldownMs);
  assert.equal((await f.start('dice', { stake: 1_000_001 })).why, 'bad_stake');
  f.s.c.gold = 999_999;
  assert.equal((await f.start('dice', { stake: 1_000_000 })).why, 'gold');
});
