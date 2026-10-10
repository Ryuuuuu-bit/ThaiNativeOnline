import { describeObjective, rewardText, requirementText, lockedReason, npcName, escapeQuestText as esc } from '../quest/questPresentation.js';
import './quests.css';
import { NEWCOMER_GUIDE } from '../data/newcomer-guide.js';
import { newcomerJourney } from '../quest/newcomerJourney.js';
export { describeObjective } from '../quest/questPresentation.js';

const $ = id => document.getElementById(id);

// Quest blocks inside the NPC dialogue, and the tracker in the journal panel.
export class QuestUI {
  constructor(quests, { onAccept, onComplete, onPanel = () => {} }) {
    this.quests = quests;
    this.guide = document.createElement('section');
    this.guide.id = 'newcomer-guide';
    $('quest-tracker').before(this.guide);
    this.journalButton = document.createElement('button');
    this.journalButton.id = 'newcomer-journal-toggle';
    this.journalButton.type = 'button';
    this.journalButton.textContent = 'เส้นทาง Lv 1–20';
    this.journalButton.setAttribute('aria-expanded', 'false');
    this.journalButton.setAttribute('aria-controls', 'newcomer-guide');
    document.getElementById('app').append(this.journalButton);
    this.journalButton.addEventListener('click', () => this.toggleJournal());
    this.guide.addEventListener('click', e => {
      const b = e.target.closest('button[data-panel]');
      if (b) { if (b.dataset.panel !== 'quests') this.toggleJournal(false); onPanel(b.dataset.panel); }
    });
    $('dlg-quests').addEventListener('click', e => {
      const b = e.target.closest('button[data-quest]');
      if (!b || b.disabled) return;
      if (b.dataset.action === 'accept') onAccept(b.dataset.quest); else onComplete(b.dataset.quest);
    });
  }
  toggleJournal(open = !document.body.classList.contains('newcomer-journal-open')) {
    document.body.classList.toggle('newcomer-journal-open', open);
    this.journalButton.setAttribute('aria-expanded', String(open));
    this.journalButton.textContent = open ? 'ปิดเส้นทาง Lv 1–20' : 'เส้นทาง Lv 1–20';
    if(open)this.guide.parentElement.prepend(this.journalButton);
    else document.getElementById('app').append(this.journalButton);
    this.journalButton.focus({preventScroll:true});
  }
  objectivesHtml(q) {
    return `<ul>${q.objectives.map(o => {
      const p = this.quests.objectiveProgress(q, o);
      return `<li class="${p.have >= p.need ? 'done' : ''}">${esc(describeObjective(o))}${p.need > 1 ? ` ${p.have}/${p.need}` : p.have ? ' ✓' : ''}${o.hint ? `<small>${esc(o.hint)}</small>` : ''}</li>`;
    }).join('')}</ul>`;
  }
  detailsHtml(q) {
    return `<p class="quest-requirements">${esc(requirementText(q, this.quests.defs))}</p>${q.guide ? `<p class="quest-guide">${esc(q.guide)}</p>` : ''}${q.training ? `<p class="quest-training">${esc(q.training)}</p>` : ''}`;
  }
  rewardHtml(q) {
    return `<div class="reward">รางวัล: ${esc(rewardText(q.rewards))}${q.objectives.some(o => o.collect) ? '<small>ส่งของที่ไม่ได้ล็อกตามจำนวนจากกระเป๋าเมื่อรับรางวัล</small>' : ''}</div>`;
  }
  renderDialogue(npcId) {
    const qs = this.quests;
    if (!qs.character) { $('dlg-quests').innerHTML = ''; return; }
    const ready = qs.ready(npcId), offers = qs.offers(npcId), waiting = qs.active().filter(q => qs.turnInOf(q) === npcId && !qs.isComplete(q.id)), locked = qs.locked(npcId);
    $('dlg-quests').innerHTML = [
      ...ready.map(q => `<div class="quest"><h4>? ${esc(q.title)}</h4>${this.detailsHtml(q)}<p>${esc(q.done)}</p>${this.rewardHtml(q)}<button data-quest="${esc(q.id)}" data-action="complete">ส่งเควสและรับรางวัล</button></div>`),
      ...offers.map(q => `<div class="quest"><h4>! ${esc(q.title)}</h4>${this.detailsHtml(q)}<p>${esc(q.offer)}</p>${this.objectivesHtml(q)}${this.rewardHtml(q)}<button data-quest="${esc(q.id)}" data-action="accept">รับเควส</button></div>`),
      ...waiting.map(q => `<div class="quest"><h4>… ${esc(q.title)}</h4>${this.detailsHtml(q)}${this.objectivesHtml(q)}${this.rewardHtml(q)}</div>`),
      ...locked.map(q => `<div class="quest quest-locked"><h4>${esc(q.title)}</h4><p class="quest-requirements">${esc(lockedReason(q, qs))}</p>${this.rewardHtml(q)}<button disabled>ยังรับเควสไม่ได้</button></div>`),
    ].join('');
  }
  renderTracker() {
    this.renderGuide();
    const list = this.quests.tracker(describeObjective).slice(0, 3);
    $('quest-tracker').innerHTML = list.map(q => `<b class="${q.complete ? 'ready' : ''}">${q.complete ? '? ' : '◆ '}${esc(q.title)}${q.complete ? ' · ส่งได้แล้ว' : ''}</b>${q.complete ? `<span class="quest-return">กลับไปหา${esc(npcName(q.turnIn))}</span>` : ''}${q.lines.map(l => `<span class="${l.have >= l.need ? 'done' : ''}">${esc(l.text)} ${l.need > 1 ? `${l.have}/${l.need}` : l.have ? '✓' : ''}</span>`).join('<br>')}`).join('');
  }
  renderGuide() {
    const journey = newcomerJourney(this.quests, NEWCOMER_GUIDE);
    if (!journey) { this.guide.innerHTML = ''; return; }
    const { step, quest, level, milestones } = journey;
    const qs = this.quests;
    const next = quest ? qs.status(quest.id) === 'active'
      ? qs.isComplete(quest.id) ? `ส่งเควสกับ${npcName(qs.turnInOf(quest))}` : 'ทำเป้าหมายด้านล่างให้ครบ'
      : qs.canAccept(quest) ? `รับเควสกับ${npcName(quest.giver)}` : lockedReason(quest, qs) : 'ฝึกต่อและเตรียมเสบียงสำหรับช่วงถัดไป';
    const html = `<details open><summary>เส้นทางผู้มาใหม่ · Lv ${esc(level)} → 20</summary><h3>${esc(step.title)}</h3>${(step.lines ?? []).map(line => `<p>${esc(line)}</p>`).join('')}<p class="newcomer-next"><strong>ถัดไป:</strong> ${esc(next)}</p>${quest ? `<b>${esc(quest.title)}</b>${this.objectivesHtml(quest)}${this.rewardHtml(quest)}` : ''}<div class="newcomer-actions">${(step.actions ?? []).map(a => `<button type="button" data-panel="${esc(a.panel)}">${esc(a.label)}</button>`).join('')}</div><details class="newcomer-milestones"><summary>ช่วงการเดินทาง ${milestones.filter(s => s.done).length}/${milestones.length}</summary><ol>${milestones.map(s => `<li${s.id === step.id ? ' aria-current="step"' : ''}>${s.done ? '✓ ' : ''}${esc(s.title)}</li>`).join('')}</ol></details></details>`;
    if (html !== this.guideHtml) { this.guideHtml = html; this.guide.innerHTML = html; }
  }
}
