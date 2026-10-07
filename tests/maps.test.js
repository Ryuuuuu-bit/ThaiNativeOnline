// Map registry checks (src/world/maps.js): นครอโยธยา inside the walls and three
// zone maps north of them (paddy → deep_forest → wat_rang), linked only by
// portals. Content must belong to exactly one map, portals must deliver the
// player somewhere standable that does not bounce them back, and the city stays
// a safe zone.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BOUNDS, J, PLAZAS, ROADS, CEMETERY, roadPoints, resample, waterAt } from '../src/world/CityMap.js';
import { MAPS, MAP_IDS, DEFAULT_MAP, SEAM_Z, FOREST_SEAM_Z, WAT_SEAM_Z, LEGACY_MAPS, mapOf, walkable, inView, portalAt, walkBounds, npcHome, npcMap, npcsForMap, landmarksOf, spawnsOf, resolveLocation, arrivalsOn } from '../src/world/maps.js';
import { NavGraph } from '../src/npc/NavGraph.js';
import { regionAt } from '../src/data/regions.js';
import { LANDMARKS } from '../src/data/landmarks.js';
import { SPAWNS, combatSpawns } from '../src/data/spawns.js';
import { MONSTERS } from '../src/combat/data/monsters.js';
import { NPCS } from '../src/data/npcs.js';
import { QUESTS } from '../src/data/quests.js';
import { HALLS, hallSpots, hallOf } from '../src/data/halls.js';
import { WAT_RANG, SITES } from '../src/data/sites.js';
import { CLASSES } from '../src/character/data/classes.js';

const { city, paddy, deep_forest: forest, wat_rang: wat } = MAPS;
const WILD = ['paddy', 'deep_forest', 'wat_rang'];
const bandOf = z => (z >= SEAM_Z ? 'city' : z >= FOREST_SEAM_Z ? 'paddy' : z >= WAT_SEAM_Z ? 'deep_forest' : 'wat_rang');
const owners = (x, z) => MAP_IDS.filter(id => z >= MAPS[id].owns.minZ && z < MAPS[id].owns.maxZ);

test('the registry has the city and three zone maps, linked by portals both ways', () => {
  assert.deepEqual([...MAP_IDS].sort(), ['city', 'deep_forest', 'paddy', 'wat_rang']);
  assert.equal(DEFAULT_MAP, 'city');
  for (const map of Object.values(MAPS)) {
    assert.ok(map.name && map.sub && map.walk.length && map.view && map.owns && map.spawn, `${map.id} is incomplete`);
    assert.ok(['city', 'paddy', 'forest', 'wat'].includes(map.theme), `${map.id} theme ${map.theme}`);
    assert.ok(map.portals.length, `${map.id} has no way out`);
    for (const p of map.portals) {
      assert.ok(MAPS[p.to], `${map.id} portal ${p.id} leads to unknown map ${p.to}`);
      assert.ok(['warp', 'path'].includes(p.style), `${p.id} style ${p.style}`);
      assert.ok(p.name, `${p.id} has no label`);
      assert.ok(MAPS[p.to].portals.some(q => q.to === map.id && q.style === p.style), `${p.to} has no ${p.style} back to ${map.id}`);
      assert.ok(J[p.node] && walkable(map, ...J[p.node]), `${p.id} exit node ${p.node} is not a junction on ${map.id}`);
    }
  }
  assert.ok(city.safe && city.levels === null);
  for (const id of WILD) assert.ok(!MAPS[id].safe && MAPS[id].levels?.length === 2, id);
  // The city and the paddies are linked by the warp pair; the wild maps by path exits in a chain.
  const links = Object.values(MAPS).flatMap(m => m.portals.map(p => `${m.id}>${p.to}:${p.style}`)).sort();
  assert.deepEqual(links, ['city>paddy:warp', 'deep_forest>paddy:path', 'deep_forest>wat_rang:path', 'paddy>city:warp', 'paddy>deep_forest:path', 'wat_rang>deep_forest:path']);
  // Visitors from the city leave the paddies through the warp (npcsForMap uses portals[0]).
  assert.equal(paddy.portals[0].to, 'city');
});

