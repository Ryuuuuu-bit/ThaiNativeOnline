// Content data only: edit freely without touching game logic.
// The six base stats (docs/design/STATS_REFERENCE.md). Derived stats come from
// computeDerived in src/rules/stats.js, the same formulas the training ground uses.
export const STATS = ['str', 'agi', 'vit', 'int', 'dex', 'luk'];
export const STAT_LABELS = { str: 'พลัง', agi: 'ว่องไว', vit: 'อึด', int: 'ปัญญา', dex: 'ชำนาญ', luk: 'โชค' };
export const STAT_HINTS = {
  str: 'ATK ประชิด · น้ำหนักที่แบกได้',
  agi: 'ความเร็วตี · หลบหลีก',
  vit: 'HP สูงสุด · ป้องกัน',
  int: 'MATK เวท/ยา · MP สูงสุด',
  dex: 'แม่นยำ · ATK ธนู · ลดคูลดาวน์สกิล',
  luk: 'โอกาสคริ · แรงคริ',
};
export const POINTS_PER_LEVEL = 3;

// Six callings from the concept sheet. tagline is shown on the creation screen.
// job: rules job (src/rules/data/classes.js JOBS) for base HP/MP and crit bonus.
// ranged: ATK scales with DEX instead of STR. magic: skills scaling on INT deal MATK.
// growth: base stat gained per level (fractions add up; shown rounded down).
export const CLASSES = {
  muaythai: {
    name: 'มวยไทย', en: 'MUAY THAI', icon: '✊', tagline: 'ร่างกายคืออาวุธ จิตใจคือเกราะ',
    desc: 'นักสู้มือเปล่า หมัด เข่า ศอก ตีเร็ว ประชิดตัว',
    base: { str: 8, agi: 7, vit: 6, int: 2, dex: 4, luk: 3 }, growth: { str: 2, agi: 1.5, vit: 1, int: 0, dex: .5, luk: .5 },
    job: 'boxer',
    range: 1.4, attackSpeed: .75, color: '#e0785a',
    skills: ['jab', 'knee', 'elbow', 'waikru'],
  },
  warrior: {
    name: 'นักรบ', en: 'WARRIOR', icon: '⚔', tagline: 'ดาบของข้า ปกป้องผู้คนและแผ่นดินนี้',
    desc: 'ดาบสองมือแห่งกองอาสา ทนทานที่สุด รับหน้าศัตรู',
    base: { str: 8, agi: 4, vit: 8, int: 2, dex: 4, luk: 2 }, growth: { str: 2, agi: .5, vit: 2, int: 0, dex: .5, luk: 0 },
    job: 'swordman',
    range: 1.7, attackSpeed: 1.1, color: '#c9a35f',
    skills: ['slash', 'whirl', 'guard', 'rally'],
  },
  hunter: {
    name: 'นายพราน', en: 'HUNTER', icon: '🏹', tagline: 'ธรรมชาติคือเพื่อน ไม่มีสิ่งใดรอดพ้นสายตา',
    desc: 'ยิงธนูระยะไกล มีหมาคู่ใจช่วยกัดศัตรู',
    base: { str: 4, agi: 7, vit: 5, int: 3, dex: 9, luk: 4 }, growth: { str: .5, agi: 1, vit: 1, int: 0, dex: 2, luk: .5 },
    job: 'archer', ranged: true,
    range: 7, attackSpeed: .9, color: '#8fb36b', pet: 'dog',
    skills: ['shot', 'volley', 'snare', 'sic'],
  },
  shaman: {
    name: 'หมอผี', en: 'SHAMAN', icon: '☠', tagline: 'ข้าคือสะพานระหว่างสองโลก',
    desc: 'คาถาและยันต์ เวทแรงที่สุด ร่างบาง',
    base: { str: 2, agi: 4, vit: 5, int: 10, dex: 6, luk: 3 }, growth: { str: 0, agi: .5, vit: 1, int: 2.5, dex: 1, luk: 0 },
    job: 'mage', magic: true,
    range: 6, attackSpeed: 1.3, color: '#a98ae0',
    skills: ['bolt', 'yantra', 'curse', 'mend'],
  },
  herbalist: {
    name: 'หมอยา', en: 'HERBALIST', icon: '❦', tagline: 'พืชพาให้ชีวิต ยาก็รักษาได้',
    desc: 'ยาพิษกับยารักษา อยู่รอดนาน ฟื้นตัวเก่ง',
    base: { str: 3, agi: 5, vit: 7, int: 8, dex: 5, luk: 4 }, growth: { str: 0, agi: .5, vit: 1.5, int: 2, dex: 1, luk: 0 },
    job: 'healer', magic: true,
    range: 5.5, attackSpeed: 1.1, color: '#7fd67a',
    skills: ['dart', 'blight', 'grove', 'balm'],
  },
  assassin: {
    name: 'โจรป่า', en: 'ASSASSIN', icon: '🗡', tagline: 'เงาคือที่อยู่ของข้า ความเงียบคืออาวุธ',
    desc: 'มีดคู่ คริติคอลสูง หลบเก่ง แข็งแกร่งยามค่ำคืน',
    base: { str: 6, agi: 10, vit: 4, int: 2, dex: 5, luk: 6 }, growth: { str: 1, agi: 2, vit: .5, int: 0, dex: .5, luk: 1 },
    job: 'boxer',
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

