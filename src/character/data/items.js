// Content data only: edit freely without touching game logic.
// slot: weapon | armor | charm; use: consumable effect
export const ITEMS = {
  potion_s: { name: 'ยาหม้อเล็ก', icon: '⚱', type: 'use', use: { hp: 60 }, price: 10, desc: 'ฟื้นฟู HP 60' },
  potion_m: { name: 'ยาหม้อใหญ่', icon: '⚱', type: 'use', use: { hp: 160 }, price: 30, desc: 'ฟื้นฟู HP 160' },
  ether:    { name: 'น้ำผึ้งป่า', icon: '❂', type: 'use', use: { mp: 50 }, price: 14, desc: 'ฟื้นฟู MP 50' },
  hide:     { name: 'หนังสัตว์', icon: '▤', type: 'material', price: 4, desc: 'วัตถุดิบ ขายได้' },
  tusk:     { name: 'เขี้ยวหมูป่า', icon: '⟆', type: 'material', price: 7, desc: 'วัตถุดิบ ขายได้' },
  ash:      { name: 'ขี้เถ้าธูป', icon: '∴', type: 'material', price: 9, desc: 'วัตถุดิบเวทมนตร์' },
  hand_wrap:  { name: 'ผ้าพันมือมงคล', icon: '🥊', type: 'equip', slot: 'weapon', bonus: { atk: 3 }, rarity: 'common', price: 15 },
  krabi:      { name: 'มีดสั้นคู่', icon: '🔪', type: 'equip', slot: 'weapon', bonus: { atk: 3 }, rarity: 'common', price: 15 },
  herb_staff: { name: 'ไม้เท้าสมุนไพร', icon: '🌿', type: 'equip', slot: 'weapon', bonus: { atk: 2, int: 1 }, rarity: 'common', price: 15 },
  mongkol:    { name: 'มงคลครูมวย', icon: '◯', type: 'equip', slot: 'charm', bonus: { atk: 5, str: 2, agi: 2 }, rarity: 'rare', price: 70 },
  wood_sword: { name: 'ดาบไม้ซ้อม', icon: '🗡', type: 'equip', slot: 'weapon', bonus: { atk: 3 }, rarity: 'common', price: 15 },
  iron_dap:   { name: 'ดาบเหล็กลาย', icon: '🗡', type: 'equip', slot: 'weapon', bonus: { atk: 9, str: 2 }, rarity: 'rare', price: 80 },
  bamboo_bow: { name: 'ธนูไม้ไผ่', icon: '🏹', type: 'equip', slot: 'weapon', bonus: { atk: 7, agi: 2 }, rarity: 'rare', price: 75 },
  bone_wand:  { name: 'ไม้เท้ากระดูก', icon: '⚚', type: 'equip', slot: 'weapon', bonus: { atk: 6, int: 3 }, rarity: 'rare', price: 75 },
  cloth_vest: { name: 'เสื้อผ้าฝ้าย', icon: '👕', type: 'equip', slot: 'armor', bonus: { def: 3 }, rarity: 'common', price: 15 },
  hide_armor: { name: 'เกราะหนังสัตว์', icon: '🥋', type: 'equip', slot: 'armor', bonus: { def: 8, vit: 2 }, rarity: 'rare', price: 70 },
  takrut:     { name: 'ตะกรุดโทน', icon: '⌬', type: 'equip', slot: 'charm', bonus: { def: 2, int: 2, hp: 20 }, rarity: 'rare', price: 60 },
  tiger_fang: { name: 'เขี้ยวเสือสมิง', icon: '☾', type: 'equip', slot: 'charm', bonus: { atk: 6, str: 3, agi: 3, crit: .08 }, rarity: 'epic', price: 300 },
};

export const RARITY_COLORS = { common: '#d9d3bd', rare: '#7fb7e8', epic: '#c79af0' };

