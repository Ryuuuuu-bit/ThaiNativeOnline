// Character interface: player frame, quick potions, character sheet and bag.
import { STATS, STAT_LABELS, STAT_HINTS, POINTS_PER_LEVEL } from '../data/classes.js';
import { ITEMS, RARITY_COLORS } from '../data/items.js';
import { el, esc, setBar } from './dom.js';
import './character.css';
import { draggable } from '../../ui/draggable.js';
import { classBadge, iconHtml } from '../../ui/icons.js';
import { BAG_TABS, inTab, compareToWorn, matchesSearch, sortBag, sortedInventory } from '../bag.js';
import { SkillPanel } from './SkillPanel.js';
import { RACE_LABELS, ELEMENT_LABELS } from '../data/cards.js';
import { refineBonus } from '../data/refine.js';
import { MAX_JOB_LEVEL } from '../data/progression.js';

const AUTO_SORT_KEY = 'thainative.bag.autoSort';
const pref = { get: k => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } } };

const SLOT_LABELS = { weapon: 'อาวุธ', offhand: 'มือรอง', armor: 'เสื้อเกราะ', head: 'ศีรษะ', cape: 'ผ้าคลุม', shoes: 'รองเท้า', charm: 'เครื่องราง', charm2: 'เครื่องราง 2' };
const BONUS_LABELS = { atk: 'ATK', matk: 'MATK', def: 'DEF', hp: 'HP', mp: 'MP', crit: 'คริ', critDmg: 'แรงคริ', acc: 'แม่นยำ', eva: 'หลบ', cdr: 'ลดคูลดาวน์', cast: 'ร่ายเร็ว', mpCost: 'MP ที่ใช้' };
const PERCENT_BONUS = new Set(['crit', 'critDmg', 'cdr', 'cast', 'mpCost']);
// card keys: vs_<race> (more damage against it), res_<race | element> (less damage from it)
const bonusLabel = (k, v) => {
  const [kind, what] = k.split('_');
  if (kind === 'vs') return `ตี${RACE_LABELS[what] ?? what} +${Math.round(v * 100)}%`;
  if (kind === 'res') return `รับดาเมจจาก${RACE_LABELS[what] ?? `ธาตุ${ELEMENT_LABELS[what] ?? what}`} −${Math.round(v * 100)}%`;
  return `${STAT_LABELS[k] ? k.toUpperCase() : BONUS_LABELS[k] ?? k} +${PERCENT_BONUS.has(k) ? `${Math.round(v * 100)}%` : v}`;
};
export const bonusText = b => (b ? Object.entries(b).map(([k, v]) => bonusLabel(k, v)).join(' · ') : '');

// "+4 ดาบเหล็กลาย [2]" — RO style, the plus from ตีบวก and the number of card slots
export const itemName = (id, plus = 0) => { const d = ITEMS[id]; return `${plus ? `+${plus} ` : ''}${d.type === 'equip' && d.slots ? `${d.name} [${d.slots}]` : d.name}`; };
const cardsLine = (id, cards = []) => {
  const n = ITEMS[id]?.slots ?? 0; if (ITEMS[id]?.type !== 'equip') return '';
  if (!n) return '\nไม่มีช่องการ์ด';
  return `\nช่องการ์ด: ${[...cards.map(c => `❖ ${ITEMS[c].name} (${bonusText(ITEMS[c].bonus)})`), ...Array(Math.max(0, n - cards.length)).fill('○ ว่าง')].join(' · ')}`;
};
function itemTip(id, cards = [], plus = 0) {
  const d = ITEMS[id];
  const where = d.type === 'card' ? ` (การ์ด${SLOT_LABELS[d.slot]})` : d.slot ? ` (${SLOT_LABELS[d.slot]})` : '';
  const refine = plus ? `\nตีบวก +${plus}: ${bonusText(refineBonus(d, plus))}` : '';
  return `${itemName(id, plus)}${where}\n${d.desc || bonusText(d.bonus)}${refine}${cardsLine(id, cards)}${d.type === 'card' ? `\nคลิกเพื่อใส่ใน${SLOT_LABELS[d.slot]}ที่มีช่องว่าง (ใส่แล้วถอดไม่ได้)` : ''}\nน้ำหนัก ${d.weight || 0} · ราคาขาย ${Math.max(1, Math.floor(d.price / 2))} ทอง`;
}
const pips = (id, cards = []) => { const n = ITEMS[id]?.slots ?? 0; return n ? `<i class="g-pips">${'◆'.repeat(cards.length)}${'◇'.repeat(Math.max(0, n - cards.length))}</i>` : ''; };

