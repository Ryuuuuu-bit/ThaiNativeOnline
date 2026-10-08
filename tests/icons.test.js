// Every icon the data points at exists in public/, without a browser.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { SKILLS, BUFF_ICONS } from '../src/combat/data/skills.js';
import { AVATARS } from '../src/data/training.js';
import { MUAYTHAI_SKILLS } from '../src/classes/muaythai-moves.js';
import { HERBALIST_SKILLS } from '../src/classes/herbalist-moves.js';
import { HUNTER_SKILLS } from '../src/classes/hunter-moves.js';
import { WARRIOR_SKILLS } from '../src/classes/warrior-moves.js';
import { SHAMAN_SKILLS } from '../src/classes/shaman-moves.js';
import { ITEMS } from '../src/character/data/items.js';

const pub = path => existsSync(new URL(`../public/${path}`, import.meta.url));

test('combat skill and buff images exist', () => {
  for (const [id, s] of Object.entries(SKILLS)) if (s.img) assert.ok(pub(s.img), `skill ${id}: ${s.img}`);
  for (const [id, b] of Object.entries(BUFF_ICONS)) if (b.img) assert.ok(pub(b.img), `buff ${id}: ${b.img}`);
});

test('playable classes have a portrait and their skills have framed icons', () => {
  for (const [id, a] of Object.entries(AVATARS)) if (a.ready) assert.ok(a.portrait && pub(a.portrait), `${id} portrait`);
  for (const s of MUAYTHAI_SKILLS) assert.ok(pub(`fx/muaythai/icon_${s.id}.png`), s.id);
  for (const s of HERBALIST_SKILLS) assert.ok(pub(`fx/herbalist/icon_${s.id}.png`), s.id);
  for (const s of HUNTER_SKILLS) assert.ok(pub(`fx/hunter/icon_${s.id}.png`), s.id);
  for (const s of WARRIOR_SKILLS) assert.ok(pub(`fx/warrior/icon_${s.id}.png`), s.id);
  for (const s of SHAMAN_SKILLS) assert.ok(pub(`fx/shaman/icon_${s.id}.png`), s.id);
});

test('both playable classes show their own art on the city skill bar', () => {
  for (const id of ['jab', 'knee', 'elbow', 'waikru', 'dart', 'blight', 'grove', 'balm']) assert.ok(SKILLS[id].img, `${id} has art`);
});

test('every item has framed art', () => {
  for (const [id, item] of Object.entries(ITEMS)) if (!item.retired) assert.ok(item.img && pub(item.img), `${id}: ${item.img}`);   // retired gear is redeemed on load, never drawn
});
import { assetIcon, iconHtml } from '../src/ui/icons.js';

test('shared icon frame keeps URLs and escapes accessible labels', () => {
  const html = assetIcon('/fx/shaman/icon_mage_yant.png', '"<ยันต์>&');
  assert.match(html, /class="icon-img asset-icon"/);
  assert.match(html, /src="\/fx\/shaman\/icon_mage_yant.png"/);
  assert.match(html, /alt="&quot;&lt;ยันต์&gt;&amp;"/);
  assert.equal(iconHtml({img:'ui/items/icon_ash.png'}), assetIcon('/ui/items/icon_ash.png'));
});
