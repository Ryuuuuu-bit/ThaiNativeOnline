// Minimap pure helpers (src/ui/minimap/mapStyle.js): palette choice per map,
// ground cell colours, marker classification, edge arrows and the coastline.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { THEMES, themeKey, levelText, portalStyle, themeFor, hex, cellColor, rasterPalette, npcMarker, landmarkMarker, questTargets, edgePoint, padRect, contourSegments, regionAnchors, LEGEND } from '../src/ui/minimap/mapStyle.js';
import { MAPS } from '../src/world/maps.js';
import { SHOPS, TRAINERS } from '../src/data/shops.js';
import { NPCS } from '../src/data/npcs.js';
import { HALLS } from '../src/data/halls.js';
import { LANDMARKS } from '../src/data/landmarks.js';

test('every map gets a palette: explicit theme, id, id words, then the safe flag', () => {
  assert.equal(themeKey({ id: 'city', safe: true }), 'city');
  assert.equal(themeKey({ id: 'fields', safe: false }), 'wild');
  assert.equal(themeKey({ id: 'paddy', safe: false }), 'paddy');
  assert.equal(themeKey({ id: 'deep_forest', safe: false }), 'forest');
  assert.equal(themeKey({ id: 'wat_rang', safe: false }), 'ruins');
  assert.equal(themeKey({ id: 'old_ruin_east' }), 'ruins');
  assert.equal(themeKey({ id: 'mystery', safe: true }), 'city');
  assert.equal(themeKey({ id: 'mystery', safe: false }), 'wild');
  assert.equal(themeKey({ id: 'city', theme: 'forest' }), 'forest');
  assert.equal(themeKey({ id: 'city', minimap: { theme: 'ruins' } }), 'ruins');
  assert.equal(themeKey({ id: 'city', theme: 'no-such-theme' }), 'city');
  assert.equal(themeKey({ id: 'x', theme: 'wat' }), 'ruins');
  assert.equal(levelText([1, 3]), 'Lv 1–3'); assert.equal(levelText([4, 4]), 'Lv 4'); assert.equal(levelText(null), null);
  assert.equal(portalStyle({ style: 'path' }), 'path'); assert.equal(portalStyle({}), 'warp');
  const t = themeFor({ id: 'paddy', minimap: { colors: { water: '#000000' } } });
  assert.equal(t.water, '#000000'); assert.equal(t.paper, THEMES.paddy.paper); assert.equal(t.key, 'paddy');
  for (const map of Object.values(MAPS)) assert.ok(THEMES[themeKey(map)], `${map.id} has no palette`);
  for (const [key, theme] of Object.entries(THEMES)) for (const [k, c] of Object.entries(theme)) assert.match(c, /^#[0-9a-f]{6}$/i, `${key}.${k}`);
});

test('ground cells: water, paddy, track and land read as different colours', () => {
  const pal = rasterPalette(THEMES.city), same = (a, b) => a.every((v, i) => Math.abs(v - b[i]) < 1);
  assert.deepEqual(hex('#ff8000'), [255, 128, 0]); assert.deepEqual(hex('#fff'), [255, 255, 255]);
  const water = cellColor(pal, { deep: true, depth: 0 }), paddy = cellColor(pal, { shallow: true, grass: 0 });
  const track = cellColor(pal, { grass: 0 }), land = cellColor(pal, { grass: 1, wild: 0 }), forest = cellColor(pal, { grass: 1, wild: 1 });
  assert.ok(same(water, pal.water) && same(paddy, pal.paddy) && same(track, pal.track) && same(land, pal.land));
  assert.ok(!same(land, forest));
  assert.ok(water[2] > water[0], 'water is blue');
  const lit = cellColor(pal, { grass: 1, wild: 0, shade: .5 }), dark = cellColor(pal, { grass: 1, wild: 0, shade: -.5 });
  assert.ok(lit[0] > land[0] && dark[0] < land[0] && lit[0] <= land[0] * 1.23, 'relief shading is soft');
  assert.ok(!same(cellColor(pal, { grass: 1, wild: 0, tone: 'ruin' }), land), 'ruins are tinted');
});

test('NPC markers: quest first, then trainers, shops, guards, others', () => {
  const ctx = { shops: SHOPS, trainers: TRAINERS };
  assert.deepEqual(npcMarker({ shopType: 'general' }, { ...ctx, quest: '!' }), { kind: 'quest', glyph: '!' });
  assert.equal(npcMarker({ shopType: 'general' }, { ...ctx, quest: '…' }).kind, 'shop');
  assert.equal(npcMarker({ trainer: 'muay' }, ctx).classId, 'muaythai');
  assert.equal(npcMarker({ shopType: 'blacksmith' }, ctx).purpose, 'equipment');
  assert.equal(npcMarker({ faction: 'city_guard' }, ctx).kind, 'guard');
  assert.equal(npcMarker({}, ctx).kind, 'npc');
  assert.equal(npcMarker({ shopType: 'nope' }, ctx).kind, 'npc');
  for (const n of NPCS) if (n.trainer) assert.ok(npcMarker(n, ctx).classId, `${n.id} trainer has a class emblem`);
});

test('landmark markers: hidden until found, halls use the class emblem', () => {
  const none = new Set(), hall = LANDMARKS.find(l => HALLS.some(h => h.id === l.id));
  const hidden = LANDMARKS.find(l => l.hidden), open = LANDMARKS.find(l => !l.hidden && !HALLS.some(h => h.id === l.id));
  assert.equal(landmarkMarker(hidden, none, HALLS).kind, 'hidden');
  assert.equal(landmarkMarker(hidden, new Set([hidden.id]), HALLS).kind, 'landmark');
  assert.equal(landmarkMarker(open, none, HALLS).kind, 'unknown');
  assert.equal(landmarkMarker(open, new Set([open.id]), HALLS).glyph, open.purpose);
  if (hall) assert.equal(landmarkMarker(hall, new Set([hall.id]), HALLS).classId, HALLS.find(h => h.id === hall.id).classId);
  assert.deepEqual([...questTargets([{ objectives: [{ discover: 'market' }, { kill: 'boar' }] }, { objectives: [{ discover: 'port' }] }])], ['market', 'port']);
});

test('edge arrows sit on the minimap border; rects pad and clip', () => {
  assert.equal(edgePoint(10, 10, 50, 40), null);
  const e = edgePoint(200, 0, 50, 40, 5);
  assert.deepEqual([e.x, e.y], [45, 0]);
  const d = edgePoint(-100, 100, 50, 40, 0);
  assert.ok(Math.abs(Math.abs(d.y) - 40) < 1e-9 && Math.abs(d.x) <= 50);
  assert.deepEqual(padRect({ minX: 0, maxX: 10, minZ: 0, maxZ: 10 }, 5, { minX: -2, maxX: 100, minZ: -100, maxZ: 12 }), { minX: -2, maxX: 15, minZ: -5, maxZ: 12 });
});

test('coastline: marching squares outline a pond without gaps', () => {
  const w = 6, h = 6, f = new Uint8Array((w + 1) * (h + 1));
  for (let j = 2; j <= 4; j++) for (let i = 2; i <= 4; i++) f[j * (w + 1) + i] = 1;
  const segs = contourSegments(f, w, h);
  assert.equal(segs.length, 12);
  const ends = new Map();
  for (const [a, b, c, d] of segs) for (const k of [`${a},${b}`, `${c},${d}`]) ends.set(k, (ends.get(k) ?? 0) + 1);
  assert.ok([...ends.values()].every(n => n === 2), 'closed loop');
  assert.equal(contourSegments(new Uint8Array(49), 6, 6).length, 0);
});

test('zone labels sit at the middle of each region', () => {
  const a = { id: 'a', name: 'A' }, b = { id: 'b', name: 'B' };
  const z = regionAnchors([{ region: a, x: 0, z: 0 }, { region: a, x: 10, z: 4 }, { region: b, x: 5, z: 5 }, { region: null, x: 1, z: 1 }], 2);
  assert.deepEqual(z, [{ id: 'a', name: 'A', x: 5, z: 2, n: 2 }]);
  assert.ok(LEGEND.length >= 8 && LEGEND.every(([k, t]) => k && t));
});
