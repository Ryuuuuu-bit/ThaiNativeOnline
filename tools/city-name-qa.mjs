// Real index HUD + map/brand components; deliberately never imports main/Game/accounts.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'vite';

const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); }
catch { pw = require('C:/Users/panup/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'); }
const out = 'docs/art/forgotten-city';
await mkdir(out, { recursive: true });
const html = (await readFile('index.html', 'utf8')).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
const expected = 'นครที่ถูกลืมเลือน';
const result = { passed: false, name: expected, checks: [], failures: [], bounds: [], errors: [], screenshots: [], scope: 'real index, HUD.setRegion, WorldMapPanel.setMap, MAPS.city, loadingMarkup; no renderer, accounts or game loop' };
const server = await createServer({ configFile: false, root: process.cwd(), server: { host: '127.0.0.1', port: 5198, strictPort: true, hmr: false, watch: { ignored: ['**/*'] } } });
let browser;
try {
  await server.listen();
  browser = await pw.chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 }, hasTouch: true, reducedMotion: 'reduce' });
  page.setDefaultTimeout(15000);
  page.on('pageerror', e => result.errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') result.errors.push(m.text()); });
  await page.route('**/tools/city-name-fixture.html', r => r.fulfill({ contentType: 'text/html', body: html }));
  await page.route('**/@vite/client', r => r.fulfill({ contentType: 'text/javascript', body: `
    export function updateStyle(id, css) { let s = document.querySelector('style[data-qa-id="' + CSS.escape(id) + '"]'); if (!s) { s = document.createElement('style'); s.dataset.qaId = id; document.head.append(s); } s.textContent = css; }
    export function removeStyle(id) { document.querySelector('style[data-qa-id="' + CSS.escape(id) + '"]')?.remove(); }
    export function createHotContext() { return { accept(){}, prune(){}, dispose(){}, on(){}, invalidate(){}, data:{} }; }
    export function injectQuery(url) { return url; }
  ` }));
  const check = async (name, fn) => {
    try { await fn(); result.checks.push(name); }
    catch (e) { result.failures.push({ name, error: e.message }); console.error(`FAIL ${name}: ${e.message}`); }
  };
  const capture = async name => { const path = `${out}/${name}.png`; await page.screenshot({ path }); result.screenshots.push(path); };
  const inspect = async (label, selector, container, width, height, fullText = true) => {
    const measured = await page.evaluate(({ selector, container }) => {
      const el = document.querySelector(selector), host = document.querySelector(container);
      const rect = node => { const r = node.getBoundingClientRect(); return { x:r.x, y:r.y, width:r.width, height:r.height }; };
      const range = document.createRange(); range.selectNodeContents(el);
      const style = getComputedStyle(el);
      return { selector, container, text: el.textContent.trim(), box: rect(el), host: rect(host), textRects: [...range.getClientRects()].map(r => ({ x:r.x, y:r.y, width:r.width, height:r.height })), clientWidth:el.clientWidth, scrollWidth:el.scrollWidth, fontSize:style.fontSize, whiteSpace:style.whiteSpace, overflow:style.overflow, textOverflow:style.textOverflow, hostClientWidth:host.clientWidth, hostScrollWidth:host.scrollWidth };
    }, { selector, container });
    result.bounds.push({ label, viewport:{ width,height }, ...measured });
    const r = measured.box;
    assert.ok(r.width > 0 && r.height > 0 && r.x >= -1 && r.y >= -1 && r.x+r.width <= width+1 && r.y+r.height <= height+1, `${selector} outside viewport: ${JSON.stringify(measured)}`);
    if (fullText) {
      assert.ok(measured.clientWidth === 0 || measured.scrollWidth <= measured.clientWidth + 1, `${selector} clips text: ${JSON.stringify(measured)}`);
      for (const t of measured.textRects) assert.ok(t.x >= measured.host.x-1 && t.y >= measured.host.y-1 && t.x+t.width <= measured.host.x+measured.host.width+1 && t.y+t.height <= measured.host.y+measured.host.height+1, `${selector} text outside ${container}: ${JSON.stringify(measured)}`);
    }
    return measured;
  };
  for (const [width, height] of [[1366,768], [390,844]]) {
    await page.setViewportSize({ width,height });
    await page.goto('http://127.0.0.1:5198/tools/city-name-fixture.html');
    await page.evaluate(async mobile => {
      for (const css of ['/src/style.css','/src/ui/theme.css','/src/ui/layout.css','/src/ui/icon-theme.css','/src/ui/skin-classic.css','/src/ui/dynamic-hud.css','/src/ui/brand.css','/src/ui/touch.css','/src/ui/mobile-hud.css','/src/ui/thumb-combat.css','/src/ui/world-map.css','/src/net/net.css']) await import(css);
      const { MAPS } = await import('/src/world/maps.js');
      const { HUD } = await import('/src/ui/HUD.js');
      const { WorldMapPanel } = await import('/src/ui/WorldMapPanel.js');
      const { mountEntryBrand, loadingMarkup } = await import('/src/ui/Brand.js');
      document.body.classList.add('game-on','hud-dynamic'); document.body.classList.toggle('ui-touch',mobile);
      mountEntryBrand();
      const map = MAPS.city;
      const hud = new HUD(); hud.setRegion({ id:map.id, name:map.name, sub:map.sub, safety:'safe' });
      document.querySelector('#mini-name').textContent = map.name;
      document.querySelector('#mini-sub').textContent = map.sub;
      document.querySelector('#mini-ch').hidden = false;
      const mm = { directory:[], zoomFull(){}, resetFull(){}, focusFull(){} };
      const atlas = new WorldMapPanel(document.querySelector('#fullmap-panel'), { minimap:()=>mm, player:()=>({x:0,z:0}), npcs:()=>[], walk(){}, changed(){} });
      atlas.setMap(map);
      const loading = document.querySelector('#loading'); loading.innerHTML = loadingMarkup(); loading.hidden = true;
      window.cityQA = { map,hud,atlas };
    }, width < 901);
    await page.evaluate(() => document.fonts.ready);
    const suffix = `${width}x${height}`;
    await check(`city data and HUD labels ${suffix}`, async () => {
      assert.equal(await page.evaluate(() => cityQA.map.name), expected);
      assert.equal(await page.locator('#region-name').innerText(), expected);
      assert.equal(await page.title(), `Thai Native Online — ${expected}`);
      await inspect('location '+suffix, '#region-name', '.location', width,height);
      assert.equal(await page.locator('#mini-name').textContent(), expected);
      if (width > 900) {
        await inspect('mini title '+suffix, '#mini-name', '.mini-title', width,height);
        await inspect('mini channel '+suffix, '#mini-ch', '.mini-title', width,height);
        const name = await page.locator('#mini-name').boundingBox(), channel = await page.locator('#mini-ch').boundingBox();
        assert.ok(name.x+name.width <= channel.x+1 || name.y+name.height <= channel.y+1,'mini title does not overlap CH 1');
      } else assert.equal(await page.locator('#mini-name').isVisible(),false,'touch minimap intentionally hides map name; location pill supplies it');
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
      assert.equal(overflow,false,'HUD has no document horizontal overflow');
    });
    await capture(`hud-${suffix}`);
    await page.evaluate(() => { document.querySelector('#fullmap-panel').hidden=false; });
    await check(`atlas city header ${suffix}`, async () => {
      assert.equal(await page.locator('#map-title').innerText(), expected);
      assert.ok((await page.locator('.atlas-heading small').innerText()).includes(expected));
      await inspect('atlas panel '+suffix, '#fullmap-panel', '#fullmap-panel', width,height,false);
      await inspect('atlas title '+suffix, '#map-title', '.atlas-heading', width,height);
      await inspect('atlas close '+suffix, '#fullmap-close', '.atlas-heading', width,height);
      const h = await page.locator('#map-title').boundingBox(), c = await page.locator('#fullmap-close').boundingBox();
      assert.ok(h.x+h.width <= c.x+1 || h.y+h.height <= c.y+1 || c.y+c.height <= h.y+1,'atlas title does not overlap close button');
    });
    await capture(`atlas-${suffix}`);
    await page.evaluate(() => { document.querySelector('#fullmap-panel').hidden=true; document.querySelector('#loading').hidden=false; });
    await check(`real loading title ${suffix}`, async () => {
      assert.equal(await page.locator('[data-loading-title]').innerText(), expected);
      await inspect('loading title '+suffix, '[data-loading-title]', '.tno-loading-content', width,height);
      await inspect('loading content '+suffix, '.tno-loading-content', '#loading', width,height,false);
      assert.equal(await page.locator('#loading').innerText().then(t => /อโยธยา/.test(t)), false);
    });
    await capture(`loading-${suffix}`);
  }
  result.passed = result.failures.length===0 && result.errors.length===0;
} catch(e) { result.failures.push({ name:'fixture execution',error:e.stack }); }
finally { await browser?.close(); await server.close(); await writeFile(`${out}/verification.json`, JSON.stringify(result,null,2)+'\n'); }
console.log(`City name QA: ${result.checks.length} passed, ${result.failures.length} failed, ${result.errors.length} browser errors`);
if (!result.passed) process.exitCode=1;
