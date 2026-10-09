import test from 'node:test';
import assert from 'node:assert/strict';
import { MAPS, MAP_IDS, mapOf, spawnsOf } from '../src/world/maps.js';
import { SPAWNS, combatSpawns } from '../src/data/spawns.js';
import { MONSTERS } from '../src/combat/data/monsters.js';
import { mapDirectory, bossLairsForMap, filterPlaces, MAP_FILTERS, CATEGORY_ICONS } from '../src/ui/mapDirectory.js';
import { overlapsBossLair, placeBossBadge, LEGEND } from '../src/ui/minimap/mapStyle.js';
import { bossLairMark, markerSample } from '../src/ui/minimap/glyphs.js';
import { Minimap } from '../src/ui/Minimap.js';
import { WorldMapPanel } from '../src/ui/WorldMapPanel.js';

test('all thirteen maps expose only their flagged boss lairs, including both rare sites and no city bosses', () => {
  const counts = { city: 0, paddy: 1, deep_forest: 1, wat_rang: 2, klong: 2,
    bamboo_grave: 1, sealed_mine: 1, sunken_city: 1, dusk_fort: 1, giant_valley: 1, himmapan: 1, fallen_city: 1, demon_rift: 1 };
  let total = 0;
  for (const id of MAP_IDS) {
    const entries = mapDirectory(MAPS[id], []).filter(e => e.category === 'bosses');
    assert.equal(entries.length, counts[id], id); total += entries.length;
    const areas = spawnsOf(id, SPAWNS).filter(s => s.boss);
    assert.deepEqual(entries.map(e => e.spawnId).sort(), areas.map(s => s.id).sort());
    for (const e of entries) {
      const area = areas.find(s => s.id === e.spawnId), def = MONSTERS[e.monsterType];
      assert.equal(mapOf(e.x, e.z), id); assert.ok(combatSpawns().some(r => r.area === area.id && r.type === e.monsterType));
      assert.equal(e.bossName, def.name); assert.equal(e.level, def.level);
      assert.deepEqual(e.goal, { x: area.x, z: area.z });
      assert.match(e.tag, /ถิ่นบอส/); assert.ok(e.name.includes(def.name) && e.name.includes(`Lv ${def.level}`));
      assert.match(e.detail, /ไม่ยืนยันว่าบอสเกิด/); assert.equal(e.npcId, undefined);
    }
  }
  assert.equal(total, 14);
  assert.ok(bossLairsForMap(MAPS.wat_rang).some(e => e.monsterType === 'krasue'));
  assert.ok(bossLairsForMap(MAPS.klong).some(e => e.monsterType === 'tani'));
  assert.deepEqual(bossLairsForMap({ id: 'unknown', safe: false }), []);
});

test('lair conditions use effective combat-zone phases and the authoritative elite/boss CH1 restriction', () => {
  const zones = combatSpawns();
  for (const id of MAP_IDS) for (const lair of bossLairsForMap(MAPS[id])) {
    const phaseSet = new Set(zones.filter(z => z.area === lair.spawnId && z.type === lair.monsterType).flatMap(z => z.active));
    assert.deepEqual(new Set(lair.active), phaseSet);
    const def = MONSTERS[lair.monsterType]; assert.equal(lair.channel, def.elite || def.boss ? 1 : null);
    assert.match(lair.detail, /ออนไลน์เฉพาะ CH1/);
  }
  const rare = bossLairsForMap(MAPS.wat_rang).find(e => e.monsterType === 'krasue');
  assert.deepEqual(rare.active, ['night']); assert.match(rare.detail, /กลางคืน/);
  assert.ok(!rare.detail.includes('ทุกช่วงเวลา'));
  assert.match(bossLairsForMap(MAPS.paddy)[0].detail, /ทุกช่วงเวลา/);
});

