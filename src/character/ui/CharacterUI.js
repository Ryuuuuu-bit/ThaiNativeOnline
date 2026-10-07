// Character interface: player frame, quick potions, character sheet and bag.
import { STATS, STAT_LABELS, STAT_HINTS, POINTS_PER_LEVEL } from '../data/classes.js';
import { ITEMS, RARITY_COLORS } from '../data/items.js';
import { el, esc, setBar } from './dom.js';
import './character.css';
import { classBadge, iconHtml } from '../../ui/icons.js';
import { BAG_TABS, inTab, compareToWorn, matchesSearch, sortBag, sortedInventory } from '../bag.js';

const AUTO_SORT_KEY = 'thainative.bag.autoSort';
const pref = { get: k => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } } };

const SLOT_LABELS = { weapon: 'อาวุธ', armor: 'เสื้อเกราะ', charm: 'เครื่องราง' };
const BONUS_LABELS = { atk: 'ATK', matk: 'MATK', def: 'DEF', hp: 'HP', mp: 'MP', crit: 'คริ', critDmg: 'แรงคริ', acc: 'แม่นยำ', eva: 'หลบ' };
const PERCENT_BONUS = new Set(['crit', 'critDmg']);

function itemTip(id) {
  const d = ITEMS[id];
  const bonus = d.bonus ? Object.entries(d.bonus).map(([k, v]) => `${STAT_LABELS[k] ? k.toUpperCase() : BONUS_LABELS[k] ?? k} +${PERCENT_BONUS.has(k) ? `${Math.round(v * 100)}%` : v}`).join(' · ') : '';
  return `${d.name}${d.slot ? ` (${SLOT_LABELS[d.slot]})` : ''}\n${d.desc || bonus}\nน้ำหนัก ${d.weight || 0} · ราคาขาย ${Math.max(1, Math.floor(d.price / 2))} ทอง`;
}

export class CharacterUI {
  /**
   * @param {HTMLElement} layer  container for panels
   * @param {import('../Character.js').Character} character
   * @param {import('./Feed.js').Feed} feed
   * @param {object} [o]
   * @param {Record<string,string>} [o.buffIcons]  icon per buff id
   */
  constructor(layer, character, feed, { buffIcons = {} } = {}) {
    this.layer = layer; this.c = character; this.feed = feed; this.buffIcons = buffIcons;
    document.body.classList.add('game-on');
    this.buildFrame(); this.buildQuickButtons(); this.buildPanels(); this.bind();
    this.refresh(); this.refreshInventory();
  }