test('ownership partitions the world at the seams: outside the wall, before the forest gate, before the shrine', () => {
  for (let z = BOUNDS.minZ; z <= BOUNDS.maxZ - 1; z += 1.5) for (let x = BOUNDS.minX; x <= BOUNDS.maxX; x += 25) {
    const own = owners(x, z);
    assert.equal(own.length, 1, `${x},${z} is owned by ${own.join(', ') || 'nobody'}`);
    assert.equal(mapOf(x, z), bandOf(z), `${x},${z}`);
  }
});

test('walkable areas stay inside the world, the built view and their own band', () => {
  for (const map of Object.values(MAPS)) {
    const b = walkBounds(map);
    assert.ok(b.minX >= BOUNDS.minX && b.maxX <= BOUNDS.maxX && b.minZ >= BOUNDS.minZ && b.maxZ <= BOUNDS.maxZ, `${map.id} walks outside the world`);
    assert.ok(b.minZ >= map.owns.minZ && b.maxZ <= map.owns.maxZ, `${map.id} walks outside its band`);
    for (const r of map.walk) for (const [x, z] of [[r.minX, r.minZ], [r.maxX, r.maxZ], [r.minX, r.maxZ], [r.maxX, r.minZ]]) assert.ok(inView(map, x, z), `${map.id} can walk to ${x},${z} outside its view`);
    // The camera never sees the edge of the built ground near a seam.
    assert.ok(b.minZ - map.view.minZ >= 17 && map.view.maxZ - b.maxZ >= 17 || map.id === 'city', `${map.id} view margin is too small`);
    assert.ok(walkable(map, map.spawn.x, map.spawn.z), `${map.id} spawn is not walkable`);
    for (const [x, z] of map.respawn) assert.ok(walkable(map, x, z) && waterAt(x, z) !== 2, `${map.id} respawn ${x},${z}`);
  }
});

test('the maps never touch: the only way across a seam is a portal', () => {
  // Inner walk area ends inside the wall (z -110), the outer one outside it.
  assert.ok(walkBounds(city).minZ > -110 && walkBounds(paddy).maxZ < -111);
  // Neighbouring walk areas stop at least 4 m apart at every seam.
  for (const [a, b] of [[city, paddy], [paddy, forest], [forest, wat]]) assert.ok(walkBounds(a).minZ - walkBounds(b).maxZ >= 4, `${a.id} and ${b.id} walk areas are too close`);
  for (let z = BOUNDS.minZ; z <= BOUNDS.maxZ; z += .5) for (let x = -122; x <= 122; x += 4) {
    const on = MAP_IDS.filter(id => walkable(MAPS[id], x, z));
    assert.ok(on.length <= 1, `${on.join(' and ')} both walk at ${x},${z}`);
  }
});

