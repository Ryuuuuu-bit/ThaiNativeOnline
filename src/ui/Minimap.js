import { LANDMARKS } from '../data/landmarks.js';
import { HALLS } from '../data/halls.js';
import { SHOPS, TRAINERS } from '../data/shops.js';
import { themeFor, npcMarker, landmarkMarker, edgePoint, portalStyle, LEGEND } from './minimap/mapStyle.js';
import { paintBase } from './minimap/paintBase.js';
import { badge, unknownMark, questMark, portalMark, pathMark, playerMark, monsterMark, npcDot, edgeArrow, compassRose, label, markerSample } from './minimap/glyphs.js';

// Painted north-up map of the loaded map (minimap + the M full map).
//
//   new Minimap(canvas, fullCanvas, footprints, options)
// options (all optional; the map hook documented in src/world/README.md):
//   bounds      walk bounds of the map (walkBounds(map))
//   landmarks   this map's landmarks; hidden ones appear only once discovered
//   portals     warps, drawn as glowing rings labelled with `toName`
//   discovered  Set of discovered landmark ids (outlives a map change)
//   world, map  buildWorld() result and its MAPS entry: the ground, water, trees,
//               walls and roofs are painted once from them (src/ui/minimap/paintBase.js);
//               the palette follows map.minimap.theme / map.theme / map.id (mapStyle.js)
//   regionAt    (x, z) → region, for zone names on the full map
//   onPick      (landmark) => void, clicking a discovered landmark on the full map
// Per refresh (Game calls it every ~120 ms, never per frame):
//   update(p, yaw, state)  /  drawFull(p, yaw, state)
//   state: { t, night 0..1, npcs, monsters, quest(npcId), targets: Set, view: [{x,z}×4] }
// Call invalidate() when something painted into the base changes (a hidden place found).
// `stats` = { buildMs, drawMs, fullMs, trees }.
const VIEW_UNITS = 120, MONSTER_RADIUS = 48;

export class Minimap {
  constructor(canvas, fullCanvas, footprints, { bounds, landmarks = LANDMARKS, portals = [], discovered = new Set(), world = null, map = null, regionAt = null, onPick = null } = {}) {
    Object.assign(this, { canvas, full: fullCanvas, landmarks, portals, discovered, world, map, regionAt, onPick });
    this.bounds = bounds ?? world?.map?.view;
    this.theme = themeFor(map ?? world?.map ?? {});
    this.ctx = canvas.getContext('2d');
    this.hits = []; this.stats = { buildMs: 0, drawMs: 0, fullMs: 0, trees: 0 };
    this.world = world ?? { footprints, map: { walk: [this.bounds] } };
    this.build();
    this.bindFull();
    for (const c of [canvas, fullCanvas]) decorateFrame(c?.parentElement);
  }
  build() {
    const regionAt = this.regionAt ? (x, z) => this.regionAt(x, z, this.discovered.has('cemetery')) : null;
    this.base = paintBase({ world: this.world, bounds: this.bounds, theme: this.theme, regionAt });
    this.stats.buildMs = this.base.ms; this.stats.trees = this.base.trees;
  }
  invalidate() { this.build(); }

  // Backing store follows the canvas's on-screen size (HUD zoom, layout, DPR).
  fit(c) {
    const r = c.getBoundingClientRect(), w = Math.max(1, Math.round(r.width * devicePixelRatio)), h = Math.max(1, Math.round(r.height * devicePixelRatio));
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    return [w, h];
  }

