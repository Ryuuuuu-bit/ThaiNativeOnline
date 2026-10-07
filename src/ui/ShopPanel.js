import { ITEMS, RARITY_COLORS } from '../character/data/items.js';
import { SHOPS } from '../data/shops.js';
import { buy, sell, sellPrice, stockOf } from '../shop/ShopSystem.js';
import { iconHtml } from './icons.js';
import { SHOP_ICONS } from './HUD.js';
import { STRIP } from '../character/data/cards.js';
import { REFINE_SHOP, REFINE_SAFE, REFINE_MAX, refineCost, refineBonus } from '../character/data/refine.js';
import './shop.css';
const REFINE_WHY = { gold: 'ทองไม่พอ', ore: 'ไม่มีแร่สำหรับตีบวก', max: `ตีบวกได้สูงสุด +${REFINE_MAX}`, not_refinable: 'ไอเท็มนี้ตีบวกไม่ได้', no_item: 'ไม่พบไอเท็มนั้น', no_shop: 'ต้องอยู่ที่โรงหลอมศาสตรา และไม่ได้อยู่ระหว่างต่อสู้' };
const SLOT_TH = { weapon: 'อาวุธ', armor: 'เสื้อเกราะ', head: 'ศีรษะ', offhand: 'มือรอง', cape: 'ผ้าคลุม', shoes: 'รองเท้า', charm: 'เครื่องราง' };
const plusName = (id, plus) => `${plus ? `+${plus} ` : ''}${ITEMS[id].name}`;
const STRIP_WHY = { gold: 'ทองไม่พอ', ash: 'ขี้เถ้าธูปไม่พอ', bag_full: 'กระเป๋าเต็ม', no_cards: 'ไอเท็มนี้ไม่มีการ์ด', no_shop: 'ต้องอยู่ที่ร้านหมออาคม และไม่ได้อยู่ระหว่างต่อสู้' };

const $ = id => document.getElementById(id);
const fmt = n => Math.round(n || 0).toLocaleString();
const BONUS = { atk: 'โจมตี', matk: 'เวท', def: 'ป้องกัน', str: 'พลัง', agi: 'ว่องไว', int: 'ปัญญา', vit: 'อึด', dex: 'ชำนาญ', luk: 'โชค', hp: 'HP', mp: 'MP', eva: 'หลบ', crit: 'คริติคอล', cdr: 'ลดคูลดาวน์', cast: 'ร่ายเร็ว', mpCost: 'MP ที่ใช้' };
const PCT = new Set(['crit', 'cdr', 'cast', 'mpCost']);
export const describeItem = def => def.desc ?? Object.entries(def.bonus ?? {}).map(([k, v]) => `${BONUS[k] ?? k} +${PCT.has(k) ? `${Math.round(v * 100)}%` : v}`).join(' · ');

// The buy list's groups (layout from ThaiNative's ShopUI: grouped rows left, the picked item right).
const GROUPS = [
  ['use', 'ยา', 'ใช้ครั้งเดียว · ปุ่ม Q / F'],
  ['weapon', 'อาวุธ', 'สวมได้จากกระเป๋า (I)'],
  ['wear', 'เครื่องแต่งกาย', 'เสื้อ · หมวก · มือรอง · ผ้าคลุม · รองเท้า'],
  ['charm', 'เครื่องราง', 'ใส่ช่องเครื่องราง'],
  ['material', 'วัตถุดิบ', 'ใช้ตีบวก · ถอดการ์ด'],
  ['card', 'การ์ด', 'ใส่ช่องการ์ดของอุปกรณ์'],
  ['other', 'อื่น ๆ', ''],
];
const groupOf = d => d.type === 'use' ? 'use' : d.type === 'equip' ? (d.slot === 'weapon' ? 'weapon' : d.slot?.startsWith('charm') ? 'charm' : 'wear')
  : d.type === 'material' ? 'material' : d.type === 'card' ? 'card' : 'other';
