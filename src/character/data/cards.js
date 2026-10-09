// Monster cards: every monster drops its own card, very rarely, to whoever did the most
// damage (server/monsters.js rewards; offline src/combat/Combat.js kill). Like Ragnarok Online:
// a card goes into a free card slot of a piece of gear of its kind (weapon · armor · head · offhand ·
// cape · shoes · charm cards;
// each item has `slots`, 0–4, in src/character/data/items.js) and stays there for good — it
// travels with that item (bag, trade, sale) and works while the item is worn
// (src/character/Character.js insertCard; the item in the bag keeps `cards: [ids]`).
// หมออาคม (the occult shop, src/data/shops.js) takes them all out again, RO style: per card
// STRIP.gold and STRIP.ash ขี้เถ้าธูป, and a small chance that the item or the cards break
// (Character.stripCards; online the server rolls it, server/combatants.js).
//
// bonus keys: the gear keys (str agi vit int dex luk atk matk def hp mp crit critDmg acc eva) and
//   vs_<race>   more damage against that race (0.1 = +10%)
//   res_<race> / res_<element>   less damage taken from it (0.1 = −10%, all together at most 50%)
// Races and elements: src/combat/data/monsters.js.
import { MONSTERS } from '../../combat/data/monsters.js';
import { CARD_ILLUSTRATIONS } from './card-illustrations.js';
import { EXPEDITION_CARD_DEFS } from './expedition-cards.js';

export const CARD_RATE = { normal: .0002, elite: .0025, boss: .005 };   // 1 in 5000 · 1 in 400 · 1 in 200
export const RESIST_CAP = .5;
export const STRIP = { gold: 200, ash: 1, ok: .9, itemBreaks: .07, shop: 'occult' };   // the rest (3%): the cards break
export const RACE_LABELS = { beast: 'สัตว์', spirit: 'ผี', demon: 'อสูร' };
export const ELEMENT_LABELS = { earth: 'ดิน', water: 'น้ำ', fire: 'ไฟ', wind: 'ลม', dark: 'มืด' };

// Explicit PvE abilities, separate from the original flat socket bonuses.
// Copies of the same boss ability never stack; a collection entry grants nothing.
export const BOSS_CARD_EFFECTS = {
  buffalo: { id: 'buffalo_might', name: 'แรงเจ้าทุ่ง', description: 'ความเสียหายต่อเผ่าสัตว์เพิ่มขึ้น 12%', kind: 'outgoing', bonus: .12, race: 'beast' },
  takian: { id: 'takian_ward', name: 'อาคมพิทักษ์ตะเคียน', description: 'ความเสียหายต่อเผ่าอสูรเพิ่มขึ้น 12%', kind: 'outgoing', bonus: .12, race: 'demon' },
  pop: { id: 'pop_drain', name: 'กินแรงคืนชีวิต', description: 'โจมตีโดนฟื้น HP 3% ของความเสียหายจริง สูงสุด 2% ของ HP สูงสุด ทุก 2 วินาที ไม่รวมสัตว์คู่ใจและพิษ', kind: 'lifesteal', ratio: .03, maxHpRatio: .02, cooldown: 2 },
  pusom: { id: 'pusom_spirit', name: 'ปู่โสมคืนพลัง', description: 'เมื่อเป็นผู้ได้รับรางวัลไอเทมจากมอนสเตอร์ ฟื้น SP 2% ของ SP สูงสุด ทุก 5 วินาที', kind: 'killMp', ratio: .02, cooldown: 5 },
  chalawan: { id: 'chalawan_guard', name: 'เกล็ดชาละวัน', description: 'รับความเสียหายจากมอนสเตอร์ลดลง 15% เมื่อ HP ไม่เกิน 40%', kind: 'incoming', reduction: .15, hpAtMost: .4 },
  bamboo_grave_3: { id: 'bamboo_spirit', name: 'ข่มวิญญาณป่าช้า', description: 'ความเสียหายต่อเผ่าผีเพิ่มขึ้น 18%', kind: 'outgoing', bonus: .18, race: 'spirit' },
  sealed_mine_3: { id: 'mine_guard', name: 'เกราะเหมืองผนึก', description: 'รับความเสียหายจากมอนสเตอร์ลดลง 10% เมื่อ HP ตั้งแต่ 80%', kind: 'incoming', reduction: .1, hpAtLeast: .8 },
  sunken_city_3: { id: 'sunken_water', name: 'ศาสตรานครบาดาล', description: 'ความเสียหายต่อธาตุน้ำเพิ่มขึ้น 18%', kind: 'outgoing', bonus: .18, element: 'water' },
  dusk_fort_3: { id: 'dusk_resolve', name: 'ฮึดสู้ยามสนธยา', description: 'ความเสียหายเพิ่มขึ้น 15% เมื่อ HP ไม่เกิน 50%', kind: 'outgoing', bonus: .15, hpAtMost: .5 },
  giant_valley_3: { id: 'giant_slayer', name: 'ปราบเจ้าแห่งหุบผา', description: 'ความเสียหายต่อบอสเพิ่มขึ้น 18%', kind: 'outgoing', bonus: .18, boss: true },
  himmapan_3: { id: 'himmapan_wind', name: 'ศาสตราหิมพานต์', description: 'ความเสียหายต่อธาตุลมเพิ่มขึ้น 18%', kind: 'outgoing', bonus: .18, element: 'wind' },
  fallen_city_3: { id: 'fallen_dark', name: 'แสงนครล่ม', description: 'ความเสียหายต่อธาตุมืดเพิ่มขึ้น 18%', kind: 'outgoing', bonus: .18, element: 'dark' },
  demon_rift_3: { id: 'rift_pact', name: 'พันธสัญญารอยแยก', description: 'ความเสียหายเพิ่มขึ้น 25% แต่รับความเสียหายจากมอนสเตอร์เพิ่มขึ้น 10%', kind: 'outgoing', bonus: .25, incomingPenalty: .1 },
};

