// Login screen: the latest news and the Discord link under the welcome text (src/account/screens.js).
//   mountNewsTeaser(container) — the Discord link always; news rows when the server has some
import { COMMUNITY, NEWS_KINDS } from '../../data/community.js';
import { loadNews, bannerHtml, discordLinkHtml } from './newsFeed.js';
import { el, esc } from '../../character/ui/dom.js';
import './news.css';

export function mountNewsTeaser(container) {
  const box = el('section', 'news-teaser');
  box.hidden = true;
  box.setAttribute('aria-label', 'ข่าวล่าสุด');
  container.append(box);
  loadNews().then((feed = null) => {
    if (!box.isConnected) return;
    feed ??= { news: [], discord: COMMUNITY.discord };
    const items = feed.news.filter(n => !NEWS_KINDS[n.kind].banner).slice(0, 3);
    // one line per entry (tag · title · date): the welcome column must stay short beside the sign-in card
    const row = n => `<li data-kind="${esc(n.kind)}"><span class="news-tag">${esc(NEWS_KINDS[n.kind].label)}</span><b>${esc(n.title)}</b><time>${esc(new Date(n.at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }))}</time></li>`;
    box.innerHTML = `<div class="news-teaser-head"><span>ข่าวล่าสุด</span>${discordLinkHtml(feed.discord, 'Discord')}</div>${bannerHtml(feed.news)}${items.length ? `<ul>${items.map(row).join('')}</ul>` : ''}`;
    box.hidden = false;
  });
  return box;
}
