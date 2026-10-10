import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/panup/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out = 'docs/art/skill-paths/review'; await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const records = [];
try {
  for (const [name, width, height] of [['desktop',1440,1000],['portrait',390,844],['landscape',844,390]]) {
    const page = await browser.newPage({ viewport: {width,height} }); const errors=[];
    page.on('pageerror', e=>errors.push(e.message));
    await page.goto('http://127.0.0.1:5199/tools/skill-path-review.html');
    await page.waitForFunction(()=>window.skillReview?.ready);
    await page.locator('[data-evo="sword_twin:A"]').click();
    assert.equal(await page.evaluate(()=>window.skillReview.c.evo.sword_twin),undefined);
    await page.locator('[data-evo-confirm]').click();
    assert.equal(await page.evaluate(()=>window.skillReview.c.gold),1000);
    await page.locator('[data-evo="sword_twin:B"]').click();
    assert.match(await page.locator('.g-evo-confirm').innerText(),/200 ตำลึง/);
    const box = await page.locator('[data-evo-confirm]').boundingBox(); assert.ok(box && box.y >= 0 && box.y + box.height <= height);
    const cancelBox = await page.locator('[data-evo-cancel]').boundingBox(); assert.ok(cancelBox && cancelBox.y >= 0 && cancelBox.y + cancelBox.height <= height);
    await page.screenshot({path:`${out}/${name}.png`});
    await page.locator('[data-evo-confirm]').click();
    assert.equal(await page.evaluate(()=>window.skillReview.c.gold),800);
    await page.evaluate(()=>{const{c,panel}=window.skillReview;c.evoContext=()=>({fighting:true});c.emit('change');panel.key=null;panel.refresh();});
    assert.equal(await page.locator('[data-evo="sword_twin:A"]').isDisabled(),true);
    await page.evaluate(()=>{const{c,panel}=window.skillReview;c.evoContext=()=>({fighting:false,busy:false});panel.sel='sword_t_mastery';panel.key=null;panel.refresh();});
    assert.equal(await page.locator('[data-evo="sword_t_mastery:A"]').isDisabled(),false);
    await page.locator('[data-evo="sword_t_mastery:A"]').click();await page.locator('[data-evo-confirm]').click();
    assert.equal(await page.evaluate(()=>window.skillReview.c.evo.sword_t_mastery),'A');
    const coverage = await page.evaluate(async()=>{
      const {CLASSES}=await import('/src/character/data/classes.js');
      const {Character}=await import('/src/character/Character.js');
      const {SkillPanel}=await import('/src/character/ui/SkillPanel.js');
      const {KIT_SKILL_IDS}=await import('/src/character/data/kits.js');
      const {KIT_PASSIVE_IDS}=await import('/src/rules/data/kitpassives.js');
      const ids=[];
      for(const cls of Object.keys(KIT_PASSIVE_IDS)){
        const c=Character.create('ทดสอบ',cls);c.jobLevel=50;c.gold=10000;
        c.skills=Object.fromEntries([...KIT_SKILL_IDS[cls],...KIT_PASSIVE_IDS[cls]].map(id=>[id,5]));
        const host=document.createElement('div');document.body.append(host);
        const p=new SkillPanel(host,c,null,()=>{});p.toggle();
        for(const id of Object.keys(c.skills)){p.sel=id;p.key=null;p.refresh();const buttons=p.root.querySelectorAll('[data-evo]');if(buttons.length!==2)throw Error(id+' missing A/B');ids.push(id);}
        host.remove();
      }
      return ids;
    });
    assert.equal(coverage.length,65);
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);
    assert.equal(overflow,false);
    assert.deepEqual(errors,[]);
    records.push({name,width,height,checks:14,skillsRendered:coverage.length,errors,overflow});await page.close();
  }
} finally { await browser.close(); }
await writeFile(`${out}/browser-checks.json`,JSON.stringify({records,browserClosed:true},null,2));
console.log(JSON.stringify(records));
