// World data and navigation checks that run in Node (node --test), without a browser.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BOUNDS, J, ROADS, PADDIES, CEMETERY, WALL, roadPoints, waterAt, terrainHeight, riverBank, resample, paddyAt,
} from '../src/world/CityMap.js';
import { TerrainData } from '../src/world/Terrain.js';
import { Collision } from '../src/world/Collision.js';
import { NavGraph } from '../src/npc/NavGraph.js';
import { WorldClock, phaseOf } from '../src/core/WorldClock.js';
import { regionAt } from '../src/data/regions.js';
import { LANDMARKS } from '../src/data/landmarks.js';
import { SPAWNS } from '../src/data/spawns.js';

const inBounds = (x, z) => x > BOUNDS.minX && x < BOUNDS.maxX && z > BOUNDS.minZ && z < BOUNDS.maxZ;

test('every road references a known junction', () => {
  for (const road of ROADS) for (const p of road.pts) assert.ok(J[p], `unknown junction ${p}`);
});

test('roads stay out of deep water except on bridges', () => {
  for (const road of ROADS) {
    if (road.kind === 'bridge') continue;
    for (const [x, z] of resample(roadPoints(road), .5)) assert.notEqual(waterAt(x, z), 2, `${road.pts.join('→')} is in deep water at ${x.toFixed(1)},${z.toFixed(1)}`);
  }
});

test('bridges actually span water', () => {
  for (const road of ROADS.filter(r => r.kind === 'bridge')) {
    const wet = resample(roadPoints(road), .5).some(([x, z]) => waterAt(x, z) === 2);
    assert.ok(wet, `bridge ${road.pts.join('→')} crosses no water`);
  }
});

test('the rice paddies exist and are walkable shallow water', () => {
  assert.ok(PADDIES.length > 40, `only ${PADDIES.length} paddies`);
  for (const p of PADDIES) {
    assert.ok(p.x1 > p.x0 && p.z1 > p.z0, 'paddy has positive size');
    const x = (p.x0 + p.x1) / 2, z = (p.z0 + p.z1) / 2;
    assert.equal(paddyAt(x, z), p);
    assert.equal(waterAt(x, z), 1);
  }
});

test('the river is south of the city and its bank is continuous', () => {
  for (let x = BOUNDS.minX; x <= BOUNDS.maxX; x += 5) {
    const bank = riverBank(x);
    assert.equal(waterAt(x, bank + 3), 2);
    assert.equal(waterAt(x, bank - 3), 0);
    assert.ok(terrainHeight(x, bank + 4) < terrainHeight(x, bank - 4));
  }
});

test('terrain grid sampling matches the analytic height', () => {
  const t = new TerrainData();
  for (const [x, z] of [[0, 0], [12.5, -40.25], [-80, 150], [3, -300]]) assert.ok(Math.abs(t.height(x, z) - terrainHeight(x, z)) < .25);
  assert.ok(t.isDeep(0, riverBank(0) + 5));
  assert.ok(!t.isDeep(0, 28));
});

test('the nav graph is one connected network from port to cemetery', () => {
  const g = NavGraph.fromRoads(), start = 'port_c', seen = new Set([start]), queue = [start];
  while (queue.length) for (const e of g.nodes.get(queue.shift()).edges) if (!seen.has(e.to)) { seen.add(e.to); queue.push(e.to); }
  for (const id of Object.keys(J)) assert.ok(seen.has(id), `junction ${id} is unreachable`);
  const path = g.findPath('port_c', 'cem');
  assert.ok(path && path.length > 10);
  assert.equal(path[0].id, 'port_c'); assert.equal(path.at(-1).id, 'cem');
});

test('collision boxes respect rotation and decks ramp up', () => {
  const c = new Collision();
  c.addBox(0, 0, 10, 2, Math.PI / 2);
  assert.ok(c.blocked(0, 4.5, 0), 'a box rotated 90° is long along z');
  assert.ok(!c.blocked(4.5, 0, 0));
  c.addCircle(20, 20, 1);
  assert.ok(c.blocked(20.9, 20)); assert.ok(!c.blocked(21.5, 20));
  c.addDeck(50, 50, 4, 10, 0, .8, [2, 0]);
  assert.equal(c.deckHeight(50, 50), .8);
  assert.ok(Math.abs(c.deckHeight(50, 46) - .4) < 1e-9, 'halfway up the ramp');
  assert.equal(c.deckHeight(50, 54.9), .8, 'no ramp at the far end');
  assert.equal(c.deckHeight(60, 50), null);
});

test('world clock phases and listeners', () => {
  assert.equal(phaseOf(7), 'morning'); assert.equal(phaseOf(12), 'day');
  assert.equal(phaseOf(18), 'evening'); assert.equal(phaseOf(23), 'night'); assert.equal(phaseOf(3), 'night');
  const clock = new WorldClock({ hour: 9.9, minutesPerSecond: 60 }), seen = [];
  clock.onPhase((phase, previous) => seen.push(`${previous}->${phase}`));
  clock.update(1);
  assert.deepEqual(seen, ['morning->day']);
  clock.set(23.99); clock.update(1);
  assert.equal(clock.day, 2); assert.ok(clock.hour < 1);
});

test('regions name the main districts', () => {
  const cases = [[0, 28, 'market'], [6, 150, 'port'], [70, -60, 'temple'], [-60, -200, 'rice'], [0, -420, 'forest'], [0, -540, 'cemetery'], [0, 200, 'river']];
  for (const [x, z, id] of cases) assert.equal(regionAt(x, z).id, id, `${x},${z}`);
  assert.equal(regionAt(0, -540, false).id, 'deep', 'an undiscovered cemetery reads as deep forest');
});

test('landmarks and spawn areas sit inside the map; monsters stay out of the city', () => {
  for (const l of LANDMARKS) assert.ok(inBounds(l.x, l.z), l.id);
  for (const l of LANDMARKS) assert.ok(l.z > WALL.z - 2, `${l.id} lies outside the city walls`);
  for (const s of SPAWNS) {
    assert.ok(inBounds(s.x, s.z), s.id);
    assert.ok(s.z - s.radius < WALL.z - 150, `${s.id} is too close to the city`);
  }
  assert.ok(Math.hypot(CEMETERY.x, CEMETERY.z - WALL.z) > 400, 'the cemetery is a journey away');
});

test('combat zones (none in the safe city today) use known monsters', async () => {
  const { combatSpawns } = await import('../src/data/spawns.js');
  const { MONSTERS } = await import('../src/combat/data/monsters.js');
  for (const z of combatSpawns()) {
    assert.ok(MONSTERS[z.type], `unknown monster ${z.type}`);
    assert.ok(z.active.length > 0);
  }
});
