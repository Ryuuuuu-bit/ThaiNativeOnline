// Map registry checks (src/world/maps.js): นครอโยธยา inside the walls and
// ทุ่งนอกเมือง (`fields`) north of them, linked only by warps. Content must belong
// to exactly one map, warps must deliver the player somewhere standable that does
// not bounce them back, and the city stays a safe zone.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BOUNDS, J, PLAZAS, ROADS, roadPoints, resample, waterAt } from '../src/world/CityMap.js';
import { MAPS, MAP_IDS, DEFAULT_MAP, SEAM_Z, mapOf, walkable, inView, portalAt, walkBounds, npcHome, npcMap, npcsForMap, landmarksOf, spawnsOf } from '../src/world/maps.js';
import { NavGraph } from '../src/npc/NavGraph.js';
import { regionAt } from '../src/data/regions.js';
import { LANDMARKS } from '../src/data/landmarks.js';
import { SPAWNS, combatSpawns } from '../src/data/spawns.js';
import { MONSTERS } from '../src/combat/data/monsters.js';
import { NPCS } from '../src/data/npcs.js';
import { QUESTS } from '../src/data/quests.js';
import { HALLS, hallSpots, hallOf } from '../src/data/halls.js';
import { CLASSES } from '../src/character/data/classes.js';

const { city, fields } = MAPS;
const owners = (x, z) => MAP_IDS.filter(id => z >= MAPS[id].owns.minZ && z < MAPS[id].owns.maxZ);

test('the registry has the city and the fields, linked by warps both ways', () => {
  assert.deepEqual([...MAP_IDS].sort(), ['city', 'fields']);
  assert.equal(DEFAULT_MAP, 'city');
  for (const map of Object.values(MAPS)) {
    assert.ok(map.name && map.walk.length && map.view && map.owns && map.spawn, `${map.id} is incomplete`);
    assert.ok(map.portals.length, `${map.id} has no way out`);
    for (const p of map.portals) {
      assert.ok(MAPS[p.to], `${map.id} portal ${p.id} leads to unknown map ${p.to}`);
      assert.ok(MAPS[p.to].portals.some(q => q.to === map.id), `${p.to} has no portal back to ${map.id}`);
      assert.ok(J[p.node] && walkable(map, ...J[p.node]), `${p.id} exit node ${p.node} is not a junction on ${map.id}`);
    }
  }
  assert.ok(city.safe && !fields.safe);
});

test('ownership partitions the world at the seam outside the north wall', () => {
  for (let z = BOUNDS.minZ; z <= BOUNDS.maxZ - 1; z += 1.5) for (let x = BOUNDS.minX; x <= BOUNDS.maxX; x += 25) {
    const own = owners(x, z);
    assert.equal(own.length, 1, `${x},${z} is owned by ${own.join(', ') || 'nobody'}`);
    assert.equal(mapOf(x, z), z >= SEAM_Z ? 'city' : 'fields', `${x},${z}`);
  }
});

test('walkable areas stay inside the world, the built view and their own band', () => {
  for (const map of Object.values(MAPS)) {
    const b = walkBounds(map);
    assert.ok(b.minX >= BOUNDS.minX && b.maxX <= BOUNDS.maxX && b.minZ >= BOUNDS.minZ && b.maxZ <= BOUNDS.maxZ, `${map.id} walks outside the world`);
    assert.ok(b.minZ >= map.owns.minZ && b.maxZ <= map.owns.maxZ, `${map.id} walks outside its band`);
    for (const r of map.walk) for (const [x, z] of [[r.minX, r.minZ], [r.maxX, r.maxZ], [r.minX, r.maxZ], [r.maxX, r.minZ]]) assert.ok(inView(map, x, z), `${map.id} can walk to ${x},${z} outside its view`);
    assert.ok(walkable(map, map.spawn.x, map.spawn.z), `${map.id} spawn is not walkable`);
    for (const [x, z] of map.respawn) assert.ok(walkable(map, x, z) && waterAt(x, z) !== 2, `${map.id} respawn ${x},${z}`);
  }
});