// The card under the bag grid for the item under the pointer: name (+refine [slots]), slot, rarity,
// bonuses, refine bonus, card slots, weight, price.
const RARITY_TH = { common: 'ธรรมดา', rare: 'หายาก', epic: 'ตำนาน' };
function itemCard({ id, cards = [], plus = 0 }, cmp) {
  const d = ITEMS[id];
  const bonus = d.bonus ? Object.entries(d.bonus).map(([k, v]) => `<i>${bonusLabel(k, v)}</i>`).join('') : '';
  const refine = plus ? `<i>ตีบวก +${plus}: ${bonusText(refineBonus(d, plus))}</i>` : '';
  const slots = cardsLine(id, cards).trim();
  const tag = [d.type === 'card' ? `การ์ด${SLOT_LABELS[d.slot]}` : d.slot && SLOT_LABELS[d.slot], RARITY_TH[d.rarity], `น้ำหนัก ${d.weight || 0}`].filter(Boolean).join(' · ');
  const note = cmp > 0 ? '<b class="up">▲ ดีกว่าที่ใส่อยู่</b>' : cmp < 0 ? '<b class="down">▼ แย่กว่าที่ใส่อยู่</b>' : `ขายได้ ${Math.max(1, Math.floor(d.price / 2))} ทอง`;
  const act = d.type === 'equip' ? 'คลิกเพื่อสวมใส่' : d.type === 'use' ? 'คลิกเพื่อใช้' : d.type === 'card' ? 'คลิกเพื่อใส่การ์ด (ถอดไม่ได้)' : 'ขายได้ที่ร้านค้า';
  return `<span class="g-detail-icon" style="--rar:${RARITY_COLORS[d.rarity] || '#8d8a78'}">${iconHtml(d)}</span><div><b style="color:${RARITY_COLORS[d.rarity] || 'inherit'}">${esc(itemName(id, plus))}</b><small>${tag}</small><span class="g-detail-bonus">${bonus + refine || esc(d.desc || '')}</span>${slots ? `<small>${esc(slots)}</small>` : ''}<small>${act} · ${note}</small></div>`;
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
        <div class="g-player-name"><b>${esc(c.name)}</b><span>${c.cls.name} · <i class="g-job-lv" title="Job Lv. (แต้มสกิล: กด K)"></i></span></div>
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
    this.trayExp = el('div', 'g-bar g-exp action-exp', '<span></span><em></em>'); this.trayExp.title = 'Base EXP';
    this.trayJexp = el('div', 'g-bar g-jexp action-jexp', '<span></span><em></em>');
    const exps = el('div', 'action-exps'); exps.append(this.trayExp, this.trayJexp);
    this.quickButtons = { potions: [this.potionHp, this.potionMp], menus: [], exp: exps };
  }
  buildPanels() {
    this.sheet = el('section', 'g-panel g-sheet glass', `<div class="panel-heading">ตัวละคร<button aria-label="ปิด">×</button></div><div class="g-sheet-body"></div>`);
    this.bag = el('section', 'g-panel g-bag glass', `<div class="panel-heading">กระเป๋า<button aria-label="ปิด">×</button></div>
<div class="g-bar g-weight" title="น้ำหนักสัมภาระ (STR เพิ่มความจุ)"><span></span><em></em></div>
      <div class="g-bag-tabs" role="tablist">${BAG_TABS.map((t, i) => `<button role="tab" data-tab="${t.id}" aria-selected="${i === 0}">${t.label}</button>`).join('')}</div>
      <div class="g-bag-tools"><input class="g-bag-search" type="search" placeholder="ค้นหา…" aria-label="ค้นหาไอเท็ม" /><button class="g-bag-sort" title="เรียงไอเท็มและรวมกองซ้ำ">เรียง</button><label class="g-bag-auto" title="เรียงให้เองทุกครั้งที่ได้ของ"><input type="checkbox" /> อัตโนมัติ</label></div>
      <div class="g-grid"></div><p class="g-bag-none" hidden>ไม่มีไอเท็มในหมวดนี้</p><div class="g-card-pick" hidden></div>
      <div class="g-bag-foot"><span class="g-bag-count"></span><span class="g-gold"></span></div>
      <div class="g-detail" hidden></div><p class="g-hint">คลิกเพื่อใช้หรือสวมใส่ · ขายของได้ที่ร้านค้า (แท็บขาย)</p>`);
    for (const p of [this.sheet, this.bag]) { p.hidden = true; p.querySelector('.panel-heading button').addEventListener('click', () => { p.hidden = true; }); this.layer.append(p); }
    draggable(this.sheet, { key: 'sheet', handle: '.panel-heading' }); draggable(this.bag, { key: 'bag', handle: '.panel-heading' });
    this.skills = new SkillPanel(this.layer, this.c, this.feed, name => { if (this[name].hidden) this.toggle(name); });
    this.grid = this.bag.querySelector('.g-grid'); this.detail = this.bag.querySelector('.g-detail');
    this.grid.addEventListener('pointerover', e => this.showDetail(e.target.closest('[data-index]')));
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
      if (ITEMS[item.id].type === 'card') this.openCardPick(i);
      else if (!this.c.useAt(i) && ITEMS[item.id].type === 'use') this.feed.log('HP เต็มอยู่แล้ว');
    });
    // which item a card goes into (the card stays there for good)
    this.cardPick = this.bag.querySelector('.g-card-pick');
    this.cardPick.addEventListener('click', e => {
      const b = e.target.closest('[data-where]'); if (!b) { if (e.target.closest('.g-pick-cancel')) this.cardPick.hidden = true; return; }
      const card = this.c.inventory[this.pickCard]?.id, where = b.dataset.where === 'worn' ? 'worn' : Number(b.dataset.where);
      this.cardPick.hidden = true;
      if (card && this.c.insertCard(this.pickCard, where)) this.feed.log(`ใส่${ITEMS[card].name}แล้ว`, 'epic');
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
    c.on('card-choose', i => this.openCardPick(i));
    c.on('two-hand', what => this.feed.log(what === 'offhand' ? 'ถืออาวุธสองมืออยู่ ใส่ของมือรองไม่ได้' : 'อาวุธสองมือ: เก็บของมือรองเข้ากระเป๋าแล้ว', what === 'offhand' ? 'bad' : ''));
    c.on('card-no-slot', slot => this.feed.log(`ไม่มี${SLOT_LABELS[slot]}ที่มีช่องการ์ดว่าง`, 'bad'));
    c.on('damaged', () => { this.frame.classList.remove('g-shake'); void this.frame.offsetWidth; this.frame.classList.add('g-shake'); });
  }

  // Returns true when the key was handled.
  handleKey(e) {
    const k = e.code;
    if (k === 'KeyQ') { this.quickPotion('hp'); return true; }
    if (k === 'KeyF') { this.quickPotion('mp'); return true; }
    if (k === 'KeyC') { this.toggle('sheet'); return true; }
    if (k === 'KeyI' || k === 'KeyB') { this.toggle('bag'); return true; }
    if (k === 'KeyK') { this.toggle('skills'); return true; }
    if (k === 'Escape' && (!this.sheet.hidden || !this.bag.hidden || !this.skills.hidden)) { this.sheet.hidden = true; this.bag.hidden = true; this.skills.root.hidden = true; return true; }
    return false;
  }
  quickPotion(kind) { if (!this.c.quickUse(kind)) this.feed.log(kind === 'hp' ? 'ไม่มียาฟื้น HP หรือ HP เต็มแล้ว' : 'ไม่มีน้ำผึ้งป่า', 'bad', true); }
  toggle(name) {
    if (name === 'skills') { this.skills.toggle(); return; }
    const p = this[name]; p.hidden = !p.hidden;
    if (!p.hidden) { if (name === 'sheet') this.refreshSheet(); else this.refreshInventory(); }
  }

  buffsHtml() { return this.c.buffs.map(b => `<i title="${b.id}">${iconHtml(this.buffIcons[b.id] ?? { icon: '✧' })}<b>${Math.ceil(b.remaining)}</b></i>`).join(''); }
  refresh() {
    const c = this.c;
    this.frame.querySelector('.g-lv').textContent = c.level;
    this.frame.querySelector('.g-job-lv').textContent = `Job ${c.jobLevel}`;
    this.frame.classList.toggle('g-sp', c.skillPoints > 0);
    setBar(this.frame.querySelector('.g-hp'), c.hp, c.maxHp);
    setBar(this.frame.querySelector('.g-mp'), c.mp, c.maxMp);
    setBar(this.frame.querySelector('.g-exp'), c.exp, c.expNeeded, `EXP ${(c.exp / c.expNeeded * 100).toFixed(1)}%`);
    setBar(this.trayExp, c.exp, c.expNeeded, `Base Lv ${c.level} · EXP ${(c.exp / c.expNeeded * 100).toFixed(1)}%`);
    const jobMax = c.jobLevel >= MAX_JOB_LEVEL;
    setBar(this.trayJexp, jobMax ? 1 : c.jobExp, jobMax ? 1 : c.jobExpNeeded, jobMax ? `Job Lv ${c.jobLevel} · สูงสุด` : `Job Lv ${c.jobLevel} · ${(c.jobExp / c.jobExpNeeded * 100).toFixed(1)}%`);
    this.trayJexp.title = this.trayJexp.querySelector('em').textContent;
    this.frame.querySelector('.g-portrait').style.setProperty('--hp', Math.max(0, Math.min(100, c.hp / c.maxHp * 100)).toFixed(1));
    this.frame.classList.toggle('g-low', c.hp / c.maxHp < .3);
    this.frame.querySelector('.g-buffs').innerHTML = this.buffsHtml();
    this.frame.querySelector('.g-portrait').classList.toggle('g-points', c.points > 0);
    this.potionHp.querySelector('small').textContent = c.count('potion_s') + c.count('potion_m');
    this.potionMp.querySelector('small').textContent = c.count('ether');
    if (!this.sheet.hidden) this.refreshSheet();
    this.bag.querySelector('.g-gold').textContent = `◉ ${c.gold.toLocaleString()}`;
    const w = c.weight, max = c.maxWeight, heavy = c.heavy, bar = this.bag.querySelector('.g-weight');
    setBar(bar, w, max, `น้ำหนัก ${w.toLocaleString()} / ${max.toLocaleString()}${heavy ? ' · หนัก: HP/MP ไม่ฟื้นเอง' : ''}`);
    bar.classList.toggle('heavy', heavy);
    if (this.wasHeavy !== undefined && heavy !== this.wasHeavy) this.feed.log(heavy ? 'สัมภาระหนัก HP/MP จะไม่ฟื้นเอง' : 'สัมภาระเบาลงแล้ว', heavy ? 'bad' : '');
    this.wasHeavy = heavy;
  }
  // Rebuilt only when something it shows changed: 'change' fires for every HP tick in a fight, and
  // a sheet rebuilt between pointerdown and click eats the click on a + button.
  refreshSheet() {
    const c = this.c, s = c.stats;
    const key = JSON.stringify([c.level, c.exp, c.jobLevel, c.jobExp, c.points, c.alloc, c.equipment, c.cards, c.refine, c.buffs.map(b => b.id), c.maxHp, c.maxMp, c.patk, c.matk, c.defense]);
    if (key === this.sheetKey) return;
    this.sheetKey = key;
    // paper doll: worn gear in two columns around the portrait (design "UI ใหม่")
    const slotHtml = slot => { const id = c.equipment[slot]; return `<div class="g-eqs"><button data-slot="${slot}" class="${id ? '' : 'empty'}" title="${id ? `${itemTip(id, c.cards[slot], c.refine[slot])}\nคลิกเพื่อถอด` : slot === 'offhand' && c.twoHanded ? 'ว่าง · ถืออาวุธสองมืออยู่' : `${SLOT_LABELS[slot]} · ว่าง`}" style="--rar:${id ? RARITY_COLORS[ITEMS[id].rarity] : '#555'}"><span>${id ? iconHtml(ITEMS[id]) : '·'}</span>${id && c.refine[slot] ? `<i class="g-plus">+${c.refine[slot]}</i>` : ''}${id ? pips(id, c.cards[slot]) : ''}</button><small>${id ? esc(itemName(id, c.refine[slot])) : SLOT_LABELS[slot]}</small></div>`; };
    const jobMax = c.jobLevel >= MAX_JOB_LEVEL;
    this.sheet.querySelector('.g-sheet-body').innerHTML = `
      <div class="g-doll-wrap g-equip">
        <div class="g-eq-col">${['weapon', 'head', 'armor', 'cape'].map(slotHtml).join('')}</div>
        <div class="g-doll"><span class="g-portrait" style="--cls:${c.cls.color}">${classBadge(c.classId, c.cls, { size: 60 })}</span><div class="g-doll-nm"><b>${esc(c.name)}</b><span>${c.cls.name} · Lv ${c.level} · Job ${c.jobLevel}</span></div></div>
        <div class="g-eq-col">${['offhand', 'shoes', 'charm', 'charm2'].map(slotHtml).join('')}</div>
      </div>
      <div class="g-bar g-exp g-sheet-exp"><span style="width:${Math.min(100, c.exp / c.expNeeded * 100)}%"></span><em>Base Lv ${c.level} · EXP ${(c.exp / c.expNeeded * 100).toFixed(1)}%</em></div>
      <div class="g-bar g-jexp g-sheet-exp"><span style="width:${jobMax ? 100 : Math.min(100, c.jobExp / c.jobExpNeeded * 100)}%"></span><em>Job Lv ${c.jobLevel}${jobMax ? ' · สูงสุด' : ` · ${(c.jobExp / c.jobExpNeeded * 100).toFixed(1)}%`}</em></div>
      <div class="g-statbox g-parch">
      <div class="g-stats-head"><span>สถานะ</span><span class="${c.points ? 'g-has-points' : ''}">แต้มคงเหลือ ${c.points}</span></div>
      <div class="g-stat-grid">${STATS.map(k => { const p = c.statParts(k); return `<div class="g-stat" title="${STAT_HINTS[k]}\nพื้นฐาน ${p.base} (1 + แต้มที่ลง ${p.base - 1}) · โบนัสอาชีพ/เลเวล ${p.cls >= 0 ? '+' : ''}${p.cls}${p.gear ? ` · อุปกรณ์ ${p.gear > 0 ? '+' : ''}${p.gear}` : ''} = ${s[k]}"><span>${k.toUpperCase()} <small>${STAT_LABELS[k]}</small></span><b>${p.base}${p.bonus ? `<i class="g-bonus">${p.bonus > 0 ? '+' : ''}${p.bonus}</i>` : ''}</b><button data-stat="${k}" ${c.points ? '' : 'disabled'} aria-label="เพิ่ม${STAT_LABELS[k]}">+</button></div>`; }).join('')}</div>
      <div class="g-derived">
        <span>HP</span><b>${c.maxHp}</b><span>MP</span><b>${c.maxMp}</b>
        <span title="พลังโจมตีกายภาพ (STR, ธนูใช้ DEX)">ATK</span><b>${c.patk}</b><span title="พลังเวท/ยา (INT)">MATK</span><b>${c.matk}</b>
        <span title="ลดความเสียหายกายภาพ (VIT)">DEF</span><b>${c.defense}</b><span title="หลบหลีก (AGI, LUK)">หลบ</span><b>${c.evasion}</b>
        <span title="ความแม่นยำ (DEX, LUK)">แม่นยำ</span><b>${c.accuracy}</b><span title="โอกาสคริติคอล (LUK)">คริ</span><b>${(c.critChance * 100).toFixed(1)}%</b>
        <span title="ตัวคูณความแรงคริ (LUK)">แรงคริ</span><b>×${c.critDamage.toFixed(2)}</b><span title="ลดเวลาระหว่างการตีปกติ (AGI)">ความเร็วตี</span><b>+${Math.round(c.attackSpeed * 100)}%</b>
        <span title="ลดคูลดาวน์สกิล (DEX + อุปกรณ์ · สูงสุด 30%)">ลดคูลดาวน์</span><b>${Math.round(c.cooldownCut * 100)}%</b><span title="ลดเวลาร่ายสกิล (DEX + อุปกรณ์ · สูงสุด 50%)">ร่ายเร็ว</span><b>${Math.round(c.castSpeed * 100)}%</b><span title="น้ำหนักที่แบก (STR เพิ่มความจุ)">น้ำหนัก</span><b class="${c.heavy ? 'g-heavy' : ''}">${c.weight}/${c.maxWeight}</b>
      </div>
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
      return `<button class="g-slot rar-${d.rarity || 'none'}" data-index="${i}" aria-label="${esc(itemName(s.id, s.plus))}" style="--rar:${RARITY_COLORS[d.rarity] || '#8d8a78'}"><span>${iconHtml(d)}</span>${arrow}${s.plus ? `<i class="g-plus">+${s.plus}</i>` : ''}${pips(s.id, s.cards)}${s.qty > 1 ? `<small>${s.qty}</small>` : ''}</button>`;
    }).join('');
    this.bag.querySelector('.g-bag-none').hidden = !filtered || shown > 0;
    this.bag.querySelector('.g-bag-count').textContent = `ช่อง ${inv.filter(Boolean).length} / ${inv.length}`;
    this.refresh();
  }
  // The card picker: gear of the card's kind with a free slot (worn first).
  openCardPick(i) {
    const card = ITEMS[this.c.inventory[i]?.id]; if (!card) return;
    if (this.bag.hidden) this.toggle('bag');
    const targets = this.c.cardTargets(i); this.pickCard = i;
    this.cardPick.innerHTML = `<header>ใส่${esc(card.name)}<small>${bonusText(card.bonus)}</small></header>`
      + (targets.length ? targets.map(t => `<button data-where="${t.worn ? 'worn' : t.index}"><span>${iconHtml(ITEMS[t.id])}</span><b>${esc(itemName(t.id, t.worn ? this.c.refine[t.slot] : this.c.inventory[t.index]?.plus))}${t.worn ? ` · สวมอยู่ (${SLOT_LABELS[t.slot]})` : ''}</b>${pips(t.id, t.cards)}</button>`).join('')
        : `<p>ไม่มี${SLOT_LABELS[card.slot]}ที่มีช่องการ์ดว่าง</p>`)
      + '<p class="g-pick-warn">ใส่แล้วการ์ดติดกับไอเท็มนั้นถาวร ถอดออกไม่ได้</p><button class="g-pick-cancel">ยกเลิก</button>';
    this.cardPick.hidden = false;
  }
  showDetail(slot) {
    const item = slot && this.c.inventory[Number(slot.dataset.index)];
    if (!item) return;
    this.detail.innerHTML = itemCard(item, compareToWorn(this.c, item.id));
    this.detail.hidden = false;
  }
  // Per frame: buff timers count down.
  update() { if (this.c.buffs.length) this.frame.querySelector('.g-buffs').innerHTML = this.buffsHtml(); }
}
