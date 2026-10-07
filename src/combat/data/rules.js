// Combat tuning. Distances are world units, times are seconds.
export const RULES = {
  leash: 11,               // monsters give up when this far from home
  wanderRadius: 4,         // idle wandering stays this close to home, well inside the leash
  combatTimeout: 5,        // seconds without hits before "out of combat" regen
  projectileSpeed: 16,
  globalCooldown: 1,       // shared delay after any non-basic skill
  monsterRespawn: 7,       // default when a zone has no `respawn`
  monsterAttackDelay: 1.6,
  eliteAttackDelay: 1.3,
  eliteHeavyChance: .25,   // elites sometimes hit for 1.8×
  deathGoldLoss: .1,
  reviveRatio: .6,
  // The hunter's dog: each bite is a rules blow at petBite × ATK (crits, armour), every
  // 1.3 s (0.55 s in a frenzy) shortened by attack speed; a landed basic hit sends it in
  // at once with petInstinct chance (+0.2% per LUK) for a 1.5× bite (สัญชาตญาณหมาล่า).
  petBite: .45,
  petInstinct: .12,
  // Class skill kits fighting monsters (src/training/kitCombat.js). Rules skills
  // (src/rules/data/skills.js) measure range/radius in ThaiNative pixels: pxPerMeter
  // turns them into metres. Casts need the target within [minRange, maxRange] m
  // (melee kits dash the last metres themselves); farther, the player walks in for
  // up to approachTimeout s. A blow with no rules multiplier hits at fallbackMult.
  kit: { pxPerMeter: 25, minRange: 2.2, maxRange: 12, approachTimeout: 6, fallbackMult: 1, targetRange: 14 },
};