test('portals arrive somewhere standable that is not inside a trigger (no ping-pong) and can be reached', () => {
  for (const map of Object.values(MAPS)) for (const p of map.portals) {
    const dest = MAPS[p.to], { x, z } = p.arrive;
    assert.ok(walkable(dest, x, z), `${p.id} arrives off the walkable area of ${dest.id}`);
    assert.notEqual(waterAt(x, z), 2, `${p.id} arrives in deep water`);
    assert.equal(portalAt(dest, x, z), null, `${p.id} arrives inside a portal of ${dest.id}`);
    for (const q of dest.portals) assert.ok(Math.hypot(x - q.at.x, z - q.at.z) > q.at.radius + 3, `${p.id} arrives within 3 m of ${q.id}`);
    assert.ok(walkable(map, p.at.x, p.at.z), `${p.id} centre is not walkable`);
    assert.ok(inView(map, (p.marker ?? p.at).x, (p.marker ?? p.at).z), `${p.id} marker is outside the view`);
    // Path exits sit on the road or trail that crosses the seam, within reach of its exit node.
    if (p.style === 'path') {
      const onRoad = ROADS.some(r => resample(roadPoints(r), .5).some(([rx, rz]) => Math.hypot(rx - p.at.x, rz - p.at.z) < 1.2));
      assert.ok(onRoad, `${p.id} is not on a road`);
      assert.ok(Math.hypot(J[p.node][0] - p.at.x, J[p.node][1] - p.at.z) < 15, `${p.id} is far from ${p.node}`);
    }
  }
  // The city warp sits in the gate passage, off the wall road (z -103 ± 1.75).
  const warp = city.portals[0];
  assert.equal(warp.to, 'paddy');
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
  assert.ok(landmarksOf('wat_rang', LANDMARKS).some(l => l.id === 'cemetery' && l.hidden));
  assert.ok(landmarksOf('paddy', LANDMARKS).some(l => l.id === 'outer_warp'));
  assert.ok(landmarksOf('deep_forest', LANDMARKS).some(l => l.id === 'forest_gate'));
  // Discovery works per loaded map: every zone map has a few places to find.
  for (const id of WILD) assert.ok(landmarksOf(id, LANDMARKS).length >= 3, `${id} has fewer than 3 landmarks`);
});

test('monster areas live only on the zone maps; the city stays a safe zone', () => {
  assert.ok(SPAWNS.length > 0);
  for (const s of SPAWNS) {
    assert.equal(owners(s.x, s.z).length, 1, s.id);
    const map = MAPS[mapOf(s.x, s.z)];
    assert.ok(!map.safe, `${s.id} lies on safe map ${map.id}`);
    assert.ok(walkable(map, s.x, s.z) && waterAt(s.x, s.z) !== 2, `${s.id} centre is not walkable`);
    // The whole area stays on its map's walk area.
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) assert.ok(walkable(map, s.x + dx * s.radius, s.z + dz * s.radius), `${s.id} reaches off ${map.id}`);
  }
  for (const z of combatSpawns()) {
    assert.ok(MONSTERS[z.type], `unknown monster ${z.type}`);
    const map = MAPS[mapOf(z.x, z.z)], def = MONSTERS[z.type], lv = def.level;
    // elites and bosses may stand a few levels above the band, in a spot of their own
    const top = def.elite || def.boss ? map.levels[1] + 3 : map.levels[1];
    assert.ok(lv >= map.levels[0] && lv <= top, `${z.type} (Lv ${lv}) of ${z.area} is outside the ${map.id} band ${map.levels}`);
    assert.ok(z.count > 0 && z.active.length, `${z.area}/${z.type} never spawns`);
  }
  assert.equal(spawnsOf('city', SPAWNS).length, 0);
  for (const id of WILD) {
    const zones = combatSpawns().filter(z => mapOf(z.x, z.z) === id);
    assert.ok(zones.length, `${id} has no monsters`);
    for (const phase of ['day', 'night']) assert.ok(zones.some(z => z.active.includes(phase)), `${id} is empty at ${phase}`);
  }
  // Elites and bosses come back slowly (or by chance) and only one at a time.
  for (const z of combatSpawns().filter(z => MONSTERS[z.type].elite || MONSTERS[z.type].boss)) {
    assert.equal(z.count, 1, z.type); assert.ok(z.respawn >= 240, `${z.type} respawns too fast`);
  }
});

