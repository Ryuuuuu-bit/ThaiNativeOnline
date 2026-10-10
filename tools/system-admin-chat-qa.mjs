import { createRequire } from 'node:module';
import { mkdir,writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);let pw;try{pw=require('playwright');}catch{pw=require('C:/Users/panup/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');}
const out='docs/art/system-admin-chat';await mkdir(out,{recursive:true});
const browser=await pw.chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1366,height:768}}),errors=[],bounds=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/tools/system-admin-review.html',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><meta charset="utf-8"><div id="app"></div>'}));
 await page.goto(`${process.env.GAME_QA_URL||'http://127.0.0.1:5192'}/tools/system-admin-review.html`);
 await page.evaluate(async()=>{
  for(const css of ['/src/style.css','/src/ui/theme.css','/src/ui/layout.css','/src/ui/dynamic-hud.css','/src/ui/touch.css','/src/ui/mobile-hud.css','/src/net/net.css'])await import(css);
  const {ChatBox}=await import('/src/net/ChatBox.js'),{GM_COMMANDS}=await import('/server/gm-catalog.js');
  document.body.classList.add('hud-dynamic');window.sent=[];window.catalog=GM_COMMANDS;window.chat=new ChatBox((text,channel)=>window.sent.push({text,channel}));chat.open();chat.select('system');
 });
 const input=page.locator('.chat-message');assert.equal(await input.isVisible(),false,'regular System is read-only');
 await page.evaluate(()=>{chat.setGmCatalog(catalog);chat.setStatus(true);chat.setOnline(1);chat.open();});assert.equal(await input.isVisible(),true);assert.equal(await page.locator('[data-tab="system"]').getAttribute('aria-selected'),'true');
 await input.fill('public text');await page.locator('.chat-send').click();assert.equal(await page.evaluate(()=>sent.length),0);assert.equal(await input.inputValue(),'public text');assert.equal(await page.locator('.chat-feedback').isVisible(),true);
 await input.fill('/gm help');await input.press('Enter');assert.deepEqual(await page.evaluate(()=>sent.at(-1)),{text:'/gm help',channel:'system'});assert.equal(await input.inputValue(),'');
 await page.locator('.chat-gm-toggle').click();await page.locator('.chat-gm-help button').first().click();assert.equal(await page.locator('[data-tab="system"]').getAttribute('aria-selected'),'true');assert.equal(await input.inputValue(),'/gm help ');assert.equal(await page.evaluate(()=>sent.length),1,'prefill does not execute');await page.locator('.chat-gm-toggle').click();
 await page.evaluate(()=>{chat.add('GM','/gm help — ดูคำสั่ง Admin และวิธีใช้งาน','gm');chat.add('ระบบ','ได้รับไอเทม ×2','system');});
 for(const [width,height,touch] of [[1366,768,false],[390,844,true],[844,390,true]]){
  await page.setViewportSize({width,height});await page.evaluate(touch=>{document.body.classList.toggle('ui-touch',touch);chat.open();},touch);await input.scrollIntoViewIfNeeded();
  const panel=await page.locator('.net-chat').boundingBox(),field=await input.boundingBox();assert.ok(panel.x>=0&&panel.y>=0&&panel.x+panel.width<=width&&panel.y+panel.height<=height,'panel fits');assert.ok(field.y>=0&&field.y+field.height<=height,'command reachable');
  await page.screenshot({path:`${out}/system-${width}.png`});bounds.push({width,height,panel,field});
 }
 await page.evaluate(()=>chat.setStatus(false));await input.fill('/GM help');await input.press('Enter');assert.equal(await page.evaluate(()=>sent.length),1,'offline does not send');assert.equal(await input.inputValue(),'/GM help');
 await page.evaluate(()=>chat.setStatus(true));await input.press('Enter');assert.deepEqual(await page.evaluate(()=>sent.at(-1)),{text:'/GM help',channel:'system'});
 await page.evaluate(()=>{chat.setGmCatalog([]);chat.input.value='/gm gold 5';chat.submit();});assert.equal(await input.isVisible(),false,'revocation immediately hides input');assert.equal(await page.evaluate(()=>sent.length),2,'revoked composer cannot send');assert.equal(await page.locator('.chat-gm-toggle').count(),0);assert.equal(await page.locator('.net-lines .gm').count(),0);
 assert.equal(errors.length,0,errors.join('\n'));await writeFile(`${out}/verification.json`,JSON.stringify({passed:true,bounds,errors,checks:['regular read-only','admin System composer','non-GM text blocked','Enter command submit','GM help prefills without execution','System stays selected','offline draft','revocation hides and blocks','PC and touch bounds'],transport:'stubbed send; no real admin command executed'},null,2));console.log('System Admin chat QA passed');
}finally{await browser.close();}

