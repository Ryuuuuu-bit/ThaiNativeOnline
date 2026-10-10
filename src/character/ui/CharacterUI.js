// Character interface: player frame, quick potions, character sheet and bag.
import { STATS, STAT_LABELS, STAT_HINTS, POINTS_PER_LEVEL, WEAPON_KINDS, WEAPON_KIND_TH, CLASSES } from '../data/classes.js';
import { STAT_GUIDE, spreadPoints } from '../data/statguide.js';
import { ITEMS, RARITY_COLORS } from '../data/items.js';
import { el, esc, setBar } from './dom.js';
import './character.css';
import { draggable } from '../../ui/draggable.js';
import { classBadge, iconHtml } from '../../ui/icons.js';
import { BAG_TABS, inTab, matchesSearch, sortBag, sortedInventory } from '../bag.js';
import { SkillPanel } from './SkillPanel.js';
import { RACE_LABELS, ELEMENT_LABELS } from '../data/cards.js';
import { refineBonus } from '../data/refine.js';
import { MAX_JOB_LEVEL } from '../data/progression.js';
import { LOADOUT_COUNT, isItemLocked } from '../itemState.js';
import { SKILLS as LEGACY_SKILLS } from '../../combat/data/skills.js';
import { bindAccountPortrait } from '../../account/AccountPortrait.js';
import { onIdentity } from '../../account/identity.js';
import { uidRow } from '../../account/UidRow.js';
import { InventoryWorkspace, compareToEquipped } from './InventoryWorkspace.js';
import { FlaskEquipment } from './FlaskEquipment.js';
import { dragBinding } from './HotbarEditor.js';
import { affixLines } from '../data/affixes.js';
import { instanceName, instanceColor, instanceQuality } from '../itemPresentation.js';

const AUTO_SORT_KEY = 'thainative.bag.autoSort';
const pref = { get: k => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } } };

const SLOT_LABELS = { weapon: 'อาวุธ', armor: 'เสื้อเกราะ', head: 'ศีรษะ', cape: 'ผ้าคลุม', shoes: 'รองเท้า', gloves: 'ถุงมือ', belt: 'เข็มขัด', amulet: 'สร้อย', charm: 'แหวน / เครื่องราง 1', charm2: 'แหวน / เครื่องราง 2' };
const DOLL_LABELS = { charm: 'แหวน 1', charm2: 'แหวน 2' };
const BONUS_LABELS = { atk: 'ATK', matk: 'MATK', def: 'DEF', hp: 'HP', mp: 'MP', crit: 'คริ', critDmg: 'แรงคริ', acc: 'แม่นยำ', eva: 'หลบ', cdr: 'ลดคูลดาวน์', cast: 'ร่ายเร็ว', mpCost: 'MP ที่ใช้' };
const PERCENT_BONUS = new Set(['crit', 'critDmg', 'cdr', 'cast', 'mpCost']);
// card keys: vs_<race> (more damage against it), res_<race | element> (less damage from it)
const bonusLabel = (k, v) => {
  const [kind, what] = k.split('_');
  if (kind === 'vs') return `ตี${RACE_LABELS[what] ?? what} +${Math.round(v * 100)}%`;
  if (kind === 'res') return `รับดาเมจจาก${RACE_LABELS[what] ?? `ธาตุ${ELEMENT_LABELS[what] ?? what}`} −${Math.round(v * 100)}%`;
  return `${STAT_LABELS[k] ? k.toUpperCase() : BONUS_LABELS[k] ?? k} +${PERCENT_BONUS.has(k) ? `${+(v * 100).toFixed(2)}%` : v}`;
};
export const bonusText = b => (b ? Object.entries(b).map(([k, v]) => bonusLabel(k, v)).join(' · ') : '');

// "+4 ดาบเหล็กลาย [2]" — RO style, the plus from ตีบวก and the number of card slots
export const itemName = (id, plus = 0, roll = null) => instanceName({ id, plus, roll });
const cardsLine = (id, cards = []) => {
  const n = ITEMS[id]?.slots ?? 0; if (ITEMS[id]?.type !== 'equip') return '';
  if (!n) return '\nไม่มีช่องการ์ด';
  return `\nช่องการ์ด: ${[...cards.map(c => `❖ ${ITEMS[c].name} (${bonusText(ITEMS[c].bonus)})`), ...Array(Math.max(0, n - cards.length)).fill('○ ว่าง')].join(' · ')}`;
};
const pips = (id, cards = []) => {
  const n = ITEMS[id]?.slots ?? 0, used = Math.min(n, cards.length);
  return n ? `<i class="g-pips g-card-slots${used ? ' has-cards' : ''}" role="img" aria-label="ช่องการ์ด ใส่แล้ว ${used} จาก ${n} ช่อง" title="ช่องการ์ด: ใส่แล้ว ${used}/${n}"><span aria-hidden="true">${used ? '◆' : '◇'}</span><b aria-hidden="true">${used}/${n}</b></i>` : '';
};

