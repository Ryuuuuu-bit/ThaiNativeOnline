import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const root = fileURLToPath(new URL('../../', import.meta.url));
const mode = process.argv[2] ?? 'baseline';
assert.ok(['baseline', 'final', 'raw'].includes(mode), 'Usage: node tools/hunter-dog/capture.mjs [baseline|final|raw] [workspace-relative raw .glb path]');
const base = process.env.TNO_QA_URL || 'http://127.0.0.1:5191';
const rawAsset = mode === 'raw' ? (process.argv[3] ?? process.env.TNO_DOG_RAW_ASSET ?? '').replaceAll('\\', '/').replace(/^\/+/, '') : null;
if (mode === 'raw') assert.ok(rawAsset && !/[:?#]/.test(rawAsset) && !rawAsset.split('/').some(part => part === '..' || part === '.' || part === '') && /\.glb$/i.test(rawAsset),
  'Raw mode requires a workspace-relative .glb path via argv[3] or TNO_DOG_RAW_ASSET');
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.TNO_PLAYWRIGHT_DIR || 'C:/Users/panup/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const output = resolve(root, 'docs/art/reviews/hunter-dog', mode);
const assetRelative = mode === 'raw' ? rawAsset : mode === 'baseline' ? 'artifacts/hunter-dog/baseline.glb' : 'public/models/hunter-dog.glb';
const assetPath = resolve(root, assetRelative), servedAssetPath = `/${assetRelative.replace(/^public\//, '')}`;
const animatorPath = resolve(root, 'src/classes/dog.js');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const beforeAsset = await readFile(assetPath), beforeAnimator = mode === 'raw' ? null : await readFile(animatorPath);
// The original baseline is durable evidence, not a scratch output target.
if (mode === 'baseline') {
  let existing;
  try { existing = await readFile(resolve(output, 'report.json')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  assert.ok(!existing, 'Baseline receipt already exists; preserved unchanged. Use final/raw for subsequent captures.');
}
await mkdir(output, { recursive: true });
const params = new URLSearchParams({ seed: '3334' });
if (mode === 'raw') params.set('raw', servedAssetPath); else params.set('baseline', mode === 'baseline' ? '1' : '0');
const report = { schema: 2, mode, startedAt: new Date().toISOString(), url: `${base}/tools/hunter-dog/review.html?${params}`,
  asset: { localPath: assetPath, bytes: beforeAsset.length, sha256: hash(beforeAsset) },
  animator: mode === 'raw' ? null : { localPath: animatorPath, localSha256: hash(beforeAnimator), semantics: 'current production makeDog controller, including in baseline mode' },
  browser: { headless: true, channel: 'msedge', instances: 1, pages: 1, closed: false },
  images: [], failures: [], assetLoadErrors: [], pageErrors: [], warnings: [],
  limits: [mode === 'raw' ? 'Raw imported static GLB only; no production builder, rig motion, or runtime installation approval.'
    : 'Isolated actual dog builder at CombatView scale .8; no live world/player/combat simulation.',
    'Finite geometry/bone checks are not anatomy, skin strain, planted-foot or terrain approval.',
    ...(mode === 'raw' ? ['Source rotation and scale are preserved; front/side/back are source-axis camera labels, not verified anatomical facing.']
      : ['Saved baseline asset uses the current dog animator; compare animator hashes before treating later captures as the original motion baseline.'])] };
let browser, page;
const pending = new Set();
const persist = async () => {
  const bytes = JSON.stringify(report, null, 2) + '\n';
  for (let attempt = 0; ; attempt++) {
    try { await writeFile(resolve(output, 'report.json'), bytes); return; }
    catch (error) {
      // Windows file watchers can briefly hold the frequently updated receipt.
      if (attempt >= 3 || !['UNKNOWN', 'EBUSY', 'EACCES', 'EPERM'].includes(error.code)) throw error;
      await new Promise(resolve => setTimeout(resolve, 75 * (attempt + 1)));
    }
  }
};
try {
  browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  page = await browser.newPage({ viewport: { width: 1000, height: 930 }, deviceScaleFactor: 1 });
  page.on('pageerror', error => report.pageErrors.push(error.message));
  page.on('requestfailed', request => report.assetLoadErrors.push({ url: request.url(), error: request.failure()?.errorText }));
  page.on('console', message => { if (['warning', 'error'].includes(message.type())) report.warnings.push({ type: message.type(), text: message.text() }); });
  page.on('response', response => {
    const pathname = new URL(response.url()).pathname;
    if (response.status() >= 400) report.assetLoadErrors.push({ url: response.url(), status: response.status() });
    if (pathname !== servedAssetPath && !(report.animator && pathname === '/src/classes/dog.js')) return;
    // Vite may redirect module requests. Only the terminal response has bytes;
    // the separate 200/hash assertion below still pins the rendered GLB.
    if (response.status() >= 300 && response.status() < 400) return;
    const task = response.body().then(bytes => {
      const record = { url: response.url(), status: response.status(), bytes: bytes.length, sha256: hash(bytes) };
      if (pathname === servedAssetPath) report.asset.loadedResponse = record;
      else report.animator.servedModule = record;
    }).catch(error => report.failures.push(`Response provenance failed: ${error.message}`));
    pending.add(task); task.finally(() => pending.delete(task));
  });
  await page.goto(report.url, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForFunction(() => window.hunterDogReview?.ready || window.hunterDogReview?.bootError, null, { timeout: 60000 });
  const bootError = await page.evaluate(() => window.hunterDogReview.bootError);
  assert.ok(!bootError, bootError);
  const modelInfo = await page.evaluate(() => window.hunterDogReview.info());
  if (mode === 'raw') report.raw = modelInfo; else report.production = modelInfo;
  report.assetLoadErrors.push(...(modelInfo.assetErrors ?? []));
  if (mode !== 'raw') {
    report.frameSweep = await page.evaluate(() => window.hunterDogReview.sweepAudit());
    if (!report.frameSweep.passed) report.failures.push(...report.frameSweep.errors);
    report.limits.push('Sweep PASS is a finite/bounds safety result; edge ratios are measured review signals, without anatomy/contact approval.');
    // Sweeps add every sampled extreme to the same camera fit used below.
    report.production = await page.evaluate(() => window.hunterDogReview.info());
    console.log(`Sweeps: ${report.frameSweep.frameCount} frames, ${report.frameSweep.vertexSamples} vertex samples, ${report.frameSweep.edgeSamples} edge samples`);
  }
  const cases = await page.evaluate(() => window.hunterDogReview.cases);
  for (const sample of cases) {
    const receipt = await page.evaluate(sample => window.hunterDogReview.pose(sample), sample);
    if (!receipt.passed) report.failures.push(...receipt.errors.map(error => `${sample.id}: ${error}`));
    const imagePath = resolve(output, `${sample.id}.png`);
    await page.locator('canvas').screenshot({ path: imagePath });
    const png = await readFile(imagePath);
    assert.equal(png.readUInt32BE(16), 960); assert.equal(png.readUInt32BE(20), 720);
    receipt.image = { path: imagePath, width: 960, height: 720, bytes: png.length, sha256: hash(png) };
    report.images.push(receipt);
    await persist();
    console.log(`${report.images.length}/${cases.length} ${sample.id}: ${receipt.boneCount} bones, finite=${receipt.passed}`);
  }
  // Repeat a pose after unrelated poses to witness a fresh controller's reset.
  const first = report.images[0];
  const repeated = await page.evaluate(sample => window.hunterDogReview.pose(sample), first.sample);
  report.repeatability = { sample: first.sample, sameBounds: JSON.stringify(first.bounds) === JSON.stringify(repeated.bounds),
    sameBones: JSON.stringify(first.bones) === JSON.stringify(repeated.bones) };
  if (!report.repeatability.sameBounds || !report.repeatability.sameBones) report.failures.push('Repeated seeded pose differed after other states');
  await Promise.all([...pending]);
  report.asset.afterSha256 = hash(await readFile(assetPath));
  if (report.animator) report.animator.afterLocalSha256 = hash(await readFile(animatorPath));
  if (mode === 'raw' ? !report.raw.rawLoaded : !report.production.sourceLoaded) report.failures.push(mode === 'raw'
    ? 'Raw source missing; no static capture approval' : 'Production asset missing: fallback capture only');
  if (report.asset.loadedResponse?.status !== 200 || report.asset.loadedResponse.sha256 !== report.asset.sha256) report.failures.push('Rendered GLB bytes do not match the intended local source');
  if (report.asset.afterSha256 !== report.asset.sha256 || (report.animator && report.animator.afterLocalSha256 !== report.animator.localSha256)) report.failures.push('Asset or animator changed during capture');
  report.passed = report.failures.length === 0 && report.assetLoadErrors.length === 0 && report.pageErrors.length === 0;
  if (!report.passed) process.exitCode = 1;
} catch (error) { report.failures.push(error.stack ?? String(error)); report.passed = false; process.exitCode = 1; }
finally {
  if (page && !page.isClosed()) await page.evaluate(() => window.hunterDogReview?.shutdown()).catch(() => {});
  if (browser) { await browser.close(); report.browser.closed = true; }
  await Promise.all([...pending]); report.finishedAt = new Date().toISOString();
  await persist();
  console.log(JSON.stringify({ mode, passed: report.passed, images: report.images.length, failures: report.failures, assetLoadErrors: report.assetLoadErrors, browserClosed: report.browser.closed, report: resolve(output, 'report.json') }));
}
