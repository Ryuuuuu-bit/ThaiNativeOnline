// The one action bar, the same on every map and for every class (the hotbar look
// from src/classes/fx/fx.css): up to ten skills on keys 1–0, AUTO on G, then the
// potions (Q / F) and the character / bag buttons (C / I) from CharacterUI.
//
//   const bar = new ActionBar(host, { potions, menus });
//   bar.setSkills(controller, label)   swap the skills (class kit or legacy combat skills)
//   bar.handleKey(e) → bool             1–0 cast, G toggles AUTO
//   bar.update(dt)                      cooldown sweeps, MP / pending states, AUTO
//
// controller: {
//   slots: [{ id, name, icon? (image URL), html? (icon markup), lv?, cd, mp?, desc? }],
//   cast(i, quiet) → bool    quiet: AUTO is asking (no failure messages)
//   cooldown(i) → [left, total] seconds
//   usable(i) → bool         false dims the slot (not enough MP)
//   active(i) → bool         highlighted (walking in to cast, auto attack)
//   busy                     AUTO waits while true
// }
import '../classes/fx/fx.css';
import './actionbar.css';

export const AUTO_KEY = 'KeyG';
const keyLabel = i => String((i + 1) % 10);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

export class ActionBar {
  constructor(host, { potions = [], menus = [] } = {}) {
    this.host = host; this.ctl = null; this.slots = []; this.auto = false; this.next = 0; this.autoWait = .4;
    this.bar = el('nav', 'hotbar action-bar ro-window panel'); this.bar.setAttribute('aria-label', 'แถบสกิล');
    this.row = el('div', 'hotbar-row');
    this.autoBtn = el('button', 'ro-button hotbar-auto', '<b>AUTO <kbd>G</kbd></b><small>สกิลอัตโนมัติ</small>');
    this.autoBtn.type = 'button'; this.autoBtn.setAttribute('aria-pressed', 'false'); this.autoBtn.title = 'ใช้สกิลที่พร้อมวนไปเรื่อย ๆ กับเป้าหมาย (ปุ่ม G)';
    this.autoBtn.addEventListener('click', () => this.setAuto(!this.auto));
    this.bar.append(this.row, this.autoBtn);
    if (potions.length) this.bar.append(el('span', 'hotbar-sep'), el('div', 'action-items'));
    this.bar.querySelector('.action-items')?.append(...potions);
    if (menus.length) { const m = el('div', 'action-menus'); m.append(...menus); this.bar.append(m); }
    this.tip = el('div', 'hotbar-tip ro-window'); this.tip.hidden = true;
    host.append(this.bar, this.tip);
  }

  setSkills(controller, label) {
    this.ctl = controller; this.setAuto(false); this.next = 0;
    if (label) this.bar.setAttribute('aria-label', label);
    this.row.replaceChildren();
    this.slots = controller.slots.map((s, i) => {
      const b = el('button', 'hotbar-slot' + (s.lv >= 20 ? ' adv' : ''),
        `${s.icon ? `<img src="${s.icon}" alt="">` : `<span class="hotbar-glyph">${s.html ?? ''}</span>`}<span class="key">${keyLabel(i)}</span>${s.mp ? `<span class="mp">${s.mp}</span>` : ''}<span class="cd"></span><span class="cdt"></span>`);
      b.type = 'button'; b.setAttribute('aria-label', `${s.name} (ปุ่ม ${keyLabel(i)})`);
      b.addEventListener('click', () => this.cast(i));
      b.addEventListener('pointerenter', () => this.showTip(i, b)); b.addEventListener('pointerleave', () => this.hideTip());
      b.addEventListener('focus', () => this.showTip(i, b)); b.addEventListener('blur', () => this.hideTip());
      if (i === 6) this.row.append(el('span', 'hotbar-sep'));
      this.row.append(b);
      return { b, cdt: b.querySelector('.cdt') };
    });
  }

  showTip(i, b) {
    const s = this.ctl.slots[i], lines = [s.cd ? `คูลดาวน์ ${+s.cd.toFixed(1)} วิ` : 'ไม่มีคูลดาวน์', s.mp ? `MP ${s.mp}` : null, `ปุ่ม ${keyLabel(i)}`].filter(Boolean).join(' · ');
    this.tip.innerHTML = `<div class="ro-title">${s.name}${s.lv ? `<span>Lv.${s.lv}</span>` : ''}</div>${s.desc ? `<p>${s.desc}</p>` : ''}<small>${lines}</small>`;
    this.tip.hidden = false;
    const r = b.getBoundingClientRect(), hr = this.host.getBoundingClientRect();
    this.tip.style.left = Math.max(8, Math.min(hr.width - 228, r.left - hr.left + r.width / 2 - 110)) + 'px'; this.tip.style.bottom = (hr.bottom - r.top + 8) + 'px';
  }
  hideTip() { this.tip.hidden = true; }

  setAuto(on) { this.auto = on; this.autoBtn.setAttribute('aria-pressed', String(on)); this.autoBtn.classList.toggle('on', on); this.autoWait = .2; }
  toggleAuto() { this.setAuto(!this.auto); }

  cast(i, fromAuto = false) {
    if (!this.ctl || !this.slots[i]) return false;
    if (!fromAuto && this.auto) this.setAuto(false);   // a manual cast takes control back
    const ok = this.ctl.cast(i, fromAuto);
    if (ok) { const b = this.slots[i].b; b.classList.add('fire'); setTimeout(() => b.classList.remove('fire'), 250); }
    return !!ok;
  }

  handleKey(e) {
    if (e.repeat) return false;
    const m = /^Digit(\d)$/.exec(e.code);
    if (m) { const i = (Number(m[1]) + 9) % 10; if (!this.slots[i]) return false; this.cast(i); return true; }
    if (e.code === AUTO_KEY && this.ctl) { this.toggleAuto(); return true; }
    return false;
  }

  update(dt) {
    const ctl = this.ctl;
    if (!ctl) return;
    this.slots.forEach(({ b, cdt }, i) => {
      const [left, total] = ctl.cooldown(i);
      b.style.setProperty('--cd', left > 0 && total > 0 ? Math.min(1, left / total) : 0); b.classList.toggle('cooling', left > 0);
      cdt.textContent = left > 0 ? (left >= 10 ? Math.ceil(left) : left.toFixed(1)) : '';
      b.classList.toggle('nomp', !ctl.usable(i)); b.classList.toggle('active', !!ctl.active(i));
    });
    if (!this.auto || ctl.busy) return;
    if ((this.autoWait -= dt) > 0) return;
    // The next skill in bar order that is ready.
    for (let k = 0; k < this.slots.length; k++) {
      const i = (this.next + k) % this.slots.length;
      if (ctl.cooldown(i)[0] <= 0 && this.cast(i, true)) { this.next = i + 1; this.autoWait = .35; return; }
    }
    this.autoWait = .8;
  }
}
