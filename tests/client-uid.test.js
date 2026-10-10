import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getIdentity, setIdentity, normalizeUid } from '../src/account/identity.js';
import { ServerAccountStore } from '../src/account/ServerAccounts.js';

test('UID display normalizes only complete server UID formats and clears stale identity', () => {
  setIdentity({accountUid:`acc-${'a'.repeat(32)}`,characterUid:`chr-${'b'.repeat(32)}`});
  assert.equal(getIdentity().accountUid,`ACC-${'A'.repeat(32)}`);
  assert.equal(normalizeUid('ryuuuu','ACC'),null);
  setIdentity({accountUid:'<script>',characterUid:`ACC-${'B'.repeat(32)}`});
  assert.deepEqual(getIdentity(),{accountUid:null,characterUid:null});
});

test('delayed account metadata cannot return after logout or overwrite a new account', async t => {
  const original=globalThis.fetch;t.after(()=>{globalThis.fetch=original;setIdentity();});
  let release;
  globalThis.fetch=async()=>({status:200,json:()=>new Promise(resolve=>{release=resolve})});
  const store=new ServerAccountStore();store.token='old';const pending=store.pull('old');
  await new Promise(resolve=>setImmediate(resolve));store.guest();
  release({ok:true,id:'old',accountUid:`ACC-${'A'.repeat(32)}`,slots:[]});assert.equal(await pending,false);assert.equal(store.accountUid,null);
  store.token='old';const profile=store.me();await new Promise(resolve=>setImmediate(resolve));store.clearIdentity();store.token='new';store.accountUid=`ACC-${'B'.repeat(32)}`;
  release({ok:false});assert.equal((await profile).ok,false);assert.equal(store.accountUid,`ACC-${'B'.repeat(32)}`);
});

test('client UID metadata stays outside slot JSON and clears for guest, logout and failed resume', async t => {
  const values=new Map(),storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k),key:i=>[...values.keys()][i],get length(){return values.size}};
  const original=globalThis.fetch;t.after(()=>{globalThis.fetch=original;setIdentity();});
  let ok=true;
  globalThis.fetch=async()=>({status:ok?200:401,json:async()=>ok?{ok:true,id:'alice',accountUid:`ACC-${'A'.repeat(32)}`,slots:[{slot:0,characterUid:`CHR-${'B'.repeat(32)}`,data:{'tno.character.v1':JSON.stringify({name:'Alice',classId:'warrior',accountUid:'forged',characterUid:'forged'})}}]}:{ok:false}});
  const store=new ServerAccountStore(storage);store.token='session';assert.equal(await store.pull('alice'),true);
  assert.equal(store.slots('alice')[0].characterUid,`CHR-${'B'.repeat(32)}`);
  assert.ok(!Object.keys(store.bundle('alice',0)).some(k=>k.includes('Uid')));
  store.guest();assert.equal(store.accountUid,null);assert.equal(store.slots('guest')[0].characterUid,null);
  await store.pull('alice');setIdentity({accountUid:store.accountUid});ok=false;assert.equal(await store.resume('alice','expired'),false);assert.equal(getIdentity().accountUid,null);assert.equal(store.characterUids.size,0);
  ok=true;await store.pull('alice');store.logout();assert.equal(store.accountUid,null);assert.equal(store.token,null);
});
