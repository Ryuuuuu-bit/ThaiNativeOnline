// Character interface: player frame, quick potions, character sheet and bag.
import { STATS, STAT_LABELS } from '../data/classes.js';
import { ITEMS, RARITY_COLORS } from '../data/items.js';
import { el, esc, setBar } from './dom.js';
import './character.css';
import { classBadge, iconHtml } from '../../ui/icons.js';

const SLOT_LABELS = { weapon: 'อาวุธ', armor: 'เสื้อเกราะ', charm: 'เครื่องราง' };
const BONUS_LABELS = { atk: 'โจมตี', def: 'ป้องกัน', hp: 'HP', crit: 'คริ' };

function itemTip(id) {
  const d = ITEMS[id];
  const bonus = d.bonus ? Object.entries(d.bonus).map(([k, v]) => `${STAT_LABELS[k] || BONUS_LABELS[k]} +${k === 'crit' ? `${v * 100}%` : v}`).join(' · ') : '';
  return `${d.name}${d.slot ? ` (${SLOT_LABELS[d.slot]})` : ''}\n${d.desc || bonus}\nราคาขาย ${Math.max(1, Math.floor(d.price / 2))} ทอง`;
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
      <div class="g-gold"></div><div class="g-grid"></div>
      <label class="g-sell"><input type="checkbox" /> โหมดขาย (คลิกไอเท็มเพื่อขาย)</label><p class="g-hint">คลิกเพื่อใช้หรือสวมใส่</p>`);
    for (const p of [this.sheet, this.bag]) { p.hidden = true; p.querySelector('.panel-heading button').addEventListener('click', () => { p.hidden = true; }); this.layer.append(p); }
    this.sellMode = this.bag.querySelector('.g-sell input');
    this.sellMode.addEventListener('change', () => this.bag.classList.toggle('selling', this.sellMode.checked));
    this.grid = this.bag.querySelector('.g-grid');
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
    c.on('levelup', lv => { this.feed.banner(`เลเวลอัป · Lv. ${lv}`, 'ได้รับแต้มสถานะ 3 แต้ม กด C เพื่ออัปสถานะ'); this.feed.log(`เลเวลอัปเป็น ${lv}!`, 'gold'); });
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
  }
  refreshSheet() {
    const c = this.c, s = c.stats;
    this.sheet.querySelector('.g-sheet-body').innerHTML = `
      <div class="g-sheet-head"><span class="g-portrait" style="--cls:${c.cls.color}">${classBadge(c.classId, c.cls, { size: 24 })}</span><div><b>${esc(c.name)}</b><small>${c.cls.name} · Lv. ${c.level}</small></div></div>
      <div class="g-equip">${Object.keys(SLOT_LABELS).map(slot => { const id = c.equipment[slot]; return `<button data-slot="${slot}" title="${id ? `${itemTip(id)}\nคลิกเพื่อถอด` : 'ว่าง'}" style="--rar:${id ? RARITY_COLORS[ITEMS[id].rarity] : '#555'}"><span>${id ? iconHtml(ITEMS[id]) : '·'}</span><small>${id ? ITEMS[id].name : SLOT_LABELS[slot]}</small></button>`; }).join('')}</div>
      <div class="g-stats-head"><span>สถานะ</span><span class="${c.points ? 'g-has-points' : ''}">แต้มคงเหลือ ${c.points}</span></div>
      ${STATS.map(k => `<div class="g-stat"><span>${STAT_LABELS[k]}</span><b>${s[k]}</b><button data-stat="${k}" ${c.points ? '' : 'disabled'} aria-label="เพิ่ม${STAT_LABELS[k]}">+</button></div>`).join('')}
      <div class="g-derived">
        <span>HP</span><b>${c.maxHp}</b><span>MP</span><b>${c.maxMp}</b>
        <span>โจมตี</span><b>${c.attack}</b><span>ป้องกัน</span><b>${c.defense}</b>
        <span>คริติคอล</span><b>${(c.critChance * 100).toFixed(1)}%</b><span>ระยะ</span><b>${c.cls.range}</b>
      </div>
      <button class="g-reset" ${Object.values(c.alloc).some(Boolean) ? '' : 'disabled'}>รีเซ็ตแต้มสถานะ</button>`;
  }
  refreshInventory() {
    this.grid.innerHTML = this.c.inventory.map((s, i) => {
      if (!s) return `<button class="g-slot empty" data-index="${i}" aria-label="ช่องว่าง"></button>`;
      const d = ITEMS[s.id];
      return `<button class="g-slot" data-index="${i}" title="${esc(itemTip(s.id))}" style="--rar:${RARITY_COLORS[d.rarity] || '#8d8a78'}"><span>${iconHtml(d)}</span>${s.qty > 1 ? `<small>${s.qty}</small>` : ''}</button>`;
    }).join('');
    this.refresh();
  }
  // Per frame: buff timers count down.
  update() { if (this.c.buffs.length) this.frame.querySelector('.g-buffs').innerHTML = this.buffsHtml(); }
}
