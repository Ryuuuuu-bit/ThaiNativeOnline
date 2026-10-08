// Windows you can move: drag a window by its title bar and it stays where you left it
// (a per-browser view preference, like the skin). Double-click the title bar to put it back.
// The move is a CSS `translate` on top of the window's own layout, so centred, stretched and
// zoomed windows keep their size. Touch layouts keep the fixed places, unless the window has
// a lock button (`lockable`): unlocked, it can be dragged by finger too; locked, it stays put.
//
//   draggable(el, { key, handle, lockable })   handle: a selector inside el (default 'header')
const KEY = 'thainative.ui.pos';
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) ?? {}; } catch { return {}; } };
const save = all => { try { localStorage.setItem(KEY, JSON.stringify(all)); } catch { /* private mode */ } };
const touch = () => document.body.classList.contains('ui-touch');
const NOT_GRAB = 'button,input,select,textarea,a,kbd,[data-tab]';

const shift = (el, x, y) => { el.style.translate = x || y ? `${x}px ${y}px` : ''; };

// CSS zoom (--ui) scales the translate too: measure how far 100px moves on screen.
function scaleOf(el, x, y) {
  const a = el.getBoundingClientRect().left;
  shift(el, x + 100, y);
  const s = (el.getBoundingClientRect().left - a) / 100;
  shift(el, x, y);
  return s > 0 ? s : 1;
}

export function draggable(el, { key, handle = 'header', lockable = false } = {}) {
  const saved = load()[key] ?? {};
  const pos = { x: saved.x || 0, y: saved.y || 0 };
  // the lock: a lockable window starts locked (on a phone the title bar is also a button, so
  // moving it is a choice); the state is remembered with the position
  let locked = lockable && (saved.locked ?? true);
  const persist = () => { const all = load(); all[key] = { x: Math.round(pos.x), y: Math.round(pos.y), ...(lockable ? { locked } : {}) }; if (!pos.x && !pos.y && !(lockable && !locked)) delete all[key]; save(all); };
  const canDrag = () => lockable ? !locked : !touch();
  const paint = () => { const bar = el.querySelector(handle); if (!bar) return; bar.classList.toggle('drag-locked', lockable && locked); bar.style.touchAction = canDrag() ? 'none' : ''; };
  if (lockable) {
    const bar = el.querySelector(handle);
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'drag-lock'; btn.setAttribute('aria-pressed', String(locked));
    const label = () => { btn.title = locked ? 'ปลดล็อกเพื่อย้ายหน้าต่าง' : 'ล็อกตำแหน่ง'; btn.setAttribute('aria-label', btn.title); btn.setAttribute('aria-pressed', String(locked)); btn.textContent = locked ? '🔒' : '🔓'; };
    btn.addEventListener('click', e => { e.stopPropagation(); locked = !locked; label(); paint(); persist(); });
    label(); bar?.append(btn);
  }
  // keep part of the window, and its title bar, on screen
  const clamp = bar => {
    if (!bar || el.hidden || !el.isConnected) return;
    const s = scaleOf(el, pos.x, pos.y), r = el.getBoundingClientRect(), b = bar.getBoundingClientRect();
    if (!r.width) return;
    let fx = 0, fy = 0;
    if (r.right < 80) fx = 80 - r.right; else if (r.left > innerWidth - 80) fx = innerWidth - 80 - r.left;
    if (b.top < 0) fy = -b.top; else if (b.bottom > innerHeight) fy = innerHeight - b.bottom;
    if (fx || fy) { pos.x += fx / s; pos.y += fy / s; shift(el, pos.x, pos.y); }
  };
  // a saved spot from a wider screen (or another HUD scale) is pulled back in when shown and when the window resizes
  const settle = () => clamp(el.querySelector(handle));
  if (!touch() || lockable) { shift(el, pos.x, pos.y); requestAnimationFrame(settle); }
  requestAnimationFrame(paint);
  addEventListener('resize', settle);
  new MutationObserver(() => { if (!el.hidden) requestAnimationFrame(settle); }).observe(el, { attributes: true, attributeFilter: ['hidden', 'class'] });
  el.addEventListener('pointerdown', e => {
    const bar = e.target.closest(handle);
    if (e.button !== 0 || !bar || !el.contains(bar) || e.target.closest(NOT_GRAB) || !canDrag()) return;
    const x0 = pos.x, y0 = pos.y, s = scaleOf(el, x0, y0), sx = e.clientX, sy = e.clientY;
    let moved = false;
    const move = ev => {
      const dx = ev.clientX - sx, dy = ev.clientY - sy;
      if (!moved && Math.hypot(dx, dy) < 4) return;
      if (!moved) { moved = true; el.classList.add('dragging'); }
      pos.x = x0 + dx / s; pos.y = y0 + dy / s; shift(el, pos.x, pos.y);
      clamp(bar);
    };
    const up = () => {
      removeEventListener('pointermove', move); removeEventListener('pointerup', up); removeEventListener('pointercancel', up);
      if (!moved) return;
      el.classList.remove('dragging');
      // the drag was not a click on the title bar (the chat's opens its input)
      const swallow = ev => { ev.stopPropagation(); ev.preventDefault(); };
      el.addEventListener('click', swallow, { capture: true });
      setTimeout(() => el.removeEventListener('click', swallow, { capture: true }), 60);
      persist();
    };
    addEventListener('pointermove', move); addEventListener('pointerup', up); addEventListener('pointercancel', up);
    e.preventDefault();
  });
  el.addEventListener('dblclick', e => {
    if (!e.target.closest(handle) || e.target.closest(NOT_GRAB) || !canDrag()) return;
    pos.x = pos.y = 0; shift(el, 0, 0); persist();
  });
}