const typeOf = d => d.type === 'use' ? 'ยา · ใช้ครั้งเดียว' : d.type === 'equip' ? SLOT_TH[d.slot] ?? SLOT_TH.charm : d.type === 'material' ? 'วัตถุดิบ' : d.type === 'card' ? 'การ์ด' : 'ของใช้';
const single = d => d.type === 'equip';
const TABS = { buy: ['🛒', 'ซื้อ'], sell: ['💰', 'ขาย'], cards: ['🃏', 'ถอดการ์ด'], refine: ['🔨', 'ตีบวก'] };
const icon = d => `<span class="sh-ic" style="--rar:${RARITY_COLORS[d.rarity] ?? '#e9dfc0'}">${iconHtml(d)}</span>`;

// Vendor window: buy the shop's stock or sell from the bag; หมออาคม also takes cards out of gear
// (src/character/data/cards.js STRIP) and หมื่นเพชรศาสตรา does ตีบวก (src/character/data/refine.js)
// — dice rolls the server makes when online. Buy and sell pick an item on the left and act from
// the panel on the right (amount ×1/10/20/50 for stackables).
export class ShopPanel {
  constructor(notify) {
    this.notify = notify; this.tab = 'buy'; this.sel = null; this.qty = 1; this.sellSel = null;
    $('shop-close').addEventListener('click', () => this.close());
    $('shop-rail').addEventListener('click', e => { const b = e.target.closest('[data-shop-tab]'); if (b) { this.tab = b.dataset.shopTab; this.render(); } });
    const list = $('shop-list');
    // typing an amount must not walk the player or fire skills
    list.addEventListener('keydown', e => { if (e.target.matches('input')) { e.stopPropagation(); if (e.key === 'Enter') e.target.blur(); } });
    list.addEventListener('change', e => { if (e.target.id === 'shop-qty') { this.qty = Math.max(1, Math.min(999, Math.floor(+e.target.value || 1))); this.render(); } });
    list.addEventListener('click', e => {
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
      const t = e.target.closest('[data-buy],[data-sell],[data-qty],[data-qd],[data-go],[data-sell-go]');
      if (!t || !this.character) return;
      if (t.dataset.buy) { if (this.sel !== t.dataset.buy) { this.sel = t.dataset.buy; this.qty = 1; } }
      else if (t.dataset.sell !== undefined) this.sellSel = Number(t.dataset.sell);
      else if (t.dataset.qty) this.qty = Number(t.dataset.qty);
      else if (t.dataset.qd) this.qty = Math.max(1, Math.min(999, this.qty + Number(t.dataset.qd)));
      else if (t.dataset.go) this.buyMany(t.dataset.go, single(ITEMS[t.dataset.go]) ? 1 : this.qty);
      else if (t.dataset.sellGo) this.sellMany(this.sellSel, t.dataset.sellGo === 'all');
      this.render();
    });
  }
  get open() { return !$('shop').hidden; }
  show(npc, character) {
    this.npc = npc; this.shopType = npc.def.shopType; this.character = character; this.tab = 'buy';
    this.sel = null; this.qty = 1; this.sellSel = null;
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
    if (this.shopType === REFINE_SHOP) this.tab = 'refine';
    $('shop-title').textContent = SHOPS[this.shopType]?.title ?? 'ร้านค้า'; $('shop-keeper').textContent = npc.def.name;
    $('shop-port').textContent = SHOP_ICONS[this.shopType] ?? '◆';
    $('shop').hidden = false; this.render();
  }