  buildFrame() {
    const c = this.c;
    this.frame = el('aside', 'g-player glass', `
      <div class="g-portrait" style="--cls:${c.cls.color}">${classBadge(c.classId, c.cls, { size: 30 })}<span class="g-lv"></span></div>
      <div class="g-player-info">
        <div class="g-player-name"><b>${esc(c.name)}</b><span>${c.cls.name} · ${c.gender === 'female' ? 'หญิง' : 'ชาย'}</span></div>
        <div class="g-bar g-hp" title="HP"><span></span><em></em></div>
        <div class="g-bar g-mp" title="MP"><span></span><em></em></div>
        <div class="g-bar g-exp" title="EXP"><span></span><em></em></div>
        <div class="g-buffs"></div>
      </div>`);
    this.layer.append(this.frame);
  }
  // Potion and menu buttons; the combat HUD places them on its action bar.
  buildQuickButtons() {
    this.potionHp = el('button', 'g-skill g-potion', `<span class="g-skill-icon">${iconHtml(ITEMS.potion_s)}</span><kbd>Q</kbd><small></small>`);
    this.potionHp.title = 'ดื่มยาฟื้น HP'; this.potionHp.addEventListener('click', () => this.quickPotion('hp'));
    this.potionMp = el('button', 'g-skill g-potion mp', `<span class="g-skill-icon">${iconHtml(ITEMS.ether)}</span><kbd>F</kbd><small></small>`);
    this.potionMp.title = 'ดื่มน้ำผึ้งฟื้น MP'; this.potionMp.addEventListener('click', () => this.quickPotion('mp'));
    const menus = [['C', 'ตัวละคร', 'sheet'], ['I', 'กระเป๋า', 'bag']].map(([key, label, panel]) => {
      const b = el('button', 'g-menu', `<kbd>${key}</kbd>${label}`); b.addEventListener('click', () => this.toggle(panel)); return b;
    });
    this.quickButtons = { potions: [this.potionHp, this.potionMp], menus };
  }
  buildPanels() {
    this.sheet = el('section', 'g-panel g-sheet glass', `<div class="panel-heading">ตัวละคร<button aria-label="ปิด">×</button></div><div class="g-sheet-body"></div>`);
    this.bag = el('section', 'g-panel g-bag glass', `<div class="panel-heading">กระเป๋า<button aria-label="ปิด">×</button></div>
      <div class="g-gold"></div><div class="g-bar g-weight" title="น้ำหนักสัมภาระ (STR เพิ่มความจุ)"><span></span><em></em></div>
      <div class="g-bag-tabs" role="tablist">${BAG_TABS.map((t, i) => `<button role="tab" data-tab="${t.id}" aria-selected="${i === 0}">${t.label}</button>`).join('')}</div>
      <div class="g-bag-tools"><input class="g-bag-search" type="search" placeholder="ค้นหา…" aria-label="ค้นหาไอเท็ม" /><button class="g-bag-sort" title="เรียงไอเท็มและรวมกองซ้ำ">เรียง</button><label class="g-bag-auto" title="เรียงให้เองทุกครั้งที่ได้ของ"><input type="checkbox" /> อัตโนมัติ</label></div>
      <div class="g-grid"></div><p class="g-bag-none" hidden>ไม่มีไอเท็มในหมวดนี้</p>
      <label class="g-sell"><input type="checkbox" /> โหมดขาย (คลิกไอเท็มเพื่อขาย)</label><p class="g-hint">คลิกเพื่อใช้หรือสวมใส่</p>`);
    for (const p of [this.sheet, this.bag]) { p.hidden = true; p.querySelector('.panel-heading button').addEventListener('click', () => { p.hidden = true; }); this.layer.append(p); }
    this.sellMode = this.bag.querySelector('.g-sell input');
    this.sellMode.addEventListener('change', () => this.bag.classList.toggle('selling', this.sellMode.checked));
    this.grid = this.bag.querySelector('.g-grid');
    // tabs, search and sorting only change what the panel shows and the slot order
    this.tab = 'all'; this.query = '';
    this.bag.querySelector('.g-bag-tabs').addEventListener('click', e => {
      const b = e.target.closest('[data-tab]'); if (!b) return;
      this.tab = b.dataset.tab; this.bag.querySelectorAll('[data-tab]').forEach(t => t.setAttribute('aria-selected', String(t === b))); this.refreshInventory();
    });
    const search = this.bag.querySelector('.g-bag-search');
    search.addEventListener('input', () => { this.query = search.value; this.refreshInventory(); });
    search.addEventListener('keydown', e => e.stopPropagation());   // typing must not cast skills or close the bag
    this.bag.querySelector('.g-bag-sort').addEventListener('click', () => sortBag(this.c));
    this.autoSort = this.bag.querySelector('.g-bag-auto input');
    this.autoSort.checked = pref.get(AUTO_SORT_KEY) === '1';
    this.autoSort.addEventListener('change', () => { pref.set(AUTO_SORT_KEY, this.autoSort.checked ? '1' : '0'); if (this.autoSort.checked) sortBag(this.c); });
    this.grid.addEventListener('click', e => {
      const slot = e.target.closest('[data-index]'); if (!slot) return;
      const i = Number(slot.dataset.index), item = this.c.inventory[i]; if (!item) return;
      if (this.sellMode.checked) { const gold = this.c.sellAt(i); this.feed.log(`ขาย ${ITEMS[item.id].name} ได้ ${gold} ทอง`, 'gold'); }
      else if (!this.c.useAt(i) && ITEMS[item.id].type === 'use') this.feed.log('HP เต็มอยู่แล้ว');
    });
    this.sheet.addEventListener('click', e => {
      const add = e.target.closest('[data-stat]'); if (add) this.c.allocate(add.dataset.stat);
      const slot = e.target.closest('[data-slot]'); if (slot) this.c.unequip(slot.dataset.slot);
      if (e.target.closest('.g-reset')) this.c.resetStats();
    });
  }

