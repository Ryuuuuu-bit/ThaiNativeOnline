import { COMPLETE_PAINTED_ITEM_ICONS } from './complete-painted-item-icons.js';

// Preserve the first approved V2 source set and its exact production paths.
export const SAMPLE_PAINTED_ITEM_IDS = Object.freeze([
  'dusk_fort_book', 'dusk_fort_sword', 'hunt_dusk_fort_head_sage',
  'dusk_fort_armor', 'hunt_dusk_fort_cape_sage', 'wear_dusk_fort_gloves_guard',
  'wear_dusk_fort_belt_guard', 'dusk_fort_shoes', 'wear_dusk_fort_ring_sage',
  'wear_dusk_fort_amulet_sage', 'flask_hp_6', 'flask_mp_6', 'takrut', 'bia_kae', 'prakam',
]);
export const PAINTED_ITEM_ICONS = COMPLETE_PAINTED_ITEM_ICONS;
export const PAINTED_ITEM_IDS = Object.freeze(Object.keys(PAINTED_ITEM_ICONS));
