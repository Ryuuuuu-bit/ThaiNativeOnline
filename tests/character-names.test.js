import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Accounts} from '../server/accounts.js';
import {MemoryStore} from '../server/store.js';
import {nameMigration} from '../server/character-names.js';
import {checkName,nameKey,guestName} from '../src/data/character-names.js';
import {Character} from '../src/character/Character.js';
import {Presence} from '../server/presence.js';
const save=(name,extra={})=>({'tno.character.v1':JSON.stringify({name,classId:'warrior',gender:'male',...extra}),'tno.quests.v1':'{"progress":7}','tno.location.v1':'{"map":"city","x":2,"z":52}'});

test('name identity: case, compatibility Unicode, composed accents and repeated spaces',()=>{
  assert.equal(nameKey(' Ｒyuu  One '),nameKey('ryuu one'));
  assert.equal(nameKey('Cafe\u0301'),nameKey('Café'));
  assert.equal(checkName(' หมอผี ').name,'หมอผี');
  for(const name of ['','   ','a'.repeat(17),'a\u200bb','a\nb','[G1]','<b>','\u0e49abc'])assert.equal(checkName(name).ok,false,name);
  assert.ok(checkName('นักรบ_๑-2').ok);
});

test('simultaneous creation reserves exactly one global name and rejection does not stall saves',async()=>{
  const store=new MemoryStore(),a=new Accounts(store),b=new Accounts(store);
  const results=await Promise.all([a.save('aaa',0,save('Ｒyuu')),b.save('bbb',1,save(' ryuu ')),a.save('aaa',2,save('RYUU'))]);
  assert.equal(results.filter(r=>r.ok).length,1);
  assert.equal(results.filter(r=>r.code==='name_taken').length,2);
  assert.ok((await b.save('bbb',1,save('มะลิ'))).ok);
  assert.equal(a.writes.pending+b.writes.pending,0,'a permanent name conflict is not retried forever');
  assert.equal((await a.save('aaa',3,save('bad\u200bname'))).code,'bad_name');
  assert.equal((await a.slots('aaa')).length,1);
});

test('deleting releases a name and ordinary saves cannot rename a character',async()=>{
  const a=new Accounts(new MemoryStore());
  await a.save('aaa',0,save('Ryuu'));await a.save('bbb',0,save('มะลิ'));
  await a.save('aaa',0,save('มะลิ'));
  assert.equal((await a.character('aaa',0)).name,'Ryuu');
  await a.remove('aaa',0);assert.ok((await a.save('ccc',0,save('RYUU'))).ok);
});

test('legacy migration keeps one owner, flags duplicates/invalid names and never rewrites saves',async()=>{
  const store=new MemoryStore();
  store.accounts.set('older',{created:1});store.accounts.set('newer',{created:2});
  const c=Character.create('RYUU','warrior');c.level=55;c.gold=999;c.addItem('ash',17);
  const old=save('Ryuu'),duplicate={...save('RYUU'),'tno.character.v1':JSON.stringify(c)};
  store.slots.set('older',new Map([[0,{data:old,updated:9}]]));
  store.slots.set('newer',new Map([[0,{data:duplicate,updated:1}],[1,{data:save('[G1]'),updated:2}]]));
  const before=JSON.stringify([...store.slots.get('newer')].map(([,r])=>r.data));
  await store.init();await store.init();
  assert.equal((await store.listSlots('older'))[0].needsRename,false);
  assert.ok((await store.listSlots('newer')).every(s=>s.needsRename));
  assert.equal(JSON.stringify([...store.slots.get('newer')].map(([,r])=>r.data)),before);
  assert.equal((await store.allCharacters()).length,1,'unresolved duplicates do not enter ranking by name');
  const a=new Accounts(store);
  assert.equal((await a.rename('newer',0,'ryuu')).code,'name_taken');
  assert.equal((await store.listSlots('newer'))[0].needsRename,true);
  assert.ok((await a.rename('newer',0,'นักรบใหม่')).ok);
  const after=(await store.listSlots('newer'))[0];assert.equal(after.needsRename,false);
  assert.deepEqual(JSON.parse(after.data['tno.character.v1']),{...c.toJSON(),name:'นักรบใหม่'});
  assert.equal(after.data['tno.quests.v1'],duplicate['tno.quests.v1']);assert.equal(after.data['tno.location.v1'],duplicate['tno.location.v1']);
  assert.ok((await a.rename('newer',0,'นักรบใหม่')).ok,'a lost success response is safely retryable');
  assert.equal((await a.rename('newer',0,'อีกชื่อ')).code,'rename_unavailable');
  await a.putCharacter('newer',0,{...c.toJSON(),gold:1000});
  assert.equal((await a.character('newer',0)).name,'นักรบใหม่','a captured old snapshot cannot undo the rename');
});

test('migration reads every supplied row and guest labels cannot impersonate registered names',()=>{
  const rows=Array.from({length:5002},(_,slot)=>({account:'a',slot,data:save(slot===5001?'PLAYER0':`Player${slot}`)}));
  assert.equal(nameMigration(rows).at(-1).needsRename,true);
  const p=new Presence(),a=p.join({}, {name:'Ryuu'},1,{guest:true}),b=p.join({}, {name:'Ryuu'},1,{guest:true});
  assert.notEqual(a.joined.name,b.joined.name);assert.notEqual(a.joined.name,'Ryuu');
  assert.ok(a.joined.name.length<=16);assert.equal(checkName(a.joined.name).ok,false);
  assert.equal(guestName('Ryuu [G1]',2),'Ryuu [G2]');
});
