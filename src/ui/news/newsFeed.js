// The news feed from the game server (GET /api/news, posted by GMs with /gm news …).
//   loadNews() → { news: [{ id, kind, title, body, at }], discord } (newest first) or null when the server can't be reached
//   seenNewsId() / markNewsSeen(id) — the newest id this device has opened (unread dot in the menu)
//   newsItemHtml(item, seen) — one entry, shared by the login teaser and the news window
import { COMMUNITY, NEWS_KINDS } from '../../data/community.js';
import { esc } from '../../character/ui/dom.js';

const SEEN_KEY = 'tno.newsSeen.v1';

export async function loadNews() {
  try {
    const res = await fetch('/api/news', { cache: 'no-store' });
    if (!res.ok) return null;
    const body = await res.json();
    const news = Array.isArray(body.news) ? body.news.filter(n => n && Object.hasOwn(NEWS_KINDS, n.kind)) : [];
    return { news, discord: typeof body.discord === 'string' && /^https:\/\/discord\.gg\//.test(body.discord) ? body.discord : COMMUNITY.discord };
  } catch { return null; }
}

export const seenNewsId = () => { try { return Number(localStorage.getItem(SEEN_KEY)) || 0; } catch { return 0; } };
export const markNewsSeen = id => { try { if (id > seenNewsId()) localStorage.setItem(SEEN_KEY, String(id)); } catch { /* storage unavailable */ } };
export const unreadCount = news => { const seen = seenNewsId(); return news.filter(n => !NEWS_KINDS[n.kind].banner && n.id > seen).length; };

const dateText = at => new Date(at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });

export function newsItemHtml(n, seen = seenNewsId()) {
  return `<article class="news-item" data-kind="${esc(n.kind)}">
    <header><span class="news-tag">${esc(NEWS_KINDS[n.kind].label)}</span><time datetime="${new Date(n.at).toISOString()}">${esc(dateText(n.at))}</time>${n.id > seen ? '<b class="news-new">ใหม่</b>' : ''}</header>
    <h3>${esc(n.title)}</h3>${n.body ? `<p>${esc(n.body)}</p>` : ''}
  </article>`;
}

export const bannerHtml = news => news.filter(n => NEWS_KINDS[n.kind].banner).slice(0, 1)
  .map(n => `<div class="news-banner" role="note"><strong>${esc(n.title)}</strong>${n.body ? `<span>${esc(n.body)}</span>` : ''}</div>`).join('');

const chatIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
export const discordLinkHtml = (url = COMMUNITY.discord, label = 'เข้าร่วม Discord') =>
  `<a class="news-discord" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${chatIcon}<span>${esc(label)}</span></a>`;
