// Windows you can move: drag a window by its title bar and it stays where you left it
// (a per-browser view preference, like the skin). Double-click the title bar to put it back.
// Touch layouts keep the fixed places.
//
//   draggable(el, { key, handle })   handle: a selector inside el (default 'header')
const KEY = 'thainative.ui.pos';
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) ?? {}; } catch { return {}; } };
const save = all => { try { localStorage.setItem(KEY, JSON.stringify(all)); } catch { /* private mode */ } };

// CSS zoom (--ui) and parent zoom scale left/top: measure how far 1px of left moves on screen.
function scaleOf(el, left) {
  const x0 = el.getBoundingClientRect().left;
  el.style.left = `${left + 100}px`;
  const s = (el.getBoundingClientRect().left - x0) / 100;
  el.style.left = `${left}px`;
  return s > 0 ? s : 1;
}

function place(el, x, y) { Object.assign(el.style, { left: `${x}px`, top: `${y}px`, right: 'auto', bottom: 'auto' }); }
function reset(el) { for (const p of ['left', 'top', 'right', 'bottom']) el.style[p] = ''; }

export function draggable(el, { key, handle = 'header' } = {}) {
  const saved = load()[key];
  if (saved && !document.body.classList.contains('ui-touch')) place(el, saved.x, saved.y);
  el.addEventListener('pointerdown', e => {
    const bar = e.target.closest(handle);
    if (e.button !== 0 || !bar || !el.contains(bar) || e.target.closest('button,input,select,a,kbd')) return;
    if (document.body.classList.contains('ui-touch')) return;
    const cs = getComputedStyle(el), left = parseFloat(cs.left) || 0, top = parseFloat(cs.top) || 0;
    const width = el.offsetWidth;
    const s = scaleOf(el, left), sx = e.clientX, sy = e.clientY;
    let moved = false;
    const move = ev => {
      const dx = ev.clientX - sx, dy = ev.clientY - sy;
      if (!moved && Math.hypot(dx, dy) < 4) return;
      if (!moved) { moved = true; el.style.width = `${width}px`; el.classList.add('dragging'); }
      // keep the title bar on screen
      const x = left + dx / s, y = top + dy / s;
      place(el, x, y);
      const r = el.getBoundingClientRect();
      let fx = 0, fy = 0;
      if (r.right < 60) fx = 60 - r.right; else if (r.left > innerWidth - 60) fx = innerWidth - 60 - r.left;
      if (r.top < 0) fy = -r.top; else if (r.top > innerHeight - 40) fy = innerHeight - 40 - r.top;
      if (fx || fy) place(el, x + fx / s, y + fy / s);
    };
    const up = () => {
      removeEventListener('pointermove', move); removeEventListener('pointerup', up); removeEventListener('pointercancel', up);
      if (!moved) return;
      el.classList.remove('dragging');
      const all = load(); all[key] = { x: parseFloat(el.style.left), y: parseFloat(el.style.top), w: width }; save(all);
    };
    addEventListener('pointermove', move); addEventListener('pointerup', up); addEventListener('pointercancel', up);
    e.preventDefault();
  });
  el.addEventListener('dblclick', e => {
    if (!e.target.closest(handle) || e.target.closest('button')) return;
    reset(el); el.style.width = '';
    const all = load(); delete all[key]; save(all);
  });
  // a restored window keeps the width it had when it was dragged (left+right layouts would stretch)
  if (saved?.w && !document.body.classList.contains('ui-touch')) el.style.width = `${saved.w}px`;
}
