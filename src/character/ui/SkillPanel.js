// Skill window (K): job level, skill points and the class's ten kit skills. Each skill opens
// at a job level (SKILL_UNLOCK_JOB) and goes up to MAX_SKILL_LEVEL with skill points (one per
// job level); the numbers shown are the rules' (src/rules/data/skills.js skillStats) at the
// current and next level. Reset gives every point back for gold. At Lv.5 some skills take path
// A or B (src/rules/data/evolutions.js): free the first time, gold to switch.
import { CLASS_KITS } from '../../classes/index.js';
import { SKILL_BY_ID, skillStats } from '../../rules/data/skills.js';
import { castInfo } from '../../training/kitCombat.js';
import { EVOLUTIONS, EVO_LEVEL } from '../../rules/data/evolutions.js';
import { MAX_SKILL_LEVEL, MAX_JOB_LEVEL } from '../data/progression.js';
import { el, esc, setBar } from './dom.js';

const facts = (kitSkill, lv, id = kitSkill.id) => {
  const base = SKILL_BY_ID[id], st = base ? skillStats(base, Math.max(1, lv)) : null, info = castInfo({ ...kitSkill, id }, Math.max(1, lv));
  return [st?.mult ? `ดาเมจ ×${st.mult}` : null, st?.hmult ? `รักษา ×${st.hmult}` : null, info.mp ? `MP ${info.mp}` : null, info.cd ? `คูล ${+info.cd.toFixed(1)} วิ` : null, info.cast ? `ร่าย ${+info.cast.toFixed(1)} วิ` : null, st?.duration ? `${(st.duration / 1000).toFixed(1)} วิ` : null].filter(Boolean).join(' · ');
};