test('the maps never touch: the only way across the closed gate is a warp', () => {
  // Inner walk area ends inside the wall (z -110), the outer one outside it.
  assert.ok(walkBounds(city).minZ > -110 && walkBounds(fields).maxZ < -111);
  for (let z = -140; z <= -95; z += .5) for (let x = -122; x <= 122; x += 2) assert.ok(!(walkable(city, x, z) && walkable(fields, x, z)), `both maps walk at ${x},${z}`);
});

test('warps arrive somewhere standable that is not inside a trigger (no ping-pong) and can be reached', () => {
  for (const map of Object.values(MAPS)) for (const p of map.portals) {
    const dest = MAPS[p.to], { x, z } = p.arrive;
    assert.ok(walkable(dest, x, z), `${p.id} arrives off the walkable area of ${dest.id}`);
    assert.notEqual(waterAt(x, z), 2, `${p.id} arrives in deep water`);
    assert.equal(portalAt(dest, x, z), null, `${p.id} arrives inside a portal of ${dest.id}`);
    for (const q of dest.portals) assert.ok(Math.hypot(x - q.at.x, z - q.at.z) > q.at.radius + 3, `${p.id} arrives within 3 m of ${q.id}`);
    assert.ok(walkable(map, p.at.x, p.at.z), `${p.id} centre is not walkable`);
    assert.ok(inView(map, (p.marker ?? p.at).x, (p.marker ?? p.at).z), `${p.id} marker is outside the view`);
  }
  // The city warp sits in the gate passage, off the wall road (z -103 ± 1.75).
  const warp = city.portals[0];
  assert.equal(warp.to, 'fields');
  assert.ok(warp.at.z + warp.at.radius < -104.75, 'walking along the wall road would trigger the warp');
});

test('every landmark lies inside exactly one map and can be walked to there', () => {
  let total = 0;
  for (const l of LANDMARKS) {
    assert.equal(owners(l.x, l.z).length, 1, l.id);
    assert.ok(walkable(MAPS[mapOf(l.x, l.z)], l.x, l.z), `${l.id} is not walkable on ${mapOf(l.x, l.z)}`);
  }
  for (const id of MAP_IDS) total += landmarksOf(id, LANDMARKS).length;
  assert.equal(total, LANDMARKS.length);
  assert.equal(new Set(LANDMARKS.map(l => l.id)).size, LANDMARKS.length, 'duplicate landmark id');
  assert.ok(landmarksOf('city', LANDMARKS).some(l => l.id === 'north_gate'));
  // regionAt() names the cemetery once the `cemetery` landmark is discovered.
  assert.ok(landmarksOf('fields', LANDMARKS).some(l => l.id === 'cemetery' && l.hidden));
  assert.ok(landmarksOf('fields', LANDMARKS).some(l => l.id === 'outer_warp'));
});

test('monster areas live only on the fields; the city stays a safe zone', () => {
  assert.ok(SPAWNS.length > 0);
  for (const s of SPAWNS) {
    assert.equal(owners(s.x, s.z).length, 1, s.id);
    assert.equal(mapOf(s.x, s.z), 'fields', s.id);
    assert.ok(walkable(fields, s.x, s.z) && waterAt(s.x, s.z) !== 2, `${s.id} centre is not walkable`);
  }
  for (const z of combatSpawns()) {
    assert.ok(MONSTERS[z.type], `unknown monster ${z.type}`);
    assert.equal(mapOf(z.x, z.z), 'fields', `${z.type} at ${z.x},${z.z}`);
    assert.ok(z.count > 0 && z.active.length, `${z.area}/${z.type} never spawns`);
  }
  assert.equal(spawnsOf('city', SPAWNS).length, 0);
  assert.equal(spawnsOf('fields', SPAWNS).length, SPAWNS.length);
  // Elites and bosses are not placed yet.
  assert.ok(combatSpawns().every(z => !MONSTERS[z.type].elite && !MONSTERS[z.type].boss));
});

