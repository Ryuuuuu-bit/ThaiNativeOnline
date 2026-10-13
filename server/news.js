// News feed shown on the login screen and in the in-game news window (src/ui/NewsPanel.js).
// Posted by GMs in chat (server/gm.js `news`), kept by the store (newsList / newsAdd / newsDelete),
// read by anyone through GET /api/news.
import { NEWS, NEWS_KINDS } from '../src/data/community.js';

const clean = (s, max) => String(s ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

// "/gm news event คืนผีออก | เที่ยงคืนถึงตีสาม…" → args after `news`
export function parseNewsPost(args) {
  const [kindRaw, ...rest] = args;
  const kind = String(kindRaw ?? '').toLowerCase();
  if (!Object.hasOwn(NEWS_KINDS, kind)) return { ok: false, why: 'kind' };
  const text = rest.join(' ');
  const cut = text.indexOf('|');
  const title = clean(cut < 0 ? text : text.slice(0, cut), NEWS.titleMax);
  const body = clean(cut < 0 ? '' : text.slice(cut + 1), NEWS.bodyMax);
  if (!title) return { ok: false, why: 'title' };
  return { ok: true, kind, title, body };
}

// the public shape of a stored row
export const publicNews = row => ({ id: Number(row.id), kind: row.kind, title: row.title, body: row.body ?? '', at: new Date(row.created).getTime() });
