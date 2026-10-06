// Content data only: edit freely without touching game logic.
export const MAX_LEVEL = 30;
export const expToNext = level => Math.round(60 * level ** 1.6);
// Bag weight: max = base + STR x perStr. Bag and equipped items both count.
// At `heavy` (share of max) HP/MP stop regenerating; past max nothing more can be picked up.
export const CARRY = { base: 1000, perStr: 30, heavy: .7 };
// Accuracy of a monster at a level (src/rules hitChanceOf: 90 vs 0 evasion = 95% hit).
export const MONSTER_ACCURACY = level => 88 + level;
