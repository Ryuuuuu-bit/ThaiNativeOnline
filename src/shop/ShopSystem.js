// Buying and selling with NPC vendors, using only the character's public API.
// Prices come from item data; vendors buy back at half price like the bag's sell mode.
import { ITEMS } from '../character/data/items.js';
import { SHOPS } from '../data/shops.js';

export const sellPrice = id => Math.max(1, Math.floor(ITEMS[id].price / 2));
export const stockOf = shopType => (SHOPS[shopType]?.stock ?? []).filter(id => ITEMS[id]);

export function buy(character, shopType, itemId) {
  if (!stockOf(shopType).includes(itemId)) return { ok: false, reason: 'ร้านนี้ไม่มีสินค้านี้' };
  const price = ITEMS[itemId].price;
  if (character.gold < price) return { ok: false, reason: 'ทองไม่พอ' };
  if (character.carryRoom(itemId) < 1) return { ok: false, reason: 'ของหนักเกินไป' };
  if (!character.addItem(itemId, 1)) return { ok: false, reason: 'กระเป๋าเต็ม' };
  character.gold -= price; character.emit('change'); character.save?.();
  character.emit('bought', { shop: shopType, id: itemId });   // online, mirrored to the server (src/net/NetProgress.js)
  return { ok: true, price };
}

export function sell(character, index) {
  const slot = character.inventory[index];
  if (!slot) return { ok: false, reason: 'ไม่มีไอเท็ม' };
  const name = ITEMS[slot.id].name, gold = character.sellAt(index);
  character.save?.();
  return { ok: true, gold, name };
}
