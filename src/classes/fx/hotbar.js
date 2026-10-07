import { assetIcon } from '../../ui/icons.js';
// Skill hotbar: ten slots (keys 1–0) with icon, cooldown sweep and a tooltip,
// plus an Auto toggle that keeps casting the next ready skill on the dummy.
// list: [{ id, name, lv, cd, desc, icon }] in bar order (see classes.js).
import './fx.css';
export function createHotbar(host, skills, list, label = 'สกิล') {
  const bar = document.createElement('nav'); bar.className = 'hotbar ro-window panel'; bar.setAttribute('aria-label', label);
  const row = document.createElement('div'); row.className = 'hotbar-row'; bar.appendChild(row);
  const cd = new Map(); let auto = false, next = 0, autoWait = .4, tipFor = null;
  const tip = document.createElement('div'); tip.className = 'hotbar-tip ro-window'; tip.hidden = true; host.appendChild(tip);

  const slots = list.map((s, i) => {
    const meta = s, b = document.createElement('button');
    b.type = 'button'; b.className = 'hotbar-slot' + (meta.lv >= 20 ? ' adv' : ''); b.setAttribute('aria-label', `${s.name} (ปุ่ม ${(i + 1) % 10})`);
    b.innerHTML = `${assetIcon(s.icon)}<span class="key">${(i + 1) % 10}</span><span class="cd"></span><span class="cdt"></span>`;
    b.addEventListener('click', () => cast(i));
    b.addEventListener('pointerenter', () => showTip(i, b)); b.addEventListener('pointerleave', () => { tip.hidden = true; tipFor = null; });
    b.addEventListener('focus', () => showTip(i, b)); b.addEventListener('blur', () => { tip.hidden = true; });
    if (i === 6) { const sep = document.createElement('span'); sep.className = 'hotbar-sep'; row.appendChild(sep); }
    row.appendChild(b); return b;
  });
  const autoBtn = document.createElement('button'); autoBtn.type = 'button'; autoBtn.className = 'ro-button hotbar-auto'; autoBtn.setAttribute('aria-pressed', 'false');
  autoBtn.innerHTML = '<b>AUTO</b><small>สกิลอัตโนมัติ</small>'; autoBtn.title = 'ใช้สกิลที่พร้อมวนไปเรื่อย ๆ (ปุ่ม Q)';
  autoBtn.addEventListener('click', () => setAuto(!auto)); bar.appendChild(autoBtn);
  host.appendChild(bar);

  function showTip(i, b) {
    const s = list[i], m = s; tipFor = i;
    tip.innerHTML = `<div class="ro-title">${s.name}<span>Lv.${m.lv}</span></div><p>${m.desc}</p><small>คูลดาวน์ ${m.cd} วิ · ปุ่ม ${(i + 1) % 10}</small>`;
    tip.hidden = false; const r = b.getBoundingClientRect(), hr = host.getBoundingClientRect();
    tip.style.left = Math.max(8, Math.min(hr.width - 228, r.left - hr.left + r.width / 2 - 110)) + 'px'; tip.style.bottom = (hr.bottom - r.top + 8) + 'px';
  }
  function setAuto(on) { auto = on; autoBtn.setAttribute('aria-pressed', String(on)); autoBtn.classList.toggle('on', on); autoWait = .2; }
  function cast(i, fromAuto = false) {
    const s = list[i]; if ((cd.get(s.id) ?? 0) > 0 || skills.busy) return false;
    if (!fromAuto && auto) setAuto(false); // a manual cast takes control back
    const ok = skills.cast(s.id, fromAuto); if (ok === false) return false;
    cd.set(s.id, s.cd); slots[i].classList.add('fire'); setTimeout(() => slots[i].classList.remove('fire'), 250);
    return true;
  }
  return {
    cast, setAuto, get auto() { return auto; }, toggleAuto: () => setAuto(!auto),
    update(dt, playerMoving) {
      for (const [id, v] of cd) cd.set(id, Math.max(0, v - dt));
      list.forEach((s, i) => {
        const left = cd.get(s.id) ?? 0, total = s.cd, b = slots[i];
        b.style.setProperty('--cd', left > 0 ? left / total : 0); b.classList.toggle('cooling', left > 0);
        b.querySelector('.cdt').textContent = left > 0 ? (left >= 10 ? Math.ceil(left) : left.toFixed(1)) : '';
      });
      if (!auto || skills.busy || playerMoving) return;
      autoWait -= dt; if (autoWait > 0) return;
      // Next skill in bar order that is off cooldown.
      for (let k = 0; k < slots.length; k++) { const i = (next + k) % slots.length; if (cast(i, true)) { next = i + 1; autoWait = .35; return; } }
      autoWait = .8;
    },
  };
}
