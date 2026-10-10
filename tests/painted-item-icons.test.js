import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { ITEMS } from '../src/character/data/items.js';
import { PAINTED_ITEM_IDS, PAINTED_ITEM_ICONS } from '../src/character/data/painted-item-icons.js';
import { EXPEDITION_GEAR } from '../src/character/data/expedition-gear.js';
import { HUNT_GEAR } from '../src/character/data/hunt-gear.js';
import { EXTENDED_GEAR } from '../src/character/data/extended-gear.js';
import { FLASK_ITEMS } from '../src/character/data/flask-items.js';
import { iconHtml, assetIcon } from '../src/ui/icons.js';

test('painted overrides preserve all generated gameplay definitions and leave other tiers unchanged', () => {
  assert.equal(PAINTED_ITEM_IDS.length, 15);
  assert.deepEqual(Object.keys(ITEMS).filter(id => ITEMS[id].imageArt === 'painted').sort(), [...PAINTED_ITEM_IDS].sort());
  for (const [id, original] of Object.entries({ ...EXPEDITION_GEAR, ...HUNT_GEAR, ...EXTENDED_GEAR, ...FLASK_ITEMS })) {
    const actual = { ...ITEMS[id] };
    if (PAINTED_ITEM_ICONS[id]) {
      assert.equal(actual.img, PAINTED_ITEM_ICONS[id]);
      delete actual.imageArt;
      actual.img = original.img;
    }
    assert.deepEqual(actual, original, id);
  }
});

test('exports match approved PNG masters and reproducible WebP receipts', () => {
  const receipt = JSON.parse(readFileSync(new URL('../docs/art/items/imagegen-sample-v2/production-manifest.json', import.meta.url)));
  assert.deepEqual(receipt.items.map(item => item.id), [...PAINTED_ITEM_IDS]);
  for (const item of receipt.items) {
    for (const [file, expected] of [[item.source, item.sourceSha256], [item.output, item.sha256]]) {
      const bytes = readFileSync(new URL(`../${file}`, import.meta.url));
      assert.equal(createHash('sha256').update(bytes).digest('hex'), expected, file);
      if (file === item.output) {
        assert.equal(bytes.length, item.bytes);
        assert.equal(bytes.subarray(0, 4).toString(), 'RIFF');
        assert.equal(bytes.subarray(8, 12).toString(), 'WEBP');
      }
    }
    assert.equal(item.width, 256); assert.equal(item.height, 256);
    assert.equal(item.hasAlpha, true); assert.equal(item.alphaMin, 0); assert.equal(item.alphaMax, 255);
    assert.ok(item.bytes < 100_000, `${item.id} exceeds icon transfer budget`);
  }
});

test('painted styling is opt-in and legacy icons retain their markup', () => {
  assert.match(iconHtml(ITEMS.takrut), /asset-icon painted-art/);
  assert.doesNotMatch(iconHtml(ITEMS.wood_sword), /painted-art/);
  assert.equal(assetIcon('legacy.png'), '<span class="icon-img asset-icon"><img src="legacy.png" alt=""></span>');
  assert.match(iconHtml(ITEMS.takrut, '"<พระ>'), /alt="&quot;&lt;พระ&gt;"/);
});
