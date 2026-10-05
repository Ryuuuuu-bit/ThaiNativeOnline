// Combat tuning. Distances are world units, times are seconds.
export const RULES = {
  leash: 11,               // monsters give up when this far from home
  wanderRadius: 4,         // idle wandering stays this close to home, well inside the leash
  combatTimeout: 5,        // seconds without hits before "out of combat" regen
  projectileSpeed: 16,
  globalCooldown: 1,       // shared delay after any non-basic skill
  playerMissChance: .05,
  monsterRespawn: 18,      // default when a zone has no `respawn`
  monsterAttackDelay: 1.6,
  eliteAttackDelay: 1.3,
  eliteHeavyChance: .25,   // elites sometimes hit for 1.8×
  deathGoldLoss: .1,
  reviveRatio: .6,
};
