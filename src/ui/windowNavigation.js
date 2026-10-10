// Own Escape before text-input guards and gameplay listeners. Registration stays
// lazy because character and network windows are mounted after the app binds.
const focusable = root => [...root.querySelectorAll('button,input,select,textarea,a[href],summary,[tabindex]')]
  .filter(el => !el.disabled && el.tabIndex >= 0 && el.getClientRects().length);
const visible = root => root && !root.hidden && root.getClientRects().length;

function paintOrder(root) {
  const order = [];
  for (let el = root; el && el !== document.body; el = el.parentElement) {
    const style = getComputedStyle(el);
    if (style.zIndex !== 'auto' || style.transform !== 'none' || Number(style.opacity) < 1)
      order.unshift(Number.parseInt(style.zIndex, 10) || 0);
  }
  return order;
}
function compare(a, b) {
  const x = paintOrder(a.root()), y = paintOrder(b.root());
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const delta = (x[i] ?? 0) - (y[i] ?? 0); if (delta) return delta;
  }
  const position = a.root().compareDocumentPosition(b.root());
  if (!(position & 1)) { if (position & 4) return -1; if (position & 2) return 1; }
  return a.order - b.order;
}

export function bindWindowNavigation(entries, { fallback, onOpen = () => {} }) {
  let serial = 0;
  let previousFocus = document.activeElement;
  const restore = entry => {
    const remaining = entries.filter(item => item.wasOpen).sort(compare).at(-1), opener = entry.opener;
    if (visible(opener) && opener.tabIndex >= 0 && (!remaining || remaining.root().contains(opener))) opener.focus({ preventScroll: true });
    else (remaining ? focusable(remaining.root())[0] : fallback())?.focus({ preventScroll: true });
  };
  const refresh = (opener = document.activeElement) => {
    const closed = [];
    for (const entry of entries) {
      const root = entry.root(), open = !!visible(root);
      if (open && !entry.wasOpen) {
        entry.order = ++serial;
        entry.opener = root.contains(opener) ? previousFocus : opener;
        onOpen();
      }
      if (!open && entry.wasOpen && (root?.contains(document.activeElement) || (document.activeElement === document.body && entry.hadFocus))) closed.push(entry);
      entry.wasOpen = open;
    }
    if (closed.length) restore(closed.at(-1));
  };
  const observer = new MutationObserver(() => refresh());
  observer.observe(document.getElementById('app'), { subtree: true, attributes: true, attributeFilter: ['hidden'] });
  const handler = e => {
    refresh();
    const active = entries.filter(entry => entry.wasOpen).sort(compare).at(-1);
    if (!active) return;
    const root = active.root();
    if (e.code === 'Escape') {
      e.preventDefault(); e.stopImmediatePropagation();
      if (e.repeat) return;
      active.close(); refresh();
      if (!active.wasOpen) restore(active);
    } else if (e.code === 'Tab') {
      const controls = focusable(root);
      const first = controls[0], last = controls.at(-1);
      if (!root.contains(document.activeElement) || (e.shiftKey ? document.activeElement === first : document.activeElement === last)) {
        e.preventDefault(); (e.shiftKey ? last : first)?.focus();
      }
      e.stopImmediatePropagation();
    }
  };
  const containKeys = e => {
    // Let controls handle editing / Enter first, then contain gameplay shortcuts.
    if (entries.some(entry => visible(entry.root()) && entry.root().contains(e.target))) e.stopPropagation();
  };
  const rememberFocus = e => {
    refresh(previousFocus);
    if (e.target !== document.body) for (const entry of entries) entry.hadFocus = !!entry.root()?.contains(e.target);
    previousFocus = e.target;
  };
  document.addEventListener('focusin', rememberFocus, true);
  document.addEventListener('keydown', handler, true);
  document.addEventListener('keydown', containKeys);
  return () => { observer.disconnect(); document.removeEventListener('focusin', rememberFocus, true); document.removeEventListener('keydown', handler, true); document.removeEventListener('keydown', containKeys); };
}
