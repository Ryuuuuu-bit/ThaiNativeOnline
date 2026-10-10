import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
let pw;try{pw=require('playwright');}catch{pw=require('C:/Users/panup/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');}
const out='docs/art/chat-channel-panel';await mkdir(out,{recursive:true});
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
 assert.equal(await page.locator('.chat-body').isVisible(),false,'drawer starts folded');
 await page.evaluate(()=>{const c=window.game.net.chat;c.add('Guide','ใครไปวัดร้างด้วยกันบ้างครับ');c.add('Ryuu','รวมตัวที่ประตูเมืองได้เลย');c.add('Guide','อีกหนึ่งนาทีออกเดินทางครับ','party');c.add('Mali','ฝากซื้อยาให้หน่อยนะ','whisper');c.add('ระบบ','ได้รับ หนังสัตว์ ×2','loot');c.add('ระบบ','ปราบมอนสเตอร์ +141 EXP +13 ตำลึง','exp');});
 await page.locator('.chat-toggle').click();
 assert.equal(await page.locator('.chat-compose').isVisible(),true);assert.equal(await page.locator('.chat-tabs').getAttribute('aria-orientation'),'vertical');
 await page.locator('[data-tab="general"]').focus();await page.keyboard.press('ArrowDown');await page.keyboard.press('ArrowDown');assert.equal(await page.locator('[data-tab="party"]').getAttribute('aria-selected'),'true');
 await page.locator('.chat-message').fill('ข้อความทดสอบ');await page.locator('.chat-send').click();assert.equal(await page.locator('.chat-feedback').isVisible(),true,'offline error preserves draft');assert.equal(await page.locator('.chat-message').inputValue(),'ข้อความทดสอบ');
 await page.evaluate(()=>{const c=window.game.net.chat;c.setStatus(true);window.__sent=[];c.whisperSend=(to,text)=>window.__sent.push(`/w ${to} ${text}`);c.filter=command=>{window.__sent.push(command);return true;};});
 await page.locator('.chat-send').click();assert.deepEqual(await page.evaluate(()=>window.__sent),['/p ข้อความทดสอบ']);assert.equal(await page.locator('.chat-compose').isVisible(),true,'sending keeps composer open');
 await page.locator('[data-tab="whisper"]').click();await page.locator('.chat-message').fill('พบกันในเมือง');await page.locator('.chat-send').click();assert.equal(await page.locator('.chat-feedback').isVisible(),true);
 await page.locator('.chat-recipient > label input').fill('Mali');await page.locator('.chat-send').click();assert.equal(await page.evaluate(()=>window.__sent.at(-1)),'/w Mali พบกันในเมือง');
 await page.locator('.chat-emoji-toggle').click();await page.locator('.chat-emoji-picker button').first().click();assert.ok((await page.locator('.chat-message').inputValue()).includes('🙂'));
 await page.locator('[data-tab="system"]').click();assert.equal(await page.locator('.chat-compose').isVisible(),false);assert.equal(await page.locator('.chat-system-note').isVisible(),true);
 await page.locator('.chat-toggle').click();assert.equal(await page.locator('.chat-body').isVisible(),false);await page.locator('.chat-toggle').click();assert.equal(await page.locator('[data-tab="system"]').getAttribute('aria-selected'),'true','fold preserves channel');
 await page.locator('[data-tab="general"]').click();
 for(const [skin,width,height,hud] of [['modern',1366,768,1],['classic',1920,1080,1.3],['modern',960,540,1]]){
  await page.setViewportSize({width,height});await page.evaluate(async({skin,hud})=>{(await import('/src/ui/skin.js')).setSkin(skin);window.game.prefs.set({hud});window.game.net.chat.open();},{skin,hud});
  const bounds=await page.evaluate(()=>{const r=document.querySelector('.net-chat').getBoundingClientRect(),t=document.querySelector('.chat-tabs').getBoundingClientRect(),l=document.querySelector('.net-lines').getBoundingClientRect(),f=document.querySelector('.chat-compose').getBoundingClientRect();return{left:r.left,top:r.top,right:r.right,bottom:r.bottom,tabsRight:t.right,logLeft:l.left,logBottom:l.bottom,composeBottom:f.bottom};});
  assert.ok(bounds.top>=0&&bounds.bottom<=height&&bounds.left>=0&&bounds.right<=width,'drawer fits viewport');assert.ok(bounds.tabsRight<=bounds.logLeft,'channels left of log');assert.ok(bounds.logBottom<=bounds.bottom&&bounds.composeBottom<=bounds.bottom,'contents stay in panel');
  await page.screenshot({path:`${out}/${skin}-${width}.png`});results.push({skin,width,height,hud,...bounds});
 }
 await page.evaluate(()=>{const c=window.game.net.chat;for(let i=0;i<70;i++)c.add('Guide',`${i} `+'ข้อความยาว'.repeat(30));});
 assert.equal(await page.locator('.net-lines p[data-channel="general"]').count(),30);
 await page.evaluate(()=>{const c=window.game.net.chat;c.lines.scrollTop=0;c.add('Guide','ข้อความใหม่ขณะอ่าน');});assert.equal(await page.locator('.net-lines').evaluate(el=>el.scrollTop),0);
 await page.evaluate(()=>{const c=window.game.net.chat;c.setGmCatalog([{id:'help',usage:'help',description:'ดูคำสั่ง'}]);});
 await page.locator('.chat-gm-toggle').click();assert.equal(await page.locator('.chat-gm-help').isVisible(),true);assert.equal(await page.locator('.chat-body').isVisible(),true);await page.evaluate(()=>window.game.net.chat.setGmCatalog([]));
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>{document.body.classList.add('ui-touch');window.game.net.chat.open();});
 await page.screenshot({path:`${out}/touch-390.png`});
 const mobile=await page.locator('.net-chat').boundingBox();assert.ok(mobile.x>=0&&mobile.x+mobile.width<=390&&mobile.y+mobile.height<=844,'touch panel fits');
 await page.setViewportSize({width:844,height:390});
 for(const channel of ['general','whisper']){
  await page.evaluate(channel=>{window.game.net.chat.select(channel);window.game.net.chat.open();},channel);
  await page.locator('.chat-message').scrollIntoViewIfNeeded();const b=await page.locator('.net-chat').boundingBox(),input=await page.locator('.chat-message').boundingBox();
  assert.ok(b.y>=0&&b.y+b.height<=390,'landscape drawer fits');assert.ok(input.y>=b.y&&input.y+input.height<=b.y+b.height,'landscape composer reachable');
 }
 await page.evaluate(()=>window.game.net.chat.setGmCatalog([{id:'help',usage:'help',description:'ดูคำสั่ง'}]));await page.locator('.chat-gm-toggle').click();
 await page.locator('.chat-gm-help button').first().scrollIntoViewIfNeeded();const gm=await page.locator('.net-chat').boundingBox();assert.ok(gm.y>=0&&gm.y+gm.height<=390,'landscape GM drawer fits');
 await page.screenshot({path:`${out}/touch-landscape.png`});
 await page.keyboard.press('Escape');assert.equal(await page.locator('.chat-body').isVisible(),false,'Escape folds');
 assert.equal(errors.length,0,errors.join('\n'));await writeFile(`${out}/verification.json`,JSON.stringify({results,mobile,errors,delivery:'stubbed filter; no real messages sent'},null,2));console.log(JSON.stringify(results));
}finally{await browser.close();}