  bind() {
    const c = this.c;
    c.on('change', () => this.refresh());
    c.on('inventory', () => this.refreshInventory());
    c.on('inventory-full', id => this.feed.log(`กระเป๋าเต็ม ทิ้ง ${ITEMS[id].name}`, 'bad'));
    c.on('overweight', id => this.feed.log(`หนักเกินไป ถือ ${ITEMS[id].name} ไม่ไหว`, 'bad'));
    c.on('levelup', lv => { this.feed.banner(`เลเวลอัป · Lv. ${lv}`, `ได้รับแต้มสถานะ ${POINTS_PER_LEVEL} แต้ม กด C เพื่ออัปสถานะ`); this.feed.log(`เลเวลอัปเป็น ${lv}!`, 'gold'); });
    c.on('used', id => this.feed.log(`ใช้ ${ITEMS[id].name}`));
    c.on('damaged', () => { this.frame.classList.remove('g-shake'); void this.frame.offsetWidth; this.frame.classList.add('g-shake'); });
  }

  // Returns true when the key was handled.
  handleKey(e) {
    const k = e.code;
    if (k === 'KeyQ') { this.quickPotion('hp'); return true; }
    if (k === 'KeyF') { this.quickPotion('mp'); return true; }
    if (k === 'KeyC') { this.toggle('sheet'); return true; }
    if (k === 'KeyI' || k === 'KeyB') { this.toggle('bag'); return true; }
    if (k === 'Escape' && (!this.sheet.hidden || !this.bag.hidden)) { this.sheet.hidden = true; this.bag.hidden = true; return true; }
    return false;
  }
  quickPotion(kind) { if (!this.c.quickUse(kind)) this.feed.log(kind === 'hp' ? 'ไม่มียาฟื้น HP หรือ HP เต็มแล้ว' : 'ไม่มีน้ำผึ้งป่า', 'bad', true); }
  toggle(name) {
    const p = this[name]; p.hidden = !p.hidden;
    if (!p.hidden) { if (name === 'sheet') this.refreshSheet(); else this.refreshInventory(); }
  }

