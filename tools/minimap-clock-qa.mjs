import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
let pw;try{pw=require('playwright');}catch{pw=require('C:/Users/panup/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');}
const out='docs/art/minimap-clock';await mkdir(out,{recursive:true});
const browser=await pw.chromium.launch({channel:'msedge',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const results=[];
try{
 const page=await browser.newPage({viewport:{width:1366,height:768}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/health',r=>r.fulfill({contentType:'application/json',body:'{"accounts":false}'}));
 await page.routeWebSocket('**/*',ws=>ws.close());
 await page.route('**/tools/camera-seed.html',r=>r.fulfill({contentType:'text/html',body:`<!doctype html><meta charset="utf-8"><script type="module">
 import {Character} from '/src/character/Character.js';localStorage.clear();sessionStorage.clear();
 const c=Character.create('Ryuu','shaman');c.hp=c.maxHp;c.mp=c.maxMp;c.save();
 sessionStorage.setItem('tno.session.v1',JSON.stringify({id:'guest',guest:true,prefix:''}));location.replace('/?at=4,150&t=10');</script>`}));
 await page.goto(`${process.env.GAME_QA_URL||'http://127.0.0.1:5192'}/tools/camera-seed.html`);
 await page.waitForFunction(()=>window.game?.net?.chat&&document.getElementById('loading').hidden,null,{timeout:60000});
 for(const [skin,width,height,hud] of [['modern',1366,768,1],['classic',1920,1080,1.3]]){
  await page.setViewportSize({width,height});
  await page.evaluate(async({skin,hud})=>{(await import('/src/ui/skin.js')).setSkin(skin);window.game.prefs.set({hud});window.game.clock.set(21+1/60);},{skin,hud});
  await page.waitForFunction(()=>document.getElementById('sun-dot').dataset.phase==='night');
  const bounds=await page.evaluate(()=>{const m=document.querySelector('.minimap').getBoundingClientRect(),c=document.querySelector('.mini-clock').getBoundingClientRect(),t=document.getElementById('clock').getBoundingClientRect(),f=document.querySelector('.mini-footer').getBoundingClientRect();return{map:{left:m.left,right:m.right,bottom:m.bottom},clock:{left:c.left,right:c.right,bottom:c.bottom,top:c.top},textRight:t.right,footerBottom:f.bottom,label:document.getElementById('clock').textContent};});
  assert.equal(await page.locator('#clock').count(),1);assert.equal(await page.locator('.location #clock').count(),0);assert.ok(bounds.clock.bottom<=bounds.map.bottom&&bounds.clock.left>=bounds.map.left&&bounds.textRight<=bounds.map.right);assert.ok(bounds.clock.top>=bounds.footerBottom,'clock stays separate from safety and coordinates');
  assert.ok(bounds.label.includes('กลางคืน'));results.push({skin,width,height,hud,...bounds});
  await page.screenshot({path:`${out}/${skin}-${width}.png`});
 }
 await page.evaluate(()=>window.game.clock.set(8));await page.waitForFunction(()=>document.getElementById('sun-dot').dataset.phase==='morning');
 assert.ok(await page.locator('#clock').textContent().then(t=>t.includes('เช้า')));
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>document.body.classList.add('ui-touch'));
 assert.equal(await page.locator('.mini-clock').isVisible(),false,'existing touch compact layout preserved');assert.equal(errors.length,0,errors.join('\n'));
 await writeFile(`${out}/verification.json`,JSON.stringify({results,errors,phaseUpdates:true,touchCompact:true},null,2));console.log(JSON.stringify(results));
}finally{await browser.close();}
