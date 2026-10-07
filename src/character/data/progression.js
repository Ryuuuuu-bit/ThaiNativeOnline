// Content data only: edit freely without touching game logic.
export const MAX_LEVEL = 99;
export const expToNext = level => Math.round(60 * level ** 1.6);
// Job level (Ragnarok style): grows beside the base level from the same EXP (JOB_EXP_RATE of
// every EXP gain), tops out at MAX_JOB_LEVEL, and each job level after the first gives one
// skill point. The curve has Job 50 arrive around base level 65; Job 10 around base 10.
export const MAX_JOB_LEVEL = 50;
export const JOB_EXP_RATE = .75;
export const jobExpToNext = job => Math.round(22 * job ** 2);
// Skills: the class's ten kit skills (hotbar order, src/classes/*-moves.js) open at these job
// levels and go up to MAX_SKILL_LEVEL with skill points. The first one is known from the start.
// 49 points against 50 skill levels (and the planned A/B evolutions) means choosing a build.
export const MAX_SKILL_LEVEL = 5;
export const SKILL_UNLOCK_JOB = [1, 3, 5, 8, 12, 16, 22, 30, 40, 50];
// Forgetting every skill (all points back) costs gold: per job level.
export const SKILL_RESET_GOLD = 40;
// Bag weight: max = base + STR x perStr. Bag and equipped items both count.
// At `heavy` (share of max) HP/MP stop regenerating; past max nothing more can be picked up.
export const CARRY = { base: 1000, perStr: 30, heavy: .7 };
// Accuracy of a monster at a level (src/rules hitChanceOf: 90 vs 0 evasion = 95% hit).
export const MONSTER_ACCURACY = level => 88 + level;
