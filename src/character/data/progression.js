// Content data only: edit freely without touching game logic.
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
// Job level (Ragnarok style): grows beside the base level from the same EXP (JOB_EXP_RATE of
// every EXP gain), tops out at MAX_JOB_LEVEL, and each job level after the first gives one
// skill point. The curve has Job 8 around base 10, Job 24 around base 30 and Job 50 around 65.
export const MAX_JOB_LEVEL = 50;
export const JOB_EXP_RATE = .75;
export const jobExpToNext = job => Math.round(73 * job ** 2.7);
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
