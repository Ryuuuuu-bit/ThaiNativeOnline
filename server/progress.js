// Server-owned progress (phase 3c of docs/technical/SERVER_SPLIT.md). For a signed-in
// character the server's copy is the real one: EXP, level, stat points, gold, the bag and
// the gear change only here — from kills (server/monsters.js), from a death, and from the
// player's own actions, which the browser does locally and mirrors as `op` messages that
// the server replays with the very same Character / shop code:
//   buy {shop, id} · sell {id} · use {id} · equip {id} · unequip {slot} · alloc {key} · reset · sort
// An action the server cannot replay (no gold, not in the bag, …) is refused and the
// browser gets the server's copy back. The browser's save sync can no longer change the
// character: the server's copy wins (only the client's HP is kept, as monster swings are
// still resolved in the browser).
import { Character } from '../src/character/Character.js';
import { CLASSES, CLASS_ALIASES, STATS } from '../src/character/data/classes.js';
import { ITEMS } from '../src/character/data/items.js';
import { buy } from '../src/shop/ShopSystem.js';
import { sortBag } from '../src/character/bag.js';

export const CHARACTER_KEY = /^tno\.character\.v\d+$/;

// A Character from a stored save (unknown items dropped, like Character.load), or null.
export function fromSave(data) {
  if (!data || typeof data !== 'object' || !CLASSES[CLASS_ALIASES[data.classId] || data.classId]) return null;
  const inventory = Array.isArray(data.inventory) ? data.inventory.map(s => (s && ITEMS[s.id] && s.qty > 0 ? { id: s.id, qty: Math.floor(s.qty) } : null)) : undefined;
  const equipment = data.equipment ? Object.fromEntries(Object.entries(data.equipment).map(([k, id]) => [k, id && ITEMS[id] ? id : null])) : undefined;
  try { return new Character({ ...data, inventory, equipment, hp: data.hp > 0 ? data.hp : undefined }); } catch { return null; }
}

// Replays one browser action on the server's character → true when it went through.
export function applyOp(c, msg = {}) {
  const at = id => c.inventory.findIndex(s => s?.id === id);
  switch (msg.op) {
    case 'buy': return typeof msg.shop === 'string' && typeof msg.id === 'string' && buy(c, msg.shop, msg.id).ok;
    case 'sell': { const i = at(msg.id); return i >= 0 && c.sellAt(i) > 0; }
    case 'use': { const i = at(msg.id); return i >= 0 && c.useAt(i); }
    case 'equip': { const i = c.inventory.findIndex(s => s?.id === msg.id && ITEMS[s.id]?.type === 'equip'); return i >= 0 && c.equip(i); }
    case 'unequip': return ['weapon', 'armor', 'charm'].includes(msg.slot) && c.unequip(msg.slot);
    case 'alloc': return STATS.includes(msg.key) && c.allocate(msg.key);
    case 'reset': c.resetStats(); return true;
    case 'sort': sortBag(c); return true;
    default: return false;
  }
}

// A save from the browser, with the character replaced by the server's (`server`: its JSON,
// or null for a brand-new slot, which starts as a fresh character of the chosen class).
// → the save object to store.
export function reconcileSave(data, server) {
  const key = Object.keys(data).find(k => CHARACTER_KEY.test(k));
  let sent = {}; try { sent = JSON.parse(data[key]); } catch { /* checked by Accounts.check */ }
  let truth = server;
  if (!truth) {
    const classId = CLASS_ALIASES[sent.classId] || sent.classId;
    truth = Character.create(String(sent.name ?? '').slice(0, 16), CLASSES[classId] ? classId : 'muaythai', sent.gender === 'female' ? 'female' : 'male').toJSON();
  }
  const hp = Number(sent.hp);
  const merged = { ...truth, hp: server && hp > 0 ? Math.round(hp) : truth.hp };   // HP is still the browser's (capped on load)
  return { ...data, [key]: JSON.stringify(merged) };
}
