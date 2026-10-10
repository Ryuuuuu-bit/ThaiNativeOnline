import './touch.css';

// Touch play for phones and tablets (body.ui-touch, see touch.css). Turned on for
// touch-first screens (coarse pointer, no hover) or with ?touch=1 (?touch=0 turns it off):
//   · a floating joystick: a thumb anywhere in the lower-left area walks the player that
//     way (InputManager.stick); pushed to the rim it runs;
//   · a right-thumb cluster: ตี (basic attack, Space), เป้า (lock the next target, Tab; it glows
//     while something is locked, a long press lets go) and คุย
//     (talk / use, E), sent as the same keys the keyboard uses so every rule stays in one place;
//   · the action bar is regrouped: the skills stay along the bottom, while AUTO, its
//     settings, potions and the character / bag buttons move into a column on the right;
//   · a full-screen button and, on a phone held upright, a one-time hint to turn it sideways;
//   · while a menu is open the controls hide (body.touch-menu) and the menu scrolls within the screen.
// Tapping the ground still walks there and two fingers still pinch-zoom (InputManager).
//
//   createTouchControls(root, input)  → null on a mouse-and-keyboard screen
// (the action bar is regrouped as soon as it appears in `root`)
const STICK_DEAD = .18, STICK_RUN = .86;
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

export function wantsTouch() {
  const q = new URLSearchParams(location.search).get('touch');
  if (q === '1') return true;
  if (q === '0') return false;
  return matchMedia('(pointer: coarse)').matches && !matchMedia('(hover: hover)').matches;
}

// A keyboard key, as if pressed (the game's own key handling does the rest).
const press = code => {
  window.dispatchEvent(new KeyboardEvent('keydown', { code, key: code, bubbles: true }));
  window.dispatchEvent(new KeyboardEvent('keyup', { code, key: code, bubbles: true }));
};

