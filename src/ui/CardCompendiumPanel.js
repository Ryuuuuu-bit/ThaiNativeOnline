import { CARD_CATALOG, CARD_SLOT_LABELS, CARD_KIND_LABELS, cardOwnership, cardProgress, searchCards, cardPercent } from '../data/card-compendium.js';
import { PLAYER_GUIDE, GUIDE_ACTIONS } from '../data/player-guide.js';
import { MAPS } from '../world/maps.js';
import { versioned } from '../core/version.js';
import './player-guide.css';
import './card-compendium.css';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = n => Number(n).toLocaleString('th-TH');
const BASE = import.meta.env?.BASE_URL ?? '/';
const visibleFocusTarget = element => element?.isConnected && element !== document.body && !element.disabled && element.getClientRects().length && getComputedStyle(element).visibility !== 'hidden';
const art = (card, detail = false) => `<span class="cc-art${card.item.illustration ? ' cc-painted-art' : ''}${card.sharedArt ? ' cc-shared-art' : ''}" aria-hidden="true">${card.sharedArt ? '' : `<img class="cc-image" src="${esc(versioned(`${BASE}${detail ? card.item.illustration ?? card.item.img : card.item.img}`))}" alt="" loading="lazy">`}<span class="cc-emblem" ${card.sharedArt ? '' : 'hidden'}>❖</span></span>`;

