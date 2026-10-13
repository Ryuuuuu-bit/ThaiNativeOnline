import test from 'node:test';
import assert from 'node:assert/strict';
import { parseNewsPost, publicNews } from '../server/news.js';
import { MemoryStore } from '../server/store.js';
import { gm, GM_COMMANDS } from '../server/gm.js';
import { NEWS, NEWS_KINDS, COMMUNITY } from '../src/data/community.js';

test('news posts parse kind, title and body; bad input is refused', () => {
  assert.deepEqual(parseNewsPost(['event', 'คืนผีออก', '|', 'เที่ยงคืน', 'ถึงตีสาม']), { ok: true, kind: 'event', title: 'คืนผีออก', body: 'เที่ยงคืน ถึงตีสาม' });
  assert.deepEqual(parseNewsPost(['UPDATE', 'แพตช์ใหม่']), { ok: true, kind: 'update', title: 'แพตช์ใหม่', body: '' });
  assert.equal(parseNewsPost(['party', 'x']).why, 'kind');
  assert.equal(parseNewsPost(['notice', '|', 'no title']).why, 'title');
  const long = parseNewsPost(['notice', 'ก'.repeat(500), '|', 'ข'.repeat(5000)]);
  assert.equal(long.title.length, NEWS.titleMax); assert.equal(long.body.length, NEWS.bodyMax);
  assert.equal(parseNewsPost(['notice', 'a\u0000b']).title, 'a b');
});

test('community data: every kind has a label and the Discord link is an invite', () => {
  for (const k of Object.values(NEWS_KINDS)) assert.ok(k.label);
  assert.match(COMMUNITY.discord, /^https:\/\/discord\.gg\/\w+$/);
});

test('memory store keeps news newest first and deletes by id', async () => {
  const s = new MemoryStore();
  const a = await s.newsAdd({ kind: 'update', title: 'A', body: '', author: 'gm' });
  const b = await s.newsAdd({ kind: 'event', title: 'B', body: 'x', author: 'gm' });
  assert.deepEqual((await s.newsList(10)).map(r => r.title), ['B', 'A']);
  assert.equal(publicNews(b).id, b.id); assert.equal(typeof publicNews(b).at, 'number'); assert.equal(publicNews(b).author, undefined);
  assert.equal(await s.newsDelete(a.id), true); assert.equal(await s.newsDelete(a.id), false);
  assert.deepEqual((await s.newsList(10)).map(r => r.title), ['B']);
});

test('/gm news posts, lists and deletes through the GM context; others are refused', async () => {
  const s = new MemoryStore(), pushed = [];
  const me = { id: 1, name: 'GM', account: 'root' };
  const news = { list: n => s.newsList(n), add: async p => { pushed.push('add'); return s.newsAdd(p); }, remove: async id => { pushed.push('del'); return s.newsDelete(id); } };
  const ctx = { isAdmin: async () => true, byId: () => ({ p: me }), combatants: { get: () => ({ persist: { account: 'root' } }) }, news };
  assert.ok(GM_COMMANDS.some(c => c.id === 'news'));
  assert.match(await gm(ctx, me, '/gm news event คืนผีออก | เที่ยงคืนถึงตีสาม'), /โพสต์ข่าว #1/);
  const [row] = await s.newsList(5);
  assert.equal(row.kind, 'event'); assert.equal(row.title, 'คืนผีออก'); assert.equal(row.body, 'เที่ยงคืนถึงตีสาม'); assert.equal(row.author, 'root');
  assert.match(await gm(ctx, me, '/gm news list'), /#1 \[event\] คืนผีออก/);
  assert.match(await gm(ctx, me, '/gm news party x'), /\/gm news/);
  assert.match(await gm(ctx, me, '/gm news del 1'), /ลบข่าว #1/);
  assert.match(await gm(ctx, me, '/gm news del 1'), /ไม่พบ/);
  assert.deepEqual(pushed, ['add', 'del', 'del']);
  assert.match(await gm({ ...ctx, isAdmin: async () => false }, me, '/gm news event x'), /สำหรับ GM เท่านั้น/);
  assert.equal((await s.newsList(5)).length, 0);
});