// Shared selected-item and hover detail: name (+refine [slots]), slot, rarity,
// bonuses, refine bonus, card slots, weight, price.
const RARITY_TH = { common: 'ธรรมดา', rare: 'หายาก', epic: 'ตำนาน' };
function itemCard({ id, cards = [], plus = 0, locked = false, roll = null, flask = null }, cmp) {
  const d = ITEMS[id];
  const item = { id, cards, plus, roll }, color = instanceColor(item);
  const bonus = d.bonus ? Object.entries(d.bonus).map(([k, v]) => `<i>${esc(bonusLabel(k, v))}</i>`).join('') : '';
  const refine = plus ? `<i class="iw-refine-bonus">${esc(`ตีบวก +${plus}: ${bonusText(refineBonus(d, plus))}`)}</i>` : '';
  const wield = d.weapon ? `${WEAPON_KIND_TH[d.weapon] ?? d.weapon} · ${Object.keys(WEAPON_KINDS).filter(c => WEAPON_KINDS[c].includes(d.weapon)).map(c => CLASSES[c]?.name).join(', ')}` : '';
  const slots = cardsLine(id, cards).trim();
  const tag = [d.type === 'card' ? `การ์ด${SLOT_LABELS[d.slot]}` : d.slot && SLOT_LABELS[d.slot], RARITY_TH[d.rarity], d.minLevel ? `ต้องการ Lv.${d.minLevel}` : '', `น้ำหนัก ${d.weight || 0}`].filter(Boolean).join(' · ');
  const rolled = affixLines(id, roll).map(a => `<i class="iw-affix" title="${esc(`ช่วงค่าสุ่ม ${a.min}–${a.max}`)}">${esc(`${a.kind === 'prefix' ? 'นำหน้า' : 'ต่อท้าย'} · ${a.label} T${a.tier}: ${bonusLabel(a.key, a.value)}`)}</i>`).join('');
  const note = cmp > 0 ? '<b class="up">▲ ดีกว่าที่ใส่อยู่</b>' : cmp < 0 ? '<b class="down">▼ แย่กว่าที่ใส่อยู่</b>' : `ขายได้ ${Math.max(1, Math.floor(d.price / 2))} ตำลึง`;
  const act = d.type === 'equip' ? 'อุปกรณ์สวมใส่' : d.type === 'use' ? 'ไอเท็มใช้ได้' : d.type === 'card' ? 'ใส่การ์ดด้วยปุ่มด้านล่าง (ติดถาวร)' : 'ขายได้ที่ร้านค้า';
  return `<span class="g-detail-icon" style="--rar:${color}">${iconHtml(d)}</span><div><b class="iw-item-name" style="--rar:${color}">${esc(itemName(id, plus, roll))}</b><small>${esc(tag)}${locked ? ' · 🔒 ล็อกแล้ว' : ''}</small>${instanceQuality(item) ? `<small class="iw-roll-quality">${esc(instanceQuality(item))}</small>` : ''}${wield ? `<small>${esc(wield)}</small>` : ''}<span class="g-detail-bonus">${bonus + refine || esc(d.desc || '')}</span>${flask && d.flask ? `<small>ขั้น ${d.flask.tier} · ฟื้น ${d.flask.kind.toUpperCase()} ${d.flask.recovery} · ประจุ ${flask.charges}/${d.flask.maxCharges} · ใช้ ${d.flask.cost} ต่อครั้ง</small>` : ''}${rolled ? `<span class="g-detail-bonus iw-affix-list">${rolled}</span>` : ''}${slots ? `<small>${esc(slots)}</small>` : ''}<small>${act} · ${note}</small></div>`;
}

