import { titleHtml } from '../ui/titleTag.js';
import { draggable } from '../ui/draggable.js';
import './chat-tabs.css';

const CHANNELS = { general: 'โลก', party: 'ปาร์ตี้', whisper: 'กระซิบ', system: 'ระบบ' };

// Social supplies filter(text); keep its command parsing and server authority intact.
export class ChatBox {
  constructor(send) {
    this.send = send;
    this.channel = 'general';
    this.unread = Object.fromEntries(Object.keys(CHANNELS).map(key => [key, 0]));
    this.collapsed = true;
    this.root = document.createElement('section');
    this.root.className = 'net-chat net-chat-tabs'; this.root.setAttribute('aria-label', 'แชท');
    this.root.innerHTML = `<header><button type="button" class="chat-toggle" aria-controls="chat-body"><span class="chat-bubble" aria-hidden="true">▤</span><span class="chat-heading"><b>สนทนา</b><small class="chat-subtitle">ทั่วไป</small></span><span class="chat-total" hidden></span><span class="chat-fold" aria-hidden="true">›</span></button><span class="net-online">ออฟไลน์</span></header>
      <div class="chat-body" id="chat-body">
        <div class="chat-tabs" role="tablist" aria-label="ช่องแชท" aria-orientation="vertical">${Object.entries(CHANNELS).map(([key, label]) => `<button type="button" role="tab" id="chat-tab-${key}" data-tab="${key}" aria-controls="chat-log" aria-selected="${key === 'general'}" tabindex="${key === 'general' ? 0 : -1}">${label}<span class="chat-unread" hidden></span></button>`).join('')}</div>
        <div class="net-lines" id="chat-log" role="tabpanel" aria-labelledby="chat-tab-general" tabindex="0" aria-live="polite" aria-relevant="additions"></div>
        <form class="chat-compose" hidden>
          <label class="chat-recipient" hidden>ถึง <input type="text" maxlength="32" autocomplete="off" aria-label="ชื่อผู้รับกระซิบ" placeholder="ชื่อผู้รับ"></label>
          <div class="chat-send-row"><button type="button" class="chat-emoji-toggle" aria-label="ใส่อีโมจิ" aria-expanded="false" aria-controls="chat-emoji-picker">☺</button><input class="chat-message" type="text" maxlength="120" autocomplete="off" aria-label="ข้อความแชท" placeholder="พิมพ์ข้อความ..." hidden><button type="submit" class="chat-send">ส่ง</button></div>
          <div class="chat-emoji-picker" id="chat-emoji-picker" aria-label="เลือกอีโมจิ" hidden></div>
          <p class="chat-key-hint"><kbd>Tab</kbd> เลือกปุ่ม · <kbd>Enter</kbd> ส่ง · <kbd>Esc</kbd> ปิด</p>
        </form>
        <p class="chat-feedback" role="status" hidden></p>
        <p class="chat-system-note" hidden>บันทึกการต่อสู้ ไอเทม และประกาศ · อ่านอย่างเดียว</p>
      </div>`;
    (document.getElementById('app') ?? document.body).append(this.root);
    this.lines = this.root.querySelector('.net-lines'); this.input = this.root.querySelector('.chat-message');
    this.online = this.root.querySelector('.net-online');
    this.body = this.root.querySelector('.chat-body'); this.compose = this.root.querySelector('.chat-compose');
    this.recipient = this.root.querySelector('.chat-recipient input'); this.feedback = this.root.querySelector('.chat-feedback');
    this.tabs = [...this.root.querySelectorAll('[role="tab"]')];
    this.toggleButton = this.root.querySelector('.chat-toggle');
    this.emojiToggle = this.root.querySelector('.chat-emoji-toggle');
    this.emojiPicker = this.root.querySelector('.chat-emoji-picker');
    for (const emoji of ['🙂', '😊', '😄', '🙏', '❤️', '🔥', '✨', '👍']) {
      const button = document.createElement('button'); button.type = 'button'; button.textContent = emoji;
      button.setAttribute('aria-label', `ใส่ ${emoji}`);
      button.addEventListener('click', () => {
        const start = this.input.selectionStart ?? this.input.value.length, end = this.input.selectionEnd ?? start;
        if (this.input.value.length - (end - start) + emoji.length <= this.input.maxLength) this.input.setRangeText(emoji, start, end, 'end');
        this.closeEmoji(); this.input.focus();
      });
      this.emojiPicker.append(button);
    }
    this.emojiToggle.addEventListener('click', () => {
      this.emojiPicker.hidden = !this.emojiPicker.hidden;
      this.emojiToggle.setAttribute('aria-expanded', String(!this.emojiPicker.hidden));
    });
    this.paint();
    document.addEventListener('visibilitychange', () => this.markRead());
    this.root.addEventListener('focusin', () => this.markRead());
    window.addEventListener('keydown', e => {
      if (e.defaultPrevented || e.code !== 'Enter' || this.root.contains(e.target) ||
          e.target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
      if (e.target.tagName === 'BUTTON') e.target.blur();
      e.preventDefault(); this.open();
    });
    this.root.addEventListener('keydown', e => {
      // Stop combat/window shortcuts from every focused control, including tabs.
      e.stopPropagation();
      if (e.isComposing) return;
      if (e.code === 'Escape') { e.preventDefault(); this.close(); }
      else if (e.code === 'Enter' && (e.target === this.input || e.target === this.recipient)) {
        e.preventDefault(); this.submit();
      }
      const tab = e.target.closest('[role="tab"]');
      if (!tab || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) return;
      e.preventDefault();
      const index = this.tabs.indexOf(tab);
      const next = e.key === 'Home' ? 0 : e.key === 'End' ? this.tabs.length - 1 :
        (index + (['ArrowRight','ArrowDown'].includes(e.key) ? 1 : -1) + this.tabs.length) % this.tabs.length;
      this.select(this.tabs[next].dataset.tab); this.tabs[next].focus();
    });
    this.root.querySelector('.chat-tabs').addEventListener('click', e => {
      const tab = e.target.closest('[data-tab]'); if (tab) this.select(tab.dataset.tab);
    });
    this.compose.addEventListener('submit', e => { e.preventDefault(); this.submit(); });
    // Moving from the input to Send, a tab or the recipient is still inside chat.
    this.root.addEventListener('focusout', e => {
      if (this.root.contains(e.relatedTarget)) return;
      queueMicrotask(() => {
        if (this.root.contains(document.activeElement)) return;
        if (document.body.classList.contains('ui-touch') || matchMedia('(max-width: 900px)').matches) this.close();
        else { this.closeEmoji(); this.root.classList.remove('typing'); }
      });
    });
    this.root.querySelector('header').addEventListener('click', e => {
      if (e.target.closest('.drag-lock,.chat-gm-toggle')) return;
      if (!this.collapsed) this.close();
      else {
        this.collapsed = false; this.root.classList.add('typing'); this.paint(); this.markRead();
        this.tabs.find(tab => tab.dataset.tab === this.channel).focus();
      }
    });
    draggable(this.root, { key: 'chat', lockable: true });
  }

  select(channel) {
    if (!(channel in CHANNELS)) return;
    this.channel = channel; this.feedback.hidden = true; this.closeEmoji();
    this.paint(); this.markRead();
  }

  paint() {
    this.body.hidden = this.collapsed;
    this.root.classList.toggle('chat-collapsed', this.collapsed);
    this.toggleButton.setAttribute('aria-expanded', String(!this.collapsed));
    this.toggleButton.setAttribute('aria-label', this.collapsed ? 'เปิดแผงสนทนา' : 'พับแผงสนทนา');
    this.root.querySelector('.chat-fold').textContent = this.collapsed ? '›' : '‹';
    for (const tab of this.tabs) {
      const selected = tab.dataset.tab === this.channel;
      tab.setAttribute('aria-selected', String(selected)); tab.tabIndex = selected ? 0 : -1;
    }
    this.lines.setAttribute('aria-labelledby', `chat-tab-${this.channel}`);
    this.root.querySelector('.chat-subtitle').textContent = CHANNELS[this.channel];
    for (const line of this.lines.children) line.hidden = line.dataset.channel !== this.channel;
    this.input.hidden = this.collapsed || this.channel === 'system';
    this.compose.hidden = this.input.hidden;
    this.root.querySelector('.chat-system-note').hidden = this.collapsed || this.channel !== 'system';
    this.recipient.parentElement.hidden = this.channel !== 'whisper';
    this.input.placeholder = this.channel === 'party' ? 'ข้อความถึงปาร์ตี้' : this.channel === 'whisper' ? 'ข้อความกระซิบ' : 'ข้อความถึงทุกคนในเซิร์ฟเวอร์';
    this.paintUnread();
  }

  visible(channel = this.channel) {
    return channel === this.channel && !this.collapsed && !document.hidden && this.root.getClientRects().length > 0;
  }

  markRead() {
    if (!this.visible()) return;
    this.unread[this.channel] = 0; this.paintUnread();
  }

  paintUnread() {
    for (const tab of this.tabs) {
      const count = this.unread[tab.dataset.tab], badge = tab.querySelector('.chat-unread');
      badge.hidden = !count; badge.textContent = count > 99 ? '99+' : String(count);
      tab.setAttribute('aria-label', `${CHANNELS[tab.dataset.tab]}${count ? ` · ${count} ข้อความใหม่` : ''}`);
    }
    const total = Object.values(this.unread).reduce((sum, n) => sum + n, 0);
    const badge = this.root.querySelector('.chat-total'); badge.hidden = !total; badge.textContent = total > 99 ? '99+' : String(total);
  }

  open(text = null) {
    if (this.channel === 'system') this.channel = 'general';
    if (text !== null) {
      this.input.value = text;
      const whisper = /^\/w\s+(\S+)/.exec(text);
      if (whisper) { this.channel = 'whisper'; this.recipient.value = whisper[1]; }
      else if (/^\/p\b/.test(text)) this.channel = 'party';
    }
    this.collapsed = false; this.input.hidden = false; this.root.classList.add('typing');
    this.paint(); this.markRead(); this.input.focus();
  }

  close() {
    this.closeEmoji();
    this.input.hidden = true; this.root.classList.remove('typing');
    this.collapsed = true;
    this.paint();
    if (this.root.contains(document.activeElement)) document.activeElement.blur();
  }

  closeEmoji() {
    this.emojiPicker.hidden = true; this.emojiToggle.setAttribute('aria-expanded', 'false');
  }

  submit() {
    if (this.channel === 'system') return;
    const text = this.input.value.trim();
    if (!text) return;
    const fail = message => { this.feedback.textContent = message; this.feedback.hidden = false; };
    if (!this.online_) { fail('ออฟไลน์อยู่ · ข้อความยังส่งไม่ได้'); return; }
    let command = text;
    // Explicit commands retain Social's /p, /w and /r semantics in every tab.
    if (!text.startsWith('/')) {
      if (this.channel === 'party') command = `/p ${text}`;
      if (this.channel === 'whisper') {
        const to = this.recipient.value.trim();
        if (!to || /\s/.test(to)) { fail('กรอกชื่อผู้รับกระซิบ (ใช้ /w ชื่อ ข้อความ)'); this.recipient.focus(); return; }
        command = `/w ${to} ${text}`;
      }
    }
    if (command !== text && !this.filter) { fail('ระบบปาร์ตี้และกระซิบยังไม่พร้อม'); return; }
    if (!this.filter?.(command)) this.send(command);
    this.input.value = ''; this.feedback.hidden = true; this.closeEmoji(); this.input.focus();
  }

  add(name, text, kind = '', title = null) {
    const channel = kind === 'party' ? 'party' : kind === 'whisper' ? 'whisper' :
      kind === 'gm' || kind === 'news' || kind === 'system' || name === 'ระบบ' || name === 'ประกาศ' || name === 'บอสโลก' ? 'system' : 'general';
    const line = document.createElement('p');
    // Only the local, whitelisted title catalogue produces markup; message/name are text.
    line.innerHTML = `${titleHtml(title, { brackets: true })}<b></b> <span></span>`;
    if (kind) line.className = kind;
    line.dataset.channel = channel; line.hidden = channel !== this.channel;
    line.querySelector('b').textContent = name; line.querySelector('span').textContent = text;
    const atBottom = this.lines.scrollHeight - this.lines.scrollTop - this.lines.clientHeight < 24;
    this.lines.append(line);
    const history = [...this.lines.children].filter(item => item.dataset.channel === channel);
    while (history.length > 30) history.shift().remove();
    if (this.visible(channel)) this.markRead(); else { this.unread[channel]++; this.paintUnread(); }
    if (atBottom) this.lines.scrollTop = this.lines.scrollHeight;
    setTimeout(() => line.classList.add('old'), 12000);
  }

  setOnline(n) { this.online.textContent = `ออนไลน์ ${n} คน`; }
  setGmCatalog(catalog) {
    this.gmButton?.remove(); this.gmPanel?.remove();
    this.gmButton = this.gmPanel = null;
    const entries = Array.isArray(catalog) ? catalog.filter(c => typeof c?.id === 'string' && typeof c.usage === 'string' && typeof c.description === 'string').slice(0, 40) : [];
    if (!entries.length) {
      for (const line of [...this.lines.children]) if (line.classList.contains('gm')) line.remove();
      return;
    }
    const button = this.gmButton = document.createElement('button');
    button.type = 'button'; button.className = 'chat-gm-toggle'; button.textContent = 'GM';
    button.setAttribute('aria-label', 'วิธีใช้คำสั่ง GM'); button.setAttribute('aria-expanded', 'false');
    this.root.querySelector('header').append(button);
    const panel = this.gmPanel = document.createElement('div'); panel.className = 'chat-gm-help'; panel.hidden = true;
    panel.setAttribute('aria-label', 'คำสั่งสำหรับแอดมิน');
    for (const entry of entries) {
      const row = document.createElement('button'); row.type = 'button';
      const usage = document.createElement('code'), description = document.createElement('span');
      usage.textContent = entry.usage; description.textContent = entry.description; row.append(usage, description);
      row.addEventListener('click', () => { this.channel = 'general'; this.open(`/gm ${entry.id} `); });
      panel.append(row);
    }
    this.body.prepend(panel);
    button.addEventListener('click', e => {
      e.stopPropagation(); const show = panel.hidden; this.open(); panel.hidden = !show;
      button.setAttribute('aria-expanded', String(show));
    });
  }
  setStatus(on, final = false) {
    this.online_ = on; this.root.classList.toggle('offline', !on);
    if (!on) this.online.textContent = final ? 'ออฟไลน์' : 'ออฟไลน์ · กำลังเชื่อมต่อ';
  }
}
