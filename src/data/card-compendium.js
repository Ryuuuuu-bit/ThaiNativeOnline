// Read-only journal data. Discovery is saved by Character; this module grants nothing.
import { CARD_ITEMS, cardRate, socketCards, RACE_LABELS, ELEMENT_LABELS } from '../character/data/cards.js';
import { MONSTERS } from '../combat/data/monsters.js';
import { ITEMS, slotKind } from '../character/data/items.js';
import { BESTIARY } from './bestiary.js';
import { MAPS } from '../world/maps.js';
import { MAP_BOSSES } from '../combat/data/boss-skills.js';
import { EXPEDITION_CARD_ROLES } from '../character/data/expedition-cards.js';

export const CARD_COMPENDIUM_VERSION = 1;
export const CARD_SLOT_LABELS = { weapon: 'อาวุธ', armor: 'เกราะ', head: 'ศีรษะ', cape: 'ผ้าคลุม', shoes: 'รองเท้า', charm: 'เครื่องราง' };
export const CARD_KIND_LABELS = { normal: 'ทั่วไป', elite: 'ชั้นยอด', boss: 'บอส' };
const LABELS = { str: 'STR', agi: 'AGI', vit: 'VIT', int: 'INT', dex: 'DEX', luk: 'LUK', atk: 'ATK', matk: 'MATK', def: 'DEF', hp: 'HP สูงสุด', mp: 'SP สูงสุด', acc: 'แม่นยำ', eva: 'หลบหลีก', crit: 'โอกาสคริ', critDmg: 'แรงคริ', cast: 'ความเร็วร่าย', cdr: 'ลดคูลดาวน์', aspd: 'ความเร็วโจมตี', hpMul: 'HP สูงสุด', mpMul: 'SP สูงสุด', patkMul: 'ATK', matkMul: 'MATK', healMul: 'พลังรักษา' };
const PERCENT = new Set(['crit', 'critDmg', 'cast', 'cdr', 'aspd', 'hpMul', 'mpMul', 'patkMul', 'matkMul', 'healMul']);
const number = n => Number(n.toFixed(3)).toLocaleString('th-TH');
export const cardPercent = chance => `${Number((chance * 100).toFixed(3))}%`;

export function cardBonusLines(bonus = {}) {
  return Object.entries(bonus).filter(([, value]) => Number.isFinite(value) && value !== 0).map(([key, value]) => {
    const race = key.startsWith('vs_') ? key.slice(3) : null;
    const resist = key.startsWith('res_') ? key.slice(4) : null;
    const label = race ? `โจมตี${RACE_LABELS[race] ?? race}` : resist ? `ต้านทาน${RACE_LABELS[resist] ?? ELEMENT_LABELS[resist] ?? resist}` : LABELS[key] ?? key;
    const percent = !!(race || resist || PERCENT.has(key));
    return { key, value, label, text: `${label} ${value > 0 ? '+' : ''}${number(value * (percent ? 100 : 1))}${percent ? '%' : ''}` };
  });
}

// Only supplied public text is displayed; no proc or boss effect is guessed here.
export function cardSpecialText(special) {
  if (!special) return null;
  return { name: special.nameTh ?? special.name ?? 'อาคมพิเศษ', description: special.descriptionTh ?? special.description ?? special.desc ?? '' };
}

const active = new Map(BESTIARY.map(monster => [monster.id, monster]));
const mapBosses = new Set(Object.values(MAP_BOSSES));
export const CARD_CATALOG = Object.entries(CARD_ITEMS).map(([id, item]) => {
  const definition = MONSTERS[item.monster], source = active.get(item.monster);
  const kind = definition.boss ? 'boss' : definition.elite ? 'elite' : 'normal';
  const monster = source ?? { id: item.monster, ...definition, kind, locations: [] };
  const bonusLines = cardBonusLines(item.bonus), specialText = cardSpecialText(item.special);
  const role = EXPEDITION_CARD_ROLES[item.monster] ?? null;
  const locations = monster.locations;
  return { id, item, name: item.name, monsterId: item.monster, monsterName: definition.name, monster,
    level: definition.level, kind, mapBoss: mapBosses.has(item.monster), slot: item.slot, slotLabel: CARD_SLOT_LABELS[item.slot] ?? item.slot,
    chance: cardRate(definition), locations, available: locations.length > 0, bonusLines,
    special: item.special ?? null, specialText, role,
    sharedArt: !item.illustration && item.img !== `ui/items/icon_card_${item.monster}.png`,
    searchText: [id, item.name, definition.name, CARD_KIND_LABELS[kind], mapBosses.has(item.monster) ? 'บอสแผนที่' : '', CARD_SLOT_LABELS[item.slot],
      ...bonusLines.map(b => b.text), specialText?.name, specialText?.description, role?.buildRole, role?.name, role?.brief,
      ...locations.map(l => `${MAPS[l.map]?.name ?? ''} ${l.name}`)].join(' ').normalize('NFC').toLocaleLowerCase('th'),
  };
}).sort((a, b) => a.level - b.level || a.monsterName.localeCompare(b.monsterName, 'th'));

const quantity = n => Number.isSafeInteger(n) && n > 0 ? n : 0;
export function cardOwnership(character) {
  const counts = Object.fromEntries(CARD_CATALOG.map(card => [card.id, { loose: 0, bagSockets: 0, wornSockets: 0, socketed: 0, owned: 0, collected: character?.cardBook?.[card.id] === true }]));
  const sockets = (itemId, held, into) => {
    const item = ITEMS[itemId];
    if (item?.type !== 'equip' || !Array.isArray(held)) return;
    for (const id of socketCards(itemId, held, ITEMS)) counts[id][into]++;
  };
  for (const stack of character?.inventory ?? []) {
    if (!stack || !quantity(stack.qty)) continue;
    if (counts[stack.id]) counts[stack.id].loose += quantity(stack.qty);
    else sockets(stack.id, stack.cards, 'bagSockets');
  }
  for (const [slot, id] of Object.entries(character?.equipment ?? {})) {
    if (ITEMS[id]?.slot === slotKind(slot)) sockets(id, character?.cards?.[slot], 'wornSockets');
  }
  for (const count of Object.values(counts)) { count.socketed = count.bagSockets + count.wornSockets; count.owned = count.loose + count.socketed; }
  return counts;
}

export function cardProgress(character, ownership = cardOwnership(character)) {
  return { total: CARD_CATALOG.length, collected: Object.values(ownership).filter(c => c.collected).length,
    available: CARD_CATALOG.filter(c => c.available).length, owned: Object.values(ownership).reduce((n, c) => n + c.owned, 0) };
}

export function searchCards({ query = '', map = '', kind = '', slot = '', collected = '', character = null, ownership = cardOwnership(character) } = {}) {
  const q = query.trim().normalize('NFC').toLocaleLowerCase('th');
  return CARD_CATALOG.filter(card => (!q || card.searchText.includes(q))
    && (!map || (map === 'unavailable' ? !card.available : card.locations.some(l => l.map === map)))
    && (!kind || (kind === 'boss' ? card.kind === 'boss' || card.mapBoss : card.kind === kind)) && (!slot || card.slot === slot)
    && (!collected || (collected === 'collected' ? ownership[card.id].collected : collected === 'missing' ? !ownership[card.id].collected : collected === 'owned' ? ownership[card.id].owned > 0 : true)));
}
