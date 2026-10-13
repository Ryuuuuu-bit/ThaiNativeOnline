// ภายในอุโบสถ: the hall's layout on the server's baked collision, the siamsi blessing rules
// (src/character/blessing.js) and the server's bless request (server/ubosot.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { MAPS } from '../src/world/maps.js';
import { UBOSOT_SITES, UBOSOT_PROPS, UBOSOT_RANGE } from '../src/world/ubosot.js';
import { navigation } from '../server/navigation.js';
import { findPath, clearLine } from '../src/core/GridPath.js';
import { Character } from '../src/character/Character.js';
import { TEMPLE_SIAMSI, BLESSING_MS, grantBlessing, activeBlessing, blessingRewardMul, blessingRefineAdd, cleanBlessing, canDrawBlessing, todayKey, modsText } from '../src/character/blessing.js';
import { blessRequest } from '../server/ubosot.js';

// 2026-10-13 10:00 Bangkok (UTC+7)
const MORNING = Date.UTC(2026, 9, 13, 3, 0);
const HOUR = 3600e3;

test('the hall: every site is reachable from the door, the shrine is solid, the door leads back to the temple', () => {
  const map = MAPS.ubosot, nav = navigation('ubosot'), stand = (x, z) => nav.canStand(x, z, .35);
  for (const site of UBOSOT_SITES) {
    assert.ok(stand(site.approach.x, site.approach.z), `${site.id} approach standable`);
    assert.ok(findPath(stand, map.spawn, site.approach, { step: .5, margin: 20 }), `${site.id} reachable`);
  }
  for (const p of UBOSOT_PROPS) assert.equal(nav.canStand(p.x, p.z), false, `${p.id} solid`);
  const pray = UBOSOT_SITES.find(s => s.id === 'pray');
  assert.ok(clearLine(stand, pray.approach.x, pray.approach.z, map.spawn.x, map.spawn.z), 'a clear aisle from the door to the rug');
  const out = map.portals[0], inn = MAPS.city.portals.find(p => p.to === 'ubosot');
  assert.equal(out.to, 'city'); assert.equal(inn.style, 'door'); assert.equal(out.style, 'door');
  assert.ok(navigation('city').canStand(inn.at.x, inn.at.z), 'the temple door threshold is open');
  assert.ok(navigation('city').canStand(out.arrive.x, out.arrive.z), 'the temple steps arrival is open');
});

test('twenty cards, five kinds by four luck tiers, none harmful; 1–12 keep their old meaning', () => {
  assert.equal(TEMPLE_SIAMSI.length, 20);
  assert.deepEqual(TEMPLE_SIAMSI.map(c => c.no), Array.from({ length: 20 }, (_, i) => i + 1));
  assert.deepEqual(TEMPLE_SIAMSI.slice(0, 12).map(c => c.kind), Array(4).fill(['dmg', 'exp', 'drop']).flat());
  for (const kind of ['dmg', 'exp', 'drop']) assert.deepEqual(TEMPLE_SIAMSI.filter(c => c.kind === kind).map(c => c.bonus), [.2, .15, .1, .05]);
  assert.deepEqual(TEMPLE_SIAMSI.filter(c => c.kind === 'card').map(c => c.mods.cardMul), [1.3, 1.2, 1.1, 1.05]);
  assert.deepEqual(TEMPLE_SIAMSI.filter(c => c.kind === 'refine').map(c => c.mods.refineAdd), [.03, .02, .015, .01]);
  for (const c of TEMPLE_SIAMSI) {
    assert.equal(Object.keys(c.mods).length, 1);
    assert.ok(Object.values(c.mods).every(v => v > 0), `${c.no} is a blessing`);
    assert.match(modsText(c.mods), /^(ดาเมจ|EXP|ของดรอป|ดรอปการ์ด) \+\d+%$|^โอกาสตีบวก \+[\d.]+% \(ตีครั้งเดียว\)$/);
    assert.ok(c.text.length > 10);
  }
});

test('one card a Thai day, for three hours; it resets at midnight Bangkok time and replaces the old card', () => {
  const c = new Character({ name: 'QA', classId: 'muaythai' });
  const first = grantBlessing(c, { now: MORNING, random: () => 0 });
  assert.equal(first.ok, true); assert.equal(first.blessing.no, 1);
  assert.equal(first.blessing.until - first.blessing.at, BLESSING_MS); assert.equal(BLESSING_MS, 3 * HOUR);
  assert.deepEqual(grantBlessing(c, { now: MORNING + HOUR }).why, 'today');
  assert.ok(activeBlessing(c.blessing, MORNING + 2.9 * HOUR)); assert.equal(activeBlessing(c.blessing, MORNING + 3 * HOUR), null);
  // 23:30 Bangkok → still today; 00:10 → a new day, a new card replaces the old one
  const late = Date.UTC(2026, 9, 13, 16, 30), next = Date.UTC(2026, 9, 13, 17, 10);
  assert.equal(canDrawBlessing(c.blessing, late), false);
  assert.equal(canDrawBlessing(c.blessing, next), true);
  assert.equal(todayKey(next), '2026-10-14');
  const again = grantBlessing(c, { now: next, random: () => .99 });
  assert.equal(again.ok, true); assert.equal(again.blessing.no, 20); assert.equal(c.blessing.day, '2026-10-14');
});

