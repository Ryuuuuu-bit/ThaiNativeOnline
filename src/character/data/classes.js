// Content data only: edit freely without touching game logic.
export const STATS = ['str', 'agi', 'int', 'vit'];
export const STAT_LABELS = { str: 'พลัง', agi: 'ว่องไว', int: 'ปัญญา', vit: 'อึด' };

// Six callings from the concept sheet. tagline is shown on the creation screen.
export const CLASSES = {
  muaythai: {
    name: 'มวยไทย', en: 'MUAY THAI', icon: '✊', tagline: 'ร่างกายคืออาวุธ จิตใจคือเกราะ',
    desc: 'นักสู้มือเปล่า หมัด เข่า ศอก ตีเร็ว ประชิดตัว',
    base: { str: 8, agi: 7, int: 2, vit: 6 }, growth: { str: 2, agi: 2, int: 0, vit: 1 },
    range: 1.4, attackSpeed: .75, color: '#e0785a',
    skills: ['jab', 'knee', 'elbow', 'waikru'],
  },
  warrior: {
    name: 'นักรบ', en: 'WARRIOR', icon: '⚔', tagline: 'ดาบของข้า ปกป้องผู้คนและแผ่นดินนี้',
    desc: 'ดาบสองมือแห่งกองอาสา ทนทานที่สุด รับหน้าศัตรู',
    base: { str: 8, agi: 4, int: 2, vit: 8 }, growth: { str: 2, agi: 1, int: 0, vit: 2 },
    range: 1.7, attackSpeed: 1.1, color: '#c9a35f',
    skills: ['slash', 'whirl', 'guard', 'rally'],
  },
  hunter: {
    name: 'นายพราน', en: 'HUNTER', icon: '🏹', tagline: 'ธรรมชาติคือเพื่อน ไม่มีสิ่งใดรอดพ้นสายตา',
    desc: 'ยิงธนูระยะไกล มีหมาคู่ใจช่วยกัดศัตรู',
    base: { str: 5, agi: 9, int: 3, vit: 5 }, growth: { str: 1, agi: 2, int: 1, vit: 1 },
    range: 7, attackSpeed: .9, color: '#8fb36b', pet: 'dog',
    skills: ['shot', 'volley', 'snare', 'sic'],
  },
  shaman: {
    name: 'หมอผี', en: 'SHAMAN', icon: '☠', tagline: 'ข้าคือสะพานระหว่างสองโลก',
    desc: 'คาถาและยันต์ เวทแรงที่สุด ร่างบาง',
    base: { str: 3, agi: 4, int: 10, vit: 5 }, growth: { str: 0, agi: 1, int: 3, vit: 1 },
    range: 6, attackSpeed: 1.3, color: '#a98ae0',
    skills: ['bolt', 'yantra', 'curse', 'mend'],
  },
  herbalist: {
    name: 'หมอยา', en: 'HERBALIST', icon: '❦', tagline: 'พืชพาให้ชีวิต ยาก็รักษาได้',
    desc: 'ยาพิษกับยารักษา อยู่รอดนาน ฟื้นตัวเก่ง',
    base: { str: 3, agi: 5, int: 8, vit: 7 }, growth: { str: 0, agi: 1, int: 2, vit: 2 },
    range: 5.5, attackSpeed: 1.1, color: '#7fd67a',
    skills: ['dart', 'blight', 'grove', 'balm'],
  },
  assassin: {
    name: 'โจรป่า', en: 'ASSASSIN', icon: '🗡', tagline: 'เงาคือที่อยู่ของข้า ความเงียบคืออาวุธ',
    desc: 'มีดคู่ คริติคอลสูง หลบเก่ง แข็งแกร่งยามค่ำคืน',
    base: { str: 5, agi: 10, int: 3, vit: 4 }, growth: { str: 1, agi: 3, int: 0, vit: 1 },
    range: 1.5, attackSpeed: .7, color: '#9c6bd6', nightCrit: .12,
    skills: ['stab', 'shadow', 'smoke', 'venom'],
  },
};
// Saves from before the class rename.
export const CLASS_ALIASES = { swordsman: 'warrior' };


export const START_ITEMS = {
  muaythai: ['hand_wrap'], warrior: ['wood_sword', 'cloth_vest'], hunter: ['cloth_vest'],
  shaman: ['cloth_vest'], herbalist: ['herb_staff', 'cloth_vest'], assassin: ['krabi'],
};

