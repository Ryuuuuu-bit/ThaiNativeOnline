// Approved V2 art replaces only these exact item IDs, never a whole tier or category.
export const PAINTED_ITEM_IDS = Object.freeze([
  'dusk_fort_book', 'dusk_fort_sword', 'hunt_dusk_fort_head_sage',
  'dusk_fort_armor', 'hunt_dusk_fort_cape_sage', 'wear_dusk_fort_gloves_guard',
  'wear_dusk_fort_belt_guard', 'dusk_fort_shoes', 'wear_dusk_fort_ring_sage',
  'wear_dusk_fort_amulet_sage', 'flask_hp_6', 'flask_mp_6', 'takrut', 'bia_kae', 'prakam',
]);
export const PAINTED_ITEM_ICONS = Object.freeze(Object.fromEntries(
  PAINTED_ITEM_IDS.map(id => [id, `ui/items/painted-v2/${id}.webp`]),
));
