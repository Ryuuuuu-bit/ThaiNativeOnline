// Character class content. Pure data: no Three.js, no logic.
// Colours are CSS hex strings; stats are base values at level 1.
//
// appearance.hairStyle: 'topknot' | 'headcloth'
// appearance.sleeves:   true => arms use the shirt colour (long sleeves)
// weapon:               'sword' | 'staff' | 'bow' (see model.js WEAPON_BUILDERS)

export const DEFAULT_CLASS_ID = 'swordsman';

export const CLASSES = {
  swordsman: {
    id: 'swordsman',
    name: 'นักดาบ',
    nameEn: 'Swordsman',
    description: 'ทหารเดินเท้าแห่งกรุงศรีอยุธยา ถนัดดาบคู่กาย ยืนหยัดแนวหน้า',
    stats: { maxHp: 120, maxMp: 40, attack: 14, defense: 10, moveSpeed: 3.1 },
    weapon: 'sword',
    appearance: {
      hairStyle: 'topknot',
      sleeves: false,
      palette: {
        skin: '#cd9b72', shirt: '#e7d9ad', pants: '#665e4a', sash: '#944b35', hair: '#302b24',
        footwear: '#423a2c', weapon: '#aba58a', weaponGrip: '#71523b', accent: '#c5a05d',
        magic: '#ffe7a8', ring: '#e1c983',
      },
    },
  },

  mystic: {
    id: 'mystic',
    name: 'หมอผี',
    nameEn: 'Mystic',
    description: 'ผู้รู้วิชาอาคมแห่งป่าใหญ่ ใช้ไม้เท้าลงยันต์และสายสิญจน์ปัดเป่าภูตผี',
    stats: { maxHp: 85, maxMp: 120, attack: 9, defense: 6, moveSpeed: 3.0 },
    weapon: 'staff',
    appearance: {
      hairStyle: 'headcloth',
      sleeves: true,
      palette: {
        skin: '#b98763', shirt: '#3b3f5c', pants: '#2f2b26', sash: '#e8e1cf', hair: '#1f1b17',
        headcloth: '#8a3b2e', footwear: '#3a3127', weapon: '#6b4f36', weaponGrip: '#e8e1cf',
        accent: '#c5a05d', magic: '#9fe3c4', ring: '#e1c983',
      },
    },
  },

  archer: {
    id: 'archer',
    name: 'นักธนู',
    nameEn: 'Archer',
    description: 'พรานป่าผู้แม่นธนู ว่องไว เคลื่อนที่ไร้เสียงระหว่างแนวไม้',
    stats: { maxHp: 100, maxMp: 60, attack: 12, defense: 8, moveSpeed: 3.3 },
    weapon: 'bow',
    appearance: {
      hairStyle: 'topknot',
      sleeves: false,
      palette: {
        skin: '#c08f68', shirt: '#7d7a4f', pants: '#4f4636', sash: '#b0813e', hair: '#2a241d',
        footwear: '#3f3428', weapon: '#6e5034', weaponGrip: '#d8cfb4', accent: '#8f6a3c',
        magic: '#d9f0a3', ring: '#e1c983',
      },
    },
  },
};
