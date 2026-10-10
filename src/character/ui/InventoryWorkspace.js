import { ITEMS } from '../data/items.js';
import { BAG_TABS, inTab, gearScore } from '../bag.js';
import { isItemLocked } from '../itemState.js';
import { el, esc } from './dom.js';
import './inventory-workspace.css';

// Keep visual comparisons aligned with Character.equip, which replaces charm
// (not the weaker charm) when both accessory slots are occupied.
export const equipDestination = (c, id) => ITEMS[id]?.slot === 'charm' && c.equipment.charm && !c.equipment.charm2 ? 'charm2' : ITEMS[id]?.slot;
export function compareToEquipped(c, input) {
  const id = typeof input === 'string' ? input : input?.id;
  const d = ITEMS[id];
  if (d?.type !== 'equip' || (d.slot === 'weapon' && c.canWield && !c.canWield(id))) return 0;
  const current = c.equipment[equipDestination(c, id)];
  if (!current) return 1;
  const diff = gearScore(c.cls, input) - gearScore(c.cls, c.wornItem?.(equipDestination(c, id)) ?? current);
  return Math.abs(diff) < .5 ? 0 : Math.sign(diff);
}

// Presentation only: all mutations still go through the existing Character API.
export class InventoryWorkspace {
  constructor(ui, renderCard, labels) {
    this.ui = ui; this.renderCard = renderCard; this.labels = labels;
    this.root = el('section', 'inventory-workspace glass', `
      <div class="panel-heading iw-heading">ตัวละครและสัมภาระ<button type="button" aria-label="ปิดตัวละครและกระเป๋า">×</button></div>
      <div class="iw-tabs" role="tablist" aria-label="ตัวละครและสัมภาระ">
        <button type="button" role="tab" data-view="sheet" aria-selected="false" aria-controls="iw-equipment">อุปกรณ์ / สถานะ</button>
        <button type="button" role="tab" data-view="bag" aria-selected="true" aria-controls="iw-bag">กระเป๋า</button>
      </div><div class="iw-columns"></div>`);
    ui.layer.append(this.root);
    this.root.querySelector('.iw-columns').append(ui.sheet, ui.bag);
    const controls = el('div', 'iw-bag-controls');
    ui.bag.querySelector('.g-grid').before(controls);
    controls.append(ui.bag.querySelector('.g-bag-tabs'), ui.bag.querySelector('.g-bag-tools'));
    ui.sheet.id = 'iw-equipment'; ui.bag.id = 'iw-bag';
    ui.sheet.setAttribute('aria-label', 'อุปกรณ์และสถานะ');
    ui.bag.setAttribute('aria-label', 'กระเป๋า');
    this.wornDetail = el('div', 'g-detail iw-worn-detail');
    this.wornDetail.hidden = true; ui.sheet.append(this.wornDetail);
    ui.detail.classList.add('iw-detail');
    this.tooltip = el('div', 'iw-tooltip');
    this.tooltip.id = 'iw-item-tooltip'; this.tooltip.setAttribute('role', 'tooltip');
    this.tooltip.hidden = true; this.root.append(this.tooltip);
    const itemButton = target => target?.closest?.('.g-slot[data-index],.g-eqs>button[data-slot]');
    this.root.addEventListener('pointerover', e => {
      if (e.pointerType !== 'mouse') return;
      if (this.tooltip.contains(e.target)) { clearTimeout(this.tooltipTimer); return; }
      const button = itemButton(e.target);
      if (button) this.showTooltip(button);
    });
    this.root.addEventListener('pointerout', e => {
      if (!itemButton(e.target) && !this.tooltip.contains(e.target)) return;
      if (this.tooltip.contains(e.relatedTarget) || this.hoverButton?.contains(e.relatedTarget)) return;
      clearTimeout(this.tooltipTimer);
      this.tooltipTimer = setTimeout(() => this.hideTooltip(), 150);
    });
    this.root.addEventListener('focusin', e => {
      const button = itemButton(e.target);
      if (button?.matches(':focus-visible')) this.showTooltip(button);
    });
    this.root.addEventListener('focusout', () => this.hideTooltip());
    this.root.addEventListener('pointerdown', () => this.hideTooltip());
    this.root.addEventListener('scroll', e => {
      if (e.target === this.tooltip || !this.hoverButton) return;
      const anchor = this.hoverButton.getBoundingClientRect();
      const viewport = this.hoverButton.closest('.g-panel').getBoundingClientRect();
      if (anchor.bottom <= viewport.top || anchor.top >= viewport.bottom) this.hideTooltip();
      else this.positionTooltip();
    }, true);
    // A redraw/scroll can leave a stationary pointer over a replacement slot.
    this.root.addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse' || this.tooltip.contains(e.target)) return;
      const button = itemButton(e.target);
      if (button) this.showTooltip(button);
    });
    this.root.querySelector('.iw-heading button').addEventListener('click', () => this.close());
    this.root.querySelector('.iw-tabs').addEventListener('click', e => {
      const tab = e.target.closest('[data-view]'); if (tab) this.open(tab.dataset.view);
    });
    this.root.addEventListener('click', e => {
      const button = e.target.closest('[data-item-action]');
      if (button) this.act(button.dataset.itemAction);
    });
    this.root.addEventListener('keydown', e => {
      // Navigation/activation in this window must not trigger world skills.
      if (e.code === 'Escape') { if (!this.tooltip.hidden) this.hideTooltip(); else this.close(); e.stopPropagation(); }
      else if (e.target.closest('input,button,select,textarea')) e.stopPropagation();
      if (e.target.closest('.iw-tabs') && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
        e.preventDefault(); this.open(e.key === 'Home' ? 'sheet' : e.key === 'End' ? 'bag' : this.root.dataset.view === 'bag' ? 'sheet' : 'bag');
        this.root.querySelector(`[data-view="${this.root.dataset.view}"]`).focus();
      }
    });
    this.root.dataset.view = 'bag';
    this.desktopQuery = matchMedia('(min-width: 761px) and (min-height: 521px)');
    this.onLayoutChange = () => {
      this.hideTooltip();
      if (this.selected) this.refreshDetail();
    };
    this.desktopQuery.addEventListener('change', this.onLayoutChange);
    this.clear();
  }
  get desktop() { return !!this.desktopQuery?.matches; }
  open(view) {
    this.hideTooltip();
    if (this.ui.sheet.hidden && this.ui.bag.hidden) { this.clear(); this.ui.cardPick.hidden = true; }
    this.root.dataset.view = view;
    this.root.querySelectorAll('[data-view]').forEach(b => {
      const active = b.dataset.view === view;
      b.setAttribute('aria-selected', String(active)); b.tabIndex = active ? 0 : -1;
    });
    this.ui.sheet.hidden = this.ui.bag.hidden = false;
    this.ui.refreshSheet(); this.ui.refreshInventory();
  }
  toggle(view) {
    if (!this.ui.bag.hidden && this.root.dataset.view === view) this.close();
    else this.open(view);
  }
  close() {
    this.hideTooltip();
    this.ui.sheet.hidden = this.ui.bag.hidden = true;
    this.ui.cardPick.hidden = true; this.clear();
  }
  clear() {
    this.hideTooltip();
    this.selected = null;
    this.ui.detail.hidden = false;
    this.ui.detail.innerHTML = '<p class="iw-selection-hint">เลือกไอเท็มเพื่อดูรายละเอียด แล้วกดสวมใส่ ใช้ หรือใส่การ์ด</p>';
    this.wornDetail.hidden = true;
    this.paintSelection();
  }
  item() {
    const s = this.selected;
    return !s ? null : s.slot ? this.ui.c.wornItem(s.slot) : this.ui.c.inventory[s.index];
  }
  select(index, slot = null) {
    this.hideTooltip();
    this.ui.cardPick.hidden = true;
    const item = slot ? this.ui.c.wornItem(slot) : this.ui.c.inventory[index];
    if (!item) { this.clear(); return; }
    this.selected = { index, slot, fingerprint: JSON.stringify(item) };
    this.refreshDetail(); this.paintSelection();
    // Desktop columns scroll independently: never move the character column
    // when inspecting worn gear. The shared bag detail owns desktop actions.
    (slot && !this.desktop ? this.wornDetail : this.ui.detail).scrollIntoView?.({ block: 'nearest' });
  }
  paintSelection() {
    this.ui.grid.querySelectorAll('[data-index]').forEach(b => {
      const active = !!this.selected && !this.selected.slot && Number(b.dataset.index) === this.selected.index;
      b.classList.toggle('iw-selected', active); b.setAttribute('aria-pressed', String(active));
    });
    this.ui.sheet.querySelectorAll('[data-slot]').forEach(b => {
      const active = this.selected?.slot === b.dataset.slot;
      b.classList.toggle('iw-selected', active); b.setAttribute('aria-pressed', String(active));
    });
  }
  tooltipItem(button) {
    return button.dataset.slot ? this.ui.c.wornItem(button.dataset.slot) : this.ui.c.inventory[Number(button.dataset.index)];
  }
  showTooltip(button) {
    clearTimeout(this.tooltipTimer);
    if (this.hoverButton === button && !this.tooltip.hidden) return;
    this.hideTooltip();
    const item = this.tooltipItem(button);
    if (!item || !ITEMS[item.id]) return;
    this.hoverButton = button; this.hoverFingerprint = JSON.stringify(item);
    this.tooltip.innerHTML = `<div class="iw-item-card">${this.renderCard(item, button.dataset.slot ? 0 : compareToEquipped(this.ui.c, item))}</div><p class="iw-tooltip-hint">เลือกไอเท็มเพื่อดูรายละเอียดและปุ่มใช้งาน</p>`;
    button.setAttribute('aria-describedby', this.tooltip.id);
    this.tooltip.hidden = false;
    this.positionTooltip();
  }
  positionTooltip() {
    if (!this.hoverButton?.isConnected || this.tooltip.hidden) return;
    // Rects include the user's HUD zoom; positions inside the window do not.
    const box = this.root.getBoundingClientRect(), anchor = this.hoverButton.getBoundingClientRect();
    const scale = box.width / this.root.offsetWidth || 1;
    const margin = 10, width = this.tooltip.offsetWidth, height = this.tooltip.offsetHeight;
    let left = (anchor.right - box.left) / scale + margin;
    if (left + width > this.root.clientWidth - margin) left = (anchor.left - box.left) / scale - width - margin;
    this.tooltip.style.left = `${Math.max(margin, Math.min(left, this.root.clientWidth - width - margin))}px`;
    this.tooltip.style.top = `${Math.max(margin, Math.min((anchor.top - box.top) / scale, this.root.clientHeight - height - margin))}px`;
  }
  hideTooltip() {
    clearTimeout(this.tooltipTimer);
    this.hoverButton?.removeAttribute('aria-describedby'); this.hoverButton = null;
    if (this.tooltip) this.tooltip.hidden = true;
  }
  refreshDetail() {
    const item = this.item();
    if (!item || JSON.stringify(item) !== this.selected.fingerprint) { this.clear(); return; }
    const { c } = this.ui, d = ITEMS[item.id], worn = !!this.selected.slot;
    const wornOnLeft = worn && !this.desktop;
    const host = wornOnLeft ? this.wornDetail : this.ui.detail;
    this.wornDetail.hidden = !wornOnLeft;
    if (wornOnLeft) this.ui.detail.innerHTML = '<p class="iw-selection-hint">กำลังดูอุปกรณ์ที่สวมอยู่ในฝั่งตัวละคร</p>';
    let action = '';
    if (worn) action = `<button type="button" data-item-action="unequip" ${!c.alive || !c.inventory.includes(null) ? 'disabled' : ''}>ถอดลงกระเป๋า</button>`;
    else if (d.type === 'equip') action = `<button type="button" data-item-action="equip" ${!c.alive || !c.canWield(item.id) || c.level < (d.minLevel ?? 1) || d.retired ? 'disabled' : ''}>สวมใส่</button>`;
    else if (d.type === 'use') action = `<button type="button" data-item-action="use" ${!c.alive ? 'disabled' : ''}>ใช้ไอเท็ม</button>`;
    else if (d.type === 'card') action = `<button type="button" data-item-action="socket" ${!c.alive || isItemLocked(item) ? 'disabled' : ''}>เลือกอุปกรณ์ใส่การ์ด</button>`;
    let comparison = '';
    if (!worn && d.type === 'equip') {
      // Match Character.equip's actual destination, including the second charm.
      const slot = equipDestination(c, item.id);
      const current = c.wornItem(slot);
      comparison = `<div class="iw-comparison"><b>ช่องที่จะสวม: ${esc(this.labels[slot] ?? slot)}</b>${current ? this.renderCard(current, 0) : '<small>ช่องนี้ว่าง</small>'}</div>`;
      if (!c.canWield(item.id) || c.level < (d.minLevel ?? 1)) comparison += '<p class="iw-warning">อาชีพหรือเลเวลยังใช้อุปกรณ์นี้ไม่ได้</p>';
      comparison += '<small class="iw-score-note">ลูกศรเปรียบเทียบโบนัสตามอาชีพ รวมออฟสุ่ม ตีบวก และการ์ด</small>';
    }
    host.innerHTML = `${worn ? `<b class="iw-detail-location">สวมอยู่ · ${esc(this.labels[this.selected.slot] ?? this.selected.slot)}</b>` : ''}<div class="iw-item-card">${this.renderCard(item, worn ? 0 : compareToEquipped(c, item))}</div>${comparison}<div class="iw-actions">${action}<button type="button" data-item-action="lock">${isItemLocked(item) ? 'ปลดล็อก' : 'ล็อกไอเท็ม'}</button></div>`;
    host.hidden = false;
  }
  act(action) {
    const item = this.item(), selected = this.selected;
    if (!item || JSON.stringify(item) !== selected.fingerprint) { this.clear(); return; }
    const { c } = this.ui;
    if (action === 'socket') { this.ui.openCardPick(selected.index); return; }
    // Clear before Character emits inventory/change synchronously.
    this.clear(); this.ui.cardPick.hidden = true;
    if (action === 'lock') { c.setItemLock(selected.slot ?? selected.index, !isItemLocked(item)); c.save(); }
    else if (action === 'unequip') c.unequip(selected.slot);
    else if (action === 'equip' || action === 'use') {
      if (!c.useAt(selected.index) && action === 'use') this.ui.feed.log('ใช้ไม่ได้ในขณะนี้ หรือ HP / MP เต็มแล้ว', 'bad');
    }
  }
  refresh() {
    if (this.hoverButton && (!this.hoverButton.isConnected || JSON.stringify(this.tooltipItem(this.hoverButton)) !== this.hoverFingerprint)) this.hideTooltip();
    for (const tab of BAG_TABS) {
      const count = this.ui.c.inventory.filter(s => s && inTab(tab.id, s.id)).length;
      const b = this.ui.bag.querySelector(`[data-tab="${tab.id}"]`);
      b.innerHTML = `${esc(tab.label)} <span class="iw-category-count">${count}</span>`;
      b.title = `${tab.label}: ${count} ช่อง`;
    }
    if (this.selected) this.refreshDetail();
    this.paintSelection();
  }
}
