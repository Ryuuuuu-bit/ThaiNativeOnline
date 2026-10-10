import { MONSTERS } from '../combat/data/monsters.js';
import { LOOT } from '../combat/data/loot.js';
import { equipmentDropRows, equipmentDropChance } from '../combat/data/equipment-loot.js';
import { BOSS_SKILLS } from '../combat/data/boss-skills.js';
import { cardId, cardRate, hasCard } from '../character/data/cards.js';
import { ITEMS } from '../character/data/items.js';
import { combatSpawns } from './spawns.js';
import { HUNTING_GROUNDS } from './hunting.js';
import { MAPS, mapOf } from '../world/maps.js';

const zones = combatSpawns();
const phases = { morning: 'เช้า', day: 'กลางวัน', evening: 'เย็น', night: 'กลางคืน' };
export const ELEMENT_TH = { earth: 'ดิน', wind: 'ลม', water: 'น้ำ', fire: 'ไฟ', dark: 'มืด', holy: 'ศักดิ์สิทธิ์', neutral: 'ปกติ' };
export const RACE_TH = { beast: 'สัตว์', spirit: 'วิญญาณ', demon: 'อสูร', human: 'มนุษย์', plant: 'พืช' };

// Public guide derives its loot and geography from the exact gameplay tables.
// Chance means at least one of this item. Legacy and extra equipment rolls are
// independent; duplicate item IDs are combined by probability union, not addition.
export function bestiaryDrops(def) {
  const drops = new Map((LOOT[def.loot] ?? []).filter(([id]) => ITEMS[id])
    .map(([id, chance, min, max]) => [id, { id, chance, min, max }]));
  for (const row of equipmentDropRows(def)) {
    const old = drops.get(row.id);
    drops.set(row.id, old ? { ...old, chance: 1 - (1 - old.chance) * (1 - row.chance),
      max: old.max + 1, equipment: true, legacyChance: old.chance, additionalChance: row.chance }
      : { ...row, additionalChance: row.chance });
  }
  return [...drops.values()];
}
export const BESTIARY = Object.entries(MONSTERS).map(([id, def]) => {
  const locations = zones.filter(z => z.type === id).map(z => {
    const map = mapOf(z.x, z.z), camp = HUNTING_GROUNDS.find(c => c.id === z.area);
    return { map, name: camp?.name ?? MAPS[map]?.name ?? 'ไม่ทราบพื้นที่', area: z.area, x: z.x, z: z.z,
      approach: camp?.approach ?? { x: z.x, z: z.z }, phases: [...new Set(z.active ?? [])].map(p => phases[p] ?? p), respawn: z.respawn ?? null };
  }).filter(l => l.map);
  const drops = bestiaryDrops(def);
  if (hasCard(id)) drops.push({ id: cardId(id), chance: cardRate(def), min: 1, max: 1, card: true });
  return { id, ...def, kind: def.boss ? 'boss' : def.elite ? 'elite' : 'normal', locations, drops,
    equipmentDropChance: equipmentDropChance(def), equipmentKinds: [...new Set(equipmentDropRows(def).map(d => ITEMS[d.id].slot))], skills: BOSS_SKILLS[id] ?? [] };
}).filter(m => m.locations.length).sort((a, b) => a.level - b.level || a.name.localeCompare(b.name, 'th'));

export function searchBestiary({ query = '', map = '', kind = '', nearLevel = null } = {}) {
  const q = query.trim().normalize('NFC').toLocaleLowerCase('th');
  return BESTIARY.filter(m => (!map || m.locations.some(l => l.map === map)) && (!kind || m.kind === kind)
    && (nearLevel === null || Math.abs(m.level - nearLevel) <= 5)
    && (!q || `${m.name} ${m.locations.map(l => MAPS[l.map].name).join(' ')} ${m.drops.map(d => ITEMS[d.id].name).join(' ')}`.normalize('NFC').toLocaleLowerCase('th').includes(q)));
}
