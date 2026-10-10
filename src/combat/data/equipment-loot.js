import { ITEMS } from '../../character/data/items.js';
import { EXPEDITIONS } from '../../world/expeditions.js';

// Additional, bounded roll: successful kills choose ONE item from this pool.
// Existing consumable, material, unique, equipment, and card rolls remain intact.
export const EQUIPMENT_DROP_CHANCES = Object.freeze({ normal: .08, elite: .20, boss: .60 });
export const EQUIPMENT_KINDS = Object.freeze(['weapon', 'armor', 'head', 'cape', 'shoes', 'gloves', 'belt', 'amulet', 'charm']);
export const EQUIPMENT_WEAPONS = Object.freeze(['sword', 'bow', 'wrap', 'dagger', 'talisman', 'book']);

// Loot tiers only: these do not change old saved equipment's requirements/bonuses.
const LEGACY_TIERS = {
  tiger_wrap: 5, bone_dagger: 5, iron_dap: 5, bamboo_bow: 5, palm_book: 5, bone_yant: 5,
  hide_armor: 5, hide_boots: 5, mongkol: 5, takrut: 5, chada: 5, sabai: 5, bia_kae: 5, pha_yant: 5,
  tiger_fang: 10, prakam: 10,
  kris: 15, horn_bow: 15, bog_book: 15, bog_yant: 15, croc_wrap: 15, croc_dagger: 15,
  croc_armor: 15, croc_boots: 15, chalawan_fang: 25,
};
export const equipmentLootLevel = id => ITEMS[id]?.minLevel ?? LEGACY_TIERS[id] ?? 1;

function regionFor(def) {
  const expedition = EXPEDITIONS.find(e => def.loot === `hunt_${e.id}` || def.loot === `boss_${e.id}`);
  return expedition?.id ?? (def.level >= 15 ? 'marsh' : def.level >= 10 ? 'temple' : def.level >= 5 ? 'grove' : 'paddy');
}

export function equipmentPool(def) {
  if (!Number.isFinite(def?.level) || def.level < 1) return [];
  const region = regionFor(def);
  const eligible = Object.entries(ITEMS).filter(([id, item]) => item.type === 'equip' && !item.retired
    && EQUIPMENT_KINDS.includes(item.slot) && equipmentLootLevel(id) <= def.level);
  // Each slot kind gets equal total weight. Weapon total is split equally among
  // all six classes' weapon kinds, so adding accessories cannot crowd out a class.
  const raw = eligible.map(([id, item]) => ({ id, kind: item.slot === 'weapon' ? `weapon:${item.weapon}` : item.slot,
    weight: (item.lootRegion === region || id.startsWith(`${region}_`) ? 3 : 1)
      / (1 + Math.max(0, def.level - equipmentLootLevel(id))) }));
  const totals = new Map();
  for (const row of raw) totals.set(row.kind, (totals.get(row.kind) ?? 0) + row.weight);
  return raw.map(row => ({ id: row.id, weight: row.weight / totals.get(row.kind)
    / (row.kind.startsWith('weapon:') ? EQUIPMENT_WEAPONS.length : 1) }));
}

export function equipmentDropChance(def) {
  return EQUIPMENT_DROP_CHANCES[def?.boss ? 'boss' : def?.elite ? 'elite' : 'normal'];
}

// Unconditional chance for this item from the extra roll, not a second roll per row.
export function equipmentDropRows(def) {
  const pool = equipmentPool(def), total = pool.reduce((sum, row) => sum + row.weight, 0);
  return pool.map(({ id, weight }) => ({ id, chance: equipmentDropChance(def) * weight / total, min: 1, max: 1, equipment: true }));
}