test('boss badge placement stays in the minimap and avoids compass, warp and player footprints', () => {
  const boxes = [{ x: 270, y: 0, w: 50, h: 50 }, { x: 135, y: 75, w: 50, h: 50 }];
  for (const [x, y] of [[300, 20], [160, 100], [310, 170]]) {
    const p = placeBossBadge(x, y, 14, 320, 200, boxes);
    assert.ok(p.x >= 16 && p.x <= 304 && p.y >= 16 && p.y <= 184);
    assert.ok(boxes.every(b => p.x + 14 <= b.x || p.x - 14 >= b.x + b.w || p.y + 14 <= b.y || p.y - 14 >= b.y + b.h));
  }
});

test('boss directory search/category is public, level-aware, stable and does not grant discoveries', () => {
  assert.ok(MAP_FILTERS.some(([id]) => id === 'bosses')); assert.ok(CATEGORY_ICONS.bosses);
  const discovered = new Set(), before = JSON.stringify(SPAWNS), entries = mapDirectory(MAPS.klong, []);
  const [chalawan] = filterPlaces(entries, 'bosses', 'ชาละวัน');
  assert.equal(chalawan.monsterType, 'chalawan'); assert.equal(chalawan.level, 25);
  assert.deepEqual(filterPlaces(entries, 'bosses', 'Lv 25').map(e => e.id), [chalawan.id]);
  assert.equal(filterPlaces(entries, 'shops', 'ชาละวัน').length, 0);
  assert.equal(chalawan.id, bossLairsForMap(MAPS.klong).find(e => e.monsterType === 'chalawan').id);
  assert.equal(discovered.size, 0); assert.equal(JSON.stringify(SPAWNS), before);
});

test('live dot dedup requires same type and overlapping displayed lair; chasing and filtered-out bosses stay visible', () => {
  const lairs = bossLairsForMap(MAPS.klong), lair = lairs.find(e => e.monsterType === 'chalawan'), to = (x, z) => [x * 2, z * 2];
  const live = { type: 'chalawan', x: lair.x + 1, z: lair.z, spawn: { area: lair.spawnId } };
  assert.equal(overlapsBossLair(live, lairs, to, 10), true);
  assert.equal(overlapsBossLair({ ...live, x: lair.x + 15 }, lairs, to, 10), false);
  assert.equal(overlapsBossLair({ ...live, type: 'croc' }, lairs, to, 10), false);
  assert.equal(overlapsBossLair({ ...live, spawn: { area: 'another-lair' } }, lairs, to, 10), false);
  assert.equal(overlapsBossLair(live, [], to, 10), false);
  assert.equal(overlapsBossLair({ ...live, spawn: null }, lairs, to, 10), true, 'online source need not include spawn area');
});

function context(width = 360, height = 260) {
  const calls = [], stack = [], g = { canvas: { width, height }, calls,
    save() { stack.push({ fillStyle: this.fillStyle, strokeStyle: this.strokeStyle, font: this.font }); },
    restore() { Object.assign(this, stack.pop()); },
    createRadialGradient() { return { addColorStop(at, color) { calls.push({ gradient: color }); } }; },
    fill(path) { calls.push({ fill: typeof this.fillStyle === 'object' ? 'gradient' : this.fillStyle, path: path?.data }); },
    stroke(path) { calls.push({ stroke: this.strokeStyle, path: path?.data }); },
    fillText(text, x, y) { calls.push({ text, x, y }); },
    measureText(text) { return { width: [...text].length * 5 }; },
  };
  for (const method of ['beginPath', 'closePath', 'arc', 'moveTo', 'lineTo', 'translate', 'scale', 'rotate', 'strokeText', 'roundRect', 'setLineDash', 'fillRect']) g[method] = () => {};
  return g;
}
function canvasGlobals(fn) {
  const oldPath = globalThis.Path2D, oldRatio = globalThis.devicePixelRatio;
  globalThis.Path2D = class { constructor(data) { this.data = data; } addPath() {} };
  globalThis.devicePixelRatio = 1;
  try { return fn(); } finally { globalThis.Path2D = oldPath; globalThis.devicePixelRatio = oldRatio; }
}
function minimap(map, entries) {
  const m = Object.create(Minimap.prototype);
  Object.assign(m, { map, directory: entries, bossLairs: entries.filter(e => e.category === 'bosses'),
    landmarks: [], portals: [], discovered: new Set(), bounds: map.view, filter: 'all', search: '' });
  return m;
}

