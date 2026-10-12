import { test } from 'node:test';
import assert from 'node:assert/strict';
import { phaseOf } from '../src/core/WorldClock.js';
import {
  FAIR_RULES_VERSION, FAIR_GAME_IDS, FAIR_GAMES, FAIR_STAKES, FAIR_STAKE_MIN, FAIR_STAKE_MAX, FAIR_LIMITS,
  DICE_SYMBOLS, DICE_SYMBOL_NAMES, DICE_ODDS, SKILL_REFUND_PERCENT,
  isFairOpen, isFairStake, dicePayout, skillPayout, skillFee, targetAt, judgeFairShot,
} from '../src/fair/fairRules.js';

test('fair tables expose only the approved games, stake range and bounded round limits', () => {
  assert.equal(FAIR_RULES_VERSION, 2);
  assert.deepEqual(FAIR_GAME_IDS, ['balloons', 'dolls', 'dice']);
  assert.deepEqual(Object.keys(FAIR_GAMES), FAIR_GAME_IDS);
  assert.equal(FAIR_STAKE_MIN, 20); assert.equal(FAIR_STAKE_MAX, 1_000_000);
  assert.deepEqual(FAIR_STAKES, [20, 100, 1_000, 10_000, 100_000, 1_000_000]);
  for (const stake of FAIR_STAKES) assert.ok(isFairStake(stake));
  assert.deepEqual(FAIR_LIMITS, { shots: 5, roundMs: 20000, shotIntervalMs: 500, diceRevealMs: 1500, roundCooldownMs: 3000 });
  assert.equal(new Set(DICE_SYMBOLS).size, 6);
  assert.deepEqual(Object.keys(DICE_SYMBOL_NAMES), DICE_SYMBOLS);
  for (const value of [FAIR_GAME_IDS, FAIR_GAMES, ...Object.values(FAIR_GAMES), FAIR_STAKES,
    FAIR_LIMITS, DICE_SYMBOLS, DICE_SYMBOL_NAMES, DICE_ODDS, DICE_ODDS.matchCounts,
    DICE_ODDS.grossMultipliers, SKILL_REFUND_PERCENT]) assert.ok(Object.isFrozen(value));
});

test('fair opens exactly at 16:30 and closes exactly at 05:00 including midnight', () => {
  for (const [hour, open] of [[0, true], [4.999999, true], [5, false], [5.99, false],
    [12, false], [16.499999, false], [16.5, true], [18, true], [19.499999, true],
    [19.5, true], [23.999999, true]]) assert.equal(isFairOpen(hour), open, `${hour}`);
});

test('opening follows the shared evening/night phases for every minute of the day', () => {
  for (let minute = 0; minute < 1440; minute++) {
    const hour = minute / 60;
    assert.equal(isFairOpen(hour), ['evening', 'night'].includes(phaseOf(hour)), `${hour}`);
  }
});

test('invalid hours and stakes fail closed without coercion or wrapping', () => {
  for (const hour of [undefined, null, NaN, Infinity, -Infinity, -0.1, 24, 48, '22', true, {}]) {
    assert.equal(isFairOpen(hour), false);
  }
  for (const stake of [undefined, null, NaN, Infinity, -20, 0, 1, 19, 20.5, 1_000_000.5, 1_000_001, 1e9, Number.MAX_SAFE_INTEGER + 1, 2n ** 70n, '20', '1000', true, {}]) {
    assert.equal(isFairStake(stake), false);
    assert.throws(() => dicePayout(stake, 'fish', ['fish', 'fish', 'fish']), RangeError);
    assert.throws(() => skillPayout(stake, 5), RangeError);
    assert.throws(() => skillFee(stake, 5), RangeError);
  }
});

for (const stake of FAIR_STAKES) {
  test(`dice ${stake}: all 216 outcomes for every symbol prove exactly 199/216 gross return`, () => {
    for (const symbol of DICE_SYMBOLS) {
      const counts = [0, 0, 0, 0];
      let grossSum = 0, netSum = 0;
      for (const a of DICE_SYMBOLS) for (const b of DICE_SYMBOLS) for (const c of DICE_SYMBOLS) {
        const faces = [a, b, c], snapshot = [...faces];
        const matches = faces.filter(face => face === symbol).length;
        counts[matches]++;
        const gross = dicePayout(stake, symbol, faces);
        assert.equal(gross, matches ? stake * (1 + matches) : 0);
        assert.deepEqual(faces, snapshot);
        grossSum += gross; netSum += gross - stake;
      }
      assert.deepEqual(counts, [125, 75, 15, 1]);
      assert.deepEqual(counts, DICE_ODDS.matchCounts);
      assert.equal(grossSum, stake * 199);
      assert.equal(netSum, -stake * 17);
      assert.equal(counts.reduce((a, b) => a + b), DICE_ODDS.outcomes);
      assert.equal(DICE_ODDS.expectedGrossNumerator, 199);
      assert.equal(DICE_ODDS.expectedSinkNumerator, 17);
    }
  });
}

