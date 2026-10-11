import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.TNO_PLAYWRIGHT_DIR || 'C:/Users/panup/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const base = process.env.TNO_QA_URL || 'http://127.0.0.1:5186';
const output = resolve('artifacts/card-model-references');
await mkdir(output, { recursive: true });
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const manifest = {
  schema: 1, startedAt: new Date().toISOString(), sourcePage: `${base}/tools/card-model-reference.html`,
  builder: 'makeMonsterFallback(MONSTERS[id]) + makeMonsterModel; direct uncached GLTF loads',
  image: { width: 600, height: 750, view: 'three-quarter front', labels: false },
  browser: { channel: 'msedge', headless: true, instances: 1, pages: 1, closed: false },
  entries: [], errors: [], warnings: [],
};
const saveManifest = () => writeFile(resolve(output, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
let browser, page;
const network = new Map(), pending = new Set();
try {
  browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  page = await browser.newPage({ viewport: { width: 600, height: 750 }, deviceScaleFactor: 1 });
  page.on('pageerror', error => manifest.errors.push({ kind: 'pageerror', message: error.message }));
  page.on('console', message => {
    if (['warning', 'error'].includes(message.type())) manifest.warnings.push({ kind: message.type(), message: message.text() });
  });
  page.on('response', response => {
    if (!new URL(response.url()).pathname.endsWith('.glb')) return;
    const task = (async () => {
      const bytes = await response.body();
      network.set(response.url(), { status: response.status(), bytes: bytes.length, sha256: sha(bytes) });
    })().catch(error => manifest.errors.push({ kind: 'asset-provenance', url: response.url(), message: error.message }));
    pending.add(task); task.finally(() => pending.delete(task));
  });
  await page.goto(manifest.sourcePage, { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForFunction(() => window.cardModelReference?.ready, null, { timeout: 30000 });
  const catalog = await page.evaluate(() => window.cardModelReference.catalog);
  assert.equal(catalog.length, 65, 'Capture all 65 production monster definitions');
  assert.equal(new Set(catalog.map(c => c.id)).size, 65);
  manifest.catalog = catalog;
  const first = ['boar', 'cobra', 'krasue', 'chalawan'];
  const order = [...first, ...catalog.map(c => c.id).filter(id => !first.includes(id))];
  for (const id of order) {
    const record = await page.evaluate(async id => {
      let timeout;
      try {
        return await Promise.race([
          window.cardModelReference.prepare(id),
          new Promise((_, reject) => { timeout = setTimeout(() => reject(Error(`Timed out loading ${id}`)), 45000); }),
        ]);
      } finally { clearTimeout(timeout); }
    }, id);
    await Promise.all([...pending]);
    for (const source of record.sources) {
      source.network = network.get(source.resolvedUrl) ?? null;
      if (source.loaded) {
        assert.equal(source.network?.status, 200, `${id}: source response successful`);
        const local = await readFile(resolve('public', source.url.replace(/^\//, '')));
        source.localSha256 = sha(local);
        assert.equal(source.network.sha256, source.localSha256, `${id}: captured model bytes match current public asset`);
      }
    }
    const file = resolve(output, `${id}.png`);
    await page.locator('canvas').screenshot({ path: file, animations: 'allow' });
    const png = await readFile(file);
    assert.equal(png.readUInt32BE(16), 600);
    assert.equal(png.readUInt32BE(20), 750);
    record.image = { path: file.replaceAll('\\', '/'), bytes: png.length, sha256: sha(png), width: 600, height: 750 };
    record.memoryAfterRelease = await page.evaluate(() => window.cardModelReference.release());
    manifest.entries.push(record);
    network.clear();
    await saveManifest();
    console.log(`${manifest.entries.length}/65 ${id}: ${record.origin} -> ${file}`);
    if (manifest.entries.length === 4) console.log('FIRST FOUR READY: boar, cobra, krasue, chalawan');
  }
  manifest.complete = manifest.entries.length === 65 && manifest.errors.length === 0;
} catch (error) {
  manifest.errors.push({ kind: 'capture', message: error.stack || String(error) });
  process.exitCode = 1;
} finally {
  if (page && !page.isClosed()) await page.evaluate(() => window.cardModelReference?.shutdown()).catch(() => {});
  if (browser) { await browser.close(); manifest.browser.closed = true; }
  await Promise.all([...pending]);
  manifest.finishedAt = new Date().toISOString();
  manifest.count = manifest.entries.length;
  manifest.origins = Object.fromEntries(['production-glb', 'production-fallback'].map(origin => [origin, manifest.entries.filter(e => e.origin === origin).length]));
  await saveManifest();
  console.log(JSON.stringify({ count: manifest.count, origins: manifest.origins, errors: manifest.errors, browserClosed: manifest.browser.closed, manifest: resolve(output, 'manifest.json') }));
}