test('monster levels rise map by map, away from the city', () => {
  const levels = id => combatSpawns().filter(z => mapOf(z.x, z.z) === id && !MONSTERS[z.type].elite && !MONSTERS[z.type].boss).map(z => MONSTERS[z.type].level);
  const warp = paddy.portals[0].at, near = combatSpawns().filter(z => mapOf(z.x, z.z) === 'paddy' && !MONSTERS[z.type].elite && Math.hypot(z.x - warp.x, z.z - warp.z) < 140);
  assert.ok(near.length);
  assert.ok(Math.max(...near.map(z => MONSTERS[z.type].level)) <= 2, 'the hunt next to the warp is for new characters');
  for (const z of near) assert.ok(!z.active.includes('night') || z.type !== 'boar', 'boars sleep at night');
  const avg = id => levels(id).reduce((a, b) => a + b, 0) / levels(id).length;
  assert.ok(avg('paddy') < avg('deep_forest') && avg('deep_forest') < avg('wat_rang'), 'average level rises paddy → forest → wat');
  assert.ok(Math.max(...levels('paddy')) <= 3 && Math.min(...levels('wat_rang')) >= 4);
  // The dead of the wat come out after dark: its night roster outnumbers its day roster.
  const count = (id, phase) => combatSpawns().filter(z => mapOf(z.x, z.z) === id && z.active.includes(phase)).reduce((n, z) => n + z.count, 0);
  assert.ok(count('wat_rang', 'night') > count('wat_rang', 'day'));
});

test('quests only ask for places and monsters that exist', () => {
  const place = new Set(LANDMARKS.map(l => l.id));
  const hunted = new Set(combatSpawns().map(z => z.type));
  for (const q of QUESTS) for (const o of q.objectives) {
    if (o.discover) assert.ok(place.has(o.discover), `${q.id}: ${o.discover}`);
    if (o.kill) assert.ok(hunted.has(o.kill), `${q.id} asks for ${o.kill}, which is not placed`);
  }
});

test('every NPC home lies inside exactly one map; visitors leave the paddies through the warp', () => {
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

  const has = map => id => (id === 'herb_gather' ? map.id === 'paddy' : !!J[id] && walkable(map, ...J[id]));
  const rosters = Object.fromEntries(MAP_IDS.map(id => [id, npcsForMap(NPCS, id, has(MAPS[id]))]));
  const inCity = rosters.city, outside = rosters.paddy;
  assert.equal(MAP_IDS.reduce((n, id) => n + rosters[id].filter(r => !r.visitor).length, 0), NPCS.length, 'each NPC is a resident of one map');
  assert.ok(inCity.length > 40);
  // Each wild map past the paddies has a supplier standing near its entrance, there at night too.
  for (const id of ['deep_forest', 'wat_rang']) {
    const sup = rosters[id].filter(n => n.shopType);
    assert.ok(sup.length, `${id} has no supplier`);
    const entry = Object.values(MAPS).flatMap(m => m.portals.filter(p => p.to === id && (m.levels?.[0] ?? 0) < MAPS[id].levels[0]).map(p => p.arrive))[0];
    for (const n of sup) {
      const at = n.schedule.night.at;
      assert.ok(at && typeof at === 'object' && walkable(MAPS[id], at.x, at.z), `${n.id} is not on ${id} at night`);
      assert.ok(Math.hypot(at.x - entry.x, at.z - entry.z) < 12, `${n.id} stands far from the ${id} entrance`);
    }
  }
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
    assert.ok(map.regions.includes(regionAt(x, z, false).id), `${map.id} shows region ${regionAt(x, z, false).id} at ${x},${z} (cemetery undiscovered)`);
  }
});

test('each map\'s nav graph is one connected network', () => {
  for (const map of Object.values(MAPS)) {
    const g = NavGraph.fromRoads((x, z) => walkable(map, x, z)), ids = [...g.nodes.keys()];
    assert.ok(ids.length > 20, `${map.id} nav graph is tiny`);
    const start = map.portals[0].node, seen = new Set([start]), queue = [start];
    while (queue.length) for (const e of g.nodes.get(queue.shift()).edges) if (!seen.has(e.to)) { seen.add(e.to); queue.push(e.to); }
    for (const id of Object.keys(J)) if (g.nodes.has(id)) assert.ok(seen.has(id), `${map.id}: ${id} is not reachable from the warp`);
    for (const p of map.portals) assert.ok(seen.has(p.node), `${map.id}: exit node ${p.node} is not connected`);
  }
});

