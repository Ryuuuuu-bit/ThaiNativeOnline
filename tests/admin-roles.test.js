import {test} from 'node:test';
import assert from 'node:assert/strict';
import {MemoryStore,PgStore} from '../server/store.js';
import {openAdminRoles,normalizeAdminAccount} from '../server/adminRoles.js';

async function memoryFixture(){
 const store=new MemoryStore();for(const id of ['owner','another','alice','bob'])await store.createAccount(id,'secret-salt','secret-hash');
 return{store,roles:await openAdminRoles(store,{adminIds:' OWNER, owner ',gmId:'Another'})};
}

test('normalized account IDs and protected configuration roots are the only bootstrap authority',async()=>{
 const {roles}=await memoryFixture();
 assert.equal(normalizeAdminAccount(' Ryuuuu '),'ryuuuu');
 for(const value of ['guest','ab','../owner','owner name',null,{},'a'.repeat(17)])assert.equal(normalizeAdminAccount(value),null);
 assert.deepEqual(await roles.list(),{ids:['another','owner'],protectedIds:['another','owner']});
 assert.equal(await roles.effective(' OWNER '),true);
 assert.equal((await roles.remove(' OWNER ','another')).why,'protected');
 assert.equal((await roles.add('not_registered','owner')).why,'account_missing');
 assert.equal((await roles.add('bob','alice')).why,'forbidden');
 assert.equal((await roles.add('guest','owner')).why,'invalid_id');
});

test('grants/revocations are durable across service reconstruction, idempotent and credential-free',async()=>{
 const {roles,store}=await memoryFixture();
 assert.equal((await roles.add(' ALICE ',' OWNER ')).changed,true);
 assert.equal((await roles.add('alice','owner')).changed,false);
 const restarted=await openAdminRoles(store,{adminIds:'owner',gmId:'another'});
 assert.equal(await restarted.effective('Alice'),true);
 assert.equal((await restarted.remove('alice','owner')).changed,true);
 assert.equal((await restarted.remove('alice','owner')).changed,false);
 assert.equal(await roles.effective('alice'),false,'authoritative check cannot trust an older service cache');
 assert.deepEqual(store.adminRoleAudit.map(({at,...row})=>row),[{actor:'owner',account:'alice',action:'add'},{actor:'owner',account:'alice',action:'remove'}]);
 assert.equal(JSON.stringify(await restarted.list()).includes('secret'),false);
 assert.equal((await openAdminRoles(new MemoryStore(),{adminIds:'owner'})).isAdmin('alice'),false,'memory dev store intentionally resets on process restart');
});

test('revoked actors cannot mutate roles using a stale metadata cache',async()=>{
 const {roles,store}=await memoryFixture();await roles.add('alice','owner');
 const other=await openAdminRoles(store,{adminIds:'owner'});await other.remove('alice','owner');
 assert.equal(roles.isAdmin('alice'),true,'badge cache may be stale across instances');
 assert.equal(await roles.effective('alice'),false);
 assert.equal((await roles.add('bob','alice')).why,'forbidden');
 assert.equal(await store.hasAdminRole('bob'),false);
});

test('failed role writes/reads never publish cached authority and the operation queue recovers',async()=>{
 const {roles,store}=await memoryFixture(),write=store.setAdminRole.bind(store),read=store.hasAdminRole.bind(store);
 store.setAdminRole=async()=>{throw Error('database unavailable');};
 await assert.rejects(roles.add('alice','owner'),/unavailable/);assert.equal(roles.isAdmin('alice'),false);assert.equal(store.adminRoleAudit,undefined);
 store.setAdminRole=write;assert.equal((await roles.add('alice','owner')).changed,true);
 store.hasAdminRole=async()=>{throw Error('read unavailable');};await assert.rejects(roles.effective('alice'),/read unavailable/);
 store.hasAdminRole=read;assert.equal(await roles.effective('alice'),true);
});

