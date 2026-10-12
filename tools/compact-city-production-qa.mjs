// One disposable page through the real index/account/Game entry. No live accounts.
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
let pw;try {pw=require('playwright');} catch {pw=require('C:/Users/panup/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');}
const base=process.env.GAME_QA_URL ?? 'http://127.0.0.1:5187';
const out=resolve(process.env.COMPACT_CITY_QA_OUT ?? 'artifacts/compact-city-production-qa');
await mkdir(out,{recursive:true});
const result={entry:base,viewport:{width:1600,height:900},scope:'real production index, guest UI creation, Game and NPCManager; isolated profile, no live account access',checks:[],errors:[],screenshots:[],captures:[]};
const browser=await pw.chromium.launch({channel:'msedge',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1600,height:900}});
page.setDefaultTimeout(30000);
page.on('pageerror',e=>result.errors.push(e.message));
page.on('console',m=>{if(m.type()==='error')result.errors.push(m.text());});
await page.route('**/api/**',r=>r.fulfill({contentType:'application/json',body:'{"accounts":false}'}));
// Disable HMR in this page: concurrent art edits must not reload the QA session.
await page.route('**/@vite/client',r=>r.fulfill({contentType:'text/javascript',body:`
  export function updateStyle(id,css){let s=document.querySelector('style[data-qa-id="'+CSS.escape(id)+'"]');if(!s){s=document.createElement('style');s.dataset.qaId=id;document.head.append(s);}s.textContent=css;}
  export function removeStyle(id){document.querySelector('style[data-qa-id="'+CSS.escape(id)+'"]')?.remove();}
  export function createHotContext(){return {accept(){},prune(){},dispose(){},on(){},invalidate(){},data:{}};}
  export function injectQuery(url){return url;}
`}));
await page.routeWebSocket('**/*',ws=>ws.close());
const shot=async name=>{
  const counters=await page.evaluate(()=>{
    const g=window.game;if(!g?.started)return null;
    g.renderer.render(g.scene,g.view.camera);
    const info=g.renderer.info;
    return {map:g.maps.map.id,position:g.player.position.toArray(),hour:g.clock.hour,phase:g.clock.phase,yaw:g.view.yaw,zoom:g.view.zoom,drawCalls:info.render.calls,triangles:info.render.triangles,geometries:info.memory.geometries,textures:info.memory.textures,npcCount:g.npcs.npcs.length,npcVisible:g.npcs.visibleCount,dummies:g.training.dummies?.length};
  });
  const path=resolve(out,`${name}.png`);await page.screenshot({path});result.screenshots.push(path);result.captures.push({name,path,...counters});
};
// Visual bookmarks use the real MapManager placement and production camera.
// Movement is tested separately through Game.walkTo; these are not walk proofs.
const bookmark=async(name,point,rotated=false,zoom=2)=>{
  const actual=await page.evaluate(({point,rotated,zoom})=>{
    const g=window.game;g.stopWalk();g.training.onManualMove();g.training.select(null);
    g.clock.set(10);g.view.reset();g.view.setZoom(zoom);g.syncZoom();
    if(!g.world.canStand(point.x,point.z))throw Error(`Blocked visual bookmark ${point.x},${point.z}`);
    g.maps.place(point);g.view.snap(g.player.position);
    if(rotated)g.view.setYaw(g.view.yaw+Math.PI/2);
    return {x:g.player.position.x,z:g.player.position.z};
  },{point,rotated,zoom});
  assert.ok(Math.hypot(actual.x-point.x,actual.z-point.z)<.01,`${name}: unexpected spawn fallback`);
  await page.waitForTimeout(500);await shot(name);
};
try {
  await page.goto(`${base}/?login&t=10&classes=all`,{waitUntil:'domcontentloaded'});
  await page.locator('.acc-guest').click();result.checks.push('guest login');
  await page.locator('[data-play="0"]').click();result.checks.push('character select');
  await page.locator('.g-name input').fill('CityQA');
  await page.locator('.g-start').click();result.checks.push('character creation');
  await page.waitForFunction(()=>window.game?.started && !window.game.loadingBlocked,null,{timeout:120000});
  result.production=await page.evaluate(async()=>{
    const g=window.game;
    const {NPCS}=await import('/src/data/npcs.js');
    const {CONTACT_PHASES,contactSitesFor}=await import('/src/data/npcContact.js');
    const {SPOT_SITES}=await import('/src/data/shopSites.js');
    const {findPath,clearLine}=await import('/src/core/GridPath.js');
    const {HALLS}=await import('/src/data/halls.js');
    const spawn=g.maps.map.spawn;
    const unreachable=[];
    for(const n of NPCS)for(const phase of CONTACT_PHASES)for(const s of contactSitesFor(n,phase,SPOT_SITES).filter(s=>s.map==='city')) {
      const path=findPath((x,z)=>g.world.canStand(x,z),spawn,s,{margin:24});
      if(!g.world.canStand(s.x,s.z)||!path)unreachable.push(`${n.id}/${phase}`);
    }
    const masterIds=HALLS.map(h=>NPCS.find(n=>Object.values(n.schedule??{}).some(a=>a.at===h.spots.master))?.id);
    const actualMasters=masterIds.map(id=>({id,present:g.npcs.npcs.some(n=>n.def?.id===id)}));
    const clientSamples=[];
    for(let z=-65;z<=65;z+=1)for(let x=-73;x<=73;x+=1)clientSamples.push([x,z,g.world.canStand(x,z)]);
    const path=findPath((x,z)=>g.world.canStand(x,z),spawn,{x:0,z:-32},{margin:24});
    let at=spawn;let clear=!!path;for(const next of path??[]){clear &&=clearLine((x,z)=>g.world.canStand(x,z),at.x,at.z,next.x,next.z);at=next;}
    return {map:g.maps.map.id,root:g.world.root.name,spawn:g.player.position.toArray(),stats:g.world.stats,unreachable,actualMasters,dummies:g.training.dummies?.length,pathClear:clear,clientSamples};
  });
  assert.equal(result.production.root,'map:compact-city');
  assert.equal(result.production.unreachable.length,0);
  assert.equal(result.production.dummies,4);
  assert.ok(result.production.actualMasters.every(m=>m.id&&m.present));
  const {navigation}=await import('../server/navigation.js');
  const nav=navigation('city');
  result.collisionMismatches=result.production.clientSamples.filter(([x,z,standing])=>nav.canStand(x,z)!==standing);
  delete result.production.clientSamples;
  assert.equal(result.collisionMismatches.length,0);
  result.checks.push('actual production World/NPCManager: six masters, four dummies, every phase contact reachable, server/client sampled collision parity');
  await shot('production-day');
  await page.evaluate(()=>{const g=window.game;g.view.setYaw(g.view.yaw+Math.PI/2);});
  await page.waitForTimeout(500);await shot('production-day-rotated');
  await page.evaluate(()=>{const g=window.game;g.clock.set(22);g.view.reset();g.view.setZoom(2);g.syncZoom();});
  await page.waitForTimeout(3800);await shot('production-night');
  await page.evaluate(()=>window.game.toggleMap());
  await page.waitForTimeout(500);await shot('production-atlas');
  await page.keyboard.press('Escape');
  await page.waitForFunction(()=>document.getElementById('fullmap-panel').hidden);
  result.checks.push('Escape closes actual atlas panel');
  if (!process.argv.includes('--atlas-only')) {
  // Short real movement smoke: long trips can exceed wall-time on SwiftShader.
  assert.ok(await page.evaluate(()=>window.game.walkTo(0,8)));
  await page.waitForFunction(()=>Math.hypot(window.game.player.position.x,window.game.player.position.z-8)<.3,null,{timeout:30000});
  result.checks.push('collision-aware real movement from spawn (0,3) to (0,8)');
  await bookmark('production-training-arrival',{x:0,z:-32});
  const before=await page.evaluate(()=>{const t=window.game.training;t.select(t.dummies[1]);return t.dummies[1].dummy.hp;});
  await page.keyboard.press('Space');
  await page.waitForFunction(hp=>window.game.training.dummies[1].dummy.hp<hp,before,{timeout:10000});
  result.checks.push('Space basic combat damages selected training dummy');await shot('production-training');
  await page.evaluate(()=>window.game.maps.save());
  const saved=await page.evaluate(()=>({x:window.game.player.position.x,z:window.game.player.position.z}));
  await page.goto(`${base}/?t=10`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.game?.started&&!window.game.loadingBlocked,null,{timeout:120000});
  const resumed=await page.evaluate(()=>({x:window.game.player.position.x,z:window.game.player.position.z}));
  assert.ok(Math.hypot(saved.x-resumed.x,saved.z-resumed.z)<.1);
  result.checks.push('guest save/reload retains current-revision training position');
  result.serviceCounters=await page.evaluate(async()=>{
    const g=window.game;
    const {SHOP_APPROACHES,SPOT_SITES,nearShop}=await import('/src/data/shopSites.js');
    const {stockOf}=await import('/src/shop/ShopSystem.js');
    const {NPCS}=await import('/src/data/npcs.js');
    const {contactSitesFor}=await import('/src/data/npcContact.js');
    g.clock.set(10);
    return Object.entries(SHOP_APPROACHES).map(([shop,id])=>{
      const approach=g.world.spots[id];
      const hosts=NPCS.filter(n=>n.shopType===shop).map(n=>({id:n.id,present:g.npcs.npcs.some(actual=>actual.def.id===n.id),sites:contactSitesFor(n,'day',SPOT_SITES).filter(s=>s.map==='city')}));
      return {shop,approachId:id,approach,standable:!!approach&&g.world.canStand(approach.x,approach.z),authorized:!!approach&&nearShop(shop,'city',approach.x,approach.z,'day'),stockRows:stockOf(shop).length,hosts};
    });
  });
  assert.ok(result.serviceCounters.every(c=>c.standable&&c.authorized),'all live city counter approaches must work');
  result.checks.push('production shop counter approaches, daytime authorization and inventory row counts recorded');
  await bookmark('production-forge',{x:-12,z:-13});
  await bookmark('production-forge-rotated',{x:-12,z:-13},true);
  await bookmark('production-temple',{x:-52,z:-31});
  await bookmark('production-temple-rotated',{x:-52,z:-31},true);
  const halls=await page.evaluate(async()=>{
    const {HALLS}=await import('/src/data/halls.js');
    return HALLS.map(h=>({classId:h.classId,master:h.master}));
  });
  assert.equal(halls.length,6);
  for(const hall of halls)await bookmark(`production-hall-${hall.classId}`,hall.master);
  for(const [name,id] of [['pharmacy','herb_customer'],['general','general_customer'],['occult','occult_customer']]){
    const point=await page.evaluate(id=>window.game.world.spots[id],id);
    await bookmark(`production-counter-${name}`,point);
  }
  await bookmark('production-counter-depot',{x:14,z:12});
  await bookmark('production-homes',{x:-54,z:47});
  await bookmark('production-warehouse-port',{x:0,z:55});
  await bookmark('production-waterfront',{x:0,z:62});
  await bookmark('production-warehouse-facade-zoom-1.25',{x:-28,z:52},false,1.25);
  result.checks.push('full-resolution production visual bookmarks: forge/temple default and rotated, all six hall masters, pharmacy/general/occult counters, warehouse/port');
  }
  if(process.argv.includes('--atmosphere')){
    const {captureCityAtmosphere}=await import('./compact-city-atmosphere-qa.mjs');
    result.atmosphere=await captureCityAtmosphere(page,out);
    assert.ok(result.atmosphere.scenes.find(s=>s.name==='market').moved.length>0,'market has purposeful resident movement');
    assert.ok(result.atmosphere.scenes.find(s=>s.name==='market').after.audio.market>.7,'market ambience follows actual location');
    assert.ok(result.atmosphere.scenes.find(s=>s.name==='temple').after.audio.temple>.9,'temple ambience follows actual location');
    assert.ok(result.atmosphere.scenes.find(s=>s.name==='waterfront').after.audio.river>.9,'waterfront ambience follows actual location');
    result.checks.push('12-second production motion sequences for market, temple and waterfront; location ambience');
  }
  result.passed=result.errors.length===0;
} catch(error) {result.failure=error.stack;result.passed=false;await shot('production-failure').catch(()=>{});process.exitCode=1;}
finally {await page.close();await browser.close();await writeFile(resolve(out,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({...result,production:result.production&&{...result.production,stats:result.production.stats}},null,2));}
