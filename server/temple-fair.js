import { randomInt, randomUUID } from 'node:crypto';
import { FAIR_LIMITS, FAIR_GAME_IDS, DICE_SYMBOLS, isFairOpen, isFairStake, dicePayout,
  skillPayout, judgeFairShot } from '../src/fair/fairRules.js';
import { FAIR_SITES, FAIR_RANGE } from '../src/fair/fairSites.js';
import { snapshotLocation } from './player-location.js';
import { navigation } from './navigation.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const games = new Set(FAIR_GAME_IDS);
const actions = new Set(['start', 'shot', 'cancel', 'status']);
const unit = n => Number.isFinite(n) && n >= 0 && n <= 1;
const uuid = value => typeof value === 'string' && UUID.test(value);
const identity = s => JSON.stringify([s.persist.account, s.persist.slot, s.persist.characterUid]);
const slotKey = s => JSON.stringify([s.persist.account, s.persist.slot]);
const reply = (request, ok, why = null, extra = {}) => ({ t: 'fair_result', request, ok, why, ...extra });
// The durable trade receipt of a settled fair request: scoped to the character, so a
// reconnect (or a server restart on the SQL store) answers a lost acknowledgement
// with the same outcome instead of a second debit or a fresh dice roll.
const receiptKey = (s, request) => `fair:${s.persist.characterUid}:${request}`;

// The cache never evicts an accepted UUID within this live state: eviction would
// let an old dice request roll again. Saturation fails closed until reconnect.
export const FAIR_REQUEST_LIMIT = 1024;
export const FAIR_MESSAGE_LIMIT = 20; // fresh requests/second; replays are free
// Settled answers kept in memory across reconnects (all characters); older ones
// are answered from the durable trade receipt when the store refuses the reuse.
export const FAIR_SETTLED_LIMIT = 20000;

// Main owns routing/sync. context = {hour, fighting, duel, trade, navigate} where
// navigate(map) returns the authoritative {canStand, clear} navigation adapter.
// m.round is the UUID from reply.round.id. All service clock values are ms.
export class TempleFairService {
  constructor(accounts, { reward = () => {}, now = Date.now,
    randomInt: draw = randomInt, randomUUID: makeId = randomUUID } = {}) {
    Object.assign(this, { accounts, reward, now, draw, makeId });
    this.sessions = new WeakMap();
    this.pending = new Map();
    this.settled = new Map();
  }

  authenticated(p, s) {
    const saved = s?.persist;
    return !!s?.c && !!p && typeof saved?.account === 'string' && !!saved.account
      && p.account === saved.account && Number.isInteger(saved.slot) && saved.slot >= 0
      && typeof saved.characterUid === 'string' && !!saved.characterUid
      && this.accounts.characterUid(saved.account, saved.slot) === saved.characterUid;
  }

  async handle(p, s, m, context = {}) {
    const request = uuid(m?.request) ? m.request.toLowerCase() : null;
    if (!request) return reply(null, false, 'bad_request');
    if (!this.authenticated(p, s)) return reply(request, false, 'auth');
    let session = this.sessions.get(s);
    if (!session) {
      session = { identity: identity(s), cache: new Map(), round: null, result: null,
        nextStart: -Infinity, window: -Infinity, messages: 0 };
      this.sessions.set(s, session);
    }
    if (session.identity !== identity(s)) return reply(request, false, 'character_stale');
    // Only protocol fields have meaning: client scores, payouts and clocks are
    // deliberately ignored, including for the request fingerprint.
    const fingerprint = JSON.stringify([m.t, m.action, m.game, m.stake, m.symbol, m.round, m.x, m.y]);
    const cached = session.cache.get(request);
    if (cached) return cached.fingerprint === fingerprint
      ? structuredClone(await cached.task) : reply(request, false, 'request_reused');
    if (session.cache.size >= FAIR_REQUEST_LIMIT) return reply(request, false, 'request_limit');
    const now = this.now();
    if (now - session.window >= 1000) { session.window = now; session.messages = 0; }
    if (++session.messages > FAIR_MESSAGE_LIMIT) return reply(request, false, 'rate_limit');
    const why = this.validate(m);
    if (why) return reply(request, false, why);
    // A request this live session has not seen may already be settled (its reply
    // lost before a reconnect): the service's settled index answers it. Otherwise
    // run() reaches settle() synchronously: guards and tradeTask exist before this
    // async handler first yields. Cache the promise before another packet.
    const settled = this.settled.get(receiptKey(s, request));
    const task = settled ? Promise.resolve(this.answer(request, settled, fingerprint))
      : this.run(p, s, m, context, session, now, fingerprint);
    session.cache.set(request, { fingerprint, task: task.then(result => structuredClone(result)) });
    return structuredClone(await task);
  }

