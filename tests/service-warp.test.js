import test from 'node:test';
import assert from 'node:assert/strict';
import { serviceWarp, serviceWarpChannel } from '../server/service-warp.js';
import { WARP_SERVICES, WARP_DESTINATIONS, WARP_RANGE, WARP_COOLDOWN } from '../src/data/warpServices.js';
import { MAPS } from '../src/world/maps.js';
import { navigation } from '../server/navigation.js';
import { Channels, CHANNEL } from '../server/channels.js';

const service = () => WARP_SERVICES.find(s => s.map === 'city');
const player = (s = service()) => ({ id: 1, map: s.map, x: s.x, z: s.z, ch: 2, dead: false });
const destination = () => WARP_DESTINATIONS[0].id;

test('every real steward offers every fixed destination without level, discovery or resource requirements', () => {
  assert.deepEqual([...new Set(WARP_SERVICES.map(s => s.map))].sort(), Object.keys(MAPS).sort());
  assert.equal(WARP_SERVICES.filter(s => s.map === 'city').length, 6);
  for (const id of Object.keys(MAPS).filter(id => id !== 'city')) assert.equal(WARP_SERVICES.filter(s => s.map === id).length, 1);
  for (const s of WARP_SERVICES) {
    assert.ok(navigation(s.map).canStand(s.x, s.z), `${s.npcId}: reachable source`);
    for (const d of WARP_DESTINATIONS) {
      const p = { ...player(s), lv: 1, gold: 0 }, before = structuredClone(p);
      const result = serviceWarp(p, s.npcId, d.id, { now: 0 });
      assert.equal(result.ok, true, `${s.npcId}/${d.id}`);
      assert.equal(result.destination, d, 'returns the authored coordinates');
      assert.deepEqual(p, before, 'planning has no player/resource side effects');
    }
  }
});

test('unknown, malformed and prototype IDs fail closed', () => {
  assert.equal(serviceWarp(null, service().npcId, destination()).why, 'offline');
  for (const id of [undefined, null, {}, [], 'missing', '__proto__', 'constructor', 'toString']) {
    assert.equal(serviceWarp(player(), id, destination()).why, 'npc');
    assert.equal(serviceWarp(player(), service().npcId, id).why, 'destination');
  }
});

test('proximity uses authoritative map and finite source coordinates with an exact five metre limit', () => {
  assert.equal(WARP_RANGE, 5);
  const s = service(), invoke = p => serviceWarp(p, s.npcId, destination(), { now: 0, navigate: () => ({ clear: () => true, canStand: () => true }) });
  assert.equal(invoke({ ...player(), x: s.x + WARP_RANGE }).ok, true);
  assert.equal(invoke({ ...player(), x: s.x + WARP_RANGE + .001 }).why, 'far');
  assert.equal(invoke({ ...player(), map: 'paddy' }).why, 'map');
  for (const x of [NaN, Infinity, undefined, null]) assert.equal(invoke({ ...player(), x }).why, 'far');
});

test('dead presence or character, PvE/PvP combat, duels and active trades prevent travel', () => {
  const p = player(), invoke = (at, opts = {}) => serviceWarp(at, service().npcId, destination(), { now: 0, ...opts });
  assert.equal(invoke({ ...p, dead: true }).why, 'dead');
  assert.equal(invoke(p, { dead: true }).why, 'dead', 'authoritative HP wins even if presence is not marked dead');
  for (const key of ['fighting', 'duel', 'trade']) assert.equal(invoke(p, { [key]: true }).why, 'busy');
});

test('one three-second service cooldown covers every steward and destination independently of recall', () => {
  assert.equal(WARP_COOLDOWN, 3);
  for (const s of WARP_SERVICES) for (const d of WARP_DESTINATIONS) {
    const p = { ...player(s), serviceWarpAt: 10, recallAt: 12.999 };
    assert.equal(serviceWarp(p, s.npcId, d.id, { now: 12.999 }).why, 'cooldown');
    assert.equal(serviceWarp(p, s.npcId, d.id, { now: 13 }).ok, true);
    assert.equal(p.serviceWarpAt, 10);
  }
});

test('blocked arrival is refused instead of using client coordinates or an arbitrary fallback', () => {
  const p = player(), before = structuredClone(p), calls = [];
  const r = serviceWarp(p, service().npcId, destination(), { now: 0, navigate: map => ({ clear: () => true, canStand(x, z) { calls.push({ map, x, z }); return false; } }) });
  assert.equal(r.why, 'blocked');
  const d = WARP_DESTINATIONS[0];
  assert.deepEqual(calls, [{ map: d.map, x: d.x, z: d.z }]);
  assert.deepEqual(p, before);
});

test('a nearby steward behind an authoritative obstacle cannot be used through the wall', () => {
  const p = player(), before = structuredClone(p), s = service();
  const result = serviceWarp(p, s.npcId, destination(), { now: 0, navigate: map => ({
    clear(from, to, pad) { assert.equal(map, s.map); assert.equal(from, p); assert.equal(to, s); assert.equal(pad, .05); return false; },
    canStand() { assert.fail('source obstruction refuses travel before choosing arrival ground'); },
  }) });
  assert.equal(result.why, 'blocked'); assert.deepEqual(p, before);
});

test('same-map travel retains its room, cross-map travel finds room and rejects exhausted capacity', () => {
  const channels = new Channels({ cfg: { ...CHANNEL, cap: {}, capDefault: 1, max: 2 } });
  const p = player();
  assert.deepEqual(serviceWarpChannel(p, 'city', channels, { 2: 1 }), { ok: true, ch: 2 });
  assert.deepEqual(serviceWarpChannel(p, 'paddy', channels, { 1: 1 }), { ok: true, ch: 2 });
  assert.deepEqual(serviceWarpChannel(p, 'paddy', channels, { 1: 1, 2: 1 }), { ok: false, why: 'full' });
});
