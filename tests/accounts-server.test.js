// Server accounts and saves (server/accounts.js) on the memory store.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Accounts, SAVE_LIMIT } from '../server/accounts.js';
import { MemoryStore } from '../server/store.js';

const save = (name = 'แดง', extra = {}) => ({ 'tno.character.v1': JSON.stringify({ name, classId: 'hunter', gender: 'male', level: 3 }), 'tno.quests.v1': '{}', ...extra });

test('register, then log in with the same password only', async () => {
  const A = new Accounts(new MemoryStore());
  const r = await A.register('Ryuu_01', 'secret1');
  assert.ok(r.ok && r.token && r.id === 'ryuu_01');
  assert.equal((await A.register('ryuu_01', 'other12')).code, 'taken');
  assert.equal((await A.register('x', 'secret1')).code, 'bad_id');
  assert.equal((await A.register('guest', 'secret1')).code, 'bad_id');
  assert.equal((await A.register('newbie', '123')).code, 'bad_password');
  assert.ok((await A.login('RYUU_01', 'secret1')).ok);
  const wrong = await A.login('ryuu_01', 'nope123'), unknown = await A.login('nobody', 'secret1');
  assert.equal(wrong.code, 'wrong'); assert.equal(unknown.code, 'unknown');
  assert.equal(wrong.msg, unknown.msg, 'same message for both');
});

test('sessions: a token names its account until it expires or logs out', async () => {
  let now = Date.now();
  const A = new Accounts(new MemoryStore(), { now: () => now });
  const { token } = await A.register('ryuu', 'secret1');
  assert.equal(await A.auth(token), 'ryuu');
  assert.equal(await A.auth('made-up'), null);
  assert.equal(await A.auth({}), null);
  await A.logout(token);
  assert.equal(await A.auth(token), null);
});

test('saves: only the known keys, a real character, and a size cap', async () => {
  const A = new Accounts(new MemoryStore());
  await A.register('ryuu', 'secret1');
  assert.ok((await A.save('ryuu', 0, save())).ok);
  assert.equal((await A.save('ryuu', 9, save())).code, 'bad_slot');
  assert.equal((await A.save('ryuu', 1, { 'evil.key': '1', ...save() })).code, 'bad_save');
  assert.equal((await A.save('ryuu', 1, { 'tno.quests.v1': '{}' })).code, 'no_character');
  assert.equal((await A.save('ryuu', 1, { 'tno.character.v1': '{"x":1}' })).code, 'bad_character');
  assert.equal((await A.save('ryuu', 1, save('a', { 'tno.location.v1': 'not json' }))).code, 'bad_save');
  assert.equal((await A.save('ryuu', 1, save('a', { 'tno.location.v1': JSON.stringify('x'.repeat(SAVE_LIMIT)) }))).code, 'too_big');
  assert.equal((await A.save('ryuu', 1, [])).code, 'bad_save');
  const slots = await A.slots('ryuu');
  assert.deepEqual(slots.map(s => s.slot), [0]);
  const made = await A.character('ryuu', 0);
  assert.deepEqual([made.name, made.classId, made.gender, made.level], ['แดง', 'hunter', 'male', 1], 'a new slot starts as a fresh character (the level sent is ignored)');
  assert.ok((await A.save('ryuu', 0, save('ใหม่', { 'tno.quests.v1': '{"a":1}' }))).ok);
  assert.equal((await A.character('ryuu', 0)).name, 'แดง', 'the character stays the server\'s');
  assert.equal((await A.slots('ryuu'))[0].data['tno.quests.v1'], '{"a":1}', 'the other keys are the browser\'s');
  assert.ok((await A.remove('ryuu', 0)).ok);
  assert.deepEqual(await A.slots('ryuu'), []);
  assert.equal(await A.character('ryuu', 0), null);
});

