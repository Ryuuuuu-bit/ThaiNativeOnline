// Content data only: the kit skill ids of each class, in hotbar order (keys 1–0), from the
// class moves files (src/classes/*-moves.js, pure data). The job-level skill rules
// (src/character/Character.js, SKILL_UNLOCK_JOB in progression.js) and the server read them.
import { MUAYTHAI_SKILLS } from '../../classes/muaythai-moves.js';
import { WARRIOR_SKILLS } from '../../classes/warrior-moves.js';
import { HUNTER_SKILLS } from '../../classes/hunter-moves.js';
import { SHAMAN_SKILLS } from '../../classes/shaman-moves.js';
import { HERBALIST_SKILLS } from '../../classes/herbalist-moves.js';

export const KIT_MOVES = { muaythai: MUAYTHAI_SKILLS, warrior: WARRIOR_SKILLS, hunter: HUNTER_SKILLS, shaman: SHAMAN_SKILLS, herbalist: HERBALIST_SKILLS };
export const KIT_SKILL_IDS = Object.fromEntries(Object.entries(KIT_MOVES).map(([cls, list]) => [cls, list.map(s => s.id)]));
