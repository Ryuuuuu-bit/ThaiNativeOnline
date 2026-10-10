import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { ITEMS } from '../src/character/data/items.js';
import { PAINTED_ITEM_IDS, PAINTED_ITEM_ICONS, SAMPLE_PAINTED_ITEM_IDS } from '../src/character/data/painted-item-icons.js';
import { EXPEDITION_GEAR } from '../src/character/data/expedition-gear.js';
import { HUNT_GEAR } from '../src/character/data/hunt-gear.js';
import { EXTENDED_GEAR } from '../src/character/data/extended-gear.js';
import { FLASK_ITEMS } from '../src/character/data/flask-items.js';
import { CARD_ITEMS } from '../src/character/data/cards.js';
import { iconHtml, assetIcon } from '../src/ui/icons.js';

test('painted overrides cover every active item and preserve all generated gameplay definitions', () => {
  const active = Object.keys(ITEMS).filter(id => !ITEMS[id].retired).sort();
  assert.equal(PAINTED_ITEM_IDS.length, 516);
  assert.deepEqual([...PAINTED_ITEM_IDS].sort(), active);
  assert.deepEqual(Object.keys(ITEMS).filter(id => ITEMS[id].imageArt === 'painted').sort(), [...PAINTED_ITEM_IDS].sort());
  for (const [id, original] of Object.entries({ ...EXPEDITION_GEAR, ...HUNT_GEAR, ...EXTENDED_GEAR, ...FLASK_ITEMS, ...CARD_ITEMS })) {
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
  assert.deepEqual(receipt.items.map(item => item.id), [...SAMPLE_PAINTED_ITEM_IDS]);
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
  assert.match(iconHtml(ITEMS.wood_sword), /painted-art/);
  for (const item of Object.values(ITEMS).filter(item => item.retired)) {
    assert.doesNotMatch(iconHtml(item), /painted-art/);
  }
  assert.equal(assetIcon('legacy.png'), '<span class="icon-img asset-icon"><img src="legacy.png" alt=""></span>');
  assert.match(iconHtml(ITEMS.takrut, '"<พระ>'), /alt="&quot;&lt;พระ&gt;"/);
});

test('complete library preserves distinct generated masters and exact semantic coverage', () => {
  const root = '../docs/art/items/painted-complete-v1/';
  const backlog = JSON.parse(readFileSync(new URL(root + 'backlog.json', import.meta.url)));
  const review = JSON.parse(readFileSync(new URL(root + 'art-review.json', import.meta.url)));
  const manifest = JSON.parse(readFileSync(new URL(root + 'completion-manifest.json', import.meta.url)));
  assert.equal(review.approved, true);
  assert.ok(review.score >= 8);
  assert.deepEqual(review.rejectedIDs, []);
  assert.deepEqual([...review.approvedIDs].sort(), backlog.groups.map(group => group.representativeID).sort());
  assert.equal(manifest.summary.completedNewMasters, 333);
  assert.equal(manifest.summary.mappedIDs, 516);
  assert.equal(manifest.summary.pendingMasters, 0);
  const memberIDs = [], originalHashes = new Set();
  for (const group of backlog.groups) {
    memberIDs.push(...group.memberIDs);
    let image = group.approvedImage;
    if (group.status === 'new-generation') {
      const receipt = JSON.parse(readFileSync(new URL(root + `provenance/${group.representativeID}.json`, import.meta.url)));
      assert.equal(receipt.jobID, group.representativeID);
      assert.deepEqual(receipt.memberIDs, group.memberIDs);
      assert.equal(receipt.method, 'built-in image_gen');
      assert.ok(receipt.prompt.length > 100);
      assert.equal(receipt.masterSha256, receipt.originalSha256);
      assert.ok(!originalHashes.has(receipt.originalSha256), `duplicate original: ${receipt.jobID}`);
      originalHashes.add(receipt.originalSha256);
      for (const [path, expected] of [[receipt.master, receipt.originalSha256], [receipt.output, receipt.sha256]]) {
        const bytes = readFileSync(new URL(`../${path}`, import.meta.url));
        assert.equal(createHash('sha256').update(bytes).digest('hex'), expected, path);
        if (path === receipt.output) {
          assert.equal(bytes.length, receipt.bytes);
          assert.equal(bytes.subarray(0, 4).toString(), 'RIFF');
          assert.equal(bytes.subarray(8, 12).toString(), 'WEBP');
        }
      }
      assert.equal(receipt.width, 256); assert.equal(receipt.height, 256);
      assert.equal(receipt.hasAlpha, true);
      assert.equal(receipt.alphaMin, 0); assert.equal(receipt.alphaMax, 255);
      assert.ok(receipt.bytes < 100_000);
      image = receipt.output.replace(/^public\//, '');
    }
    for (const id of group.memberIDs) assert.equal(PAINTED_ITEM_ICONS[id], image, id);
  }
  assert.equal(originalHashes.size, 333);
  assert.equal(memberIDs.length, new Set(memberIDs).size);
  assert.deepEqual(memberIDs.sort(), [...PAINTED_ITEM_IDS].sort());
  for (const item of backlog.retiredExcluded) {
    assert.equal(PAINTED_ITEM_ICONS[item.id], undefined);
    assert.equal(ITEMS[item.id].img, item.img);
  }
});
