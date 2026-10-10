import test from 'node:test';
import assert from 'node:assert/strict';
import { MemoryStore, PgStore } from '../server/store.js';
import { Accounts } from '../server/accounts.js';
import { openAdminRoles } from '../server/adminRoles.js';
import { newUid, accountUid, retryUid, migrateUids } from '../server/uids.js';
const data = name => ({'tno.character.v1':JSON.stringify({name,classId:'warrior',gender:'male'})});
const collision = constraint => Object.assign(new Error('duplicate UID'),{code:'23505',constraint});

test('UIDs are random opaque 128-bit identifiers with explicit kinds',()=>{
 const ids=new Set(Array.from({length:1000},()=>newUid('ACC')));assert.equal(ids.size,1000);
 for(const uid of ids)assert.match(uid,/^ACC-[A-F0-9]{32}$/);
 assert.match(newUid('CHR'),/^CHR-[A-F0-9]{32}$/);
 const uid=[...ids][0];assert.equal(accountUid(` ${uid.toLowerCase()} `),uid);assert.equal(accountUid('guest'),null);assert.equal(accountUid(newUid('CHR')),null);
});

test('account identity survives sessions, Google link and service reconstruction without email metadata',async()=>{
 const store=new MemoryStore(),claims={aud:'client',iss:'accounts.google.com',exp:Date.now()/1000+1000,sub:'sub',email:'private@example.com',email_verified:'true'};
 const a=new Accounts(store,{googleClientId:'client',verifyGoogle:async()=>claims});
 const r=await a.register('owner','password123');assert.match(r.accountUid,/^ACC-/);
 assert.equal((await a.login('owner','password123')).accountUid,r.accountUid);
 await a.linkGoogle('owner','token');assert.equal((await a.google('token')).accountUid,r.accountUid);
 assert.deepEqual(await new Accounts(store).identity('owner'),{accountUid:r.accountUid});assert.equal(await a.identity('missing'),null);
});

test('character UID is slot metadata retained on saves and rename; recreate allocates a fresh incarnation',async()=>{
 const s=new MemoryStore(),a=new Accounts(s);await s.createAccount('owner','salt','hash');await a.save('owner',0,data('First Hero'));
 const first=(await a.slots('owner'))[0];assert.match(first.characterUid,/^CHR-/);assert.equal(await a.characterIdentity('other',0),null);
 const identity=await a.characterIdentity('owner',0);assert.equal(identity.characterUid,first.characterUid);assert.equal(identity.accountUid,(await a.identity('owner')).accountUid);
 const old=new Accounts(s);await old.character('owner',0);
 await a.save('owner',0,{'tno.character.v1':JSON.stringify({name:'Forged Rename',classId:'warrior',characterUid:'CHR-FORGED',accountUid:'ACC-FORGED'})});
 s.slots.get('owner').get(0).needsRename=true;await a.rename('owner',0,'Second Hero');
 assert.equal((await a.slots('owner'))[0].characterUid,first.characterUid);
 await a.remove('owner',0);await a.save('owner',0,data('New Hero'));
 const next=(await a.slots('owner'))[0];assert.notEqual(next.characterUid,first.characterUid);
 assert.equal(await old.putCharacter('owner',0,{name:'Old Hero',gold:999}),false);
 assert.equal((await old.save('owner',0,data('Old Hero'))).ok,false);
 assert.equal((await a.slots('owner'))[0].characterUid,next.characterUid);
});

test('memory backfill is idempotent, concurrent creates remain unique and collision exhaustion publishes nothing',async()=>{
 const s=new MemoryStore();s.accounts.set('legacy',{id:'legacy'});s.slots.set('legacy',new Map([[0,{data:data('Legacy Hero')}]]));await s.init();const before=await new Accounts(s).characterIdentity('legacy',0);await s.init();assert.deepEqual(await new Accounts(s).characterIdentity('legacy',0),before);
 await Promise.all(Array.from({length:50},(_,i)=>s.createAccount(`user${i}`,'s','h')));assert.equal(new Set([...s.accounts.values()].map(a=>a.accountUid)).size,51);
 const fixed=new MemoryStore({uidGenerator:k=>`${k}-${'A'.repeat(32)}`});await fixed.createAccount('one','s','h');await assert.rejects(fixed.createAccount('two','s','h'));assert.equal(await fixed.getAccount('two'),null);
});

