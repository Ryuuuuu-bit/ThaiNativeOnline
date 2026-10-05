// Map registry checks (src/world/maps.js): the world is split at the north gate
// into `city` and `wilds`; content must belong to exactly one map and portals
// must deliver the player somewhere standable that does not bounce them back.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BOUNDS, J, waterAt } from '../src/world/CityMap.js';
import { MAPS, MAP_IDS, mapOf, walkable, inView, portalAt, walkBounds, npcHome, npcMap, npcsForMap, landmarksOf, spawnsOf } from '../src/world/maps.js';
import { NavGraph } from '../src/npc/NavGraph.js';
import { regionAt } from '../src/data/regions.js';
import { LANDMARKS } from '../src/data/landmarks.js';
import { SPAWNS, combatSpawns } from '../src/data/spawns.js';
import { NPCS } from '../src/data/npcs.js';

const owners = (x, z) => MAP_IDS.filter(id => z >= MAPS[id].owns.minZ && z < MAPS[id].owns.maxZ);

test('the registry has the city and the wilds, each with a way back', () => {
  assert.deepEqual(MAP_IDS.sort(), ['city', 'wilds']);
  for (const map of Object.values(MAPS)) {
    assert.ok(map.name && map.walk.length && map.view && map.owns && map.spawn, `${map.id} is incomplete`);
    for (const p of map.portals) {
      assert.ok(MAPS[p.to], `${map.id} portal ${p.id} leads to unknown map ${p.to}`);
      assert.ok(MAPS[p.to].portals.some(q => q.to === map.id), `${p.to} has no portal back to ${map.id}`);
      assert.ok(J[p.node], `${p.id} exit node ${p.node} is not a junction`);
    }
  }
});

test('ownership partitions the world: every point belongs to exactly one map', () => {
  for (let z = BOUNDS.minZ; z <= BOUNDS.maxZ - 1; z += 1.5) for (let x = BOUNDS.minX; x <= BOUNDS.maxX; x += 25) {
    const own = owners(x, z);
    assert.equal(own.length, 1, `${x},${z} is owned by ${own.join(', ') || 'nobody'}`);
    assert.equal(mapOf(x, z), own[0]);
  }
});

test('walkable areas stay inside the world and inside each map\'s built view', () => {
  for (const map of Object.values(MAPS)) {
    const b = walkBounds(map);
    assert.ok(b.minX >= BOUNDS.minX && b.maxX <= BOUNDS.maxX && b.minZ >= BOUNDS.minZ && b.maxZ <= BOUNDS.maxZ, `${map.id} walks outside the world`);
    for (const r of map.walk) for (const [x, z] of [[r.minX, r.minZ], [r.maxX, r.maxZ], [r.minX, r.maxZ], [r.maxX, r.minZ]]) assert.ok(inView(map, x, z), `${map.id} can walk to ${x},${z} outside its view`);
    assert.ok(walkable(map, map.spawn.x, map.spawn.z), `${map.id} spawn is not walkable`);
    for (const [x, z] of map.respawn) assert.ok(walkable(map, x, z) && waterAt(x, z) !== 2, `${map.id} respawn ${x},${z}`);
  }
  // The only overlap between the maps is the gate itself.
  for (let z = -140; z <= -95; z += .5) for (let x = -20; x <= 20; x += .5) {
    if (walkable(MAPS.city, x, z) && walkable(MAPS.wilds, x, z)) assert.ok(Math.abs(x) <= 5 && z >= -123 && z <= -104, `both maps walk at ${x},${z}`);
  }
});

test('every landmark lies inside exactly one map and can be walked to there', () => {
  let total = 0;
  for (const l of LANDMARKS) {
    assert.equal(owners(l.x, l.z).length, 1, l.id);
    assert.ok(walkable(MAPS[mapOf(l.x, l.z)], l.x, l.z), `${l.id} is not walkable on ${mapOf(l.x, l.z)}`);
  }
  for (const id of MAP_IDS) total += landmarksOf(id, LANDMARKS).length;
  assert.equal(total, LANDMARKS.length);
  assert.ok(landmarksOf('city', LANDMARKS).some(l => l.id === 'north_gate'));
  assert.ok(landmarksOf('wilds', LANDMARKS).some(l => l.id === 'cemetery'));
});

test('monster spawns live only in the wilds; the city stays a safe zone', () => {
  for (const s of SPAWNS) { assert.equal(owners(s.x, s.z).length, 1, s.id); assert.equal(mapOf(s.x, s.z), 'wilds', s.id); }
  for (const z of combatSpawns()) {
    assert.equal(mapOf(z.x, z.z), 'wilds', `${z.type} at ${z.x},${z.z}`);
    assert.ok(walkable(MAPS.wilds, z.x, z.z), `${z.type} zone centre is not walkable`);
  }
  assert.equal(spawnsOf('city', SPAWNS).length, 0);
  assert.ok(MAPS.city.safe && !MAPS.wilds.safe);
});