test('the blessing is saved, raises damage or rewards, outlives death and never becomes a buff', () => {
  const c = new Character({ name: 'QA', classId: 'muaythai' }), base = c.attack;
  c.blessing = { day: todayKey(), no: 1, at: Date.now(), until: Date.now() + BLESSING_MS };   // ดาเมจ +20%
  assert.ok(c.attack > base && Math.abs(c.attack / base - 1.2) < .02, `${base} → ${c.attack}`);
  assert.equal(c.buffs.length, 0);
  c.fall?.(); c.revive?.(); assert.ok(c.blessing, 'death keeps the blessing');
  const loaded = new Character(JSON.parse(JSON.stringify(c)));
  assert.deepEqual(loaded.blessing, c.blessing);
  assert.equal(cleanBlessing({ day: 'x', no: 1, at: 1, until: 2 }), null);
  assert.equal(cleanBlessing({ day: '2026-10-13', no: 21, at: 1, until: 2 }), null);
  assert.equal(cleanBlessing({ day: '2026-10-13', no: 2, at: 0, until: BLESSING_MS * 2 }), null, 'longer than three hours is refused');
  const exp = { day: '2026-10-13', no: 2, at: MORNING, until: MORNING + BLESSING_MS }, drop = { ...exp, no: 3 };
  assert.deepEqual(blessingRewardMul(exp, MORNING + 1), { exp: 1.2, gold: 1, drop: 1, card: 1 });
  assert.deepEqual(blessingRewardMul(drop, MORNING + 1), { exp: 1, gold: 1, drop: 1.2, card: 1 });
  assert.deepEqual(blessingRewardMul(exp, MORNING + BLESSING_MS), { exp: 1, gold: 1, drop: 1, card: 1 });
});

test('the server draws only for a signed-in, living character standing at a site in the hall, once a day', () => {
  const site = UBOSOT_SITES.find(s => s.id === 'pray');
  const at = { map: 'ubosot', x: site.approach.x, z: site.approach.z };
  const session = () => ({ c: new Character({ name: 'QA', classId: 'herbalist' }), persist: { account: 'a' }, dirty: false });
  const s = session();
  assert.equal(blessRequest(at, { ...s, persist: null }, { site: 'pray' }).why, 'guest');
  assert.equal(blessRequest({ ...at, map: 'city' }, s, { site: 'pray' }).why, 'far');
  assert.equal(blessRequest({ ...at, x: at.x + UBOSOT_RANGE + 2 }, s, { site: 'pray' }).why, 'far');
  assert.equal(blessRequest(at, s, { site: 'nowhere' }).why, 'far');
  const ok = blessRequest(at, s, { site: 'pray', request: 'r1' }, { now: MORNING, random: () => .5 });
  assert.equal(ok.ok, true); assert.equal(ok.request, 'r1'); assert.equal(ok.blessing.no, 11); assert.equal(s.dirty, true);
  const twice = blessRequest(at, s, { site: 'siamsi' }, { now: MORNING + HOUR });
  assert.equal(twice.why, 'far', 'the siamsi stand is elsewhere');
  const stand = UBOSOT_SITES.find(x => x.id === 'siamsi').approach;
  assert.equal(blessRequest({ map: 'ubosot', ...stand }, s, { site: 'siamsi' }, { now: MORNING + HOUR }).why, 'today');
});

test('the ตีบวก card adds to one risky try only, then is spent and saved as spent', () => {
  const c = Character.create('QA', 'warrior'); c.gold = 50000; c.addItem('sacred_ore', 20);
  const now = Date.now();
  c.blessing = { day: todayKey(now), no: 14, at: now, until: now + BLESSING_MS };   // +3%
  assert.equal(blessingRefineAdd(c.blessing), .03);
  for (let i = 0; i < 4; i++) assert.equal(c.refineGear('weapon', () => 0).outcome, 'up');   // +1…+4 are safe
  assert.equal(c.blessing.refineUsed, undefined, 'safe steps do not spend it');
  // +5 succeeds 60%: a roll of .62 fails without the card, works with +3%
  const r = c.refineGear('weapon', () => .62);
  assert.equal(r.outcome, 'up'); assert.equal(r.blessed, .03);
  assert.equal(c.blessing.refineUsed, true); assert.equal(blessingRefineAdd(c.blessing), 0);
  assert.deepEqual(new Character(JSON.parse(JSON.stringify(c))).blessing.refineUsed, true);
  assert.equal(c.refineGear('weapon', () => .52).outcome, 'broke', 'the next try has no help (+6 is 50%)');
});

test('the card-drop card multiplies the card chance for signed-in kills', () => {
  const now = Date.now(), b = { day: todayKey(now), no: 13, at: now, until: now + BLESSING_MS };
  assert.equal(blessingRewardMul(b).card, 1.3);
  assert.equal(blessingRewardMul(null).card, 1);
  assert.equal(blessingRewardMul({ ...b, no: 1 }).card, 1);
});
