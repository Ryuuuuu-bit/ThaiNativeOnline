import { WORLD_BOSS_NEWS } from '../combat/data/worldBoss.js';
import { MONSTERS } from '../combat/data/monsters.js';
import './worldBoss.css';

// Server wbnews also returns a chat line. Keep standing news until down/dawn;
// brief news restores it after six seconds, urgent news folds after twenty.
// Joining is explicit: onJoin sends wbjoin, never an automatic warp.
const URGENT = new Set(['open', 'fall', 'rise', 'rage']);
const OVER = new Set(['down', 'dawn']);
const FOLD = 20000, BRIEF = 6000;
let bannerId = 0;

export class WorldBossBanner {
  constructor({ onJoin = null, canJoin = () => false } = {}) {
    this.el = document.createElement('div');
    this.el.className = 'wb-banner'; this.el.hidden = true;
    const detailId = `wb-detail-${++bannerId}`;
    this.el.setAttribute('aria-label', 'ประกาศบอสโลก');
    this.el.innerHTML = `<div class="wb-heading"><div class="wb-kicker">บอสโลก · เรือนหอร้าง</div><button type="button" class="wb-toggle" aria-expanded="true" aria-controls="${detailId}" aria-label="ย่อประกาศบอสโลก">ย่อ</button><button type="button" class="wb-dismiss" aria-label="ปิดประกาศบอสโลก">×</button></div><div id="${detailId}" class="wb-text" role="status" aria-live="polite" aria-atomic="true"></div><div class="wb-mini">ผีชุดแดงและผีชุดดำยังอาละวาด</div><button type="button" class="wb-join" hidden>วาร์ปไปเรือนหอร้าง</button>`;
    document.body.appendChild(this.el);
    this.canJoin = canJoin; this.timer = 0; this.fold = 0; this.live = null; this.dismissed = false;
    this.button = this.el.querySelector('.wb-join');
    this.toggle = this.el.querySelector('.wb-toggle');
    this.toggle.addEventListener('click', () => {
      clearTimeout(this.fold);
      this.setFolded(!this.el.classList.contains('wb-folded'));
    });
    this.el.querySelector('.wb-dismiss').addEventListener('click', () => {
      this.dismissed = true; this.el.hidden = true;
    });
    this.button.addEventListener('click', () => {
      if (!this.live || !this.el.classList.contains('wb-urgent') || !this.canJoin()) return;
      onJoin?.(); this.button.hidden = true;
    });
    // The button follows the player (entered, left, went offline), never brief news.
    setInterval(() => {
      if (!this.el.hidden) this.button.hidden = !(this.live && this.el.classList.contains('wb-urgent') && this.canJoin());
    }, 1000);
  }
  show(msg) {
    const line = WORLD_BOSS_NEWS[msg.state]?.({ name: MONSTERS[msg.type]?.name ?? '', mvp: msg.mvp });
    if (!line) return null;
    // Arrival reminders must not duplicate chat or reopen dismissed standing news.
    if (msg.state === 'open' && this.live && !this.el.classList.contains('wb-brief')) return null;
    clearTimeout(this.timer); clearTimeout(this.fold);
    this.dismissed = false;
    if (URGENT.has(msg.state)) this.live = line;
    else if (OVER.has(msg.state)) this.live = null;
    this.paint(line, { urgent: URGENT.has(msg.state), brief: !URGENT.has(msg.state) });
    if (!URGENT.has(msg.state)) this.timer = setTimeout(() => (this.live ? this.paint(this.live, { urgent: true, folded: true }) : (this.el.hidden = true)), BRIEF);
    else this.fold = setTimeout(() => this.setFolded(true), FOLD);
    return line;
  }
  setFolded(folded) {
    this.el.classList.toggle('wb-folded', folded);
    this.el.querySelector('.wb-text').hidden = folded;
    this.toggle.setAttribute('aria-expanded', String(!folded));
    this.toggle.setAttribute('aria-label', folded ? 'ขยายประกาศบอสโลก' : 'ย่อประกาศบอสโลก');
    this.toggle.textContent = folded ? 'อ่าน' : 'ย่อ';
  }
  paint(line, { urgent, brief = false, folded = false }) {
    this.el.querySelector('.wb-text').textContent = line;
    this.el.classList.toggle('wb-urgent', urgent);
    this.el.classList.toggle('wb-brief', brief);
    this.setFolded(folded);
    this.toggle.hidden = brief;
    this.button.hidden = !(urgent && this.live && this.canJoin());
    this.el.hidden = this.dismissed;
    this.el.classList.remove('wb-in'); void this.el.offsetWidth; this.el.classList.add('wb-in');
  }
}
