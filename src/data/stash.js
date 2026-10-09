// Shared vault rules. Storage UI must wait for the server's stash + character sync.
import { ITEMS } from '../character/data/items.js';
import { Character } from '../character/Character.js';

export const STASH_CAPACITY = 120;
export const STASH_REQUEST = /^[A-Za-z0-9_-]{8,64}$/;
export const emptyStash = () => ({ revision: 0, slots: Array(STASH_CAPACITY).fill(null) });
const no = why => ({ ok: false, why });
export const stashIdentity = s => s && ({ id: s.id, plus: s.plus ?? 0, cards: [...(s.cards ?? [])], locked: s.locked === true });
export const sameStashItem = (a, b) => !!a && !!b && a.id === b.id && (a.plus ?? 0) === (b.plus ?? 0)
  && (a.locked === true) === (b.locked === true) && JSON.stringify(a.cards ?? []) === JSON.stringify(b.cards ?? []);

// Canonical, bounded request: no client account, map, inventory or coordinates.
export function cleanStashMove(m) {
  if (!m || !STASH_REQUEST.test(m.request ?? '') || typeof m.request !== 'string'
    || !Number.isSafeInteger(m.revision) || m.revision < 0) return null;
  const out = { request: m.request, revision: m.revision, action: m.action };
  if (m.action === 'deposit_materials') return out;
  if (!Number.isSafeInteger(m.qty) || m.qty < 1) return null;
  out.qty = m.qty;
  if (m.action === 'withdraw') {
    if (typeof m.uid !== 'string' || !STASH_REQUEST.test(m.uid)) return null;
    return { ...out, uid: m.uid };
  }
  if (m.action !== 'deposit' || !Number.isInteger(m.index) || m.index < 0 || m.index > 255) return null;
  const e = m.expected;
  if (!e || typeof e.id !== 'string' || !Object.hasOwn(ITEMS, e.id)
    || !Number.isInteger(e.plus ?? 0) || (e.plus ?? 0) < 0 || (e.plus ?? 0) > 10
    || !Array.isArray(e.cards ?? []) || (e.cards ?? []).length > 8
    || (e.cards ?? []).some(id => typeof id !== 'string' || !Object.hasOwn(ITEMS, id) || ITEMS[id].type !== 'card')
    || (e.locked != null && typeof e.locked !== 'boolean')) return null;
  return { ...out, index: m.index, expected: stashIdentity(e) };
}

// Pure candidate over copies; no Character mutators (which can drop instance metadata).
export function planStashMove(character, vault, move, uid) {
  if (vault.revision !== move.revision) return no('stale');
  const inventory = structuredClone(character.inventory), slots = structuredClone(vault.slots);
  if (!Array.isArray(inventory) || slots.length !== STASH_CAPACITY) return no('invalid');
  let moved = 0;
  const add = (bag, s, storage) => {
    const def = ITEMS[s.id]; if (!def || def.retired) return 'item';
    const target = def.type !== 'equip' ? bag.find(x => sameStashItem(x, s)) : null;
    if (target) {
      if (!Number.isSafeInteger(target.qty + s.qty)) return 'quantity';
      target.qty += s.qty;
    } else {
      const i = bag.indexOf(null); if (i < 0) return storage ? 'stash_full' : 'bag_full';
      const item = structuredClone(s); delete item.uid;
      bag[i] = storage ? { ...item, uid: uid() } : item;
    }
    return null;
  };
  const deposit = (index, qty) => {
    const s = inventory[index], def = ITEMS[s?.id];
    if (!def || def.retired) return 'item';
    if (!Number.isSafeInteger(s.qty) || s.qty < qty || (def.type === 'equip' && (qty !== 1 || s.qty !== 1))) return 'quantity';
    const why = add(slots, { ...s, qty }, true); if (why) return why;
    s.qty -= qty; if (!s.qty) inventory[index] = null; moved += qty;
    return null;
  };
  if (move.action === 'deposit') {
    if (!sameStashItem(inventory[move.index], move.expected)) return no('item_changed');
    const why = deposit(move.index, move.qty); if (why) return no(why);
  } else if (move.action === 'deposit_materials') {
    for (let i = 0; i < inventory.length; i++) {
      const s = inventory[i]; if (!s || s.locked === true || ITEMS[s.id]?.type !== 'material') continue;
      const why = deposit(i, s.qty); if (why) return no(why);
    }
    if (!moved) return no('no_materials');
  } else if (move.action === 'withdraw') {
    const i = slots.findIndex(s => s?.uid === move.uid), s = slots[i], def = ITEMS[s?.id];
    if (!def) return no('item_changed');
    if (!Number.isSafeInteger(s.qty) || move.qty > s.qty || (def.type === 'equip' && (move.qty !== 1 || s.qty !== 1))) return no('quantity');
    const why = add(inventory, { ...s, qty: move.qty }, false); if (why) return no(why);
    s.qty -= move.qty; if (!s.qty) slots[i] = null; moved = move.qty;
    const c = new Character({ ...character, inventory });
    if (c.weight > c.maxWeight) return no('overweight');
  } else return no('invalid');
  return { ok: true, moved, inventory, stash: { revision: vault.revision + 1, slots } };
}
