import { EXPEDITIONS } from '../../world/expeditions.js';
import { expeditionGearIds } from '../../character/data/expedition-gear.js';
import { ITEMS } from '../../character/data/items.js';
// Content data only: edit freely without touching game logic.
// Each entry: [itemId, chance 0..1, min, max] — every entry rolls on its own, so a kill can drop several.
// Every table carries a little HP potion and น้ำผึ้งป่า (MP): hunting pays for its own supplies, a bit.
// Ordinary hunts offer 2–3% per weapon, and each tier has one weapon of every kind
// (sword · bow · wrap · dagger · talisman · book) so no class farms for nothing.
const WEAPON_POOLS = {
  low: ['tiger_wrap', 'bone_dagger', 'iron_dap', 'bamboo_bow', 'palm_book', 'bone_yant'],
  mid: ['kris', 'horn_bow', 'croc_wrap', 'croc_dagger', 'bog_book', 'bog_yant'],
};
const WEAPON_DROPS = {
  beast: ['low', .03], spirit: ['low', .03],
  marsh: ['mid', .025], spirit2: ['mid', .025],
  rare: ['low', .30], boss: ['low', .35], pop: ['low', .45],
  rare2: ['mid', .30], chalawan: ['mid', .40],
};

// Keep the existing supplies and gear roster, then apply the shared balance recipe.
const REGIONAL_LOOT = {
  beast:  [['hide', .6, 1, 2], ['tusk', .35, 1, 1], ['potion_s', .22, 1, 1], ['ether', .1, 1, 1], ['cloth_vest', .04, 1, 1], ['hide_armor', .03, 1, 1], ['mongkol', .02, 1, 1], ['sandals', .04, 1, 1], ['hide_boots', .02, 1, 1], ['tiger_wrap', .012, 1, 1], ['bone_dagger', .012, 1, 1]],
  spirit: [['ash', .6, 1, 2], ['ether', .25, 1, 1], ['potion_s', .2, 1, 1], ['takrut', .06, 1, 1], ['palm_book', .02, 1, 1], ['bone_yant', .02, 1, 1], ['iron_dap', .012, 1, 1], ['bamboo_bow', .012, 1, 1], ['pakhaoma', .04, 1, 1], ['sabai', .02, 1, 1]],
  rare:   [['potion_m', 1, 2, 3], ['ether', .8, 1, 2], ['takrut', .6, 1, 1], ['tiger_fang', .2, 1, 1], ['palm_book', .25, 1, 1], ['bone_yant', .25, 1, 1], ['tiger_wrap', .2, 1, 1], ['bone_dagger', .2, 1, 1], ['ash', 1, 3, 5], ['chada', .3, 1, 1], ['prakam', .15, 1, 1]],
  pop:    [['potion_m', 1, 3, 4], ['ether', 1, 1, 2], ['tiger_fang', .5, 1, 1], ['takrut', .6, 1, 1], ['iron_dap', .4, 1, 1], ['bamboo_bow', .4, 1, 1], ['palm_book', .25, 1, 1], ['bone_yant', .25, 1, 1], ['tiger_wrap', .3, 1, 1], ['bone_dagger', .3, 1, 1], ['mongkol', .4, 1, 1], ['chada', .4, 1, 1], ['prakam', .25, 1, 1]],
  // คลองหนองบึง
  marsh:   [['hide', .6, 1, 3], ['croc_scale', .35, 1, 2], ['potion_m', .22, 1, 1], ['ether', .12, 1, 1], ['croc_boots', .02, 1, 1], ['croc_armor', .012, 1, 1], ['kris', .01, 1, 1], ['horn_bow', .01, 1, 1], ['croc_wrap', .01, 1, 1], ['croc_dagger', .01, 1, 1]],
  spirit2: [['ash', .7, 1, 3], ['ether', .3, 1, 2], ['potion_m', .2, 1, 1], ['pakhaoma', .04, 1, 1], ['sabai', .03, 1, 1], ['bog_book', .01, 1, 1], ['bog_yant', .01, 1, 1]],
  rare2:   [['potion_m', 1, 2, 3], ['ether', 1, 1, 2], ['ash', 1, 3, 6], ['bog_book', .2, 1, 1], ['bog_yant', .2, 1, 1], ['chada', .3, 1, 1], ['prakam', .15, 1, 1]],
  chalawan: [['potion_m', 1, 3, 5], ['ether', 1, 2, 3], ['croc_scale', 1, 4, 8], ['chalawan_fang', .3, 1, 1], ['croc_armor', .5, 1, 1], ['kris', .3, 1, 1], ['horn_bow', .3, 1, 1], ['croc_wrap', .3, 1, 1], ['croc_dagger', .3, 1, 1], ['bog_book', .2, 1, 1], ['bog_yant', .2, 1, 1]],
  boss:   [['potion_m', 1, 1, 2], ['ether', .8, 1, 1], ['tiger_fang', .35, 1, 1], ['iron_dap', .25, 1, 1], ['bamboo_bow', .25, 1, 1], ['tiger_wrap', .25, 1, 1], ['bone_dagger', .25, 1, 1], ['palm_book', .2, 1, 1], ['bone_yant', .2, 1, 1], ['hide_armor', .3, 1, 1]],
};

function regionalDrops(entries, [tier, requestedChance]) {
  const pool = WEAPON_POOLS[tier];
  // Equal chances may rise to preserve an existing higher rate, but never fall.
  const weaponChance = Math.max(requestedChance, ...entries.filter(([id]) => pool.includes(id)).map(([, chance]) => chance));
  const drops = new Map(entries.map(([id, chance, min, max]) => {
    const item = ITEMS[id];
    const boosted = item?.type === 'equip' && item.slot !== 'weapon' ? Math.min(1, chance * 1.5) : chance;
    return [id, [id, boosted, min, max]];
  }));
  for (const id of pool) drops.set(id, [id, weaponChance, 1, 1]);
  return [...drops.values()]; // one independent roll per ID, including existing weapons
}

export const LOOT = Object.fromEntries(Object.entries(REGIONAL_LOOT).map(([name, entries]) => [name, regionalDrops(entries, WEAPON_DROPS[name])]));

for (const expedition of EXPEDITIONS) {
  for (const boss of [false, true]) {
    LOOT[`${boss ? 'boss' : 'hunt'}_${expedition.id}`] = [
      ['ash', .6, 1, 3],
      ['potion_m', boss ? 1 : .2, 1, boss ? 3 : 1],
      ['ether', boss ? 1 : .2, 1, 2],
      ...expeditionGearIds(expedition).map(id => [id, boss ? .25 : .02, 1, 1]),
    ];
  }
}