export class CardCompendiumPanel {
  constructor({ character, prepare, locate, openGuideAction }) {
    Object.assign(this, { character, prepare, locate, openGuideAction });
    this.tab = 'cards'; this.view = 'catalog'; this.offCharacter = [];
    this.root = document.createElement('div');
    this.root.id = 'card-compendium-overlay'; this.root.className = 'qol-overlay cc-overlay'; this.root.hidden = true;
    const maps = Object.values(MAPS).filter(map => CARD_CATALOG.some(card => card.locations.some(l => l.map === map.id)));
    this.root.innerHTML = `<section class="guide-panel cc-panel" role="dialog" aria-modal="true" aria-labelledby="cc-title" tabindex="-1">
      <header class="guide-head cc-head"><div><small>บันทึกแห่งอโยธยา</small><h2 id="cc-title">สมุดการ์ดและคู่มือ</h2><p>จดจำอาคม เตรียมศาสตรา และเลือกแหล่งล่า</p></div><button type="button" class="cc-close" data-cc-close aria-label="ปิดสมุดการ์ดและคู่มือ">×</button></header>
      <nav class="cc-tabs" role="tablist" aria-label="หน้าสมุด"><button type="button" id="cc-tab-cards" role="tab" data-cc-tab="cards" aria-controls="cc-cards" aria-selected="true">❖ สมุดการ์ด</button><button type="button" id="cc-tab-guide" role="tab" data-cc-tab="guide" aria-controls="cc-guide" aria-selected="false" tabindex="-1">◇ คู่มือผู้เดินทาง</button></nav>
      <div id="cc-cards" class="cc-cards" role="tabpanel" aria-labelledby="cc-tab-cards">
        <div class="cc-progress"><div><b id="cc-progress-count"></b><small id="cc-character"></small></div><progress id="cc-progress-bar" value="0" max="${CARD_CATALOG.length}" aria-label="จำนวนชนิดการ์ดที่เคยค้นพบ"></progress><small id="cc-source-count"></small></div>
        <nav class="cc-mobile-tabs" role="tablist" aria-label="มุมมองการ์ด"><button type="button" id="cc-view-catalog" role="tab" data-cc-view="catalog" aria-controls="cc-catalog" aria-selected="true">รายชื่อการ์ด</button><button type="button" id="cc-view-detail" role="tab" data-cc-view="detail" aria-controls="cc-detail" aria-selected="false" tabindex="-1">รายละเอียด</button></nav>
        <div class="cc-book" data-view="catalog"><section id="cc-catalog" class="cc-catalog" aria-label="รายชื่อการ์ด">
          <label class="cc-search">ค้นหามอนสเตอร์ การ์ด โบนัส หรืออาคม<input id="cc-search" type="search" placeholder="เช่น ชาละวัน / SP / ต้านทาน…" autocomplete="off"></label>
          <details class="cc-filter-drawer"><summary>กรองแหล่งล่าและการ์ด <span id="cc-filter-count"></span></summary><div class="cc-filters">
            <label>แหล่งล่า<select id="cc-map"><option value="">ทุกแผนที่</option>${maps.map(m => `<option value="${esc(m.id)}">${esc(m.name)}</option>`).join('')}<option value="unavailable">ยังไม่มีแหล่งเกิด</option></select></label>
            <label>ประเภท<select id="cc-kind"><option value="">ทุกประเภท</option>${Object.entries(CARD_KIND_LABELS).map(([id, label]) => `<option value="${id}">${label}</option>`).join('')}</select></label>
            <label>ช่องอุปกรณ์<select id="cc-slot"><option value="">ทุกช่อง</option>${Object.entries(CARD_SLOT_LABELS).map(([id, label]) => `<option value="${id}">${label}</option>`).join('')}</select></label>
            <label>การสะสม<select id="cc-collected"><option value="">ทุกการ์ด</option><option value="collected">เคยค้นพบแล้ว</option><option value="missing">ยังไม่เคยค้นพบ</option><option value="owned">มีอยู่ตอนนี้</option></select></label>
            <button type="button" data-cc-reset>ล้างตัวกรอง</button></div></details>
          <small id="cc-result-count" role="status" aria-live="polite"></small><div id="cc-list" class="cc-list"></div>
        </section><article id="cc-detail" class="cc-detail" aria-label="รายละเอียดการ์ด"></article></div>
      </div><article id="cc-guide" class="cc-guide" role="tabpanel" aria-labelledby="cc-tab-guide" hidden></article>
    </section>`;
    (document.getElementById('app') ?? document.body).append(this.root);
    this.$ = selector => this.root.querySelector(selector);
    this.root.addEventListener('click', event => this.click(event));
    this.root.addEventListener('keydown', event => this.keydown(event));
    this.root.addEventListener('error', event => {
      const image = event.target;
      if (!image.classList?.contains('cc-image')) return;
      image.hidden = true; image.parentElement.querySelector('.cc-emblem').hidden = false;
    }, true);
    this.$('#cc-search').addEventListener('input', () => this.render());
    for (const id of ['map', 'kind', 'slot', 'collected']) this.$(`#cc-${id}`).addEventListener('change', () => this.render());
    this.keepFocus = event => { if (this.open && !this.root.contains(event.target)) this.$('[data-cc-close]').focus({ preventScroll: true }); };
    this.renderGuide();
  }
  get open() { return !this.root.hidden; }
  show(tab = 'cards') {
    const previous = this.open ? this.previousFocus : document.activeElement;
    this.prepare?.(); this.previousFocus = previous;
    this.releaseCharacter(); this.root.hidden = false;
    this.tab = tab === 'guide' ? 'guide' : 'cards'; this.view = 'catalog';
    this.bindCharacter(this.character?.()); this.refresh(true);
    document.addEventListener('focusin', this.keepFocus);
    // Detect a switched character even if the old emitter has already been retired.
    this.characterTimer = setInterval(() => this.refresh(), 250);
    this.$(this.tab === 'cards' ? '#cc-search' : '#cc-tab-guide').focus({ preventScroll: true });
  }
  close() {
    if (!this.open) return;
    this.root.hidden = true; this.releaseCharacter();
    document.removeEventListener('focusin', this.keepFocus);
    const focus = visibleFocusTarget(this.previousFocus) ? this.previousFocus : document.getElementById('menu-btn');
    if (visibleFocusTarget(focus)) focus.focus?.({ preventScroll: true });
  }
  dispose() { this.close(); this.releaseCharacter(); document.removeEventListener('focusin', this.keepFocus); this.root.remove(); }
  releaseCharacter() {
    for (const off of this.offCharacter) off();
    this.offCharacter = []; this.boundCharacter = null; this.signature = null;
    clearInterval(this.characterTimer); this.characterTimer = null;
  }
  bindCharacter(character) {
    for (const off of this.offCharacter) off();
    this.offCharacter = []; this.boundCharacter = character; this.signature = null;
    if (character?.on) for (const event of ['change', 'inventory', 'card-book', 'server-sync']) {
      const off = character.on(event, () => this.refresh());
      if (typeof off === 'function') this.offCharacter.push(off);
    }
  }
  refresh(force = false) {
    if (!this.open) return;
    const character = this.character?.();
    if (character !== this.boundCharacter) this.bindCharacter(character);
    const signature = JSON.stringify([character?.name, character?.level, character?.cardBook, character?.inventory, character?.equipment, character?.cards]);
    if (!force && signature === this.signature) return;
    this.signature = signature; this.render();
  }
  click(event) {
    const target = event.target;
    if (target === this.root || target.closest('[data-cc-close]')) { this.close(); return; }
    const tab = target.closest('[data-cc-tab]');
    if (tab) { this.tab = tab.dataset.ccTab; this.renderTabs(); return; }
    const view = target.closest('[data-cc-view]');
    if (view) { this.view = view.dataset.ccView; this.renderTabs(); return; }
    if (target.closest('[data-cc-reset]')) {
      this.$('#cc-search').value = '';
      for (const id of ['map', 'kind', 'slot', 'collected']) this.$(`#cc-${id}`).value = '';
      this.render(); return;
    }
    const row = target.closest('[data-cc-card]');
    if (row) {
      this.selected = CARD_CATALOG.find(card => card.id === row.dataset.ccCard); this.view = 'detail'; this.render();
      if (this.$('.cc-mobile-tabs').getClientRects().length) this.$('#cc-detail h3')?.focus({ preventScroll: true });
      return;
    }
    const place = target.closest('[data-cc-place]');
    if (place && this.locate) {
      const monster = this.selected?.monster, location = this.selected?.locations[Number(place.dataset.ccPlace)];
      if (monster && location) { this.close(); this.locate(monster, location); }
      return;
    }
    const action = target.closest('[data-cc-action]')?.dataset.ccAction;
    if (this.openGuideAction && GUIDE_ACTIONS.includes(action)) { this.close(); this.openGuideAction(action); }
  }
  keydown(event) {
    event.stopPropagation();
    if (event.key === 'Escape') { event.preventDefault(); this.close(); return; }
    const tab = event.target.closest('[role="tab"]');
    if (tab && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      const tabs = [...tab.parentElement.querySelectorAll('[role="tab"]')];
      const index = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (tabs.indexOf(tab) + (event.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length;
      tabs[index].click(); tabs[index].focus(); return;
    }
    if (event.key !== 'Tab') return;
    const controls = [...this.root.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),summary')].filter(el => el.getClientRects().length && el.tabIndex >= 0);
    const first = controls[0], last = controls.at(-1);
    if (event.shiftKey && (document.activeElement === first || !controls.includes(document.activeElement))) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && (document.activeElement === last || !controls.includes(document.activeElement))) { event.preventDefault(); first?.focus(); }
  }
  renderTabs() {
    for (const tab of this.root.querySelectorAll('[data-cc-tab]')) { const on = tab.dataset.ccTab === this.tab; tab.setAttribute('aria-selected', String(on)); tab.tabIndex = on ? 0 : -1; }
    this.$('#cc-cards').hidden = this.tab !== 'cards'; this.$('#cc-guide').hidden = this.tab !== 'guide';
    for (const tab of this.root.querySelectorAll('[data-cc-view]')) { const on = tab.dataset.ccView === this.view; tab.setAttribute('aria-selected', String(on)); tab.tabIndex = on ? 0 : -1; }
    this.$('.cc-book').dataset.view = this.view;
  }
  render() {
    const character = this.character?.(), ownership = cardOwnership(character), progress = cardProgress(character, ownership);
    this.renderTabs();
    this.$('#cc-progress-count').textContent = `เคยค้นพบ ${fmt(progress.collected)} / ${fmt(progress.total)} ชนิด`;
    this.$('#cc-character').textContent = character ? `${character.name} · Lv.${character.level} · มีการ์ด ${fmt(progress.owned)} ใบ` : 'เลือกตัวละครเพื่อดูประวัติการสะสม';
    this.$('#cc-progress-bar').value = progress.collected;
    this.$('#cc-source-count').textContent = `มีแหล่งล่า ${progress.available} ชนิด · ประวัติยังอยู่แม้ใช้หรือขายการ์ด`;
    const filters = Object.fromEntries(['map', 'kind', 'slot', 'collected'].map(id => [id, this.$(`#cc-${id}`).value]));
    const list = searchCards({ query: this.$('#cc-search').value, ...filters, ownership });
    const filterCount = Object.values(filters).filter(Boolean).length;
    this.$('#cc-filter-count').textContent = filterCount ? `(${filterCount})` : '';
    this.$('#cc-result-count').textContent = `${list.length} ชนิดในรายการ`;
    if (!list.some(card => card.id === this.selected?.id)) this.selected = list[0] ?? null;
    const host = this.$('#cc-list'), scroll = host.scrollTop, focus = document.activeElement?.dataset?.ccCard;
    host.innerHTML = list.map(card => {
      const count = ownership[card.id];
      return `<button type="button" class="cc-row" data-cc-card="${card.id}" aria-pressed="${card.id === this.selected?.id}">${art(card)}<span class="cc-row-copy"><b>${esc(card.monsterName)}</b><small>${CARD_KIND_LABELS[card.kind]} · ${esc(card.slotLabel)} · ${cardPercent(card.chance)}</small><span class="cc-row-badges">${count.collected ? '<em>ค้นพบแล้ว</em>' : '<span>ยังไม่ค้นพบ</span>'}${card.mapBoss ? '<em>บอสแผนที่</em>' : ''}${card.special ? '<em class="cc-special-badge">อาคมพิเศษ</em>' : ''}${!card.available ? '<span>ไม่มีแหล่งเกิด</span>' : ''}</span></span><span class="cc-owned" aria-label="มีอยู่ ${count.owned} ใบ">${count.owned ? `×${count.owned}` : '—'}</span></button>`;
    }).join('') || '<p class="cc-empty">ไม่พบการ์ด ลองเปลี่ยนคำค้นหาหรือล้างตัวกรอง</p>';
    host.scrollTop = scroll;
    if (focus) [...host.children].find(el => el.dataset.ccCard === focus)?.focus({ preventScroll: true });
    this.renderDetail(ownership);
  }
  renderDetail(ownership) {
    const host = this.$('#cc-detail'), card = this.selected;
    const sameCard = host.dataset.card === card?.id;
    const scroll = sameCard ? host.scrollTop : 0, active = document.activeElement;
    host.dataset.card = card?.id ?? '';
    const focusPlace = active?.dataset?.ccPlace, focusAction = host.contains(active) ? active?.dataset?.ccAction : null;
    if (!card) { host.innerHTML = '<p class="cc-empty">เลือกการ์ดจากรายชื่อเพื่ออ่านข้อมูล</p>'; return; }
    const count = ownership[card.id];
    host.innerHTML = `<header class="cc-detail-head">${art(card, true)}<div><small>${CARD_KIND_LABELS[card.kind]}${card.mapBoss ? ' · บอสแผนที่' : ''} · Lv.${card.level}</small><h3 tabindex="-1">${esc(card.name)}</h3><p>ใส่ใน${esc(card.slotLabel)} · ${count.collected ? 'เคยค้นพบแล้ว' : 'ยังไม่เคยค้นพบ'}</p></div></header>
      ${card.sharedArt ? '<p class="cc-note">ตราสัญลักษณ์การ์ด · ยังไม่มีภาพเฉพาะของการ์ดนี้</p>' : ''}
      <div class="cc-counts"><span>มีอยู่ทั้งหมด<b>${fmt(count.owned)}</b></span><span>การ์ดในกระเป๋า<b>${fmt(count.loose)}</b></span><span>ใส่กับอุปกรณ์แล้ว<b>${fmt(count.socketed)}</b></span><span>สวมใส่อยู่<b>${fmt(count.wornSockets)}</b></span></div>
      <p class="cc-note">ใส่ในอุปกรณ์ที่เก็บในกระเป๋า ${fmt(count.bagSockets)} ใบ · การสะสมเป็นประวัติ ไม่ใช่โบนัสเพิ่ม</p>
      <h4>พลังที่ได้รับเมื่อสวมใส่</h4><ul class="cc-bonuses">${card.bonusLines.map(line => `<li>${esc(line.text)}</li>`).join('')}</ul>
      ${card.role ? `<p class="cc-note cc-role"><b>${esc(card.role.name)}</b> · ${esc(card.role.brief)}</p>` : ''}
      ${card.special ? `<section class="cc-special"><small>อาคมพิเศษ</small><h4>${esc(card.specialText.name)}</h4>${card.specialText.description ? `<p>${esc(card.specialText.description)}</p>` : '<p>การ์ดนี้มีอาคมพิเศษ รายละเอียดจะปรากฏจากกติกาอาคมของการ์ด</p>'}</section>` : ''}
      <h4>อัตราดรอป <strong>${cardPercent(card.chance)}</strong></h4><p class="cc-note">สุ่มแยกต่อการกำจัด ไม่รับประกันว่าจะได้ภายในจำนวนครั้งใด</p>
      <h4>แหล่งล่าและเส้นทาง</h4>${card.available ? `<div class="cc-locations">${card.locations.map((location, index) => {
        const copy = `<b>${esc(location.name)}</b><small>${esc(MAPS[location.map]?.name)} · ${location.phases.length === 4 ? 'ตลอดวัน' : esc(location.phases.join(' / ') || 'ตามเวลาเกิด')}${location.respawn ? ` · เกิดใหม่ ${location.respawn} วินาที` : ''}</small>`;
        return this.locate ? `<button type="button" data-cc-place="${index}"><span>${copy}</span><span>ดูเส้นทาง ↗</span></button>` : `<div>${copy}</div>`;
      }).join('')}</div>` : '<p class="cc-unavailable">ยังไม่มีแหล่งเกิดในโลกปัจจุบัน จึงยังไม่มีเส้นทางล่าการ์ดนี้</p>'}
      ${this.openGuideAction ? '<button type="button" class="cc-action" data-cc-action="bag">จัดการการ์ดในกระเป๋า ↗</button>' : ''}`;
    host.scrollTop = scroll;
    if (focusPlace !== undefined) host.querySelector(`[data-cc-place="${focusPlace}"]`)?.focus({ preventScroll: true });
    else if (focusAction) host.querySelector(`[data-cc-action="${focusAction}"]`)?.focus({ preventScroll: true });
  }
  renderGuide() {
    this.$('#cc-guide').innerHTML = `<header class="cc-guide-intro"><small>ก่อนออกจากประตูเมือง</small><h3>อ่านทาง เตรียมยา รู้ความเสี่ยง</h3><p>คู่มือจากกติกาที่ใช้อยู่ในโลกเกม เลือกอ่านเรื่องที่ต้องการก่อนออกล่า</p></header>${PLAYER_GUIDE.map(section => {
      const actions = section.actions ?? (section.action ? [{ action: section.action, label: section.actionLabel }] : []);
      return `<section class="cc-guide-section"><h4><span aria-hidden="true">${section.icon}</span>${esc(section.title)}</h4>${section.lines.map(line => `<p>${esc(line)}</p>`).join('')}${this.openGuideAction ? `<div class="cc-guide-actions">${actions.filter(a => GUIDE_ACTIONS.includes(a.action)).map(a => `<button type="button" class="cc-action" data-cc-action="${a.action}">${esc(a.label)} ↗</button>`).join('')}</div>` : ''}</section>`;
    }).join('')}`;
  }
}
