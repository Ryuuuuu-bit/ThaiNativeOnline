import { ITEMS, RARITY_COLORS } from '../character/data/items.js';
import { instanceName, instanceQuality } from '../character/itemPresentation.js';
import { affixBonus } from '../character/data/affixes.js';
import { SHOPS } from '../data/shops.js';
import { buy, buyPrice, sellPrice, stockOf } from '../shop/ShopSystem.js';
import { SaleBasket } from '../shop/SaleBasket.js';
import { isItemLocked } from '../character/itemState.js';
import { iconHtml } from './icons.js';
import { SHOP_ICONS } from './HUD.js';
import { STRIP } from '../character/data/cards.js';
import { REFINE_SHOP, REFINE_SAFE, REFINE_MAX, REFINE_MILESTONES, refinable, refineCost, refineBonus } from '../character/data/refine.js';
import './shop.css';
const REFINE_WHY = { gold: 'ตำลึงไม่พอ', ore: 'ไม่มีแร่สำหรับตีบวก', locked: 'ปลดล็อกอุปกรณ์ก่อนตีบวก', connection: 'รอเชื่อมต่อและข้อมูลอุปกรณ์ล่าสุดก่อนตีบวก', pending: 'รอข้อมูลอุปกรณ์จากการตีครั้งก่อน', max: `ตีบวกได้สูงสุด +${REFINE_MAX}`, not_refinable: 'ไอเท็มนี้ตีบวกไม่ได้', no_item: 'ไม่พบไอเท็มนั้น', dead: 'ต้องฟื้นคืนชีพก่อนตีบวก', no_shop: 'ต้องอยู่ที่โรงหลอมศาสตรา และไม่ได้อยู่ระหว่างต่อสู้' };
const SLOT_TH = { weapon: 'อาวุธ', armor: 'เสื้อเกราะ', head: 'ศีรษะ', cape: 'ผ้าคลุม', shoes: 'รองเท้า', gloves: 'ถุงมือ', belt: 'เข็มขัด', amulet: 'สร้อย', charm: 'เครื่องประดับ' };
const plusName = (id, plus) => `${plus ? `+${plus} ` : ''}${ITEMS[id].name}`;
const STRIP_WHY = { gold: 'ตำลึงไม่พอ', ash: 'ขี้เถ้าธูปไม่พอ', bag_full: 'กระเป๋าเต็ม', no_cards: 'ไอเท็มนี้ไม่มีการ์ด', no_shop: 'ต้องอยู่ที่ร้านหมออาคม และไม่ได้อยู่ระหว่างต่อสู้' };

const $ = id => document.getElementById(id);
const fmt = n => Math.round(n || 0).toLocaleString();
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const BONUS = { atk: 'โจมตี', matk: 'เวท', def: 'ป้องกัน', str: 'พลัง', agi: 'ว่องไว', int: 'ปัญญา', vit: 'อึด', dex: 'ชำนาญ', luk: 'โชค', hp: 'HP', mp: 'MP', eva: 'หลบ', crit: 'คริติคอล', cdr: 'ลดคูลดาวน์', cast: 'ร่ายเร็ว', mpCost: 'MP ที่ใช้' };
const PCT = new Set(['crit', 'cdr', 'cast', 'mpCost']);
export const describeItem = def => def.desc ?? Object.entries(def.bonus ?? {}).map(([k, v]) => `${BONUS[k] ?? k} +${PCT.has(k) ? `${Math.round(v * 100)}%` : v}`).join(' · ');

// Shared categories for the shop's stock and the player's sale inventory.
const GROUPS = [
  ['use', 'ยา', 'ใช้ครั้งเดียว · จัดใส่ช่องลัด 1–0 ได้'],
  ['flask', 'ขวดใช้ซ้ำ', 'ขวดเลือด Q · ขวดมานา E'],
  ['weapon', 'อาวุธ', 'สวมได้จากกระเป๋า (I)'],
  ['wear', 'เครื่องแต่งกาย', 'เสื้อ · หมวก · ผ้าคลุม · รองเท้า · ถุงมือ · เข็มขัด · สร้อย'],
  ['charm', 'เครื่องประดับ', 'ใส่ช่องเครื่องประดับ'],
  ['material', 'วัตถุดิบ', 'ใช้ตีบวก · ถอดการ์ด'],
  ['card', 'การ์ด', 'ใส่ช่องการ์ดของอุปกรณ์'],
  ['other', 'อื่น ๆ', ''],
];
const groupOf = d => d.type === 'flask' ? 'flask' : d.type === 'use' ? 'use' : d.type === 'equip' ? (d.slot === 'weapon' ? 'weapon' : d.slot?.startsWith('charm') ? 'charm' : 'wear')
  : d.type === 'material' ? 'material' : d.type === 'card' ? 'card' : 'other';