test('every NPC home lies inside exactly one map; visitors get a way out', () => {
  const residents = Object.fromEntries(MAP_IDS.map(id => [id, 0]));
  for (const def of NPCS) {
    const h = npcHome(def);
    assert.ok(h || MAPS[def.map], `${def.id} has neither a home position nor a declared map`);
    if (h) {
      assert.equal(owners(h[0], h[1]).length, 1, def.id);
      assert.ok(walkable(MAPS[npcMap(def)], h[0], h[1]), `${def.id} home ${h} is not walkable on ${npcMap(def)}`);
      if (def.map) assert.equal(def.map, mapOf(h[0], h[1]), `${def.id} declares ${def.map} but lives in ${mapOf(h[0], h[1])}`);
    }
    residents[npcMap(def)]++;
  }
  assert.ok(residents.city > 40 && residents.wilds >= 6, JSON.stringify(residents));
  for (const map of Object.values(MAPS)) for (const id of map.visitors) assert.ok(NPCS.some(n => n.id === id), `unknown visitor ${id}`);

  const has = map => id => id === 'herb_gather' ? map.id === 'wilds' : !!J[id] && walkable(map, ...J[id]);
  const city = npcsForMap(NPCS, 'city', has(MAPS.city)), wilds = npcsForMap(NPCS, 'wilds', has(MAPS.wilds));
  assert.equal(city.filter(n => !n.visitor).length + wilds.filter(n => !n.visitor).length, NPCS.length, 'each NPC is a resident of one map');
  const herbCity = city.find(n => n.id === 'herbalist'), herbWilds = wilds.find(n => n.id === 'herbalist');
  assert.equal(herbCity.schedule.morning.do, 'home', 'in the morning the herbalist is out of town');
  assert.equal(herbWilds.schedule.morning.at, 'herb_gather');
  assert.equal(herbWilds.home, 'gate_out', 'a visitor leaves through the gate');
  assert.equal(herbWilds.schedule.day.do, 'home');
  assert.ok(wilds.find(n => n.id === 'guard_gate_w'), 'gate guards stand outside the gate on the wilds map too');
});

test('portals arrive somewhere standable that is not inside a trigger (no ping-pong)', () => {
  for (const map of Object.values(MAPS)) for (const p of map.portals) {
    const dest = MAPS[p.to], { x, z } = p.arrive;
    assert.ok(walkable(dest, x, z), `${p.id} arrives off the walkable area of ${dest.id}`);
    assert.notEqual(waterAt(x, z), 2, `${p.id} arrives in deep water`);
    assert.equal(portalAt(dest, x, z), null, `${p.id} arrives inside a portal of ${dest.id}`);
    for (const q of dest.portals) assert.ok(Math.hypot(x - q.at.x, z - q.at.z) > q.at.radius + 3, `${p.id} arrives within 3 m of ${q.id}`);
    // The trigger can be reached: some walkable point of the source map lies inside it.
    let reachable = false;
    for (let a = 0; a < Math.PI * 2 && !reachable; a += .2) for (let r = 0; r < p.at.radius && !reachable; r += .5) reachable = walkable(map, p.at.x + Math.cos(a) * r, p.at.z + Math.sin(a) * r);
    assert.ok(reachable, `${p.id} cannot be reached`);
  }
});

test('the player cannot leave a map except through a portal', () => {
  // Every walkable point on the edge of a map's walk area that touches the other
  // map's area must be inside (or behind) a portal trigger.
  for (const map of Object.values(MAPS)) for (const r of map.walk) for (let x = r.minX; x <= r.maxX; x += .5) for (const z of [r.minZ, r.maxZ]) {
    const outward = z === r.minZ ? -1 : 1, beyond = z + outward * .5;
    if (walkable(map, x, beyond) || !inView(map, x, beyond)) continue;
    const other = MAP_IDS.find(id => id !== map.id && walkable(MAPS[id], x, beyond));
    if (!other) continue;
    assert.ok(map.portals.some(p => p.to === other && Math.hypot(x - p.at.x, z - p.at.z) < p.at.radius + .01), `${map.id} edge at ${x},${z} opens into ${other} without a portal`);
  }
});

test('region names on each map come from that map\'s region list', () => {
  for (const map of Object.values(MAPS)) for (const r of map.walk) for (let z = r.minZ; z <= r.maxZ; z += 3) for (let x = r.minX; x <= r.maxX; x += 6) {
    const region = regionAt(x, z, true);
    assert.ok(map.regions.includes(region.id), `${map.id} shows region ${region.id} at ${x},${z}`);
  }
});

test('each map\'s nav graph is one connected network', () => {
  for (const map of Object.values(MAPS)) {
    const g = NavGraph.fromRoads((x, z) => walkable(map, x, z)), ids = [...g.nodes.keys()];
    assert.ok(ids.length > 20, `${map.id} nav graph is tiny`);
    const start = map.portals[0].node, seen = new Set([start]), queue = [start];
    while (queue.length) for (const e of g.nodes.get(queue.shift()).edges) if (!seen.has(e.to)) { seen.add(e.to); queue.push(e.to); }
    for (const id of Object.keys(J)) if (g.nodes.has(id)) assert.ok(seen.has(id), `${map.id}: ${id} is not reachable from the gate`);
  }
});
