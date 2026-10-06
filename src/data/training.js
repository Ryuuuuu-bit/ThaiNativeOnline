// Content data only: modelled class avatars and the city training ground
// (src/training/TrainingGround.js).
//
// AVATARS: a class listed here with a `url` swaps the procedural class rig for
// that GLB (Tripo + Mixamo rig, see docs/art/classes/<class>/PRODUCTION.md).
// `skills: 'muaythai'` also brings the ten Muay Thai skills, their FX and the
// training dummy. Classes without a url keep their rig from src/character/rig.
// `ready: true` opens the class in the creation screen; every other class shows
// as a locked black silhouette with "?" until its model and skills are done
// (?classes=all unlocks them all for testing).
export const AVATARS = {
  muaythai: { url: 'models/muay-thai-fighter.glb', height: 1.8, skills: 'muaythai', ready: true },
  // Set url to 'models/herbalist.glb' once the model is exported (docs/art/classes/herbalist/PRODUCTION.md).
  herbalist: { url: null, height: 1.75, skills: null, ready: false },
};
export const classReady = id => AVATARS[id]?.ready === true;

// Damage comes from src/rules: computeDerived(stats, JOBS.boxer, level) for the
// fighter, skillStats(skill, skillLevel).mult per blow, rollDamage vs the dummy.
// URL overrides for quick tests: ?lv=50 &skill=5 &ddef=40 &deva=30
export const TRAINING = {
  map: 'city',
  // The dummy stands on the nearest free spot to here (just north of the city spawn).
  dummy: { x: 4, z: 145, hp: 5000, def: 0, eva: 0 },
  fighter: {
    level: 10, skillLevel: 1,
    stats: { STR: 30, AGI: 18, VIT: 15, INT: 5, DEX: 15, LUK: 10 },
  },
  range: 12,                     // metres from the dummy at which skills and keys 1–0 / Q take over
  log: 8,                        // hits shown in the damage log
};