test('monster levels rise with distance from the warp', () => {
  const warp = fields.portals[0].at, zones = combatSpawns();
  const near = zones.filter(z => Math.hypot(z.x - warp.x, z.z - warp.z) < 140), far = zones.filter(z => z.z < -440);
  assert.ok(near.length && far.length);
  assert.ok(Math.max(...near.map(z => MONSTERS[z.type].level)) <= 2, 'the hunt next to the warp is for new characters');
  assert.ok(Math.min(...far.map(z => MONSTERS[z.type].level)) >= 4, 'the deep forest and cemetery are for stronger characters');
  // Daylight near the warp is beasts only; the ghosts come out in the forest and at night.
  for (const z of near) assert.ok(!z.active.includes('night') || z.type !== 'boar', 'boars sleep at night');
});

test('quests only ask for places and monsters that exist', () => {
  const place = new Set(LANDMARKS.map(l => l.id));
  const hunted = new Set(combatSpawns().map(z => z.type));
  for (const q of QUESTS) for (const o of q.objectives) {
    if (o.discover) assert.ok(place.has(o.discover), `${q.id}: ${o.discover}`);
    if (o.kill) assert.ok(hunted.has(o.kill), `${q.id} asks for ${o.kill}, which is not placed`);
  }
});

test('every NPC home lies inside exactly one map; visitors leave through the warp', () => {
  for (const def of NPCS) {
    const h = npcHome(def);
    assert.ok(h || MAPS[def.map], `${def.id} has neither a home position nor a declared map`);
    if (h) {
      assert.equal(owners(h[0], h[1]).length, 1, def.id);
      assert.ok(walkable(MAPS[npcMap(def)], h[0], h[1]), `${def.id} home ${h} is not walkable on ${npcMap(def)}`);
      if (def.map) assert.equal(def.map, mapOf(h[0], h[1]), `${def.id} declares ${def.map} but lives in ${mapOf(h[0], h[1])}`);
    }
  }
  for (const map of Object.values(MAPS)) for (const id of map.visitors) assert.ok(NPCS.some(n => n.id === id), `unknown visitor ${id}`);

  const has = map => id => (id === 'herb_gather' ? map.id === 'fields' : !!J[id] && walkable(map, ...J[id]));
  const inCity = npcsForMap(NPCS, 'city', has(city)), outside = npcsForMap(NPCS, 'fields', has(fields));
  assert.equal(inCity.filter(n => !n.visitor).length + outside.filter(n => !n.visitor).length, NPCS.length, 'each NPC is a resident of one map');
  assert.ok(inCity.length > 40);
  // The herbalist gathers herbs outside the wall in the morning and keeps her shop in the city.
  assert.equal(inCity.find(n => n.id === 'herbalist').schedule.morning.do, 'home');
  const herb = outside.find(n => n.id === 'herbalist');
  assert.equal(herb.schedule.morning.at, 'herb_gather');
  assert.equal(herb.home, 'gate_out', 'a visitor leaves through the outer warp');
  assert.equal(herb.schedule.day.do, 'home');
  assert.ok(outside.find(n => n.id === 'guard_gate_w') && outside.find(n => n.id === 'guard_gate_e'), 'gate guards stand by the outer warp');
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
    for (const id of Object.keys(J)) if (g.nodes.has(id)) assert.ok(seen.has(id), `${map.id}: ${id} is not reachable from the warp`);
  }
});

