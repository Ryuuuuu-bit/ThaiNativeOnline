import { huntingFor, huntingLevel } from '../data/hunting.js';
import { LANDMARKS } from '../data/landmarks.js';
import { HALLS } from '../data/halls.js';
import { SHOPS, TRAINERS } from '../data/shops.js';
import { themeFor, npcMarker, landmarkMarker, edgePoint, portalStyle, overlapsBossLair, placeBossBadge, LEGEND } from './minimap/mapStyle.js';
import { paintBase } from './minimap/paintBase.js';
import { mapDirectory, filterPlaces } from './mapDirectory.js';
import { fittedCamera, mapTransform, placeLabels, clampCamera, clusterMarkers } from './minimap/mapLayout.js';
import { badge, bossLairMark, questMark, portalMark, pathMark, playerMark, monsterMark, npcDot, edgeArrow, compassRose, label, markerSample, routeLine, goalFlag } from './minimap/glyphs.js';

// Painted north-up map of the loaded map (minimap + the M full map).
//
//   new Minimap(canvas, fullCanvas, footprints, options)
// options (all optional; the map hook documented in src/world/README.md):
//   bounds      walk bounds of the map (walkBounds(map))
//   landmarks   public atlas locations; discovery quests still require visiting
//   portals     warps, drawn as glowing rings labelled with `toName`
//   discovered  Set of discovered landmark ids (outlives a map change)
//   world, map  buildWorld() result and its MAPS entry: the ground, water, trees,
//               walls and roofs are painted once from them (src/ui/minimap/paintBase.js);
//               the palette follows map.minimap.theme / map.theme / map.id (mapStyle.js)
//   regionAt    (x, z) → region, for zone names on the full map
//   onPick      (landmark) => void, legacy navigation callback
//   onSelect    (entry) => void, select a public place or a cluster's member list
//   onOpen      () => void, a tap / click on the minimap (opens the big map)
//   onWalk      (x, z) => bool, a tap / click anywhere else on the full map:
//               walk there (navigation); state.nav = { goal, route } draws the way
// Per refresh (Game calls it every ~120 ms, never per frame):
//   update(p, yaw, state)  /  drawFull(p, yaw, state)
//   state: { t, night 0..1, npcs, monsters, quest(npcId), targets: Set, view: [{x,z}×4] }
// Call invalidate() when something painted into the base changes.
// `stats` = { buildMs, drawMs, fullMs, trees }.
const VIEW_UNITS = 120, MONSTER_RADIUS = 48;

