import { describeObjective, rewardText, requirementText, npcName, escapeQuestText as esc } from '../quest/questPresentation.js';
import './player-guide.css';
import './quest-journal.css';

const statusLabel = { active: 'กำลังทำ', ready: 'พร้อมส่ง', done: 'ส่งแล้ว' };

// Read-only journal: the parent owns map navigation and NPC dialogue actions.
export class QuestJournal {
  constructor({ quests, prepare = () => {}, locate = () => {} }) {
    Object.assign(this, { quests, prepare, locate });
    this.root = document.createElement('div');
    this.root.id = 'quest-journal-overlay';
    this.root.className = 'qol-overlay';
    this.root.hidden = true;
    this.root.innerHTML = `<section class="guide-panel quest-journal-panel" role="dialog" aria-modal="true" aria-labelledby="quest-journal-title" tabindex="-1">
      <header class="guide-head"><div><small>บันทึกผู้เดินทาง</small><h2 id="quest-journal-title">สมุดเควส</h2><p>ทบทวนภารกิจ แล้วกลับไปส่งกับผู้มอบหมาย</p></div><button type="button" data-journal-close aria-label="ปิดสมุดเควส">×</button></header>
      <div class="guide-body"><div class="guide-index quest-journal-index">
        <label>ค้นหาเควส เป้าหมาย หรือผู้รับเควส<input id="quest-journal-search" type="search" placeholder="ค้นหาเควส / NPC…"></label>
        <label>สถานะ<select id="quest-journal-filter"><option value="active">เควสที่กำลังทำ</option><option value="ready">พร้อมส่ง</option><option value="done">ส่งแล้ว</option><option value="all">ทั้งหมดที่เคยรับ</option></select></label>
        <small id="quest-journal-count" role="status" aria-live="polite"></small>
        <div id="quest-journal-list" aria-label="รายการเควส"></div>
      </div><article id="quest-journal-detail" class="guide-detail" aria-label="รายละเอียดเควส" tabindex="0"></article></div>
    </section>`;
    (document.getElementById('app') ?? document.body).append(this.root);
    this.$ = selector => this.root.querySelector(selector);
    this.root.addEventListener('click', event => {
      if (event.target === this.root || event.target.closest('[data-journal-close]')) { this.close(); return; }
      const row = event.target.closest('[data-journal-quest]');
      if (row) { this.selectedId = row.dataset.journalQuest; this.render(); return; }
      if (event.target.closest('[data-journal-locate]')) {
        const q = this.quests.defs.get(this.selectedId);
        const npcId = q && this.quests.turnInOf(q);
        if (npcId) { this.close(); this.locate(npcId); }
      }
    });
    this.$('#quest-journal-search').addEventListener('input', () => this.render());
    this.$('#quest-journal-filter').addEventListener('change', () => this.render());
    this.root.addEventListener('keydown', event => this.onKeydown(event));
    this.keepFocus = event => {
      if (this.open && !this.root.contains(event.target)) this.$('[data-journal-close]').focus();
    };
    this.unsubscribe = quests.on('change', () => { if (this.open) this.render(); });
  }

  get open() { return !this.root.hidden; }

  show() {
    if (this.open) return;
    this.previousFocus = document.activeElement;
    this.prepare();
    this.root.hidden = false;
    this.render();
    document.addEventListener('focusin', this.keepFocus);
    this.$('#quest-journal-search').focus();
  }

  close() {
    if (!this.open) return;
    this.root.hidden = true;
    document.removeEventListener('focusin', this.keepFocus);
    if (this.previousFocus?.isConnected) this.previousFocus.focus?.({ preventScroll: true });
  }

  destroy() {
    this.close();
    this.unsubscribe?.();
    this.root.remove();
  }

