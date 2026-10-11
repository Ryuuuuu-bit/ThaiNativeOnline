// Publish only a complete, individually generated and packaged reference set.
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { MONSTERS } from '../../src/combat/data/monsters.js';
import { MONSTER_MODELS } from '../../src/combat/MonsterModels.js';

const read = path => readFile(new URL(`../../${path}`, import.meta.url));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const spec = JSON.parse(await readFile(new URL('./spec.json', import.meta.url)));
const captured = JSON.parse(await read('artifacts/card-model-references/manifest.json'));
assert.equal(captured.complete, true);
assert.equal(captured.browser.closed, true);
assert.deepEqual(captured.errors, []);
assert.deepEqual(spec.entries.map(e => e.id).sort(), Object.keys(MONSTER_MODELS).sort());
const references = [], hashes = new Set();
let portraitBytes = 0, iconBytes = 0;
for (const entry of spec.entries) {
  const ref = captured.entries.find(ref => ref.id === entry.id);
  assert.equal(ref.origin, 'production-glb', `${entry.id}: designed model required by user`);
  assert.ok(MONSTERS[entry.id]);
  assert.deepEqual(ref.modelSpec, MONSTER_MODELS[entry.id]);
  const receipt = JSON.parse(await readFile(new URL(`./receipts/${entry.id}.json`, import.meta.url)));
  assert.equal(receipt.provider, 'built-in-imagegen');
  assert.equal(receipt.id, entry.id);
  assert.equal(receipt.referenceSha256, ref.image.sha256);
  assert.equal(sha(await read(entry.reference)), ref.image.sha256);
  assert.equal(receipt.origin, ref.origin);
  for (const source of ref.sources) {
    assert.equal(source.loaded, true, `${entry.id}: model loaded`);
    assert.equal(sha(await read(`public${source.url}`)), source.localSha256, `${entry.id}: captured source still current`);
  }
  for (const [kind, limit, width, height] of [['image', 90000, 384, 480], ['icon', 9000, 96, 120]]) {
    const result = receipt[kind], bytes = await read(entry[kind]);
    assert.equal(result.path, entry[kind]);
    assert.equal(result.width, width); assert.equal(result.height, height);
    assert.equal(result.bytes, bytes.length); assert.ok(bytes.length <= limit, `${entry.id}: ${kind} budget`);
    assert.equal(result.sha256, sha(bytes));
    assert.ok(!hashes.has(result.sha256), `${entry.id}: distinct ${kind}`); hashes.add(result.sha256);
    if (kind === 'image') portraitBytes += bytes.length; else iconBytes += bytes.length;
  }
  references.push({ id: entry.id, name: ref.name, origin: ref.origin,
    fallbackShape: ref.fallbackShape, fallbackLook: ref.fallbackLook, worldScale: ref.worldScale,
    modelSpec: ref.modelSpec, image: { ...ref.image, path: entry.reference },
    sources: ref.sources.map(source => ({ kind: source.kind, url: source.url, sha256: source.localSha256 })) });
}
const registry = '// Individual card art painted from each production monster model reference.\n' +
  'export const CARD_ILLUSTRATIONS = {\n' + spec.entries.map(entry =>
    `  ${entry.id}: { image: '${entry.image.replace(/^public\//, '')}', icon: '${entry.icon.replace(/^public\//, '')}' },`).join('\n') + '\n};\n';
await writeFile(new URL('../../src/character/data/card-illustrations.js', import.meta.url), registry);
await writeFile(new URL('./reference-manifest.json', import.meta.url), JSON.stringify({ schema: 1,
  capturedAt: captured.finishedAt, builder: captured.builder,
  scope: 'Designed production GLB models only; user excludes procedural fallback creatures.',
  origins: { 'production-glb': references.length }, capturedOrigins: captured.origins,
  browser: captured.browser, errors: captured.errors, warnings: captured.warnings,
  budgets: { portrait: 90000, icon: 9000 }, totals: { count: references.length, portraitBytes, iconBytes },
  entries: references }, null, 2) + '\n');
console.log(JSON.stringify({ registered: references.length, portraitBytes, iconBytes, origins: captured.origins }));