test('role mutations resolve public Account UID but retain internal authority keys and protected roots',async()=>{
 const s=new MemoryStore();for(const id of ['owner','target'])await s.createAccount(id,'s','h');const roles=await openAdminRoles(s,{adminIds:'owner'}),uid=(await s.getAccount('target')).accountUid;
 assert.equal((await roles.add(uid.toLowerCase(),'owner')).id,'target');assert.equal(await roles.effective('target'),true);assert.equal(await roles.effective(uid),false);
 assert.equal((await roles.remove(uid,'owner')).id,'target');assert.equal((await roles.remove((await s.getAccount('owner')).accountUid,'owner')).why,'protected');assert.equal((await roles.add(`ACC-${'0'.repeat(32)}`,'owner')).why,'account_missing');
});

test('UID retries are bounded and do not hide non-UID uniqueness/storage errors',async()=>{
 let calls=0;assert.equal(await retryUid(async()=>{if(++calls<3)throw collision('accounts_account_uid_key');return true}),true);assert.equal(calls,3);
 calls=0;await assert.rejects(retryUid(async()=>{calls++;throw collision('characters_character_uid_key')}));assert.equal(calls,8);
 calls=0;await assert.rejects(retryUid(async()=>{calls++;throw collision('characters_name_key_key')}));assert.equal(calls,1);
});

// Transactional SQL harness, not a live PostgreSQL deployment.
class UidPool {
 constructor(){this.state={accounts:[{id:'one',account_uid:null},{id:'two',account_uid:null}],characters:[{account:'one',slot:0,character_uid:null}]};this.tail=Promise.resolve();this.queries=[];this.failCommit=false;this.released=0;}
 async connect(){const pool=this;let snapshot,savepoint,unlock;return{async query(sql,args=[]){pool.queries.push(sql);if(sql==='begin')snapshot=structuredClone(pool.state);else if(sql.includes('pg_advisory_xact_lock')){const prior=pool.tail;pool.tail=new Promise(r=>unlock=r);await prior;snapshot=structuredClone(pool.state);}else if(sql==='savepoint uid_backfill')savepoint=structuredClone(pool.state);else if(sql==='rollback to savepoint uid_backfill')pool.state=savepoint;else if(sql==='rollback')pool.state=snapshot;else if(sql==='commit'&&pool.failCommit)throw Error('commit unavailable');else if(sql.startsWith('select ')&&sql.includes(' is null for update')){const table=sql.includes('from accounts')?'accounts':'characters',column=table==='accounts'?'account_uid':'character_uid';return{rows:pool.state[table].filter(r=>r[column]===null).map(r=>({...r}))};}else if(sql.startsWith('update ')){const table=sql.split(' ')[1],column=table==='accounts'?'account_uid':'character_uid';if(pool.state[table].some(r=>r[column]===args[0]))throw collision(`${table}_${column}_key`);const row=pool.state[table].find(r=>table==='accounts'?r.id===args[1]:r.account===args[1]&&r.slot===args[2]);row[column]=args[0];}return{rows:[],rowCount:1};},release(){unlock?.();pool.released++;}};}
}
test('Postgres backfill serializes concurrent starts, retries collisions and retains IDs across restarts',async()=>{
 const p=new UidPool();let n=0;const gen=k=>`${k}-${(++n===2?'1':String(n)).padStart(32,'0')}`;
 await Promise.all([migrateUids(p,gen),migrateUids(p,gen)]);const sealed=structuredClone(p.state);await migrateUids(p,gen);assert.deepEqual(p.state,sealed);
 assert.equal(new Set(p.state.accounts.map(r=>r.account_uid)).size,2);assert.ok(p.queries.includes('rollback to savepoint uid_backfill'));assert.equal(p.released,3);
});
test('Postgres backfill failure rolls back both kinds and releases its connection',async()=>{
 const p=new UidPool(),before=structuredClone(p.state);p.failCommit=true;await assert.rejects(migrateUids(p));assert.deepEqual(p.state,before);assert.equal(p.released,1);
});
test('Pg account insertion retries UID collision but preserves existing-account conflict behavior',async()=>{
 let n=0;const seen=[];const p={query:async(sql,args)=>{seen.push({sql,args});if(++n===1)throw collision('accounts_account_uid_key');return{rowCount:1,rows:[]}}};
 const s=new PgStore(p);assert.equal(await s.createAccount('owner','s','h'),true);assert.equal(n,2);assert.match(seen[0].sql,/on conflict \(id\) do nothing/);assert.notEqual(seen[0].args[3],seen[1].args[3]);
 p.query=async()=>({rowCount:0,rows:[]});assert.equal(await s.createAccount('owner','s','h'),false);
});