const typeOf = d => d.type === 'flask' ? `ขวด${d.flask.kind === 'hp' ? 'เลือด Q' : 'มานา E'} · ใช้ซ้ำ` : d.type === 'use' ? 'ยา · ใช้ครั้งเดียว' : d.type === 'equip' ? SLOT_TH[d.slot] ?? SLOT_TH.charm : d.type === 'material' ? 'วัตถุดิบ' : d.type === 'card' ? 'การ์ด' : 'ของใช้';
const single = d => ['equip','flask'].includes(d.type);
const enhTier = n => `t${n >= 10 ? 5 : n >= 9 ? 4 : n >= 7 ? 3 : n >= 5 ? 2 : n >= 4 ? 1 : 0}`;
const MILESTONE_TH = { 4: 'ปลอดภัย', 7: 'ชำนาญ', 10: 'ตำนาน' };
const TABS = { buy: ['🛒', 'ซื้อ'], sell: ['💰', 'ขาย'], cards: ['🃏', 'ถอดการ์ด'], refine: ['🔨', 'ตีบวก'] };
const icon = d => `<span class="sh-ic" style="--rar:${RARITY_COLORS[d.rarity] ?? '#e9dfc0'}">${iconHtml(d)}</span>`;

// Vendor window: buy the shop's stock or sell from the bag; หมออาคม also takes cards out of gear
// (src/character/data/cards.js STRIP) and หมื่นเพชรศาสตรา does ตีบวก (src/character/data/refine.js)
// — dice rolls the server makes when online. Sales collect exact bag instances in
// a basket; quantity changes and the final review stay inside the vendor window.
export class ShopPanel {
  constructor(notify) {
    this.notify = notify; this.tab = 'buy'; this.sel = null; this.qty = 1; this.sellSel = null;
    this.search = ''; this.filter = ''; this.receipt = ''; this.confirmSale = false;
    this.refinePending = null; this.forgeResult = null; this.forgeSerial = 0;
    $('shop-close').addEventListener('click', () => this.close());
    $('shop-rail').addEventListener('click', e => { const b = e.target.closest('[data-shop-tab]'); if (b) { this.tab = b.dataset.shopTab; this.search = ''; this.filter = ''; this.confirmSale = false; this.render(); } });
    const list = $('shop-list');
    // typing an amount must not walk the player or fire skills
    list.addEventListener('keydown', e => { if (e.target.matches('input') && e.key !== 'Escape') { e.stopPropagation(); if (e.key === 'Enter') e.target.blur(); } });
    list.addEventListener('input', e => {
      if (e.target.id !== 'shop-search') return;
      const at = e.target.selectionStart; this.search = e.target.value; this.render();
      const input = $('shop-search'); input.focus(); input.setSelectionRange(at, at);
    });
    list.addEventListener('change', e => {
      if (e.target.id === 'shop-qty') this.qty = Math.max(1, Math.min(999, Math.floor(+e.target.value || 1)));
      else if (e.target.dataset.saleQty !== undefined) { this.basket.set(+e.target.dataset.saleQty, Math.floor(+e.target.value)); this.confirmSale = false; }
      else return;
      this.render();
    });
    list.addEventListener('click', e => {
      if (e.target.closest('[data-refill-flasks]')) { this.character?.refillFlasks('town'); this.render(); return; }
      const sale = e.target.closest('[data-pick],[data-sale-all],[data-sale-clear],[data-sale-submit],[data-filter]');
      if (sale && this.character) {
        if (sale.dataset.pick !== undefined) { const i = +sale.dataset.pick; this.basket.set(i, this.basket.picks.has(i) ? 0 : this.character.inventory[i]?.qty); }
        else if (sale.dataset.saleAll !== undefined) {
          for (const { slot, index } of this.saleCandidates()) this.basket.set(index, slot.qty);
        }
        else if (sale.dataset.saleClear !== undefined) this.basket.clear();
        else if (sale.dataset.filter !== undefined) this.filter = sale.dataset.filter;
        else { this.submitSale(); this.render(); return; }
        this.confirmSale = false; this.render(); return;
      }
      const ref = e.target.closest('[data-refine]');
      if (ref && this.character) {
        this.attemptRefine(ref.dataset.refine); return;
      }
      const es = e.target.closest('[data-esel],[data-ebuy]');   // ตีบวก: pick the gear · buy the ore it lacks
      if (es && this.character) {
        if (this.refinePending || this.character.refineRecovering) return;
        if (es.dataset.esel) { this.enhSel = es.dataset.esel; this.armed = null; } else this.buyMany(es.dataset.ebuy, 1);
        this.render(); return;
      }
      const strip = e.target.closest('[data-strip]');
      if (strip && this.character) {
        const i = Number(strip.dataset.strip);
        if (this.armed !== i) { this.armed = i; this.render(); return; }   // the first click asks
        this.armed = null; this.character.stripCards(i); this.render(); return;
      }
      const t = e.target.closest('[data-buy],[data-qty],[data-qd],[data-go]');
      if (!t || !this.character) return;
      if (t.dataset.buy) { if (this.sel !== t.dataset.buy) { this.sel = t.dataset.buy; this.qty = 1; } }
      else if (t.dataset.qty) this.qty = Number(t.dataset.qty);
      else if (t.dataset.qd) this.qty = Math.max(1, Math.min(999, this.qty + Number(t.dataset.qd)));
      else if (t.dataset.go) this.buyMany(t.dataset.go, single(ITEMS[t.dataset.go]) ? 1 : this.qty);
      this.render();
    });
  }
  get open() { return !$('shop').hidden; }
  show(npc, character) {
    if (this.character !== character || (!this.refinePending && !character.refineRecovering)) { this.refinePending = null; this.forgeResult = null; }
    this.npc = npc; this.shopType = npc.def.shopType; this.character = character; this.tab = 'buy';
    this.sel = null; this.qty = 1; this.sellSel = null;
    this.basket = new SaleBasket(character); this.search = ''; this.filter = ''; this.receipt = ''; this.confirmSale = false;
    this.unsub?.();
    const offInv = character.on('inventory', () => { this.settleRefine(); this.render(); });
    const offStrip = character.on('stripped', r => {
      if (r.pending) return;
      if (!r.ok) { this.notify(STRIP_WHY[r.why] ?? 'ถอดการ์ดไม่ได้', 'warn'); return; }
      const names = r.cards.map(id => ITEMS[id]?.name).join(', ');
      if (r.outcome === 'ok') this.notify(`ถอดการ์ดสำเร็จ · ได้คืน ${names}`, 'gold');
      else if (r.outcome === 'item_broke') this.notify(`${ITEMS[r.item].name}แตกสลาย! · แต่ได้การ์ดคืน: ${names}`, 'warn');
      else this.notify(`การ์ดแตกสลาย! ${names} · ${ITEMS[r.item].name}ยังอยู่`, 'warn');
      this.render();
    });
    const offRefine = character.on('refined', r => this.receiveRefine(r));
    const offRecovery = character.on('refine-recovery', r => this.recoverRefine(r));
    this.unsub = () => { offInv?.(); offStrip?.(); offRefine?.(); offRecovery?.(); };
    this.armed = null;
    if (this.shopType === REFINE_SHOP) this.tab = 'refine';
    $('shop-title').textContent = SHOPS[this.shopType]?.title ?? 'ร้านค้า'; $('shop-keeper').textContent = npc.def.name;
    $('shop-port').textContent = SHOP_ICONS[this.shopType] ?? '◆';
    $('shop').hidden = false; this.render();
  }

