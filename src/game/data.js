// Game data tables: classes, skills, monsters, items, loot. Pure data, no Three.js.

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

// kind: 'damage' (single target), 'aoe' (around caster or target), 'buff', 'heal', 'debuff', 'pet'
// scale: which stat multiplies the hit; power: multiplier of base damage.
// buff fields: def (damage reduction ratio), atk (attack ratio), dodge (extra dodge), hot (max-HP ratio healed per second)
export const SKILLS = {
  jab:    { name: 'หมัดตรง', icon: '✊', kind: 'damage', scale: 'str', power: .9, mp: 0, cd: 0, basic: true, fx: '#ffd2a0' },
  knee:   { name: 'เข่าลอย', icon: '⤒', kind: 'damage', scale: 'str', power: 2.3, mp: 10, cd: 6, fx: '#ff9a5c' },
  elbow:  { name: 'ศอกกลับ', icon: '↺', kind: 'aoe', scale: 'str', power: 1.3, mp: 12, cd: 8, radius: 2.2, around: 'self', debuff: { id: 'slow', slow: .4, duration: 3 } },
  waikru: { name: 'ไหว้ครู', icon: '🙏', kind: 'buff', mp: 12, cd: 25, buff: { id: 'waikru', atk: .3, duration: 12 } },
  slash:  { name: 'ฟันดาบ', icon: '⚔', kind: 'damage', scale: 'str', power: 1, mp: 0, cd: 0, basic: true },
  whirl:  { name: 'ดาบหมุนวน', icon: '◎', kind: 'aoe', scale: 'str', power: 1.5, mp: 12, cd: 6, radius: 2.6, around: 'self' },
  guard:  { name: 'ตั้งการ์ด', icon: '⛨', kind: 'buff', mp: 10, cd: 18, buff: { id: 'guard', def: .5, duration: 8 } },
  rally:  { name: 'ยาดม', icon: '✚', kind: 'heal', mp: 14, cd: 20, heal: .3 },
  shot:   { name: 'ยิงธนู', icon: '➶', kind: 'damage', scale: 'agi', power: 1, mp: 0, cd: 0, basic: true, projectile: '#e8d9a0' },
  volley: { name: 'ฝนลูกธนู', icon: '⇶', kind: 'aoe', scale: 'agi', power: 1.3, mp: 14, cd: 7, radius: 2.4, around: 'target' },
  snare:  { name: 'บ่วงพราน', icon: '⌇', kind: 'debuff', scale: 'agi', power: .8, mp: 8, cd: 10, debuff: { id: 'slow', slow: .5, duration: 5 }, projectile: '#b7d48a' },
  sic:    { name: 'ไอ้ด่าง ลุย!', icon: '🐕', kind: 'pet', mp: 10, cd: 14, power: 2.2, frenzy: 6 },
  bolt:   { name: 'ลูกไฟอาคม', icon: '✦', kind: 'damage', scale: 'int', power: 1.15, mp: 3, cd: 0, basic: true, projectile: '#c69bff' },
  yantra: { name: 'ยันต์เพลิง', icon: '卍', kind: 'aoe', scale: 'int', power: 1.9, mp: 18, cd: 8, radius: 2.8, around: 'target' },
  curse:  { name: 'คุณไสย', icon: '☠', kind: 'debuff', scale: 'int', power: .6, mp: 12, cd: 12, debuff: { id: 'dot', dot: .35, duration: 6 }, projectile: '#b48ad8' },
  mend:   { name: 'น้ำมนต์', icon: '❀', kind: 'heal', mp: 16, cd: 12, heal: .4 },
  dart:   { name: 'ลูกดอกสมุนไพร', icon: '➹', kind: 'damage', scale: 'int', power: 1, mp: 2, cd: 0, basic: true, projectile: '#9cf07a' },
  blight: { name: 'ยาพิษใบไม้', icon: '🍃', kind: 'aoe', scale: 'int', power: .9, mp: 14, cd: 9, radius: 2.6, around: 'target', debuff: { id: 'dot', dot: .25, duration: 6 } },
  grove:  { name: 'วงสมุนไพร', icon: '✿', kind: 'buff', mp: 16, cd: 20, buff: { id: 'regen', hot: .06, duration: 8 } },
  balm:   { name: 'ยาหอมโบราณ', icon: '⚱', kind: 'heal', mp: 18, cd: 10, heal: .45 },
  stab:   { name: 'แทงมีด', icon: '🗡', kind: 'damage', scale: 'agi', power: .75, mp: 0, cd: 0, basic: true, fx: '#c9a6ff' },
  shadow: { name: 'จู่โจมเงา', icon: '☾', kind: 'damage', scale: 'agi', power: 2, mp: 14, cd: 8, alwaysCrit: true, fx: '#8a4dff' },
  smoke:  { name: 'ม่านควัน', icon: '☁', kind: 'buff', mp: 10, cd: 18, buff: { id: 'smoke', dodge: .5, duration: 5 } },
  venom:  { name: 'มีดอาบยาพิษ', icon: '☣', kind: 'debuff', scale: 'agi', power: .9, mp: 10, cd: 10, debuff: { id: 'dot', dot: .4, duration: 6 } },
};

export const BUFF_ICONS = { guard: '⛨', waikru: '🙏', regen: '✿', smoke: '☁' };

