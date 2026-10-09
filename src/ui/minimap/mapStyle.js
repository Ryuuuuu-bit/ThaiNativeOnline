// Pure minimap helpers (no DOM, no three): palettes, cell colours, marker
// classification and small geometry. Tested in tests/minimap.test.js.
//
// Palette choice for a map (src/world/maps.js entry), first match wins:
//   map.minimap.theme or map.theme (a THEMES key or alias), map.id (key or alias),
//   words in the id (forest, wat/ruin, paddy/rice/field), then safe → 'city',
//   unsafe → 'wild'. `map.minimap.colors` (or an object `map.theme`) overrides
//   single colours.

export const THEMES = {
  // Rice-paper city plan: warm parchment, terracotta roofs, ink-blue river.
  city: {
    paper: '#ecdcb4', edge: '#b99b66', land: '#ddd4a6', wild: '#9aa774', track: '#d6ad6c', trackEdge: '#9a7444',
    water: '#5f8fa6', waterDeep: '#3f6f8c', ink: '#4a3420', waterInk: '#244a63', paddy: '#a9bb72', paddyInk: '#6f8746',
    tree: '#6e8a4c', treeDark: '#3f5a32', roof: '#b4583c', roofStone: '#8f4d38', roofDark: '#6d3626', wall: '#93452f', wallTop: '#e2b98a',
    deck: '#9a7146', ruin: '#9a968a', temple: '#e3cf9e', wash: '#efe3c3',
  },
  // Open country: greener paper, wide paddies.
  paddy: {
    paper: '#e8dcb0', edge: '#a99a62', land: '#cfcf92', wild: '#93a866', track: '#d2aa6a', trackEdge: '#93703f',
    water: '#5f93a3', waterDeep: '#3f7387', ink: '#43361f', waterInk: '#23495c', paddy: '#9fc06a', paddyInk: '#5f8a3c',
    tree: '#64874a', treeDark: '#38552e', roof: '#a8683e', roofStone: '#8a5a3a', roofDark: '#5f3c22', wall: '#8b5a3a', wallTop: '#d9b88a',
    deck: '#957044', ruin: '#9a968a', temple: '#ddcb98', wash: '#ece2c0',
  },
  // Mixed wilds (the old fields map): grass fading into forest.
  wild: {
    paper: '#e4d6aa', edge: '#a08d5a', land: '#c4c58a', wild: '#7d9460', track: '#cfa86c', trackEdge: '#8e6c3e',
    water: '#5a8c9c', waterDeep: '#3b6a80', ink: '#3f3420', waterInk: '#21465a', paddy: '#9cbb68', paddyInk: '#5c873a',
    tree: '#5c7f45', treeDark: '#33502b', roof: '#a2643c', roofStone: '#86573a', roofDark: '#5a3a22', wall: '#86573a', wallTop: '#d4b386',
    deck: '#8f6b40', ruin: '#8f8c82', temple: '#d6c493', wash: '#e9dfbd',
  },
  // Deep forest: dark sage paper, dense canopy.
  forest: {
    paper: '#d9d0a6', edge: '#8c7f52', land: '#a9b27c', wild: '#62784e', track: '#c4a26c', trackEdge: '#7d6038',
    water: '#4f8090', waterDeep: '#335e72', ink: '#33301d', waterInk: '#1c3d4f', paddy: '#8fae62', paddyInk: '#557a36',
    tree: '#4f7040', treeDark: '#2a4426', roof: '#8f5e3a', roofStone: '#7a5638', roofDark: '#4c3220', wall: '#7a5638', wallTop: '#c9aa7e',
    deck: '#84633c', ruin: '#868479', temple: '#cbb98a', wash: '#e2d8b4',
  },
  // Marsh: olive-brown paper, wide tea-coloured water.
  klong: {
    paper: '#d8d2ac', edge: '#857d55', land: '#a8ae80', wild: '#6f805a', track: '#c2a670', trackEdge: '#7a6440',
    water: '#5d8278', waterDeep: '#3f6158', ink: '#34321f', waterInk: '#1f3d36', paddy: '#8aa868', paddyInk: '#55743c',
    tree: '#58744a', treeDark: '#30472a', roof: '#8a6a44', roofStone: '#76603e', roofDark: '#4e3c24', wall: '#7a6644', wallTop: '#c8b088',
    deck: '#86683e', ruin: '#8c8a7e', temple: '#c9b98c', wash: '#e2dab8',
  },
  // Ruined temple grounds: grey-ochre, cold stone.
  ruins: {
    paper: '#ddd5bb', edge: '#8e8670', land: '#bdbb98', wild: '#7f8a6a', track: '#c9b088', trackEdge: '#80704f',
    water: '#5d8590', waterDeep: '#3e6470', ink: '#36322a', waterInk: '#203f4a', paddy: '#97ab72', paddyInk: '#5e7642',
    tree: '#5e7550', treeDark: '#344a30', roof: '#8a7a66', roofStone: '#7a6e60', roofDark: '#4e463c', wall: '#7d7466', wallTop: '#cfc4ad',
    deck: '#86704f', ruin: '#9b978d', temple: '#cfc2a2', wash: '#e6dfca',
  },
};
const ALIASES = { marsh: 'klong', swamp: 'klong', fields: 'wild', rice: 'paddy', paddy_fields: 'paddy', deep_forest: 'forest', jungle: 'forest', wat_rang: 'ruins', wat: 'ruins', ruin: 'ruins', temple_ruins: 'ruins' };
const WORDS = [[/forest|jungle|pa_?luek/, 'forest'], [/wat|ruin|shrine|cemetery/, 'ruins'], [/paddy|rice|field|farm/, 'paddy'], [/city|town|nakhon/, 'city']];