  buffsHtml() { return this.c.buffs.map(b => `<i title="${b.id}">${iconHtml(this.buffIcons[b.id] ?? { icon: '✧' })}<b>${Math.ceil(b.remaining)}</b></i>`).join(''); }
  refresh() {
    const c = this.c;
    this.frame.querySelector('.g-lv').textContent = c.level;
    setBar(this.frame.querySelector('.g-hp'), c.hp, c.maxHp);
    setBar(this.frame.querySelector('.g-mp'), c.mp, c.maxMp);
    setBar(this.frame.querySelector('.g-exp'), c.exp, c.expNeeded, `EXP ${(c.exp / c.expNeeded * 100).toFixed(1)}%`);
    this.frame.classList.toggle('g-low', c.hp / c.maxHp < .3);
    this.frame.querySelector('.g-buffs').innerHTML = this.buffsHtml();
    this.frame.querySelector('.g-portrait').classList.toggle('g-points', c.points > 0);
    this.potionHp.querySelector('small').textContent = c.count('potion_s') + c.count('potion_m');
    this.potionMp.querySelector('small').textContent = c.count('ether');
    if (!this.sheet.hidden) this.refreshSheet();
    this.bag.querySelector('.g-gold').textContent = `◉ ${c.gold.toLocaleString()} ทอง`;
    const w = c.weight, max = c.maxWeight, heavy = c.heavy, bar = this.bag.querySelector('.g-weight');
    setBar(bar, w, max, `น้ำหนัก ${w.toLocaleString()} / ${max.toLocaleString()}${heavy ? ' · หนัก: HP/MP ไม่ฟื้นเอง' : ''}`);
    bar.classList.toggle('heavy', heavy);
    if (this.wasHeavy !== undefined && heavy !== this.wasHeavy) this.feed.log(heavy ? 'สัมภาระหนัก HP/MP จะไม่ฟื้นเอง' : 'สัมภาระเบาลงแล้ว', heavy ? 'bad' : '');
    this.wasHeavy = heavy;
  }
  refreshSheet() {
    const c = this.c, s = c.stats;
    this.sheet.querySelector('.g-sheet-body').innerHTML = `
      <div class="g-sheet-head"><span class="g-portrait" style="--cls:${c.cls.color}">${classBadge(c.classId, c.cls, { size: 24 })}</span><div><b>${esc(c.name)}</b><small>${c.cls.name} · Lv. ${c.level}</small></div></div>
      <div class="g-equip">${Object.keys(SLOT_LABELS).map(slot => { const id = c.equipment[slot]; return `<button data-slot="${slot}" title="${id ? `${itemTip(id)}\nคลิกเพื่อถอด` : 'ว่าง'}" style="--rar:${id ? RARITY_COLORS[ITEMS[id].rarity] : '#555'}"><span>${id ? iconHtml(ITEMS[id]) : '·'}</span><small>${id ? ITEMS[id].name : SLOT_LABELS[slot]}</small></button>`; }).join('')}</div>
      <div class="g-stats-head"><span>สถานะ</span><span class="${c.points ? 'g-has-points' : ''}">แต้มคงเหลือ ${c.points}</span></div>
      ${STATS.map(k => `<div class="g-stat" title="${STAT_HINTS[k]}"><span>${k.toUpperCase()} <small>${STAT_LABELS[k]}</small></span><b>${s[k]}</b><button data-stat="${k}" ${c.points ? '' : 'disabled'} aria-label="เพิ่ม${STAT_LABELS[k]}">+</button></div>`).join('')}
      <div class="g-derived">
        <span>HP</span><b>${c.maxHp}</b><span>MP</span><b>${c.maxMp}</b>
        <span title="พลังโจมตีกายภาพ (STR, ธนูใช้ DEX)">ATK</span><b>${c.patk}</b><span title="พลังเวท/ยา (INT)">MATK</span><b>${c.matk}</b>
        <span title="ลดความเสียหายกายภาพ (VIT)">DEF</span><b>${c.defense}</b><span title="หลบหลีก (AGI, LUK)">หลบ</span><b>${c.evasion}</b>
        <span title="ความแม่นยำ (DEX, LUK)">แม่นยำ</span><b>${c.accuracy}</b><span title="โอกาสคริติคอล (LUK)">คริ</span><b>${(c.critChance * 100).toFixed(1)}%</b>
        <span title="ตัวคูณความแรงคริ (LUK)">แรงคริ</span><b>×${c.critDamage.toFixed(2)}</b><span title="ลดเวลาระหว่างการตีปกติ (AGI)">ความเร็วตี</span><b>+${Math.round(c.attackSpeed * 100)}%</b>
        <span title="ลดคูลดาวน์สกิล (DEX)">ลดคูลดาวน์</span><b>${Math.round(c.cooldownCut * 100)}%</b><span title="น้ำหนักที่แบก (STR เพิ่มความจุ)">น้ำหนัก</span><b class="${c.heavy ? 'g-heavy' : ''}">${c.weight}/${c.maxWeight}</b>
      </div>
      <button class="g-reset" ${Object.values(c.alloc).some(Boolean) ? '' : 'disabled'}>รีเซ็ตแต้มสถานะ</button>`;
  }
  refreshInventory() {
    const inv = this.c.inventory;
    // auto-sort: reorder once (sortBag emits 'inventory', which renders the sorted bag)
    if (this.autoSort?.checked && !this.sorting && JSON.stringify(sortedInventory(inv)) !== JSON.stringify(inv)) {
      this.sorting = true; try { sortBag(this.c); } finally { this.sorting = false; } return;
    }
    const filtered = this.tab !== 'all' || this.query.trim();
    let shown = 0;
    this.grid.innerHTML = inv.map((s, i) => {
      if (!s) return filtered ? '' : `<button class="g-slot empty" data-index="${i}" aria-label="ช่องว่าง"></button>`;
      if (!inTab(this.tab, s.id) || !matchesSearch(s.id, this.query)) return '';
      const d = ITEMS[s.id], cmp = compareToWorn(this.c, s.id); shown++;
      const arrow = cmp > 0 ? '<i class="g-cmp up" title="ดีกว่าที่ใส่อยู่">▲</i>' : cmp < 0 ? '<i class="g-cmp down" title="แย่กว่าที่ใส่อยู่">▼</i>' : '';
      return `<button class="g-slot rar-${d.rarity || 'none'}" data-index="${i}" title="${esc(itemTip(s.id))}${cmp ? `\n${cmp > 0 ? '▲ ดีกว่าที่ใส่อยู่' : '▼ แย่กว่าที่ใส่อยู่'}` : ''}" style="--rar:${RARITY_COLORS[d.rarity] || '#8d8a78'}"><span>${iconHtml(d)}</span>${arrow}${s.qty > 1 ? `<small>${s.qty}</small>` : ''}</button>`;
    }).join('');
    this.bag.querySelector('.g-bag-none').hidden = !filtered || shown > 0;
    this.refresh();
  }
  // Per frame: buff timers count down.
  update() { if (this.c.buffs.length) this.frame.querySelector('.g-buffs').innerHTML = this.buffsHtml(); }
}