  // A settled request answered again: the same outcome, never a second debit or roll.
  answer(request, settled, fingerprint) {
    return settled.fingerprint === fingerprint
      ? reply(request, true, null, { round: null, result: settled.result }) : reply(request, false, 'request_reused');
  }

  remember(key, record) {
    this.settled.delete(key); this.settled.set(key, record);
    // Past the cap the oldest answers fall back to the durable receipt lookup.
    if (this.settled.size > FAIR_SETTLED_LIMIT) this.settled.delete(this.settled.keys().next().value);
  }

  // The store refused a reused receipt key: either this exact request settled
  // before (a lost reply across a restart) or a different payload reused its ID.
  async recorded(key, request, fingerprint) {
    let fair;
    try { fair = (await this.accounts.tradeReceipt?.(key))?.meta?.fair; }
    catch { return reply(request, false, 'storage_unavailable', { round: null }); }
    if (!fair) return reply(request, false, 'request_reused', { round: null });
    this.remember(key, fair);
    return this.answer(request, fair, fingerprint);
  }

  validate(m) {
    if (m.t !== 'fair' || !actions.has(m.action)) return 'bad_action';
    if (m.game !== undefined && !games.has(m.game)) return 'bad_game';
    if (m.stake !== undefined && !isFairStake(m.stake)) return 'bad_stake';
    if (m.symbol !== undefined && !DICE_SYMBOLS.includes(m.symbol)) return 'bad_symbol';
    if (m.action === 'start') {
      if (!games.has(m.game)) return 'bad_game';
      if (!isFairStake(m.stake)) return 'bad_stake';
      if (m.game === 'dice' && m.symbol === undefined) return 'bad_symbol';
    }
    if (['shot', 'cancel'].includes(m.action) && !uuid(m.round)) return 'bad_round';
    if (m.action === 'shot' && (!unit(m.x) || !unit(m.y))) return 'bad_aim';
    return null;
  }

  access(p, s, game, context) {
    if (!s.c.alive || p.dead) return 'dead';
    if (context.fighting || context.duel || context.trade || s.stashBusy) return 'busy';
    const site = FAIR_SITES.find(site => site.id === game);
    const target = site?.approach;
    if (!target || p.map !== 'city' || ![p.x, p.z].every(Number.isFinite)
      || Math.hypot(p.x - target.x, p.z - target.z) > FAIR_RANGE) return 'range';
    const nav = (context.navigate ?? navigation)('city');
    if (!nav?.canStand(p.x, p.z) || !nav?.clear(p, target)) return 'blocked';
    return null;
  }

  view(round, now) {
    return round ? { id: round.id, game: round.game, stake: round.stake, seed: round.seed,
      shots: round.shots, shotIndex: round.shots, shotsRemaining: FAIR_LIMITS.shots - round.shots,
      hits: round.hits, elapsedMs: Math.max(0, now - round.started),
      remainingMs: Math.max(0, FAIR_LIMITS.roundMs - (now - round.started)),
      shotIntervalMs: FAIR_LIMITS.shotIntervalMs, maxShots: FAIR_LIMITS.shots } : null;
  }

