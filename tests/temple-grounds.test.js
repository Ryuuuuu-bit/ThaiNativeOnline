// The temple grounds in the city: guardian giants on the hall terrace, the bell tower (rung for
// the whole city) and the Bodhi tree (wish cloths). server/templeGrounds.js keeps the rules.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { COMPACT_CITY as CITY, compactCityCanStand } from '../src/world/compact-city.js';
import { cityPavedAt } from '../src/world/compact-city-streets.js';
import { TEMPLE_GUARDIANS, TEMPLE_BELL, TEMPLE_BODHI, TEMPLE_TERRACE_Y, templeReach } from '../src/data/templeGrounds.js';
import { buildCityElephants, CITY_MODELS } from '../src/world/compact-city-render/buildCityElephants.js';
import { TempleGrounds, cleanWish, TEMPLE_SLACK } from '../server/templeGrounds.js';
import { maskRude } from '../server/chat-guard.js';
import { SFX } from '../src/data/audio.js';

const glb = url => {
  const raw = readFileSync(new URL(`../public${url}`, import.meta.url));
  return { raw, json: JSON.parse(raw.subarray(20, 20 + raw.readUInt32LE(12)).toString()) };
};

test('the temple models are packed for the meshopt loader and phone-sized', () => {
  for (const v of ['yak', 'bell_tower', 'bodhi']) {
    const { raw, json } = glb(CITY_MODELS[v].url);
    assert.ok(json.extensionsUsed.includes('EXT_meshopt_compression'), `${v} packed`);
    assert.ok(raw.length < 700_000, `${v} ${raw.length} bytes`);
    assert.ok(json.images.length >= 1, `${v} textured`);
  }
});

test('the bell tower and Bodhi tree are solid reservations off the paving; the giants stand inside the temple', () => {
  for (const site of [TEMPLE_BELL, TEMPLE_BODHI]) {
    const b = CITY.buildings.find(o => o.id === site.id);
    assert.ok(b && b.kind === 'kit', site.id);
    assert.deepEqual([b.x, b.z, b.w, b.d], [site.x, site.z, site.w, site.d]);
    assert.equal(compactCityCanStand(site.x, site.z), false, `${site.id} solid`);
    // somewhere in reach can be stood on, so F works
    let reachable = false;
    for (let a = 0; a < 32 && !reachable; a++) {
      const r = Math.max(site.w, site.d) / 2 + site.range * .6;
      const x = site.x + Math.cos(a / 32 * Math.PI * 2) * r, z = site.z + Math.sin(a / 32 * Math.PI * 2) * r;
      reachable = compactCityCanStand(x, z) && templeReach(site, x, z) <= site.range;
    }
    assert.ok(reachable, `${site.id} reachable`);
  }
  assert.equal(cityPavedAt(TEMPLE_BODHI.x, TEMPLE_BODHI.z), false, 'the tree is planted on ground, not on a street');
  assert.equal(TEMPLE_GUARDIANS.length, 2);
  for (const g of TEMPLE_GUARDIANS) {
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 0]])
      assert.equal(compactCityCanStand(g.x + dx * g.w / 2, g.z + dz * g.d / 2), false, `${g.id} inside the temple's footprint`);
  }
});

test('the giants are drawn on the terrace and every temple model fits its place', async () => {
  const scene = new THREE.Group();
  scene.add(new THREE.Mesh(new THREE.BoxGeometry(.4, 1, .3), new THREE.MeshStandardMaterial()));
  const built = await buildCityElephants({ city: CITY, load: async () => ({ scene }) });
  const root = new THREE.Group(); root.add(built.root); root.updateMatrixWorld(true);
  assert.deepEqual(built.stats.cityModels, { elephant: 2, yak: 2, bell_tower: 1, bodhi: 1 });
  for (const g of TEMPLE_GUARDIANS) {
    const box = new THREE.Box3().setFromObject(built.root.getObjectByName(`city-model:${g.id}`).getObjectByName('city-model-body'));
    assert.ok(Math.abs(box.min.y - (TEMPLE_TERRACE_Y + CITY_MODELS.yak.plinth)) < 1e-6, `${g.id} on the terrace`);
    assert.ok(box.min.x >= g.x - g.w / 2 && box.max.x <= g.x + g.w / 2 && box.min.z >= g.z - g.d / 2 && box.max.z <= g.z + g.d / 2, g.id);
  }
  built.dispose();
});

test('a bronze bell sound exists', () => assert.ok(SFX.temple_bell?.layers.length >= 3));

const at = (site, extra = {}) => ({ id: 7, name: 'นายดำ', account: 'acc1', map: 'city', x: site.x, z: site.z + site.d / 2 + 1, ...extra });
const session = (extra = {}) => ({ c: { alive: true }, persist: true, ...extra });

