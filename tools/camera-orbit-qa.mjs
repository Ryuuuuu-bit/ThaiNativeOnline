import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
let pw;try{pw=require('playwright');}catch{pw=require('C:/Users/panup/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');}
const out='docs/art/camera-orbit';await mkdir(out,{recursive:true});
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
 const state=()=>page.evaluate(()=>{const g=window.game,v=g.view;return{yaw:v.yaw,defaultYaw:v.defaultYaw,offset:v.offset.toArray(),pan:v.panOffset.length(),position:g.player.position.toArray(),drag:g.input.pan,zoom:v.zoom};});
 await page.evaluate(()=>{window.__cameraClicks=0;window.game.input.on('click',()=>window.__cameraClicks++);window.game.view.reset();});
 await page.mouse.move(620,390);
 await page.screenshot({path:`${out}/before.png`});const before=await state();
 await page.mouse.down({button:'right'});await page.mouse.move(840,430,{steps:8});await page.mouse.up({button:'right'});
 await page.waitForTimeout(250);const rotated=await state();
 assert.ok(Math.abs(rotated.yaw-before.yaw)>1);assert.equal(rotated.offset[1],before.offset[1]);assert.equal(rotated.pan,0);assert.equal(rotated.drag,null);
 assert.equal(await page.evaluate(()=>window.__cameraClicks),0,'orbit never starts walking');
 await page.screenshot({path:`${out}/rotated.png`});results.push({before,rotated});
 await page.mouse.move(950,440);assert.equal((await state()).yaw,rotated.yaw,'release ends orbit');
 for(const shift of [false,true]){
  if(shift)await page.keyboard.down('Shift');
  await page.mouse.move(620,390);await page.mouse.down({button:'right'});await page.mouse.move(700,420);
  await page.keyboard.press('r');await page.mouse.move(780,450);const heldReset=await state();
  assert.equal(heldReset.yaw,heldReset.defaultYaw,'R cancels held orbit');assert.equal(heldReset.pan,0,'R cancels held pan');assert.equal(heldReset.drag,null);
  await page.mouse.up({button:'right'});if(shift)await page.keyboard.up('Shift');
 }
 await page.evaluate(yaw=>window.game.view.setYaw(yaw),rotated.yaw);
 await page.keyboard.down('Shift');await page.mouse.move(620,390);await page.mouse.down({button:'right'});await page.mouse.move(700,430,{steps:4});await page.mouse.up({button:'right'});await page.keyboard.up('Shift');
 const panned=await state();assert.equal(panned.yaw,rotated.yaw);assert.ok(panned.pan>0,'Shift preserves pan');
 await page.keyboard.press('r');const reset=await state();assert.equal(reset.yaw,reset.defaultYaw);assert.equal(reset.pan,0);results.push({panned,reset});
 await page.mouse.move(620,390);await page.mouse.down({button:'right'});await page.mouse.move(660,390);
 await page.evaluate(()=>window.dispatchEvent(new Event('blur')));const blurred=(await state()).yaw;
 await page.mouse.move(740,390);await page.mouse.up({button:'right'});assert.equal((await state()).yaw,blurred,'blur stops drag');
 await page.locator('#menu-btn').click();const menuYaw=(await state()).yaw;
 const box=await page.locator('#menu-grid').boundingBox();await page.mouse.move(box.x+20,box.y+20);await page.mouse.down({button:'right'});await page.mouse.move(box.x+60,box.y+35);await page.mouse.up({button:'right'});assert.equal((await state()).yaw,menuYaw,'HUD right drag does not rotate world');
 await page.keyboard.press('Escape');
 await page.mouse.move(620,390);await page.mouse.down({button:'right'});await page.mouse.move(680,390);
 await page.evaluate(()=>{const i=window.game.input;document.getElementById('world').releasePointerCapture(i.pan.id);});
 await page.mouse.move(760,390);assert.equal((await state()).drag,null,'lost capture clears drag');await page.mouse.up({button:'right'});
 assert.equal(errors.length,0,errors.join('\n'));results.push({checks:['release','Shift pan','reset','blur','HUD isolation','lost capture'],errors});
 await writeFile(`${out}/verification.json`,JSON.stringify(results,null,2));console.log(JSON.stringify(results));
}finally{await browser.close();}
