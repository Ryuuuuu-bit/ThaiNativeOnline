// A GM ประกาศ across the top of the screen for a few seconds (the chat keeps the line).
// A newer announcement replaces the one showing; a click dismisses it.
//   const b = new AnnounceBanner(); b.show(title, text)
const SHOW_MS = 7000;

export class AnnounceBanner {
  constructor(root = document.getElementById('app') ?? document.body) {
    this.el = document.createElement('div');
    this.el.className = 'announce-banner'; this.el.hidden = true;
    this.el.setAttribute('role', 'status'); this.el.setAttribute('aria-live', 'polite');
    this.el.innerHTML = '<b></b><span></span>';
    this.el.addEventListener('click', () => this.hide());
    root.append(this.el);
  }
  show(title, text) {
    const message = String(text ?? '').trim(); if (!message) return;
    this.el.querySelector('b').textContent = title || '📢 ประกาศ';
    this.el.querySelector('span').textContent = message;
    this.el.hidden = false; this.el.classList.remove('leaving');
    clearTimeout(this.timer); clearTimeout(this.leave);
    this.timer = setTimeout(() => this.hide(), SHOW_MS + Math.min(5000, message.length * 40));
  }
  hide() {
    clearTimeout(this.timer); if (this.el.hidden) return;
    this.el.classList.add('leaving');
    this.leave = setTimeout(() => { this.el.hidden = true; this.el.classList.remove('leaving'); }, 300);
  }
}