// ---- Training halls (src/data/halls.js) ----
const corners = h => {
  const c = Math.cos(h.facing), s = Math.sin(h.facing), out = [];
  for (const [lx, lz] of [[-h.w / 2, -h.d / 2], [h.w / 2, -h.d / 2], [h.w / 2, h.d / 2], [-h.w / 2, h.d / 2]]) out.push([h.x + lx * c + lz * s, h.z - lx * s + lz * c]);
  return out;
};
const inYard = (y, x, z, pad = 0) => Math.abs(x - y.x) <= y.rx + pad && Math.abs(z - y.z) <= y.rz + pad;

test('one training hall per class, inside the city walls', () => {
  assert.deepEqual(HALLS.map(h => h.classId).sort(), Object.keys(CLASSES).sort());
  assert.equal(new Set(HALLS.map(h => h.id)).size, HALLS.length);
  for (const h of HALLS) {
    assert.equal(hallOf(h.classId), h);
    for (const [x, z] of corners(h)) assert.ok(walkable(city, x, z) && x < 114.5, `${h.id} corner ${x.toFixed(1)},${z.toFixed(1)} is outside the city or in the wall`);
    for (const p of [h.door, h.master]) assert.ok(walkable(city, p.x, p.z) && waterAt(p.x, p.z) === 0, `${h.id} spot ${p.x},${p.z}`);
    assert.ok(J[h.junction], `${h.id} links to unknown junction ${h.junction}`);
    assert.ok(Math.hypot(h.door.x - J[h.junction][0], h.door.z - J[h.junction][1]) < 12, `${h.id} door is far from ${h.junction}`);
    assert.equal(regionAt(h.x, h.z).id, 'halls', `${h.id} is not in ย่านสำนักครู`);
    assert.ok(LANDMARKS.some(l => l.id === h.id && l.purpose === 'skills'), `${h.id} has no landmark`);
  }
});

test('hall yards are reserved and keep clear of each other, roads and water', () => {
  for (const h of HALLS) {
    assert.ok(PLAZAS.some(p => p.hall === h.id && p.rect), `${h.id} yard is not reserved`);
    for (const [x, z] of corners(h)) assert.ok(inYard(h.yard, x, z, .01), `${h.id} footprint leaves its yard`);
    assert.ok(inYard(h.yard, h.door.x, h.door.z), `${h.id} door is outside its yard`);
    for (let x = h.yard.x - h.yard.rx; x <= h.yard.x + h.yard.rx; x += .5) for (let z = h.yard.z - h.yard.rz; z <= h.yard.z + h.yard.rz; z += .5) assert.equal(waterAt(x, z), 0, `${h.id} yard is wet at ${x},${z}`);
    for (const o of HALLS) if (o !== h) {
      const a = h.yard, b = o.yard;
      assert.ok(Math.abs(a.x - b.x) >= a.rx + b.rx || Math.abs(a.z - b.z) >= a.rz + b.rz, `${h.id} and ${o.id} yards overlap`);
    }
    // No road crosses a footprint (the quarter's lane passes in front of the doors).
    for (const road of ROADS) for (const [x, z] of resample(roadPoints(road), .5)) {
      const c = Math.cos(h.facing), s = Math.sin(h.facing), dx = x - h.x, dz = z - h.z;
      const lx = dx * c - dz * s, lz = dx * s + dz * c;
      assert.ok(Math.abs(lx) > h.w / 2 + road.w / 2 || Math.abs(lz) > h.d / 2 + road.w / 2, `${road.pts.join('→')} crosses ${h.id}`);
    }
  }
});

test('hall NPC spots chain master → door → lane junction', () => {
  const spots = hallSpots(), ids = new Set(spots.map(s => s.id));
  assert.equal(spots.length, HALLS.length * 2);
  for (const s of spots) assert.ok(ids.has(s.link) || J[s.link], `${s.id} links to ${s.link}`);
  const g = NavGraph.fromRoads((x, z) => walkable(city, x, z));
  for (const h of HALLS) assert.ok(g.nodes.has(h.junction), `${h.junction} is not on the city nav graph`);
});