test('dice rejects unknown symbols, sparse dice and malformed result lengths', () => {
  for (const symbol of ['unknown', 'FISH', '', 0, null, {}, '__proto__']) {
    assert.throws(() => dicePayout(20, symbol, ['fish', 'fish', 'fish']), RangeError);
  }
  for (const faces of [null, undefined, 'fish', {}, [], ['fish'], ['fish', 'fish'],
    ['fish', 'fish', 'fish', 'fish'], ['fish', 'fish', 'unknown'], ['fish', 'fish', 0],
    new Array(3), ['fish', , 'fish']]) {
    assert.throws(() => dicePayout(20, 'fish', faces), RangeError);
  }
});

test('skill refunds and completion fees are exact integer gold at every tier', () => {
  const expected = new Map([[20, [0, 0, 5, 10, 15, 20]], [50, [0, 0, 12, 25, 37, 50]], [100, [0, 0, 25, 50, 75, 100]]]);
  for (const [stake, refunds] of expected) for (let hits = 0; hits <= 5; hits++) {
    assert.equal(skillPayout(stake, hits), refunds[hits]);
    assert.equal(skillFee(stake, hits), stake - refunds[hits]);
    assert.ok(Number.isInteger(skillFee(stake, hits)));
  }
});

test('any whole stake from 20 to 1,000,000 is accepted; odd amounts settle in whole gold', () => {
  for (const stake of [20, 21, 37, 50, 99, 101, 12_345, 333_333, 999_999, 1_000_000]) {
    assert.equal(isFairStake(stake), true, `${stake}`);
    for (let hits = 0; hits <= 5; hits++) {
      const fee = skillFee(stake, hits);
      assert.ok(Number.isSafeInteger(fee) && fee >= 0 && fee <= stake);
    }
    assert.equal(dicePayout(stake, 'tiger', ['tiger', 'tiger', 'tiger']), stake * 4);
    assert.equal(dicePayout(stake, 'tiger', ['crab', 'fish', 'gourd']), 0);
  }
  // the largest single dice result: +3,000,000 net on a 1,000,000 stake
  assert.equal(dicePayout(FAIR_STAKE_MAX, 'fish', ['fish', 'fish', 'fish']) - FAIR_STAKE_MAX, 3_000_000);
});

test('all 32 five-shot result sequences can only sink gold or break even', () => {
  for (const stake of [...FAIR_STAKES, 21, 333_333]) for (let sequence = 0; sequence < 32; sequence++) {
    const hits = Array.from({ length: 5 }, (_, i) => (sequence >>> i) & 1).reduce((a, b) => a + b, 0);
    const fee = skillFee(stake, hits);
    assert.ok(fee >= 0 && fee <= stake);
    assert.equal(fee === 0, hits === 5);
    assert.ok(skillPayout(stake, hits) <= stake);
  }
});

test('skill payout rejects impossible or client-coerced scores instead of clamping', () => {
  for (const hits of [-1, 6, 999, 2.5, NaN, Infinity, '5', true, null, undefined, {}]) {
    assert.throws(() => skillPayout(20, hits), RangeError);
    assert.throws(() => skillFee(20, hits), RangeError);
  }
});

for (const gameId of ['balloons', 'dolls']) {
  test(`${gameId}: deterministic targets remain wholly within the square board`, () => {
    for (const seed of [0, 1, 65535, 123456789, 0xffffffff]) for (let shotIndex = 0; shotIndex < 5; shotIndex++) {
      for (let elapsedMs = 0; elapsedMs < 20000; elapsedMs += 137) {
        const target = targetAt(gameId, seed, shotIndex, elapsedMs);
        assert.deepEqual(targetAt(gameId, seed, shotIndex, elapsedMs), target);
        assert.equal(target.id, shotIndex);
        assert.ok(target.x - target.radius >= 0 && target.x + target.radius <= 1);
        assert.ok(target.y - target.radius >= 0 && target.y + target.radius <= 1);
      }
    }
    assert.notDeepEqual(targetAt(gameId, 1, 0, 0), targetAt(gameId, 2, 0, 0));
    const target = targetAt(gameId, 1, 0, 0); target.x = 100;
    assert.ok(targetAt(gameId, 1, 0, 0).x <= 1, 'returned geometry does not mutate shared state');
  });

  test(`${gameId}: geometry judges centers, near edges and misses for every shot`, () => {
    for (let shotIndex = 0; shotIndex < 5; shotIndex++) {
      const input = { gameId, seed: 123, shotIndex, elapsedMs: 2500 };
      const target = targetAt(gameId, input.seed, shotIndex, input.elapsedMs);
      assert.deepEqual(judgeFairShot({ ...input, x: target.x, y: target.y }),
        { valid: true, hit: true, targetId: shotIndex, reason: null });
      assert.equal(judgeFairShot({ ...input, x: target.x + target.radius - 1e-8, y: target.y }).hit, true);
      assert.deepEqual(judgeFairShot({ ...input, x: target.x + target.radius + 1e-8, y: target.y }),
        { valid: true, hit: false, targetId: null, reason: null });
      assert.equal(judgeFairShot({ ...input, x: 0, y: 0 }).hit, false);
    }
  });

  test(`${gameId}: no target or accepted shot at/after the server round deadline`, () => {
    assert.ok(targetAt(gameId, 1, 0, 19999.999));
    for (const elapsedMs of [20000, 20001, 1e9]) {
      assert.equal(targetAt(gameId, 1, 0, elapsedMs), null);
      assert.deepEqual(judgeFairShot({ gameId, seed: 1, shotIndex: 0, elapsedMs, x: 0.5, y: 0.5 }),
        { valid: false, hit: false, targetId: null, reason: 'expired' });
    }
  });
}

