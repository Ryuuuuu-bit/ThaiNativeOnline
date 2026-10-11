import { describeObjective, rewardText, requirementText, lockedReason, npcName, escapeQuestText as esc } from '../quest/questPresentation.js';
import './quests.css';
import { NEWCOMER_GUIDE } from '../data/newcomer-guide.js';
import { newcomerJourney } from '../quest/newcomerJourney.js';
import { passMovementKey } from './nonmodalKeys.js';
import { questHudPlacement } from './questHudLayout.js';
export { describeObjective } from '../quest/questPresentation.js';

const $ = id => document.getElementById(id);

// Quest blocks inside the NPC dialogue, and the tracker in the journal panel.
export class QuestUI {
  constructor(quests, { onAccept, onComplete, onPanel = () => {}, onJournal = () => {}, onNavigate = () => {}, navigation = () => null }) {
    this.quests = quests;
    Object.assign(this, { onJournal, onNavigate, navigation });
    this.guide = document.createElement('section');
    this.guide.id = 'newcomer-guide';
    this.root = document.createElement('aside'); this.root.id = 'quest-objective-hud';
    this.root.setAttribute('aria-label', 'เป้าหมายเควสที่ติดตาม');
    this.root.innerHTML = `<div class="quest-hud-heading"><span>◆ ภารกิจที่ติดตาม</span><button type="button" data-quest-nav="untrack" aria-label="เลิกติดตามเควส" title="เลิกติดตาม">×</button></div><b class="quest-hud-title"></b><div class="quest-hud-objective"><span></span><em></em></div><small class="quest-hud-state" role="status"></small><nav aria-label="นำทางเควส"><button type="button" data-quest-nav="map">แผนที่</button><button type="button" data-quest-nav="walk">เดินไป</button><button type="button" data-quest-nav="stop" hidden>หยุด</button><button type="button" data-quest-nav="journal">สมุด</button></nav>`;
    const chip = document.createElement('button'); chip.type = 'button'; chip.className = 'quest-hud-open'; chip.dataset.questOpen = ''; chip.innerHTML = '<span><b class="quest-chip-distance"></b><small class="quest-chip-objective"></small></span><em></em>'; this.root.append(chip);
    const direction = document.createElement('div'); direction.className = 'quest-hud-direction'; direction.innerHTML = '<i aria-hidden="true">↑</i><span></span>'; this.root.querySelector('.quest-hud-state').before(direction);
    const chipArrow = document.createElement('i'); chipArrow.className = 'quest-chip-arrow'; chipArrow.setAttribute('aria-hidden', 'true'); chipArrow.textContent = '↑'; chip.prepend(chipArrow);
    document.getElementById('app').append(this.root);
    this.root.addEventListener('pointerdown', e => e.stopPropagation());
    this.root.addEventListener('keydown', e => { if (e.code !== 'Escape' && !passMovementKey(e)) e.stopPropagation(); });
    this.root.addEventListener('click', e => { const b = e.target.closest('[data-quest-nav],[data-quest-open]'); if (b) onNavigate(b.dataset.questNav ?? b.dataset.navAction); });
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
  toggleJournal(open = true) { this.onJournal(open); }
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
    const state = this.navigation(), objective = state?.objective;
    this.root.hidden = !objective || !!state?.hidden || !!this.covered;
    if (!objective) return;
    this.root.querySelector('.quest-hud-title').textContent = objective.quest.title;
    this.root.querySelector('.quest-hud-objective span').textContent = objective.text;
    this.root.querySelector('.quest-hud-objective em').textContent = objective.progress ? `${objective.progress.have}/${objective.progress.need}` : objective.complete ? 'พร้อมส่ง' : 'ยังไม่รับ';
    const status = this.root.querySelector('.quest-hud-state');
    status.textContent = state.guidance?.status || state.message || objective.reason || objective.step?.name || '';
    status.title = status.textContent;
    this.root.dataset.walking = String(!!state.active);
    const walk = this.root.querySelector('[data-quest-nav="walk"]');
    walk.hidden = !!state.active; walk.disabled = !objective.step || !!objective.reason;
    walk.title = objective.reason || (objective.crossMap ? 'เดินไปประตู แล้วกดเดินต่อเมื่อข้ามแผนที่' : 'เดินตามเส้นทางที่ผ่านได้');
    this.root.querySelector('[data-quest-nav="stop"]').hidden = !state.active;
    const chip = this.root.querySelector('.quest-hud-open');
    const chipStatus = objective.reason || (!state.active && state.message) ? status.textContent
      : state.guidance?.arrived ? (objective.crossMap ? 'ถึงประตู · ข้ามแล้วกดเดินต่อ' : 'ถึงจุดหมาย · ทำด้วยตนเอง')
        : objective.crossMap ? 'ไปประตู · ข้ามแล้วกดเดินต่อ' : objective.text;
    const distanceLabel = chip.querySelector('.quest-chip-distance');
    distanceLabel.textContent = state.guidance?.distance != null ? `${state.guidance.distanceKind === 'path' ? 'ตามทาง' : 'ตรง'} ${Math.round(state.guidance.distance)} วา` : state.guidance?.label ?? '';
    distanceLabel.hidden = !state.guidance;
    chip.querySelector('.quest-chip-objective').textContent = chipStatus;
    chip.querySelector('em').textContent = state.active ? '■' : objective.progress ? `${objective.progress.have}/${objective.progress.need}` : '◆';
    chip.dataset.navAction = state.active ? 'stop' : 'journal';
    chip.setAttribute('aria-label', `${state.active ? 'หยุดนำทาง' : 'เปิดสมุดเควส'} · ${objective.quest.title} · ${objective.text} · ${state.guidance?.label ?? ''} · ${status.textContent}`);
    chip.title = `${objective.quest.title} · ${status.textContent}`;
    const direction = this.root.querySelector('.quest-hud-direction'); direction.querySelector('span').textContent = state.guidance?.label ?? '';
    direction.hidden = !state.guidance;
    for (const arrow of [direction.querySelector('i'), chip.querySelector('i')]) {
      arrow.hidden = state.guidance?.arrow == null;
      arrow.style.transform = `rotate(${state.guidance?.arrow ?? 0}deg)`;
    }
    $('quest-tracker').replaceChildren();
    this.layout();
  }
  layout() {
    const touch = document.body.classList.contains('ui-touch');
    const mini = document.querySelector('.minimap')?.getBoundingClientRect();
    if (!mini) return;
    this.root.dataset.compact = 'false';
    const placement = questHudPlacement({ touch, mini, width: innerWidth, height: innerHeight,
      fullHeight: this.root.getBoundingClientRect().height,
      hotbar: document.querySelector('.hotbar.action-bar')?.getBoundingClientRect(),
      protectedRects: touch ? [...document.querySelectorAll('.minimap,.location,.plate.is-self,.g-player,.net-chat,.mm-btn,.touch-side,.touch-combat-dock,.touch-pad,.touch-zone,.touch-utilities')].map(el => el.getBoundingClientRect()) : [] });
    this.root.dataset.compact = String(placement.compact);
    this.root.style.setProperty('--quest-top', `${placement.top}px`);
    this.root.style.setProperty('--quest-right', `${placement.right}px`);
    if (placement.hidden) this.root.hidden = true;
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
