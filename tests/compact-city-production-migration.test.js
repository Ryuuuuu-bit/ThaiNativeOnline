import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAPS, resolveLocation } from '../src/world/maps.js';
import { CITY_LAYOUT_REVISION, COMPACT_CITY } from '../src/world/compact-city.js';
import { loginPosition } from '../server/login-state.js';
import { navigation } from '../server/navigation.js';
import { Accounts } from '../server/accounts.js';
import { MemoryStore } from '../server/store.js';
import { Character } from '../src/character/Character.js';
import { WARP_SERVICES } from '../src/data/warpServices.js';
import { stashIdentity } from '../src/data/stash.js';
import { StashService } from '../server/stash.js';
import { commitTrade } from '../server/trade-service.js';

test('old revision and unversioned city saves reset even when their coordinates fit the new city', () => {
  for (const revision of [undefined, 0, 1, '2', CITY_LAYOUT_REVISION + 1]) {
    for (const [x, z] of [[-6,52], [4,8], [-27.8,62.75], [100,200]]) {
      const saved = { map:'city', x, z, facing:.7, ...(revision === undefined ? {} : { layoutRevision:revision }) };
      const before = structuredClone(saved);
      assert.deepEqual(resolveLocation(saved), { map:'city', ...MAPS.city.spawn, layoutRevision:CITY_LAYOUT_REVISION });
      assert.deepEqual(saved, before, 'migration must not mutate the stored row');
      assert.deepEqual(loginPosition(saved, navigation), { map:'city', x:COMPACT_CITY.spawn.x, z:COMPACT_CITY.spawn.z, f:MAPS.city.spawn.facing });
    }
  }
});

test('current city revision retains valid position and facing, while buildings and outside points reset', () => {
  const saved = { map:'city', x:4, z:8, facing:.7, layoutRevision:CITY_LAYOUT_REVISION };
  assert.deepEqual(resolveLocation(saved), saved);
  assert.deepEqual(loginPosition(saved, navigation), { map:'city', x:4, z:8, f:.7 });
  for (const [x,z] of [...COMPACT_CITY.buildings.map(b=>[b.x,b.z]), [73,0], [0,65]]) {
    assert.deepEqual(resolveLocation({ ...saved,x,z }), { map:'city', ...MAPS.city.spawn, layoutRevision:CITY_LAYOUT_REVISION });
  }
});

test('current city revision survives account persistence and reconnect position resolution', async () => {
  const store = new MemoryStore(), accounts = new Accounts(store);
  const saved = { map:'city', x:4, z:8, facing:.7, layoutRevision:CITY_LAYOUT_REVISION };
  assert.ok((await accounts.save('compactcityqa', 0, {
    'tno.character.v1':JSON.stringify({ name:'CompactCityQA', classId:'warrior' }),
    'tno.location.v1':JSON.stringify(saved),
  })).ok);
  for (let attempt=0; attempt<2; attempt++) {
    const state = await accounts.joinState('compactcityqa',0);
    assert.deepEqual(state.location,saved);
    assert.deepEqual(loginPosition(state.location,navigation),{ map:'city', x:4,z:8,f:.7 });
  }
});

test('city revision migration leaves every wilderness and instance location unchanged', () => {
  for (const map of Object.values(MAPS).filter(m=>m.id !== 'city')) {
    const saved = { map:map.id, x:map.spawn.x,z:map.spawn.z,facing:.3 };
    assert.deepEqual(resolveLocation(saved),saved,map.id);
    assert.deepEqual(resolveLocation({ ...saved, layoutRevision:1 }),saved,map.id);
  }
  assert.deepEqual(resolveLocation({ map:'fields',x:4,z:-130,facing:.3 }),{ map:'paddy',x:4,z:-130,facing:.3 });
});

test('depot storage transaction retains current city revision and location before the next periodic save', async () => {
  const store=new MemoryStore(),accounts=new Accounts(store),account='compactdepotqa';
  await store.createAccount(account,'test','test');
  const c=Character.create('DepotQA','warrior');c.inventory.fill(null);c.addItem('sacred_ore',2);
  const keeper=WARP_SERVICES.find(s=>s.npcId==='warp_city_market');
  const location={map:'city',x:keeper.x,z:keeper.z,facing:.7,layoutRevision:CITY_LAYOUT_REVISION};
  await store.putSlot(account,0,{'tno.character.v1':JSON.stringify(c.toJSON()),'tno.quests.v1':'{}','tno.location.v1':JSON.stringify(location)});
  await accounts.character(account,0);
  const state={c,quests:{json:()=>'{}'},persist:{account,slot:0,inventoryRevision:accounts.inventoryRevision(account,0)}};
  const player={account,map:'city',x:keeper.x,z:keeper.z,f:.7};
  const result=await new StashService(accounts).move(player,state,{npc:keeper.npcId,request:'compact_depot_001',revision:0,action:'deposit',index:0,qty:1,expected:stashIdentity(c.inventory[0])});
  assert.equal(result.ok,true);
  const joined=await accounts.joinState(account,0);
  assert.deepEqual(joined.location,location,'atomic stash persistence must not drop the city layout revision');
  assert.deepEqual(loginPosition(joined.location,navigation),{map:'city',x:keeper.x,z:keeper.z,f:.7});
});

test('atomic player trade retains current city revisions and reconnect positions before a periodic save', async () => {
  const store=new MemoryStore(),accounts=new Accounts(store),states=[],players=[],locations=[];
  for(let i=0;i<2;i++) {
    const account=`compacttradeqa${i}`,c=Character.create(`TradeQA${i}`,'warrior');c.gold=100;
    await store.createAccount(account,'test','test');
    const location={map:'city',x:4+i,z:8,facing:.7,layoutRevision:CITY_LAYOUT_REVISION};locations.push(location);
    await store.putSlot(account,0,{'tno.character.v1':JSON.stringify(c.toJSON()),'tno.quests.v1':'{}','tno.location.v1':JSON.stringify(location)});
    await accounts.character(account,0);
    states.push({c,quests:{json:()=>'{}'},persist:{account,slot:0,inventoryRevision:accounts.inventoryRevision(account,0)}});
    players.push({account,map:'city',x:location.x,z:location.z,f:location.facing});
  }
  const trade={a:1,b:2,offer:{1:{items:[],gold:40},2:{items:[],gold:10}}};
  assert.equal((await commitTrade(accounts,trade,states,players)).ok,true);
  for(let i=0;i<2;i++) {
    const joined=await accounts.joinState(states[i].persist.account,0);
    assert.deepEqual(joined.location,locations[i],'atomic trade persistence must retain city layout revision');
    assert.deepEqual(loginPosition(joined.location,navigation),{map:'city',x:locations[i].x,z:8,f:.7});
  }
});
