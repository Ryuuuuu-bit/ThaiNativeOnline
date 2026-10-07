// Server presence (server/presence.js): rooms per map, what the server refuses, chat.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Presence, LIMITS, rateLimiter } from '../server/presence.js';

const clock = () => { let t = 0; const now = () => t; now.add = s => { t += s; }; return now; };

test('joining puts you in your map\'s room and shows who is already there', () => {
  const P = new Presence({ now: clock() }), a = {}, b = {}, c = {};
  const ra = P.join(a, { name: 'แดง', cls: 'hunter', map: 'paddy', x: 1, z: 2 });
  assert.deepEqual(ra.roster, []);
  const rb = P.join(b, { name: 'ขาว', cls: 'shaman', map: 'paddy' });
  assert.deepEqual(rb.roster.map(p => p.name), ['แดง']);
  const rc = P.join(c, { name: 'ดำ', map: 'city' });
  assert.deepEqual(rc.roster, [], 'other maps are not in the room');
  assert.equal(P.join(a, {}), null, 'a second hello is ignored');
});

test('names, classes and maps are cleaned; nonsense falls back to safe values', () => {
  const P = new Presence({ now: clock() }), a = {};
  const r = P.join(a, { name: '<script>x</script>   ยาวมากเกินกว่าสิบหกตัวอักษร', cls: 'dragon', map: 'moon', lv: 9999, x: 'a', z: Infinity });
  assert.ok(!/[<>]/.test(r.joined.name) && r.joined.name.length <= LIMITS.name);
  assert.equal(r.joined.cls, 'muaythai'); assert.equal(r.map, 'city'); assert.equal(r.joined.lv, 150);
  assert.equal(r.joined.x, 0); assert.equal(r.joined.z, 0);
});

test('moves faster than anyone can run are refused; walking is fine', () => {
  const now = clock(), P = new Presence({ now }), a = {};
  P.join(a, { map: 'paddy', x: 0, z: 0 });
  now.add(1);
  assert.equal(P.move(a, { x: 6, z: 0, f: 1, m: 2 }), true);
  now.add(1);
  assert.equal(P.move(a, { x: 60, z: 0 }), false, 'teleport');
  assert.equal(P.players.get(a).x, 6, 'keeps the last good spot');
  assert.equal(P.move(a, { x: NaN, z: 0 }), false);
  assert.equal(P.move(a, { x: 1e9, z: 0 }), false);
});

test('a portal moves you to another room (the jump is allowed once)', () => {
  const now = clock(), P = new Presence({ now }), a = {}, b = {};
  P.join(a, { map: 'city', x: 0, z: -100 }); P.join(b, { map: 'paddy' });
  const r = P.changeMap(a, { map: 'paddy', x: 0, z: -130 });
  assert.equal(r.left, 'city'); assert.equal(r.map, 'paddy'); assert.equal(r.roster.length, 1);
  assert.equal(P.changeMap(a, { map: 'nowhere' }), null);
});

test('snapshots carry only players who moved, per map', () => {
  const now = clock(), P = new Presence({ now }), a = {}, b = {};
  P.join(a, { map: 'paddy' }); P.join(b, { map: 'paddy' });
  assert.equal(P.snapshot('paddy').length, 2);
  assert.equal(P.snapshot('paddy').length, 0);
  now.add(.5); P.move(a, { x: 1, z: 1 });
  assert.deepEqual(P.snapshot('paddy').map(r => r[0]), [P.players.get(a).id]);
});

test('chat is cleaned and slowed down; animation names must be plain clip ids', () => {
  const now = clock(), P = new Presence({ now }), a = {};
  P.join(a, { name: 'แดง' });
  assert.equal(P.chat(a, '  สวัสดี <b>ทุกคน</b>  ').text, 'สวัสดี bทุกคน/b');
  assert.equal(P.chat(a, 'อีกที'), null, 'too fast');
  now.add(1); assert.equal(P.chat(a, 'x'.repeat(500)).text.length, LIMITS.chat);
  assert.equal(P.anim(a, { clip: 'hunter_shot', sp: 9 }).sp, 3);
  assert.equal(P.anim(a, { clip: '../etc' }), null);
  assert.deepEqual(P.leave(a), { map: 'city', id: 1 });
  assert.equal(P.leave(a), null);
});

test('each socket has a message budget', () => {
  const now = clock(), allow = rateLimiter(now, 5);
  let ok = 0; for (let i = 0; i < 20; i++) if (allow()) ok++;
  assert.equal(ok, 5);
  now.add(1); assert.equal(allow(), true);
});