  // ---- actions --------------------------------------------------------------------
  buyMany(id, n) {
    const c = this.character, d = ITEMS[id];
    let k = 0, spent = 0, why = null;
    while (k < n) { const r = buy(c, this.shopType, id); if (!r.ok) { why = r.reason; break; } k++; spent += r.price; }
    if (!k) { this.notify(why, 'warn'); return; }
    this.notify(`ซื้อ ${d.name}${k > 1 ? ` ×${k}` : ''} −${fmt(spent)} ทอง${why ? ` · ได้แค่ ${k} ชิ้น (${why})` : ''}`, 'gold');
  }
  sellMany(index, all) {
    const c = this.character, slot = c.inventory[index]; if (!slot) return;
    const id = slot.id, n = all ? slot.qty ?? 1 : 1;
    let k = 0, gold = 0;
    while (k < n && c.inventory[index]?.id === id) { const r = sell(c, index); if (!r.ok) break; k++; gold += r.gold; }
    if (!c.inventory[index]) this.sellSel = null;
    if (k) this.notify(`ขาย ${ITEMS[id].name}${k > 1 ? ` ×${k}` : ''} +${fmt(gold)} ทอง`, 'gold');
  }

  // ---- views ------------------------------------------------------------------------
  tabs() {
    const c = this.character, stock = stockOf(this.shopType);
    const tabs = [...(stock.length ? ['buy'] : []), 'sell', ...(this.shopType === STRIP.shop ? ['cards'] : []), ...(this.shopType === REFINE_SHOP ? ['refine'] : [])];
    if (!tabs.includes(this.tab)) this.tab = tabs[0];
    const sub = { buy: `${stock.length} รายการ`, sell: `ของในกระเป๋า ${c.inventory.filter(Boolean).length} ช่อง`, cards: 'การ์ดคืนจากอุปกรณ์', refine: `ได้ถึง +${REFINE_MAX}` };
    return tabs.map(t => `<button type="button" class="sh-tab${t === this.tab ? ' on' : ''}" data-shop-tab="${t}" aria-pressed="${t === this.tab}"><span class="st-ic">${TABS[t][0]}</span><span class="st-tx"><b>${TABS[t][1]}</b><small>${sub[t]}</small></span></button>`).join('');
  }
  row(attr, value, d, { on, tag = '', price, dim } = {}) {
    return `<button type="button" class="sh-row${on ? ' on' : ''}${dim ? ' dim' : ''}" ${attr}="${value}">${icon(d)}
      <span class="sh-tx"><b>${d.name}${d.type === 'equip' && d.slots ? ` [${d.slots}]` : ''}${tag}</b><small>${describeItem(d)}</small></span><span class="sh-pr">${fmt(price)}</span></button>`;
  }
  buyHtml() {
    const c = this.character, stock = stockOf(this.shopType);
    if (!stock.includes(this.sel)) { this.sel = stock[0]; this.qty = 1; }
    const groups = GROUPS.map(([g, th, sub]) => {
      const ids = stock.filter(id => groupOf(ITEMS[id]) === g); if (!ids.length) return '';
      return `<div class="sh-group"><p class="sh-gh"><b>${th}</b>${sub ? `<small>${sub}</small>` : ''}</p><div class="sh-rows">${ids.map(id => {
        const have = c.count(id);
        return this.row('data-buy', id, ITEMS[id], { on: id === this.sel, tag: have ? `<i class="sh-tag">x${fmt(have)}</i>` : '', price: ITEMS[id].price, dim: c.gold < ITEMS[id].price });
      }).join('')}</div></div>`;
    }).join('');
    return `<div class="sh-split"><div class="sh-left">${groups}</div><aside class="sh-right">${this.buyDetail(this.sel)}</aside></div>`;
  }
  buyDetail(id) {
    const c = this.character, d = ITEMS[id];
    if (!d) return '<p class="shop-empty">เลือกสินค้าทางซ้าย</p>';
    const one = single(d), n = one ? 1 : this.qty, cost = d.price * n, ok = c.gold >= cost;
    const afford = Math.floor(c.gold / Math.max(1, d.price));
    const amount = one ? '' : `<div class="sh-qty"><button type="button" data-qd="-1" aria-label="ลด">−</button><input id="shop-qty" type="number" min="1" max="999" value="${n}" inputmode="numeric" aria-label="จำนวน"><button type="button" data-qd="1" aria-label="เพิ่ม">+</button></div>
      <div class="sh-quick">${[1, 10, 20, 50].map(q => `<button type="button" data-qty="${q}" class="${n === q ? 'on' : ''}${q > afford && q > 1 ? ' poor' : ''}">x${q}</button>`).join('')}</div>`;
    return `<div class="sh-dhead">${icon(d)}<span><b>${d.name}</b><small>${typeOf(d)}${d.weight ? ` · หนัก ${d.weight}` : ''}${d.slots ? ` · ช่องการ์ด ${d.slots}` : ''}</small></span></div>
      <p class="sh-desc">${describeItem(d) || '—'}</p>
      <div class="sh-have"><span>มีในกระเป๋า</span><b>${fmt(c.count(id))} ชิ้น</b></div>
      <div class="sh-fill"></div>${amount}
      <div class="sh-total"><span>รวม</span><b class="${ok ? '' : 'bad'}">${fmt(cost)} ทอง</b></div>
      <button type="button" class="sh-go" data-go="${id}" ${ok ? '' : 'disabled'}>${!ok ? 'ทองไม่พอ' : one ? 'ซื้อ' : `ซื้อ ${fmt(n)} ชิ้น`}</button>`;
  }
  sellHtml() {
    const c = this.character, inv = c.inventory;
    if (!inv[this.sellSel]) this.sellSel = inv.findIndex(Boolean);
    const rows = inv.map((s, i) => s ? this.row('data-sell', i, ITEMS[s.id], { on: i === this.sellSel, tag: s.qty > 1 ? `<i class="sh-tag">x${fmt(s.qty)}</i>` : s.plus ? `<i class="sh-tag">+${s.plus}</i>` : '', price: sellPrice(s.id) }) : '').join('');
    if (!rows) return '<p class="shop-empty">กระเป๋าว่าง</p>';
    const s = inv[this.sellSel], d = ITEMS[s.id], each = sellPrice(s.id), qty = s.qty ?? 1;
    const lost = [s.cards?.length ? `การ์ด ${s.cards.length} ใบ` : '', s.plus ? `ขั้นตีบวก +${s.plus}` : ''].filter(Boolean).join(' และ ');
    return `<div class="sh-split"><div class="sh-left"><div class="sh-group"><p class="sh-gh"><b>ของในกระเป๋า</b><small>ร้านรับซื้อครึ่งราคา</small></p><div class="sh-rows">${rows}</div></div></div>
      <aside class="sh-right"><div class="sh-dhead">${icon(d)}<span><b>${plusName(s.id, s.plus)}</b><small>${typeOf(d)}</small></span></div>
      <p class="sh-desc">${describeItem(d) || '—'}</p>${lost ? `<p class="sh-warn">ขายแล้ว${lost}หายไปด้วย</p>` : ''}
      <div class="sh-have"><span>มีในช่องนี้</span><b>${fmt(qty)} ชิ้น</b></div><div class="sh-fill"></div>
      <div class="sh-total"><span>ร้านให้</span><b>${fmt(each)} ทอง / ชิ้น</b></div>
      <button type="button" class="sh-go" data-sell-go="one">ขาย 1 ชิ้น · +${fmt(each)}</button>
      ${qty > 1 ? `<button type="button" class="sh-go alt" data-sell-go="all">ขายทั้งหมด ×${fmt(qty)} · +${fmt(each * qty)}</button>` : ''}</aside></div>`;
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
    const list = $('shop-list'), top = list.querySelector('.sh-left')?.scrollTop ?? 0;
    $('shop-gold').textContent = fmt(this.character.gold);
    $('shop-rail').innerHTML = this.tabs();
    list.innerHTML = this.tab === 'cards' ? `<div class="sh-pad">${this.cardsHtml()}</div>`
      : this.tab === 'refine' ? `<div class="sh-pad">${this.refineHtml()}</div>`
      : this.tab === 'buy' ? this.buyHtml() : this.sellHtml();
    const left = list.querySelector('.sh-left'); if (left) left.scrollTop = top;
  }
}
