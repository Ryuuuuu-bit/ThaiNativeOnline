import { ACCOUNTS } from '../data/accounts.js';
import { CLASSES, CLASS_ALIASES } from '../character/data/classes.js';
import { el, esc } from '../character/ui/dom.js';
import { ModelPreview } from '../ui/ModelPreview.js';

// Login and character-select screens. Both are overlays over #app and resolve
// a Promise; src/account/index.js chains them before the world starts.

// → { id, guest }
export function showLogin(root, store) {
  return new Promise(resolve => {
    let mode = 'login';
    const overlay = el('section', 'acc-screen', `
      <form class="acc-card glass" novalidate>
        <span class="acc-seal" aria-hidden="true">ท</span>
        <span class="eyebrow">THAI NATIVE ONLINE</span>
        <h2>เข้าสู่ราชธานี</h2>
        <div class="acc-tabs" role="tablist">
          <button type="button" role="tab" data-mode="login">เข้าสู่ระบบ</button>
          <button type="button" role="tab" data-mode="register">สมัครบัญชี</button>
        </div>
        <label>ชื่อบัญชี<input name="id" autocomplete="username" maxlength="16" spellcheck="false" /></label>
        <label>รหัสผ่าน<input name="password" type="password" autocomplete="current-password" /></label>
        <label class="acc-confirm" hidden>ยืนยันรหัสผ่าน<input name="confirm" type="password" autocomplete="new-password" /></label>
        <p class="acc-error" role="alert" aria-live="polite"></p>
        <button type="submit" class="acc-primary">เข้าสู่ระบบ</button>
        <div class="acc-or"><span>หรือ</span></div>
        <button type="button" class="acc-guest">เล่นแบบผู้มาเยือน</button>
        <p class="acc-note">บัญชีเก็บไว้ในเบราว์เซอร์เครื่องนี้เท่านั้น (ยังไม่มีเซิร์ฟเวอร์)</p>
      </form>`);
    const form = overlay.querySelector('form'), error = overlay.querySelector('.acc-error'), submit = overlay.querySelector('.acc-primary');
    const field = n => form.elements.namedItem(n);
    field('id').value = store.lastId ?? '';
    const setMode = m => {
      mode = m; error.textContent = '';
      overlay.querySelectorAll('[data-mode]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.mode === m)));
      overlay.querySelector('.acc-confirm').hidden = m !== 'register';
      field('password').autocomplete = m === 'register' ? 'new-password' : 'current-password';
      field('id').placeholder = m === 'register' ? ACCOUNTS.idHint : '';
      submit.textContent = m === 'register' ? 'สมัครและเข้าเล่น' : 'เข้าสู่ระบบ';
    };
    overlay.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => setMode(b.dataset.mode)));
    const done = session => { overlay.remove(); resolve(session); };
    form.addEventListener('submit', async e => {
      e.preventDefault();
      if (mode === 'register' && field('password').value !== field('confirm').value) { error.textContent = 'รหัสผ่านทั้งสองช่องไม่ตรงกัน'; return; }
      submit.disabled = true; error.textContent = '';
      const r = mode === 'register' ? await store.register(field('id').value, field('password').value) : await store.login(field('id').value, field('password').value);
      submit.disabled = false;
      if (!r.ok) { error.textContent = r.msg; field('password').select(); return; }
      done({ id: r.id, guest: false });
    });
    overlay.querySelector('.acc-guest').addEventListener('click', () => done(store.guest()));
    // Game keys (1–0, WASD…) must not fire while typing.
    form.addEventListener('keydown', e => e.stopPropagation());
    setMode('login');
    root.append(overlay);
    (field('id').value ? field('password') : field('id')).focus();
  });
}

