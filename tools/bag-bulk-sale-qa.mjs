// Isolated real UI fixture; never connects to accounts or sells real items.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'vite';

const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); }
catch { pw = require('C:/Users/panup/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'); }
const out = 'docs/art/bag-bulk-sale';
await mkdir(out, { recursive: true });
const source = await readFile('index.html', 'utf8');
const shopHtml = source.match(/<section id="shop"[\s\S]*?<\/section>/)[0];
const receipt = { passed: false, checks: [], failures: [], bounds: [], screenshots: [], errors: [], transport: 'sellBatch and save stubbed; no account, server or WebGL session' };
const server = await createServer({ configFile: false, root: process.cwd(), server: { host: '127.0.0.1', port: 5197, strictPort: true, hmr: false, watch: { ignored: ['**/*'] } } });
let browser;
try {
  await server.listen();
  browser = await pw.chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 }, hasTouch: true });
  page.setDefaultTimeout(15000);
  page.on('pageerror', e => receipt.errors.push(e.message));
  page.on('console', msg => { if (msg.type() === 'error') receipt.errors.push(msg.text()); });
  // Vite CSS modules need style insertion, but this frozen fixture needs no
  // dev-client websocket (Edge blocks that connection under local-network policy).
  await page.route('**/@vite/client', route => route.fulfill({ contentType: 'text/javascript', body: `
    export function updateStyle(id, css) { let s = document.querySelector('style[data-qa-id="' + CSS.escape(id) + '"]'); if (!s) { s = document.createElement('style'); s.dataset.qaId = id; document.head.append(s); } s.textContent = css; }
    export function removeStyle(id) { document.querySelector('style[data-qa-id="' + CSS.escape(id) + '"]')?.remove(); }
    export function createHotContext() { return { accept(){}, prune(){}, dispose(){}, on(){}, invalidate(){}, data:{} }; }
    export function injectQuery(url) { return url; }
  ` }));
  await page.route('**/tools/bag-bulk-sale-fixture.html', route => route.fulfill({ contentType: 'text/html', body: `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><div id="app"><div class="g-layer" id="fixture"></div>${shopHtml}</div>` }));
  const check = async (name, fn) => {
    try { await fn(); receipt.checks.push(name); }
    catch (e) { receipt.failures.push({ name, error: e.message }); console.error(`FAIL ${name}: ${e.message}`); }
  };
  const shot = async name => { const path = `${out}/${name}.png`; await page.screenshot({ path }); receipt.screenshots.push(path); };
  const bounds = async (label, selectors, width, height) => {
    const values = await page.evaluate(selectors => selectors.map(selector => {
      const el = document.querySelector(selector); if (!el) return { selector, missing: true };
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const hit = document.elementFromPoint(cx, cy);
      return { selector, x: r.x, y: r.y, width: r.width, height: r.height, clientHeight: el.clientHeight, scrollHeight: el.scrollHeight, overflowY: getComputedStyle(el).overflowY, centerReachable: !!hit && (el === hit || el.contains(hit)) };
    }), selectors);
    receipt.bounds.push({ label, viewport: { width, height }, values });
    for (const r of values) assert.ok(!r.missing && r.width > 0 && r.height > 0 && r.x >= -1 && r.y >= -1 && r.x + r.width <= width + 1 && r.y + r.height <= height + 1 && r.centerReachable, `${label} ${r.selector}: ${JSON.stringify(r)}`);
  };
  for (const [width, height] of [[1366, 768], [1920, 1080], [390, 844]]) {
    await page.setViewportSize({ width, height });
    await page.goto('http://127.0.0.1:5197/tools/bag-bulk-sale-fixture.html');
    await page.evaluate(async mobile => {
      for (const css of ['/src/style.css', '/src/ui/theme.css', '/src/ui/layout.css', '/src/ui/dynamic-hud.css', '/src/ui/touch.css', '/src/ui/mobile-hud.css', '/src/net/net.css']) await import(css);
      const { Character } = await import('/src/character/Character.js');
      const { CharacterUI } = await import('/src/character/ui/CharacterUI.js');
      const { ShopPanel } = await import('/src/ui/ShopPanel.js');
      const { sellPrice } = await import('/src/shop/ShopSystem.js');
      const { rollEquipment } = await import('/src/character/data/affixes.js');
      document.body.classList.add('hud-dynamic'); document.body.classList.toggle('ui-touch', mobile);
      const c = Character.create('Bag QA', 'warrior'); c.gold = 12345;
      const ids = ['potion_s', 'potion_m', 'hide', 'tusk', 'iron_dap'];
      c.inventory = Array.from({ length: 500 }, (_, i) => ({ id: ids[i % ids.length], qty: i % 5 === 4 ? 1 : 3, ...(i % 37 === 0 ? { locked: true } : {}) }));
      const enhanced = { id: 'iron_dap', qty: 1, plus: 10, cards: ['card_boar', 'card_boar'], roll: rollEquipment('iron_dap', { level: 100, random: () => .99 }) };
      c.inventory[499] = enhanced;
      const ui = new CharacterUI(document.querySelector('#fixture'), c, { log() {}, banner() {} }); ui.toggle('bag');
      const shop = new ShopPanel(() => {});
      window.qa = { c, ui, shop, sellPrice, enhanced, sent: [], saved: 0 };
      c.sellBatch = lines => { qa.sent.push(structuredClone(lines)); return lines.reduce((n, l) => n + sellPrice(c.inventory[l.index].id) * l.qty, 0); };
      c.save = () => { qa.saved++; };
    }, width < 901);
    const suffix = `${width}x${height}`;
    await check(`500 occupied ${suffix}`, async () => {
      assert.equal(await page.locator('.g-grid .g-slot').count(), 500);
      assert.match(await page.locator('.g-bag-count').innerText(), /500 \/ 500/);
      await bounds('bag top ' + suffix, width > 900 ? ['.inventory-workspace', '.g-bag-search', '.g-bag-count'] : ['.inventory-workspace', '.g-bag-search'], width, height);
    });
    await shot(`bag-500-${suffix}-top`);
    await check(`slot 499 detail and grid end ${suffix}`, async () => {
      const before = await page.evaluate(() => JSON.stringify(qa.c.inventory));
      if (width < 901) await page.locator('.g-slot[data-index="499"]').tap();
      else await page.locator('.g-slot[data-index="499"]').click();
      assert.match(await page.locator('.g-bag .iw-item-card .iw-item-name').innerText(), /\+10/);
      assert.equal(await page.evaluate(() => JSON.stringify(qa.c.inventory)), before);
      await page.locator('.g-bag [data-item-action="lock"]').scrollIntoViewIfNeeded();
      await bounds('bag actions ' + suffix, ['.g-bag [data-item-action="lock"]'], width, height);
      await page.mouse.move(0, 0); await shot(`bag-500-${suffix}-actions`);
      await page.locator('.g-slot[data-index="499"]').scrollIntoViewIfNeeded();
      if (width < 901) {
        // Browser nearest-scroll does not account for the sticky category/search
        // header. Verify the player can reveal the last row with real scroll input.
        const columns = await page.locator('.iw-columns').boundingBox();
        await page.mouse.move(columns.x + columns.width - 5, Math.min(height - 100, columns.y + columns.height - 40));
        const delta = await page.evaluate(() => document.querySelector('.g-slot[data-index="499"]').getBoundingClientRect().top - document.querySelector('.iw-bag-controls').getBoundingClientRect().bottom - 12);
        await page.mouse.wheel(0, delta);
        await page.waitForTimeout(200);
      }
      await bounds('bag end ' + suffix, ['.g-slot[data-index="499"]'], width, height);
      if (width > 900) await bounds('PC persistent bag controls ' + suffix, ['.g-bag-search', '.g-bag-count', '.g-bag .iw-detail', '.g-grid'], width, height);
    });
    await page.mouse.move(0, 0); await shot(`bag-500-${suffix}-last`);
    await check(`sparse bag preserves indexes and caps nodes ${suffix}`, async () => {
      await page.evaluate(() => { qa.ui.workspace.close(); qa.c.inventory = Array(500).fill(null); for (const i of [0, 25, 250, 499]) qa.c.inventory[i] = { id: 'potion_s', qty: 3 }; qa.ui.refreshInventory(); qa.ui.toggle('bag'); });
      assert.equal(await page.locator('.g-grid .g-slot:not(.empty)').count(), 4);
      assert.ok(await page.locator('.g-grid .g-slot').count() <= 32);
      assert.deepEqual(await page.locator('.g-grid .g-slot:not(.empty)').evaluateAll(es => es.map(e => +e.dataset.index)), [0, 25, 250, 499]);
      await page.locator('.g-bag-search').fill('ยาหม้อเล็ก');
      assert.equal(await page.locator('.g-grid .empty').count(), 0);
      assert.equal(await page.locator('.g-slot[data-index="499"]').count(), 1);
      await page.locator('.g-bag-search').fill('');
      await shot(`bag-sparse-${suffix}`);
    });
    await page.evaluate(() => {
      qa.ui.workspace.close();
      const ids = ['potion_s', 'potion_m', 'hide', 'tusk', 'iron_dap'];
      qa.c.inventory = Array.from({ length: 500 }, (_, i) => ({ id: ids[i % 5], qty: i % 5 === 4 ? 1 : 3, ...(i % 37 === 0 ? { locked: true } : {}) }));
      qa.c.inventory[499] = structuredClone(qa.enhanced);
      qa.shop.show({ def: { shopType: 'herbalist', name: 'QA Vendor' } }, qa.c);
    });
    await page.locator('[data-shop-tab="sell"]').click();
    await check(`filtered select all excludes locks ${suffix}`, async () => {
      await page.locator('[data-filter="use"]').click(); await page.locator('#shop-search').fill('ยาหม้อเล็ก');
      const expected = await page.locator('[data-pick]:not(:disabled)').evaluateAll(es => es.map(e => +e.dataset.pick));
      assert.ok(expected.some(i => i > 24));
      await page.locator('[data-sale-all]').click();
      assert.deepEqual(await page.evaluate(() => qa.shop.basket.lines().map(l => l.index)), expected);
      assert.ok(await page.locator('[data-pick]:disabled').count() > 0);
      assert.equal(await page.locator('[data-pick]:disabled[aria-pressed="true"]').count(), 0);
      assert.equal(await page.locator('[data-sale-all]').isDisabled(), true);
      await shot(`sale-filtered-${suffix}`);
      await page.locator('[data-sale-clear]').click();
      assert.equal(await page.evaluate(() => qa.shop.basket.lines().length), 0);
      assert.equal(await page.locator('[data-sale-submit]').isDisabled(), true);
    });
    await check(`dense sale basket bounds and end ${suffix}`, async () => {
      await page.locator('#shop-search').fill(''); await page.locator('[data-filter=""]').click();
      await page.locator('[data-sale-all]').click();
      assert.equal(await page.evaluate(() => qa.shop.basket.lines().length), 486);
      await page.locator('[data-pick="499"]').scrollIntoViewIfNeeded();
      await bounds('sale end ' + suffix, ['[data-pick="499"]'], width, height);
      const icon = await page.locator('[data-pick="499"]').evaluate(row => {
        const rect = el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; };
        return { holder: rect(row.querySelector('.sh-ic')), image: rect(row.querySelector('.icon-img')), text: rect(row.querySelector('.sh-tx')), headerBackground: getComputedStyle(document.querySelector('.sh-sale-tools')).backgroundColor };
      });
      receipt.bounds.push({ label: 'sale icon ' + suffix, ...icon });
      assert.ok(icon.image.x >= icon.holder.x - 1 && icon.image.y >= icon.holder.y - 1 && icon.image.x + icon.image.width <= icon.holder.x + icon.holder.width + 1 && icon.image.y + icon.image.height <= icon.holder.y + icon.holder.height + 1 && icon.image.x + icon.image.width <= icon.text.x + 1, `sale icon overlap: ${JSON.stringify(icon)}`);
      await page.locator('[data-sale-qty="499"]').scrollIntoViewIfNeeded();
      await bounds('basket end ' + suffix, ['[data-sale-qty="499"]'], width, height);
      await page.locator('[data-sale-submit]').scrollIntoViewIfNeeded();
      await bounds('sale totals and actions ' + suffix, ['#shop', '.sh-basket .sh-total', '.sh-after', '[data-sale-submit]', '[data-sale-clear]'], width, height);
    });
    await shot(`sale-500-${suffix}`);
    await check(`review then confirm one safe stub batch ${suffix}`, async () => {
      const expected = await page.evaluate(() => qa.shop.basket.lines());
      assert.ok(expected.length > 0);
      await page.locator('[data-sale-submit]').click();
      assert.equal(await page.evaluate(() => qa.sent.length), 0);
      assert.equal(await page.evaluate(() => qa.shop.confirmSale), true);
      assert.match(await page.locator('[data-sale-submit]').innerText(), /ยืนยันขาย/);
      await page.locator('[data-sale-submit]').click();
      assert.deepEqual(await page.evaluate(() => qa.sent), [expected]);
      assert.equal(await page.evaluate(() => qa.saved), 1);
      assert.equal(await page.evaluate(() => qa.shop.basket.lines().length), 0);
    });
    await check(`newly locked basket line invalidated ${suffix}`, async () => {
      await page.evaluate(() => { qa.shop.basket.set(499, 1); qa.c.inventory[499].locked = true; qa.shop.render(); });
      assert.equal(await page.evaluate(() => qa.shop.basket.lines().length), 0);
      assert.equal(await page.locator('[data-sale-submit]').isDisabled(), true);
    });
  }
  assert.equal(await page.locator('canvas').count(), 0);
  receipt.passed = receipt.failures.length === 0 && receipt.errors.length === 0;
} catch (e) { receipt.failures.push({ name: 'fixture execution', error: e.stack }); }
finally {
  await browser?.close(); await server.close();
  await writeFile(`${out}/verification.json`, JSON.stringify(receipt, null, 2) + '\n');
}
console.log(`Bag/bulk sale QA: ${receipt.checks.length} passed, ${receipt.failures.length} failed, ${receipt.errors.length} browser errors`);
if (!receipt.passed) process.exitCode = 1;
