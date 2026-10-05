// Small DOM helpers shared by the character and combat interfaces.
export const el = (tag, className, html) => { const e = document.createElement(tag); if (className) e.className = className; if (html != null) e.innerHTML = html; return e; };
export const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const pct = (a, b) => `${Math.max(0, Math.min(100, a / b * 100))}%`;
export function setBar(bar, value, max, label) {
  bar.querySelector('span').style.width = pct(value, max);
  bar.querySelector('em').textContent = label ?? `${Math.ceil(value)} / ${max}`;
}