export class Minimap {
  constructor(canvas, fullCanvas, footprints, { bounds, landmarks = LANDMARKS, portals = [], discovered = new Set(), world = null, map = null, regionAt = null, onPick = null, onWalk = null, onOpen = null, onSelect = null } = {}) {
    Object.assign(this, { canvas, full: fullCanvas, landmarks, portals, discovered, world, map, regionAt, onPick, onWalk, onOpen, onSelect });
    this.bounds = bounds ?? world?.map?.view;
    this.theme = themeFor(map ?? world?.map ?? {});
    this.ctx = canvas.getContext('2d');
    this.hits = []; this.stats = { buildMs: 0, drawMs: 0, fullMs: 0, trees: 0 };
    this.world = world ?? { footprints, map: { walk: [this.bounds] } };
    this.directory = mapDirectory(map ?? world?.map ?? { id: 'city' }, landmarks, portals, this.world.spots);
    this.bossLairs = this.directory.filter(e => e.category === 'bosses');
    this.build();
    this.bindFull();
    for (const c of [canvas, fullCanvas]) decorateFrame(c?.parentElement);
  }
  build() {
    const regionAt = this.regionAt ? (x, z) => this.regionAt(x, z, true) : null;
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
    if (full) return this.fullMarkers(g, to, ui, state, p);
    const hits = full ? [] : null, cw = g.canvas.width, ch = g.canvas.height, onScreen = (x, y, m = 12) => x > -m && y > -m && x < cw + m && y < ch + m;
    const t = state.t ?? 0, targets = state.targets ?? new Set();
    // Three navigable hunting circuits, matching the expedition's painted trails.
    if(this.map?.expedition){
      g.save();g.strokeStyle='rgba(110,75,36,.55)';g.lineWidth=Math.max(1,ui*.12);g.setLineDash([ui*.35,ui*.2]);
      for(const x of [-76,0,76]){g.beginPath();for(const [n,[px,pz]] of [[x-17,this.map.top-55],[x-17,this.map.top-183],[x+17,this.map.top-183],[x+17,this.map.top-55]].entries()){const [sx,sy]=to(px,pz);n?g.lineTo(sx,sy):g.moveTo(sx,sy);}g.closePath();g.stroke();}g.restore();
    }
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
      else if (m.kind === 'shop' || m.kind === 'trainer' || m.kind === 'travel') services.push([x, y, m, n]);
      else if (k > 1.1 || full) npcDot(g, x, y, ui * (full ? .2 : .22), m.kind);
    }
    // Monsters only on unsafe maps, near the player.
    if (this.map?.safe === false && p) for (const m of state.monsters ?? []) {
      if (!m.alive || Math.hypot(m.x - p.x, m.z - p.z) > MONSTER_RADIUS) continue;
      if (overlapsBossLair(m, this.bossLairs, to, ui * .85)) continue;
      const [x, y] = to(m.x, m.z); if (onScreen(x, y)) monsterMark(g, x, y, ui * .26, !!(m.def?.elite || m.def?.boss));
    }
    // Public landmark badges; discovery state only controls active quest targets.
    const landmarks = found => { for (const l of this.landmarks) {
      const m = landmarkMarker(l, this.discovered, HALLS);
      if (!!m.found !== found) continue;
      const [x, y] = to(l.x, l.z); if (!onScreen(x, y, 20)) continue;
      const r = ui * (full ? .62 : .55);
      badge(g, x, y, r, m.glyph === 'hall' ? `class:${m.classId}` : m.glyph, m.glyph === 'hall' ? 'hall' : 'gold');
      if (targets.has(l.id) && !m.found) questMark(g, x, y - r * 1.9, r * .7, '!', t);
      if (full && m.found) label(g, l.name, x, y + r * 1.75, Math.round(ui * .5), { weight: 600 });
      hits?.push({ x, y, r: r * 1.5, title: m.found ? `${l.name}${l.text ? ` — ${l.text}` : ''}` : 'สถานที่ที่ยังไม่ค้นพบ', landmark: m.found ? l : null });
    } };
    landmarks(false);
    const placed = [];
    for (const [x, y, m, n] of services) {
      const r = ui * (full ? .52 : .48);
      if (this.landmarks.some(l => (l.purpose === m.purpose || l.classId === m.classId && m.classId) && Math.hypot(l.x - n.x, l.z - n.z) < 14)) continue;
      if (placed.some(([a, b]) => Math.hypot(a - x, b - y) < r * 1.5)) continue; // stalls side by side: one badge
      placed.push([x, y]);
      badge(g, x, y, r, m.kind === 'trainer' ? `class:${m.classId}` : m.purpose, m.kind === 'trainer' ? 'hall' : 'shop');
      hits?.push({ x, y, r: r * 1.4, title: `${n.def.name}${SHOPS[n.def.shopType] ? ` · ${SHOPS[n.def.shopType].title}` : TRAINERS[n.def.trainer] ? ` · ${TRAINERS[n.def.trainer].title}` : ''}` });
    }
    landmarks(true);
    for (const [x, y, m, n] of quests) { questMark(g, x, y, ui * .5, m.glyph, t); hits?.push({ x, y, r: ui, title: `${n.def.name} · ${m.glyph === '?' ? 'ส่งเควส' : 'มีเควส'}` }); }
    // Hunting markers walk to the sign's clear approach point, outside the spawn centre.
    for(const camp of huntingFor(this.map?.id)) {
      const [x,y]=to(camp.x,camp.z);if(!onScreen(x,y,30))continue;
      const r=ui*.55;
      badge(g,x,y,r,'combat','gold');
      label(g,full ? `${camp.name} · ${huntingLevel(camp)}` : huntingLevel(camp),x,y+r*1.8,Math.round(ui*.5),{weight:600});
      hits?.push({x,y,r:ui,title:`${camp.name} · ${huntingLevel(camp)} · จุดเก็บเลเวล${camp.party?` · ทีม ${camp.party[0]}–${camp.party[1]} คน`:""}`,goal:camp.approach});
    }
    // Warps (glowing rings) and trail exits (signposts), with the destination on the full map.
    for (const w of this.portals) {
      const at = w.at, [x, y] = to(at.x, at.z), path = portalStyle(w) === 'path';
      if (onScreen(x, y, 30)) {
        // The signpost arrow points out of the map: north for exits in the north half, else south.
        if (path) pathMark(g, x, y, ui * (full ? .5 : .44), w.at.z < (this.bounds.minZ + this.bounds.maxZ) / 2 ? -Math.PI / 2 : Math.PI / 2);
        else portalMark(g, x, y, ui * (full ? .5 : .42), t);
      }
      if (full) label(g, `${w.name ?? 'ประตูวาป'} → ${w.toName ?? w.to}`, x, y - ui * 1.25, Math.round(ui * .5), { color: '#5a2e08', weight: 600 });
      hits?.push({ x, y, r: ui, title: `${w.name ?? 'ประตูวาป'} → ${w.toName ?? w.to}` });
    }
    this.miniBossMarkers(g, to, ui, p);
    if (hits) this.hits = hits;
  }

  // Permanent lairs, even when no monster is loaded/alive. Off-screen lairs
  // sit on the border; nearby border badges cluster instead of stacking text.
  miniBossMarkers(g, to, ui, p) {
    const lairs = this.bossLairs ?? [], cw = g.canvas.width, ch = g.canvas.height, r = ui * .62;
    const points = lairs.map(entry => {
      let [x, y] = to(entry.x, entry.z);
      const edge = edgePoint(x - cw / 2, y - ch / 2, cw / 2, ch / 2, r * 1.4);
      if (edge) { x = cw / 2 + edge.x; y = ch / 2 + edge.y; }
      return { x, y, entry };
    });
    const labels = [], obstacles = [
      { x: cw / 2 - ui, y: ch / 2 - ui, w: ui * 2, h: ui * 2 },
      { x: cw - ui * 1.8, y: 0, w: ui * 1.8, h: ui * 1.8 },
    ];
    for (const portal of this.portals ?? []) {
      let [x, y] = to(portal.at.x, portal.at.z);
      const edge = edgePoint(x - cw / 2, y - ch / 2, cw / 2, ch / 2, ui * .55);
      if (edge) { x = cw / 2 + edge.x; y = ch / 2 + edge.y; }
      obstacles.push({ x: x - ui * .6, y: y - ui * .6, w: ui * 1.2, h: ui * 1.2 });
    }
    for (const group of clusterMarkers(points, r * 2.2)) {
      const entries = group.points.map(point => point.entry).sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z));
      const e = entries[0]; let { x, y } = group;
      const ox = x, oy = y, placed = placeBossBadge(x, y, r + 2, cw, ch, obstacles);
      x = placed.x; y = placed.y;
      if (x !== ox || y !== oy) {
        g.save(); g.strokeStyle = '#711f26'; g.lineWidth = 1;
        g.beginPath(); g.moveTo(ox, oy); g.lineTo(x, y); g.stroke(); g.restore();
      }
      bossLairMark(g, x, y, r);
      if (entries.length > 1) label(g, String(entries.length), x + r * .85, y - r * .7, ui * .5, { color: '#ffe0a0', halo: '#711f26', serif: false, weight: 700 });
      obstacles.push({ x: x - r - 2, y: y - r - 2, w: r * 2 + 4, h: r * 2 + 4 });
      const text = `${e.bossName} · Lv ${e.level}`, size = Math.round(ui * .62);
      g.font = `600 ${size}px "Noto Sans Thai", sans-serif`;
      labels.push({ x, y, text, radius: r, size, width: g.measureText(text).width + 6, height: size * 1.6,
        priority: -Math.hypot(e.x - p.x, e.z - p.z) });
    }
    for (const placed of placeLabels(labels, obstacles, cw, ch)) {
      const box = placed.box;
      label(g, placed.text, box.x + box.w / 2, box.y + box.h / 2, placed.size, { color: '#711f26', serif: false, weight: 600 });
    }
  }

  fullMarkers(g, to, ui, state, p) {
    const cw = g.canvas.width, ch = g.canvas.height, r = ui * .52;
    const entries = filterPlaces(this.directory, this.filter, this.search, p), labels = [], obstacles = [
      { x: cw / 2 - 145 * devicePixelRatio, y: ch - 64 * devicePixelRatio, w: 290 * devicePixelRatio, h: 64 * devicePixelRatio },
      { x: cw - 65 * devicePixelRatio, y: 0, w: 65 * devicePixelRatio, h: 65 * devicePixelRatio },
    ];
    this.hits = [];
    const onScreen = (x, y) => x > -r && y > -r && x < cw + r && y < ch + r;
    const groups = clusterMarkers(entries.map(e => { const [x, y] = to(e.x, e.z); return { x, y, entry: e }; }).filter(p => onScreen(p.x, p.y)), r * 2.15);
    for (const group of groups) {
      const members = group.points.map(p => p.entry), selected = members.find(e => e.id === this.selectedId), e = selected ?? members.find(e => e.category === 'bosses') ?? members[0];
      let { x, y } = group;
      // Keep the player arrow clear. A fine leader preserves the actual map position.
      const [px, py] = to(p.x, p.z), away = Math.hypot(x - px, y - py), separation = r + ui * .65;
      if (away < separation) {
        const dx = away > 1 ? (x - px) / away : 0, dy = away > 1 ? (y - py) / away : 1;
        const ox = x, oy = y; x = px + dx * separation; y = py + dy * separation;
        g.save(); g.strokeStyle = '#5c462b'; g.lineWidth = devicePixelRatio; g.beginPath(); g.moveTo(ox, oy); g.lineTo(x, y); g.stroke(); g.restore();
      }
      if (e.portal) {
        if (portalStyle(e.portal) === 'path') pathMark(g, x, y, r, e.z < (this.bounds.minZ + this.bounds.maxZ) / 2 ? -Math.PI / 2 : Math.PI / 2);
        else portalMark(g, x, y, r, state.t ?? 0);
      } else if (e.category === 'bosses') bossLairMark(g, x, y, r);
      else badge(g, x, y, r, e.glyph, e.category === 'training' ? 'hall' : e.category === 'shops' ? 'shop' : 'gold');
      if (members.length > 1) {
        g.save(); g.fillStyle = '#142e28'; g.beginPath(); g.arc(x + r * .65, y - r * .65, r * .68, 0, Math.PI * 2); g.fill(); g.restore();
        label(g, String(members.length), x + r * .65, y - r * .65, ui * .5, { color: '#fff0b7', halo: '#142e28', serif: false, weight: 700 });
      }
      if (selected) {
        g.save(); g.strokeStyle = '#fff4bc'; g.lineWidth = 2 * devicePixelRatio;
        g.beginPath(); g.arc(x, y, r * 1.4, 0, Math.PI * 2); g.stroke(); g.restore();
      }
      const cluster = members.length > 1;
      const boss = members.find(m => m.category === 'bosses');
      const title = cluster ? boss ? `${boss.name} · +${members.length - 1} จุด` : `${members.every(m => m.category === 'training') ? 'สำนักครู' : 'สถานที่'} · ${members.length} จุด` : e.name;
      const hit = { x, y, r: r * 1.5, title: `${title} · ${e.tag ?? ''}`, entry: cluster ? { cluster: members } : e, landmark: cluster ? null : e.landmark, goal: cluster ? null : e.goal };
      this.hits.push(hit);
      obstacles.push({ x: x - r - 3, y: y - r - 3, w: 2 * r + 6, h: 2 * r + 6 });
      const size = Math.round(ui * .6); g.font = `600 ${size}px "Noto Sans Thai", sans-serif`;
      const text = selected ? selected.name : title;
      labels.push({ x, y, text, hit, radius: r, size, width: g.measureText(text).width + 12, height: size * 1.65,
        priority: e.id === this.selectedId ? 200 : e.purpose === 'upgrade' ? 100 : e.category === 'bosses' ? 90 : e.category === 'shops' ? 80 : e.category === 'travel' ? 70 : 20 });
    }
    const [px, py] = to(p.x, p.z); obstacles.push({ x: px - ui, y: py - ui, w: ui * 2, h: ui * 2 });
    const displayedLairs = entries.filter(e => e.category === 'bosses');
    if (this.map?.safe === false) for (const m of state.monsters ?? []) {
      if (!m.alive || Math.hypot(m.x - p.x, m.z - p.z) > MONSTER_RADIUS) continue;
      if (overlapsBossLair(m, displayedLairs, to, ui * .85)) continue;
      const [x, y] = to(m.x, m.z); if (onScreen(x, y)) monsterMark(g, x, y, ui * .26, !!(m.def?.elite || m.def?.boss));
    }
    for (const n of state.npcs ?? []) {
      const quest = state.quest?.(n.id); if (!quest || n.indoors) continue;
      const m = npcMarker(n.def, { quest }); if (m.kind !== 'quest') continue;
      const [x, y] = to(n.x, n.z); if (!onScreen(x, y)) continue;
      questMark(g, x, y - r * 1.8, r * .7, m.glyph, state.t ?? 0);
      this.hits.push({ x, y: y - r * 1.8, r, title: `${n.def.name} · ${m.glyph === '?' ? 'ส่งเควส' : 'มีเควส'}`, goal: { x: n.x, z: n.z } });
      obstacles.push({ x: x - r, y: y - r * 2.8, w: r * 2, h: r * 2 });
    }
    this.fullLabels = placeLabels(labels, obstacles, cw, ch);
    for (const l of this.fullLabels) {
      const b = l.box; g.save(); g.fillStyle = 'rgba(247,237,209,.91)'; g.strokeStyle = 'rgba(101,75,37,.35)'; g.lineWidth = devicePixelRatio;
      g.beginPath(); g.roundRect(b.x, b.y, b.w, b.h, 4 * devicePixelRatio); g.fill(); g.stroke(); g.restore();
      label(g, l.text, b.x + b.w / 2, b.y + b.h / 2, l.size, { serif: false, weight: 600 });
      this.hits.push({ ...l.hit, box: b });
    }
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
    this.mini = { px: p.x, pz: p.z, k, cw, ch };
    this.drawNav(g, to, ui, state, p);
    this.markers(g, to, k, ui, state, { p });
    // Off-screen warps and quest targets: arrows on the edge.
    const edge = (x, z, color) => { const e = edgePoint((x - p.x) * k, (z - p.z) * k, cw / 2, ch / 2, ui * .55); if (e) edgeArrow(g, cw / 2 + e.x, ch / 2 + e.y, e.angle, ui * .38, color); };
    for (const w of this.portals) { const at = w.at; edge(at.x, at.z, portalStyle(w) === 'path' ? '#e2b469' : '#ffe08a'); }
    for (const l of this.landmarks) if (state.targets?.has(l.id) && !this.discovered.has(l.id) && (!l.hidden)) edge(l.x, l.z, '#e2643a');
    playerMark(g, cw / 2, ch / 2, ui * .5, yaw);
    compassRose(g, cw - ui * .95, ui * .95, ui * .72, state.night > .5);
    this.stats.drawMs = +(performance.now() - t0).toFixed(2);
  }
  // The way being walked (state.nav): from the player through the waypoints to the flag.
  drawNav(g, to, ui, state, p) {
    const nav = state.nav; if (!nav?.goal) return;
    routeLine(g, [to(p.x, p.z), ...nav.route.map(w => to(w.x, w.z))], ui * .5, state.t ?? 0);
    goalFlag(g, ...to(nav.goal.x, nav.goal.z), ui * .55, state.t ?? 0);
  }
  // Canvas pixel (from a pointer event) → world point, on the minimap or the full map.
  worldAt(c, e) {
    const r = c.getBoundingClientRect(), x = (e.clientX - r.left) * c.width / r.width, y = (e.clientY - r.top) * c.height / r.height;
    if (c === this.canvas && this.mini) { const m = this.mini; return { x: m.px + (x - m.cw / 2) / m.k, z: m.pz + (y - m.ch / 2) / m.k }; }
    const f = this.fullView;
    if (c === this.full && f && x >= f.left && y >= f.top && x <= f.left + f.w && y <= f.top + f.h) return { x: f.minX + (x - f.left) / f.k, z: f.minZ + (y - f.top) / f.k };
    return null;
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
    this.fullState = { p, yaw, state };
    if (!this.fullCamera) this.resetFull();
    clampCamera(R, cw, ch, this.fullCamera);
    const { k, w, h, left, top } = mapTransform(R, cw, ch, this.fullCamera);
    g.clearRect(0, 0, cw, ch);
    g.fillStyle = '#d3c6a0'; g.fillRect(0, 0, cw, ch);
    g.imageSmoothingEnabled = true; g.drawImage(B.canvas, left, top, w, h);
    // The atlas remains readable at night, independent of the world's lighting.
    g.strokeStyle = '#6b4a22'; g.lineWidth = Math.max(1, devicePixelRatio); g.strokeRect(left, top, w, h);
    const ui = 22 * devicePixelRatio, to = (x, z) => [left + (x - R.minX) * k, top + (z - R.minZ) * k];
    this.fullView = { left, top, k, minX: R.minX, minZ: R.minZ, w, h };
    this.drawNav(g, to, ui * .8, state, p);
    this.markers(g, to, k, ui, state, { full: true, p });
    playerMark(g, ...to(p.x, p.z), ui * .55, yaw);
    compassRose(g, cw - ui * 1.5, ui * 1.5, ui, 0);
    // Scale bar: 50 units.
    const sx = ui, sy = ch - ui, units = 50 * k < cw * .35 ? 50 : 10, len = units * k;
    g.fillStyle = '#3a2612'; g.fillRect(sx, sy, len, Math.max(2, ui * .12)); g.fillRect(sx, sy - ui * .2, 2, ui * .4); g.fillRect(sx + len - 2, sy - ui * .2, 2, ui * .4);
    label(g, `${units} วา`, sx + len / 2, sy - ui * .6, Math.round(ui * .55), { serif: false });
    this.stats.fullMs = +(performance.now() - t0).toFixed(2);
  }
  redrawFull() { if (this.fullState) this.drawFull(this.fullState.p, this.fullState.yaw, this.fullState.state); }
  resetFull(whole = false) {
    const [w, h] = this.fit(this.full), R = this.base.rect;
    const short = h / devicePixelRatio < 300;
    const focus = !whole && this.map?.id === 'city' ? short ? { minX: -70, maxX: 116, minZ: 8, maxZ: 122 } : { minX: Math.max(R.minX, -92), maxX: R.maxX, minZ: -119, maxZ: 177 } : R;
    this.fullCamera = fittedCamera(R, w, h, focus); this.redrawFull();
  }
  focusFull(p) {
    if (!this.fullCamera) this.resetFull();
    this.fullCamera.x = p.x; this.fullCamera.z = p.z; this.redrawFull();
  }
  zoomFull(factor, point = null) {
    if (!this.fullCamera) this.resetFull();
    const before = this.fullCamera.zoom, after = Math.max(.7, Math.min(6, before * factor));
    if (point) { this.fullCamera.x = point.x + (this.fullCamera.x - point.x) * before / after; this.fullCamera.z = point.z + (this.fullCamera.z - point.z) * before / after; }
    this.fullCamera.zoom = after; this.redrawFull();
  }
  // Tooltips and click-to-walk on the full map.
  bindFull() {
    const c = this.full; if (!c || c.dataset.bound) return;
    c.dataset.bound = '1';
    const tip = c.parentElement?.querySelector('.map-tip');
    const find = e => { const r = c.getBoundingClientRect(), x = (e.clientX - r.left) * c.width / r.width, y = (e.clientY - r.top) * c.height / r.height; return [...(c._minimap?.hits ?? [])].reverse().find(h => h.box ? x >= h.box.x && x <= h.box.x + h.box.w && y >= h.box.y && y <= h.box.y + h.box.h : Math.hypot(h.x - x, h.y - y) < h.r) ?? null; };
    let drag = null, dragged = false, pinchDistance = 0; const pointers = new Map();
    const span = () => { const [a, b] = [...pointers.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
    c.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 1) { drag = { x: e.clientX, y: e.clientY }; dragged = false; }
      else { drag = null; dragged = true; pinchDistance = span(); }
      c.setPointerCapture(e.pointerId);
    });
    c.addEventListener('pointermove', e => {
      if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) {
        const distance = span(), [a, b] = [...pointers.values()], m = c._minimap;
        if (pinchDistance > 0) m?.zoomFull(distance / pinchDistance, m.worldAt(c, { clientX: (a.x + b.x) / 2, clientY: (a.y + b.y) / 2 }));
        pinchDistance = distance; return;
      }
      if (!drag) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!dragged && Math.hypot(dx, dy) < 6) return;
      dragged = true; const m = c._minimap, rect = c.getBoundingClientRect();
      if (m?.fullView) { m.fullCamera.x -= dx * c.width / rect.width / m.fullView.k; m.fullCamera.z -= dy * c.height / rect.height / m.fullView.k; m.redrawFull(); }
      drag = { x: e.clientX, y: e.clientY };
    });
    c.addEventListener('pointerup', e => { pointers.delete(e.pointerId); drag = null; pinchDistance = 0; });
    c.addEventListener('pointercancel', e => { pointers.delete(e.pointerId); drag = null; dragged = true; pinchDistance = 0; });
    c.addEventListener('wheel', e => { e.preventDefault(); const m = c._minimap; m?.zoomFull(e.deltaY < 0 ? 1.15 : 1 / 1.15, m.worldAt(c, e)); }, { passive: false });
    c.addEventListener('mousemove', e => {
      const h = find(e); c.style.cursor = (h?.entry || h?.landmark || h?.goal) ? 'pointer' : 'grab';
      if (!tip) { c.title = h?.title ?? ''; return; }
      tip.hidden = !h; if (!h) return;
      tip.textContent = h.title + ((h.landmark || h.goal) ? ' · เลือกสถานที่' : '');
      const pr = c.parentElement.getBoundingClientRect(), z = pr.width / c.parentElement.offsetWidth || 1;
      tip.style.left = `${(e.clientX - pr.left) / z + 14}px`; tip.style.top = `${(e.clientY - pr.top) / z + 10}px`;
    });
    c.addEventListener('mouseleave', () => { if (tip) tip.hidden = true; });
    // Select authored destinations. Ground clicks retain the existing navigation fallback.
    c.addEventListener('click', e => {
      if (dragged) { dragged = false; return; }
      const m = c._minimap, h = find(e);
      if (h?.entry && m?.onSelect) return m.onSelect(h.entry);
      if (h?.goal) return m?.onWalk?.(h.goal.x,h.goal.z,true);
      if (h?.landmark) return m?.onPick?.(h.landmark);
      const at = m?.worldAt(c, e); if (at) m.onWalk?.(at.x, at.z, true);
    });
    // the minimap: a tap opens the big map (walk by tapping there); its canvas is shared across map changes too
    const mini = this.canvas;
    if (mini && !mini.dataset.bound) {
      mini.dataset.bound = '1'; mini.style.cursor = 'pointer'; mini.title = 'แตะ / คลิกเพื่อเปิดแผนที่ใหญ่ (M)';
      mini.addEventListener('click', () => mini._minimap?.onOpen?.());
    }
  }
  // The full map's canvas is shared across map changes; route events to the live minimap.
  activate() { if (this.full) this.full._minimap = this; if (this.canvas) this.canvas._minimap = this; return this; }

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
