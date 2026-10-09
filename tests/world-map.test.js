import test from 'node:test';
import assert from 'node:assert/strict';
import { mapDirectory, filterPlaces, worldOrder, nextPortal } from '../src/ui/mapDirectory.js';
import { fittedCamera, mapTransform, placeLabels, clampCamera, clusterMarkers } from '../src/ui/minimap/mapLayout.js';
import { LANDMARKS } from '../src/data/landmarks.js';
import { MAPS, MAP_IDS, landmarksOf } from '../src/world/maps.js';
import { WARP_SERVICES } from '../src/data/warpServices.js';

test('atlas lists all maps and secret places; gate and portal are one selectable destination', () => {
  for (const id of MAP_IDS) {
    const places = mapDirectory(MAPS[id], landmarksOf(id, LANDMARKS));
    for (const l of landmarksOf(id, LANDMARKS)) assert.ok(places.some(p => p.id === l.id || p.portal && Math.hypot(p.x - l.x, p.z - l.z) < 12), `${id}:${l.id}`);
    for (const portal of MAPS[id].portals) assert.equal(places.filter(e => e.portal?.id === portal.id).length, 1);
    assert.equal(new Set(places.map(e => e.id)).size, places.length, `${id} unique ids`);
    assert.ok(places.every(e => Number.isFinite(e.goal.x) && Number.isFinite(e.goal.z)));
  }
});

test('shop search and categories find upgrade independently of distance; world uses real portal graph', () => {
  const places = mapDirectory(MAPS.city, landmarksOf('city', LANDMARKS));
  const result = filterPlaces(places, 'shops', 'ตีบวก', { x: 0, z: 52 });
  assert.equal(result.length, 1); assert.equal(result[0].shopType, 'enhance');
  assert.equal(places.find(e => e.id === 'market').category, 'places');
  assert.equal(places.find(e => e.id === 'fish_market').tag, 'บริการในอนาคต');
  assert.ok(!filterPlaces(places, 'shops').some(e => e.shopType === 'fish'));
  const travel = filterPlaces(places, 'travel');
  assert.equal(travel.filter(e => e.portal).length, MAPS.city.portals.length);
  assert.equal(travel.filter(e => e.npcId).length, WARP_SERVICES.filter(s => s.map === 'city').length);
  assert.equal(worldOrder()[0].id, 'city'); assert.equal(worldOrder().at(-1).id, 'demon_rift');
  assert.equal(nextPortal('city', 'demon_rift').to, 'paddy');
  assert.equal(nextPortal('demon_rift', 'city').to, 'fallen_city');
  assert.equal(nextPortal('city', 'city'), null); assert.equal(nextPortal('city', 'missing'), null);
});

test('zoomed-out clusters retain every destination; zoomed-in badges separate without changing identity', () => {
  const points = [{ x: 100, y: 100, entry: { id: 'a', name: 'same' } }, { x: 110, y: 100, entry: { id: 'b', name: 'same' } }, { x: 200, y: 100, entry: { id: 'c' } }];
  const groups = clusterMarkers(points, 24);
  assert.equal(groups.length, 2);
  assert.deepEqual(groups.flatMap(g => g.points.map(p => p.entry.id)).sort(), ['a', 'b', 'c']);
  assert.equal(clusterMarkers(points.map(p => ({ ...p, x: p.x * 3 })), 24).length, 3);
});

test('camera focus cannot scroll all geography off-screen, including portrait and landscape', () => {
  const rect = { minX: -90, maxX: 130, minZ: -120, maxZ: 280 };
  for (const [w, h] of [[800, 600], [374, 420], [600, 210]]) {
    const camera = clampCamera(rect, w, h, { x: -999, z: 999, zoom: 3 });
    const t = mapTransform(rect, w, h, camera);
    assert.ok(camera.x >= rect.minX && camera.x <= rect.maxX && camera.z >= rect.minZ && camera.z <= rect.maxZ);
    assert.ok(t.left < w && t.top < h && t.left + t.w > 0 && t.top + t.h > 0);
  }
});

test('map transform retains the selected world point when zooming and supports any aspect ratio', () => {
  const rect = { minX: -100, maxX: 130, minZ: -120, maxZ: 280 };
  for (const [w, h] of [[800, 600], [374, 420], [600, 250]]) {
    const camera = fittedCamera(rect, w, h), t = mapTransform(rect, w, h, camera);
    assert.ok(Math.abs(t.left + (camera.x - rect.minX) * t.k - w / 2) < 1e-9);
    const at = { x: 12, z: 52 }, after = camera.zoom * 2;
    const zoomed = { x: at.x + (camera.x - at.x) * camera.zoom / after, z: at.z + (camera.z - at.z) * camera.zoom / after, zoom: after };
    const n = mapTransform(rect, w, h, zoomed);
    assert.ok(Math.abs(t.left + (at.x - rect.minX) * t.k - n.left - (at.x - rect.minX) * n.k) < 1e-9);
  }
});

test('crowded map labels never overlap each other, markers, or canvas edges; selected gets first placement', () => {
  const obstacle = { x: 130, y: 110, w: 30, h: 30 };
  const labels = Array.from({ length: 14 }, (_, i) => ({ text: String(i), x: 145 + i * 3, y: 125 + i * 4, width: 100, height: 24, radius: 15, priority: i === 13 ? 200 : 0 }));
  const placed = placeLabels(labels, [obstacle], 300, 240);
  assert.ok(placed.length > 0 && placed.length < labels.length); assert.equal(placed[0].text, '13');
  const overlaps = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  for (const [i, l] of placed.entries()) {
    assert.ok(l.box.x >= 8 && l.box.y >= 8 && l.box.x + l.box.w <= 292 && l.box.y + l.box.h <= 232);
    assert.ok(!overlaps(l.box, obstacle));
    assert.ok(!placed.slice(0, i).some(p => overlaps(l.box, p.box)));
  }
});