export class SkillPanel {
  constructor(layer, character, feed) {
    this.c = character; this.feed = feed;
    this.kit = CLASS_KITS[character.classId] ?? null;
    this.root = el('section', 'g-panel g-skills glass', `<div class="panel-heading">สกิล<button aria-label="ปิด">×</button></div>
      <div class="g-job"><div class="g-job-head"><b></b><span></span></div><div class="g-bar g-jexp" title="Job EXP"><span></span><em></em></div></div>
      <ol class="g-skill-list"></ol>
      <div class="g-skill-foot"><button class="g-skill-reset"></button><small>Job Lv. ละ 1 แต้ม · สกิลสูงสุด Lv.${MAX_SKILL_LEVEL} · แต้มไม่พอให้อัปทุกสกิลเต็ม เลือกสายที่ชอบ</small></div>`);
    this.root.hidden = true;
    this.root.querySelector('.panel-heading button').addEventListener('click', () => { this.root.hidden = true; });
    this.root.addEventListener('click', e => {
      const up = e.target.closest('[data-learn]');
      const evo = e.target.closest('[data-evo]');
      if (evo) {
        const [id, pick] = evo.dataset.evo.split(':'), cost = this.c.evoCost(id, pick);
        if (this.c.chooseEvo(id, pick)) this.feed?.log(`${this.name(id)} → ${EVOLUTIONS[id][pick].name}${cost ? ` (−${cost} ทอง)` : ''}`, 'epic');
        else this.feed?.log(cost && this.c.gold < cost ? `เปลี่ยนสายต้องใช้ ${cost} ทอง` : 'เลือกสายไม่ได้', 'bad', true);
        return;
      }
      if (up) { const id = up.dataset.learn; if (this.c.learnSkill(id)) this.feed?.log(`อัปสกิล ${this.name(id)} เป็น Lv.${this.c.skillLevel(id)}`, 'gold'); else this.feed?.log(this.c.skillBlock(id) ?? 'อัปไม่ได้', 'bad', true); }
      if (e.target.closest('.g-skill-reset')) {
        if (this.c.resetSkills()) this.feed?.log('ลืมสกิลทั้งหมด · ได้แต้มสกิลคืน', 'gold');
        else this.feed?.log(this.c.skillPointsSpent ? `ทองไม่พอ (${this.c.skillResetCost} ทอง)` : 'ยังไม่ได้ใช้แต้มสกิล', 'bad', true);
      }
    });
    character.on('skills', () => this.refresh());
    character.on('change', () => { if (!this.root.hidden) this.refresh(); });
    character.on('joblevelup', lv => {
      this.feed?.banner?.(`Job เลเวลอัป · Job Lv. ${lv}`, 'ได้แต้มสกิล 1 แต้ม กด K เพื่ออัปสกิล');
      this.feed?.log(`Job Lv. ${lv} · ได้แต้มสกิล`, 'gold');
      const opened = this.kit?.skills.filter(s => this.c.skillUnlockJob(s.id) === lv);
      for (const s of opened ?? []) this.feed?.log(`ปลดสกิลใหม่ · ${s.name}`, 'gold');
    });
    layer.append(this.root);
  }
  get hidden() { return this.root.hidden; }
  toggle() { this.root.hidden = !this.root.hidden; if (!this.root.hidden) { this.key = null; this.refresh(); } }
  name(id) { return this.kit?.skills.find(s => s.id === id)?.name ?? id; }
  // Re-drawn only when something it shows changed ('change' fires for every HP tick, and a
  // list rebuilt under a finger would eat the tap).
  refresh() {
    const c = this.c, key = JSON.stringify([c.jobLevel, c.jobExp, c.skills, c.evo, c.gold >= c.skillResetCost, c.gold >= 500]);
    if (key === this.key) return;
    this.key = key;
    const max = c.jobLevel >= MAX_JOB_LEVEL;
    this.root.querySelector('.g-job-head b').textContent = `Job Lv. ${c.jobLevel}${max ? ' (สูงสุด)' : ''}`;
    const pts = this.root.querySelector('.g-job-head span'); pts.textContent = `แต้มสกิล ${c.skillPoints}`; pts.classList.toggle('g-has-points', c.skillPoints > 0);
    setBar(this.root.querySelector('.g-jexp'), max ? 1 : c.jobExp, max ? 1 : c.jobExpNeeded, max ? 'Job สูงสุด' : `Job EXP ${(c.jobExp / c.jobExpNeeded * 100).toFixed(1)}%`);
    const reset = this.root.querySelector('.g-skill-reset');
    reset.textContent = `ลืมสกิลทั้งหมด · ${c.skillResetCost.toLocaleString()} ทอง`; reset.disabled = c.skillPointsSpent <= 0;
    const list = this.root.querySelector('.g-skill-list');
    if (!this.kit) { list.innerHTML = '<li class="g-skill-none">อาชีพนี้ยังไม่มีสกิลให้อัป</li>'; return; }
    list.innerHTML = this.kit.skills.map(s => {
      const lv = c.skillLevel(s.id), need = c.skillUnlockJob(s.id), open = c.jobLevel >= need, block = c.skillBlock(s.id);
      const pips = Array.from({ length: MAX_SKILL_LEVEL }, (_, i) => `<i class="${i < lv ? 'on' : ''}"></i>`).join('');
      const eff = c.skillVariant(s.id), now = lv ? facts(s, lv, eff) : '', next = lv < MAX_SKILL_LEVEL ? facts(s, lv + 1) : '';
      const paths = EVOLUTIONS[s.id], ready = lv >= EVO_LEVEL;
      const evoHtml = !paths ? '' : `<div class="g-evo${ready ? '' : ' wait'}">${ready ? '' : `<small>สายวิวัฒน์ที่ Lv.${EVO_LEVEL}</small>`}${['A', 'B'].map(p => {
        const on = c.evo[s.id] === p, cost = c.evoCost(s.id, p);
        return `<button data-evo="${s.id}:${p}" class="${on ? 'on' : ''}" ${ready && !on ? '' : 'disabled'} title="${esc(paths[p].desc)}${ready ? `\n${facts(s, lv, `${s.id}@${p}`)}` : ''}${cost ? `\nเปลี่ยนสาย ${cost} ทอง` : ''}" style="--evo:${paths[p].color}"><b>${p}</b> ${esc(paths[p].name)}${on ? ' ✓' : cost && ready ? ` · ${cost}฿` : ''}</button>`;
      }).join('')}</div>`;
      return `<li class="${open ? '' : 'closed'} ${lv ? 'learnt' : ''}" title="${esc(s.desc ?? '')}">
        <span class="g-skill-ico">${s.icon ? `<img src="${s.icon}" alt="">` : ''}${open ? '' : '<em>🔒</em>'}</span>
        <div class="g-skill-txt"><b>${esc(s.name)}</b><span class="g-pips">${pips}</span>
          <small>${open ? (lv ? `Lv.${lv}: ${now}` : 'ยังไม่ได้เรียน') : `ปลดที่ Job Lv.${need}`}${open && next ? `<br>→ Lv.${lv + 1}: ${next}` : ''}</small>${evoHtml}</div>
        <button data-learn="${s.id}" ${block ? 'disabled' : ''} title="${esc(block ?? 'อัปเลเวลสกิล')}" aria-label="อัป ${esc(s.name)}">+</button></li>`;
    }).join('');
  }
}
