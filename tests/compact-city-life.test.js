import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NPCS } from '../src/data/npcs.js';
import { COMPACT_CITY_SPOTS } from '../src/data/compactCityNpcs.js';
import { presentationActivityFor, questContactIds } from '../src/npc/NPCPresentationActivity.js';
import { QUESTS } from '../src/data/quests.js';
import { activityFor } from '../src/npc/NPCSchedule.js';
import { nearNpc, SPOT_SITES } from '../src/data/shopSites.js';
import { clearLine } from '../src/core/GridPath.js';
import { cityPopulation, simulatePopulation, openingPopulation } from './helpers/compact-city-population.js';

test('presentation never moves shop/trainer/warp contacts or changes their phases', () => {
  const before = JSON.stringify(NPCS);
  for (const n of NPCS) for (const phase of ['morning','day','evening','night']) {
    const actual = presentationActivityFor(n,phase), original = activityFor(n,phase);
    if (n.map !== 'city' || n.shopType || n.trainer || n.warpService || phase !== 'day' || original.do === 'home') {
      assert.equal(actual,original,`${n.id}: ${phase}`);
    }
  }
  assert.equal(JSON.stringify(NPCS),before);
  // Runtime gossip in the plaza does not introduce a new server contact site.
  const gossip = NPCS.find(n=>n.id==='gossip_a'), at=gossip.schedule.day.at;
  assert.equal(nearNpc(gossip.id,'city',at.x,at.z,'day'),true);
  assert.equal(nearNpc(gossip.id,'city',-4,5,'day'),false);
  assert.deepEqual(SPOT_SITES.herb_gather,['paddy',48,-130.8]);
});

test('daytime routines use safe existing residents and deterministic varied starts', () => {
  const ids = new Set(NPCS.map(n=>n.id)); assert.equal(ids.size,NPCS.length);
  const { world } = cityPopulation(NPCS);
  const children = [];
  for(const n of NPCS.filter(n=>n.daytimeRoutine)) {
    assert.equal(n.map,'city'); assert.ok(!n.shopType && !n.trainer && !n.warpService,n.id);
    const a=presentationActivityFor(n,'day');
    assert.deepEqual(a,presentationActivityFor(n,'day'));
    for(const s of a.stops ?? [{ at:a.at }]) {
      const p=COMPACT_CITY_SPOTS[s.at]; assert.ok(p,`${n.id}: ${s.at}`);
      assert.ok(world.canStand(p.x,p.z),`${n.id}: ${s.at}`);
      if(s.time)assert.ok(s.time[0]>=3 && s.time[1]<=18);
    }
    if(n.occupation==='child')children.push(a.stops[0].at);
  }
  assert.equal(new Set(children).size,children.length);
});

test('every routine owner is disjoint from all quest contacts and functional services', () => {
  const contacts=questContactIds(QUESTS), owners=NPCS.filter(n=>n.daytimeRoutine);
  assert.equal(owners.length,19);
  for (const n of owners) {
    assert.ok(!contacts.has(n.id),`${n.id}: quest contact`);
    assert.ok(!n.shopType && !n.trainer && !n.warpService && !n.storageService && !n.faction,n.id);
    // A later content edit must disable movement for each kind of quest contact.
    for (const quest of [{giver:n.id},{turnIn:n.id},{objectives:[{talk:n.id}]}]) {
      assert.equal(presentationActivityFor(n,'day',questContactIds([quest])),activityFor(n,'day'),n.id);
    }
    for (const key of ['shopType','trainer','warpService','storageService','faction']) {
      const functional={...n,[key]:true};
      assert.equal(presentationActivityFor(functional,'day'),activityFor(functional,'day'),`${n.id}: ${key}`);
    }
  }
  for (const n of NPCS.filter(n=>contacts.has(n.id))) for (const phase of ['morning','day','evening','night']) {
    assert.equal(presentationActivityFor(n,phase),activityFor(n,phase),`${n.id}: ${phase}`);
  }
});

