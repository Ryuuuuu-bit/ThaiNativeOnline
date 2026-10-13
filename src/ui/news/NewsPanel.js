// In-game news window, opened from the main menu tile "ข่าวสาร" (src/core/Game.js).
//   const news = new NewsPanel({ onUnread: n => menu.setNewsAlert(n > 0) })
//   news.show() / news.close() / news.refresh()   refresh() also runs when the server says { t: 'news' }
import { NEWS_KINDS } from '../../data/community.js';
import { loadNews, seenNewsId, markNewsSeen, unreadCount, newsItemHtml, bannerHtml, discordLinkHtml } from './newsFeed.js';
import '../player-guide.css';
import './news.css';

const TABS = [['all', 'ทั้งหมด'], ...Object.entries(NEWS_KINDS).filter(([, k]) => !k.banner).map(([id, k]) => [id, k.label])];

export class NewsPanel {
  constructor({ onUnread = () => {} } = {}) {
    this.onUnread = onUnread;
    this.tab = 'all'; this.feed = null; this.failed = false; this.seenAtOpen = 0;
    this.root = document.createElement('div');
    this.root.id = 'news-overlay';
    this.root.className = 'qol-overlay';
    this.root.hidden = true;
    this.root.innerHTML = `<section class="guide-panel news-panel" role="dialog" aria-modal="true" aria-labelledby="news-title" tabindex="-1">
      <header class="guide-head"><div><small>ข่าวสารและอัปเดต</small><h2 id="news-title">ข่าวสาร</h2><p>อัปเดต อีเวนต์ และประกาศจากทีมงาน</p></div><button type="button" data-news-close aria-label="ปิดข่าวสาร">×</button></header>
      <nav class="news-tabs" aria-label="ประเภทข่าว">${TABS.map(([id, label]) => `<button type="button" data-news-tab="${id}" aria-pressed="${id === 'all'}">${label}</button>`).join('')}</nav>
      <div class="news-scroll"><div class="news-list" aria-live="polite"></div></div>
      <footer class="news-community"><span>หาปาร์ตี้ คุยกับผู้เล่น และรู้ข่าวอีเวนต์ก่อนใคร</span>${discordLinkHtml()}</footer>
    </section>`;
    (document.getElementById('app') ?? document.body).append(this.root);
    this.$ = s => this.root.querySelector(s);
    this.root.addEventListener('click', e => {
      if (e.target === this.root || e.target.closest('[data-news-close]')) { this.close(); return; }
      const tab = e.target.closest('[data-news-tab]');
      if (tab) { this.tab = tab.dataset.newsTab; this.render(); }
    });
    // game keys (1–0, WASD…) must not fire while the window is open; Escape is handled by windowNavigation
    this.root.addEventListener('keydown', e => { if (e.code !== 'Escape') e.stopPropagation(); });
  }
  get open() { return !this.root.hidden; }
  async refresh() {
    const feed = await loadNews();
    if (feed) this.feed = feed;
    this.failed = !this.feed;
    if (this.open) { this.render(); this.markRead(); } else this.onUnread(this.feed ? unreadCount(this.feed.news) : 0);
    return this.feed;
  }
  async show() {
    this.root.hidden = false;
    this.seenAtOpen = seenNewsId();   // entries newer than this keep their "ใหม่" mark while the window is open
    this.render();
    this.$('.news-panel').focus({ preventScroll: true });
    if (this.feed) this.markRead();
    await this.refresh();   // always fetch on open: a GM may have posted since the last push
  }
  close() { this.root.hidden = true; }
  markRead() {
    const top = this.feed?.news.reduce((m, n) => Math.max(m, n.id), 0) ?? 0;
    if (top) markNewsSeen(top);
    this.onUnread(0);
  }
  render() {
    if (!this.open) return;
    const seen = this.seenAtOpen;
    this.root.querySelectorAll('[data-news-tab]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.newsTab === this.tab)));
    const list = this.$('.news-list');
    if (!this.feed) { list.innerHTML = `<p class="news-empty">${this.failed ? 'ยังเชื่อมต่อเซิร์ฟเวอร์ข่าวไม่ได้ ลองใหม่อีกครั้งภายหลัง' : 'กำลังโหลดข่าว…'}</p>`; return; }
    if (this.feed.discord) this.$('.news-discord').href = this.feed.discord;
    const items = this.feed.news.filter(n => !NEWS_KINDS[n.kind].banner && (this.tab === 'all' || n.kind === this.tab));
    list.innerHTML = bannerHtml(this.feed.news) + (items.length ? items.map(n => newsItemHtml(n, seen)).join('') : '<p class="news-empty">ยังไม่มีข่าวในหมวดนี้</p>');
  }
}
