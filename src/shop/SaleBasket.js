import { isItemLocked } from '../character/itemState.js';
import { sellPrice } from './ShopSystem.js';

// Keep the exact selected instance: sorting, server reconciliation or replacing a bag
// cell must never silently put a different item into the sale basket.
export class SaleBasket {
  constructor(character) { this.character = character; this.picks = new Map(); }
  set(index, qty) {
    const slot = this.character.inventory[index];
    if (!slot || isItemLocked(slot) || sellPrice(slot.id) <= 0 || !Number.isSafeInteger(qty) || qty <= 0) { this.picks.delete(index); return; }
    this.picks.set(index, { slot, qty: Math.min(qty, slot.qty), signature: JSON.stringify(slot) });
  }
  clear() { this.picks.clear(); }
  lines() {
    for (const [index, p] of this.picks) {
      if (isItemLocked(p.slot) || this.character.inventory[index] !== p.slot || JSON.stringify(p.slot) !== p.signature) this.picks.delete(index);
    }
    return [...this.picks].map(([index, p]) => ({ index, qty: p.qty }));
  }
  total() { return this.lines().reduce((n, l) => n + sellPrice(this.character.inventory[l.index].id) * l.qty, 0); }
}