// A transactional SQL harness exercises PgStore's real query/commit code. It
// is not a substitute for an external PostgreSQL service or Railway validation.
class RolePool{
 constructor(){this.state={accounts:new Set(['owner','alice','bob']),roles:new Set(),audit:[]};this.calls=[];this.fail=null;}
 async query(sql,args=[]){return this.run(sql,args,this.state);}
 async connect(){let working=null;return{query:async(sql,args=[])=>{
  const command=sql.toLowerCase();this.calls.push({sql,args});
  if(this.fail&&command.includes(this.fail))throw Error('injected SQL failure');
  if(command==='begin'){working=structuredClone(this.state);return{rows:[],rowCount:0};}
  if(command==='commit'){this.state=working;working=null;return{rows:[],rowCount:0};}
  if(command==='rollback'){working=null;return{rows:[],rowCount:0};}
  return this.run(sql,args,working??this.state);
 },release:()=>{this.released=(this.released??0)+1;}};}
 run(sql,args,state){
  const command=sql.toLowerCase();
  if(command.includes('pg_advisory_xact_lock'))return{rows:[],rowCount:0};
  if(command.startsWith('select id from accounts'))return{rows:state.accounts.has(args[0])?[{id:args[0]}]:[],rowCount:0};
  if(command.startsWith('select account from admin_roles'))return{rows:[...state.roles].sort().filter(id=>!command.includes('where')||id===args[0]).map(account=>({account})),rowCount:0};
  if(command.startsWith('insert into admin_roles ')){const exists=state.roles.has(args[0]);state.roles.add(args[0]);return{rows:[],rowCount:exists?0:1};}
  if(command.startsWith('delete from admin_roles '))return{rows:[],rowCount:state.roles.delete(args[0])?1:0};
  if(command.startsWith('insert into admin_role_audit ')){state.audit.push({actor:args[0],account:args[1],action:args[2]});return{rows:[],rowCount:1};}
  throw Error(`Unexpected SQL: ${sql}`);
 }
}

test('Postgres role writes survive a new PgStore/service and revoke across instances',async()=>{
 const pool=new RolePool(),roles=await openAdminRoles(new PgStore(pool),{adminIds:'owner'});
 assert.equal((await roles.add('alice','owner')).changed,true);
 const restarted=await openAdminRoles(new PgStore(pool),{adminIds:'owner'});
 assert.equal(await restarted.effective('alice'),true);
 assert.deepEqual((await restarted.list()).ids,['alice','owner']);
 assert.equal((await restarted.remove('alice','owner')).changed,true);
 assert.equal(await roles.effective('alice'),false);
 assert.equal(pool.state.audit.length,2);
 assert.ok(pool.calls.some(c=>c.sql.includes('pg_advisory_xact_lock')));
 assert.ok(pool.calls.filter(c=>c.sql==='commit').length===2);
 assert.equal(pool.released,2);
});

test('Postgres audit or COMMIT failure rolls back roles and never updates the service cache',async()=>{
 for(const failure of ['insert into admin_role_audit','commit']){
  const pool=new RolePool(),roles=await openAdminRoles(new PgStore(pool),{adminIds:'owner'});pool.fail=failure;
  await assert.rejects(roles.add('alice','owner'),/injected/);
  assert.equal(pool.state.roles.has('alice'),false);assert.equal(pool.state.audit.length,0);assert.equal(roles.isAdmin('alice'),false);
  assert.ok(pool.calls.some(c=>c.sql==='rollback'));assert.equal(pool.released,1);
  pool.fail=null;assert.equal((await roles.add('alice','owner')).changed,true);
 }
});

test('Postgres checks current actor authority and registered targets within the transaction',async()=>{
 const pool=new RolePool(),roles=await openAdminRoles(new PgStore(pool),{adminIds:'owner'});
 assert.equal((await roles.add('bob','alice')).why,'forbidden');
 assert.equal((await roles.add('absent','owner')).why,'account_missing');
 assert.equal((await roles.remove('owner','owner')).why,'protected');
 assert.equal(pool.state.roles.size,0);assert.equal(pool.state.audit.length,0);
 await roles.add('alice','owner');await roles.remove('alice','owner');
 assert.equal((await roles.add('bob','alice')).why,'forbidden');
});
