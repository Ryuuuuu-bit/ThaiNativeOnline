import './siamsi.css';
import { siamsiCard, activeBlessing, canDrawBlessing, grantBlessing, modsText, BLESSING_HOURS } from '../character/blessing.js';

// ไหว้พระเสี่ยงเซียมซี (map ubosot): the window opened with F at the prayer rug or the siamsi
// stand. Signed-in characters ask the server (server/ubosot.js), which draws the card and
// keeps the once-a-day rule; guests draw locally into their own save.
//
//   new SiamsiPanel({ character, context, prepare, onPray })
//     context() → { online, authenticated, map, position }
//     prepare() closes other windows; onPray() plays the player's wai/kneel clip
//   connect(net)   listens for bless_result; show(siteId); close(); open
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const clock = ms => { const m = Math.max(0, Math.ceil(ms / 60000)); return `${Math.floor(m / 60)} ชม. ${m % 60} นาที`; };
const SHAKE_MS = 1400;

export class SiamsiPanel {
  constructor({ character, context, prepare = () => {}, onPray = () => {}, now = () => Date.now(), uuid = () => globalThis.crypto.randomUUID() } = {}) {
    Object.assign(this, { character, context, prepare, onPray, now, uuid });
    this.pending = null; this.revealAt = 0; this.message = ''; this.site = 'pray';
    this.root = el('div', 'siamsi'); this.root.hidden = true;
    this.dialog = el('section', 'siamsi-dialog'); this.dialog.tabIndex = -1;
    this.dialog.setAttribute('role', 'dialog'); this.dialog.setAttribute('aria-modal', 'true'); this.dialog.setAttribute('aria-label', 'ไหว้พระเสี่ยงเซียมซี');
    const head = el('header', 'siamsi-head');
    const titles = el('div'); titles.append(el('small', '', 'ภายในอุโบสถ'), el('h2', '', 'ไหว้พระ · เสี่ยงเซียมซี'));
    this.closeButton = el('button', 'siamsi-close', '✕'); this.closeButton.setAttribute('aria-label', 'ปิด');
    this.closeButton.addEventListener('click', () => this.close());
    head.append(titles, this.closeButton);
    this.info = el('p', 'siamsi-info', `จุดธูปไหว้พระแล้วเขย่ากระบอกเซียมซี ได้วันละ 1 ครั้ง พรอยู่ ${BLESSING_HOURS} ชั่วโมง ขอใบใหม่ได้หลังเที่ยงคืน`);
    this.cup = el('div', 'siamsi-cup'); this.cup.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < 9; i++) this.cup.append(el('i'));
    this.card = el('article', 'siamsi-card'); this.card.setAttribute('aria-live', 'polite');
    this.status = el('p', 'siamsi-status'); this.status.setAttribute('role', 'status');
    this.action = el('button', 'siamsi-action', 'จุดธูปไหว้พระ เสี่ยงเซียมซี');
    this.action.addEventListener('click', () => this.draw());
    this.dialog.append(head, this.info, this.cup, this.card, this.status, this.action);
    this.root.append(this.dialog); (document.getElementById('app') ?? document.body).append(this.root);
    this.root.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); this.close(); } });
    for (const type of ['pointerdown', 'pointerup', 'click', 'wheel', 'keyup']) this.root.addEventListener(type, e => e.stopPropagation());
  }
  get open() { return !this.root.hidden; }
  connect(net) {
    if (this.transport === net) return;
    this.transport = net;
    net.on('bless_result', m => { if (this.transport === net) this.receive(m); });
    net.on('status', online => { if (this.transport === net && !online) { this.pending = null; this.render(); } });
  }
  show(site = 'pray') {
    this.site = site; this.prepare(); this.message = ''; this.root.hidden = false; this.render(); this.action.focus();
    return true;
  }
  close() { this.root.hidden = true; }
  get blessing() { return this.character()?.blessing ?? null; }
  // Ask for today's card: the server when signed in, locally for a guest.
  draw() {
    const c = this.character(), ctx = this.context();
    if (!c || this.pending || this.revealAt > this.now()) return false;
    if (!canDrawBlessing(c.blessing, this.now())) { this.message = 'วันนี้เสี่ยงเซียมซีไปแล้ว มาใหม่หลังเที่ยงคืน'; this.render(); return false; }
    this.onPray();
    if (ctx.online && ctx.authenticated) {
      if (!this.transport?.online) { this.message = 'ยังเชื่อมต่อเซิร์ฟเวอร์ไม่ได้'; this.render(); return false; }
      this.pending = { t: 'bless', site: this.site, request: this.uuid() };
      this.transport.send(this.pending);
    } else {
      const r = grantBlessing(c, { now: this.now() });
      if (!r.ok) { this.message = 'วันนี้เสี่ยงเซียมซีไปแล้ว มาใหม่หลังเที่ยงคืน'; this.render(); return false; }
      c.save?.();
    }
    this.revealAt = this.now() + SHAKE_MS; this.message = 'กำลังเขย่ากระบอกเซียมซี…'; this.render();
    setTimeout(() => { this.message = ''; this.render(); }, SHAKE_MS + 20);
    return true;
  }
  receive(m) {
    if (!this.pending || m.request !== this.pending.request) return;
    this.pending = null;
    if (m.ok) {
      const c = this.character(); if (c && m.blessing) { c.blessing = { ...m.blessing }; c.emit?.('blessing', c.blessing); c.emit?.('change'); }
    } else {
      this.revealAt = 0;
      this.message = { today: 'วันนี้เสี่ยงเซียมซีไปแล้ว มาใหม่หลังเที่ยงคืน', far: 'เข้าไปยืนใกล้พระประธานก่อน', dead: 'ฟื้นคืนชีพก่อน', guest: 'ผู้เล่นทั่วไปต้องเข้าสู่ระบบก่อน' }[m.why] ?? 'ขอพรไม่สำเร็จ ลองอีกครั้ง';
    }
    this.render();
  }
  render() {
    if (!this.open) return;
    const now = this.now(), b = this.blessing, shaking = this.revealAt > now || !!this.pending;
    this.cup.classList.toggle('is-shaking', shaking);
    const card = !shaking && b ? siamsiCard(b.no) : null, live = card && activeBlessing(b, now);
    this.card.hidden = !card;
    if (card) {
      this.card.replaceChildren(
        el('h3', '', `ใบที่ ${card.no} · ${card.luck}`),
        el('p', 'siamsi-text', card.text),
        el('p', 'siamsi-mods', modsText(card.mods)),
        ...(card.advice ? [el('p', 'siamsi-advice', card.advice)] : []),
        el('p', 'siamsi-time', live ? `พรเหลือ ${clock(b.until - now)}` : 'พรหมดแล้ว'),
      );
      this.card.dataset.luck = card.luck;
    }
    const today = !canDrawBlessing(b, now);
    this.action.disabled = shaking || today;
    this.action.textContent = today ? 'วันนี้ขอพรแล้ว · มาใหม่หลังเที่ยงคืน' : 'จุดธูปไหว้พระ เสี่ยงเซียมซี';
    this.status.textContent = this.message;
  }
  update() { if (this.open) this.render(); }
}
