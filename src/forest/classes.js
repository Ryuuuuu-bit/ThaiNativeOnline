import { MUAYTHAI_SKILLS } from './muaythai-moves.js';
import { HERBALIST_SKILLS } from './herbalist-moves.js';
import { createBoxerSkills, SKILL_META, iconUrl } from './fx/boxer-skills.js';
import { createHerbalistSkills, herbIconUrl } from './fx/herbalist-skills.js';

// Playable classes in the forest: 3D model, skill runner and hotbar entries.
// Pick one with ?class=<id> (the panel button switches between them).
export const CLASSES = {
  muaythai: {
    name: 'มวยไทย', model: 'models/muay-thai-fighter.glb', createSkills: createBoxerSkills,
    skills: MUAYTHAI_SKILLS.map(s => ({ ...s, ...SKILL_META[s.id], icon: iconUrl(s.id) })),
  },
  herbalist: {
    name: 'หมอยา', model: 'models/herbalist.glb', createSkills: createHerbalistSkills,
    skills: HERBALIST_SKILLS.map(s => ({ ...s, icon: herbIconUrl(s.id) })),
  },
};
export const CLASS_IDS = Object.keys(CLASSES);
