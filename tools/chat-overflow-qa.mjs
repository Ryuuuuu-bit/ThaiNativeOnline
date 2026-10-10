import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
let pw;try{pw=require('playwright');}catch{pw=require('C:/Users/panup/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');}
const out='docs/art/chat-overflow';await mkdir(out,{recursive:true});
const browser=await pw.chromium.launch({channel:'msedge',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const results=[];
try{
 const page=await browser.newPage({viewport:{width:1366,height:768}});
 await page.route('**/api/health',r=>r.fulfill({contentType:'application/json',body:'{"accounts":false}'}));
 await page.routeWebSocket('**/*',ws=>ws.close());
 await page.route('**/tools/chat-seed.html',r=>r.fulfill({contentType:'text/html',body:`<!doctype html><meta charset="utf-8"><script type="module">
 import {Character} from '/src/character/Character.js';localStorage.clear();sessionStorage.clear();
 const c=Character.create('Ryuu','shaman');c.hp=c.maxHp;c.mp=c.maxMp;c.save();
 sessionStorage.setItem('tno.session.v1',JSON.stringify({id:'guest',guest:true,prefix:''}));location.replace('/?at=4,150&t=10');</script>`}));
 await page.goto(`${process.env.GAME_QA_URL||'http://127.0.0.1:5192'}/tools/chat-seed.html`);
 await page.waitForFunction(()=>window.game?.net?.chat&&document.getElementById('loading').hidden,null,{timeout:60000});
 for(const [skin,width,height,hud] of [['modern',1366,768,1],['classic',1920,1080,1.3],['modern',960,540,1]]){
  await page.setViewportSize({width,height});
  await page.evaluate(async({skin,hud})=>{(await import('/src/ui/skin.js')).setSkin(skin);window.game.prefs.set({hud});const c=window.game.net.chat;c.close();c.select('system');for(let i=0;i<70;i++)c.add('ระบบ',`${i+1} ได้รับ หนังสัตว์ ×2 · ปราบมอนสเตอร์ +141 EXP +13 ตำลึง`,'system');c.add('ระบบ','ข้อความยาว'.repeat(90)+'LongUnbrokenText'.repeat(30),'system');},{skin,hud});
  await page.locator('.net-lines').focus();
  const measure=()=>page.evaluate(()=>{const root=document.querySelector('.net-chat'),log=root.querySelector('.net-lines'),r=root.getBoundingClientRect(),l=log.getBoundingClientRect(),s=getComputedStyle(log);return{bottom:r.bottom,logBottom:l.bottom,top:r.top,logTop:l.top,rootHeight:r.height,maxHeight:getComputedStyle(root).maxHeight,minHeight:s.minHeight,overflow:s.overflowY,display:s.display,client:log.clientHeight,scroll:log.scrollHeight,scrollTop:log.scrollTop,count:log.querySelectorAll('p[data-channel="system"]').length};});
  const m=await measure();results.push({skin,width,height,hud,...m});
  await page.locator('.net-chat').screenshot({path:`${out}/${process.env.CHAT_BEFORE?'before':'after'}-${skin}-${width}.png`});
  if(process.env.CHAT_BEFORE)continue;
  assert.ok(m.logBottom<=m.bottom-1,'log fits inside panel padding');assert.equal(m.display,'block');assert.equal(m.overflow,'auto');assert.ok(m.scroll>m.client);assert.equal(m.count,30);
  await page.evaluate(()=>{document.querySelector('.net-lines').scrollTop=0;window.game.net.chat.add('ระบบ','ข้อความใหม่ขณะอ่านประวัติ','system');});
  assert.equal((await measure()).scrollTop,0,'new message preserves reading position');
  await page.evaluate(()=>{const l=document.querySelector('.net-lines');l.scrollTop=l.scrollHeight;window.game.net.chat.add('ระบบ','ข้อความล่าสุด','system');});
  const last=await measure();assert.ok(last.scroll-last.client-last.scrollTop<2,'latest message follows bottom');
  await page.evaluate(()=>{const c=window.game.net.chat;c.lines.replaceChildren();for(const [text,kind] of [['ได้รับ หนังสัตว์ ×2','loot'],['ปราบมอนสเตอร์ +141 EXP +13 ตำลึง','exp'],['เป้าหมายไกลเกินไป · เดินเข้าใกล้ก่อนโจมตี','bad'],['ใช้ น้ำผึ้งป่า','system'],['ได้รับ เขี้ยวหมาป่า ×2','loot']])c.add('ระบบ',text,kind);});
  await page.locator('.net-chat').screenshot({path:`${out}/readable-${skin}-${width}.png`});
  await page.evaluate(()=>window.game.net.chat.open());
  const compose=await page.evaluate(()=>{const r=document.querySelector('.net-chat').getBoundingClientRect(),f=document.querySelector('.chat-compose').getBoundingClientRect();return{bottom:r.bottom,composeBottom:f.bottom};});
  assert.ok(compose.composeBottom<=compose.bottom,'composer fits');
 }
 if(!process.env.CHAT_BEFORE){
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>{document.body.classList.add('ui-touch');window.game.net.chat.close();});
  assert.equal(await page.locator('.chat-body').isVisible(),false,'mobile collapses');
  await page.evaluate(()=>window.game.net.chat.open());
  const bounds=await page.evaluate(()=>{const r=document.querySelector('.net-chat').getBoundingClientRect(),f=document.querySelector('.chat-compose').getBoundingClientRect();return{left:r.left,right:r.right,bottom:r.bottom,composeBottom:f.bottom};});
  assert.ok(bounds.left>=0&&bounds.right<=390&&bounds.bottom<=844&&bounds.composeBottom<=bounds.bottom,'touch chat and composer fit screen');
  await page.locator('.net-chat').screenshot({path:`${out}/mobile-compose.png`});results.push({mobile:bounds});
 }
 await writeFile(`${out}/${process.env.CHAT_BEFORE?'before':'verification'}.json`,JSON.stringify(results,null,2));console.log(JSON.stringify(results));
}finally{await browser.close();}