test('Pg slot creation retries its whole transaction and stale incarnation cannot update the replacement',async()=>{
 let row=null,pending=null,insertCalls=0,releases=0;const sqls=[];
 const pool={connect:async()=>({query:async(sql,args=[])=>{sqls.push(sql);if(sql==='begin')pending=structuredClone(row);else if(sql==='commit')row=pending;else if(sql.startsWith('select inventory_revision'))return{rows:pending?[pending]:[]};else if(sql.startsWith('insert into characters')){if(++insertCalls===1)throw collision('characters_character_uid_key');pending={inventoryRevision:0,characterUid:args[4]};}else if(sql.startsWith('update characters'))pending.updated=true;return{rows:[],rowCount:1};},release(){releases++;}})};
 const store=new PgStore(pool);assert.equal(await store.putSlot('owner',0,data('SQL Hero')),true);assert.equal(insertCalls,2);assert.equal(releases,2);assert.ok(sqls.includes('rollback'));
 const uid=row.characterUid;assert.match(uid,/^CHR-/);assert.equal(await store.putSlot('owner',0,data('Changed'),{characterUid:uid}),true);assert.equal(row.characterUid,uid);
 assert.equal(await store.putSlot('owner',0,data('Stale'),{characterUid:newUid('CHR')}),false);assert.equal(row.characterUid,uid);
});

test('actual stash/trade commits and idempotent receipt replays preserve dedicated Character UIDs',async()=>{
 const store=new MemoryStore();for(const id of ['alice','bob']){await store.createAccount(id,'s','h');await store.putSlot(id,0,data(`${id} Hero`));}
 const ids=Object.fromEntries(await Promise.all(['alice','bob'].map(async id=>[id,(await store.listSlots(id))[0].characterUid])));
 const participants=['alice','bob'].map(account=>({account,slot:0,inventoryRevision:0,character:{name:`${account} Hero`,classId:'warrior',gold:5},quests:'{}',location:{x:0,z:0}}));
 assert.equal((await store.transferTrade('trade','fingerprint',participants)).ok,true);assert.equal((await store.transferTrade('trade','fingerprint',participants)).replayed,true);
 const move={request:'stash',slot:0},snapshot={inventoryRevision:1,character:participants[0].character,quests:'{}',location:{x:0,z:0}};
 const plan=()=>({ok:true,inventory:[],stash:{revision:1,slots:[]}});
 assert.equal((await store.transferStash('alice',0,move,'stash-fingerprint',snapshot,plan)).ok,true);
 assert.equal((await store.transferStash('alice',0,move,'stash-fingerprint',snapshot,plan)).replayed,true);
 for(const id of ['alice','bob'])assert.equal((await store.listSlots(id))[0].characterUid,ids[id]);
});