// → { slot, prefix, fresh } (fresh = empty slot → character creation), or null after logging out
export function showCharacterSelect(root, store, session, { onLogout } = {}) {
  return new Promise(resolve => {
    const overlay = el('section', 'acc-screen');
    // One 3D stage above the slots shows the character under the pointer / focus.
    const stage = el('div', 'acc-stage', '<span class="acc-stage-name"></span>');
    let preview = null;
    const leave = value => { preview?.dispose(); overlay.remove(); resolve(value); };
    const render = () => {
      const slots = store.slots(session.id);
      overlay.innerHTML = `
        <div class="acc-select">
          <span class="eyebrow">${session.guest ? esc(ACCOUNTS.guestName) : `บัญชี ${esc(session.id)}`}</span>
          <h2>เลือกผู้เดินทาง</h2>
          <div class="acc-stage-slot"></div>
          <div class="acc-slots">${slots.map(slotCard).join('')}</div>
          <button type="button" class="acc-logout">${session.guest ? 'กลับไปหน้าเข้าสู่ระบบ' : 'ออกจากระบบ'}</button>
        </div>`;
      const filled = slots.filter(s => s.character);
      const slotHost = overlay.querySelector('.acc-stage-slot');
      if (filled.length) {
        slotHost.append(stage);
        if (!preview) { try { preview = new ModelPreview(stage); } catch { stage.classList.add('no-webgl'); } }
        const showSlot = s => {
          const cls = CLASSES[CLASS_ALIASES[s.character.classId] || s.character.classId];
          stage.style.setProperty('--cls', cls?.color ?? '#cabc86');
          stage.querySelector('.acc-stage-name').textContent = `${s.character.name} · ${cls?.name ?? ''} Lv.${s.character.level ?? 1}`;
          preview?.show(CLASS_ALIASES[s.character.classId] || s.character.classId);
        };
        showSlot(filled[0]);
        overlay.querySelectorAll('.acc-play').forEach(b => {
          const s = slots[Number(b.dataset.play)];
          for (const n of ['pointerenter', 'focus']) b.addEventListener(n, () => showSlot(s));
        });
      }
      overlay.querySelectorAll('[data-play]').forEach(b => b.addEventListener('click', () => {
        const s = slots[Number(b.dataset.play)]; leave({ slot: s.slot, prefix: s.prefix, fresh: !s.character });
      }));
      overlay.querySelectorAll('[data-delete]').forEach(b => b.addEventListener('click', e => {
        e.stopPropagation();
        const s = slots[Number(b.dataset.delete)];
        if (!confirm(`ลบ "${s.character.name}" ถาวร? ความคืบหน้า เควส และของในกระเป๋าจะหายทั้งหมด`)) return;
        store.deleteSlot(session.id, s.slot); render();
      }));
      overlay.querySelector('.acc-logout').addEventListener('click', () => { onLogout?.(); leave(null); });
    };
    render();
    root.append(overlay);
    overlay.querySelector('[data-play]')?.focus();
  });
}

function slotCard({ slot, character: c }) {
  if (!c) return `<button type="button" class="acc-slot acc-empty" data-play="${slot}"><span class="acc-plus">+</span><b>สร้างตัวละครใหม่</b><em>ช่องว่าง</em></button>`;
  const cls = CLASSES[CLASS_ALIASES[c.classId] || c.classId];
  return `<div class="acc-slot" style="--cls:${cls?.color ?? '#cabc86'}">
    <button type="button" class="acc-play" data-play="${slot}" aria-label="เล่น ${esc(c.name)}">
      <span class="acc-icon">${cls?.icon ?? '?'}</span>
      <b>${esc(c.name)}</b>
      <em>${esc(cls?.name ?? c.classId)} · Lv.${c.level ?? 1}</em>
      <small>${c.gender === 'female' ? 'หญิง' : 'ชาย'} · ${(c.gold ?? 0).toLocaleString()} ทอง</small>
      <span class="acc-enter">เข้าเกม</span>
    </button>
    <button type="button" class="acc-delete" data-delete="${slot}" title="ลบตัวละคร" aria-label="ลบ ${esc(c.name)}">ลบ</button>
  </div>`;
}