test('Thai crown lair glyph and legend use a red badge with gold outline and gold emblem', () => canvasGlobals(() => {
  const g = context(); bossLairMark(g, 80, 70, 14);
  assert.ok(g.calls.some(c => c.gradient === '#b84e3b'));
  assert.ok(g.calls.some(c => c.gradient === '#711f26'));
  assert.ok(g.calls.some(c => c.stroke === '#f4d487'));
  assert.ok(g.calls.some(c => c.fill === '#ffe0a0' && c.path?.startsWith('M12 1.5')));
  assert.ok(LEGEND.some(([kind, text]) => kind === 'boss' && text.includes('ไม่แสดงสถานะเกิด')));
  const sample = context(); markerSample(sample, 'boss', 20, 20, 10);
  assert.ok(sample.calls.some(c => c.fill === '#ffe0a0' && c.path));
}));

test('minimap draws permanent lairs with empty/dead monster state and border badges for distant lairs', () => canvasGlobals(() => {
  const lairs = bossLairsForMap(MAPS.klong), m = minimap(MAPS.klong, lairs), lair = lairs.find(e => e.monsterType === 'chalawan');
  const p = { x: lair.x - 22, z: lair.z }, to = (x, z) => [(x - p.x) * 2 + 180, (z - p.z) * 2 + 130];
  const empty = context(), dead = context();
  m.markers(empty, to, 2, 20, { monsters: [] }, { p });
  m.markers(dead, to, 2, 20, { monsters: [{ type: 'chalawan', alive: false, x: lair.x, z: lair.z }] }, { p });
  assert.ok(empty.calls.some(c => c.text === `${lair.bossName} · Lv ${lair.level}`));
  assert.deepEqual(empty.calls, dead.calls);
  const distant = context(); m.miniBossMarkers(distant, () => [10000, -10000], 20, p);
  assert.ok(distant.calls.some(c => c.fill === '#ffe0a0' && c.path), 'off-screen lair is still shown on border');
}));

test('fullmap lair retains selectable identity/detail/goal and selection alone never walks', () => canvasGlobals(() => {
  const entries = bossLairsForMap(MAPS.demon_rift), e = entries[0], m = minimap(MAPS.demon_rift, entries), g = context(800, 500);
  m.filter = 'bosses'; m.selectedId = e.id;
  m.fullMarkers(g, () => [410, 210], 22, { monsters: [], npcs: [] }, { x: 0, z: 0 });
  const hit = m.hits.find(h => h.entry?.id === e.id);
  assert.equal(hit.entry, e); assert.equal(hit.goal, e.goal); assert.ok(hit.title.includes(`Lv ${e.level}`));
  assert.ok(m.fullLabels.some(l => l.text === e.name));
  let walks = 0, focuses = 0, refreshes = 0;
  const panel = Object.create(WorldMapPanel.prototype);
  panel.walk = () => { walks++; }; panel.minimap = () => ({ focusFull: () => { focuses++; } }); panel.refresh = () => { refreshes++; };
  panel.select(hit.entry); assert.equal(panel.selected, e); assert.equal(walks, 0); assert.equal(focuses, 1); assert.equal(refreshes, 1);
}));

test('crowded fullmap gives a boss badge priority without losing other cluster destinations', () => canvasGlobals(() => {
  const boss = bossLairsForMap(MAPS.paddy)[0], place = { id: 'nearby-place', name: 'ต้นไม้', x: boss.x, z: boss.z, category: 'places', glyph: 'story', goal: boss.goal };
  const m = minimap(MAPS.paddy, [place, boss]), g = context(800, 500);
  m.fullMarkers(g, () => [410, 210], 22, {}, { x: 0, z: 0 });
  assert.ok(g.calls.some(c => c.gradient === '#711f26'));
  const hit = m.hits.find(h => h.entry?.cluster);
  assert.deepEqual(new Set(hit.entry.cluster.map(e => e.id)), new Set([place.id, boss.id]));
  assert.ok(hit.title.includes(boss.bossName) && hit.title.includes(`Lv ${boss.level}`));
}));
