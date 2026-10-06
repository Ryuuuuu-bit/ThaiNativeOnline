// QA regression checks for the two-map split (city + fields) that the map and
// content tests do not cover: data the HUD and journal read, and safety around
// the warp arrival. Browser-only parts (the combat tip, the journal hint) were
// verified in headless Edge; see docs/technical/VERIFY.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LANDMARKS, PURPOSES } from '../src/data/landmarks.js';
import { MAPS, mapOf, landmarksOf } from '../src/world/maps.js';
import { combatSpawns } from '../src/data/spawns.js';
import { MONSTERS } from '../src/combat/data/monsters.js';
import { NPCS } from '../src/data/npcs.js';
import { SHOPS } from '../src/data/shops.js';

test('every landmark purpose has a label (the discovery toast prints it)', () => {
  for (const l of LANDMARKS) if (l.purpose) assert.ok(PURPOSES[l.purpose], `${l.id}: unknown purpose ${l.purpose}`);
});

test('no monster can aggro a player standing on a warp arrival point', () => {
  for (const map of Object.values(MAPS)) for (const p of map.portals) {
    const { x, z } = p.arrive;
    for (const zone of combatSpawns()) {
      if (mapOf(zone.x, zone.z) !== p.to) continue;
      const reach = zone.radius + MONSTERS[zone.type].aggro + 10;   // wander inside the zone, then aggro, plus a margin
      assert.ok(Math.hypot(zone.x - x, zone.z - z) > reach, `${zone.type} of ${zone.area ?? '?'} reaches the ${p.id} arrival`);
    }
  }
});

test('each map that has monsters has a shop selling potions (restock without warping)', () => {
  for (const map of Object.values(MAPS)) {
    if (map.safe) continue;
    const sellers = NPCS.filter(n => n.map === map.id && SHOPS[n.shopType]?.stock?.includes('potion_s'));
    assert.ok(sellers.length, `${map.id} has no potion seller`);
  }
});

test('both maps have something to discover', () => {
  for (const id of Object.keys(MAPS)) assert.ok(landmarksOf(id, LANDMARKS).some(l => !l.hidden), `${id} has no visible landmark`);
});
