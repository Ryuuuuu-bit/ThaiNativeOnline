import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COMPACT_CITY, compactCityCanStand } from '../src/world/compact-city.js';
import { COMPACT_CITY_SPOTS, compactCityNpc } from '../src/data/compactCityNpcs.js';
import { NPCS } from '../src/data/npcs.js';
import { HALLS } from '../src/data/halls.js';
import { LANDMARKS } from '../src/data/landmarks.js';
import { WARP_SERVICES, WARP_DESTINATIONS } from '../src/data/warpServices.js';
import { SPOT_SITES, nearShop, nearNpc, SHOP_APPROACHES, SHOP_SITES } from '../src/data/shopSites.js';

test('every compact named outdoor/home anchor is bounded and walkable', () => {
  for (const [id, s] of Object.entries(COMPACT_CITY_SPOTS)) {
    assert.ok(compactCityCanStand(s.x, s.z), id);
    if (s.link) assert.ok(COMPACT_CITY_SPOTS[s.link], `${id} -> ${s.link}`);
    assert.deepEqual(SPOT_SITES[id], ['city', s.x, s.z]);
  }
});

test('all city schedule and home aliases resolve without global J', () => {
  for (const n of NPCS.filter(n => n.map === 'city')) {
    if (typeof n.home === 'string') assert.ok(COMPACT_CITY_SPOTS[n.home], `${n.id} home`);
    if (n.home?.near) assert.ok(compactCityCanStand(n.home.near.x, n.home.near.z), `${n.id} home near`);
    for (const a of Object.values(n.schedule)) for (const stop of a.stops ?? [{ at: a.at }]) {
      const at = typeof stop === 'string' ? stop : stop.at;
      if (typeof at === 'string') assert.ok(at === 'herb_gather' || COMPACT_CITY_SPOTS[at], `${n.id}: ${at}`);
      else if (at) assert.ok(compactCityCanStand(at.x, at.z), `${n.id} literal`);
    }
  }
});

test('legacy literal remap preserves activity metadata and does not double transform', () => {
  const raw = { id: 'test', home: { near: 'center' }, schedule: {
    day: { do: 'route', carry: true, stops: ['center', { at: { x: -37, z: -31, face: 1, link: 'rw2' }, time: [8, 12], anim: 'sweep' }] },
    night: { do: 'home' },
  } };
  const mapped = compactCityNpc(raw);
  assert.equal(mapped.map, 'city'); assert.deepEqual(mapped.home.near, { x: 0, z: 0 });
  assert.equal(mapped.schedule.day.stops[0], 'center');
  assert.deepEqual(mapped.schedule.day.stops[1].time, [8, 12]);
  assert.equal(mapped.schedule.day.stops[1].at.link, 'rw2');
  assert.equal(mapped.schedule.day.carry, true);
  assert.equal(compactCityNpc(mapped), mapped);
  assert.equal(raw.schedule.day.stops[1].at.x, -37);
});

test('services have distinct contacts and nearby customer approaches with phase gates', () => {
  const expected = { blacksmith: [-17,-13], enhance: [-17,-17], general: [-17,12], herbalist: [17,-17], occult: [-42,17] };
  const unique = new Set();
  for (const [shop, coords] of Object.entries(expected)) {
    const sites = SHOP_SITES[shop].filter(s => s.map === 'city');
    assert.equal(sites.length, 1, shop);
    const site = sites[0], approach = COMPACT_CITY_SPOTS[SHOP_APPROACHES[shop]];
    assert.deepEqual([site.x, site.z], coords);
    unique.add(`${site.x},${site.z}`);
    assert.ok(Math.hypot(site.x - approach.x, site.z - approach.z) <= 6, shop);
    assert.equal(nearShop(shop, 'city', approach.x, approach.z, 'day'), true);
    assert.equal(nearShop(shop, 'city', site.x, site.z, 'night'), shop === 'occult');
    assert.equal(nearShop(shop, 'paddy', site.x, site.z, 'day'), false);
    assert.equal(nearShop(shop, 'city', site.x, site.z, '__proto__'), false);
  }
  assert.equal(unique.size, 5);
  assert.equal(nearShop('herbalist', 'city', 17, -17, 'morning'), false);
  assert.equal(nearShop('herbalist', 'paddy', 48, -130.8, 'morning'), true);
});

test('six halls match proposal footprints and exterior master contacts', () => {
  const pillar = LANDMARKS.find(l => l.id === 'city_pillar');
  assert.deepEqual([pillar.x, pillar.z], [0, -7]);
  assert.equal(HALLS.length, 6);
  for (const h of HALLS) {
    const b = COMPACT_CITY.buildings.find(b => b.id === h.id);
    const p = COMPACT_CITY.pois.find(p => p.classId === h.classId);
    assert.deepEqual([h.x,h.z], [b.x,b.z]);
    assert.deepEqual([h.master.x,h.master.z], [p.x,p.z]);
    assert.ok(compactCityCanStand(h.door.x,h.door.z));
    assert.ok(Math.hypot(h.door.x-h.master.x,h.door.z-h.master.z) < 3);
    const l = LANDMARKS.find(l => l.id === h.id);
    assert.deepEqual([l.x,l.z], [h.door.x,h.door.z]);
  }
});

test('six warp IDs preserve storage and all-day contacts with separate safe arrivals', () => {
  const expected = { city_market: [17,12], city_port: [7,55], city_forge: [-12,-17], city_training: [0,-35], city_temple: [-43,-29], city_gate: [4,-57] };
  assert.equal(WARP_SERVICES.filter(s => s.map === 'city').length, 6);
  for (const [id, point] of Object.entries(expected)) {
    const s = WARP_SERVICES.find(s => s.id === id), d = WARP_DESTINATIONS.find(d => d.id === id);
    assert.deepEqual([s.x,s.z], point);
    assert.ok(compactCityCanStand(s.x,s.z)); assert.ok(compactCityCanStand(d.x,d.z));
    assert.ok(Math.hypot(d.x-s.x,d.z-s.z) >= 3);
    const n = NPCS.find(n => n.id === s.npcId);
    assert.equal(n.storageService, true);
    assert.equal(n.schedule.day.at.x, s.x);
    assert.equal(nearNpc(s.npcId,'city',s.x,s.z,'night'), true);
  }
});

test('outside guards and gathering supplier keep their wilderness coordinates', () => {
  for (const [id,x] of [['guard_gate_w',-4],['guard_gate_e',4]]) {
    const n = NPCS.find(n => n.id === id);
    assert.equal(n.map, 'paddy');
    assert.equal(n.schedule.day.at.x,x); assert.equal(n.schedule.day.at.z,-116);
  }
  assert.deepEqual(SPOT_SITES.herb_gather, ['paddy',48,-130.8]);
  const field = { map: 'deep_forest', schedule: { day: { do: 'stay', at: { x: 2, z: -317 } } } };
  assert.equal(compactCityNpc(field),field);
});
