// One-time card inviting the player to the Discord community, shown when a character first
// reaches COMMUNITY.discordPromptLevel (src/core/Game.js hooks Character 'levelup').
//   maybeShowDiscordPrompt(level) — at most once per device
import { COMMUNITY } from '../../data/community.js';
import { el } from '../../character/ui/dom.js';
import { discordLinkHtml } from './newsFeed.js';
import './news.css';

const KEY = 'tno.discordPrompt.v1';
const shown = () => { try { return localStorage.getItem(KEY) === '1'; } catch { return true; } };
const remember = () => { try { localStorage.setItem(KEY, '1'); } catch { /* storage unavailable */ } };

export function maybeShowDiscordPrompt(level) {
  if (level < COMMUNITY.discordPromptLevel || shown()) return null;
  remember();
  const card = el('aside', 'discord-prompt glass', `
    <div class="discord-prompt-lv" aria-hidden="true">${COMMUNITY.discordPromptLevel}</div>
    <div><h3>ยินดีด้วย! ถึงเลเวล ${COMMUNITY.discordPromptLevel} แล้ว</h3>
      <p>มาร่วมกลุ่มผู้ล่าผีบน Discord หาปาร์ตี้ และรู้ข่าวอีเวนต์ก่อนใคร</p>
      <div class="discord-prompt-actions">${discordLinkHtml()}<button type="button" class="discord-prompt-later">ไว้ทีหลัง</button></div></div>`);
  card.setAttribute('role', 'dialog'); card.setAttribute('aria-label', 'เข้าร่วม Discord');
  const close = () => card.remove();
  card.addEventListener('click', e => { if (e.target.closest('.discord-prompt-later, .news-discord')) close(); });
  card.addEventListener('keydown', e => { e.stopPropagation(); if (e.code === 'Escape') close(); });
  (document.getElementById('app') ?? document.body).append(card);
  return card;
}
