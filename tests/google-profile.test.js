import test from 'node:test';
import assert from 'node:assert/strict';
import { Accounts } from '../server/accounts.js';
import { MemoryStore, PgStore } from '../server/store.js';
import { googlePictureURL } from '../src/account/profile-picture.js';

const picture = 'https://lh3.googleusercontent.com/a/profile=s96-c';
const client = 'game.apps.googleusercontent.com';
const claim = extra => ({ aud: client, iss: 'https://accounts.google.com', exp: Math.floor(Date.now()/1000)+600,
  sub: 'profile-1', email: 'profile@gmail.com', email_verified: true, picture, ...extra });

test('Google photos accept HTTPS Google image hosts and reject lookalikes, credentials and other schemes', () => {
  assert.equal(googlePictureURL(picture), picture);
  assert.equal(googlePictureURL('https://lh4.ggpht.com/photo'), 'https://lh4.ggpht.com/photo');
  for (const url of [null, '', 'data:image/png;base64,abc', 'javascript:alert(1)', 'http://lh3.googleusercontent.com/a',
    'https://googleusercontent.com.evil.example/a', 'https://evilgoogleusercontent.com/a',
    'https://user:password@lh3.googleusercontent.com/a', 'https://lh3.googleusercontent.com:8080/a', 'x'.repeat(2049)]) {
    assert.equal(googlePictureURL(url), null, String(url).slice(0,100));
  }
});

test('Verified Google sign-in refreshes its own stored photo; unverified tokens cannot overwrite it', async () => {
  const tokens = { first: claim(), changed: claim({picture: picture + '2'}), empty: claim({picture: undefined}),
    invalid: claim({aud:'wrong',picture:'https://lh3.googleusercontent.com/forged'}), unsafe: claim({picture:'https://evil.example/a'}) };
  const store = new MemoryStore(), a = new Accounts(store, {googleClientId: client, verifyGoogle: async t => tokens[t]});
  const first = await a.google('first');
  assert.deepEqual(await store.googleOf(first.id), {email:'profile@gmail.com',picture});
  await a.google('changed');
  assert.equal((await store.googleOf(first.id)).picture, picture + '2');
  assert.equal((await a.google('invalid')).ok, false);
  assert.equal((await store.googleOf(first.id)).picture, picture + '2');
  for (const t of ['empty','unsafe']) {
    assert.equal((await a.google(t)).id, first.id);
    assert.equal((await store.googleOf(first.id)).picture, null);
  }
  const plain = await a.register('normal', 'secret12');
  assert.equal(await store.googleOf(plain.id), null);
});

test('Linking and relinking refresh a photo but another account cannot claim or update it', async () => {
  const store = new MemoryStore(), a = new Accounts(store, {googleClientId: client, verifyGoogle: async t => claim({picture: t === 'new' ? picture+'2' : picture})});
  await a.register('first','secret12'); await a.register('second','secret12');
  assert.equal((await a.linkGoogle('first','old')).ok,true);
  assert.equal((await a.linkGoogle('first','new')).ok,true);
  assert.equal((await a.linkGoogle('second','old')).code,'google_taken');
  assert.equal(await store.updateGoogle('profile-1','second','stolen@example.com',null),false);
  assert.equal((await store.googleOf('first')).picture,picture+'2');
  assert.equal(await store.googleOf('second'),null);
});

test('Postgres profile writes are parameterized and updates require both Google subject and owning account', async () => {
  const calls = [], store = new PgStore({query: async (sql,values) => {calls.push({sql,values});return {rowCount:1,rows:[{email:'profile@gmail.com',picture}]};}});
  await store.linkGoogle('sub','account','profile@gmail.com',picture);
  await store.updateGoogle('sub','account','profile@gmail.com',picture);
  assert.match(calls[1].sql,/where sub = \$1 and account = \$2/);
  assert.deepEqual(calls[1].values,['sub','account','profile@gmail.com',picture]);
  assert.deepEqual(await store.googleOf('account'),{email:'profile@gmail.com',picture});
  assert.match(calls[2].sql,/order by coalesce\(profile_updated, linked\) desc/);
});

test('Multiple linked Google identities use the most recently verified identity for the HUD', async () => {
  const store = new MemoryStore(), tokens = { old:claim({picture:undefined}), other:claim({sub:'other',picture}), oldUpdated:claim({picture:picture+'2'}) };
  const a = new Accounts(store,{googleClientId:client,verifyGoogle:async t=>tokens[t]});
  await a.register('owner','secret12');
  await a.linkGoogle('owner','old');
  assert.equal((await store.googleOf('owner')).picture,null);
  await a.linkGoogle('owner','other');
  assert.equal((await store.googleOf('owner')).picture,picture);
  await a.google('oldUpdated');
  assert.equal((await store.googleOf('owner')).picture,picture+'2');
});
