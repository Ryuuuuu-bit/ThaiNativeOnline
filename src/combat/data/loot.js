// Content data only: edit freely without touching game logic.
// Each entry: [itemId, chance 0..1, min, max] — every entry rolls on its own, so a kill can drop several.
// Every table carries a little HP potion and น้ำผึ้งป่า (MP): hunting pays for its own supplies, a bit.
// Gear is rare (RO style, 1–4 % from ordinary monsters) and each tier has one weapon of every kind
// (sword · bow · wrap · dagger · talisman · book) so no class farms for nothing.
export const LOOT = {
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
