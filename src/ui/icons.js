import { AVATARS } from '../data/training.js';
import { versioned } from '../core/version.js';

// One place that turns icon data into HUD markup, so every screen shows
// classes, skills, buffs and potions the same way:
//   classBadge(id, cls)  the class's rendered portrait (AVATARS[id].portrait), else
//                        its gold line emblem below
//   iconHtml(entry)      entry.img (a framed PNG) when there is one, else entry.icon
//   (items, potions included, use iconHtml with their framed art in public/ui/items)
const BASE = import.meta.env?.BASE_URL ?? '/';
const escapeAttr = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// Keep source art untouched. One live frame replaces the baked PNG rim and
// scales with inventory, skill tree, hotbar and small buff icons alike.
export function assetIcon(url, alt = '') {
  return `<span class="icon-img asset-icon"><img src="${escapeAttr(url)}" alt="${escapeAttr(alt)}"></span>`;
}

// 24×24 line emblems (stroke = currentColor) for classes without a portrait yet.
export const EMBLEMS = {
  muaythai: '<path d="M7 11V7.5a1.5 1.5 0 0 1 3 0V10m0-3a1.5 1.5 0 0 1 3 0v3m0-2.5a1.5 1.5 0 0 1 3 0V11m0-1.5a1.5 1.5 0 0 1 3 0V14c0 3.5-2.5 6-6 6h-1c-2.6 0-4.6-1.6-5.4-4L5 12.5a1.5 1.5 0 0 1 2.6-1.4L9 13"/><path d="M8 17h9"/>',
  warrior: '<path d="M5 19 17 7l1-3-3 1L3 17"/><path d="M19 19 7 7 6 4l3 1 12 12"/><path d="m4 16 4 4M20 16l-4 4"/>',
  hunter: '<path d="M6 3c6 3 9 9 6 18"/><path d="M6 3c-1 6-1 12 6 18"/><path d="M3 12h17m-3-3 3 3-3 3"/>',
  shaman: '<path d="M12 21v-6"/><path d="M12 15c-4 0-5-3-5-5a5 5 0 0 1 10 0c0 1.7-1.2 3-3 3s-2.5-1.2-2.5-2.3 .8-1.7 1.6-1.7"/><path d="M12 3v2"/>',
  herbalist: '<path d="M5 19c0-9 6-14 15-14 0 9-5 15-14 15"/><path d="M5 19 13 11"/><path d="M9 15h4M11 13V9"/>',
  assassin: '<path d="m14 4 6 6-9 9H5v-6z"/><path d="m4 20 3-3M11 8l5 5"/>',
};
const emblem = (id, size) => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${EMBLEMS[id] ?? '<circle cx="12" cy="12" r="7"/>'}</svg>`;

// `cls` is the class data (name, color); `size` the emblem's pixel size.
export function classBadge(id, cls, { size = 26 } = {}) {
  const portrait = AVATARS[id]?.portrait;
  const inner = portrait ? `<img src="${escapeAttr(versioned(`${BASE}${portrait}`))}" alt="">` : emblem(id, size);
  return `<span class="cls-badge${portrait ? ' has-portrait' : ''}" style="--cls:${cls?.color ?? '#cabc86'}">${inner}</span>`;
}
// Just the art, for places that draw their own frame (the locked silhouettes).
export const classEmblem = (id, size = 26) => emblem(id, size);

export function iconHtml(entry, alt = '') {
  if (entry?.img) return assetIcon(`${BASE}${entry.img}`, alt);
  return `<span class="icon-glyph">${entry?.icon ?? '✦'}</span>`;
}
