import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
let pw;try{pw=require('playwright');}catch{pw=require('C:/Users/panup/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');}
const out='docs/art/whisper-picker';await mkdir(out,{recursive:true});
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
 await page.evaluate(()=>{const c=window.game.net.chat;c.setStatus(true);c.setWhisperContacts(['Ryuu','Mali','Guide','Mali Dee','<script>'],'Ryuu');window.__sent=[];c.filter=text=>{if(text.startsWith('/')){window.__sent.push(text);return true;}return false;};c.whisperSend=(to,text)=>window.__sent.push({t:'w',to,text});c.send=(text,channel)=>window.__sent.push({text,channel});c.open('/w Mali ');});
 const target=page.locator('.chat-recipient > label input');assert.equal(await target.inputValue(),'Mali');assert.equal(await page.locator('.chat-message').inputValue(),'','/w command does not clutter draft');
 await page.locator('.chat-message').fill('เจอกันที่ประตูเมือง');
 await page.evaluate(()=>window.game.net.chat.addWhisper({from:'Guide',text:'ไปเก็บเวลด้วยกันไหม',echo:false}));
 assert.equal(await target.inputValue(),'Mali','incoming messages do not silently retarget current draft');
 await page.locator('.chat-reply').click();assert.equal(await target.inputValue(),'Guide');await page.locator('.chat-send').click();assert.deepEqual(await page.evaluate(()=>window.__sent.at(-1)),{t:'w',to:'Guide',text:'เจอกันที่ประตูเมือง'});
 await page.evaluate(()=>window.game.net.chat.addWhisper({to:'Mali',text:'ข้อความส่งออก',echo:true}));await page.locator('.chat-reply').click();assert.equal(await target.inputValue(),'Guide','outgoing echo does not change last incoming reply');
 await page.locator('.chat-contacts summary').click();assert.equal(await page.locator('.chat-contact-list [data-whisper-to="Ryuu"]').count(),0);
 await page.locator('.chat-contact-search').fill('mal');assert.equal(await page.locator('.chat-contact-list button').count(),2);await page.locator('.chat-contact-list button').first().click();assert.equal(await target.inputValue(),'Mali');
 await page.locator('.chat-person[data-whisper-to="Guide"]').first().click();assert.equal(await target.inputValue(),'Guide');
 await page.locator('.chat-contacts summary').click();await page.locator('.chat-contact-search').fill('');
 assert.equal(await page.locator('.chat-contact-list script').count(),0,'names render as text');
 await page.screenshot({path:`${out}/desktop-picker.png`});
 await page.locator('.chat-contacts summary').click();
 await page.evaluate(()=>window.game.net.chat.startWhisper('Mali Dee'));await page.locator('.chat-message').fill('/p literal whisper');await page.locator('.chat-send').click();assert.deepEqual(await page.evaluate(()=>window.__sent.at(-1)),{t:'w',to:'Mali Dee',text:'/p literal whisper'});
 await page.locator('[data-tab="area"]').click();await page.evaluate(()=>window.game.net.chat.add('Mali','ใครอยู่แผนที่นี้บ้าง','area'));
 assert.equal(await page.locator('.net-lines p[data-channel="area"]:visible').count(),1);await page.locator('.chat-message').fill('อยู่ CH นี้ครับ');await page.locator('.chat-send').click();assert.deepEqual(await page.evaluate(()=>window.__sent.at(-1)),{text:'อยู่ CH นี้ครับ',channel:'area'});
 await page.screenshot({path:`${out}/desktop-area.png`});
 for(const [width,height] of [[390,844],[844,390]]){
  await page.setViewportSize({width,height});await page.evaluate(()=>{document.body.classList.add('ui-touch');window.game.net.chat.startWhisper('Mali');});
  await page.waitForFunction(()=>!window.game.net.chat.collapsed);
  await target.scrollIntoViewIfNeeded();await page.locator('.chat-contacts summary').click();
  await page.locator('.chat-contact-list [data-whisper-to="Guide"]').scrollIntoViewIfNeeded();const b=await page.locator('.net-chat').boundingBox(),choice=await page.locator('.chat-contact-list [data-whisper-to="Guide"]').boundingBox();
  assert.ok(b.y>=0&&b.y+b.height<=height&&b.x+b.width<=width,'touch drawer fits');assert.ok(choice.y>=0&&choice.y+choice.height<=height,'touch contact reachable');
  await page.screenshot({path:`${out}/touch-${width}.png`});await page.locator('.chat-contact-list [data-whisper-to="Guide"]').click();assert.equal(await target.inputValue(),'Guide');results.push({width,height,b,choice});
 }
 assert.equal(errors.length,0,errors.join('\n'));await writeFile(`${out}/verification.json`,JSON.stringify({results,errors,checks:['command normalization','reply vs echo','draft recipient isolation','search and self exclusion','name button','safe rendering','area route','touch choices','structured whisper with spaced name and literal slash body']},null,2));console.log(JSON.stringify(results));
}finally{await browser.close();}

