// Map registry checks (src/world/maps.js): the game is one map, นครอโยธยา, inside
// the city walls. Everything in the game must lie on it, and the player must not
// be able to walk out of it (the North City Gate is closed).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BOUNDS, J, waterAt } from '../src/world/CityMap.js';
import { MAPS, MAP_IDS, DEFAULT_MAP, SEAM_Z, mapOf, walkable, inView, walkBounds, npcHome, npcMap, npcsForMap, landmarksOf, spawnsOf } from '../src/world/maps.js';
import { NavGraph } from '../src/npc/NavGraph.js';
import { regionAt } from '../src/data/regions.js';
import { LANDMARKS } from '../src/data/landmarks.js';
import { SPAWNS, combatSpawns } from '../src/data/spawns.js';
import { NPCS } from '../src/data/npcs.js';
import { QUESTS } from '../src/data/quests.js';

const city = MAPS.city;

test('the registry has one map, the city, with no way out', () => {
  assert.deepEqual(MAP_IDS, ['city']);
  assert.equal(DEFAULT_MAP, 'city');
  assert.ok(city.name === 'นครอโยธยา' && city.walk.length && city.view && city.owns && city.spawn, 'city is incomplete');
  assert.equal(city.portals.length, 0, 'the north gate is closed');
  assert.equal(city.visitors.length, 0);
  assert.ok(city.safe);
});

test('the city owns everything south of the north gate and nothing beyond it', () => {
  for (let z = BOUNDS.minZ; z <= BOUNDS.maxZ - 1; z += 1.5) for (let x = BOUNDS.minX; x <= BOUNDS.maxX; x += 25) {
    assert.equal(mapOf(x, z), z >= SEAM_Z ? 'city' : null, `${x},${z}`);
  }
});

test('walkable areas stay inside the world, the built view and the city walls', () => {
  const b = walkBounds(city);
  assert.ok(b.minX >= BOUNDS.minX && b.maxX <= BOUNDS.maxX && b.minZ >= BOUNDS.minZ && b.maxZ <= BOUNDS.maxZ, 'city walks outside the world');
  for (const r of city.walk) for (const [x, z] of [[r.minX, r.minZ], [r.maxX, r.maxZ], [r.minX, r.maxZ], [r.maxX, r.minZ]]) assert.ok(inView(city, x, z), `can walk to ${x},${z} outside the view`);
  assert.ok(b.minZ > SEAM_Z, 'the walk area reaches past the north gate');
  assert.ok(walkable(city, city.spawn.x, city.spawn.z), 'spawn is not walkable');
  for (const [x, z] of city.respawn) assert.ok(walkable(city, x, z) && waterAt(x, z) !== 2, `respawn ${x},${z}`);
});

test('every landmark lies in the city and can be walked to', () => {
  for (const l of LANDMARKS) {
    assert.equal(mapOf(l.x, l.z), 'city', l.id);
    assert.ok(walkable(city, l.x, l.z), `${l.id} is not walkable`);
  }
  assert.equal(landmarksOf('city', LANDMARKS).length, LANDMARKS.length);
  assert.ok(landmarksOf('city', LANDMARKS).some(l => l.id === 'north_gate'));
});

test('the city is a safe zone: no monster areas', () => {
  assert.equal(SPAWNS.length, 0);
  assert.equal(combatSpawns().length, 0);
  assert.equal(spawnsOf('city', SPAWNS).length, 0);
});

test('quests only ask for places in the city and never for monsters', () => {
  const place = new Set(LANDMARKS.map(l => l.id));
  for (const q of QUESTS) for (const o of q.objectives) {
    if (o.discover) assert.ok(place.has(o.discover), `${q.id}: ${o.discover}`);
    assert.ok(!o.kill, `${q.id} asks for a kill but there are no monsters`);
  }
});

test('every NPC lives in the city', () => {
  for (const def of NPCS) {
    const h = npcHome(def);
    assert.ok(h || MAPS[def.map], `${def.id} has neither a home position nor a declared map`);
    assert.equal(npcMap(def), 'city', def.id);
    if (h) assert.ok(walkable(city, h[0], h[1]), `${def.id} home ${h} is not walkable`);
  }
  const has = id => !!J[id] && walkable(city, ...J[id]);
  const roster = npcsForMap(NPCS, 'city', has);
  assert.equal(roster.length, NPCS.length);
  assert.ok(roster.length > 40);
  // The herbalist's morning herb run was outside the gate: that part of the day is now spent at home.
  assert.equal(roster.find(n => n.id === 'herbalist').schedule.morning.do, 'home');
});

test('the player cannot leave the city: the walk area ends inside the wall', () => {
  for (const r of city.walk) for (let x = r.minX; x <= r.maxX; x += .5) assert.ok(!walkable(city, x, r.minZ - .5) || r.minZ - .5 > SEAM_Z, `walkable past the gate at ${x}`);
});

test('region names in the city come from its region list', () => {
  for (const r of city.walk) for (let z = r.minZ; z <= r.maxZ; z += 3) for (let x = r.minX; x <= r.maxX; x += 6) {
    const region = regionAt(x, z, true);
    assert.ok(city.regions.includes(region.id), `city shows region ${region.id} at ${x},${z}`);
  }
});

test('the city nav graph is one connected network', () => {
  const g = NavGraph.fromRoads((x, z) => walkable(city, x, z)), ids = [...g.nodes.keys()];
  assert.ok(ids.length > 20, 'nav graph is tiny');
  const start = 'center', seen = new Set([start]), queue = [start];
  assert.ok(g.nodes.has(start), 'no centre junction');
  while (queue.length) for (const e of g.nodes.get(queue.shift()).edges) if (!seen.has(e.to)) { seen.add(e.to); queue.push(e.to); }
  for (const id of Object.keys(J)) if (g.nodes.has(id)) assert.ok(seen.has(id), `${id} is not reachable from the centre`);
});
