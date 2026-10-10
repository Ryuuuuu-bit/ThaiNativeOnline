// Optional isolated UI check. Requires an existing browser CDP endpoint; never
// launches a browser or a game/WebGL session. Run with CDP_URL and TNO_QA_URL.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
assert.ok(process.env.CDP_URL, 'CDP_URL must identify an existing browser');
const base = process.env.TNO_QA_URL || 'http://127.0.0.1:5192';
const browser = await chromium.connectOverCDP(process.env.CDP_URL);
const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
try {
  const page = await context.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.route(`${base}/inventory-workspace-fixture`, route => route.fulfill({ contentType: 'text/html', body: `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{margin:0;background:#12251e;font-family:sans-serif}</style></head><body><div class="g-layer" id="fixture"></div><script type="module">
    import '/src/ui/layout.css';
    import { Character } from '/src/character/Character.js';
    import { CharacterUI } from '/src/character/ui/CharacterUI.js';
    const c = Character.create('Inventory QA', 'warrior'); c.refine.weapon = 10; c.equipmentLocks.weapon = true;
    c.addItem('iron_dap'); c.addItem('potion_s', 5);
    const ui = new CharacterUI(document.querySelector('#fixture'), c, {log(){},banner(){}}); ui.toggle('sheet');
    window.inventoryQA = { c, ui };
  </script></body></html>` }));
  await page.goto(`${base}/inventory-workspace-fixture`);
  await page.waitForFunction(() => !!window.inventoryQA);
  const weapon = page.locator('.g-eqs>button[data-slot="weapon"]');
  const before = await page.locator('.g-sheet').evaluate(e => e.scrollTop);
  await weapon.click();
  assert.equal(await page.locator('.g-sheet').evaluate(e => e.scrollTop), before, 'worn selection must not scroll character');
  assert.equal(await page.locator('.g-bag [data-item-action="unequip"]').count(), 1);
  assert.equal(await weapon.getAttribute('title'), null);
  await page.mouse.move(10, 10); await weapon.hover();
  await page.waitForTimeout(350);
  assert.equal(await page.locator('.iw-tooltip').isVisible(), true, 'styled equipment tooltip must persist after hover');
  // Reproduce a scroll notification arriving after pointerover.
  await page.locator('.g-sheet').evaluate(e => e.dispatchEvent(new Event('scroll')));
  await page.waitForTimeout(350);
  assert.equal(await page.locator('.iw-tooltip').isVisible(), true, 'visible anchor survives scroll notification');
  const refine = await weapon.locator('.g-plus').evaluate(e => {
    const s = getComputedStyle(e), r = e.getBoundingClientRect();
    return { font: parseFloat(s.fontSize), background: s.backgroundColor, rect: {left:r.left,right:r.right,top:r.top,bottom:r.bottom} };
  });
  assert.ok(refine.font >= 12); assert.notEqual(refine.background, 'rgba(0, 0, 0, 0)');
  const lock = await page.locator('.g-eqs:has([data-slot="weapon"]) .g-equip-lock').boundingBox();
  assert.ok(lock.x + lock.width <= refine.rect.left || lock.y + lock.height <= refine.rect.top || lock.x >= refine.rect.right || lock.y >= refine.rect.bottom, 'lock and refine badges must not overlap');
  if (process.env.QA_SCREENSHOT) await page.screenshot({ path: process.env.QA_SCREENSHOT });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(() => !window.inventoryQA.ui.workspace.desktop);
  await page.locator('.iw-worn-detail [data-item-action="unequip"]').waitFor({ state: 'visible' });
  assert.equal(await page.locator('.iw-worn-detail [data-item-action="unequip"]').count(), 1);
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.waitForFunction(() => window.inventoryQA.ui.workspace.desktop);
  await page.locator('.g-bag [data-item-action="unequip"]').waitFor({ state: 'visible' });
  assert.equal(await page.locator('.g-bag [data-item-action="unequip"]').count(), 1);
  assert.equal(await page.locator('canvas').count(), 0);
  assert.deepEqual(errors, []);
  console.log('PASS: desktop character stays visible; hover tooltip persists (350ms + scroll); +10 >=12px; lock does not overlap; resize preserves worn actions; zero canvases/page errors.');
} finally {
  await context.close(); await browser.close();
}
