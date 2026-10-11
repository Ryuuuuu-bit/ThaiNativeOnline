import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { MUAYTHAI_SKILLS } from '../src/classes/muaythai-moves.js';
import { HERBALIST_SKILLS } from '../src/classes/herbalist-moves.js';
import { HUNTER_SKILLS } from '../src/classes/hunter-moves.js';
import { WARRIOR_SKILLS } from '../src/classes/warrior-moves.js';
import { SHAMAN_SKILLS } from '../src/classes/shaman-moves.js';
import { KIT_PASSIVES } from '../src/rules/data/kitpassives.js';
import { PAINTED_SKILL_CLASSES, paintedSkillIcon, resolvePaintedSkillIcon } from '../src/ui/painted-skill-icons.js';
import { assetIcon } from '../src/ui/icons.js';

test('all playable active and passive skills have their own painted export', () => {
  const ids = [...MUAYTHAI_SKILLS, ...HERBALIST_SKILLS, ...HUNTER_SKILLS, ...WARRIOR_SKILLS, ...SHAMAN_SKILLS].map(s => s.id).concat(Object.keys(KIT_PASSIVES));
  assert.deepEqual(Object.keys(PAINTED_SKILL_CLASSES).sort(), ids.sort());
  for (const id of ids) assert.ok(existsSync(new URL('../public' + paintedSkillIcon(id), import.meta.url)), id);
  assert.equal(paintedSkillIcon('unknown'), null);
});

test('legacy active and passive URLs resolve with base path and cache suffix intact', () => {
  for (const [id, cls] of Object.entries(PAINTED_SKILL_CLASSES)) {
    assert.equal(resolvePaintedSkillIcon(`/game/fx/${cls}/icon_${id}.png?v=2#art`), `/game/ui/skills/painted-complete-v1/${id}.webp?v=2#art`);
  }
  assert.equal(resolvePaintedSkillIcon('/fx/shaman/icon_mage_akom.png', '/game/'), '/game/ui/skills/painted-complete-v1/mage_akom.webp');
  for (const url of ['/fx/hunter/icon_mage_akom.png', '/fx/shaman/icon_unknown.png', '/ui/items/icon_ring.png', 'data:image/png;base64,AAA', 'https://example.com/fx/shaman/icon_mage_akom.png', '//example.com/fx/shaman/icon_mage_akom.png']) assert.equal(resolvePaintedSkillIcon(url), url);
});

test('painted skills retain their full silhouette and smooth rendering in shared frames', () => {
  const html = assetIcon('/fx/shaman/icon_mage_akom.png', '"<วิญญาณ>');
  assert.match(html, /asset-icon painted-art/);
  assert.match(html, /mage_akom\.webp/);
  assert.match(html, /alt="&quot;&lt;วิญญาณ&gt;"/);
  assert.match(assetIcon(paintedSkillIcon('heal_zone')), /asset-icon painted-art/);
  assert.doesNotMatch(assetIcon('/ui/items/icon_ring.png'), /painted-art/);
});

test('every skill preserves its exact meaningful ImageGen prompt, including approved reuses', () => {
  for (const id of Object.keys(PAINTED_SKILL_CLASSES)) {
    const folder = new URL('../docs/art/skills/painted-complete-v1/', import.meta.url);
    const prompt = readFileSync(new URL(id + '.prompt.txt', folder), 'utf8').trim();
    const receipt = JSON.parse(readFileSync(new URL(id + '.receipt.json', folder), 'utf8'));
    assert.ok(prompt.length > 100, id + ' must preserve its full prompt');
    assert.equal(prompt, receipt.prompt?.trim(), id + ' receipt records the original prompt');
  }
});
