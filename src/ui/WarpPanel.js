import { WARP_DESTINATIONS, getWarpService, getWarpDestination, WARP_RANGE } from '../data/warpServices.js';
import './warp.css';

const WHY = {
  far: 'เข้าใกล้เจ้าหน้าที่วาร์ปก่อนครับ', map: 'เจ้าหน้าที่อยู่คนละแผนที่', offline: 'รอเชื่อมต่อเซิร์ฟเวอร์ก่อนเดินทาง', blocked: 'จุดลงยังไม่พร้อม กรุณาเลือกจุดหมายอื่น',
  npc: 'ไม่พบเจ้าหน้าที่วาร์ป', destination: 'ไม่พบจุดหมายนี้', dead: 'ต้องฟื้นก่อนเดินทาง',
  busy: 'พ้นการต่อสู้ ดวล หรือแลกของก่อนเดินทาง', cooldown: 'รออีกสักครู่แล้วเดินทางใหม่',
  full: 'แผนที่ปลายทางเต็ม กรุณาลองอีกครั้ง', same: 'คุณอยู่ที่จุดหมายนี้แล้ว',
};
const emblem = '<svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><circle cx="24" cy="24" r="18"/><path d="M24 3v8m0 26v8M3 24h8m26 0h8M24 12l5 7 7 5-7 5-5 7-5-7-7-5 7-5z"/><circle cx="24" cy="24" r="4"/></svg>';

