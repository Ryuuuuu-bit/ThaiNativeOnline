// Which rig animation plays when the combat system casts a skill
// (ids from src/character/data/classes.js → clips in moves.js).
// speed shortens long showcase clips to fit combat cooldowns.
export const CAST_ANIMS = {
  warrior: { slash: ['dual_slash', 1.3], whirl: ['dual_slash', 1], guard: ['battle_stance', 1.4], rally: ['battle_stance', 1.2] },
  muaythai: { jab: ['elbow_strike', 1.5], knee: ['flying_knee', 1.1], elbow: ['elbow_strike', 1.1], waikru: ['guard_stance', 1] },
  assassin: { stab: ['spinning_slash', 1.4], shadow: ['leap_strike', 1.1], smoke: ['stealth_crouch', 1.4], venom: ['spinning_slash', 1.1] },
  shaman: { bolt: ['curse_casting', 1.7], yantra: ['ritual_stance', 2], curse: ['curse_casting', 1.2], mend: ['spirit_summon', 1.3] },
  herbalist: { dart: ['herb_toss', 1.3], blight: ['herb_toss', 1], grove: ['support_casting', 1.2], balm: ['healing_stance', 1.5] },
  hunter: { shot: ['aimed_shot', 2.2], volley: ['aimed_shot', 1.6], snare: ['scouting_stance', 1.8], sic: ['companion_command', 1.2] },
};
// Effect types the game shows from the rig; projectiles and the hunter's dog
// already come from the combat system.
export const GAME_EFFECTS = new Set(['slash', 'spin', 'impact', 'spirits', 'ritual', 'heal', 'lotus']);
