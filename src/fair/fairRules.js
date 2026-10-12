// Pure shared fair rules. Authority, randomness, balances and receipts belong to the server.
import { phaseOf } from '../core/WorldClock.js';

export const FAIR_RULES_VERSION = 1;
export const FAIR_GAME_IDS = Object.freeze(['balloons', 'dolls', 'dice']);
export const FAIR_STAKES = Object.freeze([20, 50, 100]);
export const FAIR_GAMES = Object.freeze({
  balloons: Object.freeze({ nameTh: 'ปาโป่ง', kind: 'skill' }),
  dolls: Object.freeze({ nameTh: 'ยิงตุ๊กตา', kind: 'skill' }),
  dice: Object.freeze({ nameTh: 'น้ำเต้า ปู ปลา', kind: 'dice' }),
});
export const FAIR_LIMITS = Object.freeze({
  shots: 5,
  roundMs: 20000,
  shotIntervalMs: 500,
  diceRevealMs: 1500,
  roundCooldownMs: 3000,
});
export const DICE_SYMBOLS = Object.freeze(['gourd', 'crab', 'fish', 'rooster', 'shrimp', 'tiger']);
export const DICE_SYMBOL_NAMES = Object.freeze({
  gourd: 'น้ำเต้า', crab: 'ปู', fish: 'ปลา', rooster: 'ไก่', shrimp: 'กุ้ง', tiger: 'เสือ',
});
// Three independent uniform six-sided dice; counts are out of 216 ordered outcomes.
export const DICE_ODDS = Object.freeze({
  outcomes: 216,
  matchCounts: Object.freeze([125, 75, 15, 1]),
  grossMultipliers: Object.freeze([0, 2, 3, 4]),
  expectedGrossNumerator: 199,
  expectedSinkNumerator: 17,
});
// Percent of the selected tier forgiven from the completion fee, indexed by hits.
export const SKILL_REFUND_PERCENT = Object.freeze([0, 0, 25, 50, 75, 100]);

export function isFairOpen(hour) {
  if (!Number.isFinite(hour) || hour < 0 || hour >= 24) return false;
  const phase = phaseOf(hour);
  return phase === 'evening' || phase === 'night';
}

export const isFairStake = stake => FAIR_STAKES.includes(stake);
const isSkillGame = gameId => gameId === 'balloons' || gameId === 'dolls';
const isSeed = seed => Number.isInteger(seed) && seed >= 0 && seed <= 0xffffffff;
const isShotIndex = index => Number.isInteger(index) && index >= 0 && index < FAIR_LIMITS.shots;
const isElapsed = elapsedMs => Number.isFinite(elapsedMs) && elapsedMs >= 0;
const isCoordinate = value => Number.isFinite(value) && value >= 0 && value <= 1;

/** Gross return including returned stake. Caller supplies three server CSPRNG symbol IDs. */
export function dicePayout(stake, symbol, faces) {
  if (!isFairStake(stake) || !DICE_SYMBOLS.includes(symbol) || !Array.isArray(faces)
    || faces.length !== 3 || ![0, 1, 2].every(i => DICE_SYMBOLS.includes(faces[i]))) {
    throw new RangeError('Invalid fair dice stake, symbol or three-face result');
  }
  const matches = faces.reduce((n, face) => n + Number(face === symbol), 0);
  return stake * DICE_ODDS.grossMultipliers[matches];
}

/** Display/accounting value only: skill rounds never credit this amount to a balance. */
export function skillPayout(stake, hits) {
  if (!isFairStake(stake) || !Number.isInteger(hits) || hits < 0 || hits > FAIR_LIMITS.shots) {
    throw new RangeError('Invalid fair skill stake or hit count');
  }
  return Math.floor(stake * SKILL_REFUND_PERCENT[hits] / 100);
}

/** Debit once after all five server-accepted shots; interrupted rounds cost zero. */
export const skillFee = (stake, hits) => stake - skillPayout(stake, hits);

// Deterministic variation for visible skill targets, never a source of dice randomness.
function targetBits(seed, shotIndex) {
  let bits = (seed ^ Math.imul(shotIndex + 1, 0x9e3779b9)) >>> 0;
  bits = Math.imul(bits ^ (bits >>> 16), 0x85ebca6b);
  bits = Math.imul(bits ^ (bits >>> 13), 0xc2b2ae35);
  return (bits ^ (bits >>> 16)) >>> 0;
}

/**
 * Square board, top-left (0,0), bottom-right (1,1). Elapsed milliseconds are since
 * server round start, NOT since the current shot. One current target per shot.
 * Seed/index are server-owned. Rendering may predict; hit judgment uses receipt time.
 * Throws RangeError for invalid arguments; returns null at/after the round deadline.
 */
export function targetAt(gameId, seed, shotIndex, elapsedMs) {
  if (!isSkillGame(gameId) || !isSeed(seed) || !isShotIndex(shotIndex) || !isElapsed(elapsedMs)) {
    throw new RangeError('Invalid fair target game, seed, shot index or elapsed time');
  }
  if (elapsedMs >= FAIR_LIMITS.roundMs) return null;
  const bits = targetBits(seed, shotIndex);
  const u = (bits & 0xffff) / 0xffff, v = (bits >>> 16) / 0xffff;
  const phase = u * Math.PI * 2;
  if (gameId === 'balloons') return {
    id: shotIndex,
    x: 0.18 + 0.64 * u,
    y: 0.24 + 0.52 * v + 0.03 * Math.sin(elapsedMs * Math.PI * 2 / 4000 + phase),
    radius: 0.075,
  };
  return {
    id: shotIndex,
    // Visible radius and speed bound allow <=150ms center-aim delay without rewind.
    x: 0.5 + 0.38 * Math.sin(elapsedMs * Math.PI * 2 / (5000 + 1500 * v) + phase),
    y: 0.16 + 0.17 * shotIndex + 0.025 * Math.sin(elapsedMs * Math.PI * 2 / 1800 + phase),
    radius: 0.075,
  };
}

/** Geometry only: backend must enforce open hours, ownership, sequence and cadence. */
export function judgeFairShot(input = {}) {
  const { gameId, seed, shotIndex, elapsedMs, x, y } = input ?? {};
  let reason = !isSkillGame(gameId) ? 'game'
    : !isSeed(seed) ? 'seed'
      : !isShotIndex(shotIndex) ? 'shot_index'
        : !isElapsed(elapsedMs) ? 'elapsed'
          : !isCoordinate(x) || !isCoordinate(y) ? 'aim'
            : elapsedMs >= FAIR_LIMITS.roundMs ? 'expired' : null;
  if (reason) return { valid: false, hit: false, targetId: null, reason };
  const target = targetAt(gameId, seed, shotIndex, elapsedMs);
  const hit = Math.hypot(x - target.x, y - target.y) <= target.radius;
  return { valid: true, hit, targetId: hit ? target.id : null, reason: null };
}
