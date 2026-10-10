import { ITEMS } from '../character/data/items.js';
import { instanceName, instanceQuality } from '../character/itemPresentation.js';
import { affixLines } from '../character/data/affixes.js';
import { STASH_CAPACITY, stashIdentity, cleanStashMove } from '../data/stash.js';
import { getWarpService } from '../data/warpServices.js';
import { readSession } from '../account/session.js';
import { iconHtml } from './icons.js';
import './player-guide.css';
import './storage.css';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const affixSummary = s => affixLines(s?.id, s?.roll).map(a => `${a.label} T${a.tier}: ${a.key.toUpperCase()} +${a.key === 'crit' ? `${+(a.value * 100).toFixed(2)}%` : a.value}`).join(' · ');
const WHY = { offline: 'คลังร่วมใช้ได้เมื่อเข้าสู่ระบบด้วยบัญชีและเชื่อมต่อแล้ว', npc: 'คลังร่วมเปิดที่ศาลาพักทางในเมือง', far: 'เข้าใกล้เจ้าหน้าที่ก่อนใช้คลัง', map: 'กลับมาที่ศาลาพักทางในเมืองก่อน', blocked: 'ต้องอยู่ด้านเดียวกับเจ้าหน้าที่', dead: 'ฟื้นก่อนใช้คลัง', busy: 'พ้นการต่อสู้ ดวล หรือแลกของก่อนใช้คลัง', stale: 'ข้อมูลคลังเปลี่ยนแล้ว กรุณาเลือกไอเทมอีกครั้ง', item_changed: 'ไอเทมในกระเป๋าเปลี่ยนแล้ว กรุณาเลือกใหม่', stash_full: 'คลังเต็ม ฝากไม่ได้', bag_full: 'กระเป๋าเต็ม ถอนของไม่ได้', overweight: 'ถอนแล้วน้ำหนักเกิน ลดของในกระเป๋าก่อน', no_materials: 'ไม่มีวัตถุดิบที่ปลดล็อกในกระเป๋า', quantity: 'จำนวนไอเทมเปลี่ยนแล้ว กรุณาเลือกใหม่', item: 'ไม่สามารถย้ายไอเทมนี้ได้', invalid: 'รายการย้ายไม่ถูกต้อง กรุณาเปิดคลังอีกครั้ง' };

const pendingKey = () => {
  try {
    const s = readSession();
    return s?.guest === false && s.id && Number.isInteger(s.slot) && s.slot >= 0
      ? `tno.stash.pending.v1/${encodeURIComponent(s.id)}/${s.slot}` : null;
  } catch { return null; }
};
const pendingMessage = m => {
  const move = cleanStashMove(m), service = getWarpService(m?.npc);
  return m?.t === 'stash_move' && move && service?.map === 'city' ? { t: 'stash_move', npc: m.npc, ...move } : null;
};

