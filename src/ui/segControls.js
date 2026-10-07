// Segmented buttons for the settings window (design "UI ใหม่"): every <select> inside `root`
// gets a row of buttons, one per option, and the select itself is hidden. A click sets the
// select's value and fires its 'input' and 'change' events, so the code that listens to the
// select is unchanged. The buttons re-read the selects whenever `root` is shown, since some
// values are set from saved preferences without an event.
//
//   segmentSelects(root) → sync()
export function segmentSelects(root) {
  const syncs = [];
  for (const sel of root.querySelectorAll('select')) {
    if (sel.dataset.seg) continue;
    sel.dataset.seg = '1';
    const seg = document.createElement('div');
    seg.className = 'g-seg'; seg.setAttribute('role', 'group');
    seg.innerHTML = [...sel.options].map(o => `<button type="button" data-v="${o.value}">${o.textContent}</button>`).join('');
    const sync = () => { for (const b of seg.children) b.setAttribute('aria-pressed', String(b.dataset.v === sel.value)); };
    seg.addEventListener('click', e => {
      const b = e.target.closest('[data-v]');
      if (!b || b.dataset.v === sel.value) return;
      sel.value = b.dataset.v;
      sel.dispatchEvent(new Event('input', { bubbles: true }));
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      sync();
    });
    sel.addEventListener('change', sync);
    sel.hidden = true; sel.after(seg); sync();
    syncs.push(sync);
  }
  const syncAll = () => syncs.forEach(f => f());
  new MutationObserver(() => { if (!root.hidden) syncAll(); }).observe(root, { attributes: true, attributeFilter: ['hidden'] });
  return syncAll;
}
