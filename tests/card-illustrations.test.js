import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { CARD_ILLUSTRATIONS } from '../src/character/data/card-illustrations.js';
import { CARD_ITEMS } from '../src/character/data/cards.js';
import { MONSTERS } from '../src/combat/data/monsters.js';
import { MONSTER_MODELS } from '../src/combat/MonsterModels.js';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url));
const manifest = JSON.parse(read('tools/card-art/reference-manifest.json'));
const spec = JSON.parse(read('tools/card-art/spec.json'));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
function dimensions(bytes) {
  assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
  assert.equal(bytes.toString('ascii', 8, 12), 'WEBP');
  assert.equal(bytes.readUInt32LE(4) + 8, bytes.length);
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const type = bytes.toString('ascii', offset, offset + 4), size = bytes.readUInt32LE(offset + 4), start = offset + 8;
    if (type === 'VP8X') return [bytes.readUIntLE(start + 4, 3) + 1, bytes.readUIntLE(start + 7, 3) + 1];
    if (type === 'VP8 ') {
      assert.equal(bytes.toString('hex', start + 3, start + 6), '9d012a');
      return [bytes.readUInt16LE(start + 6) & 0x3fff, bytes.readUInt16LE(start + 8) & 0x3fff];
    }
    if (type === 'VP8L') {
      assert.equal(bytes[start], 0x2f);
      const bits = bytes.readUInt32LE(start + 1);
      return [(bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1];
    }
    offset = start + size + (size % 2);
  }
  throw Error('No WebP dimensions');
}

test('only the 31 designed production models get new card art', () => {
  const ids = Object.keys(MONSTER_MODELS).sort();
  assert.equal(ids.length, 31);
  assert.deepEqual(Object.keys(CARD_ILLUSTRATIONS).sort(), ids);
  assert.deepEqual(manifest.entries.map(ref => ref.id).sort(), ids);
  assert.deepEqual(spec.entries.map(entry => entry.id).sort(), ids);
  assert.equal(manifest.browser.closed, true);
  assert.deepEqual(manifest.errors, []);
  assert.deepEqual(manifest.origins, { 'production-glb': 31 });
  assert.deepEqual(manifest.capturedOrigins, { 'production-glb': 31, 'production-fallback': 34 });
  for (const id of ids) {
    assert.equal(CARD_ITEMS[`card_${id}`].img, CARD_ILLUSTRATIONS[id].icon);
    assert.equal(CARD_ITEMS[`card_${id}`].illustration, CARD_ILLUSTRATIONS[id].image);
  }
  for (const id of Object.keys(MONSTERS).filter(id => !MONSTER_MODELS[id])) {
    assert.equal(CARD_ILLUSTRATIONS[id], undefined);
    assert.equal(CARD_ITEMS[`card_${id}`].illustration, undefined, `${id}: no new fallback artwork`);
  }
});

test('packaged portraits and thumbnails are distinct, correctly sized and bounded', () => {
  const hashes = new Set(), sources = new Set();
  let portraitBytes = 0, iconBytes = 0;
  for (const entry of spec.entries) {
    const receipt = JSON.parse(read(`tools/card-art/receipts/${entry.id}.json`));
    assert.equal(receipt.provider, 'built-in-imagegen');
    assert.ok(receipt.prompt && receipt.sourceFile && /^[a-f0-9]{64}$/.test(receipt.sourceSha256));
    assert.ok(!sources.has(receipt.sourceSha256), `${entry.id}: independent generation`);
    sources.add(receipt.sourceSha256);
    for (const [kind, expected, limit] of [['image', [384, 480], 90000], ['icon', [96, 120], 9000]]) {
      const bytes = read(entry[kind]), result = receipt[kind], digest = sha(bytes);
      assert.equal(result.path, entry[kind]);
      assert.deepEqual(dimensions(bytes), expected, `${entry.id}: ${kind} dimensions`);
      assert.equal(result.bytes, bytes.length); assert.ok(bytes.length <= limit, `${entry.id}: ${kind} bytes`);
      assert.equal(result.sha256, digest);
      assert.ok(!hashes.has(digest), `${entry.id}: no donor image reuse`); hashes.add(digest);
      if (kind === 'image') portraitBytes += bytes.length; else iconBytes += bytes.length;
    }
  }
  assert.deepEqual(manifest.totals, { count: 31, portraitBytes, iconBytes });
  assert.ok(iconBytes < 31 * 9000, 'list payload bounded separately from detail art');
});

test('generation receipts bind art to captured production model identities and source bytes', () => {
  const checked = new Set();
  for (const ref of manifest.entries) {
    const receipt = JSON.parse(read(`tools/card-art/receipts/${ref.id}.json`));
    assert.equal(receipt.reference, ref.image.path);
    assert.equal(receipt.referenceSha256, ref.image.sha256);
    assert.equal(receipt.origin, ref.origin);
    assert.equal(ref.name, MONSTERS[ref.id].name);
    assert.equal(ref.fallbackShape, MONSTERS[ref.id].shape);
    assert.equal(ref.worldScale, MONSTERS[ref.id].size);
    assert.deepEqual(ref.modelSpec, MONSTER_MODELS[ref.id]);
    assert.deepEqual(receipt.modelSources, ref.sources);
    assert.deepEqual([ref.image.width, ref.image.height], [600, 750]);
    for (const source of ref.sources) if (!checked.has(source.url)) {
      assert.equal(sha(read(`public${source.url}`)), source.sha256, `${ref.id}: actual production model`);
      checked.add(source.url);
    }
    if (ref.origin === 'production-glb') assert.ok(ref.sources.some(source => source.kind === 'body'));
    else assert.equal(ref.sources.length, 0);
  }
  assert.equal(checked.size, 39);
});