  async run(p, s, m, context, session, now, fingerprint) {
    const response = (ok, why = null, extra) => reply(m.request.toLowerCase(), ok, why, extra);
    if (s.tradeBusy || this.pending.has(slotKey(s))) return response(false, 'busy');
    let round = session.round;
    if (round && (now - round.started >= FAIR_LIMITS.roundMs || now < round.started
      || p.map !== round.map || p.ch !== round.ch || p.room !== round.room)) {
      session.round = null; round = null;
    }
    if (m.action === 'cancel') {
      if (!round || round.id !== m.round) return response(false, 'round_missing');
      session.round = null;
      return response(true, null, { round: null });
    }
    if (m.action === 'status') {
      if (round) {
        const why = this.access(p, s, round.game, context);
        if (why) { session.round = null; return response(false, why, { round: null }); }
      }
      return response(true, null, { round: this.view(round, now), result: session.result,
        open: isFairOpen(context.hour) });
    }
    if (m.action === 'start' && round) return response(false, 'round_active');
    if (m.action === 'shot' && (!round || round.id !== m.round || (m.game && m.game !== round.game)))
      return response(false, 'round_missing');
    const game = m.action === 'start' ? m.game : round.game;
    const why = this.access(p, s, game, context);
    if (why) { session.round = null; return response(false, why); }
    if (m.action === 'start') {
      if (!isFairOpen(context.hour)) return response(false, 'closed');
      if (now < session.nextStart) return response(false, 'cooldown');
      if (!Number.isSafeInteger(s.c.gold) || s.c.gold < m.stake) return response(false, 'gold');
      session.nextStart = now + FAIR_LIMITS.roundCooldownMs;
      session.result = null;
      if (game === 'dice') {
        const faces = Array.from({ length: 3 }, () => DICE_SYMBOLS[this.draw(6)]);
        const gross = dicePayout(m.stake, m.symbol, faces);
        return this.settle(p, s, session, m.request, { game, stake: m.stake, symbol: m.symbol,
          faces, gross, net: gross - m.stake }, context, fingerprint);
      }
      round = { id: this.makeId(), game, stake: m.stake, seed: this.draw(0x100000000),
        started: now, lastShot: -Infinity, shots: 0, hits: 0, map: p.map, ch: p.ch, room: p.room };
      session.round = round;
      return response(true, null, { round: this.view(round, now) });
    }
    if (round.shots >= FAIR_LIMITS.shots) return response(false, 'shot_budget');
    if (now - round.lastShot < FAIR_LIMITS.shotIntervalMs) return response(false, 'shot_rate');
    const judgment = judgeFairShot({ gameId: game,
      seed: round.seed, shotIndex: round.shots, elapsedMs: now - round.started, x: m.x, y: m.y });
    if (!judgment.valid) return response(false, 'bad_aim');
    round.lastShot = now; round.shots++; round.hits += Number(judgment.hit);
    if (round.shots < FAIR_LIMITS.shots)
      return response(true, null, { round: this.view(round, now), result: { hit: judgment.hit } });
    const gross = skillPayout(round.stake, round.hits);
    session.round = null;
    return this.settle(p, s, session, m.request, { game, round: round.id,
      stake: round.stake, shots: round.shots, hits: round.hits, hit: judgment.hit,
      gross, net: gross - round.stake }, context, fingerprint);
  }

  settle(p, s, session, request, outcome, context, fingerprint) {
    const key = slotKey(s), receipt = this.makeId(), persist = s.persist;
    const frozen = structuredClone(outcome), settled = { ...frozen, receipt };
    s.tradeBusy = true;
    // Reserve before invoking Accounts, even when its FIFO is already busy.
    this.pending.set(key, s);
    let commit;
    try { commit = this.accounts.trade(receiptKey(s, request.toLowerCase()), [persist], {
      meta: { fair: { fingerprint, result: settled } },
      capture: () => {
        if (!this.authenticated(p, s) || s.persist !== persist || identity(s) !== session.identity)
          return { failure: { ok: false, why: 'character_stale' } };
        const why = this.access(p, s, frozen.game, context);
        if (why) return { failure: { ok: false, why } };
        const character = structuredClone(s.c.toJSON());
        // Stake affordability applies even when the rolled return is profitable.
        if (!Number.isSafeInteger(character.gold) || character.gold < frozen.stake
          || !Number.isSafeInteger(character.gold + frozen.net))
          return { failure: { ok: false, why: 'gold' } };
        character.gold += frozen.net;
        return [{ account: persist.account, slot: persist.slot,
          inventoryRevision: persist.inventoryRevision ?? 0, character,
          // Accounts fingerprints the full participant for its durable receipt;
          // Store writes only its usual character/quests/location save fields.
          fair: { request: request.toLowerCase(), ...frozen },
          quests: s.quests.json(), location: snapshotLocation(p) }];
      },
      adopt: (prepared, revisions) => {
        s.c.gold = prepared[0].character.gold;
        persist.inventoryRevision = revisions[0]; s.dirty = true;
        s.c.emit('change');
      },
    }); } catch (error) { commit = Promise.reject(error); }
    const task = commit.then(result => {
      if (!result.ok && result.why === 'request_reused') return this.recorded(receiptKey(s, request.toLowerCase()), request.toLowerCase(), fingerprint);
      if (!result.ok) return reply(request.toLowerCase(), false, result.why ?? 'commit_failed', { round: null });
      this.remember(receiptKey(s, request.toLowerCase()), { fingerprint, result: settled });
      session.result = settled;
      return reply(request.toLowerCase(), true, null, { round: null, result: session.result });
    }, () => reply(request.toLowerCase(), false, 'storage_unavailable', { round: null }))
      .finally(() => {
        s.tradeBusy = false; this.pending.delete(key);
        const rewards = s.tradeRewards ?? []; s.tradeRewards = [];
        for (const entry of rewards) this.reward(s, entry);
      });
    s.tradeTask = task;
    return task;
  }
}
