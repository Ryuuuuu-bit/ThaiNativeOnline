import { ITEMS, RARITY_COLORS } from '../character/data/items.js';
import { SHOPS } from '../data/shops.js';
import { buy, sell, sellPrice, stockOf } from '../shop/ShopSystem.js';
import { iconHtml } from './icons.js';

const $ = id => document.getElementById(id);
const BONUS = { atk: 'โจมตี', def: 'ป้องกัน', str: 'พลัง', agi: 'ว่องไว', int: 'ปัญญา', vit: 'อึด', hp: 'HP', crit: 'คริติคอล' };
export const describeItem = def => def.desc ?? Object.entries(def.bonus ?? {}).map(([k, v]) => `${BONUS[k] ?? k} +${k === 'crit' ? `${Math.round(v * 100)}%` : v}`).join(' · ');

// Vendor window: buy the shop's stock or sell from the bag.
export class ShopPanel {
  constructor(notify) {
    this.notify = notify; this.tab = 'buy';
    $('shop-close').addEventListener('click', () => this.close());
    for (const b of document.querySelectorAll('[data-shop-tab]')) b.addEventListener('click', () => { this.tab = b.dataset.shopTab; this.render(); });
    $('shop-list').addEventListener('click', e => {
      const row = e.target.closest('[data-buy],[data-sell]');
      if (!row || !this.character) return;
      const result = row.dataset.buy ? buy(this.character, this.shopType, row.dataset.buy) : sell(this.character, Number(row.dataset.sell));
      if (!result.ok) this.notify(result.reason, 'warn');
      else this.notify(row.dataset.buy ? `ซื้อ ${ITEMS[row.dataset.buy].name} −${result.price} ทอง` : `ขาย ${result.name} +${result.gold} ทอง`, 'gold');
      this.render();
    });
  }
  get open() { return !$('shop').hidden; }
  show(npc, character) {
    this.npc = npc; this.shopType = npc.def.shopType; this.character = character; this.tab = 'buy';
    this.unsub?.(); this.unsub = character.on('inventory', () => this.render());
    $('shop-title').textContent = SHOPS[this.shopType]?.title ?? 'ร้านค้า'; $('shop-keeper').textContent = npc.def.name;
    $('shop').hidden = false; this.render();
  }
  close() { $('shop').hidden = true; this.unsub?.(); this.unsub = null; this.npc = null; }
  render() {
    if (!this.open) return;
    const c = this.character;
    $('shop-gold').textContent = `◉ ${c.gold.toLocaleString()} ทอง`;
    for (const b of document.querySelectorAll('[data-shop-tab]')) b.setAttribute('aria-pressed', String(b.dataset.shopTab === this.tab));
    const row = (attr, value, def, price, priceLabel, disabled) => `<button class="shop-row" ${attr}="${value}" ${disabled ? 'disabled' : ''}>
      <i style="--rar:${RARITY_COLORS[def.rarity] ?? '#e9dfc0'}">${iconHtml(def)}</i><span><b>${def.name}</b><small>${describeItem(def)}</small></span><em>${priceLabel} ${price}</em></button>`;
    $('shop-list').innerHTML = this.tab === 'buy'
      ? stockOf(this.shopType).map(id => row('data-buy', id, ITEMS[id], ITEMS[id].price, 'ราคา', c.gold < ITEMS[id].price)).join('')
      : c.inventory.map((slot, i) => (slot ? row('data-sell', i, ITEMS[slot.id], sellPrice(slot.id) * 1, `ขาย${slot.qty > 1 ? ` (มี ${slot.qty})` : ''}`, false) : '')).join('') || '<p class="shop-empty">กระเป๋าว่าง</p>';
  }
}
