import { describeObjective, rewardText, requirementText, lockedReason, npcName, escapeQuestText as esc } from '../quest/questPresentation.js';
import './quests.css';
export { describeObjective } from '../quest/questPresentation.js';

const $ = id => document.getElementById(id);

// Quest blocks inside the NPC dialogue, and the tracker in the journal panel.
export class QuestUI {
  constructor(quests, { onAccept, onComplete }) {
    this.quests = quests;
    $('dlg-quests').addEventListener('click', e => {
      const b = e.target.closest('button[data-quest]');
      if (!b || b.disabled) return;
      if (b.dataset.action === 'accept') onAccept(b.dataset.quest); else onComplete(b.dataset.quest);
    });
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
    const list = this.quests.tracker(describeObjective).slice(0, 3);
    $('quest-tracker').innerHTML = list.map(q => `<b class="${q.complete ? 'ready' : ''}">${q.complete ? '? ' : '◆ '}${esc(q.title)}${q.complete ? ' · ส่งได้แล้ว' : ''}</b>${q.complete ? `<span class="quest-return">กลับไปหา${esc(npcName(q.turnIn))}</span>` : ''}${q.lines.map(l => `<span class="${l.have >= l.need ? 'done' : ''}">${esc(l.text)} ${l.need > 1 ? `${l.have}/${l.need}` : l.have ? '✓' : ''}</span>`).join('<br>')}`).join('');
  }
}