  // ---- shared marker pass ----
  // `to(x, z)` maps world → canvas; `k` = pixels per world unit; `ui` = base marker size.
  markers(g, to, k, ui, state, { full = false, p } = {}) {
    const hits = full ? [] : null, cw = g.canvas.width, ch = g.canvas.height, onScreen = (x, y, m = 12) => x > -m && y > -m && x < cw + m && y < ch + m;
    const t = state.t ?? 0, targets = state.targets ?? new Set();
    // View footprint of the camera (what the screen shows).
    if (state.view?.length === 4) {
      g.save(); g.beginPath(); state.view.forEach((v, i) => { const [x, y] = to(v.x, v.z); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.closePath();
      g.fillStyle = 'rgba(255,246,214,.13)'; g.fill(); g.strokeStyle = 'rgba(70,46,20,.45)'; g.lineWidth = Math.max(1, ui * .12); g.setLineDash([ui * .4, ui * .3]); g.stroke(); g.restore();
    }
    // Other NPCs as dots, services as badges, quest givers on top.
    const services = [], quests = [];
    for (const n of state.npcs ?? []) {
      if (n.indoors) continue;
      const [x, y] = to(n.x, n.z); if (!onScreen(x, y)) continue;
      const m = npcMarker(n.def, { shops: SHOPS, trainers: TRAINERS, quest: state.quest?.(n.id) ?? null });
      if (m.kind === 'quest') quests.push([x, y, m, n]);
      else if (m.kind === 'shop' || m.kind === 'trainer') services.push([x, y, m, n]);
      else if (k > 1.1 || full) npcDot(g, x, y, ui * (full ? .2 : .22), m.kind);
    }
    // Monsters only on unsafe maps, near the player.
    if (this.map?.safe === false && p) for (const m of state.monsters ?? []) {
      if (!m.alive || Math.hypot(m.x - p.x, m.z - p.z) > MONSTER_RADIUS) continue;
      const [x, y] = to(m.x, m.z); if (onScreen(x, y)) monsterMark(g, x, y, ui * .26, !!(m.def?.elite || m.def?.boss));
    }
    // Landmarks: unknown ones (faded) under the service badges, discovered ones above; hidden skipped.
    const landmarks = found => { for (const l of this.landmarks) {
      const m = landmarkMarker(l, this.discovered, HALLS);
      if (m.kind === 'hidden' || !!m.found !== found) continue;
      const [x, y] = to(l.x, l.z); if (!onScreen(x, y, 20)) continue;
      const r = ui * (full ? .62 : .55);
      if (m.found) badge(g, x, y, r, m.glyph === 'hall' ? `class:${m.classId}` : m.glyph, m.glyph === 'hall' ? 'hall' : 'gold');
      else unknownMark(g, x, y, r * .85);
      if (targets.has(l.id) && !m.found) questMark(g, x, y - r * 1.9, r * .7, '!', t);
      if (full && m.found) label(g, l.name, x, y + r * 1.75, Math.round(ui * .5), { weight: 600 });
      hits?.push({ x, y, r: r * 1.5, title: m.found ? `${l.name}${l.text ? ` — ${l.text}` : ''}` : 'สถานที่ที่ยังไม่ค้นพบ', landmark: m.found ? l : null });
    } };
    landmarks(false);
    const placed = [];
    for (const [x, y, m, n] of services) {
      const r = ui * (full ? .52 : .48);
      if (placed.some(([a, b]) => Math.hypot(a - x, b - y) < r * 1.5)) continue; // stalls side by side: one badge
      placed.push([x, y]);
      badge(g, x, y, r, m.kind === 'trainer' ? `class:${m.classId}` : m.purpose, m.kind === 'trainer' ? 'hall' : 'shop');
      hits?.push({ x, y, r: r * 1.4, title: `${n.def.name}${SHOPS[n.def.shopType] ? ` · ${SHOPS[n.def.shopType].title}` : TRAINERS[n.def.trainer] ? ` · ${TRAINERS[n.def.trainer].title}` : ''}` });
    }
    landmarks(true);
    for (const [x, y, m, n] of quests) { questMark(g, x, y, ui * .5, m.glyph, t); hits?.push({ x, y, r: ui, title: `${n.def.name} · ${m.glyph === '?' ? 'ส่งเควส' : 'มีเควส'}` }); }
    // Warps (glowing rings) and trail exits (signposts), with the destination on the full map.
    for (const w of this.portals) {
      const at = w.marker ?? w.at, [x, y] = to(at.x, at.z), path = portalStyle(w) === 'path';
      if (onScreen(x, y, 30)) {
        // The signpost arrow points out of the map: north for exits in the north half, else south.
        if (path) pathMark(g, x, y, ui * (full ? .5 : .44), w.at.z < (this.bounds.minZ + this.bounds.maxZ) / 2 ? -Math.PI / 2 : Math.PI / 2);
        else portalMark(g, x, y, ui * (full ? .5 : .42), t);
      }
      if (full) label(g, `${w.name ?? 'ประตูวาป'} → ${w.toName ?? w.to}`, x, y - ui * 1.25, Math.round(ui * .5), { color: '#5a2e08', weight: 600 });
      hits?.push({ x, y, r: ui, title: `${w.name ?? 'ประตูวาป'} → ${w.toName ?? w.to}` });
    }
    if (hits) this.hits = hits;
  }

  // ---- minimap ----
  update(p, yaw, state = {}) {
    const t0 = performance.now(), [cw, ch] = this.fit(this.canvas), g = this.ctx, B = this.base;
    const k = cw / VIEW_UNITS, ui = Math.max(10, cw / 13);
    g.fillStyle = this.theme.edge; g.fillRect(0, 0, cw, ch);
    const sw = cw / k * B.S, sh = ch / k * B.S;
    g.imageSmoothingEnabled = true;
    g.drawImage(B.canvas, (p.x - B.rect.minX) * B.S - sw / 2, (p.z - B.rect.minZ) * B.S - sh / 2, sw, sh, 0, 0, cw, ch);
    this.nightTint(g, cw, ch, state.night);
    const to = (x, z) => [(x - p.x) * k + cw / 2, (z - p.z) * k + ch / 2];
    this.markers(g, to, k, ui, state, { p });
    // Off-screen warps and quest targets: arrows on the edge.
    const edge = (x, z, color) => { const e = edgePoint((x - p.x) * k, (z - p.z) * k, cw / 2, ch / 2, ui * .55); if (e) edgeArrow(g, cw / 2 + e.x, ch / 2 + e.y, e.angle, ui * .38, color); };
    for (const w of this.portals) { const at = w.marker ?? w.at; edge(at.x, at.z, portalStyle(w) === 'path' ? '#e2b469' : '#ffe08a'); }
    for (const l of this.landmarks) if (state.targets?.has(l.id) && !this.discovered.has(l.id) && (!l.hidden)) edge(l.x, l.z, '#e2643a');
    playerMark(g, cw / 2, ch / 2, ui * .5, yaw);
    compassRose(g, cw - ui * .95, ui * .95, ui * .72, state.night > .5);
    this.stats.drawMs = +(performance.now() - t0).toFixed(2);
  }
  // Night: the paper cools to moonlit blue (one multiply pass over the blit).
  nightTint(g, w, h, night = 0) {
    if (!(night > .02)) return;
    g.save(); g.globalCompositeOperation = 'multiply'; g.globalAlpha = Math.min(1, night) * .75; g.fillStyle = '#5d6f9c'; g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = Math.min(1, night) * .12; g.fillStyle = '#9fb6e8'; g.fillRect(0, 0, w, h); g.restore();
  }

  // ---- full map (M) ----
  drawFull(p, yaw, state = {}) {
    const t0 = performance.now(), c = this.full, [cw, ch] = this.fit(c), g = c.getContext('2d'), B = this.base, R = B.rect;
    const margin = Math.min(cw, ch) * .03, k = Math.min((cw - margin * 2) / (R.maxX - R.minX), (ch - margin * 2) / (R.maxZ - R.minZ));
    const w = (R.maxX - R.minX) * k, h = (R.maxZ - R.minZ) * k, left = (cw - w) / 2, top = (ch - h) / 2;
    g.clearRect(0, 0, cw, ch);
    g.fillStyle = 'rgba(20,12,4,.45)'; g.fillRect(left + 4, top + 6, w, h);
    g.imageSmoothingEnabled = true; g.drawImage(B.canvas, left, top, w, h);
    g.save(); g.beginPath(); g.rect(left, top, w, h); g.clip();
    this.nightTint(g, cw, ch, state.night);
    g.restore();
    g.strokeStyle = '#6b4a22'; g.lineWidth = Math.max(1, devicePixelRatio); g.strokeRect(left, top, w, h);
    const ui = Math.max(14, Math.min(cw, ch) / 26), to = (x, z) => [left + (x - R.minX) * k, top + (z - R.minZ) * k];
    // Zone names: large spaced serif, skipped where a discovered landmark label sits.
    // Zone names: large serif, nudged off the place markers and each other; skipped where none fits.
    const size = Math.round(ui * .62), boxes = [...this.landmarks.filter(l => !l.hidden || this.discovered.has(l.id)), ...this.portals.map(w => w.marker ?? w.at), p]
      .map(l => { const [x, y] = to(l.x, l.z); return { x, y, hw: ui * .7, hh: ui * .7 }; });
    g.font = `500 ${size}px "Noto Serif Thai", serif`;
    for (const z of B.zones) {
      if (z.name === this.map?.name) continue;
      const [x, y0] = to(z.x, z.z), hw = g.measureText(z.name).width / 2 + 4, hh = size * .6;
      const y = [0, 1, -1, 2, -2].map(o => y0 + o * ui * .95).find(y => !boxes.some(b => Math.abs(b.x - x) < b.hw + hw && Math.abs(b.y - y) < b.hh + hh));
      if (y === undefined) continue;
      label(g, z.name, x, y, size, { color: 'rgba(70,44,18,.78)', halo: 'rgba(246,236,208,.55)', weight: 500 });
      boxes.push({ x, y, hw, hh });
    }
    this.markers(g, to, k, ui, state, { full: true, p });
    playerMark(g, ...to(p.x, p.z), ui * .55, yaw);
    compassRose(g, left + w - ui * 1.6, top + ui * 1.6, ui * 1.15, state.night > .5);
    // Scale bar: 50 units.
    const sx = left + ui, sy = top + h - ui, len = 50 * k;
    g.fillStyle = '#3a2612'; g.fillRect(sx, sy, len, Math.max(2, ui * .12)); g.fillRect(sx, sy - ui * .2, 2, ui * .4); g.fillRect(sx + len - 2, sy - ui * .2, 2, ui * .4);
    label(g, '50 วา', sx + len / 2, sy - ui * .45, Math.round(ui * .45), { serif: false });
    this.stats.fullMs = +(performance.now() - t0).toFixed(2);
  }
  // Tooltips and click-to-walk on the full map.
  bindFull() {
    const c = this.full; if (!c || c.dataset.bound) return;
    c.dataset.bound = '1';
    const tip = c.parentElement?.querySelector('.map-tip');
    const find = e => { const r = c.getBoundingClientRect(), x = (e.clientX - r.left) * c.width / r.width, y = (e.clientY - r.top) * c.height / r.height; return [...(c._minimap?.hits ?? [])].reverse().find(h => Math.hypot(h.x - x, h.y - y) < h.r) ?? null; };
    c.addEventListener('mousemove', e => {
      const h = find(e); c.style.cursor = h?.landmark ? 'pointer' : 'default';
      if (!tip) { c.title = h?.title ?? ''; return; }
      tip.hidden = !h; if (!h) return;
      tip.textContent = h.title + (h.landmark ? ' · คลิกเพื่อเดินไป' : '');
      const pr = c.parentElement.getBoundingClientRect(), z = pr.width / c.parentElement.offsetWidth || 1;
      tip.style.left = `${(e.clientX - pr.left) / z + 14}px`; tip.style.top = `${(e.clientY - pr.top) / z + 10}px`;
    });
    c.addEventListener('mouseleave', () => { if (tip) tip.hidden = true; });
    c.addEventListener('click', e => { const h = find(e); if (h?.landmark) c._minimap?.onPick?.(h.landmark); });
  }
  // The full map's canvas is shared across map changes; route events to the live minimap.
  activate() { if (this.full) this.full._minimap = this; return this; }

  // Legend rows (canvas icons drawn by the same code as the map).
  static mountLegend(el) {
    if (!el || el.childElementCount) return;
    for (const [kind, text] of LEGEND) {
      const row = document.createElement('li'), c = document.createElement('canvas'), s = Math.round(22 * devicePixelRatio);
      c.width = c.height = s; markerSample(c.getContext('2d'), kind, s / 2, s / 2, s * .42);
      row.append(c, document.createTextNode(text)); el.appendChild(row);
    }
  }
}

// Gold lai kranok corners on a .map-frame (inline SVG, drawn here; CSS places and mirrors them).
const KRANOK = '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M1.5 31V8Q1.5 1.5 8 1.5H31" fill="none" stroke="currentColor" stroke-width="1.4"/>'
  + '<path d="M4.6 31V9.5Q4.6 4.6 9.5 4.6H31" fill="none" stroke="currentColor" stroke-width=".8" opacity=".6"/>'
  + '<path d="M3 3C9 4 13 6.5 18.5 18.5 12.5 13 8.5 12 5.5 14 7.5 10 6.5 7 3 3Z M3 3C4 9 6.5 13 18.5 18.5 13 12.5 12 8.5 14 5.5 10 7.5 7 6.5 3 3Z" fill="currentColor"/>'
  + '<path d="M11.5 3.8c3.4-.4 5.6 1.6 4.6 4.6M3.8 11.5c-.4 3.4 1.6 5.6 4.6 4.6" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/>'
  + '<circle cx="21.5" cy="21.5" r="1.5" fill="currentColor"/></svg>';
function decorateFrame(el) {
  if (!el || el.dataset.kranok) return;
  el.dataset.kranok = '1';
  for (const pos of ['tl', 'tr', 'bl', 'br']) { const i = document.createElement('i'); i.className = `kranok ${pos}`; i.innerHTML = KRANOK; el.appendChild(i); }
}