// monster id → { slot, bonus }
const CARD_DEFS = {
  // ---- beasts ----
  boar:     { slot: 'weapon', bonus: { atk: 4, str: 1 } },
  monkey:   { slot: 'weapon', bonus: { agi: 2, acc: 5 } },
  fowl:     { slot: 'shoes', bonus: { agi: 1, eva: 5 } },
  cobra:    { slot: 'weapon', bonus: { dex: 1, vs_beast: .1 } },
  crab:     { slot: 'charm', bonus: { def: 4, res_water: .1 } },
  dhole:    { slot: 'weapon', bonus: { agi: 1, crit: .04 } },
  monitor:  { slot: 'head', bonus: { vit: 2, hp: 40 } },
  buffalo:  { slot: 'armor', bonus: { vit: 4, hp: 80, res_beast: .1 } },
  // ---- spirits ----
  phibpa:   { slot: 'cape', bonus: { hp: 30, res_spirit: .08 } },
  pray:     { slot: 'weapon', bonus: { vs_spirit: .1 } },
  kongkoi:  { slot: 'shoes', bonus: { agi: 3 } },
  khamot:   { slot: 'head', bonus: { int: 2, mp: 30 } },
  winyan:   { slot: 'armor', bonus: { res_dark: .12 } },
  phitaihong: { slot: 'weapon', bonus: { luk: 2, crit: .05 } },
  headless: { slot: 'weapon', bonus: { atk: 6, critDmg: .1 } },
  pret:     { slot: 'charm', bonus: { mp: 50 } },
  krahang:  { slot: 'cape', bonus: { eva: 8 } },
  soldier:  { slot: 'charm', bonus: { def: 7 } },
  takian:   { slot: 'charm', bonus: { int: 4, matk: 8 } },
  pusom:    { slot: 'charm', bonus: { str: 2, agi: 2, vit: 2, int: 2, dex: 2, luk: 5 } },
  // ---- demons ----
  tiger:    { slot: 'weapon', bonus: { str: 3, atk: 8, vs_beast: .1 } },
  krasue:   { slot: 'weapon', bonus: { int: 2, matk: 10, vs_spirit: .05 } },
  pop:      { slot: 'armor', bonus: { vit: 3, res_spirit: .15 } },
  // ---- คลองหนองบึง ----
  leech:    { slot: 'weapon', bonus: { atk: 8, luk: 1 } },
  wraith:   { slot: 'armor', bonus: { mp: 40, res_water: .15 } },
  croc:     { slot: 'armor', bonus: { def: 8, vit: 3 } },
  python:   { slot: 'charm', bonus: { def: 6, hp: 80 } },
  phong:    { slot: 'head', bonus: { int: 3, matk: 10 } },
  klom:     { slot: 'cape', bonus: { hp: 50, res_dark: .15 } },
  kumphi:   { slot: 'weapon', bonus: { str: 3, atk: 10, vs_beast: .1 } },
  nangram:  { slot: 'shoes', bonus: { agi: 4, eva: 10 } },
  tani:     { slot: 'charm', bonus: { int: 4, cast: .1 } },
  chalawan: { slot: 'armor', bonus: { vit: 6, hp: 200, res_beast: .15 } },
};

Object.assign(CARD_DEFS, EXPEDITION_CARD_DEFS);
for(const [id,m] of Object.entries(MONSTERS))if(!CARD_DEFS[id])CARD_DEFS[id]={slot:m.boss?'charm':'weapon',bonus:m.boss?{hp:Math.round(m.level*3),res_dark:.1}:{atk:Math.round(m.level*.2),matk:Math.round(m.level*.2)}};

export const cardId = monsterType => `card_${monsterType}`;
export const cardRate = def => (def.boss ? CARD_RATE.boss : def.elite ? CARD_RATE.elite : CARD_RATE.normal);
export const hasCard = monsterType => !!CARD_DEFS[monsterType];

// The cards as items (merged into ITEMS by src/character/data/items.js).
export const CARD_ITEMS = Object.fromEntries(Object.entries(CARD_DEFS).map(([type, c]) => {
  const m = MONSTERS[type], big = m.elite || m.boss;
  const art = CARD_ILLUSTRATIONS[type];
  return [cardId(type), { name: `การ์ด${m.name}`, icon: '❖', img: art?.icon ?? `ui/items/icon_card_${type.includes('_') ? 'winyan' : type}.png`, ...(art ? { illustration: art.image } : {}), weight: 1, type: 'card', slot: c.slot, bonus: c.bonus, rarity: big ? 'epic' : 'rare', price: big ? 400 : 120, monster: type, ...(BOSS_CARD_EFFECTS[type] ? { special: BOSS_CARD_EFFECTS[type] } : {}) }];
}));

// The cards an item may really hold: cards of its kind, no more than its slots.
export function socketCards(itemId, cards, items) {
  const item = items[itemId];
  if (!Array.isArray(cards) || !item?.slots) return [];
  return cards.filter(c => items[c]?.type === 'card' && items[c].slot === item.slot).slice(0, item.slots);
}
export const sameCards = (a, b) => JSON.stringify(a ?? []) === JSON.stringify(b ?? []);