// NPC services are the only entry point. Selecting a row never moves a player;
// the server approves a fixed destination after the explicit travel action.
export class WarpPanel {
  constructor({ map, position, level, prepare, note }) {
    Object.assign(this, { map, position, level, prepare, note });
    this.root = document.createElement('div'); this.root.id = 'warp-overlay'; this.root.className = 'warp-overlay'; this.root.hidden = true;
    this.root.innerHTML = `<section class="warp-panel" role="dialog" aria-modal="true" aria-labelledby="warp-title">
      <header class="warp-head"><span class="warp-seal">${emblem}</span><div><small>เครือข่ายศาลาพักทาง</small><h2 id="warp-title">เดินทางด้วยอาคม</h2><p id="warp-keeper"></p></div><button type="button" id="warp-close" aria-label="ปิดบริการวาร์ป">×</button></header>
      <div class="warp-body"><div class="warp-destinations"><nav class="warp-tabs" aria-label="ประเภทจุดหมาย"><button type="button" data-warp-tab="city" aria-pressed="true">จุดสำคัญในเมือง <small>6</small></button><button type="button" data-warp-tab="field" aria-pressed="false">แผนที่ผจญภัย <small>12</small></button></nav><label class="warp-search">ค้นหาจุดหมาย<input id="warp-search" type="search" placeholder="ชื่อแผนที่หรือบริการ…" autocomplete="off"></label><div id="warp-list" role="group" aria-label="จุดหมายเดินทาง"></div></div>
      <aside class="warp-summary"><div class="warp-art">${emblem}<span>อาคมเชื่อมทาง</span></div><small>จุดหมายที่เลือก</small><h3 id="warp-destination">เลือกจุดหมาย</h3><p id="warp-detail">ให้ศาลาพักทางพาคุณไปยังตลาด สำนักครู หรือแผนที่ผจญภัย</p><span id="warp-level"></span><p id="warp-warning" hidden></p><div class="warp-cost"><span>ค่าเดินทาง</span><b>ฟรี</b></div><p id="warp-status" role="status" aria-live="polite">เลือกจุดหมาย แล้วกดเดินทาง</p><button type="button" id="warp-go" disabled>เดินทางไปที่นี่ <span>↗</span></button><small class="warp-footnote">เปิดบริการตลอดวัน · ลงที่ลานพักใกล้ทางเข้า</small></aside></div>
    </section>`;
    (document.getElementById('app') ?? document.body).append(this.root);
    this.$ = selector => this.root.querySelector(selector);
    this.$('#warp-close').addEventListener('click', () => this.close());
    this.root.addEventListener('click', e => {
      if (e.target === this.root) this.close();
      const tab = e.target.closest('[data-warp-tab]');
      if (tab && !this.pending) { this.category = tab.dataset.warpTab; this.renderList(); }
      const row = e.target.closest('[data-warp-destination]');
      if (row && !this.pending) this.select(row.dataset.warpDestination);
    });
    this.$('#warp-search').addEventListener('input', () => this.renderList());
    this.$('#warp-go').addEventListener('click', () => this.travel());
    // Keep keyboard focus in this modal, including on short mobile landscapes.
    this.root.addEventListener('keydown', e => {
      if (e.key !== 'Tab') return;
      const controls = [...this.root.querySelectorAll('button:not(:disabled), input')].filter(el => el.getClientRects().length);
      const first = controls[0], last = controls.at(-1);
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
  }
  get open() { return !this.root.hidden; }
  connect(net) {
    this.net = net;
    net.on('service_warp_no', m => { if (this.pending) this.finish(WHY[m.why] ?? 'ยังเดินทางไม่ได้ กรุณาลองอีกครั้ง'); })
      .on('position', m => { if (this.pending && m.reason === 'service_warp') { this.finish(); this.close(); this.note(`ถึง ${getWarpDestination(m.destination)?.name ?? 'จุดหมาย'} แล้ว`); } })
      .on('status', on => { if (!on && this.pending) this.finish('การเชื่อมต่อขาด รอเชื่อมต่ออีกครั้งก่อนเดินทาง'); else if (this.open) this.renderSelection(); });
  }
  show(npc) {
    const service = getWarpService(npc.id);
    if (!service) return;
    this.previousFocus = document.activeElement; this.service = service; this.selected = null; this.category = this.map() === 'city' ? 'city' : 'field';
    this.$('#warp-search').value = ''; this.$('#warp-keeper').textContent = `${service.name} · ${this.map() === 'city' ? 'นครอโยธยา' : 'ศาลาพักทาง'}`;
    this.root.hidden = false; this.renderList(); this.renderSelection(); this.$('#warp-close').focus();
  }
  close() { this.root.hidden = true; this.previousFocus?.focus?.({ preventScroll: true }); }
  renderList() {
    const focused = document.activeElement?.dataset?.warpDestination;
    const q = this.$('#warp-search').value.trim().normalize('NFC').toLocaleLowerCase('th');
    for (const tab of this.root.querySelectorAll('[data-warp-tab]')) tab.setAttribute('aria-pressed', String(tab.dataset.warpTab === this.category));
    const entries = WARP_DESTINATIONS.filter(d => d.category === this.category && (!q || `${d.name} ${d.detail}`.toLocaleLowerCase('th').includes(q)));
    const list = this.$('#warp-list'), scroll = list.scrollTop; list.replaceChildren();
    for (const d of entries) {
      const row = document.createElement('button'); row.type = 'button'; row.className = 'warp-row'; row.dataset.warpDestination = d.id; row.disabled = !!this.pending;
      row.setAttribute('aria-pressed', String(this.selected?.id === d.id));
      const icon = document.createElement('span'); icon.className = 'warp-row-icon'; icon.innerHTML = emblem;
      const label = document.createElement('span'), title = document.createElement('b'), sub = document.createElement('small');
      title.textContent = d.name; sub.textContent = d.category === 'city' ? d.detail : `Lv ${d.levels[0]}–${d.levels[1]}${d.levels[0] >= 23 ? ' · แนะนำปาร์ตี้' : ''}`;
      label.append(title, sub); row.append(icon, label); list.append(row);
    }
    if (!entries.length) { const empty = document.createElement('p'); empty.className = 'warp-empty'; empty.textContent = 'ไม่พบจุดหมาย ลองค้นหาชื่ออื่น'; list.append(empty); }
    list.scrollTop = scroll;
    if (focused && !this.pending) [...list.children].find(el => el.dataset.warpDestination === focused)?.focus({ preventScroll: true });
  }
  select(id) { this.selected = getWarpDestination(id); this.renderList(); this.renderSelection(); }
  renderSelection() {
    const d = this.selected;
    this.$('#warp-destination').textContent = d?.name ?? 'เลือกจุดหมาย';
    this.$('#warp-detail').textContent = d?.detail ?? 'ให้ศาลาพักทางพาคุณไปยังตลาด สำนักครู หรือแผนที่ผจญภัย';
    this.$('#warp-level').textContent = d?.levels ? `เลเวลแนะนำ ${d.levels[0]}–${d.levels[1]}` : d ? 'พื้นที่ปลอดภัย' : '';
    const warning = this.$('#warp-warning'), low = d?.levels && this.level() < d.levels[0];
    warning.hidden = !low; warning.textContent = low ? `คุณเลเวล ${this.level()} · มอนสเตอร์ที่นี่แข็งแกร่งกว่า ควรเตรียมเสบียงและปาร์ตี้` : '';
    this.$('#warp-go').disabled = !d || !!this.pending || !this.net?.online;
    this.$('#warp-go').firstChild.textContent = this.pending ? 'กำลังเดินทาง… ' : 'เดินทางไปที่นี่ ';
    if (!this.pending) this.$('#warp-status').textContent = this.net?.online ? 'เลือกจุดหมาย แล้วกดเดินทาง' : 'รอเชื่อมต่อเซิร์ฟเวอร์ก่อนเดินทาง';
  }
  travel() {
    if (!this.selected || this.pending || !this.net?.online) return;
    const p = this.position();
    if (this.map() !== this.service.map || Math.hypot(p.x - this.service.x, p.z - this.service.z) > WARP_RANGE) {
      this.$('#warp-status').textContent = WHY.far; return;
    }
    this.prepare(); this.pending = true; this.renderList(); this.renderSelection();
    this.$('#warp-status').textContent = 'ศาลาพักทางกำลังเปิดทางให้คุณ…';
    this.net.send({ t: 'service_warp', npc: this.service.npcId, destination: this.selected.id });
    this.timer = setTimeout(() => this.finish('ยังไม่ได้รับการยืนยัน กรุณาลองอีกครั้งเมื่อเชื่อมต่อแล้ว'), 8000);
  }
  finish(message) {
    clearTimeout(this.timer); this.pending = false; this.renderList(); this.renderSelection();
    if (message) { this.$('#warp-status').textContent = message; if (!this.open) this.note(message); }
  }
}