// Transfers never mutate the browser's bag. Result + vault + authoritative
// character arrive together; uncertain requests keep their identity for retry.
export class StoragePanel {
  constructor({ character, prepare, note }) {
    Object.assign(this, { character, prepare, note });
    this.restorePending();
    this.root = document.createElement('div'); this.root.id = 'storage-overlay'; this.root.className = 'qol-overlay'; this.root.hidden = true;
    this.root.innerHTML = `<section class="guide-panel storage-panel" role="dialog" aria-modal="true" aria-labelledby="storage-title"><header class="guide-head"><div><small>ศาลาพักทาง · คลังประจำบัญชี</small><h2 id="storage-title">คลังร่วม</h2><p>ใช้ของร่วมกันระหว่างตัวละคร · 120 ช่อง · ฝากถอนฟรี</p></div><button type="button" data-storage-close aria-label="ปิดคลังร่วม">×</button></header><div class="storage-toolbar"><label>ค้นหาไอเทม<input type="search" id="storage-search" placeholder="ชื่อไอเทม…"></label><button type="button" id="storage-materials">ฝากวัตถุดิบทั้งหมด</button></div><div class="storage-columns"><section><h3>กระเป๋าของคุณ <small id="storage-weight"></small></h3><div id="storage-bag" class="storage-items"></div></section><section><h3>คลังประจำบัญชี <small id="storage-used"></small></h3><div id="storage-vault" class="storage-items"></div></section></div><footer class="storage-footer"><div><b id="storage-selected">เลือกไอเทมเพื่อฝากหรือถอน</b><small id="storage-status" role="status" aria-live="polite">กำลังเปิดคลัง…</small></div><label>จำนวน<input id="storage-qty" type="number" value="1" min="1" step="1" inputmode="numeric"></label><button type="button" id="storage-move" disabled>เลือกไอเทม</button><button type="button" id="storage-retry" hidden>ตรวจสอบ / ลองใหม่</button></footer></section>`;
    (document.getElementById('app') ?? document.body).append(this.root); this.$ = s => this.root.querySelector(s);
    this.root.addEventListener('click', e => {
      if (e.target === this.root || e.target.closest('[data-storage-close]')) this.close();
      const row = e.target.closest('[data-storage-item]');
      if (row && !this.pending) { this.selected = { side: row.dataset.storageSide, key: row.dataset.storageItem }; this.render(); }
    });
    this.$('#storage-search').addEventListener('input', () => this.render());
    this.$('#storage-materials').addEventListener('click', () => this.move('deposit_materials'));
    this.$('#storage-move').addEventListener('click', () => this.move());
    this.$('#storage-retry').addEventListener('click', () => this.retry());
    this.root.addEventListener('keydown', e => {
      if (e.key !== 'Tab') return;
      const focus = [...this.root.querySelectorAll('button:not(:disabled),input:not(:disabled)')].filter(el => el.getClientRects().length);
      if (e.shiftKey && document.activeElement === focus[0]) { e.preventDefault(); focus.at(-1).focus(); }
      else if (!e.shiftKey && document.activeElement === focus.at(-1)) { e.preventDefault(); focus[0].focus(); }
    });
  }
  get open() { return !this.root.hidden; }
  connect(net) {
    this.net = net;
    this.offServerSync?.();
    this.offServerSync = this.character()?.on('server-sync', () => {
      const p = this.pending;
      if (p && !this.pendingSessionMatches()) { this.requireSignIn(); return; }
      if (p?.awaitingSignIn) { this.retry(); return; }
      if (p?.result && p.result.request === p.message.request) p.sync = true;
      this.finish(); if (this.open) this.render();
    });
    net.on('stash', m => { this.vault = m; if (this.pending?.result) this.pending.vault = true; else if (!this.pending) this.status = 'พร้อมฝากถอน · ฝากวัตถุดิบทั้งหมดจะข้ามของที่ล็อกไว้'; this.finish(); if (this.open) this.render(); })
      .on('stash_result', m => {
        if (!this.pending) { this.status = WHY[m.why] ?? 'ยังเปิดคลังไม่ได้ กรุณาลองอีกครั้ง'; if (this.open) this.render(); return; }
        if (m.request !== this.pending.message.request) return;
        if (!m.ok && m.why === 'storage_unavailable') { this.uncertain('ยังยืนยันการเซฟไม่ได้ ตรวจสอบรายการเดิมได้โดยไม่ย้ายซ้ำ'); return; }
        if (!m.ok && m.why === 'offline') {
          this.pending.awaitingSignIn = true; this.pending.result = null;
          this.pending.sync = this.pending.vault = false; this.vault = null;
          this.requireSignIn(); return;
        }
        this.pending.result = m; this.finish();
      })
      .on('status', on => {
        if (!on) { this.vault = null; if (this.pending) this.uncertain('การเชื่อมต่อขาด รอยืนยันรายการเดิมเมื่อเชื่อมต่อใหม่'); else this.status = WHY.offline; }
        else if (this.pending) this.retry();
        else if (this.open) this.requestOpen();
        if (this.open) this.render();
      });
  }
  show(npc) {
    if (!npc.def.storageService) return;
    this.previousFocus = document.activeElement; this.prepare(); this.npc = npc.id; this.selected = null; this.vault = null;
    if (this.pending && getWarpService(npc.id)?.map === 'city') {
      this.pending.message = { ...this.pending.message, npc: npc.id }; this.persistPending();
    }
    this.root.hidden = false; this.$('#storage-search').value = '';
    if (this.pending) this.uncertain('รายการก่อนหน้ายังรอยืนยัน กดตรวจสอบก่อนย้ายของเพิ่ม'); else this.requestOpen();
    this.render(); this.$('[data-storage-close]').focus();
  }
  requestOpen() { this.status = this.net?.online ? 'กำลังเปิดคลัง…' : WHY.offline; if (this.net?.online) this.net.send({ t: 'stash_open', npc: this.npc }); }
  close() { this.root.hidden = true; this.previousFocus?.focus?.({ preventScroll: true }); }
  item() { return this.selected?.side === 'bag' ? this.character()?.inventory[Number(this.selected.key)] : this.vault?.slots.find(s => s?.uid === this.selected?.key); }
  render() {
    const c = this.character(); if (!c) return;
    const q = this.$('#storage-search').value.trim().normalize('NFC').toLocaleLowerCase('th');
    for (const side of ['bag', 'vault']) {
      const host = this.$(`#storage-${side}`), scroll = host.scrollTop, focused = document.activeElement?.dataset?.storageItem;
      const items = side === 'bag' ? c.inventory : this.vault?.slots ?? [];
      host.innerHTML = items.map((s, i) => {
        const d = ITEMS[s?.id]; if (!d || (q && !instanceName(s).toLocaleLowerCase('th').includes(q))) return '';
        const key = side === 'bag' ? String(i) : s.uid;
        return `<button type="button" class="storage-item" data-storage-side="${side}" data-storage-item="${key}" aria-pressed="${this.selected?.side === side && this.selected.key === key}" ${this.pending ? 'disabled' : ''}>${iconHtml(d)}<span><b>${esc(instanceName(s))}</b><small>${s.locked ? '🔒 ล็อกไว้ · ' : ''}${s.cards?.length ? `${s.cards.length} การ์ด · ` : ''}${side === 'bag' ? 'ฝาก' : 'ถอน'}</small>${instanceQuality(s) ? `<small>${esc(instanceQuality(s))}</small>` : ''}</span><strong>×${s.qty.toLocaleString('th-TH')}</strong></button>`;
      }).join('') || `<p class="storage-empty">${side === 'vault' && !this.vault ? this.status : q ? 'ไม่พบไอเทมนี้' : 'ยังไม่มีไอเทม'}</p>`;
      host.scrollTop = scroll; if (focused) [...host.children].find(el => el.dataset.storageItem === focused)?.focus({ preventScroll: true });
    }
    this.$('#storage-weight').textContent = `${Math.round(c.weight * 10) / 10} / ${c.maxWeight}`;
    this.$('#storage-used').textContent = `${this.vault?.slots.filter(Boolean).length ?? '–'} / ${STASH_CAPACITY}`;
    const s = this.item(), d = ITEMS[s?.id], ready = !!(this.vault && this.net?.online && !this.pending);
    this.$('#storage-selected').textContent = d ? `${this.selected.side === 'bag' ? 'ฝาก' : 'ถอน'} ${instanceName(s)}${s.locked ? ' · ยังคงล็อกไว้' : ''}` : 'เลือกไอเทมเพื่อฝากหรือถอน';
    if (d && s.roll) this.$('#storage-selected').textContent += ` · ${affixSummary(s)}`;
    this.$('#storage-qty').disabled = !ready || !s; this.$('#storage-qty').max = String(s?.qty ?? 1);
    this.$('#storage-qty').value = String(Math.min(s?.qty ?? 1, Math.max(1, Number(this.$('#storage-qty').value) || 1)));
    this.$('#storage-materials').disabled = !ready || !c.inventory.some(s => s && !s.locked && ITEMS[s.id]?.type === 'material');
    this.$('#storage-move').disabled = !ready || !s; this.$('#storage-move').textContent = this.pending ? 'กำลังยืนยัน…' : s ? this.selected.side === 'bag' ? 'ฝากเข้าคลัง' : 'ถอนเข้ากระเป๋า' : 'เลือกไอเทม';
    this.$('#storage-retry').hidden = !this.pending?.uncertain; this.$('#storage-retry').disabled = !this.net?.online;
    this.$('#storage-status').textContent = this.status ?? 'พร้อมฝากถอน · ฝากวัตถุดิบทั้งหมดจะข้ามของที่ล็อกไว้';
  }
  move(action) {
    if (this.pending || !this.vault || !this.net?.online) return;
    const s = this.item(), qty = Number(this.$('#storage-qty').value);
    if (action !== 'deposit_materials' && (!s || !Number.isSafeInteger(qty) || qty < 1 || qty > s.qty)) { this.status = WHY.quantity; this.render(); return; }
    const message = { t: 'stash_move', npc: this.npc, request: crypto.randomUUID(), revision: this.vault.revision, action: action ?? (this.selected.side === 'bag' ? 'deposit' : 'withdraw'), ...(action === 'deposit_materials' ? {} : this.selected.side === 'bag' ? { index: Number(this.selected.key), expected: stashIdentity(s), qty } : { uid: s.uid, qty }) };
    this.pendingStorageKey = pendingKey(); this.pending = { message }; this.retry();
  }
  retry() {
    if (!this.pending || !this.net?.online) return;
    if (!this.pendingSessionMatches()) { this.requireSignIn(); return; }
    this.pending.uncertain = false; this.pending.awaitingSignIn = false; this.pending.result = null; this.pending.vault = this.pending.sync = false;
    this.persistPending();
    this.status = 'กำลังยืนยันการย้ายกับคลัง…'; this.net.send(this.pending.message);
    clearTimeout(this.timer); this.timer = setTimeout(() => this.uncertain('ยังรอยืนยันรายการเดิม ตรวจสอบได้โดยไม่ย้ายซ้ำ'), 8000); this.render();
  }
  uncertain(text) { if (!this.pending) return; clearTimeout(this.timer); this.pending.uncertain = true; this.status = text; if (this.open) this.render(); }
  pendingSessionMatches() { return !this.pendingStorageKey || this.pendingStorageKey === pendingKey(); }
  requireSignIn() {
    if (!this.pending) return;
    this.pending.awaitingSignIn = true;
    this.uncertain(`${WHY.offline} · เข้าสู่ระบบด้วยบัญชีและช่องตัวละครเดิมเพื่อยืนยันรายการเดิมโดยไม่ย้ายซ้ำ`);
  }
  restorePending() {
    this.pendingStorageKey = pendingKey(); if (!this.pendingStorageKey) return;
    try {
      const raw = globalThis.sessionStorage?.getItem(this.pendingStorageKey);
      if (!raw) return;
      const message = raw.length <= 4096 && pendingMessage(JSON.parse(raw));
      if (!message) { globalThis.sessionStorage?.removeItem(this.pendingStorageKey); return; }
      this.pending = { message, uncertain: true, awaitingSignIn: true };
      this.status = 'รายการก่อนหน้ายังรอยืนยัน เปิดคลังเพื่อยืนยันรายการเดิมโดยไม่ย้ายซ้ำ';
    } catch { /* Keep transfers usable when tab storage is blocked or corrupt. */ }
  }
  persistPending() {
    if (!this.pending) return;
    this.pendingStorageKey ??= pendingKey(); if (!this.pendingStorageKey) return;
    const message = pendingMessage(this.pending.message); if (!message) return;
    try { globalThis.sessionStorage?.setItem(this.pendingStorageKey, JSON.stringify(message)); } catch { /* Retry in memory. */ }
  }
  finish() {
    const p = this.pending; if (!p?.result || !p.sync || (p.result.ok && !p.vault)) return;
    try { if (this.pendingStorageKey) globalThis.sessionStorage?.removeItem(this.pendingStorageKey); } catch { /* Storage can be blocked. */ }
    this.pendingStorageKey = null;
    clearTimeout(this.timer); this.pending = null; this.selected = null;
    this.status = p.result.ok ? `ย้ายสำเร็จ ${p.result.moved.toLocaleString('th-TH')} ชิ้น · เซฟแล้ว` : WHY[p.result.why] ?? 'ย้ายไม่ได้ กรุณาลองอีกครั้ง';
    if (!this.open) this.note(this.status); this.render();
  }
}
