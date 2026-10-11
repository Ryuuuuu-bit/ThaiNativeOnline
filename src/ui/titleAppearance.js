// Presentation-only prestige. Unlocks, rank ownership and saved IDs remain in
// src/data/titles.js; unrelated record counts are never compared as difficulty.
export const TITLE_TIERS = Object.freeze(['common', 'rare', 'epic', 'legendary', 'sovereign']);
const EPIC_IDS = new Set([
  'boss_all', 'lv99', 'hunt5000', 'duel200', 'redhunt200', 'pk200',
  'merit10k', 'sin10k', 'cp_top3',
]);
const RARE_IDS = new Set([
  'boss_tiger', 'boss_krasue', 'boss_pop', 'lv30', 'lv50', 'lv75',
  'hunt1000', 'medic', 'duel50', 'redhunt50', 'pk50', 'merit1000',
  'sin2k', 'cp_top10',
]);

export function titleTier(title) {
  if (!title) return 'common';
  if (title.dynamic && title.holders === 1) return 'sovereign';
  if (title.cat === 'legend' || title.glow) return 'legendary';
  if (EPIC_IDS.has(title.id)) return 'epic';
  if (RARE_IDS.has(title.id)) return 'rare';
  return 'common';
}

// Existing blood/sin titles share a killer frame; class and PK toggle are not
// inputs, and title prestige/unlock requirements remain independent.
const KILLER_IDS = new Set(['pk1', 'pk10', 'pk50', 'pk200', 'sin2k', 'sin10k', 'lg_sin50k']);
const GUARDIAN_IDS = new Set(['redhunt1', 'redhunt10', 'redhunt50', 'redhunt200', 'merit1000', 'merit10k', 'lg_merit50k']);
export function titleTheme(title) {
  if (KILLER_IDS.has(title?.id)) return 'killer';
  return GUARDIAN_IDS.has(title?.id) ? 'guardian' : 'heroic';
}