const known = k => (typeof k === 'string' ? (THEMES[k] ? k : ALIASES[k]) : null);
export function themeKey(map = {}) {
  const opt = map.minimap ?? {};
  for (const k of [opt.theme, map.theme, map.id]) { const hit = known(k); if (hit) return hit; }
  const id = String(map.id ?? '').toLowerCase();
  for (const [re, key] of WORDS) if (re.test(id)) return key;
  return map.safe === false ? 'wild' : 'city';
}
export function themeFor(map = {}) {
  const key = themeKey(map), opt = map.minimap ?? {};
  const over = { ...(typeof map.theme === 'object' ? map.theme : {}), ...(opt.colors ?? {}) };
  return { key, ...THEMES[key], ...over };
}

// ---- colour math ----
export function hex(c) {
  const s = c.replace('#', ''), n = parseInt(s.length === 3 ? s.replace(/./g, ch => ch + ch) : s.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);

// Region ids → how the ground is tinted (cosmetic only; unknown ids are plain land).
export const REGION_TONES = { cemetery: 'ruin', shrine: 'ruin', temple: 'temple' };

// Converted palette for the raster pass (computed once per map).
export function rasterPalette(theme) {
  const out = {};
  for (const k of ['land', 'wild', 'track', 'water', 'waterDeep', 'paddy', 'ruin', 'temple']) out[k] = hex(theme[k]);
  return out;
}
// Colour of one 1×1 ground cell. `s`: { deep, shallow, grass 0..1, wild 0..1, shade -1..1, tone, depth 0..1 }.
// Returns [r, g, b] (0..255, unrounded).
export function cellColor(pal, s) {
  let c;
  if (s.deep) c = mix(pal.water, pal.waterDeep, clamp01(s.depth ?? .5));
  else if (s.shallow) c = pal.paddy;
  else if (s.grass < .12) c = s.tone === 'temple' ? pal.temple : pal.track;
  else {
    c = mix(pal.land, pal.wild, clamp01(s.wild * 1.15));
    if (s.tone === 'ruin') c = mix(c, pal.ruin, .7);
    else if (s.tone === 'temple') c = mix(c, pal.temple, .45);
  }
  const k = 1 + Math.max(-.22, Math.min(.22, s.shade ?? 0));
  return [c[0] * k, c[1] * k, c[2] * k];
}

// ---- markers ----
// What an NPC is on the map. `quest` is the quest marker ('!', '?', '…' or null).
export function npcMarker(def, { shops = {}, trainers = {}, quest = null } = {}) {
  if (quest === '!' || quest === '?') return { kind: 'quest', glyph: quest };
  if (def.trainer && trainers[def.trainer]) return { kind: 'trainer', classId: trainers[def.trainer].classId ?? null };
  if (def.shopType && shops[def.shopType]) return { kind: 'shop', purpose: shops[def.shopType].purpose ?? 'trade', stock: !!shops[def.shopType].stock?.length };
  if (def.faction) return { kind: 'guard' };
  return { kind: 'npc' };
}
// Atlas visibility is independent of having visited a place for quest progression.
export function landmarkMarker(l, discovered, halls = []) {
  const found = discovered.has(l.id);
  const hall = halls.find(h => h.id === l.id);
  return { kind: 'landmark', glyph: hall ? 'hall' : (l.purpose ?? 'story'), classId: hall?.classId ?? null, found };
}
// Landmark ids the active quests still want discovered.
export function questTargets(active = []) {
  const ids = new Set();
  for (const q of active) for (const o of q.objectives ?? []) if (o.discover) ids.add(o.discover);
  return ids;
}

// ---- geometry ----
// Point (dx, dy) relative to the minimap centre, pulled onto the edge of a
// half-size (hw, hh) box less `margin` when it lies outside. Returns null if inside.
export function edgePoint(dx, dy, hw, hh, margin = 0) {
  const ex = hw - margin, ey = hh - margin;
  if (Math.abs(dx) <= ex && Math.abs(dy) <= ey) return null;
  const t = Math.min(ex / Math.abs(dx || 1e-9), ey / Math.abs(dy || 1e-9));
  return { x: dx * t, y: dy * t, angle: Math.atan2(dy, dx) };
}
// Grow a rect by `pad`, clipped to `limit` (when given).
export function padRect(r, pad, limit = null) {
  const out = { minX: r.minX - pad, maxX: r.maxX + pad, minZ: r.minZ - pad, maxZ: r.maxZ + pad };
  if (limit) { out.minX = Math.max(out.minX, limit.minX); out.maxX = Math.min(out.maxX, limit.maxX); out.minZ = Math.max(out.minZ, limit.minZ); out.maxZ = Math.min(out.maxZ, limit.maxZ); }
  return out;
}
// Marching squares over a (w+1)×(h+1) corner grid of 0/1 values: segments
// [x1, y1, x2, y2] in grid units along the boundary between 0 and 1 corners.
export function contourSegments(field, w, h) {
  const out = [], gw = w + 1;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const a = field[j * gw + i], b = field[j * gw + i + 1], c = field[(j + 1) * gw + i + 1], d = field[(j + 1) * gw + i];
    const code = a | b << 1 | c << 2 | d << 3;
    if (code === 0 || code === 15) continue;
    const T = [i + .5, j], R = [i + 1, j + .5], B = [i + .5, j + 1], L = [i, j + .5];
    const seg = (p, q) => out.push([p[0], p[1], q[0], q[1]]);
    switch (code) {
      case 1: case 14: seg(L, T); break;
      case 2: case 13: seg(T, R); break;
      case 3: case 12: seg(L, R); break;
      case 4: case 11: seg(R, B); break;
      case 6: case 9: seg(T, B); break;
      case 7: case 8: seg(L, B); break;
      case 5: seg(L, T); seg(R, B); break;
      case 10: seg(T, R); seg(L, B); break;
    }
  }
  return out;
}
// Region label anchors from samples: [{ id, name, x, z, n }] for regions with at least `min` samples.
export function regionAnchors(samples, min = 1) {
  const acc = new Map();
  for (const { region, x, z } of samples) {
    if (!region) continue;
    const a = acc.get(region.id) ?? { id: region.id, name: region.name, x: 0, z: 0, n: 0 };
    a.x += x; a.z += z; a.n++; acc.set(region.id, a);
  }
  return [...acc.values()].filter(a => a.n >= min).map(a => ({ ...a, x: a.x / a.n, z: a.z / a.n }));
}

// Level band shown in the header: 'Lv 1–3' (null on safe maps / no band).
export const levelText = levels => (Array.isArray(levels) && levels.length ? `Lv ${levels[0]}${levels[1] && levels[1] !== levels[0] ? `–${levels[1]}` : ''}` : null);
// Portal look: 'warp' (glowing ring, default) or 'path' (trail exit signpost).
export const portalStyle = portal => (portal?.style === 'path' ? 'path' : 'warp');

// Legend rows of the full map (UI text).
export const LEGEND = [
  ['player', 'ตำแหน่งของคุณ'], ['portal', 'ประตูวาป'], ['path', 'ทางออกสู่แผนที่อื่น'], ['quest', 'เควส / เป้าหมาย'], ['landmark', 'สถานที่'],
  ['hall', 'สำนักครู'], ['shop', 'ร้านค้า'], ['guard', 'ทหาร / ชาวเมือง'], ['monster', 'มอนสเตอร์'], ['hunt', 'จุดเก็บเลเวล (Lv.)'],
];