test('opening 15 seconds keeps customer/work groups under both awnings and beside the square', () => {
  const random=Math.random;
  try {
    for(const choice of [0,.5,.999]) {
      Math.random=()=>choice;
      const p=cityPopulation(NPCS,'day',presentationActivityFor),frames=openingPopulation(p);
      for(const f of frames) {
        assert.ok(f.local>=24,`${choice}: ${f.seconds}s local`);
        assert.ok(f.west.length>=3,`${choice}: ${f.seconds}s west`);
        assert.ok(f.east.length>=4,`${choice}: ${f.seconds}s east`);
        assert.ok(f.west.some(n=>n.id==='shopper_b'));
        assert.ok(f.east.some(n=>n.id==='trader_b'));
        assert.ok(f.east.some(n=>n.anim==='sell'));
        assert.ok(f.east.some(n=>n.id==='trader_a' && ['point','lift','walk'].includes(n.anim)));
      }
      assert.equal(frames[0].restingGroup.length,3);
      assert.ok(frames[2].movers.length>=10);
      for(const id of ['shopper_a','shopper_c'])assert.ok(frames[2].movers.find(n=>n.id===id)?.travel>10,id);
    }
    assert.equal(COMPACT_CITY_SPOTS.market_w_customer_a.face,-Math.PI/2);
    assert.equal(COMPACT_CITY_SPOTS.market_e_customer_a.face,Math.PI/2);
    assert.equal(COMPACT_CITY_SPOTS.market_e_seller.face,-Math.PI/2);
    for(const n of NPCS.filter(n=>n.daytimeRoutine)) {
      const a=n.daytimeRoutine;
      for(const s of a.stops??[{at:a.at}])if(a.do==='stay'||s.time) {
        const point=COMPACT_CITY_SPOTS[s.at];
        assert.ok(!(Math.abs(point.x)<3&&point.z>-5&&point.z<9),`${n.id}: fountain approach`);
      }
    }
  } finally {Math.random=random;}
});

test('all compact graph edges respect collision and local port trips avoid the plaza', () => {
  const { world, manager }=cityPopulation(NPCS);
  for(const n of manager.nav.nodes.values())for(const e of n.edges) {
    const to=manager.nav.nodes.get(e.to);
    assert.ok(clearLine((x,z)=>world.canStand(x,z),n.x,n.z,to.x,to.z),`${n.id} -> ${e.to}`);
  }
  const path=manager.nav.findPath('dockA_end','warehouseA');
  assert.ok(path?.length>=2);
  assert.ok(path.every(p=>p.z>=48),'carrying stays at the port');
  let length=0; for(let i=1;i<path.length;i++)length+=Math.hypot(path[i].x-path[i-1].x,path[i].z-path[i-1].z);
  assert.ok(length<20,`${length}m port trip`);
});

test('actual NPC plans walk at plaza/temple/port; daytime has no home or unsafe positions', () => {
  const random = Math.random; Math.random=()=>.5;
  try {
    const population=cityPopulation(NPCS,'day',presentationActivityFor);
    const report=simulatePopulation(population);
    assert.equal(report.residents,60);
    assert.equal(report.movers,28);
    assert.ok(report.plazaMovers>=15); assert.ok(report.templeMovers>=6); assert.ok(report.portMovers>=10);
    assert.ok(report.meanWalking>=19);
    assert.equal(report.hiddenSamples,0); assert.equal(report.unsafeSamples,0);
    for(const n of population.npcs) {
      assert.ok(!n.indoors);
      assert.ok(Object.values(n.pose).every(Number.isFinite),n.id);
      if(n.path)assert.equal(n.anim,'walk',n.id);
    }
  } finally { Math.random=random; }
});

test('work/prayer/talking pauses animate in place rather than moving the character root', () => {
  const population=cityPopulation(NPCS,'day',presentationActivityFor);
  for(const [id,anim] of [['sweeper','sweep'],['monk_young','sweep'],['temple_visitor','pray'],['gossip_a','talk'],['cargo_merchant','point']]) {
    const n=population.npcs.find(n=>n.id===id), stop=n.plan.stops.find(s=>s.anim===anim);
    assert.ok(stop,`${id}: ${anim}`);
    const point=population.manager.nav.nodes.get(stop.at);
    n.plan={kind:'stay',at:stop.at,state:stop.state,anim:stop.anim}; n.node=stop.at; n.x=point.x;n.z=point.z;n.path=null;
    n.arrive(); n.update(.1,0,population.world);
    const before={...n.pose}, position=[n.x,n.y,n.z];
    n.update(.1,1,population.world);
    assert.deepEqual([n.x,n.y,n.z],position,id);
    assert.ok(Object.values(n.pose).every(Number.isFinite),id);
    if(anim!=='pray')assert.notDeepEqual(n.pose,before,id);
  }
});
