import { EXPEDITIONS } from '../../world/expeditions.js';

const tiers = [
  {id:'paddy',name:'คันนา',level:1}, {id:'grove',name:'ดงไผ่',level:6},
  {id:'temple',name:'วัดร้าง',level:12}, {id:'marsh',name:'บึงอาคม',level:18},
  ...EXPEDITIONS.map(e => ({id:e.id,name:e.name,level:e.levels[0]})),
];
const profiles = [
  {id:'guard',name:'ผู้พิทักษ์',stat:'str',support:'hp'},
  {id:'sage',name:'ผู้จารอาคม',stat:'int',support:'mp'},
  {id:'hunter',name:'พราน',stat:'dex',support:'eva'},
];
const kinds = [
  {slot:'gloves',id:'gloves',name:'ถุงมือหนังลงยันต์',weight:2},
  {slot:'belt',id:'belt',name:'เข็มขัดลายกนก',weight:2},
  {slot:'amulet',id:'amulet',name:'สร้อยพระเครื่อง',weight:1},
  {slot:'charm',id:'ring',name:'แหวนอักขระ',weight:1},
];

// New bases preserve all existing equipment IDs and accessory instances.
export const EXTENDED_GEAR = Object.fromEntries(tiers.flatMap((tier,i) =>
  kinds.flatMap(kind => profiles.map(profile => [
    `wear_${tier.id}_${kind.id}_${profile.id}`,
    {name:`${kind.name}${profile.name} · ${tier.name}`,type:'equip',slot:kind.slot,
      icon:kind.id === 'ring' ? '◌' : '◆',img:`ui/items/icon_extended_${kind.id}.svg`,
      weight:kind.weight,minLevel:tier.level,lootRegion:tier.id,archetype:profile.id,
      rarity:i === 0 ? 'common' : 'rare',price:[20,65,150,270,420,600,850,1100,1400,1700,2000,2400][i],
      slots:1,bonus:{...(kind.slot === 'gloves' || kind.slot === 'belt' ? {def:Math.max(1,Math.ceil(tier.level/8))} : {}),
        [profile.stat]:Math.max(1,Math.ceil(tier.level/10)),
        [profile.support]:profile.support === 'eva' ? Math.max(1,Math.ceil(tier.level/15)) : 6 + Math.ceil(tier.level*.7)},
      desc:`อุปกรณ์สาย${profile.name}แห่ง${tier.name} · ต้องการ Lv.${tier.level}`,
    },
  ]))));
