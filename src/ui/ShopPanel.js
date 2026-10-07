import { ITEMS, RARITY_COLORS } from '../character/data/items.js';
import { SHOPS } from '../data/shops.js';
import { buy, sell, sellPrice, stockOf } from '../shop/ShopSystem.js';
import { iconHtml } from './icons.js';
import { STRIP } from '../character/data/cards.js';
import { REFINE_SHOP, REFINE_SAFE, REFINE_MAX, refineCost, refineBonus } from '../character/data/refine.js';
const REFINE_WHY = { gold: 'ทองไม่พอ', ore: 'ไม่มีแร่สำหรับตีบวก', max: `ตีบวกได้สูงสุด +${REFINE_MAX}`, not_refinable: 'ไอเท็มนี้ตีบวกไม่ได้', no_item: 'ไม่พบไอเท็มนั้น', no_shop: 'ต้องอยู่ที่โรงหลอมศาสตรา และไม่ได้อยู่ระหว่างต่อสู้' };
const SLOT_TH = { weapon: 'อาวุธ', armor: 'เสื้อเกราะ', head: 'ศีรษะ', offhand: 'มือรอง', cape: 'ผ้าคลุม', shoes: 'รองเท้า' };
const plusName = (id, plus) => `${plus ? `+${plus} ` : ''}${ITEMS[id].name}`;
const STRIP_WHY = { gold: 'ทองไม่พอ', ash: 'ขี้เถ้าธูปไม่พอ', bag_full: 'กระเป๋าเต็ม', no_cards: 'ไอเท็มนี้ไม่มีการ์ด', no_shop: 'ต้องอยู่ที่ร้านหมออาคม และไม่ได้อยู่ระหว่างต่อสู้' };

const $ = id => document.getElementById(id);
const BONUS = { atk: 'โจมตี', matk: 'เวท', def: 'ป้องกัน', str: 'พลัง', agi: 'ว่องไว', int: 'ปัญญา', vit: 'อึด', dex: 'ชำนาญ', luk: 'โชค', hp: 'HP', mp: 'MP', eva: 'หลบ', crit: 'คริติคอล', cdr: 'ลดคูลดาวน์', cast: 'ร่ายเร็ว', mpCost: 'MP ที่ใช้' };
const PCT = new Set(['crit', 'cdr', 'cast', 'mpCost']);
export const describeItem = def => def.desc ?? Object.entries(def.bonus ?? {}).map(([k, v]) => `${BONUS[k] ?? k} +${PCT.has(k) ? `${Math.round(v * 100)}%` : v}`).join(' · ');

