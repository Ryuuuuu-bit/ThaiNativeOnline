// Content data only: edit freely without touching game logic.
import { expLevelMul } from '../../rules/stats.js';
export const MAX_LEVEL = 99;
// Ragnarok-style slow climb. The curve is EXP per minute of farming monsters of your level
// (MONSTER_EXP_RATE below × ~9 kills a minute, measured with tools/sim/farm-sim.mjs) times the
// minutes a level should take: about 1 min at Lv.1, 25 min at Lv.10, 1.3 h at 20, 2.7 h at 30,
// 6.5 h at 50, 11 h at 70, 20 h at 98. Totals: Lv.10 in ~1.5 h, Lv.30 ~1 day of play,
// Lv.50 ~5 days, Lv.99 ~30 days of farming (more with real-life detours).
export const expToNext = level => Math.round(80 * level ** 2.5);
// What a normal monster of a level should give, so new monsters fit the curve
// (elites and bosses: several times this).
export const MONSTER_EXP_RATE = level => Math.round(18 * level ** .8);
// The EXP of one kill for a player (ThaiNative's rule, src/rules/stats.js expLevelMul): full up to
// 5 levels below the monster's, +2% a level for a monster up to 10 above (at most +20%), then −10%
// a level (at most −80%); a monster more than 5 levels under you gives −10% a level (at least 10%).
// One normal kill never gives more than KILL_EXP_CAP of the player's level (an elite or boss: a
// whole level) — no rushing levels on monsters far above you. `mul`: night, party share.
export const KILL_EXP_CAP = .2;
export function killExp(base, playerLv, monsterLv, big = false, mul = 1) {
  const raw = Math.max(0, base) * expLevelMul(playerLv, monsterLv) * mul;
  return Math.round(Math.min(raw, Math.max(1, expToNext(Math.max(1, playerLv)) * (big ? 1 : KILL_EXP_CAP))));
}
// Job level (Ragnarok style): grows beside the base level from the same EXP (JOB_EXP_RATE of
// every EXP gain), tops out at MAX_JOB_LEVEL, and each job level after the first gives one
// skill point. The curve has Job 8 around base 10, Job 24 around base 30 and Job 50 around 65.
export const MAX_JOB_LEVEL = 50;
export const JOB_EXP_RATE = .75;
export const jobExpToNext = job => Math.round(73 * job ** 2.7);
// Skills: the class's ten kit skills (hotbar order, src/classes/*-moves.js) sit on a tree
// (skilltree.js): a skill opens when the ones before it on its line have enough levels and the
// job level has reached its floor, and goes up to MAX_SKILL_LEVEL with skill points. The first
// one is known from the start. 49 points against 100 skill levels means choosing a build:
// one line to the top and a second half-way, never everything.
export const MAX_SKILL_LEVEL = 10;
// Forgetting every skill (all points back) costs gold: per job level.
export const SKILL_RESET_GOLD = 40;
// Bag weight: max = base + STR x perStr. Bag and equipped items both count.
// At `heavy` (share of max) HP/MP stop regenerating; past max nothing more can be picked up.
export const CARRY = { base: 5000, perStr: 30, heavy: .7 };
// Per second; VIT improves both resources, but never scales with maximum HP/MP.
export const RECOVERY = { hpBase: 1, hpPerVit: .1, hpCap: 8, mpBase: .5, mpPerVit: .05, mpCap: 4, combat: .25 };
// Accuracy of a monster at a level (src/rules hitChanceOf: 90 vs 0 evasion = 95% hit).
export const MONSTER_ACCURACY = level => 88 + level;
