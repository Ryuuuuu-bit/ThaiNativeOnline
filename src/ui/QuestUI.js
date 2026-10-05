import { ITEMS } from '../character/data/items.js';
import { MONSTERS } from '../combat/data/monsters.js';
import { landmark } from '../data/landmarks.js';
import { NPCS } from '../data/npcs.js';

const $ = id => document.getElementById(id);
const npcName = id => NPCS.find(n => n.id === id)?.name ?? id;

export function describeObjective(o) {
  if (o.discover) return `สำรวจ${landmark(o.discover)?.name ?? o.discover}`;
  if (o.kill) return `ปราบ${MONSTERS[o.kill]?.name ?? o.kill}`;
  if (o.collect) return `เก็บ${ITEMS[o.collect]?.name ?? o.collect}`;
  if (o.talk) return `คุยกับ${npcName(o.talk)}`;
  return '';
}
const rewardText = r => [r.gold && `${r.gold} ทอง`, r.exp && `${r.exp} EXP`, ...(r.items ?? []).map(([id, qty = 1]) => `${ITEMS[id]?.name ?? id}${qty > 1 ? ` ×${qty}` : ''}`)].filter(Boolean).join(' · ');

// Quest blocks inside the NPC dialogue, and the tracker in the journal panel.
export class QuestUI {
  constructor(quests, { onAccept, onComplete }) {
    this.quests = quests;
    $('dlg-quests').addEventListener('click', e => {
      const b = e.target.closest('button[data-quest]');
      if (!b) return;
      if (b.dataset.action === 'accept') onAccept(b.dataset.quest); else onComplete(b.dataset.quest);
    });
  }
  objectivesHtml(q) {
    return `<ul>${q.objectives.map(o => { const p = this.quests.objectiveProgress(q, o); return `<li class="${p.have >= p.need ? 'done' : ''}">${describeObjective(o)}${p.need > 1 ? ` ${p.have}/${p.need}` : p.have ? ' ✓' : ''}</li>`; }).join('')}</ul>`;
  }
  renderDialogue(npcId) {
    const qs = this.quests;
    if (!qs.character) { $('dlg-quests').innerHTML = ''; return; }
    const ready = qs.ready(npcId), offers = qs.offers(npcId), waiting = qs.active().filter(q => qs.turnInOf(q) === npcId && !qs.isComplete(q.id));
    $('dlg-quests').innerHTML = [
      ...ready.map(q => `<div class="quest"><h4>? ${q.title}</h4><p>${q.done}</p><div class="reward">รางวัล: ${rewardText(q.rewards ?? {})}</div><button data-quest="${q.id}" data-action="complete">ส่งเควส</button></div>`),
      ...offers.map(q => `<div class="quest"><h4>! ${q.title}</h4><p>${q.offer}</p>${this.objectivesHtml(q)}<div class="reward">รางวัล: ${rewardText(q.rewards ?? {})}</div><button data-quest="${q.id}" data-action="accept">รับเควส</button></div>`),
      ...waiting.map(q => `<div class="quest"><h4>… ${q.title}</h4>${this.objectivesHtml(q)}</div>`),
    ].join('');
  }
  renderTracker() {
    const list = this.quests.tracker(describeObjective).slice(0, 3);
    $('quest-tracker').innerHTML = list.map(q => `<b class="${q.complete ? 'ready' : ''}">${q.complete ? '? ' : '◆ '}${q.title}${q.complete ? ' · ส่งได้แล้ว' : ''}</b>${q.lines.map(l => `<span class="${l.have >= l.need ? 'done' : ''}">${l.text} ${l.need > 1 ? `${l.have}/${l.need}` : l.have ? '✓' : ''}</span>`).join('<br>')}`).join('');
  }
}
