import { ITEMS, RARITY_COLORS } from '../character/data/items.js';
import { SHOPS } from '../data/shops.js';
import { buy, sell, sellPrice, stockOf } from '../shop/ShopSystem.js';
import { iconHtml } from './icons.js';
import { STRIP } from '../character/data/cards.js';
const STRIP_WHY = { gold: 'ทองไม่พอ', ash: 'ขี้เถ้าธูปไม่พอ', bag_full: 'กระเป๋าเต็ม', no_cards: 'ไอเท็มนี้ไม่มีการ์ด', no_shop: 'ต้องอยู่ที่ร้านหมออาคม และไม่ได้อยู่ระหว่างต่อสู้' };

const $ = id => document.getElementById(id);
const BONUS = { atk: 'โจมตี', def: 'ป้องกัน', str: 'พลัง', agi: 'ว่องไว', int: 'ปัญญา', vit: 'อึด', hp: 'HP', crit: 'คริติคอล' };
export const describeItem = def => def.desc ?? Object.entries(def.bonus ?? {}).map(([k, v]) => `${BONUS[k] ?? k} +${k === 'crit' ? `${Math.round(v * 100)}%` : v}`).join(' · ');

// Vendor window: buy the shop's stock or sell from the bag; หมออาคม also takes cards out of gear
// (src/character/data/cards.js STRIP — a dice roll the server makes when online).
export class ShopPanel {
  constructor(notify) {
    this.notify = notify; this.tab = 'buy';
    $('shop-close').addEventListener('click', () => this.close());
    for (const b of document.querySelectorAll('[data-shop-tab]')) b.addEventListener('click', () => { this.tab = b.dataset.shopTab; this.render(); });
    $('shop-list').addEventListener('click', e => {
      const strip = e.target.closest('[data-strip]');
      if (strip && this.character) {
        const i = Number(strip.dataset.strip);
        if (this.armed !== i) { this.armed = i; this.render(); return; }   // the first click asks
        this.armed = null; this.character.stripCards(i); this.render(); return;
      }
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
    this.unsub?.();
    const offInv = character.on('inventory', () => this.render());
    const offStrip = character.on('stripped', r => {
      if (r.pending) return;
      if (!r.ok) { this.notify(STRIP_WHY[r.why] ?? 'ถอดการ์ดไม่ได้', 'warn'); return; }
      const names = r.cards.map(id => ITEMS[id]?.name).join(', ');
      if (r.outcome === 'ok') this.notify(`ถอดการ์ดสำเร็จ · ได้คืน ${names}`, 'gold');
      else if (r.outcome === 'item_broke') this.notify(`${ITEMS[r.item].name}แตกสลาย! · แต่ได้การ์ดคืน: ${names}`, 'warn');
      else this.notify(`การ์ดแตกสลาย! ${names} · ${ITEMS[r.item].name}ยังอยู่`, 'warn');
      this.render();
    });
    this.unsub = () => { offInv?.(); offStrip?.(); };
    this.armed = null;
    const cardsTab = document.querySelector('[data-shop-tab="cards"]'); if (cardsTab) cardsTab.hidden = this.shopType !== STRIP.shop;
    $('shop-title').textContent = SHOPS[this.shopType]?.title ?? 'ร้านค้า'; $('shop-keeper').textContent = npc.def.name;
    $('shop').hidden = false; this.render();
  }
  // gear in the bag that holds cards, with the price and the odds
  cardsHtml() {
    const c = this.character, rows = c.inventory.map((s, i) => {
      if (!s?.cards?.length) return '';
      const cost = c.stripCost(i), d = ITEMS[s.id], afford = c.gold >= cost.gold && c.count('ash') >= cost.ash, armed = this.armed === i;
      return `<button class="shop-row${armed ? ' armed' : ''}" data-strip="${i}" ${afford ? '' : 'disabled'}>
        <i style="--rar:${RARITY_COLORS[d.rarity] ?? '#e9dfc0'}">${iconHtml(d)}</i><span><b>${d.name} [${d.slots}]</b><small>${s.cards.map(id => ITEMS[id].name).join(', ')}</small></span>
        <em>${armed ? 'กดอีกครั้งเพื่อยืนยัน' : `${cost.gold} ทอง · ขี้เถ้าธูป ${cost.ash}`}</em></button>`;
    }).join('');
    return `<p class="shop-note">หมออาคมถอดการ์ดออกจากอุปกรณ์ในกระเป๋าได้ทั้งหมดในครั้งเดียว · การ์ดละ ${STRIP.gold} ทอง + ขี้เถ้าธูป ${STRIP.ash}<br>สำเร็จ ${Math.round(STRIP.ok * 100)}% · อุปกรณ์แตก ${Math.round(STRIP.itemBreaks * 100)}% (ได้การ์ดคืน) · การ์ดแตก ${Math.round((1 - STRIP.ok - STRIP.itemBreaks) * 100)}%</p>`
      + (rows || '<p class="shop-empty">ไม่มีอุปกรณ์ที่ใส่การ์ดในกระเป๋า (ถอดอุปกรณ์ที่สวมอยู่ออกก่อน)</p>');
  }
  close() { $('shop').hidden = true; this.unsub?.(); this.unsub = null; this.npc = null; }
  render() {
    if (!this.open) return;
    const c = this.character;
    $('shop-gold').textContent = `◉ ${c.gold.toLocaleString()} ทอง`;
    for (const b of document.querySelectorAll('[data-shop-tab]')) b.setAttribute('aria-pressed', String(b.dataset.shopTab === this.tab));
    const row = (attr, value, def, price, priceLabel, disabled) => `<button class="shop-row" ${attr}="${value}" ${disabled ? 'disabled' : ''}>
      <i style="--rar:${RARITY_COLORS[def.rarity] ?? '#e9dfc0'}">${iconHtml(def)}</i><span><b>${def.name}${def.type === 'equip' && def.slots ? ` [${def.slots}]` : ''}</b><small>${describeItem(def)}</small></span><em>${priceLabel} ${price}</em></button>`;
    if (this.tab === 'cards') { $('shop-list').innerHTML = this.cardsHtml(); return; }
    $('shop-list').innerHTML = this.tab === 'buy'
      ? stockOf(this.shopType).map(id => row('data-buy', id, ITEMS[id], ITEMS[id].price, 'ราคา', c.gold < ITEMS[id].price)).join('')
      : c.inventory.map((slot, i) => (slot ? row('data-sell', i, ITEMS[slot.id], sellPrice(slot.id) * 1, `ขาย${slot.qty > 1 ? ` (มี ${slot.qty})` : ''}${slot.cards?.length ? ' · การ์ดหายด้วย' : ''}`, false) : '')).join('') || '<p class="shop-empty">กระเป๋าว่าง</p>';
  }
}