test('saves from the retired fields map load on the zone map that owns the position', () => {
  assert.deepEqual([...LEGACY_MAPS.fields].sort(), [...WILD].sort());
  const at = (x, z) => resolveLocation({ map: 'fields', x, z, facing: 1 });
  assert.deepEqual(at(-60, -140), { map: 'paddy', x: -60, z: -140, facing: 1 });       // farmers' village
  assert.deepEqual(at(-28, -372), { map: 'deep_forest', x: -28, z: -372, facing: 1 }); // dense forest
  assert.deepEqual(at(0, -530), { map: 'wat_rang', x: 0, z: -530, facing: 1 });        // cemetery
  // A position in the gap between two walk areas moves to the nearest arrival point.
  for (const [x, z] of [[0, -295], [-80, -297], [5, -444], [60, -446]]) {
    const loc = at(x, z), map = MAPS[loc.map];
    assert.equal(loc.map, mapOf(x, z));
    assert.ok(walkable(map, loc.x, loc.z) && !portalAt(map, loc.x, loc.z), `${x},${z} → ${JSON.stringify(loc)}`);
    assert.ok(arrivalsOn(loc.map).some(a => a.x === loc.x && a.z === loc.z), `${x},${z} did not go to an arrival point`);
  }
  // Current saves pass through unchanged; broken ones are rejected (MapManager falls back to the city).
  assert.deepEqual(resolveLocation({ map: 'wat_rang', x: 1, z: -500, facing: 0 }), { map: 'wat_rang', x: 1, z: -500, facing: 0 });
  assert.equal(resolveLocation({ map: 'fields', x: NaN, z: -200 }), null);
  assert.equal(resolveLocation({ map: 'fields', x: 0, z: 100 }), null, 'a fields save inside the city band is invalid');
  assert.equal(resolveLocation(null), null);
});

test('the วัดร้าง site is reserved on wat_rang, clear of the cemetery, roads, spawns and landmarks', () => {
  // Facing west, the depth runs along x and the frontage along z.
  const s = WAT_RANG, x0 = s.x - s.d / 2, x1 = s.x + s.d / 2, z0 = s.z - s.w / 2, z1 = s.z + s.w / 2;
  assert.equal(s.facing, -Math.PI / 2);
  assert.ok(SITES.includes(s));
  for (const [x, z] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) assert.ok(mapOf(x, z) === s.map && walkable(wat, x, z), `site corner ${x},${z}`);
  assert.ok(x0 > CEMETERY.x + CEMETERY.r, 'the site overlaps the cemetery');
  for (let x = x0; x <= x1; x += 1) for (let z = z0; z <= z1; z += 1) assert.equal(waterAt(x, z), 0, `water in the site at ${x},${z}`);
  for (const road of ROADS) for (const [x, z] of resample(roadPoints(road), 1)) assert.ok(!(x > x0 - 2 && x < x1 + 2 && z > z0 - 2 && z < z1 + 2), `${road.pts.join('→')} crosses the site`);
  // The temple's own yard zone and landmark belong inside it; nothing else may intrude.
  const OWN = new Set(['wat_courtyard', 'wat_temple', 'wat_ubosot', 'wat_stupas']);
  for (const a of SPAWNS) if (OWN.has(a.id)) assert.ok(a.x > x0 && a.x < x1 && a.z > z0 && a.z < z1, `${a.id} sits in the site`); else assert.ok(a.x + a.radius < x0 || a.x - a.radius > x1 || a.z + a.radius < z0 || a.z - a.radius > z1, `${a.id} overlaps the site`);
  for (const l of LANDMARKS) if (!OWN.has(l.id)) assert.ok(!(l.x > x0 && l.x < x1 && l.z > z0 && l.z < z1), `${l.id} lies in the site`);
  for (const p of [s.gate, ...Object.values(s.spots)]) assert.ok(walkable(wat, p.x, p.z) && mapOf(p.x, p.z) === 'wat_rang', `site spot ${p.x},${p.z}`);
  assert.ok(J[s.approach] && mapOf(...J[s.approach]) === 'wat_rang', `approach junction ${s.approach}`);
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
