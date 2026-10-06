// Content data only: modelled class avatars and the city training ground
// (src/training/TrainingGround.js).
//
// AVATARS: the 3D model (Tripo GLB with a Mixamo rig, see
// docs/art/classes/<class>/PRODUCTION.md) each class wears in the city.
// A class with no entry wears AVATAR_FALLBACK's model until it gets its own.
// casts: city combat skill id (src/combat/data/skills.js) → clip played on cast.
// skills: a kit id from src/classes (CLASS_KITS) — the class's ten skills,
// their FX and the training dummy in the city.
// job: rules job (src/rules/data/classes.js JOBS) for the trainee's stats.
// portrait: head render for the HUD and entry screens (src/ui/icons.js classBadge).
// ready: true opens the class in the creation screen; every other class shows
// as a locked black silhouette with "?" until its model and skills are done
// (?classes=all unlocks them all for testing).
export const AVATARS = {
  muaythai: {
    url: 'models/muay-thai-fighter.glb', portrait: 'ui/portraits/muaythai.png', height: 1.8, skills: 'muaythai', job: 'boxer', ready: true,
    casts: { jab: 'boxer_jab', knee: 'boxer_knee', elbow: 'boxer_elbow', waikru: 'boxer_waikru' },
  },
  herbalist: {
    url: 'models/herbalist.glb', portrait: 'ui/portraits/herbalist.png', height: 1.75, skills: 'herbalist', job: 'healer', ready: true,
    casts: { dart: 'cast_book', blight: 'toss', grove: 'kneel_heal', balm: 'raise_sky' },
  },
  hunter: {
    url: 'models/hunter.glb', portrait: 'ui/portraits/hunter.png', height: 1.8, skills: 'hunter', job: 'archer', ready: true,
    casts: { shot: 'hunter_shot', volley: 'hunter_volley', snare: 'hunter_trap', sic: 'hunter_hawk' },
  },
};
export const AVATAR_FALLBACK = 'muaythai';
export const avatarFor = id => (AVATARS[id]?.url ? AVATARS[id] : AVATARS[AVATAR_FALLBACK]);
export const classReady = id => AVATARS[id]?.ready === true;

// Damage comes from src/rules: computeDerived(stats, JOBS[avatar.job], level) for
// the trainee, skillStats(skill, skillLevel).mult per blow, rollDamage vs the dummy.
// URL overrides for quick tests: ?lv=50 &skill=5 &ddef=40 &deva=30
export const TRAINING = {
  map: 'city',
  // The dummy stands on the nearest free spot to here (just north of the city spawn).
  dummy: { x: 4, z: 145, hp: 5000, def: 0, eva: 0 },
  fighter: {
    level: 10, skillLevel: 1,
    stats: { STR: 30, AGI: 18, VIT: 15, INT: 5, DEX: 15, LUK: 10 },
    // Per-job stat overrides (the herbalist trains on INT).
    byJob: { healer: { STR: 8, AGI: 12, VIT: 15, INT: 30, DEX: 18, LUK: 10 }, archer: { STR: 12, AGI: 20, VIT: 14, INT: 6, DEX: 30, LUK: 12 } },
  },
  range: 12,                     // metres from the dummy at which skills and keys 1–0 / Q take over
  log: 8,                        // hits shown in the damage log
};
