// Bag helpers for the bag panel (src/character/ui/CharacterUI.js): categories, the
// better/worse-than-worn arrow on equipment, search and auto-sort. Pure logic over the
// item table (src/character/data/items.js); no DOM. Nothing here touches what items do,
// cost or weigh — only how the bag shows and orders them.
import { ITEMS } from './data/items.js';
import { isItemLocked, lockFields, cloneInstance } from './itemState.js';
import { affixBonus } from './data/affixes.js';
import { refineBonus } from './data/refine.js';
import { socketCards } from './data/cards.js';

// Tabs: id → label and which items belong (all shows every slot, empty ones too).
export const BAG_TABS = [
  { id: 'all', label: 'ทั้งหมด', has: () => true },
  { id: 'equip', label: 'อุปกรณ์', has: d => d.type === 'equip' || d.type === 'flask' },
  { id: 'use', label: 'ของใช้', has: d => d.type === 'use' },
  { id: 'card', label: 'การ์ด', has: d => d.type === 'card' },
  { id: 'material', label: 'วัตถุดิบ', has: d => d.type !== 'equip' && d.type !== 'use' && d.type !== 'flask' && d.type !== 'card' },
];
export const inTab = (tab, id) => (BAG_TABS.find(t => t.id === tab) ?? BAG_TABS[0]).has(ITEMS[id] ?? {});

// How much a piece of gear is worth to this character: its bonuses weighted for the
// class (casters value MATK, everyone else ATK). Only used to compare like with like.
const MAGIC_JOBS = new Set(['mage', 'healer']);
const WEIGHTS = { def: 1.2, hp: .1, mp: .08, str: 1, agi: 1, vit: 1, int: 1, dex: 1, luk: .8, crit: 60, critDmg: 25, acc: .5, eva: .5, cdr: 40, cast: 30, mpCost: -15 };
export function gearScore(cls, input) {
  const item = typeof input === 'string' ? {id:input} : input;
  const id = item?.id, b = { ...ITEMS[id]?.bonus };
  const bonuses = [affixBonus(id,item?.roll), refineBonus(ITEMS[id],item?.plus),
    ...socketCards(id,item?.cards,ITEMS).map(card => ITEMS[card]?.bonus)];
  for (const bonus of bonuses) for (const [key,value] of Object.entries(bonus ?? {})) b[key] = (b[key] ?? 0) + value;
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
export function compareToWorn(character, input) {
  const id = typeof input === 'string' ? input : input?.id;
  const d = ITEMS[id]; if (d?.type !== 'equip') return 0;
  if (d.slot === 'weapon' && character.canWield && !character.canWield(id)) return 0;   // another class's weapon: no arrow
  // charms: against the weaker of the two worn (an empty charm slot makes any charm better)
  const wornAt = slot => character.wornItem?.(slot) ?? character.equipment?.[slot];
  const worn = d.slot === 'charm' ? [wornAt('charm'), wornAt('charm2')].sort((a, b) => (a ? gearScore(character.cls, a) : -1) - (b ? gearScore(character.cls, b) : -1))[0] : wornAt(d.slot);
  if (!worn) return 1;
  const diff = gearScore(character.cls, input) - gearScore(character.cls, worn);
  return Math.abs(diff) < .5 ? 0 : Math.sign(diff);
}

export const matchesSearch = (id, q) => !q || (ITEMS[id]?.name ?? '').toLowerCase().includes(q.trim().toLowerCase());

// Auto-sort: gear first (weapon, armor, charm; rarer first), then consumables, then
// materials; same items merged into one stack; empty slots last. Returns a new array
// of the same length.
const TYPE_ORDER = { equip: 0, card: 1, use: 2, flask: 0 }, SLOT_ORDER = { weapon: 0, offhand: 1, armor: 2, head: 3, cape: 4, shoes: 5, gloves: 6, belt: 7, amulet: 8, charm: 9 }, RARITY_ORDER = { epic: 0, rare: 1, common: 2 };
export function sortedInventory(inventory) {
  const stacks = new Map(), gear = [];
  for (const s of inventory) {
    if (!s) continue;
    if (['equip','flask'].includes(ITEMS[s.id]?.type)) gear.push(cloneInstance(s));
    else {
      const key = `${s.id}:${isItemLocked(s)}`;
      const old = stacks.get(key);
      if (old) old.qty += s.qty; else stacks.set(key, { id: s.id, qty: s.qty, ...lockFields(s) });
    }
  }
  const items = [...gear, ...stacks.values()];
  const key = s => { const d = ITEMS[s.id] ?? {}; return [TYPE_ORDER[d.type] ?? 2, d.type === 'flask' ? (d.flask.kind === 'hp' ? 10 : 11) : SLOT_ORDER[d.slot] ?? 12, RARITY_ORDER[d.rarity] ?? 3, d.name ?? s.id]; };
  items.sort((a, b) => { const A = key(a), B = key(b); for (let i = 0; i < A.length; i++) { if (A[i] < B[i]) return -1; if (A[i] > B[i]) return 1; } return 0; });
  return [...items, ...Array(Math.max(0, inventory.length - items.length)).fill(null)];
}
export function sortBag(character) {
  character.inventory = sortedInventory(character.inventory);
  character.emit?.('inventory'); character.emit?.('sorted');
}
