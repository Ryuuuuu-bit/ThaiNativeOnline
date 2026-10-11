import {test} from 'node:test';
import assert from 'node:assert/strict';
import {TITLES, TITLE_BY_ID} from '../src/data/titles.js';
import {TITLE_TIERS, titleTier, titleTheme} from '../src/ui/titleAppearance.js';
import {titleHtml} from '../src/ui/titleTag.js';

const groups = {
  common: ['rookie', 'lv10', 'lv20', 'hunt100', 'duel1', 'duel10', 'redhunt1', 'redhunt10', 'pk1', 'pk10', 'social'],
  rare: ['boss_tiger', 'boss_krasue', 'boss_pop', 'lv30', 'lv50', 'lv75', 'hunt1000', 'medic', 'duel50', 'redhunt50', 'pk50', 'merit1000', 'sin2k', 'cp_top10'],
  epic: ['boss_all', 'lv99', 'hunt5000', 'duel200', 'redhunt200', 'pk200', 'merit10k', 'sin10k', 'cp_top3'],
  legendary: ['lg_merit50k', 'lg_sin50k', 'lg_hunt20k', 'lg_deathless'],
  sovereign: ['cp_top1', 'lv_top1', 'enh_top1'],
};

test('every catalog title has its approved presentation tier without changing catalog metadata', () => {
  assert.deepEqual(TITLE_TIERS, Object.keys(groups));
  const classified = Object.values(groups).flat();
  assert.equal(new Set(classified).size, classified.length);
  assert.deepEqual([...classified].sort(), TITLES.map(t => t.id).sort());
  for (const [tier, ids] of Object.entries(groups)) for (const id of ids) {
    const t = TITLE_BY_ID[id], snapshot = {...t};
    assert.equal(titleTier(t), tier, id);
    assert.deepEqual(t, snapshot, id);
  }
});

test('single-holder dynamic rank outranks legendary metadata, which outranks explicit milestone tiers', () => {
  assert.equal(titleTier({id: 'boss_all', dynamic: true, holders: 1, glow: true}), 'sovereign');
  assert.equal(titleTier({id: 'lv30', cat: 'legend'}), 'legendary');
  assert.equal(titleTier({id: 'hunt5000', glow: true}), 'legendary');
  assert.equal(titleTier({id: 'new_rank', holders: 1}), 'common', 'one holder alone is not a dynamic rank');
  assert.equal(titleTier({id: 'cp_top3', dynamic: true, holders: 3}), 'epic');
});

test('unknown titles fall back safely; unrelated progress totals do not imply prestige', () => {
  for (const t of [undefined, null, {}, {id: 'new_title', goal: 999999999}, {id: 'unknown', dynamic: true, holders: 10}]) {
    assert.equal(titleTier(t), 'common');
  }
  assert.equal(titleTier({id: 'new_legend', glow: true}), 'legendary');
  assert.equal(titleTier({id: 'new_rank', dynamic: true, holders: 1}), 'sovereign');
});

test('titleHtml preserves literal names, brackets and original colours with no ornament markup in chat', () => {
  for (const t of TITLES) for (const brackets of [false, true]) {
    const html = titleHtml(t.id, {brackets});
    assert.match(html, new RegExp(`data-title-tier="${titleTier(t)}"`));
    assert.ok(html.includes(`style="--ttl:${t.color}"`), t.id);
    assert.equal(html.match(/<span class="ttl-label">([^<]*)<\/span><\/em>$/)?.[1], brackets ? `[${t.name}]` : t.name, t.id);
    assert.equal((html.match(/<em\b/g) || []).length, 1);
    assert.equal((html.match(/<\//g) || []).length, 2);
    assert.equal((html.match(/<span\b/g) || []).length, 1);
    assert.ok(!/[♛◆❖]/u.test(html), t.id);
  }
  for (const id of [null, undefined, '', 'missing']) assert.equal(titleHtml(id), '');
});

test('killer and guardian frames apply only to their seven existing title IDs, independently of class, toggle and prestige', () => {
  const killers = ['pk1', 'pk10', 'pk50', 'pk200', 'sin2k', 'sin10k', 'lg_sin50k'];
  const guardians = ['redhunt1', 'redhunt10', 'redhunt50', 'redhunt200', 'merit1000', 'merit10k', 'lg_merit50k'];
  for (const t of TITLES) {
    assert.equal(titleTheme(t), killers.includes(t.id) ? 'killer' : guardians.includes(t.id) ? 'guardian' : 'heroic', t.id);
    assert.match(titleHtml(t.id), new RegExp(`data-title-theme="${titleTheme(t)}"`));
  }
  assert.equal(titleTheme({id: 'duel200', cls: 'assassin', pk: true}), 'heroic');
  assert.equal(titleTheme({id: 'unknown', cat: 'pvp', sin: 100000}), 'heroic');
  assert.equal(titleTheme(null), 'heroic');
  assert.equal(titleTier(TITLE_BY_ID.pk1), 'common');
  assert.equal(titleTier(TITLE_BY_ID.lg_sin50k), 'legendary');
  assert.equal(titleTier(TITLE_BY_ID.redhunt1), 'common');
  assert.equal(titleTier(TITLE_BY_ID.lg_merit50k), 'legendary');
});
