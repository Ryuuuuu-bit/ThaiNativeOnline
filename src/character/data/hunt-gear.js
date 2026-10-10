import { EXPEDITIONS } from '../../world/expeditions.js';

// Three useful choices per accessory tier: physical, casting, and evasive play.
// These are authored base stats, separate from the instance's random affixes.
const PROFILES = [
  { id: 'guard', name: 'ผู้พิทักษ์', stat: 'str', support: 'hp', amounts: [1, 2, 3, 4, 4, 5, 6, 7, 8, 9, 10, 11], resources: [6, 10, 16, 22, 28, 36, 44, 52, 60, 68, 76, 84] },
  { id: 'sage', name: 'ผู้จารอาคม', stat: 'int', support: 'mp', amounts: [1, 2, 3, 4, 4, 5, 6, 7, 8, 9, 10, 11], resources: [6, 10, 16, 22, 28, 36, 44, 52, 60, 68, 76, 84] },
  { id: 'hunter', name: 'พราน', stat: 'dex', support: 'eva', amounts: [1, 2, 3, 4, 4, 5, 6, 7, 8, 9, 10, 11], resources: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
];
const TIERS = [
  { id: 'paddy', name: 'คันนา', level: 1, defense: 1, price: 20 },
  { id: 'grove', name: 'ดงไผ่', level: 6, defense: 2, price: 65 },
  { id: 'temple', name: 'วัดร้าง', level: 12, defense: 3, price: 150 },
  { id: 'marsh', name: 'บึงอาคม', level: 18, defense: 4, price: 270 },
  ...EXPEDITIONS.map((e, i) => ({ id: e.id, name: e.name, level: e.levels[0],
    defense: [5, 6, 8, 10, 12, 14, 16, 18][i], price: [420, 600, 850, 1100, 1400, 1700, 2000, 2400][i] })),
];
const ACCESSORIES = [
  { slot: 'head', name: 'ผ้าโพกศีรษะ', icon: '◠', image: 'pha_khao', weight: 2 },
  { slot: 'cape', name: 'ผ้าคลุมลงอักขระ', icon: '≋', image: 'sabai', weight: 2 },
  { slot: 'charm', name: 'ตะกรุดถักเชือก', icon: '⌬', image: 'takrut', weight: 1 },
];

export const HUNT_GEAR = Object.fromEntries(TIERS.flatMap((tier, index) =>
  ACCESSORIES.flatMap(accessory => PROFILES.map(profile => [
    `hunt_${tier.id}_${accessory.slot}_${profile.id}`,
    { name: `${accessory.name}${profile.name} · ${tier.name}`, type: 'equip', slot: accessory.slot,
      icon: accessory.icon, img: `ui/items/icon_${accessory.image}.png`, weight: accessory.weight,
      minLevel: tier.level, lootRegion: tier.id, archetype: profile.id,
      rarity: tier.level === 1 ? 'common' : 'rare', slots: 1, price: tier.price,
      bonus: { def: tier.defense, [profile.stat]: profile.amounts[index], [profile.support]: profile.resources[index] },
      desc: `เครื่องสวมใส่สาย${profile.name}แห่ง${tier.name} · ต้องการ Lv.${tier.level}`,
    },
  ]))));