export const MONSTERS = {
  boar:   { name: 'หมูป่า', level: 1, hp: 125, atk: 13, def: 2, speed: 2.6, range: 1.3, aggro: 4.5, exp: 18, gold: [2, 6], color: '#6b5241', size: .8, shape: 'boar', loot: 'beast' },
  monkey: { name: 'ลิงกัง', level: 2, hp: 120, atk: 15, def: 1, speed: 3.4, range: 1.2, aggro: 6, exp: 22, gold: [3, 8], color: '#8d7350', size: .6, shape: 'monkey', loot: 'beast' },
  pray:   { name: 'ผีพราย', level: 4, hp: 280, atk: 22, def: 4, speed: 2.2, range: 1.4, aggro: 6.5, exp: 45, gold: [6, 14], color: '#a8d3c6', size: .9, shape: 'spirit', loot: 'spirit' },
  phibpa: { name: 'ผีป่า', level: 3, hp: 210, atk: 19, def: 3, speed: 2.4, range: 1.4, aggro: 6, exp: 38, gold: [5, 11], color: '#7fae8a', size: .85, shape: 'spirit', loot: 'spirit' },
  krasue: { name: 'กระสือ', level: 7, hp: 1300, atk: 42, def: 6, speed: 3.6, range: 1.5, aggro: 8, exp: 260, gold: [40, 80], color: '#ff5a3c', size: 1, shape: 'krasue', loot: 'rare', elite: true, rare: true },
  winyan: { name: 'วิญญาณเร่ร่อน', level: 5, hp: 330, atk: 25, def: 4, speed: 2.3, range: 1.4, aggro: 6.5, exp: 60, gold: [7, 15], color: '#9fc4ff', size: .9, shape: 'spirit', loot: 'spirit' },
  phitaihong: { name: 'ผีตายโหง', level: 7, hp: 520, atk: 32, def: 6, speed: 2.6, range: 1.5, aggro: 7, exp: 95, gold: [10, 20], color: '#e07070', size: 1.05, shape: 'spirit', loot: 'spirit' },
  pop:    { name: 'ปอบ', level: 10, hp: 3200, atk: 52, def: 10, speed: 2.9, range: 1.8, aggro: 9, exp: 600, gold: [90, 160], color: '#5d6b4f', size: 1.6, shape: 'monkey', loot: 'pop', elite: true, boss: true },
  tiger:  { name: 'เสือสมิง', level: 6, hp: 1500, atk: 40, def: 8, speed: 3.1, range: 1.6, aggro: 7, exp: 140, gold: [25, 50], color: '#c98a3d', size: 1.25, shape: 'tiger', loot: 'boss', elite: true },
};

// Spawn zones in world coordinates of the forest prototype map.
// time: 'day' | 'night' | 'any', or active: [clock phases] (morning, day, evening, night). Day is wildlife; night brings ghosts, the
// shapeshifter tiger and a rare krasue that only sometimes appears.
export const SPAWNS = [
  { type: 'boar', x: -8, z: 12, radius: 4, count: 3, time: 'day' },
  { type: 'monkey', x: 6, z: 12, radius: 4, count: 3, time: 'day' },
  { type: 'phibpa', x: -8, z: 12, radius: 4, count: 3, time: 'night' },
  { type: 'phibpa', x: 6, z: 12, radius: 4, count: 2, time: 'night' },
  { type: 'pray', x: -10, z: -12, radius: 4, count: 3, time: 'any' },
  { type: 'tiger', x: 5, z: -16, radius: 2, count: 1, respawn: 60, time: 'night' },
  { type: 'krasue', x: -14, z: -4, radius: 3, count: 1, respawn: 120, chance: .4, time: 'night' },
];

// Night is a different mood and a riskier, richer hunt.
export const NIGHT = { expBonus: 1.25, ghostPower: 1.2 };

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

// Each entry: [itemId, chance 0..1, min, max]
export const LOOT = {
  beast:  [['hide', .6, 1, 2], ['tusk', .35, 1, 1], ['potion_s', .25, 1, 1], ['cloth_vest', .04, 1, 1], ['hide_armor', .03, 1, 1], ['mongkol', .02, 1, 1]],
  spirit: [['ash', .6, 1, 2], ['ether', .3, 1, 1], ['potion_s', .2, 1, 1], ['takrut', .06, 1, 1], ['bone_wand', .04, 1, 1]],
  rare:   [['potion_m', 1, 2, 3], ['takrut', .6, 1, 1], ['tiger_fang', .2, 1, 1], ['bone_wand', .5, 1, 1], ['ash', 1, 3, 5]],
  pop:    [['potion_m', 1, 3, 4], ['tiger_fang', .5, 1, 1], ['takrut', .6, 1, 1], ['iron_dap', .4, 1, 1], ['bamboo_bow', .4, 1, 1], ['bone_wand', .4, 1, 1], ['mongkol', .4, 1, 1]],
  boss:   [['potion_m', 1, 1, 2], ['tiger_fang', .35, 1, 1], ['iron_dap', .3, 1, 1], ['bamboo_bow', .3, 1, 1], ['hide_armor', .3, 1, 1]],
};

export const START_ITEMS = {
  muaythai: ['hand_wrap'], warrior: ['wood_sword', 'cloth_vest'], hunter: ['cloth_vest'],
  shaman: ['cloth_vest'], herbalist: ['herb_staff', 'cloth_vest'], assassin: ['krabi'],
};

export const MAX_LEVEL = 30;
export const expToNext = level => Math.round(60 * level ** 1.6);
