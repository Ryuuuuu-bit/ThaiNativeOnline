// Bag helpers for the bag panel (src/character/ui/CharacterUI.js): categories, the
// better/worse-than-worn arrow on equipment, search and auto-sort. Pure logic over the
// item table (src/character/data/items.js); no DOM. Nothing here touches what items do,
// cost or weigh — only how the bag shows and orders them.
import { ITEMS } from './data/items.js';

// Tabs: id → label and which items belong (all shows every slot, empty ones too).
export const BAG_TABS = [
  { id: 'all', label: 'ทั้งหมด', has: () => true },
  { id: 'equip', label: 'อุปกรณ์', has: d => d.type === 'equip' },
  { id: 'use', label: 'ของใช้', has: d => d.type === 'use' },
  { id: 'material', label: 'วัตถุดิบ', has: d => d.type !== 'equip' && d.type !== 'use' },
];
export const inTab = (tab, id) => (BAG_TABS.find(t => t.id === tab) ?? BAG_TABS[0]).has(ITEMS[id] ?? {});

// How much a piece of gear is worth to this character: its bonuses weighted for the
// class (casters value MATK, everyone else ATK). Only used to compare like with like.
const MAGIC_JOBS = new Set(['mage', 'healer']);
const WEIGHTS = { def: 1.2, hp: .1, mp: .08, str: 1, agi: 1, vit: 1, int: 1, dex: 1, luk: .8, crit: 60, critDmg: 25, acc: .5, eva: .5 };
export function gearScore(cls, id) {
  const b = ITEMS[id]?.bonus; if (!b) return 0;
  const magic = MAGIC_JOBS.has(cls?.job);
  let s = 0;
  for (const [k, v] of Object.entries(b)) {
    if (k === 'atk') s += v * (magic ? .3 : 1.6);
    else if (k === 'matk') s += v * (magic ? 1.6 : .3);
    else if (k === 'int') s += v * (magic ? 1.4 : .3);
    else if (k === 'str') s += v * (magic ? .3 : 1.2);
    else s += v * (WEIGHTS[k] ?? 0);
  }
  return s;
}
// Equipment against what is worn in its slot: 1 better, -1 worse, 0 same/not gear.
// An empty slot makes any piece better.
export function compareToWorn(character, id) {
  const d = ITEMS[id]; if (d?.type !== 'equip') return 0;
  const worn = character.equipment?.[d.slot];
  if (!worn) return 1;
  const diff = gearScore(character.cls, id) - gearScore(character.cls, worn);
  return Math.abs(diff) < .5 ? 0 : Math.sign(diff);
}

export const matchesSearch = (id, q) => !q || (ITEMS[id]?.name ?? '').toLowerCase().includes(q.trim().toLowerCase());

// Auto-sort: gear first (weapon, armor, charm; rarer first), then consumables, then
// materials; same items merged into one stack; empty slots last. Returns a new array
// of the same length.
const TYPE_ORDER = { equip: 0, use: 1 }, SLOT_ORDER = { weapon: 0, armor: 1, charm: 2 }, RARITY_ORDER = { epic: 0, rare: 1, common: 2 };
export function sortedInventory(inventory) {
  const stacks = new Map(), gear = [];
  for (const s of inventory) {
    if (!s) continue;
    if (ITEMS[s.id]?.type === 'equip') gear.push({ ...s });
    else stacks.set(s.id, (stacks.get(s.id) ?? 0) + s.qty);
  }
  const items = [...gear, ...[...stacks].map(([id, qty]) => ({ id, qty }))];
  const key = s => { const d = ITEMS[s.id] ?? {}; return [TYPE_ORDER[d.type] ?? 2, SLOT_ORDER[d.slot] ?? 3, RARITY_ORDER[d.rarity] ?? 3, d.name ?? s.id]; };
  items.sort((a, b) => { const A = key(a), B = key(b); for (let i = 0; i < A.length; i++) { if (A[i] < B[i]) return -1; if (A[i] > B[i]) return 1; } return 0; });
  return [...items, ...Array(Math.max(0, inventory.length - items.length)).fill(null)];
}
export function sortBag(character) {
  character.inventory = sortedInventory(character.inventory);
  character.emit?.('inventory'); character.emit?.('sorted');
}
