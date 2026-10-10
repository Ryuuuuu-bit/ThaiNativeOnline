import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)('C:/Users/panup/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out='artifacts/skill-choice';await mkdir(out,{recursive:true});
const base=process.argv[2] || 'http://127.0.0.1:5181';
const browser=await chromium.launch({channel:'msedge',headless:true});
const report={passed:false,checks:[],images:[],errors:[]};
try {
 const page=await browser.newPage();page.on('pageerror',e=>report.errors.push(e.message));
 for(const [width,height] of [[1366,768],[1920,1080],[390,844]]) {
  await page.setViewportSize({width,height});await page.goto(base+'/tools/skill-path-review.html');
  await page.waitForFunction(()=>window.skillReview?.ready);
  await page.locator('.g-path-option details').first().evaluate(e=>e.open=true);
  await page.locator('.g-path-option details').last().evaluate(e=>e.open=true);
  const checkBounds=async()=>{
   const data=await page.locator('.g-sk-card').evaluate(e=>({client:e.clientWidth,scroll:e.scrollWidth,options:[...e.querySelectorAll('.g-path-option')].map(n=>({client:n.clientWidth,scroll:n.scrollWidth}))}));
   assert.ok(data.scroll<=data.client+1,JSON.stringify({width,data}));assert.ok(data.options.every(n=>n.scroll<=n.client+1),JSON.stringify(data));
  };await checkBounds();
  const a=page.locator('[data-evo="sword_twin:A"]');assert.match(await a.innerText(),/เลือกสาย A · ฟรี/);
  await a.click();assert.equal(await page.evaluate(()=>window.skillReview.c.evo.sword_twin),undefined);
  assert.equal(await page.locator('.g-path-option details[open]').count(),2,'Disclosure state survives selection redraw');
  await page.evaluate(()=>{window.skillReview.c.gold=1100;window.skillReview.c.emit('change');});
  assert.equal(await page.locator('[data-evo-confirm]').evaluate(e=>e===document.activeElement),true);
  assert.equal(await page.locator('.g-path-option details[open]').count(),2);
  await page.evaluate(()=>{window.skillReview.c.gold=1000;window.skillReview.c.emit('change');});
  assert.equal(await page.locator('[data-evo-confirm]').evaluate(e=>e===document.activeElement),true);
  assert.equal(await page.locator('.g-path-option.is-pending').count(),1);
  await page.locator('[data-evo-cancel]').click();assert.equal(await a.evaluate(e=>e===document.activeElement),true);
  await a.click();await page.locator('[data-evo-confirm]').click();
  assert.equal(await page.evaluate(()=>window.skillReview.c.gold),1000);assert.equal(await a.isDisabled(),true);assert.match(await a.innerText(),/กำลังใช้สาย A/);
  await page.locator('[data-evo="sword_twin:B"]').click();assert.match(await page.locator('.g-evo-confirm').innerText(),/200 ตำลึง/);
  await page.evaluate(()=>{const{c}=window.skillReview;c.evoContext=()=>({fighting:true});c.emit('change');});
  assert.equal(await page.locator('[data-evo-confirm]').isDisabled(),true);
  await page.evaluate(()=>{const{c}=window.skillReview;c.evoContext=()=>({fighting:false});c.jobLevel=21;c.emit('change');});
  assert.match(await page.locator('.g-evo-confirm').innerText(),/210 ตำลึง/);assert.equal(await page.locator('[data-evo-confirm]').isDisabled(),false);
  await page.evaluate(()=>{window.skillReview.c.jobLevel=20;window.skillReview.c.emit('change');});
  await checkBounds();await page.screenshot({path:out+'/confirm-'+width+'.png',animations:'disabled'});report.images.push('confirm-'+width+'.png');
  await page.locator('[data-evo-confirm]').click();assert.equal(await page.evaluate(()=>window.skillReview.c.gold),800);
  await page.locator('[data-evo="sword_twin:A"]').click();
  await page.locator('[data-sk="sword_thrust"]').click();assert.equal(await page.locator('.g-evo-confirm').count(),0);
  const count=await page.evaluate(async()=>{
   const {Character}=await import('/src/character/Character.js'),{SkillPanel}=await import('/src/character/ui/SkillPanel.js');
   const {KIT_SKILL_IDS}=await import('/src/character/data/kits.js'),{KIT_PASSIVE_IDS}=await import('/src/rules/data/kitpassives.js');
   let count=0;
   const main=window.skillReview.panel;main.root.hidden=true;
   for(const cls of Object.keys(KIT_PASSIVE_IDS)) {
    const c=Character.create('ทดสอบ',cls);c.jobLevel=50;c.gold=10000;c.skills=Object.fromEntries([...KIT_SKILL_IDS[cls],...KIT_PASSIVE_IDS[cls]].map(id=>[id,5]));
    const p=new SkillPanel(document.querySelector('#review'),c,null,()=>{});p.toggle();
    for(const id of Object.keys(c.skills)) {p.sel=id;p.key=null;p.refresh();for(const d of p.root.querySelectorAll('.g-path-option details'))d.open=true;
     for(const e of [p.root.querySelector('.g-sk-card'),...p.root.querySelectorAll('.g-path-option')])if(e.scrollWidth>e.clientWidth+1)throw Error(cls+' '+id+' overflow '+e.scrollWidth+'/'+e.clientWidth);
     count++;
    }p.root.remove();
   }main.root.hidden=false;return count;
  });assert.equal(count,65);
  await page.evaluate(()=>{const{c,panel}=window.skillReview;c.evoContext=()=>({fighting:true});panel.sel='sword_twin';panel.key=null;panel.refresh();});
  assert.equal(await page.locator('[data-evo="sword_twin:A"]').isDisabled(),true);
  report.checks.push(width+'x'+height+': expanded previews fit all65 skills; free/paid/cancel/current/focus/skill-switch/combat guards pass');
 }
 assert.deepEqual(report.errors,[]);report.passed=true;console.log(JSON.stringify(report));
} finally {await writeFile(out+'/receipt.json',JSON.stringify(report,null,2));await browser.close();}
