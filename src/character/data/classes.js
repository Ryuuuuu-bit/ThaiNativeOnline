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
// Every class starts with the same 30 points, put into the stats its play uses (a stat the
// class has no use for starts at 1), and grows 5 a level, only in those stats; the player
// adds POINTS_PER_LEVEL more where they like.
export const CLASSES = {
  muaythai: {
    name: 'มวยไทย', en: 'MUAY THAI', icon: '✊', tagline: 'ร่างกายคืออาวุธ จิตใจคือเกราะ',
    desc: 'นักสู้มือเปล่า หมัด เข่า ศอก ตีเร็ว ประชิดตัว',
    base: { str: 9, agi: 8, vit: 6, int: 1, dex: 3, luk: 3 }, growth: { str: 2, agi: 1.5, vit: 1, int: 0, dex: .5, luk: 0 },
    job: 'boxer',
    range: 1.4, attackSpeed: .75, color: '#e0785a',
    skills: ['jab', 'knee', 'elbow', 'waikru'],
  },
  warrior: {
    name: 'นักรบ', en: 'WARRIOR', icon: '⚔', tagline: 'ดาบของข้า ปกป้องผู้คนและแผ่นดินนี้',
    desc: 'ดาบสองมือแห่งกองอาสา ทนทานที่สุด รับหน้าศัตรู',
    base: { str: 9, agi: 3, vit: 10, int: 1, dex: 4, luk: 3 }, growth: { str: 2, agi: .5, vit: 2, int: 0, dex: .5, luk: 0 },
    job: 'swordman',
    range: 1.7, attackSpeed: 1.1, color: '#c9a35f',
    skills: ['slash', 'whirl', 'guard', 'rally'],
  },
  hunter: {
    name: 'นายพราน', en: 'HUNTER', icon: '🏹', tagline: 'ธรรมชาติคือเพื่อน ไม่มีสิ่งใดรอดพ้นสายตา',
    desc: 'ยิงธนูระยะไกล มีหมาคู่ใจช่วยกัดศัตรู',
    base: { str: 3, agi: 7, vit: 5, int: 1, dex: 10, luk: 4 }, growth: { str: 0, agi: 1.5, vit: 1, int: 0, dex: 2, luk: .5 },
    job: 'archer', ranged: true,
    range: 7, attackSpeed: .7, color: '#8fb36b', pet: 'dog',
    skills: ['shot', 'volley', 'snare', 'sic'],
  },
  shaman: {
    name: 'หมอผี', en: 'SHAMAN', icon: '☠', tagline: 'ข้าคือสะพานระหว่างสองโลก',
    desc: 'คาถาและยันต์ เวทแรงที่สุด ร่างบาง',
    base: { str: 2, agi: 3, vit: 5, int: 11, dex: 5, luk: 4 }, growth: { str: 0, agi: .5, vit: 1, int: 2.5, dex: 1, luk: 0 },
    job: 'mage', magic: true,
    range: 6, attackSpeed: 1.3, color: '#a98ae0',
    skills: ['bolt', 'yantra', 'curse', 'mend'],
  },
  herbalist: {
    name: 'หมอยา', en: 'HERBALIST', icon: '❦', tagline: 'พืชพาให้ชีวิต ยาก็รักษาได้',
    desc: 'ยาพิษกับยารักษา อยู่รอดนาน ฟื้นตัวเก่ง',
    base: { str: 2, agi: 4, vit: 8, int: 10, dex: 4, luk: 2 }, growth: { str: 0, agi: .5, vit: 1.5, int: 2, dex: 1, luk: 0 },
    job: 'healer', magic: true,
    range: 5.5, attackSpeed: 1.1, color: '#7fd67a',
    skills: ['dart', 'blight', 'grove', 'balm'],
  },
  assassin: {
    name: 'โจรป่า', en: 'ASSASSIN', icon: '🗡', tagline: 'เงาคือที่อยู่ของข้า ความเงียบคืออาวุธ',
    desc: 'มีดคู่ คริติคอลสูง หลบเก่ง แข็งแกร่งยามค่ำคืน',
    base: { str: 7, agi: 10, vit: 4, int: 1, dex: 3, luk: 5 }, growth: { str: 1, agi: 2, vit: .5, int: 0, dex: .5, luk: 1 },
    job: 'boxer',
    range: 1.5, attackSpeed: .7, color: '#9c6bd6', nightCrit: .12,
    skills: ['stab', 'shadow', 'smoke', 'venom'],
  },
};
// Saves from before the class rename.
export const CLASS_ALIASES = { swordsman: 'warrior' };


export const START_ITEMS = {
  // every class starts with its weapon and a cloth vest (RO: a novice's first set)
  muaythai: ['hand_wrap', 'cloth_vest'], warrior: ['wood_sword', 'cloth_vest'], hunter: ['short_bow', 'cloth_vest'],
  shaman: ['reed_wand', 'cloth_vest'], herbalist: ['herb_book', 'cloth_vest'], assassin: ['krabi', 'cloth_vest'],
};


// The weapon kinds each class wields (ITEMS[id].weapon). RO style: a bow is a hunter's, a book a
// herbalist's; anything else stays in the bag (Character.canWield).
export const WEAPON_KINDS = { muaythai: ['wrap'], warrior: ['sword'], hunter: ['bow'], shaman: ['talisman'], herbalist: ['book'], assassin: ['dagger'] };
export const WEAPON_KIND_TH = { sword: 'ดาบ', bow: 'ธนู', wrap: 'ผ้าพันมือ', dagger: 'มีดคู่', talisman: 'ผ้ายันต์', book: 'ตำรา' };