  // ---- actions --------------------------------------------------------------------
  // Include completed +10 gear so the final milestone and its bonus stay visible.
  refineList() {
    const c = this.character;
    return [
      ...Object.entries(c.equipment).flatMap(([slot, id]) => refinable(ITEMS[id]) ? [{ worn: true, slot, id, plus: c.refine[slot] ?? 0, cards: c.cards[slot] ?? [] }] : []),
      ...c.inventory.flatMap((s, index) => s && refinable(ITEMS[s.id]) ? [{ index, id: s.id, plus: s.plus ?? 0, cards: s.cards ?? [] }] : []),
    ];
  }
  attemptRefine(key) {
    if (this.refinePending || this.character.refineRecovering) return;
    const t = this.refineList().find(t => (t.worn ? `w:${t.slot}` : `i:${t.index}`) === key);
    const cost = t && refineCost(ITEMS[t.id], t.plus);
    if (!cost || !this.character.alive || this.character.gold < cost.gold || !this.character.count(cost.ore)) return;
    if (cost.risky && this.armed !== key) { this.armed = key; this.render(); return; }
    this.armed = null; this.forgeResult = null;
    // Set the lock before calling: offline results emit synchronously, online returns pending.
    const held = t.worn ? this.character.wornItem(t.slot) : this.character.inventory[t.index];
    this.refinePending = { key, item: t.id, iid: held?.roll?.iid, to: cost.to };
    const r = this.character.refineGear(t.worn ? t.slot : t.index);
    if (this.refinePending && r?.pending) this.refinePending.ack = r.ack;
    else if (this.refinePending && r?.ok === false) this.receiveRefine(r);
    this.render();
  }
  recoverRefine({ state, unknown }) {
    this.refinePending = null; this.armed = null;
    if (unknown) this.forgeResult = { recovery: state, serial: ++this.forgeSerial };
    this.render();
  }
  receiveRefine(r) {
    if (r.pending) return;
    // A refused/invalid reply must never become a success or a destruction effect.
    const valid = r.ok === true && ['up', 'broke'].includes(r.outcome) && refinable(ITEMS[r.item]) && Number.isInteger(r.to) && r.to > 0 && r.to <= REFINE_MAX;
    this.forgeResult = { ...r, ok: valid, serial: ++this.forgeSerial };
    if (!valid) {
      this.refinePending = null;
      this.notify(REFINE_WHY[r.why] ?? 'ตีบวกไม่ได้ กรุณาตรวจอุปกรณ์แล้วลองใหม่', 'warn');
    } else {
      this.settleRefine();
      this.notify(r.outcome === 'up' ? `ตีบวกสำเร็จ! ${plusName(r.item, r.to)}`
        : `ตีบวก +${r.to} ล้มเหลว · ${ITEMS[r.item].name}แตกสลาย${r.cards?.length ? ` พร้อม${r.cards.map(id => ITEMS[id]?.name).join(', ')}` : ''}`, r.outcome === 'up' ? 'gold' : 'warn');
    }
    this.render();
  }
  settleRefine() {
    const p = this.refinePending, r = this.forgeResult;
    if (!p || !r?.ok) return;
    const worn = p.key.startsWith('w:'), where = worn ? p.key.slice(2) : Number(p.key.slice(2));
    const s = worn ? this.character.wornItem(where) : this.character.inventory[where];
    // `refined` precedes `sync` online. Keep the next try locked until its item is adopted.
    const sameInstance = s?.id === p.item && s?.roll?.iid === p.iid;
    if (r.outcome === 'up' ? sameInstance && s.plus === r.to : !sameInstance) this.refinePending = null;
  }
  forgeFeedbackHtml() {
    const r = this.forgeResult;
    if (r?.recovery || (!r && this.character.refineRecovering)) {
      const waiting = this.character.refineRecovering;
      return `<div class="eh-result ${waiting ? 'waiting' : 'idle'}" role="status" aria-live="polite"><span aria-hidden="true">${waiting ? '⌛' : '↻'}</span><div><b>${waiting ? 'รอข้อมูลอุปกรณ์ล่าสุด…' : 'อัปเดตอุปกรณ์ล่าสุดแล้ว'}</b><small>${waiting ? `${r?.recovery ? 'ยังไม่ได้รับผลครั้งก่อน · ' : ''}รอเชื่อมต่อก่อนตีอีกครั้ง` : 'ไม่ได้รับผลครั้งก่อน · ตรวจอุปกรณ์ก่อนเริ่มตีครั้งใหม่'} · ไม่ส่งคำขอตีเดิมซ้ำ</small></div></div>`;
    }
    if (!r) return `<div class="eh-result${this.refinePending ? ' waiting' : ' idle'}" role="status" aria-live="polite"><span aria-hidden="true">${this.refinePending ? '⌛' : '✦'}</span><div><b>${this.refinePending ? 'กำลังรอผลตีบวก…' : 'หลอมศาสตราให้แข็งแกร่งขึ้น'}</b><small>${this.refinePending ? 'รอผลยืนยันก่อนตีครั้งถัดไป' : 'โบนัสเพิ่มมากขึ้นในขั้นสูง · ตรวจผลและความเสี่ยงก่อนตี'}</small></div></div>`;
    if (!r.ok) return `<div class="eh-result rejected" data-forge-result="${r.serial}" role="status" aria-live="polite"><span aria-hidden="true">×</span><div><b>ตีบวกไม่ได้</b><small>${esc(REFINE_WHY[r.why] ?? 'กรุณาตรวจอุปกรณ์แล้วลองใหม่')}</small></div></div>`;
    const d = ITEMS[r.item], cost = refineCost(d, r.to - 1);
    const cur = refineBonus(d, r.to - 1) ?? {}, nxt = refineBonus(d, r.to);
    const bonus = Object.entries(nxt).map(([k, v]) => `${BONUS[k]} +${cur[k] ?? 0} → +${v} (เพิ่ม +${v - (cur[k] ?? 0)})`).join(' · ');
    const success = r.outcome === 'up';
    const detail = success ? `${bonus}${MILESTONE_TH[r.to] ? ` · ถึงขั้น${MILESTONE_TH[r.to]} +${r.to}` : ''}`
      : `อุปกรณ์สูญเสีย${r.cards?.length ? ` พร้อม${r.cards.map(id => ITEMS[id]?.name ?? id).join(', ')}` : ''} · ใช้ ${fmt(cost.gold)} ตำลึง + ${ITEMS[cost.ore].name} 1 ชิ้น`;
    return `<div class="eh-result ${success ? 'success' : 'broke'}" data-forge-result="${r.serial}" role="status" aria-live="polite"><span aria-hidden="true">${success ? '✦' : '◇'}</span><div><b>${success ? `ตีบวกสำเร็จ · ${esc(plusName(r.item, r.to))}` : `ตีบวก +${r.to} ล้มเหลว · ${esc(d.name)}แตกสลาย`}</b><small>${esc(detail)}</small></div></div>`;
  }
  buyMany(id, n) {
    const c = this.character, d = ITEMS[id];
    const r = buy(c, this.shopType, id, n);
    if (!r.ok) { this.receipt = r.reason; this.notify(r.reason, 'warn'); return; }
    this.receipt = `ซื้อ ${d.name} ×${fmt(n)} · −${fmt(r.price)} ตำลึง`;
    this.notify(this.receipt, 'gold');
  }
  submitSale() {
    const lines = this.basket.lines(); if (!lines.length) return;
    if (!this.confirmSale) { this.confirmSale = true; return; }
    const count = lines.reduce((n, l) => n + l.qty, 0), gold = this.character.sellBatch(lines);
    this.confirmSale = false; this.basket.clear();
    if (!gold) { this.receipt = 'รายการเปลี่ยนไป กรุณาเลือกใหม่'; this.notify(this.receipt, 'warn'); return; }
    this.character.save?.(); this.receipt = `ขาย ${fmt(count)} ชิ้น · +${fmt(gold)} ตำลึง`;
    this.notify(this.receipt, 'gold');
  }
  matches(d) { return (!this.filter || groupOf(d) === this.filter) && `${d.name} ${describeItem(d)}`.toLowerCase().includes(this.search.trim().toLowerCase()); }
  toolbar(selling = false) {
    const available = selling ? this.character.inventory.filter(Boolean).map(s => s.id) : stockOf(this.shopType);
    return `<div class="sh-tools"><label class="sh-search"><span>⌕</span><input id="shop-search" type="search" placeholder="ค้นหาไอเท็ม…" aria-label="ค้นหาไอเท็ม" value="${esc(this.search)}"></label>
      <div class="sh-filters" aria-label="หมวดสินค้า">${[['', 'ทั้งหมด'], ...GROUPS.filter(([g]) => available.some(id => groupOf(ITEMS[id]) === g))].map(([g, th]) => `<button data-filter="${g}" aria-pressed="${g === this.filter}" class="${g === this.filter ? 'on' : ''}">${th}</button>`).join('')}</div></div>`;
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
      <span class="sh-tx"><b>${d.name}${d.type === 'equip' && d.slots ? ` [${d.slots}]` : ''}${tag}</b><small>${describeItem(d)}</small></span><span class="sh-pr" title="${fmt(price)} ตำลึง">${fmt(price)}</span></button>`;
  }
  buyHtml() {
    const c = this.character, stock = stockOf(this.shopType);
    if (!stock.includes(this.sel)) { this.sel = stock[0]; this.qty = 1; }
    const groups = GROUPS.map(([g, th, sub]) => {
      const ids = stock.filter(id => groupOf(ITEMS[id]) === g && this.matches(ITEMS[id])); if (!ids.length) return '';
      return `<div class="sh-group"><p class="sh-gh"><b>${th}</b>${sub ? `<small>${sub}</small>` : ''}</p><div class="sh-rows">${ids.map(id => {
        const have = c.count(id);
        return this.row('data-buy', id, ITEMS[id], { on: id === this.sel, tag: have ? `<i class="sh-tag">x${fmt(have)}</i>` : '', price: buyPrice(c, id), dim: c.gold < buyPrice(c, id) });
      }).join('')}</div></div>`;
    }).join('');
    return `<div class="sh-trade">${this.toolbar()}<div class="sh-split"><div class="sh-left">${groups || '<p class="shop-empty">ไม่พบสินค้า ลองเปลี่ยนคำค้นหรือหมวด</p>'}</div><aside class="sh-right">${this.buyDetail(this.sel)}</aside></div><p class="sh-receipt" role="status">${esc(this.receipt || 'เลือกสินค้า → ระบุจำนวน → ซื้อ')}</p></div>`;
  }
  buyDetail(id) {
    const c = this.character, d = ITEMS[id];
    if (!d) return '<p class="shop-empty">เลือกสินค้าทางซ้าย</p>';
    const one = single(d), n = one ? 1 : this.qty, cost = buyPrice(c, id) * n, ok = c.gold >= cost && c.canTake(id, n);
    const afford = Math.floor(c.gold / Math.max(1, buyPrice(c, id)));
    const amount = one ? '' : `<div class="sh-qty"><button type="button" data-qd="-1" aria-label="ลด">−</button><input id="shop-qty" type="number" min="1" max="999" value="${n}" inputmode="numeric" aria-label="จำนวน"><button type="button" data-qd="1" aria-label="เพิ่ม">+</button></div>
      <div class="sh-quick">${[1, 10, 20, 50].map(q => `<button type="button" data-qty="${q}" class="${n === q ? 'on' : ''}${q > afford && q > 1 ? ' poor' : ''}">x${q}</button>`).join('')}</div>`;
    return `<div class="sh-dhead">${icon(d)}<span><b>${d.name}</b><small>${typeOf(d)}${d.weight ? ` · หนัก ${d.weight}` : ''}${d.slots ? ` · ช่องการ์ด ${d.slots}` : ''}</small></span></div>
      <p class="sh-desc">${describeItem(d) || '—'}</p>
      <div class="sh-have"><span>มีในกระเป๋า</span><b>${fmt(c.count(id))} ชิ้น</b></div>
      <div class="sh-fill"></div>${amount}
      <div class="sh-total"><span>รวม</span><b class="${ok ? '' : 'bad'}">${fmt(cost)} ตำลึง</b></div>
      <button type="button" class="sh-go" data-go="${id}" ${ok ? '' : 'disabled'}>${!ok ? c.gold < cost ? 'ตำลึงไม่พอ' : 'น้ำหนักหรือช่องกระเป๋าไม่พอ' : one ? 'ซื้อ' : `ซื้อ ${fmt(n)} ชิ้น`}</button>`;
  }
  saleCandidates() {
    return this.character.inventory.flatMap((slot, index) => slot && ITEMS[slot.id] && !isItemLocked(slot) && sellPrice(slot.id) > 0 && this.matches(ITEMS[slot.id]) ? [{ slot, index }] : []);
  }
  sellHtml() {
    const inv = this.character.inventory, lines = this.basket.lines(), total = this.basket.total();
    const rows = inv.map((s, i) => {
      if (!s || !this.matches(ITEMS[s.id])) return '';
      const locked = isItemLocked(s) || sellPrice(s.id) <= 0;
      const picked = this.basket.picks.has(i), precious = s.roll || s.plus || s.cards?.length;
      const quality = instanceQuality(s);
      const label = precious ? `◆ อุปกรณ์พิเศษ${quality ? ` · ${esc(quality)}` : ''}${s.cards?.length ? ` · ${s.cards.length} การ์ด` : ''}` : typeOf(ITEMS[s.id]);
      return `<button class="sh-row sh-sale-row${picked ? ' on' : ''}" data-pick="${i}" aria-pressed="${picked}" ${locked ? 'disabled title="ของล็อกไว้หรือขายไม่ได้"' : ''}><span class="sh-check">${locked ? '—' : picked ? '✓' : ''}</span>${icon(ITEMS[s.id])}<span class="sh-tx"><b>${esc(instanceName(s))}</b><small>${label} · มี ${fmt(s.qty)}</small></span><span class="sh-pr">${fmt(sellPrice(s.id))}<small>/ ชิ้น</small></span></button>`;
    }).join('');
    const basket = lines.map(({ index: i, qty }) => { const s = inv[i]; return `<div class="sh-basket-row"><span><b>${esc(instanceName(s))}</b><small>+${fmt(sellPrice(s.id) * qty)} ตำลึง</small></span><input type="number" inputmode="numeric" min="0" max="${s.qty}" value="${qty}" data-sale-qty="${i}" aria-label="จำนวนขาย ${ITEMS[s.id].name}"></div>`; }).join('');
    const risky = lines.some(l => inv[l.index].roll || inv[l.index].plus || inv[l.index].cards?.length);
    return `<div class="sh-trade">${this.toolbar(true)}<div class="sh-split sh-selling"><div class="sh-left"><div class="sh-sale-tools"><div><b>ของในกระเป๋า</b><small>เลือกได้ ${this.saleCandidates().length} รายการ · ข้ามของล็อก</small></div><button type="button" data-sale-all ${this.saleCandidates().some(({index}) => !this.basket.picks.has(index)) ? '' : 'disabled'}>เลือกทั้งหมดในหมวด</button></div><div class="sh-rows">${rows || '<p class="shop-empty">ไม่พบไอเท็มในหมวดนี้</p>'}</div></div>
      <aside class="sh-right sh-basket"><div class="sh-basket-title"><b>ถาดรอขาย <i>${lines.length}</i></b><button data-sale-clear ${lines.length ? '' : 'disabled'}>ล้าง</button></div><div class="sh-basket-list">${basket || '<p class="shop-empty">เลือกของจากกระเป๋า<br><small>ปรับจำนวนก่อนขายได้</small></p>'}</div>
      ${risky ? '<p class="sh-warn">มีอุปกรณ์ออฟสุ่ม / ตีบวก / ใส่การ์ด · ขายแล้วสูญเสียทั้งชิ้น</p>' : ''}<div class="sh-total"><span>ได้รับทั้งหมด</span><b>${fmt(total)} ตำลึง</b></div><small class="sh-after">ตำลึงหลังขาย ${fmt(this.character.gold + total)}</small>
      <button class="sh-go${this.confirmSale ? ' alt' : ''}" data-sale-submit ${lines.length ? '' : 'disabled'}>${this.confirmSale ? `ยืนยันขาย · +${fmt(total)} ตำลึง` : `ตรวจรายการขาย ${lines.length} รายการ`}</button></aside></div><p class="sh-receipt" role="status">${esc(this.receipt || (this.confirmSale ? 'ตรวจจำนวนและยอดตำลึง แล้วกดยืนยันขาย' : 'เลือกขายเฉพาะของที่ต้องการ · ของที่สวมอยู่ไม่อยู่ในรายการ'))}</p></div>`;
  }
  // gear in the bag that holds cards, with the price and the odds
  cardsHtml() {
    const c = this.character, rows = c.inventory.map((s, i) => {
      if (!s?.cards?.length) return '';
      const cost = c.stripCost(i), d = ITEMS[s.id], afford = c.gold >= cost.gold && c.count('ash') >= cost.ash, armed = this.armed === i;
      return `<button class="shop-row${armed ? ' armed' : ''}" data-strip="${i}" ${afford ? '' : 'disabled'}>
        <i style="--rar:${RARITY_COLORS[d.rarity] ?? '#e9dfc0'}">${iconHtml(d)}</i><span><b>${esc(instanceName(s))}</b><small>${s.cards.map(id => ITEMS[id].name).join(', ')}</small></span>
        <em>${armed ? 'กดอีกครั้งเพื่อยืนยัน' : `${cost.gold} ตำลึง · ขี้เถ้าธูป ${cost.ash}`}</em></button>`;
    }).join('');
    return `<p class="shop-note">หมออาคมถอดการ์ดออกจากอุปกรณ์ในกระเป๋าได้ทั้งหมดในครั้งเดียว · การ์ดละ ${STRIP.gold} ตำลึง + ขี้เถ้าธูป ${STRIP.ash}<br>สำเร็จ ${Math.round(STRIP.ok * 100)}% · อุปกรณ์แตก ${Math.round(STRIP.itemBreaks * 100)}% (ได้การ์ดคืน) · การ์ดแตก ${Math.round((1 - STRIP.ok - STRIP.itemBreaks) * 100)}%</p>`
      + (rows || '<p class="shop-empty">ไม่มีอุปกรณ์ที่ใส่การ์ดในกระเป๋า (ถอดอุปกรณ์ที่สวมอยู่ออกก่อน)</p>');
  }
  // Quiet jade/brass forge: item, odds, cumulative bonuses, milestone rewards and exact risks.
  refineHtml() {
    const c = this.character, list = this.refineList(), keyOf = t => (t.worn ? `w:${t.slot}` : `i:${t.index}`);
    if (!list.length) return `${this.forgeFeedbackHtml()}<p class="shop-empty">ไม่มีอุปกรณ์ที่ตีบวกได้ (เครื่องรางตีบวกไม่ได้)</p>`;
    if (!list.some(t => keyOf(t) === this.enhSel)) this.enhSel = keyOf(list[0]);
    const key = this.enhSel, t = list.find(x => keyOf(x) === key), d = ITEMS[t.id];
    const cost = refineCost(d, t.plus), max = !cost, armed = this.armed === key;
    const cur = refineBonus(d, t.plus) ?? {}, nxt = (cost && refineBonus(d, cost.to)) ?? cur;
    const stats = Object.keys(nxt).map(k => {
      const held = t.worn ? c.wornItem(t.slot) : c.inventory[t.index];
      const base = (d.bonus?.[k] ?? 0) + (affixBonus(t.id, held?.roll)[k] ?? 0) + t.cards.reduce((n, id) => n + (ITEMS[id]?.bonus?.[k] ?? 0), 0);
      return `<div class="eh-stat"><span><small>โบนัสตีบวก · ${BONUS[k] ?? k}</small><b>+${fmt(cur[k])} <i>→</i> <em>+${fmt(nxt[k])}</em></b><small>พลังไอเท็มรวม ${fmt(base + (cur[k] ?? 0))} → ${fmt(base + nxt[k])}</small></span><span class="eh-gain"><small>${max ? 'โบนัสสูงสุด' : 'ขั้นถัดไปเพิ่ม'}</small><b>${max ? `+${fmt(nxt[k])}` : `+${fmt(nxt[k] - (cur[k] ?? 0))}`}</b></span></div>`;
    }).join('');
    const ore = cost && ITEMS[cost.ore], have = cost ? c.count(cost.ore) : 0, rate = cost ? Math.round(cost.rate * 100) : 0;
    const pending = !!this.refinePending || !!c.refineRecovering;
    const can = !!cost && c.alive && c.gold >= cost.gold && have > 0 && !pending, sells = !!cost && stockOf(this.shopType).includes(cost.ore);
    const label = c.refineRecovering ? 'รอข้อมูลอุปกรณ์ล่าสุด…' : pending ? this.forgeResult ? 'กำลังอัปเดตอุปกรณ์…' : 'กำลังรอผล…' : max ? 'สูงสุดแล้ว' : !c.alive ? 'ต้องฟื้นคืนชีพก่อน' : armed ? 'เสี่ยงแตก! ยืนยันตีบวก' : !have ? `ไม่มี${ore.name}` : c.gold < cost.gold ? 'ตำลึงไม่พอ' : `ตีบวก +${cost.to}`;
    const milestones = REFINE_MILESTONES.map(n => `<div class="eh-milestone${t.plus >= n ? ' reached' : cost?.to === n ? ' next' : ''}"><b>+${n} <small>${MILESTONE_TH[n]}</small></b><span>${Object.entries(refineBonus(d, n)).map(([k, v]) => `${BONUS[k]} +${fmt(v)}`).join(' · ')}</span><small>${t.plus >= n ? 'ถึงขั้นนี้แล้ว' : cost?.to === n ? 'ขั้นถัดไป' : n <= REFINE_SAFE ? 'สำเร็จเสมอ' : 'มีโอกาสแตก'}</small></div>`).join('');
    const row = x => {
      const dx = ITEMS[x.id], cx = refineCost(dx, x.plus), k = keyOf(x);
      return `<button type="button" class="eh-slot${k === key ? ' on' : ''}" data-esel="${k}" aria-pressed="${k === key}" ${pending ? 'disabled' : ''}>${icon(dx)}<span class="sh-tx"><b>${esc(instanceName(x.worn ? c.wornItem(x.slot) : c.inventory[x.index]))}</b>`
        + `<small>${x.worn ? SLOT_TH[x.slot] ?? x.slot : 'ในกระเป๋า'} · ${!cx ? 'สูงสุดแล้ว' : cx.risky ? `สำเร็จ ${Math.round(cx.rate * 100)}%` : 'ปลอดภัย'}</small></span><b class="eh-lv enh ${enhTier(x.plus)}">+${x.plus}</b></button>`;
    };
    const worn = list.filter(x => x.worn), bag = list.filter(x => !x.worn);
    return `<div class="sh-split eh" aria-busy="${pending}">
      <div class="sh-left eh-main">
        <div class="eh-content">
        <div class="eh-title"><b>ตีบวก${t.worn ? SLOT_TH[t.slot] ?? '' : ''}</b><small>${esc(instanceName(t.worn ? c.wornItem(t.slot) : c.inventory[t.index]))} · ${t.worn ? 'สวมอยู่' : 'ในกระเป๋า'}</small></div>
        ${this.forgeFeedbackHtml()}
        <div class="eh-stage">
          <div class="eh-ring ${enhTier(max ? t.plus : cost.to)}"><i class="eh-rays"></i><span class="eh-item" style="--rar:${RARITY_COLORS[d.rarity] ?? '#e9dfc0'}">${iconHtml(d)}</span>
            <div class="eh-step">${max ? `<b class="enh ${enhTier(t.plus)}">+${t.plus}</b> <small>สูงสุด</small>` : `<b class="enh ${enhTier(t.plus)}">+${t.plus}</b> → <b class="enh ${enhTier(cost.to)}">+${cost.to}</b>`}</div></div>
          <div class="eh-box rate"><small>โอกาสสำเร็จ</small><b class="eh-pct${rate >= 100 ? ' safe' : ''}">${max ? '—' : `${rate}%`}</b><i class="eh-bar"><i style="width:${rate}%"></i></i><small>${max ? `ตีได้สูงสุด +${REFINE_MAX}` : cost.risky ? `ล้มเหลว ${100 - rate}% · แตกสลายพร้อมการ์ด` : `ถึง +${REFINE_SAFE} สำเร็จเสมอ`}</small></div>
        </div>
        <div class="eh-bonus">${stats}<small>ตีบวกเพิ่มเฉพาะพลังพื้นฐาน · ออฟสุ่มและการ์ดคงเดิม</small></div>
        <div class="eh-milestones" aria-label="โบนัสสะสมตามหมุดหมาย">${milestones}</div>
        <div class="eh-mats">
          ${ore ? `<div class="eh-mat${have < 1 ? ' miss' : ''}">${icon(ore)}<span><b>${ore.name}</b><small>${have} / 1</small></span>${have < 1 && sells ? `<button type="button" class="sh-go alt sm" data-ebuy="${cost.ore}" ${pending ? 'disabled' : ''}>ซื้อ ${fmt(buyPrice(c, cost.ore))}</button>` : ''}</div>` : ''}
          <div class="eh-mat${t.cards.length && cost?.risky ? ' miss' : ' off'}"><span class="sh-ic">❖</span><span><b>การ์ดที่ใส่ไว้</b><small>${t.cards.length ? `${t.cards.length} ใบ${cost?.risky ? ' · แตกด้วยถ้าพลาด' : ''}` : 'ไม่มี'}</small></span></div>
          <div class="eh-mat off"><span class="sh-ic">✦</span><span><b>ขั้นปลอดภัย</b><small>ถึง +${REFINE_SAFE} สำเร็จเสมอ</small></span></div>
        </div>
        <p class="sh-note">ค่าตีและแร่ใช้ทุกครั้ง ทั้งสำเร็จและล้มเหลว · ตีบวกเพิ่มเฉพาะพลังพื้นฐาน ออฟสุ่มและการ์ดคงเดิม · ไม่สุ่มออฟใหม่ · สูงสุด +${REFINE_MAX}</p>
        </div>
        <div class="eh-foot"><p class="eh-risk${cost?.risky ? ' risky' : ''}">${max ? 'ศาสตราชิ้นนี้ถึงขั้นสูงสุดแล้ว' : cost.risky ? `⚠ ล้มเหลว ${100 - rate}%: อุปกรณ์${t.cards.length ? `และการ์ด ${t.cards.length} ใบ` : ''}สูญเสียถาวร` : `✦ ถึง +${REFINE_SAFE} สำเร็จเสมอ · การ์ดไม่เสี่ยงแตก`}</p><span class="eh-cost"><small>ค่าตีบวก</small><b class="${cost && c.gold < cost.gold ? 'bad' : ''}">${max ? '—' : `${fmt(cost.gold)} ตำลึง`}</b>${cost ? `<small>เหลือ ${fmt(Math.max(0, c.gold - cost.gold))}</small>` : ''}</span>
          <button type="button" class="sh-go${armed ? ' danger' : ''}" data-refine="${key}" ${cost?.risky ? 'data-risky="1"' : ''} ${can ? '' : 'disabled'}>${label}</button></div>
      </div>
      <aside class="sh-right eh-list">${worn.length ? `<p class="sh-gh"><b>อุปกรณ์ที่สวมอยู่</b><small>เลือกชิ้นที่จะตี</small></p>${worn.map(row).join('')}` : ''}${bag.length ? `<p class="sh-gh"><b>ในกระเป๋า</b></p>${bag.map(row).join('')}` : ''}</aside></div>`;
  }
  close() {
    $('shop').hidden = true; this.npc = null;
    // A pending result still arrives after closing; reopening must not send a second try.
    if (!this.refinePending && !this.character?.refineRecovering) { this.unsub?.(); this.unsub = null; }
  }
  render() {
    if (!this.open) return;
    const list = $('shop-list'), scroll = this.tab === 'refine' ? '.eh-content' : '.sh-left', top = list.querySelector(scroll)?.scrollTop ?? 0;
    const feedback = list.querySelector('[data-forge-result]');
    $('shop-gold').textContent = fmt(this.character.gold);
    $('shop-rail').innerHTML = this.tabs();
    list.innerHTML = this.tab === 'cards' ? `<div class="sh-pad">${this.cardsHtml()}</div>`
      : this.tab === 'refine' ? this.refineHtml()
      : this.tab === 'buy' ? this.buyHtml() : this.sellHtml();
    if (SHOPS[this.shopType]?.refillFlasks) { const refill=document.createElement('button'); refill.type='button'; refill.dataset.refillFlasks=''; refill.className='ro-button sh-refill-flasks'; refill.textContent='เติมประจุขวด Q / E · ฟรีในเมือง'; list.prepend(refill); }
    const nextFeedback = list.querySelector('[data-forge-result]');
    // Preserve the one-shot result animation across the following server inventory sync.
    if (feedback && nextFeedback && feedback.dataset.forgeResult === nextFeedback.dataset.forgeResult) nextFeedback.replaceWith(feedback);
    const left = list.querySelector(scroll); if (left) left.scrollTop = top;
  }
}
