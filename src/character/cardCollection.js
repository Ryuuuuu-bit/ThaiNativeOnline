// Historical card ownership only: no item consumption or combat/stat bonuses.
import { CARD_ITEMS, socketCards } from './data/cards.js';
import { ITEMS, EQUIP_SLOTS, slotKind } from './data/items.js';

export function cleanCardBook(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return Object.fromEntries(Object.keys(raw).filter(id => Object.hasOwn(CARD_ITEMS, id) && raw[id] === true).map(id => [id, true]));
}

// Call only with locally acquired holdings or an authoritative server snapshot.
// The returned map owns its entries; malformed or incompatible sockets never unlock cards.
export function collectCardBook(book, inventory = [], equipment = {}, cards = {}) {
  const next = cleanCardBook(book);
  const record = id => { if (Object.hasOwn(CARD_ITEMS, id)) next[id] = true; };
  for (const item of Array.isArray(inventory) ? inventory : []) {
    if (!item || !Number.isSafeInteger(item.qty) || item.qty < 1) continue;
    record(item.id);
    if (ITEMS[item.id]?.type === 'equip') for (const id of socketCards(item.id, item.cards, ITEMS)) record(id);
  }
  for (const slot of EQUIP_SLOTS) {
    const id = equipment?.[slot], def = ITEMS[id];
    if (def?.type === 'equip' && def.slot === slotKind(slot)) for (const card of socketCards(id, cards?.[slot], ITEMS)) record(card);
  }
  return next;
}
