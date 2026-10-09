import test from 'node:test';
import assert from 'node:assert/strict';
import { WARP_SERVICES, WARP_DESTINATIONS, WARP_NPCS, getWarpService, getWarpDestination, WARP_RANGE } from '../src/data/warpServices.js';
import { MAPS, MAP_IDS, npcsForMap, portalAt } from '../src/world/maps.js';
import { NPCS } from '../src/data/npcs.js';
import { navigation } from '../server/navigation.js';
import { mapDirectory } from '../src/ui/mapDirectory.js';
import { npcMarker } from '../src/ui/minimap/mapStyle.js';

test('every map has an all-day travel NPC; six city hubs have distinct IDs and destinations', () => {
  assert.equal(WARP_SERVICES.length, MAP_IDS.length + 5);
  assert.equal(WARP_DESTINATIONS.length, WARP_SERVICES.length);
  assert.equal(WARP_SERVICES.filter(s => s.map === 'city').length, 6);
  assert.equal(new Set(NPCS.map(n => n.id)).size, NPCS.length);
  for (const id of MAP_IDS) {
    const services = WARP_SERVICES.filter(s => s.map === id);
    assert.ok(services.length);
    const roster = npcsForMap(NPCS, id, () => true);
    for (const s of services) {
      const n = roster.find(n => n.id === s.npcId);
      assert.ok(n, id); assert.equal(n.interactionRadius, WARP_RANGE);
      for (const phase of ['morning', 'day', 'evening', 'night']) {
        assert.equal(n.schedule[phase].do, 'stay'); assert.equal(n.schedule[phase].at.x, s.x); assert.equal(n.schedule[phase].at.z, s.z);
      }
      assert.equal(getWarpService(s.npcId), s); assert.ok(getWarpDestination(s.arrivalId));
    }
  }
  assert.equal(WARP_NPCS.length, WARP_SERVICES.length);
  for (const bad of ['__proto__', 'constructor', '', null, undefined, {}, 0]) {
    assert.equal(getWarpService(bad), undefined); assert.equal(getWarpDestination(bad), undefined);
  }
});

test('NPCs and fixed arrivals are standable with body clearance and never land on a portal', () => {
  for (const s of WARP_SERVICES) {
    const nav = navigation(s.map), d = getWarpDestination(s.arrivalId);
    assert.ok(nav.canStand(s.x, s.z, .8), `${s.id} NPC clearance`);
    assert.ok(nav.canStand(d.x, d.z, 1), `${s.id} arrival clearance`);
    assert.ok(Math.hypot(s.x - d.x, s.z - d.z) < WARP_RANGE, `${s.id} reachable keeper`);
    assert.ok(nav.clear(d, s, .28), `${s.id} clear approach`);
    assert.equal(portalAt(MAPS[d.map], d.x, d.z), null, `${d.id} no automatic return`);
  }
});

test('atlas travel directory and distinct NPC badges expose the services without teleporting', () => {
  for (const id of MAP_IDS) {
    const directory = mapDirectory(MAPS[id], []);
    const services = WARP_SERVICES.filter(s => s.map === id);
    for (const s of services) {
      const entry = directory.find(e => e.npcId === s.npcId);
      assert.equal(entry.category, 'travel'); assert.equal(entry.glyph, 'warp'); assert.equal(entry.portal, undefined);
      assert.equal(entry.goal, getWarpDestination(s.arrivalId));
      assert.deepEqual(npcMarker(NPCS.find(n => n.id === s.npcId)), { kind: 'travel', purpose: 'warp' });
    }
  }
});