  onKeydown(event) {
    if (!this.open) return;
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); this.close(); return; }
    if (event.key !== 'Tab') return;
    const focus = [...this.root.querySelectorAll('button, input, select, [tabindex="0"]')]
      .filter(el => !el.disabled && el.getClientRects().length);
    const first = focus[0], last = focus.at(-1), current = document.activeElement;
    if (!first) { event.preventDefault(); this.$('[role="dialog"]').focus(); return; }
    if (event.shiftKey && (current === first || !focus.includes(current))) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && (current === last || !focus.includes(current))) { event.preventDefault(); first.focus(); }
  }

  entries() {
    const query = this.$('#quest-journal-search').value.trim().toLocaleLowerCase('th-TH');
    const filter = this.$('#quest-journal-filter').value;
    return [...this.quests.defs.values()].flatMap(q => {
      const state = this.quests.status(q.id);
      if (state !== 'active' && state !== 'done') return [];
      const status = state === 'done' ? 'done' : this.quests.isComplete(q.id) ? 'ready' : 'active';
      if (filter === 'active' ? state !== 'active' : filter !== 'all' && filter !== status) return [];
      const search = [q.title, q.guide, q.training, q.offer, npcName(q.giver), npcName(this.quests.turnInOf(q)),
        rewardText(q.rewards), ...q.objectives.flatMap(o => [describeObjective(o), o.hint])].join(' ').toLocaleLowerCase('th-TH');
      return !query || search.includes(query) ? [{ q, status }] : [];
    });
  }

  detailsHtml(q, status) {
    const done = status === 'done', npcId = this.quests.turnInOf(q);
    return `<header class="guide-monster-head"><small class="quest-journal-status ${status}">${statusLabel[status]}</small><h3>${esc(q.title)}</h3><p>${esc(requirementText(q, this.quests.defs))}</p></header>
      ${q.offer ? `<p class="quest-journal-description">${esc(q.offer)}</p>` : ''}
      ${q.guide ? `<p class="quest-journal-description">${esc(q.guide)}</p>` : ''}
      ${q.training ? `<p class="guide-note">${esc(q.training)}</p>` : ''}
      <h4>เป้าหมาย</h4><ul class="quest-journal-objectives">${q.objectives.map(o => {
        // Completed quests retain fulfilled objectives even after hand-in consumes materials.
        const p = this.quests.objectiveProgress(q, o), fulfilled = done || p.have >= p.need;
        return `<li class="${fulfilled ? 'fulfilled' : ''}"><div><span>${fulfilled ? '✓ ' : ''}${esc(describeObjective(o))}</span><b>${esc(done ? p.need : p.have)} / ${esc(p.need)}</b></div>${o.hint ? `<small>${esc(o.hint)}</small>` : ''}</li>`;
      }).join('')}</ul>
      <h4>${done ? 'รางวัลที่ได้รับ' : 'รางวัลเมื่อส่งเควส'}</h4><p class="quest-journal-reward">${esc(rewardText(q.rewards) || 'ไม่มีรางวัลระบุ')}</p>
      ${!done && q.objectives.some(o => o.collect) ? '<p class="guide-note">ส่งของที่ไม่ได้ล็อกตามจำนวนจากกระเป๋าเมื่อรับรางวัล</p>' : ''}
      <h4>ผู้รับส่งเควส</h4><div class="guide-locations"><button type="button" data-journal-locate ${npcId ? '' : 'disabled'}><span><b>${esc(npcName(npcId) || 'ไม่ระบุ NPC')}</b><small>${done ? 'ส่งเควสแล้ว' : status === 'ready' ? 'เป้าหมายครบแล้ว · กลับไปคุยเพื่อรับรางวัล' : 'ทำเป้าหมายให้ครบ แล้วกลับมาส่งเควส'}</small></span><span>ดูแผนที่ ↗</span></button></div>
      <p class="guide-note">รับเควสและส่งเควสผ่านบทสนทนากับ NPC</p>`;
  }

  render() {
    if (!this.open) return;
    const list = this.entries();
    if (!list.some(({ q }) => q.id === this.selectedId)) this.selectedId = list[0]?.q.id ?? null;
    const host = this.$('#quest-journal-list'), detail = this.$('#quest-journal-detail');
    const listScroll = host.scrollTop, listLeft = host.scrollLeft;
    const detailScroll = this.renderedId === this.selectedId ? detail.scrollTop : 0;
    const focused = document.activeElement;
    const focusedId = focused?.dataset?.journalQuest;
    const locateFocused = focused?.hasAttribute?.('data-journal-locate');
    this.$('#quest-journal-count').textContent = `${list.length} เควส`;
    const empty = this.$('#quest-journal-search').value.trim() ? 'ไม่พบเควสที่ค้นหา · ลองเปลี่ยนคำค้นหรือสถานะ'
      : this.$('#quest-journal-filter').value === 'done' ? 'ยังไม่มีเควสที่ส่งแล้ว'
        : this.$('#quest-journal-filter').value === 'ready' ? 'ยังไม่มีเควสพร้อมส่ง · ทำเป้าหมายให้ครบก่อน'
          : 'ยังไม่มีเควสในรายการ · คุยกับ NPC เพื่อรับเควส';
    host.innerHTML = list.map(({ q, status }) => `<button type="button" class="guide-monster quest-journal-row" data-journal-quest="${esc(q.id)}" aria-pressed="${q.id === this.selectedId}"><span class="quest-journal-mark ${status}" aria-hidden="true">${status === 'ready' ? '?' : status === 'done' ? '✓' : '◆'}</span><span><b>${esc(q.title)}</b><small><span class="quest-journal-status ${status}">${statusLabel[status]}</span> · ${esc(npcName(this.quests.turnInOf(q)))}</small></span></button>`).join('') || `<p class="guide-empty">${empty}</p>`;
    const selected = list.find(({ q }) => q.id === this.selectedId);
    detail.innerHTML = selected ? this.detailsHtml(selected.q, selected.status) : '<p class="guide-empty">เลือกเควสเพื่ออ่านเป้าหมาย รางวัล และผู้รับส่งเควส</p>';
    host.scrollTop = listScroll; host.scrollLeft = listLeft; detail.scrollTop = detailScroll;
    this.renderedId = this.selectedId;
    if (focusedId !== undefined) {
      ([...host.querySelectorAll('[data-journal-quest]')].find(el => el.dataset.journalQuest === focusedId)
        ?? this.$('#quest-journal-search')).focus({ preventScroll: true });
    } else if (locateFocused) (this.$('[data-journal-locate]') ?? this.$('#quest-journal-search')).focus({ preventScroll: true });
  }
}