test('ringing the bell: near the tower, once per player cooldown, and the tower hums between rings', () => {
  const t = new TempleGrounds(); let now = 1_000_000;
  assert.deepEqual(t.ring(at(TEMPLE_BELL, { z: TEMPLE_BELL.z + 20 }), session(), { now }), { ok: false, why: 'far' });
  assert.equal(t.ring(at(TEMPLE_BELL, { map: 'paddy' }), session(), { now }).why, 'far');
  assert.equal(t.ring(at(TEMPLE_BELL), { c: { alive: false }, persist: true }, { now }).why, 'dead');
  assert.equal(t.ring(null, null, { now }).why, 'offline');
  const r = t.ring(at(TEMPLE_BELL), session(), { now });
  assert.deepEqual(r, { ok: true, ring: { t: 'bell', name: 'นายดำ', strikes: TEMPLE_BELL.strikes } });
  // another player right after: still humming
  assert.equal(t.ring(at(TEMPLE_BELL, { id: 8, account: 'acc2' }), session(), { now: now + 1000 }).why, 'ringing');
  now += TEMPLE_BELL.cityCooldownMs;
  assert.equal(t.ring(at(TEMPLE_BELL, { id: 8, account: 'acc2' }), session(), { now }).ok, true);
  // the first player again, before the own cooldown is over (a reconnect keeps the account key)
  now += TEMPLE_BELL.cityCooldownMs;
  const again = t.ring(at(TEMPLE_BELL, { id: 99 }), session(), { now });
  assert.equal(again.why, 'cooldown'); assert.ok(again.wait > 0);
  assert.equal(t.ring(at(TEMPLE_BELL), session(), { now: 1_000_000 + TEMPLE_BELL.playerCooldownMs }).ok, true);
  // guests may ring too (keyed by connection)
  assert.equal(t.ring(at(TEMPLE_BELL, { id: 50, account: null }), session({ persist: false }), { now: 5_000_000 }).ok, true);
  // the range is measured from the tower's edge, with a little slack for late positions
  const edge = TEMPLE_BELL.z + TEMPLE_BELL.d / 2;
  assert.equal(new TempleGrounds().ring(at(TEMPLE_BELL, { z: edge + TEMPLE_BELL.range + TEMPLE_SLACK - .05 }), session()).ok, true);
});

test('tying a wish: signed in, near the tree, short and masked, one a minute, newest few kept', () => {
  const t = new TempleGrounds({ mask: maskRude }); let now = 2_000_000;
  assert.equal(t.wish(at(TEMPLE_BODHI), session({ persist: false }), { text: 'ขอให้รวย' }, { now }).why, 'guest');
  assert.equal(t.wish(at(TEMPLE_BODHI), session(), { text: 'ขอให้รวย' }, { now, muted: true }).why, 'muted');
  assert.equal(t.wish(at(TEMPLE_BODHI, { x: 0, z: 0 }), session(), { text: 'ขอให้รวย' }, { now }).why, 'far');
  assert.equal(t.wish(at(TEMPLE_BODHI), session(), { text: '   \n ' }, { now }).why, 'empty');
  const long = 'ก'.repeat(80);
  const r = t.wish(at(TEMPLE_BODHI), session(), { text: `  ขอให้\nสอบผ่าน‮  ${long}` }, { now });
  assert.equal(r.ok, true);
  assert.ok([...r.wish.text].length <= TEMPLE_BODHI.maxLength);
  assert.ok(!/[\n‮]/.test(r.wish.text) && r.wish.text.startsWith('ขอให้ สอบผ่าน'));
  assert.equal(t.wish(at(TEMPLE_BODHI), session(), { text: 'อีกข้อ' }, { now: now + 1000 }).why, 'cooldown');
  assert.equal(t.wish(at(TEMPLE_BODHI), session(), { text: 'fuck you' }, { now: now += TEMPLE_BODHI.playerCooldownMs }).wish.text.includes('fuck'), false, 'masked');
  for (let i = 0; i < TEMPLE_BODHI.keep + 5; i++)
    assert.equal(t.wish(at(TEMPLE_BODHI, { id: 100 + i, account: `a${i}` }), session(), { text: `wish ${i}` }, { now: now + i }).ok, true);
  const list = t.list(now + 100);
  assert.equal(list.length, TEMPLE_BODHI.keep);
  assert.equal(list.at(-1).text, `wish ${TEMPLE_BODHI.keep + 4}`);
  assert.equal(t.list(now + TEMPLE_BODHI.lifeMs + 1000).length, 0, 'wishes fade');
  assert.equal(cleanWish('a​b'), 'a b');
});
