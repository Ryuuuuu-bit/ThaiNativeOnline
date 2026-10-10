// Message feed (bottom right) and centre banner, shared by character and combat UI.
import { el } from './dom.js';

export class Feed {
  constructor(layer) {
    this.list = el('div', 'g-feed'); layer.append(this.list);
    this.bannerEl = el('div', 'g-banner'); this.bannerEl.hidden = true; layer.append(this.bannerEl);
  }
  // Local gameplay messages share the chat history; they never leave this client.
  connectChat(chat) {
    this.chat = chat;
    for (const row of [...this.list.children]) chat.add('ระบบ', row.textContent, row.dataset.kind || 'system');
    this.list.replaceChildren(); this.list.hidden = true;
  }
  // kind: '' | exp | loot | epic | gold | bad. throttle drops an identical line repeated within 1.2 s.
  log(text, kind = '', throttle = false) {
    const now = performance.now();
    if (throttle && this.last === text && now - this.lastAt < 1200) return;
    this.last = text; this.lastAt = now;
    if (this.chat) { this.chat.add('ระบบ', text, kind || 'system'); return; }
    const row = el('div', `g-log ${kind}`); row.textContent = text; this.list.append(row);
    row.dataset.kind = kind;
    while (this.list.children.length > 7) this.list.firstChild.remove();
    setTimeout(() => row.classList.add('old'), 6000);
    setTimeout(() => row.remove(), 7000);
  }
  banner(title, sub) {
    const b = this.bannerEl;
    b.innerHTML = `<b>${title}</b><small>${sub}</small>`; b.hidden = false;
    b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
    clearTimeout(this.timer); this.timer = setTimeout(() => { b.hidden = true; }, 3500);
  }
}
