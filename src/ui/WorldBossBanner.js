import { WORLD_BOSS_NEWS } from '../combat/data/worldBoss.js';
import { MONSTERS } from '../combat/data/monsters.js';
import './worldBoss.css';

// World boss news (server → client `wbnews`, server/index.js): a banner across the top of
// the screen for everyone, wherever they are, plus a line in the chat.
//   const banner = new WorldBossBanner({ onJoin, canJoin }); banner.show(msg) → the line it showed (or null)
// From the rise ('open') the banner stays until the sisters are put down ('down') or dawn takes
// them: urgent news (one sister fell, rose, raged) pulses red; after a while it folds to a slim
// strip. It carries the way in, since เรือนหอร้าง has no door on the map: its button warps there
// (onJoin → server wbjoin), shown while canJoin() (online and not already inside).
// Other news (dusk, a refused door) shows for a moment and then the standing banner returns.
const URGENT = new Set(['open', 'fall', 'rise', 'rage']);   // the boss stands
const OVER = new Set(['down', 'dawn']);                       // it is gone for the night
const FOLD = 20000, BRIEF = 6000;

export class WorldBossBanner {
  constructor({ onJoin = null, canJoin = () => false } = {}) {
    this.el = document.createElement('div');
    this.el.className = 'wb-banner glass'; this.el.hidden = true;
    this.el.innerHTML = '<div class="wb-kicker">บอสโลก</div><div class="wb-text"></div><div class="wb-mini">ผีชุดแดงและผีชุดดำยังอาละวาดที่เรือนหอร้าง</div><button type="button" class="wb-join" hidden>วาร์ปไปเรือนหอร้าง</button>';
    document.body.appendChild(this.el);
    this.canJoin = canJoin; this.timer = 0; this.fold = 0; this.live = null;   // live: the standing news while the boss is up
    this.button = this.el.querySelector('.wb-join');
    this.button.addEventListener('click', () => { onJoin?.(); this.button.hidden = true; });
    // the button follows the player (warped in, left by the door, went offline)
    setInterval(() => { if (this.live && !this.el.hidden) this.button.hidden = !this.canJoin(); }, 1000);
  }
  show(msg) {
    const line = WORLD_BOSS_NEWS[msg.state]?.({ name: MONSTERS[msg.type]?.name ?? '', mvp: msg.mvp });
    if (!line) return null;
    // the same standing news again (sent on every arrival while the boss is up): leave it be
    if (msg.state === 'open' && this.live && !this.el.hidden && !this.el.classList.contains('wb-brief')) return null;   // (no second chat line)
    clearTimeout(this.timer); clearTimeout(this.fold);
    if (URGENT.has(msg.state)) this.live = line;
    else if (OVER.has(msg.state)) this.live = null;
    this.paint(line, { urgent: URGENT.has(msg.state), brief: !URGENT.has(msg.state) });
    if (!URGENT.has(msg.state)) this.timer = setTimeout(() => (this.live ? this.paint(this.live, { urgent: true, folded: true }) : (this.el.hidden = true)), BRIEF);
    else this.fold = setTimeout(() => this.el.classList.add('wb-folded'), FOLD);
    return line;
  }
  paint(line, { urgent, brief = false, folded = false }) {
    this.el.querySelector('.wb-text').textContent = line;
    this.el.classList.toggle('wb-urgent', urgent);
    this.el.classList.toggle('wb-brief', brief);
    this.el.classList.toggle('wb-folded', folded);
    this.button.hidden = !(urgent && this.live && this.canJoin());
    this.el.hidden = false;
    this.el.classList.remove('wb-in'); void this.el.offsetWidth; this.el.classList.add('wb-in');
  }
}
