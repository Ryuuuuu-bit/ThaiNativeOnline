import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { Character } from '../src/character/Character.js';
import { MemoryStore } from '../server/store.js';
import { createRanking } from '../server/ranking.js';
const require=createRequire(import.meta.url);
let pw;try{pw=require('playwright');}catch{pw=require('C:/Users/panup/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');}
const store=new MemoryStore();
for(const [account,slot,name,cls,level] of [['a',0,'อรุณ','warrior',60],['a',1,'สายฝน','herbalist',45],['b',0,'Guide','hunter',40],['c',0,'Ryuu','shaman',10]]){
 const c=Character.create(name,cls);c.level=level;
 await store.putSlot(account,slot,{'tno.character.v1':JSON.stringify(c.toJSON())});
}
const ranking=createRanking({store});await ranking.refresh();const data={...ranking.boards(),me:ranking.mine('c:0')};assert.equal(data.total,4);assert.equal(data.me.lvRank,4);
const out='docs/art/server-wide-ranking';await mkdir(out,{recursive:true});
const browser=await pw.chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1366,height:768}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/tools/ranking-review.html',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><meta charset="utf-8"><div id="app"></div>'}));
 await page.goto(`${process.env.GAME_QA_URL||'http://127.0.0.1:5192'}/tools/ranking-review.html`);
 await page.evaluate(async data=>{
  await Promise.all(['/src/style.css','/src/ui/theme.css','/src/ui/layout.css','/src/net/net.css','/src/net/social.css','/src/ui/skin-classic.css'].map(url=>import(url)));
  const {rankPane}=await import('/src/net/SocialPanes.js');
  document.body.classList.add('skin-classic');
  const panel=document.createElement('section');panel.className='soc-panel soc-win glass';
  panel.innerHTML='<header><kbd>P</kbd><b>สังคม</b><button data-close>✕</button></header><nav class="sw-tabs"><button aria-pressed="true">อันดับ</button></nav><div class="sw-body"></div>';
  panel.querySelector('.sw-body').innerHTML=rankPane({data,board:'level',cls:'all',name:'Ryuu',myCls:'shaman'});document.getElementById('app').append(panel);
 },data);
 await page.locator('.sw-pod').first().waitFor();assert.equal(await page.locator('.sw-pod').count(),3);assert.match(await page.locator('.sw-meta').innerText(),/4.*ออนไลน์และออฟไลน์/);assert.match(await page.locator('.sw-rrow.me').innerText(),/Ryuu/);
 const bounds=await page.locator('.soc-win').boundingBox();assert.ok(bounds.x>=0&&bounds.y>=0&&bounds.x+bounds.width<=1366&&bounds.y+bounds.height<=768,'panel fits PC');
 await page.screenshot({path:`${out}/level-pc.png`});assert.equal(errors.length,0,errors.join('\n'));
 await writeFile(`${out}/verification.json`,JSON.stringify({total:data.total,level:data.level,myRank:data.me,errors,fixture:'4 offline saved envelopes, 3 accounts, 2 slots for one account; actual createRanking + rankPane'},null,2));console.log('Ranking UI passed: all four saved characters, offline podium and own row.');
}finally{await browser.close();}