test('doll visible radius covers center-aim delays through 150ms, including both motion axes', () => {
  let longerDelayMisses = 0;
  for (let sample = 0; sample < 16; sample++) {
    const seed = Math.imul(sample, 0x11111111) >>> 0;
    for (let shotIndex = 0; shotIndex < 5; shotIndex++) {
      for (let elapsedMs = 0; elapsedMs < 19500; elapsedMs += 113) {
        const seen = targetAt('dolls', seed, shotIndex, elapsedMs);
        assert.equal(seen.radius, 0.075, 'published visible radius is the actual hit radius');
        for (const delay of [50, 100, 150]) {
          const received = targetAt('dolls', seed, shotIndex, elapsedMs + delay);
          assert.ok(Math.hypot(received.x - seen.x, received.y - seen.y) < seen.radius);
          assert.equal(judgeFairShot({ gameId: 'dolls', seed, shotIndex,
            elapsedMs: elapsedMs + delay, x: seen.x, y: seen.y }).hit, true);
        }
        if (!judgeFairShot({ gameId: 'dolls', seed, shotIndex,
          elapsedMs: elapsedMs + 500, x: seen.x, y: seen.y }).hit) longerDelayMisses++;
      }
    }
  }
  assert.ok(longerDelayMisses > 0, 'movement still requires timely aim; no arbitrary stale-aim grace');
});

test('doll hit uses supplied authoritative receipt time, ignoring claimed score and timestamp', () => {
  const input = { gameId: 'dolls', seed: 42, shotIndex: 0, elapsedMs: 0 };
  const old = targetAt(input.gameId, input.seed, input.shotIndex, 0);
  assert.equal(judgeFairShot({ ...input, x: old.x, y: old.y }).hit, true);
  const later = { ...input, elapsedMs: 1000, x: old.x, y: old.y, score: 5, hits: 5, timestamp: 0 };
  assert.equal(judgeFairShot(later).hit, false);
  assert.equal(later.elapsedMs, 1000);
});

test('target and shot helpers reject invalid games, seeds, indexes and elapsed times', () => {
  const base = { gameId: 'balloons', seed: 1, shotIndex: 0, elapsedMs: 0, x: 0.5, y: 0.5 };
  const cases = [
    ['gameId', ['balloon', 'dice', 'unknown', '__proto__', null, undefined], 'game'],
    ['seed', [-1, 0x100000000, 0.5, NaN, Infinity, '1', null, undefined], 'seed'],
    ['shotIndex', [-1, 5, 0.5, NaN, Infinity, '0', null, undefined], 'shot_index'],
    ['elapsedMs', [-1, NaN, Infinity, '0', null, undefined], 'elapsed'],
  ];
  for (const [key, values, reason] of cases) for (const value of values) {
    const input = { ...base, [key]: value };
    assert.throws(() => targetAt(input.gameId, input.seed, input.shotIndex, input.elapsedMs), RangeError);
    assert.deepEqual(judgeFairShot(input), { valid: false, hit: false, targetId: null, reason });
  }
  for (const input of [null, undefined, {}]) assert.equal(judgeFairShot(input).valid, false);
});

test('shot helpers reject out-of-board or nonnumeric aims without changing caller input', () => {
  const base = { gameId: 'balloons', seed: 1, shotIndex: 0, elapsedMs: 0, x: 0.5, y: 0.5 };
  for (const key of ['x', 'y']) for (const value of [-0.01, 1.01, NaN, Infinity, '0.5', null, undefined]) {
    const input = { ...base, [key]: value }, before = { ...input };
    assert.deepEqual(judgeFairShot(input), { valid: false, hit: false, targetId: null, reason: 'aim' });
    assert.deepEqual(input, before);
  }
});