// Vendor window: buy the shop's stock or sell from the bag; หมออาคม also takes cards out of gear
// (src/character/data/cards.js STRIP) and หมื่นเพชรศาสตรา does ตีบวก (src/character/data/refine.js)
// — dice rolls the server makes when online.
export class ShopPanel {
  constructor(notify) {
    this.notify = notify; this.tab = 'buy';
    $('shop-close').addEventListener('click', () => this.close());
    for (const b of document.querySelectorAll('[data-shop-tab]')) b.addEventListener('click', () => { this.tab = b.dataset.shopTab; this.render(); });
    $('shop-list').addEventListener('click', e => {
      const ref = e.target.closest('[data-refine]');
      if (ref && this.character) {
        const key = ref.dataset.refine, where = key.startsWith('w:') ? key.slice(2) : Number(key.slice(2));
        if (ref.dataset.risky && this.armed !== key) { this.armed = key; this.render(); return; }   // a risky try asks first
        this.armed = null; this.character.refineGear(where); this.render(); return;
      }
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
    const offRefine = character.on('refined', r => {
      if (r.pending) return;
      if (!r.ok) { this.notify(REFINE_WHY[r.why] ?? 'ตีบวกไม่ได้', 'warn'); return; }
      if (r.outcome === 'up') this.notify(`ตีบวกสำเร็จ! ${plusName(r.item, r.to)}`, 'gold');
      else this.notify(`ตีบวก +${r.to} ล้มเหลว · ${ITEMS[r.item].name}แตกสลาย${r.cards?.length ? ` พร้อม${r.cards.map(id => ITEMS[id]?.name).join(', ')}` : ''}`, 'warn');
      this.render();
    });
    this.unsub = () => { offInv?.(); offStrip?.(); offRefine?.(); };
    this.armed = null;
    const cardsTab = document.querySelector('[data-shop-tab="cards"]'); if (cardsTab) cardsTab.hidden = this.shopType !== STRIP.shop;
    const refineTab = document.querySelector('[data-shop-tab="refine"]'); if (refineTab) refineTab.hidden = this.shopType !== REFINE_SHOP;
    if (this.shopType === REFINE_SHOP) this.tab = 'refine';
    $('shop-title').textContent = SHOPS[this.shopType]?.title ?? 'ร้านค้า'; $('shop-keeper').textContent = npc.def.name;
    $('shop').hidden = false; this.render();
  }
  // gear in the bag that holds cards, with the price and the odds
  cardsHtml() {
    const c = this.character, rows = c.inventory.map((s, i) => {
      if (!s?.cards?.length) return '';
      const cost = c.stripCost(i), d = ITEMS[s.id], afford = c.gold >= cost.gold && c.count('ash') >= cost.ash, armed = this.armed === i;
      return `<button class="shop-row${armed ? ' armed' : ''}" data-strip="${i}" ${afford ? '' : 'disabled'}>
        <i style="--rar:${RARITY_COLORS[d.rarity] ?? '#e9dfc0'}">${iconHtml(d)}</i><span><b>${plusName(s.id, s.plus)} [${d.slots}]</b><small>${s.cards.map(id => ITEMS[id].name).join(', ')}</small></span>
        <em>${armed ? 'กดอีกครั้งเพื่อยืนยัน' : `${cost.gold} ทอง · ขี้เถ้าธูป ${cost.ash}`}</em></button>`;
    }).join('');
    return `<p class="shop-note">หมออาคมถอดการ์ดออกจากอุปกรณ์ในกระเป๋าได้ทั้งหมดในครั้งเดียว · การ์ดละ ${STRIP.gold} ทอง + ขี้เถ้าธูป ${STRIP.ash}<br>สำเร็จ ${Math.round(STRIP.ok * 100)}% · อุปกรณ์แตก ${Math.round(STRIP.itemBreaks * 100)}% (ได้การ์ดคืน) · การ์ดแตก ${Math.round((1 - STRIP.ok - STRIP.itemBreaks) * 100)}%</p>`
      + (rows || '<p class="shop-empty">ไม่มีอุปกรณ์ที่ใส่การ์ดในกระเป๋า (ถอดอุปกรณ์ที่สวมอยู่ออกก่อน)</p>');
  }
  // worn gear first, then the bag: the next plus, what it adds, the price and the odds
  refineHtml() {
    const c = this.character, rows = c.refineTargets().map(t => {
      const d = ITEMS[t.id], cost = refineCost(d, t.plus), key = t.worn ? `w:${t.slot}` : `i:${t.index}`;
      const have = c.count(cost.ore), afford = c.gold >= cost.gold && have > 0, armed = this.armed === key;
      const gain = Object.entries(refineBonus(d, cost.to)).map(([k, v]) => `${k.toUpperCase()} +${v - (refineBonus(d, t.plus)?.[k] ?? 0)}`).join(' ');
      const odds = cost.risky ? `โอกาส ${Math.round(cost.rate * 100)}% · พลาดแล้วแตก` : 'ปลอดภัย';
      return `<button class="shop-row${armed ? ' armed' : ''}" data-refine="${key}" ${cost.risky ? 'data-risky="1"' : ''} ${afford ? '' : 'disabled'}>
        <i style="--rar:${RARITY_COLORS[d.rarity] ?? '#e9dfc0'}">${iconHtml(d)}</i><span><b>${plusName(t.id, t.plus)} → +${cost.to}${t.worn ? ` · สวมอยู่ (${SLOT_TH[t.slot] ?? t.slot})` : ''}</b><small>${gain} · ${odds}${t.cards.length ? ` · การ์ด ${t.cards.length}` : ''}</small></span>
        <em>${armed ? 'เสี่ยงแตก! กดอีกครั้งเพื่อยืนยัน' : `${cost.gold} ทอง · ${ITEMS[cost.ore].name} 1 (มี ${have})`}</em></button>`;
    }).join('');
    return `<p class="shop-note">ตีบวกได้ถึง +${REFINE_MAX} ทีละขั้น · ใช้แร่ 1 ชิ้นต่อครั้ง (อาวุธ: ${ITEMS.sacred_ore.name} · อย่างอื่น: ${ITEMS.gold_leaf.name}) + ทองตามขั้น<br>ถึง +${REFINE_SAFE} สำเร็จเสมอ · เกินนั้นถ้าพลาด อุปกรณ์แตกสลายพร้อมการ์ดที่ใส่ไว้ · เครื่องรางตีบวกไม่ได้</p>`
      + (rows || '<p class="shop-empty">ไม่มีอุปกรณ์ที่ตีบวกได้</p>');
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
    if (this.tab === 'refine') { $('shop-list').innerHTML = this.refineHtml(); return; }
    $('shop-list').innerHTML = this.tab === 'buy'
      ? stockOf(this.shopType).map(id => row('data-buy', id, ITEMS[id], ITEMS[id].price, 'ราคา', c.gold < ITEMS[id].price)).join('')
      : c.inventory.map((slot, i) => (slot ? row('data-sell', i, ITEMS[slot.id], sellPrice(slot.id) * 1, `ขาย${slot.qty > 1 ? ` (มี ${slot.qty})` : ''}${slot.cards?.length ? ' · การ์ดหายด้วย' : ''}${slot.plus ? ` · +${slot.plus} หายด้วย` : ''}`, false) : '')).join('') || '<p class="shop-empty">กระเป๋าว่าง</p>';
  }
}
