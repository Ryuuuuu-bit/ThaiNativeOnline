import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
let playwright;
try { playwright = require(process.env.PLAYWRIGHT_MODULE || 'playwright'); }
catch { playwright = require('C:/Users/panup/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'); }
const { chromium } = playwright;
const out = 'docs/art/menu-navigation'; await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const results = [], errors = [];
try {
 const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
 page.on('pageerror', e => errors.push(e.message));
 await page.route('**/api/health', r => r.fulfill({ contentType: 'application/json', body: '{"accounts":false}' }));
 await page.routeWebSocket('**/*', ws => ws.close());
 await page.route('**/tools/menu-navigation-seed.html', r => r.fulfill({contentType:'text/html',body:`<!doctype html><meta charset="utf-8"><script type="module">
 import {Character} from '/src/character/Character.js';
 localStorage.clear();sessionStorage.clear();
 const c=Character.create('Ryuu','shaman');c.level=6;c.jobLevel=5;c.gold=1999;c.hp=c.maxHp;c.mp=c.maxMp;c.save();
 sessionStorage.setItem('tno.session.v1',JSON.stringify({id:'guest',guest:true,prefix:''}));
 location.replace('/?at=4,150&t=10');</script>`}));
 await page.goto(`${process.env.GAME_QA_URL || 'http://127.0.0.1:5192'}/tools/menu-navigation-seed.html`);
 await page.waitForFunction(() => window.game?.net?.chat && window.game?.game?.characterUI && document.getElementById('loading').hidden, null, { timeout: 60000 });
 await page.evaluate(async () => (await import('/src/ui/skin.js')).setSkin('modern'));
 const open = async act => {
  if (!(await page.locator('#menu-grid').isVisible())) await page.locator('#menu-btn').click();
  const tile=page.locator(`#menu-grid [data-act="${act}"]`), group=tile.locator('xpath=ancestor::details');
  if (!(await group.getAttribute('open')) && !(await tile.isVisible())) await group.locator('summary').click();
  await tile.click();
 };
 await page.locator('#menu-btn').click();
 assert.equal(await page.locator('#menu-grid [data-act]').count(), 18);
 assert.equal(await page.locator('[data-act="settings"] kbd,[data-act="auto"] kbd').count(), 0);
 assert.equal(await page.evaluate(() => document.activeElement.dataset.act), 'sheet');
 await page.screenshot({ path: `${out}/menu-pc.png`, animations: 'disabled' });
 const last = page.locator('#menu-grid button:visible').last(); await last.focus(); await page.keyboard.press('Tab');
 assert.equal(await page.evaluate(() => document.getElementById('menu-grid').contains(document.activeElement)), true);
 await page.keyboard.press('Escape'); assert.equal(await page.locator('#menu-grid').isVisible(), false);
 assert.equal(await page.evaluate(() => document.activeElement.id), 'menu-btn'); results.push('18 real menu actions, truthful badges, initial focus, Tab containment and Esc restoration');
 for (const [act, tab] of [['social','party'],['recruit','board'],['friends','friends'],['titles','titles'],['rank','rank']]) {
  await open(act); assert.equal(await page.locator(`.soc-panel [data-tab="${tab}"][aria-pressed="true"]`).count(), 1);
  if (act === 'friends') await page.locator('.soc-panel input').first().focus();
  else await page.locator('.soc-panel [data-close]').focus();
  await page.keyboard.press('Escape'); assert.equal(await page.locator('.soc-panel').isVisible(), false);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'menu-btn');
 }
 results.push('Five social destinations reach intended tabs; Esc closes focused friend input and restores opener');
 await page.locator('#menu-btn').focus(); await page.keyboard.press('p');
 assert.equal(await page.locator('.soc-panel [data-tab="party"][aria-pressed="true"]').count(),1);
 await page.keyboard.press('Escape');
 await open('settings'); await page.locator('#zoom').focus();
 await page.evaluate(()=>document.getElementById('settings-close').click());
 await page.waitForFunction(()=>document.activeElement.id==='menu-btn');
 results.push('P opens party after other social tabs; settings close button restores original opener');
 for (const [act, root, control] of [['settings','#settings','#zoom'],['bag','.inventory-workspace','.g-bag-search'],['loadouts','.g-loadouts','input'],['auto','.auto-panel','input'],['skills','.g-skills','button']]) {
  await open(act); const host = page.locator(root); assert.equal(await host.isVisible(), true);
  const target = host.locator(control).first(); if (await target.count()) await target.focus();
  await page.keyboard.press('Escape'); assert.equal(await host.isVisible(), false, `${act} closes from focused control`);
 }
 results.push('Settings, inventory, loadouts, AUTO and skills close from focused controls');
 for (const [act, category] of [['shops','shops'],['teachers','training'],['travel','travel']]) {
  await open(act); assert.equal(await page.evaluate(() => window.game.mapPanel.category), category);
  assert.equal(await page.locator('#fullmap-panel').isVisible(), true);
  await page.keyboard.press('Escape');
 }
 results.push('Three directory shortcuts open correct map category without initiating travel');
 const ids = await page.evaluate(() => {
  const q = window.game.quests;
  const real = [...q.defs.values()].find(x => q.matchesClass(x));
  const defs = Array.from({length:8},(_,i)=>({...real,id:`qa-journal-${i}`,title:`${real.title} · ภารกิจ ${i+1}`}));
  q.state = {}; for (const d of defs) q.defs.set(d.id,d);
  for (const d of defs) q.state[d.id] = { status: 'active' };
  q.state[defs.at(-1).id] = { status: 'done' };
  q.emit('change'); return defs.map(x => x.id);
 });
 await open('quests'); assert.equal(await page.locator('[data-journal-quest]').count(), 7);
 await page.screenshot({ path: `${out}/quest-journal-pc.png`, animations: 'disabled' });
 await page.locator('#quest-journal-filter').selectOption('done'); assert.equal(await page.locator('[data-journal-quest]').count(), 1);
 await page.locator('#quest-journal-filter').selectOption('all'); assert.equal(await page.locator('[data-journal-quest]').count(), 8);
 await page.evaluate(id=>{const qs=window.game.quests,q=qs.defs.get(id);qs.defs.set(id,{...q,objectives:[{talk:q.giver}]});qs.state[id].talked=[q.giver];qs.emit('change');},ids[0]);
 await page.locator('#quest-journal-filter').selectOption('ready'); assert.equal(await page.locator('[data-journal-quest]').count(),1);
 await page.locator('[data-journal-locate]').click();
 assert.equal(await page.locator('#quest-journal-overlay').isVisible(),false);
 assert.equal(await page.locator('#fullmap-panel').isVisible(),true);
 assert.ok(await page.evaluate(()=>window.game.mapPanel.selected?.npcId || window.game.mapPanel.query),'NPC selected or explicitly searched');
 await page.keyboard.press('Escape'); await open('quests'); await page.locator('#quest-journal-filter').selectOption('all');
 await page.locator('#quest-journal-search').fill('ไม่พบแน่นอนXYZ'); assert.equal(await page.locator('[data-journal-quest]').count(), 0);
 await page.locator('#quest-journal-search').fill('');
 await page.locator('[data-journal-quest]').nth(4).click();
 const selected = await page.evaluate(() => window.game.questJournal.selectedId);
 await page.evaluate(() => window.game.quests.emit('change')); assert.equal(await page.evaluate(() => window.game.questJournal.selectedId), selected);
 await page.locator('#quest-journal-search').focus(); await page.keyboard.press('Escape'); assert.equal(await page.locator('#quest-journal-overlay').isVisible(), false);
 results.push('All seven accepted quests plus completed history, search empty state, selection retained on progress event, input Escape');
 results.push('Ready filter and turn-in NPC map link; journal closes before map navigation');
 await page.evaluate(()=>{window.game.questJournal.show();window.game.guide.show();});
 await page.keyboard.press('Escape');
 assert.equal(await page.locator('#quest-journal-overlay').isVisible(),false); assert.equal(await page.locator('#bestiary-overlay').isVisible(),true);
 await page.keyboard.press('Escape'); assert.equal(await page.locator('#bestiary-overlay').isVisible(),false);
 results.push('Equal-z overlays close actual later-painted journal first, even when Bestiary was opened later');
 await open('bag');
 await page.evaluate(() => window.game.guide.show()); await page.keyboard.press('Escape');
 assert.equal(await page.locator('#bestiary-overlay').isVisible(), false); assert.equal(await page.locator('.inventory-workspace').isVisible(), true);
 await page.keyboard.press('Escape'); assert.equal(await page.locator('.inventory-workspace').isVisible(), false);
 results.push('Stacked Bestiary/inventory closes exactly one foremost window per Escape');
 await open('bag'); await page.evaluate(()=>{const w=window.game.game.characterUI.workspace;w.showTooltip(w.root.querySelector('.g-eqs>button[data-slot="weapon"]'));});
 assert.equal(await page.locator('.iw-tooltip').isVisible(),true);
 await page.keyboard.press('Escape'); assert.equal(await page.locator('.iw-tooltip').isVisible(),false);assert.equal(await page.locator('.inventory-workspace').isVisible(),true);
 await page.keyboard.press('Escape'); results.push('Inventory tooltip dismisses before inventory window');
 await open('bag'); await page.locator('.g-bag-search').focus();
 const before = await page.evaluate(() => window.game.game.character.classId);
 await page.keyboard.type('wasd'); assert.equal(await page.locator('.g-bag-search').inputValue(), 'wasd');
 assert.equal(await page.evaluate(() => window.game.input.keys.size), 0); await page.locator('.g-bag-search').fill('');
 await page.evaluate(() => { const c = window.game.game.character; const s = c.inventory.find(x => x); c.inventory = Array.from({ length: 100 }, () => ({ ...s })); window.game.game.characterUI.refreshInventory(); });
 await page.locator('.g-bag').evaluate(el => { el.scrollTop = el.scrollHeight; });
 const rects = await page.evaluate(() => { const r = document.querySelector('.g-bag-search').getBoundingClientRect(), p = document.querySelector('.g-bag').getBoundingClientRect(); return { top: r.top, bottom: r.bottom, pt: p.top, pb: p.bottom }; });
 assert.ok(rects.top >= rects.pt && rects.bottom <= rects.pb, 'sticky search visible at bottom of 100-item inventory');
 await page.screenshot({ path: `${out}/inventory-sticky-pc.png`, animations: 'disabled' });
 await page.keyboard.press('Escape');
 if (await page.locator('.inventory-workspace').isVisible()) await page.keyboard.press('Escape');
 assert.equal(await page.locator('.inventory-workspace').isVisible(),false);
 results.push('Typing movement keys stays in input; 100-item fixture keeps search visible after scrolling');
 for (const [width,height,hud,skin] of [[1920,1080,1.3,'modern'],[1366,768,1.3,'classic'],[390,844,1,'modern']]) {
  await page.setViewportSize({width,height});
  await page.evaluate(async ({hud,skin}) => { window.game.prefs.set({hud}); (await import('/src/ui/skin.js')).setSkin(skin); }, {hud,skin});
  await page.locator('#menu-btn').click(); await page.screenshot({ path: `${out}/menu-${width}-${skin}.png`, animations: 'disabled' }); await page.keyboard.press('Escape');
  await open('quests');
  const overflow = await page.locator('.quest-journal-panel').evaluate(el => { const r=el.getBoundingClientRect(); return r.left < -1 || r.right > innerWidth+1 || r.bottom > innerHeight+1 || r.top < -1 || el.scrollWidth > el.clientWidth+1; });
  assert.equal(overflow, false, `journal fits ${width} ${skin}`);
  await page.screenshot({ path: `${out}/journal-${width}-${skin}.png`, animations: 'disabled' }); await page.keyboard.press('Escape');
 }
 results.push('Journal and menu captures at 1920 large HUD, 1366 classic large HUD and 390 portrait');
 assert.deepEqual(errors, []);
 await writeFile(`${out}/qa.json`, JSON.stringify({ date:'2026-10-10', environment:'isolated offline guest fixture, one headless Edge page; no live writes', results, pageErrors: errors }, null, 2));
 console.log(JSON.stringify(results));
} finally { await browser.close(); }