export function createTouchControls(root, input, { locked = () => false, unlock = () => {} } = {}) {
  if (!wantsTouch()) return null;
  document.body.classList.add('ui-touch');

  // ---- joystick -----------------------------------------------------------------------
  const zone = el('div', 'touch-zone'), base = el('div', 'touch-stick', '<i></i>'), knob = base.firstChild;
  zone.setAttribute('aria-hidden', 'true');
  zone.append(base); root.append(zone);
  let id = null, cx = 0, cy = 0;
  const radius = () => base.offsetWidth / 2 || 60;
  const home = () => { base.style.left = ''; base.style.top = ''; base.classList.remove('live'); knob.style.transform = ''; };
  const steer = (x, y) => {
    const r = radius(); let dx = x - cx, dy = y - cy;
    const len = Math.hypot(dx, dy); if (len > r) { dx *= r / len; dy *= r / len; }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    const m = Math.min(1, len / r);
    if (m < STICK_DEAD) { input.setStick(0, 0, false); return; }
    input.setStick(dx / r, dy / r, m > STICK_RUN);
  };
  zone.addEventListener('pointerdown', e => {
    if (id !== null) return;
    id = e.pointerId; zone.setPointerCapture(id);
    const z = zone.getBoundingClientRect();
    cx = e.clientX; cy = e.clientY;
    base.style.left = `${cx - z.left}px`; base.style.top = `${cy - z.top}px`; base.classList.add('live');
    e.preventDefault();
  });
  zone.addEventListener('pointermove', e => { if (e.pointerId === id) steer(e.clientX, e.clientY); });
  const release = e => { if (e.pointerId !== id) return; id = null; input.setStick(0, 0, false); home(); };
  zone.addEventListener('pointerup', release); zone.addEventListener('pointercancel', release);
  window.addEventListener('blur', () => { id = null; input.setStick(0, 0, false); home(); });

  // ---- right-thumb buttons --------------------------------------------------------------
  const pad = el('div', 'touch-pad');
  const btn = (cls, label, code, title, immediate = true) => {
    const b = el('button', `touch-btn ${cls}`, label); b.type = 'button'; b.title = title; b.setAttribute('aria-label', title);
    b.addEventListener('pointerdown', e => { e.preventDefault(); b.classList.add('down'); if (immediate) press(code); });
    b.addEventListener('keydown', e => {
      if (!['Enter', 'Space'].includes(e.code)) return;
      e.preventDefault(); e.stopPropagation(); if (!e.repeat) press(code);
    });
    b.addEventListener('keyup', e => { if (['Enter', 'Space'].includes(e.code)) { e.preventDefault(); e.stopPropagation(); } });
    for (const n of ['pointerup', 'pointercancel', 'pointerleave']) b.addEventListener(n, () => b.classList.remove('down'));
    pad.append(b); return b;
  };
  btn('t-attack', '<b>ตี</b>', 'Space', 'ตีปกติใส่เป้าหมาย');
  const targetBtn = btn('t-target', '<b>เป้า</b>', 'Tab', 'แตะ: ล็อกเป้าหมายถัดไป · กดค้าง: ปลดล็อก', false);
  // a long press on เป้า lets the target go
  let hold = null, targetPointer = null, released = false;
  targetBtn.addEventListener('pointerdown', e => {
    if (targetPointer !== null) return;
    targetPointer = e.pointerId; released = false; targetBtn.setPointerCapture(e.pointerId);
    clearTimeout(hold); hold = setTimeout(() => { released = true; unlock(); targetBtn.classList.add('released'); setTimeout(() => targetBtn.classList.remove('released'), 400); }, 550);
  });
  targetBtn.addEventListener('pointerup', e => {
    if (e.pointerId !== targetPointer) return;
    clearTimeout(hold); targetPointer = null;
    const bounds = targetBtn.getBoundingClientRect();
    if (!released && e.clientX >= bounds.left && e.clientX <= bounds.right && e.clientY >= bounds.top && e.clientY <= bounds.bottom) press('Tab');
  });
  const cancelTarget = () => { clearTimeout(hold); targetPointer = null; targetBtn.classList.remove('down'); };
  targetBtn.addEventListener('pointercancel', cancelTarget);
  targetBtn.addEventListener('lostpointercapture', cancelTarget);
  window.addEventListener('blur', cancelTarget);
  setInterval(() => targetBtn.classList.toggle('locked', locked()), 200);
  btn('t-talk', '<b>คุย</b>', 'KeyE', 'คุย / ใช้ของตรงหน้า');
  root.append(pad);

  // ---- full screen and a hint to hold a phone sideways ----------------------------------------
  const actions = document.querySelector('.top-actions');
  const docEl = document.documentElement;
  if (actions && (docEl.requestFullscreen || docEl.webkitRequestFullscreen)) {
    const fs = el('button', 'touch-fullscreen', '⛶'); fs.type = 'button'; fs.title = 'เต็มจอ'; fs.setAttribute('aria-label', 'เต็มจอ');
    fs.addEventListener('click', () => {
      if (document.fullscreenElement || document.webkitFullscreenElement) (document.exitFullscreen ?? document.webkitExitFullscreen)?.call(document);
      else (docEl.requestFullscreen ?? docEl.webkitRequestFullscreen).call(docEl, { navigationUI: 'hide' })?.then?.(() => screen.orientation?.lock?.('landscape').catch(() => {})).catch(() => {});
    });
    actions.prepend(fs);
  }
  const hint = el('div', 'touch-rotate glass', '<span>⟳</span><p>หมุนจอเป็นแนวนอนเพื่อเล่นได้สะดวกขึ้น</p><button type="button" aria-label="ปิด">×</button>');
  hint.hidden = true; root.append(hint);
  let hinted = false;
  const checkTurn = () => {
    const upright = innerHeight > innerWidth && innerWidth < 600;
    if (upright && !hinted) { hinted = true; hint.hidden = false; setTimeout(() => { hint.hidden = true; }, 7000); }
    if (!upright) hint.hidden = true;
  };
  hint.querySelector('button').addEventListener('click', () => { hint.hidden = true; });
  addEventListener('resize', checkTurn); checkTurn();

  // the action bar's extras go into a column on the right, above the buttons
  const attachBar = () => {
    const bar = root.querySelector('.action-bar');
    if (!bar || bar.dataset.touch) return !!bar;
    bar.dataset.touch = '1';
    const exps = bar.querySelector('.action-exps');
    if (exps) { exps.classList.add('touch-exps'); root.append(exps); }
    const side = el('div', 'touch-side');
    for (const sel of ['.hotbar-auto', '.hotbar-auto-cfg', '.action-items', '.action-menus']) { const n = bar.querySelector(sel); if (n) side.append(n); }
    bar.querySelectorAll(':scope > .hotbar-sep').forEach(n => n.remove());
    // the big map, one tap away (also ⌖ at the top and ⤢ by the minimap)
    const map = el('button', 'g-menu touch-map', 'แผนที่'); map.type = 'button'; map.title = 'แผนที่ใหญ่';
    map.addEventListener('click', () => input.emit('map'));
    side.append(map);
    const dock = el('div', 'touch-combat-dock');
    // Potions/AUTO sit above the movement thumb; learned skills sit beside
    // the attack thumb. Neither needs a panel over the player's character.
    dock.append(bar); root.append(side, dock);
    return true;
  };
  // A menu open (settings, character / bag, shop, full map, AUTO settings): the joystick,
  // buttons and skills step aside so the menu is whole and nothing under it gets pressed.
  const MENUS = '.settings:not([hidden]), .g-panel:not([hidden]), .shop:not([hidden]), .warp-overlay:not([hidden]), .qol-overlay:not([hidden]), .fullmap:not([hidden]), .auto-panel:not([hidden]), .soc-panel:not([hidden]), .mm-grid:not([hidden]), .net-chat.typing';
  setInterval(() => {
    const open = !!root.querySelector(MENUS);
    if (open !== document.body.classList.contains('touch-menu')) {
      document.body.classList.toggle('touch-menu', open);
      if (open) { id = null; input.setStick(0, 0, false); home(); }
    }
  }, 200);
  if (!attachBar()) { const mo = new MutationObserver(() => { if (attachBar()) mo.disconnect(); }); mo.observe(root, { childList: true }); }
  return { zone, pad };
}