test('saves cannot change the character: the stored copy, or the one in play, wins', async () => {
  const A = new Accounts(new MemoryStore());
  await A.register('ryuu', 'secret1');
  await A.save('ryuu', 0, save());
  const cheat = { 'tno.character.v1': JSON.stringify({ name: 'แดง', classId: 'hunter', level: 99, gold: 1e9, inventory: [{ id: 'potion_m', qty: 999 }], hp: 50 }) };
  await A.save('ryuu', 0, cheat);
  const c = await A.character('ryuu', 0);
  assert.equal(c.level, 1); assert.ok(c.gold < 1000); assert.ok(!c.inventory.some(s => s?.qty === 999));
  assert.equal(c.hp, 50, 'HP is still the browser\'s');
  await A.save('ryuu', 0, cheat, { ...c, level: 7, gold: 321 });   // the copy in play
  assert.deepEqual([(await A.character('ryuu', 0)).level, (await A.character('ryuu', 0)).gold], [7, 321]);
  assert.ok(await A.putCharacter('ryuu', 0, { ...c, level: 8 }));
  assert.equal((await A.character('ryuu', 0)).level, 8);
});

test('accounts never see each other\'s saves', async () => {
  const A = new Accounts(new MemoryStore());
  await A.register('aaa', 'secret1'); await A.register('bbb', 'secret1');
  await A.save('aaa', 0, save('ของเอ'));
  assert.deepEqual(await A.slots('bbb'), []);
});

// ---- Sign in with Google (verifier stubbed: no network) ----------------------------------
const CLIENT = 'test-client.apps.googleusercontent.com';
const claims = (o = {}) => ({ aud: CLIENT, iss: 'https://accounts.google.com', exp: String(Math.floor(Date.now() / 1000) + 600), sub: '1001', email: 'Somchai.K@gmail.com', email_verified: 'true', ...o });
const withGoogle = tokens => new Accounts(new MemoryStore(), { googleClientId: CLIENT, verifyGoogle: async t => tokens[t] ?? null });

test('Google: first sign-in makes an account from the email, later ones open the same account', async () => {
  const A = withGoogle({ good: claims() });
  const first = await A.google('good');
  assert.ok(first.ok && first.created && first.token);
  assert.equal(first.id, 'somchaik');
  assert.equal(await A.auth(first.token), 'somchaik');
  const again = await A.google('good');
  assert.equal(again.id, 'somchaik'); assert.ok(!again.created);
  assert.equal((await A.login('somchaik', '')).ok, false, 'no password way in to a Google-made account');
});

test('Google: tokens for another app, expired, unverified or forged are refused', async () => {
  const A = withGoogle({
    other: claims({ aud: 'someone-else' }), old: claims({ exp: '1000' }), unverified: claims({ email_verified: 'false' }),
    issuer: claims({ iss: 'https://evil.example' }),
  });
  for (const t of ['other', 'old', 'unverified', 'issuer', 'forged']) assert.equal((await A.google(t)).ok, false, t);
  const off = new Accounts(new MemoryStore(), { verifyGoogle: async () => claims() });
  assert.equal((await off.google('any')).ok, false, 'no client id configured: Google sign-in is off');
});

test('Google: a taken name gets a suffix; linking ties Google to an existing account once', async () => {
  const A = withGoogle({ a: claims(), b: claims({ sub: '2002', email: 'ryuu@gmail.com' }), c: claims({ sub: '3003', email: 'x@y.z' }) });
  await A.register('ryuu', 'secret1');
  const b = await A.google('b');
  assert.match(b.id, /^ryuu_\d{4}$/);
  // link Google "a" to the password account "ryuu": then Google "a" signs in as ryuu
  assert.ok((await A.linkGoogle('ryuu', 'a')).ok);
  assert.equal((await A.google('a')).id, 'ryuu');
  assert.equal((await A.linkGoogle(b.id, 'a')).code, 'google_taken');
  assert.equal((await A.linkGoogle('ryuu', 'forged')).ok, false);
  assert.ok((await A.google('c')).id.length >= 3);
});