export class CharacterUI {
  get loadoutsOpen() { return !this.loadouts.hidden; }
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
    this.flaskPicker = new FlaskEquipment(this);
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
    this.stopAccountPortrait = bindAccountPortrait(this.frame.querySelector('.g-portrait'));
  }
  // Potion and menu buttons; the combat HUD places them on its action bar.
  buildQuickButtons() {
    this.potionHp = el('button', 'g-skill g-potion', `<span class="g-skill-icon">${iconHtml(ITEMS.potion_s)}</span><kbd>Q</kbd><small></small>`);
    this.potionHp.title = 'ดื่มยาฟื้น HP'; this.potionHp.addEventListener('click', () => this.quickPotion('hp'));
    this.potionMp = el('button', 'g-skill g-potion mp', `<span class="g-skill-icon">${iconHtml(ITEMS.ether)}</span><kbd>E</kbd><small></small>`);
    this.potionMp.title = 'ใช้ขวดฟื้น MP · E'; this.potionMp.addEventListener('click', () => this.quickPotion('mp'));
    for (const [kind,b] of [['hp',this.potionHp],['mp',this.potionMp]]) { b.type='button'; b.append(el('span','flask-charge-bar')); b.addEventListener('contextmenu', e => { e.preventDefault(); this.flaskPicker.open(kind); }); }
    this.trayExp = el('div', 'g-bar g-exp action-exp', '<span></span><em></em>'); this.trayExp.title = 'Base EXP';
    this.trayJexp = el('div', 'g-bar g-jexp action-jexp', '<span></span><em></em>');
    const exps = el('div', 'action-exps'); exps.append(this.trayExp, this.trayJexp);
    this.quickButtons = { potions: [this.potionHp, this.potionMp], menus: [], exp: exps };
  }
  buildPanels() {
    this.sheet = el('section', 'g-panel g-sheet glass', `<div class="panel-heading">ตัวละคร<button aria-label="ปิด">×</button></div><div class="g-sheet-body"></div>`);
    const identity = el('div', 'g-character-uid'); this.sheet.querySelector('.panel-heading').after(identity);
    onIdentity(value => identity.replaceChildren(uidRow('Character UID', value.characterUid, 'CHR')));
    this.bag = el('section', 'g-panel g-bag glass', `<div class="panel-heading">กระเป๋า<button aria-label="ปิด">×</button></div>
<div class="g-bar g-weight" title="น้ำหนักสัมภาระ (STR เพิ่มความจุ)"><span></span><em></em></div>
      <div class="g-bag-tabs" role="tablist">${BAG_TABS.map((t, i) => `<button role="tab" data-tab="${t.id}" aria-selected="${i === 0}">${t.label}</button>`).join('')}</div>
      <div class="g-bag-tools"><input class="g-bag-search" type="search" placeholder="ค้นหา…" aria-label="ค้นหาไอเท็ม" /><button class="g-bag-sort" title="เรียงไอเท็มและรวมกองซ้ำ">เรียง</button><button type="button" class="g-bag-lock" aria-pressed="false" title="โหมดล็อก: แตะไอเท็มเพื่อป้องกันขาย ตีบวก ใส่/ถอดการ์ด และแลก">🔒 ล็อก</button><label class="g-bag-auto" title="เรียงให้เองทุกครั้งที่ได้ของ"><input type="checkbox" /> อัตโนมัติ</label></div>
      <div class="g-grid"></div><p class="g-bag-none" hidden>ไม่มีไอเท็มในหมวดนี้</p><div class="g-card-pick" hidden></div>
      <div class="g-bag-foot"><span class="g-bag-count"></span><span class="g-gold" title="ตำลึงในกระเป๋า"></span></div>
      <div class="g-detail" hidden></div><p class="g-hint">เลือกเพื่อดูรายละเอียด · กดปุ่มเพื่อใช้หรือสวมใส่ · ขายได้ที่ร้านค้า</p>`);
    this.loadouts = el('section', 'g-panel g-loadouts glass', '<div class="panel-heading">ชุดอุปกรณ์และแถบสกิล<button aria-label="ปิด">×</button></div><div class="g-loadout-body"></div>');
    for (const p of [this.sheet, this.bag, this.loadouts]) { p.hidden = true; p.querySelector('.panel-heading button').addEventListener('click', () => { if (p === this.loadouts) p.hidden = true; else this.workspace.close(); }); this.layer.append(p); }
    // Utility windows sit above the main-menu button, outside the HUD's stacking context.
    this.layer.parentElement?.append(this.loadouts);
    draggable(this.loadouts, { key: 'loadouts', handle: '.panel-heading' });
    this.loadouts.addEventListener('keydown', e => { if (e.target.matches('input')) e.stopPropagation(); });
    this.loadouts.addEventListener('change', e => {
      if (e.target.dataset.loadoutName === undefined) return;
      const index = Number(e.target.dataset.loadoutName);
      this.loadoutNames ??= {}; this.loadoutNames[index] = e.target.value;
      if (this.c.loadouts[index]) { this.c.renameLoadout(index, e.target.value); this.c.save(); }
    });
    this.loadouts.addEventListener('click', e => {
      const b = e.target.closest('[data-loadout-save],[data-loadout-apply],[data-skill-move]'); if (!b) return;
      if (b.dataset.loadoutSave !== undefined) {
        const index = Number(b.dataset.loadoutSave), name = this.loadouts.querySelector(`[data-loadout-name="${index}"]`).value;
        if (this.c.saveLoadout(index, name)) { this.c.save(); this.feed.log(`บันทึก ${this.c.loadouts[index].name} แล้ว`, 'gold'); }
      } else if (b.dataset.loadoutApply !== undefined) {
        const index = Number(b.dataset.loadoutApply), result = this.c.applyLoadout(index);
        if (!result.pending) this.reportLoadout(result.ok ? { ...result, index } : result);
      } else {
        const order = [...this.c.hotbarSkills], index = Number(b.dataset.skillMove), to = index + Number(b.dataset.direction);
        if (to >= 0 && to < order.length) { [order[index], order[to]] = [order[to], order[index]]; if (this.c.setHotbar(order)) this.c.save(); }
      }
      this.loadoutsKey = null; this.refreshLoadouts();
    });
    this.skills = new SkillPanel(this.layer, this.c, this.feed, name => { if (this[name].hidden) this.toggle(name); });
    this.grid = this.bag.querySelector('.g-grid'); this.detail = this.bag.querySelector('.g-detail');
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
    this.bag.querySelector('.g-bag-lock').addEventListener('click', e => {
      this.lockMode = !this.lockMode; e.currentTarget.setAttribute('aria-pressed', String(this.lockMode));
      this.bag.classList.toggle('locking', this.lockMode);
      this.bag.querySelector('.g-hint').textContent = this.lockMode ? 'แตะไอเท็มเพื่อล็อก / ปลดล็อก · ของที่ล็อกยังสวมใส่ได้' : 'เลือกเพื่อดูรายละเอียด · กดปุ่มเพื่อใช้หรือสวมใส่ · ขายได้ที่ร้านค้า';
    });
    this.autoSort = this.bag.querySelector('.g-bag-auto input');
    this.autoSort.checked = pref.get(AUTO_SORT_KEY) === '1';
    this.autoSort.addEventListener('change', () => { pref.set(AUTO_SORT_KEY, this.autoSort.checked ? '1' : '0'); if (this.autoSort.checked) sortBag(this.c); });
    this.grid.addEventListener('click', e => {
      const slot = e.target.closest('[data-index]'); if (!slot) return;
      const i = Number(slot.dataset.index), item = this.c.inventory[i]; if (!item) return;
      if (this.lockMode) { this.c.setItemLock(i, !isItemLocked(item)); this.c.save(); return; }
      this.workspace.select(i);
    });
    // which item a card goes into (the card stays there for good)
    this.cardPick = this.bag.querySelector('.g-card-pick');
    this.cardPick.addEventListener('click', e => {
      if (e.target.closest('.g-pick-cancel')) { this.cardPick.hidden = true; return; }
      const b = e.target.closest('[data-where]');
      if (b) {
        this.pickWhere = b.dataset.worn === 'true' ? b.dataset.where : Number(b.dataset.where);
        const target = this.c.cardTargets(this.pickCard).find(t => t.worn ? t.slot === this.pickWhere : t.index === this.pickWhere);
        if (!target) return;
        this.pickTarget = JSON.stringify(target.worn ? this.c.wornItem(target.slot) : this.c.inventory[target.index]);
        this.cardPick.querySelectorAll('[data-where]').forEach(t => t.setAttribute('aria-pressed', String(t === b)));
        this.cardPick.querySelector('.g-pick-confirm').disabled = false;
        this.cardPick.querySelector('.iw-socket-target').textContent = `ยืนยันใส่การ์ดใน ${instanceName(target.worn ? this.c.wornItem(target.slot) : this.c.inventory[target.index])}${target.worn ? ` (${SLOT_LABELS[target.slot]})` : ''}`;
        return;
      }
      if (!e.target.closest('.g-pick-confirm') || this.pickWhere === undefined) return;
      const cardItem = this.c.inventory[this.pickCard];
      const targetItem = typeof this.pickWhere === 'string' ? this.c.wornItem(this.pickWhere) : this.c.inventory[this.pickWhere];
      if (JSON.stringify(cardItem) !== this.pickFingerprint || JSON.stringify(targetItem) !== this.pickTarget) { this.cardPick.hidden = true; return; }
      const card = cardItem?.id, index = this.pickCard, where = this.pickWhere;
      this.cardPick.hidden = true; this.workspace.clear();
      if (card && this.c.insertCard(index, where)) this.feed.log(`ใส่${ITEMS[card].name}แล้ว`, 'epic');
    });
    this.sheet.addEventListener('click', e => {
      const lock = e.target.closest('[data-lock-slot]');
      if (lock) { const slot = lock.dataset.lockSlot; this.c.setItemLock(slot, !this.c.isLocked(slot)); this.c.save(); return; }
      const add = e.target.closest('[data-stat]'); if (add) this.c.allocate(add.dataset.stat);
      // the stat guide (คู่มือลงแต้ม): open/close, and "ลงตามแผน" spends the points left by a build's ratio
      const gb = e.target.closest('.g-guide-btn'); if (gb) { this.guideOpen = !this.guideOpen; this.sheetKey = null; this.refreshSheet(); }
      const plan = e.target.closest('[data-plan]');
      if (plan) {
        const build = STAT_GUIDE.classes[this.c.classId]?.builds[Number(plan.dataset.plan)]; if (!build || !this.c.points) return;
        const add = spreadPoints(this.c.stats, this.c.points, build.plan);
        for (const [k, n] of Object.entries(add)) for (let i = 0; i < n; i++) this.c.allocate(k);
        this.feed.log(`ลงแต้มตามแผน ${build.name}: ${Object.entries(add).map(([k, n]) => `${k.toUpperCase()} +${n}`).join(' · ')}`);
      }
      const flask = e.target.closest('[data-flask-kind]'); if (flask) { this.flaskPicker.open(flask.dataset.flaskKind); return; }
      const slot = e.target.closest('[data-slot]'); if (slot) this.workspace.select(null, slot.dataset.slot);
      if (e.target.closest('.g-reset')) this.c.resetStats();
    });
    this.grid.addEventListener('dragstart', e => { const button=e.target.closest('[data-index]'), item=this.c.inventory[+button?.dataset.index]; if (ITEMS[item?.id]?.type === 'use') dragBinding(e,{kind:'item',id:item.id}); else e.preventDefault(); });
    this.workspace = new InventoryWorkspace(this, itemCard, SLOT_LABELS);
  }

  bind() {
    const c = this.c;
    c.on('change', () => this.refresh());
    c.on('inventory', () => { this.cardPick.hidden = true; this.refreshInventory(); });
    c.on('loadout-result', r => this.reportLoadout(r));
    c.on('inventory-full', id => this.feed.log(`กระเป๋าเต็ม ทิ้ง ${ITEMS[id].name}`, 'bad'));
    c.on('cannot-wield', id => this.feed.log(`${c.cls.name}ใช้${ITEMS[id].name}ไม่ได้ · ใช้ได้เฉพาะ${c.weaponKindsTh}`, 'bad'));
    c.on('overweight', id => this.feed.log(`หนักเกินไป ถือ ${ITEMS[id].name} ไม่ไหว`, 'bad'));
    c.on('levelup', lv => { this.feed.banner(`เลเวลอัป · Lv. ${lv}`, `ได้รับแต้มสถานะ ${POINTS_PER_LEVEL} แต้ม กด C เพื่ออัปสถานะ`); this.feed.log(`เลเวลอัปเป็น ${lv}!`, 'gold'); });
    c.on('used', id => this.feed.log(`ใช้ ${ITEMS[id].name}`));
    c.on('card-choose', i => this.openCardPick(i));
    c.on('card-no-slot', slot => this.feed.log(`ไม่มี${SLOT_LABELS[slot]}ที่มีช่องการ์ดว่าง`, 'bad'));
    c.on('damaged', () => { this.frame.classList.remove('g-shake'); void this.frame.offsetWidth; this.frame.classList.add('g-shake'); });
  }

  // Returns true when the key was handled.
  handleKey(e) {
    if (this.flasksOpen) { if (e.code === 'Escape') this.flaskPicker.close(); return true; }
    const k = e.code;
    if (k === 'KeyQ') { this.quickPotion('hp'); return true; }
    if (k === 'KeyE') { this.quickPotion('mp'); return true; }
    if (k === 'KeyC') { this.toggle('sheet'); return true; }
    if (k === 'KeyI') { this.toggle('bag'); return true; }
    if (k === 'KeyK') { this.toggle('skills'); return true; }
    if (k === 'Escape' && (!this.sheet.hidden || !this.bag.hidden || !this.skills.hidden || !this.loadouts.hidden)) { this.workspace.close(); this.skills.root.hidden = true; this.loadouts.hidden = true; return true; }
    return false;
  }
  get flasksOpen() { return !this.flaskPicker.root.hidden; }
  quickPotion(kind) { if (!this.c.useFlask(kind)) this.feed.log('ขวดยายังไม่พร้อม: ตรวจประจุ คูลดาวน์ หรือ HP / MP เต็มแล้ว', 'bad', true); }
  toggle(name) {
    if (name === 'sheet' || name === 'bag') { this.workspace.toggle(name); return; }
    if (name === 'skills') { this.skills.toggle(); return; }
    const p = this[name]; p.hidden = !p.hidden;
    if (!p.hidden) { if (name === 'sheet') this.refreshSheet(); else if (name === 'loadouts') this.refreshLoadouts(); else this.refreshInventory(); }
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
    this.refreshFlasks();
    if (!this.sheet.hidden) this.refreshSheet();
    if (!this.loadouts.hidden) this.refreshLoadouts();
    this.bag.querySelector('.g-gold').textContent = `◉ ${c.gold.toLocaleString()}`;
    const w = c.weight, max = c.maxWeight, heavy = c.heavy, bar = this.bag.querySelector('.g-weight');
    setBar(bar, w, max, `น้ำหนัก ${w.toLocaleString()} / ${max.toLocaleString()}${heavy ? ' · หนัก: HP/MP ไม่ฟื้นเอง' : ''}`);
    bar.classList.toggle('heavy', heavy);
    if (this.wasHeavy !== undefined && heavy !== this.wasHeavy) this.feed.log(heavy ? 'สัมภาระหนัก HP/MP จะไม่ฟื้นเอง' : 'สัมภาระเบาลงแล้ว', heavy ? 'bad' : '');
    this.wasHeavy = heavy;
  }
  // Rebuilt only when something it shows changed: 'change' fires for every HP tick in a fight, and
  // a sheet rebuilt between pointerdown and click eats the click on a + button.
  refreshFlasks() {
    for (const [kind,b] of [['hp',this.potionHp],['mp',this.potionMp]]) {
      const info = this.c.flaskInfo(kind), d = info?.definition;
      const signature = `${info?.item?.id}|${info?.charges}|${Math.ceil(info?.cooldown ?? 0)}`; if (b.dataset.flaskState === signature) continue; b.dataset.flaskState = signature;
      b.querySelector('.g-skill-icon').innerHTML = d ? iconHtml(d) : '＋'; b.querySelector('small').textContent = info ? `${info.charges}/${info.maxCharges}` : 'ว่าง';
      b.style.setProperty('--charges', info ? info.charges / info.maxCharges : 0); b.classList.toggle('flask-empty', !info || info.charges < info.cost);
      b.title = info ? `${d.name} · ฟื้น ${info.recovery} · ใช้ ${info.cost} ประจุ${info.cooldown > 0 ? ` · คูลดาวน์ ${info.cooldown.toFixed(1)} วิ` : ''} · คลิกขวาเพื่อเปลี่ยน` : 'ยังไม่มีขวด · เลือกจากหน้าตัวละคร';
      b.setAttribute('aria-label', `${kind.toUpperCase()} ${kind === 'hp' ? 'Q' : 'E'}: ${b.title}`);
    }
  }
  refreshSheet() {
    const c = this.c, s = c.stats;
    const key = JSON.stringify([c.level, c.exp, c.jobLevel, c.jobExp, c.points, c.alloc, c.equipment, c.cards, c.refine, c.equipmentLocks, c.flasks, c.buffs.map(b => b.id), c.maxHp, c.maxMp, c.patk, c.matk, c.defense]);
    if (key === this.sheetKey) return;
    this.sheetKey = key;
    // paper doll: worn gear in two columns around the portrait (design "UI ใหม่")
    const slotHtml = slot => {
      const id = c.equipment[slot];
      return `<div class="g-eqs g-doll-${slot}"><button type="button" data-slot="${slot}" aria-label="${esc(`${SLOT_LABELS[slot]}: ${id ? itemName(id, c.refine[slot], c.gearRolls?.[slot]) : 'ว่าง'}`)}" class="${id ? '' : 'empty'}" style="--rar:${id ? instanceColor(c.wornItem(slot)) : '#555'}"><span>${id ? iconHtml(ITEMS[id]) : '·'}</span>${id && c.refine[slot] ? `<i class="g-plus" aria-hidden="true">+${c.refine[slot]}</i>` : ''}${id ? pips(id, c.cards[slot]) : ''}</button><small>${DOLL_LABELS[slot] ?? SLOT_LABELS[slot]}${id ? '' : ' · ว่าง'}</small>${id ? `<button type="button" class="g-equip-lock" data-lock-slot="${slot}" aria-pressed="${c.isLocked(slot)}" aria-label="${c.isLocked(slot) ? 'ปลดล็อก' : 'ล็อก'}${SLOT_LABELS[slot]}">${c.isLocked(slot) ? '🔒' : '🔓'}</button>` : ''}</div>`;
    };
    const jobMax = c.jobLevel >= MAX_JOB_LEVEL;
    this.sheet.querySelector('.g-sheet-body').innerHTML = `
      <div class="g-doll-wrap g-equip">
        ${['weapon','head','armor','gloves','belt','shoes','amulet','charm','charm2','cape'].map(slotHtml).join('')}
        <div class="g-doll-nm g-doll-identity"><b>${esc(c.name)}</b><span>${c.cls.name} · Lv ${c.level} · Job ${c.jobLevel}</span></div>
        <div class="g-doll-flasks">${['hp','mp'].map(kind => { const f=c.flaskInfo(kind); return `<button type="button" data-flask-kind="${kind}">${f ? iconHtml(f.definition) : '＋'}<b>${kind==='hp'?'Q':'E'} · ${kind.toUpperCase()}</b><small>${f ? `ขั้น ${f.definition.flask.tier} · ${f.charges}/${f.maxCharges}` : 'เลือกขวด'}</small></button>`; }).join('')}</div>
      </div>
      <div class="g-bar g-exp g-sheet-exp"><span style="width:${Math.min(100, c.exp / c.expNeeded * 100)}%"></span><em>Base Lv ${c.level} · EXP ${(c.exp / c.expNeeded * 100).toFixed(1)}%</em></div>
      <div class="g-bar g-jexp g-sheet-exp"><span style="width:${jobMax ? 100 : Math.min(100, c.jobExp / c.jobExpNeeded * 100)}%"></span><em>Job Lv ${c.jobLevel}${jobMax ? ' · สูงสุด' : ` · ${(c.jobExp / c.jobExpNeeded * 100).toFixed(1)}%`}</em></div>
      <div class="g-statbox g-parch">
      <div class="g-stats-head"><span>สถานะ</span><button type="button" class="g-guide-btn" aria-expanded="${!!this.guideOpen}">คู่มือลงแต้ม ${this.guideOpen ? '▴' : '▾'}</button><span class="${c.points ? 'g-has-points' : ''}">แต้มคงเหลือ ${c.points}</span></div>
      ${this.guideOpen ? this.guideHtml() : ''}
      <div class="g-stat-grid">${STATS.map(k => { const p = c.statParts(k); return `<div class="g-stat" title="${STAT_HINTS[k]}\nพื้นฐาน ${p.base} (1 + แต้มที่ลง ${p.base - 1}) · โบนัสอาชีพ/เลเวล ${p.cls >= 0 ? '+' : ''}${p.cls}${p.gear ? ` · อุปกรณ์ ${p.gear > 0 ? '+' : ''}${p.gear}` : ''} = ${s[k]}"><span>${k.toUpperCase()} <small>${STAT_LABELS[k]}</small></span><b>${p.base}${p.bonus ? `<i class="g-bonus">${p.bonus > 0 ? '+' : ''}${p.bonus}</i>` : ''}</b><button data-stat="${k}" ${c.points ? '' : 'disabled'} aria-label="เพิ่ม${STAT_LABELS[k]}">+</button></div>`; }).join('')}</div>
      <div class="g-derived">
        <span>HP</span><b>${c.maxHp}</b><span>MP</span><b>${c.maxMp}</b>
        <span title="พลังโจมตีกายภาพ (STR, ธนูใช้ DEX)">ATK</span><b>${c.patk}</b><span title="พลังเวท/ยา (INT)">MATK</span><b>${c.matk}</b>
        <span title="ลดความเสียหายกายภาพ (VIT)">DEF</span><b>${c.defense}</b><span title="หลบหลีก (AGI, LUK)">หลบ</span><b>${c.evasion}</b>
        <span title="ความแม่นยำ (DEX, LUK)">แม่นยำ</span><b>${c.accuracy}</b><span title="โอกาสคริติคอล (LUK)">คริ</span><b>${(c.critChance * 100).toFixed(1)}%</b>
        <span title="ตัวคูณความแรงคริ (LUK)">แรงคริ</span><b>×${c.critDamage.toFixed(2)}</b><span title="ลดเวลาระหว่างการตีปกติ (AGI)">ความเร็วตี</span><b>+${Math.round(c.attackSpeed * 100)}%</b>
        <span title="ลดคูลดาวน์สกิล (DEX + อุปกรณ์ · สูงสุด 30%)">ลดคูลดาวน์</span><b>${Math.round(c.cooldownCut * 100)}%</b><span title="ลดเวลาร่ายสกิล (DEX + อุปกรณ์ · สูงสุด 50%)">ร่ายเร็ว</span><b>${Math.round(c.castSpeed * 100)}%</b><span title="น้ำหนักที่แบก (STR เพิ่มความจุ)">น้ำหนัก</span><b class="${c.heavy ? 'g-heavy' : ''}">${c.weight}/${c.maxWeight}</b>
      </div>
      <div class="g-stat-footer"><button type="button" class="g-reset" ${Object.values(c.alloc).some(Boolean) ? '' : 'disabled'}>รีเซ็ตแต้มสถานะ</button></div>
      </div>`;
    if (this.workspace) this.sheet.querySelector('.g-doll-wrap').after(this.workspace.wornDetail);
    this.workspace?.refresh();
  }
  // คู่มือลงแต้ม: what the stats do for this class and two or three builds (src/character/data/statguide.js)
  reportLoadout(r) {
    const why = { empty: 'ยังไม่ได้บันทึกชุดนี้', dead: 'ต้องฟื้นคืนชีพก่อน', combat: 'เปลี่ยนชุดได้เมื่อพ้นการต่อสู้', missing: 'หาอุปกรณ์เดิมพร้อมการ์ดและระดับตีบวกไม่พบ', class: 'อาชีพหรือเลเวลใช้อุปกรณ์ในชุดนี้ไม่ได้', bag_full: 'ต้องมีช่องว่างสำหรับอุปกรณ์ที่ถอด', pending: 'กำลังรอผลชุดก่อนหน้า', refused: 'เปลี่ยนชุดไม่ได้ กรุณาพ้นการต่อสู้และตรวจอุปกรณ์', connection: 'ขาดการเชื่อมต่อ กรุณารอข้อมูลตัวละครล่าสุด' };
    this.feed.log(r.ok ? `ใช้ ${this.c.loadouts[r.index]?.name ?? 'ชุดอุปกรณ์'} แล้ว` : why[r.why] ?? 'เปลี่ยนชุดไม่ได้', r.ok ? 'gold' : 'bad');
    if (r.ok) this.c.save();
  }
  refreshLoadouts() {
    if (this.loadouts.hidden) return;
    const c = this.c, order = c.hotbarSkills;
    const key = JSON.stringify([c.loadouts, order, c.inventory, c.equipment, c.refine, c.cards, c.level, c.inCombat, c.alive, c.loadoutPending]);
    if (key === this.loadoutsKey) return; this.loadoutsKey = key;
    const presets = Array.from({ length: LOADOUT_COUNT }, (_, index) => {
      const preset = c.loadouts[index], plan = c.planLoadout(index);
      const gear = preset ? Object.entries(preset.equipment).filter(([, ref]) => ref).map(([slot, ref]) => `${SLOT_LABELS[slot]}: ${itemName(ref.id, ref.plus)}${ref.cards.length ? ` · ${ref.cards.length} การ์ด` : ''}`).join(' / ') : 'บันทึกอุปกรณ์ที่สวมอยู่และลำดับสกิลปัจจุบัน';
      const name = preset?.name ?? this.loadoutNames?.[index] ?? `ชุด ${index + 1}`;
      return `<article class="g-loadout-row"><label><span>ชุด ${index + 1}</span><input type="text" maxlength="20" data-loadout-name="${index}" value="${esc(name)}" aria-label="ชื่อชุด ${index + 1}"></label><small>${esc(gear)}</small><div><button type="button" data-loadout-save="${index}">${preset ? 'บันทึกทับชุดนี้' : 'บันทึกชุดปัจจุบัน'}</button><button type="button" data-loadout-apply="${index}" ${plan.ok && !c.loadoutPending ? '' : 'disabled'}>${c.loadoutPending ? 'กำลังรอผล…' : 'ใช้ชุดนี้'}</button></div>${preset && !plan.ok ? `<small class="g-loadout-warning">${plan.why === 'missing' ? 'อุปกรณ์ในชุดนี้ขาดหรือการ์ด / ตีบวกเปลี่ยนไป' : plan.why === 'bag_full' ? 'ช่องกระเป๋าไม่พอสำหรับของที่ถอด' : plan.why === 'combat' ? 'รอพ้นการต่อสู้ก่อนใช้ชุด' : plan.why === 'dead' ? 'ต้องฟื้นคืนชีพก่อน' : 'อาชีพหรือเลเวลใช้อุปกรณ์ไม่ได้'}</small>` : ''}</article>`;
    }).join('');
    const skills = order.map((id, index) => `<div class="g-hotbar-order"><b>${index + 1}</b><span>${esc(LEGACY_SKILLS[id]?.name ?? c.skillName(id))}</span><button type="button" data-skill-move="${index}" data-direction="-1" aria-label="เลื่อนสกิลขึ้น" ${index ? '' : 'disabled'}>↑</button><button type="button" data-skill-move="${index}" data-direction="1" aria-label="เลื่อนสกิลลง" ${index < order.length - 1 ? '' : 'disabled'}>↓</button></div>`).join('');
    this.loadouts.querySelector('.g-loadout-body').innerHTML = `<p class="g-loadout-hint">ใช้ชุดได้เมื่อพ้นการต่อสู้ · เลือกอุปกรณ์ที่มีอยู่จริงพร้อมการ์ดและตีบวกเดิม</p>${presets}<p class="g-loadout-hint">ลำดับแถบสกิลที่เรียนแล้ว · บันทึกพร้อมแต่ละชุด</p>${skills || '<p class="g-loadout-hint">เรียนสกิลในเมนูสกิลเพื่อจัดลำดับ</p>'}`;
  }
  guideHtml() {
    const c = this.c, g = STAT_GUIDE.classes[c.classId];
    const builds = (g?.builds ?? []).map((b, i) => `<div class="g-build"><b>${esc(b.name)}</b><span class="g-plan">${Object.entries(b.plan).map(([k, w]) => `<i>${k.toUpperCase()} ${w}</i>`).join('')}</span><small>${esc(b.why)}</small><button type="button" data-plan="${i}" ${c.points ? '' : 'disabled'} title="ลงแต้มที่เหลือ ${c.points} แต้มตามสัดส่วนนี้">ลงตามแผน${c.points ? ` (${c.points})` : ''}</button></div>`).join('');
    return `<div class="g-guide">
      ${g ? `<h5>${esc(c.cls.name)} สเกลจาก ${g.main.toUpperCase()} ${esc(STAT_LABELS[g.main])}</h5><ul>${g.lines.map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
      ${builds ? `<h5>แผนลงแต้มที่แนะนำ</h5>${builds}` : ''}
      <h5>กติกาที่ควรรู้</h5><ul>${STAT_GUIDE.tips.map(t => `<li>${esc(t)}</li>`).join('')}</ul>
    </div>`;
  }
  refreshInventory() {
    const inv = this.c.inventory;
    // auto-sort: reorder once (sortBag emits 'inventory', which renders the sorted bag)
    if (this.autoSort?.checked && !this.sorting && JSON.stringify(sortedInventory(inv)) !== JSON.stringify(inv)) {
      this.sorting = true; try { sortBag(this.c); } finally { this.sorting = false; } return;
    }
    const filtered = this.tab !== 'all' || this.query.trim();
    let shown = 0, emptyShown = 0;
    // Capacity is independent of the number of decorative empty cells.
    const emptyLimit = Math.max(0, 32 - inv.filter(Boolean).length);
    this.grid.innerHTML = inv.map((s, i) => {
      if (!s) return filtered || emptyShown++ >= emptyLimit ? '' : `<button class="g-slot empty" data-index="${i}" aria-label="ช่องว่าง"></button>`;
      if (!inTab(this.tab, s.id) || !matchesSearch(s.id, this.query)) return '';
      const d = ITEMS[s.id], cmp = compareToEquipped(this.c, s); shown++;
      const arrow = cmp > 0 ? '<i class="g-cmp up" aria-hidden="true">▲</i>' : cmp < 0 ? '<i class="g-cmp down" aria-hidden="true">▼</i>' : '';
      return `<button draggable="${d.type === 'use'}" class="g-slot rar-${d.rarity || 'none'}${isItemLocked(s) ? ' item-locked' : ''}" data-index="${i}" aria-label="${esc(itemName(s.id, s.plus, s.roll))}${isItemLocked(s) ? ' · ล็อกแล้ว' : ''}" style="--rar:${instanceColor(s)}"><span>${iconHtml(d)}</span>${arrow}${isItemLocked(s) ? '<i class="g-item-lock">🔒</i>' : ''}${s.plus ? `<i class="g-plus">+${s.plus}</i>` : ''}${pips(s.id, s.cards)}${s.qty > 1 ? `<small>${s.qty}</small>` : ''}</button>`;
    }).join('');
    this.bag.querySelector('.g-bag-none').hidden = !filtered || shown > 0;
    this.bag.querySelector('.g-bag-count').textContent = `ช่อง ${inv.filter(Boolean).length} / ${inv.length}`;
    this.refresh();
    this.workspace?.refresh();
  }
  // The card picker: gear of the card's kind with a free slot (worn first).
  openCardPick(i) {
    const cardItem = this.c.inventory[i], card = ITEMS[cardItem?.id]; if (card?.type !== 'card') return;
    // Opening may auto-sort: retain the selected instance, not its old bag index.
    this.workspace.open('bag');
    if (this.c.inventory[i] !== cardItem) i = this.c.inventory.findIndex(s => s && JSON.stringify(s) === JSON.stringify(cardItem));
    if (i < 0) return;
    const targets = this.c.cardTargets(i); this.pickCard = i;
    this.pickFingerprint = JSON.stringify(this.c.inventory[i]); this.pickWhere = undefined; this.pickTarget = null;
    this.cardPick.innerHTML = `<header>ใส่${esc(card.name)}<small>${bonusText(card.bonus)}</small></header>`
      + (targets.length ? targets.map(t => `<button type="button" data-where="${t.worn ? t.slot : t.index}" data-worn="${!!t.worn}" aria-pressed="false"><span>${iconHtml(ITEMS[t.id])}</span><b>${esc(instanceName(t.worn ? this.c.wornItem(t.slot) : this.c.inventory[t.index]))}${t.worn ? ` · สวมอยู่ (${SLOT_LABELS[t.slot]})` : ''}</b>${pips(t.id, t.cards)}</button>`).join('')
        : `<p>ไม่มี${SLOT_LABELS[card.slot]}ที่มีช่องการ์ดว่าง</p>`)
      + '<p class="g-pick-warn">ใส่แล้วการ์ดติดกับไอเท็มนั้นถาวร ถอดออกไม่ได้</p><p class="iw-socket-target" aria-live="polite">เลือกอุปกรณ์ก่อนยืนยัน</p><button type="button" class="g-pick-confirm" disabled>ยืนยันใส่การ์ด</button><button type="button" class="g-pick-cancel">ยกเลิก</button>';
    this.cardPick.hidden = false;
  }
  showDetail(slot) {
    if (slot) this.workspace.select(Number(slot.dataset.index));
  }
  // Per frame: buff timers count down.
  update() { this.refreshFlasks(); if (this.c.buffs.length) this.frame.querySelector('.g-buffs').innerHTML = this.buffsHtml(); }
}
