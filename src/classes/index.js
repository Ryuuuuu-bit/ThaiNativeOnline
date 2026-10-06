import { MUAYTHAI_SKILLS } from './muaythai-moves.js';
import { HERBALIST_SKILLS } from './herbalist-moves.js';
import { createBoxerSkills, SKILL_META, iconUrl } from './fx/boxer-skills.js';
import { createHerbalistSkills, herbIconUrl } from './fx/herbalist-skills.js';
import { HUNTER_SKILLS } from './hunter-moves.js';
import { createHunterSkills, hunterIconUrl } from './fx/hunter-skills.js';

// Class skill kits for the city training ground (src/training): the ten skills of
// each playable class with their FX runner and hotbar entries. AVATARS in
// src/data/training.js picks a kit with `skills: '<kit id>'`.
//
//   name     class name shown on the hotbar and the training panel
//   ground   title of the training panel
//   skills   hotbar entries { id, key, name, lv, cd, desc, icon, clip, hits, … }
//   createSkills({ fx, character, player, dummy, groundHeight, labels, dim, damage })
//            → { cast(id, quiet), update(dt), busy, facing, range }
export const CLASS_KITS = {
  muaythai: {
    name: 'มวยไทย', ground: 'ลานซ้อมมวย · หุ่นฟาง', createSkills: createBoxerSkills,
    skills: MUAYTHAI_SKILLS.map(s => ({ ...s, ...SKILL_META[s.id], icon: iconUrl(s.id) })),
  },
  herbalist: {
    name: 'หมอยา', ground: 'ลานซ้อมหมอยา · หุ่นฟาง', createSkills: createHerbalistSkills,
    skills: HERBALIST_SKILLS.map(s => ({ ...s, icon: herbIconUrl(s.id) })),
  },
  hunter: {
    name: 'นายพราน', ground: 'ลานซ้อมยิงธนู · หุ่นฟาง', createSkills: createHunterSkills,
    skills: HUNTER_SKILLS.map(s => ({ ...s, icon: hunterIconUrl(s.id) })),
  },
};
export const KIT_IDS = Object.keys(CLASS_KITS);
