// Approved hand-painted skill illustrations. Artwork is separate from gameplay data.
export const PAINTED_SKILL_CLASSES = Object.freeze({
  "boxer_jab": "muaythai",
  "boxer_kick": "muaythai",
  "boxer_croc": "muaythai",
  "boxer_waikru": "muaythai",
  "boxer_ngouy": "muaythai",
  "boxer_drum": "muaythai",
  "boxer_elbow": "muaythai",
  "boxer_knee": "muaythai",
  "boxer_iron": "muaythai",
  "boxer_hanuman": "muaythai",
  "heal_vine": "herbalist",
  "heal_pill": "herbalist",
  "heal_zone": "herbalist",
  "heal_tiger": "herbalist",
  "heal_khwan": "herbalist",
  "heal_mortar": "herbalist",
  "heal_mist": "herbalist",
  "heal_tonic": "herbalist",
  "heal_mother": "herbalist",
  "heal_amrita": "herbalist",
  "arch_quick": "hunter",
  "arch_poison": "hunter",
  "arch_pierce": "hunter",
  "arch_hawk": "hunter",
  "arch_rain": "hunter",
  "arch_garuda": "hunter",
  "arch_volley": "hunter",
  "arch_trap": "hunter",
  "arch_snipe": "hunter",
  "arch_meteor": "hunter",
  "sword_twin": "warrior",
  "sword_thrust": "warrior",
  "sword_wind": "warrior",
  "sword_guard": "warrior",
  "sword_pikat": "warrior",
  "sword_banner": "warrior",
  "sword_whirl": "warrior",
  "sword_leap": "warrior",
  "sword_berserk": "warrior",
  "sword_execute": "warrior",
  "mage_akom": "shaman",
  "mage_yant": "shaman",
  "mage_shield": "shaman",
  "mage_thunder": "shaman",
  "mage_kalp": "shaman",
  "mage_holy": "shaman",
  "mage_ghostfire": "shaman",
  "mage_curse": "shaman",
  "mage_meditate": "shaman",
  "mage_storm": "shaman",
  "sword_t_mastery": "warrior",
  "sword_t_breath": "warrior",
  "sword_t_hide": "warrior",
  "boxer_t_wit": "muaythai",
  "boxer_t_shin": "muaythai",
  "boxer_t_calm": "muaythai",
  "arch_t_eye": "hunter",
  "arch_t_bow": "hunter",
  "arch_t_bond": "hunter",
  "mage_t_tongue": "shaman",
  "mage_t_fire": "shaman",
  "mage_t_barami": "shaman",
  "heal_t_recipe": "herbalist",
  "heal_t_venom": "herbalist",
  "heal_t_hands": "herbalist"
});

export function paintedSkillIcon(id, base = '/') {
  return Object.hasOwn(PAINTED_SKILL_CLASSES, id)
    ? base + 'ui/skills/painted-complete-v1/' + id + '.webp' : null;
}

// Resolve only our known local skill paths; preserve other icons and URL suffixes.
export function resolvePaintedSkillIcon(url, base = '/') {
  const value = String(url);
  if (/^[a-z][a-z0-9+.-]*:|^\/\//i.test(value)) return value;
  const match = value.match(/^(.*)fx\/(muaythai|warrior|hunter|shaman|herbalist)\/icon_([a-z0-9_]+)\.png([?#].*)?$/);
  if (!match || (match[1] && !match[1].endsWith('/')) || PAINTED_SKILL_CLASSES[match[3]] !== match[2]) return value;
  return paintedSkillIcon(match[3], match[1] === '/' ? base : match[1]) + (match[4] || '');
}

export function isPaintedSkillIcon(url) {
  const match = String(url).match(/(?:^|\/)ui\/skills\/painted-complete-v1\/([a-z0-9_]+)\.webp(?:[?#].*)?$/);
  return Boolean(match && Object.hasOwn(PAINTED_SKILL_CLASSES, match[1]));
}
