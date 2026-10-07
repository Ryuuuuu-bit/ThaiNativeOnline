// Skill window (K), laid out as the design "UI ใหม่" draws it: the class path and job strip on
// top, the class's ten kit skills as a tree (three branches by what a skill does, rows by the
// job level that opens them) and the selected skill's card on the right, the action bar's
// ten slots at the bottom. Each skill opens at a job level (SKILL_UNLOCK_JOB) and goes up to
// MAX_SKILL_LEVEL with skill points (one per job level); the numbers shown are the rules'
// (src/rules/data/skills.js skillStats) at the current and next level. Reset gives every
// point back for gold. At Lv.5 some skills take path A or B (src/rules/data/evolutions.js):
// free the first time, gold to switch.
//
//   new SkillPanel(layer, character, feed, open)   open(name) shows 'sheet' or 'bag' (the tabs)
import { CLASS_KITS } from '../../classes/index.js';
import { SKILL_BY_ID, skillStats } from '../../rules/data/skills.js';
import { castInfo } from '../../training/kitCombat.js';
import { EVOLUTIONS, EVO_LEVEL } from '../../rules/data/evolutions.js';
import { MAX_SKILL_LEVEL, MAX_JOB_LEVEL } from '../data/progression.js';
import { classBadge } from '../../ui/icons.js';
import { el, esc, setBar } from './dom.js';

// Tree branches by the rules skill type (columns of the tree).
const BRANCHES = [
  { name: 'โจมตีเป้าเดียว', color: '#c8322a', types: ['melee', 'projectile', 'strike', 'tether', 'bounce', 'seed'] },
  { name: 'หมู่ · พุ่งเข้าหา', color: '#2f74c9', types: ['aoe', 'dash', 'mortar'] },
  { name: 'บัฟ · ฟื้นฟู', color: '#c9a04c', types: ['buff', 'party', 'revive', 'passive'] },
];
const TYPE_TH = { melee: 'โจมตีประชิด', projectile: 'โจมตีระยะไกล', strike: 'สายฟ้าใส่เป้า', tether: 'สายใยผูกเพื่อน', bounce: 'เด้งเพื่อน ↔ ผี', seed: 'เมล็ดฝังเพื่อน',
  aoe: 'โจมตีรอบตัว', dash: 'พุ่งเข้าหา', mortar: 'ลงพื้นเป็นวง', buff: 'บัฟตัวเอง', party: 'บัฟทั้งปาร์ตี้', revive: 'ชุบชีวิต · รักษา', passive: 'ติดตัว' };
const branchOf = id => Math.max(0, BRANCHES.findIndex(b => b.types.includes(SKILL_BY_ID[id]?.type)));

// What a skill does at a level, as label → value rows for the card.
const statsAt = (kitSkill, lv, id = kitSkill.id) => {
  const base = SKILL_BY_ID[id], L = Math.max(1, lv), st = base ? skillStats(base, L) : null, info = castInfo({ ...kitSkill, id }, L);
  return { mult: st?.mult, hmult: st?.hmult, hits: Array.isArray(kitSkill.hits) ? kitSkill.hits.length : 0, mp: info.mp, cd: info.cd, cast: info.cast, dur: st?.duration ? st.duration / 1000 : 0 };
};
const ROWS = [
  ['ดาเมจต่อครั้ง', s => s.mult, s => `${Math.round(s.mult * 100)}% ATK${s.hits > 1 ? ` × ${s.hits}` : ''}`],
  ['รักษา', s => s.hmult, s => `${Math.round(s.hmult * 100)}% พลังเวทย์`],
  ['ระยะเวลา', s => s.dur, s => `${s.dur.toFixed(1)} วิ`],
  ['MP', s => s.mp, s => s.mp],
  ['คูลดาวน์', s => s.cd, s => `${(+s.cd).toFixed(1)} วิ`],
  ['ร่าย', s => s.cast, s => `${(+s.cast).toFixed(1)} วิ`],
];

export class SkillPanel {
  constructor(layer, character, feed, open) {
    this.c = character; this.feed = feed; this.open = open;
    this.kit = CLASS_KITS[character.classId] ?? null;
    this.sel = this.kit?.skills[0]?.id ?? null;
    this.root = el('section', 'g-panel g-skills glass', `<div class="panel-heading"><kbd class="g-kc">K</kbd>สกิล · ${esc(character.cls?.name ?? '')}<button aria-label="ปิด">×</button></div>
      <div class="g-sk-tabs"><div class="g-seg"><button data-go="sheet">ตัวละคร</button><button aria-pressed="true">สกิล</button><button data-go="bag">กระเป๋า</button></div></div>
      <div class="g-sk-top"><div class="g-sk-path"></div><span class="g-sk-sp"></span>
        <div class="g-sk-job"><span class="g-sk-jt"></span><div class="g-bar g-jexp" title="Job EXP"><span></span><em></em></div><small>Job Lv. ละ 1 แต้ม · สกิลสูงสุด Lv.${MAX_SKILL_LEVEL}</small></div>
        <span class="g-sk-pts"><b></b>แต้มสกิล</span><button class="g-skill-reset"></button></div>
      <div class="g-sk-main"><div class="g-sk-tree g-parch"></div><div class="g-sk-card"></div></div>
      <div class="g-sk-bar"><b>ช่องลัด</b><div class="g-sk-slots"></div></div>`);
    this.root.hidden = true;
    this.root.querySelector('.panel-heading button').addEventListener('click', () => { this.root.hidden = true; });
    this.root.addEventListener('click', e => {
      const go = e.target.closest('[data-go]'); if (go) { this.root.hidden = true; this.open?.(go.dataset.go); return; }
      const node = e.target.closest('[data-sk]'); if (node) { this.sel = node.dataset.sk; this.key = null; this.refresh(); return; }
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

  // Rows of the tree: skills in unlock order, each in its branch's column; a new row starts
  // when that column is already taken in the current one. The row is labelled with the job
  // level of its first skill.
  layout() {
    const rows = [];
    for (const s of this.kit.skills) {
      const col = branchOf(s.id), need = this.c.skillUnlockJob(s.id);
      if (!rows.length || rows.at(-1).cells[col]) rows.push({ job: need, cells: [] });
      rows.at(-1).cells[col] = s;
    }
    return rows;
  }

  // Re-drawn only when something it shows changed ('change' fires for every HP tick, and a
  // tree rebuilt under a finger would eat the tap).
  refresh() {
    const c = this.c, key = JSON.stringify([this.sel, c.jobLevel, c.jobExp, c.skills, c.evo, c.gold >= c.skillResetCost, c.gold >= 500]);
    if (key === this.key) return;
    this.key = key;
    const max = c.jobLevel >= MAX_JOB_LEVEL;
    this.root.querySelector('.g-sk-path').innerHTML = `<span class="g-pchip done">${classBadge(c.classId, c.cls, { size: 17 })}<span>ผู้ฝึกหัด<small>ผ่านแล้ว</small></span></span><i>»»</i>
      <span class="g-pchip cur">${classBadge(c.classId, c.cls, { size: 17 })}<span>${esc(c.cls?.name ?? '')}<small>ปัจจุบัน · Job Lv ${c.jobLevel} / ${MAX_JOB_LEVEL}</small></span></span><i>»»</i>
      <span class="g-pchip lock"><span class="g-q2">?</span><span>อาชีพขั้นสอง<small>ยังไม่เปิด</small></span></span>`;
    this.root.querySelector('.g-sk-jt').textContent = max ? 'Job สูงสุด' : `Job EXP ${(c.jobExp / c.jobExpNeeded * 100).toFixed(1)}%`;
    setBar(this.root.querySelector('.g-jexp'), max ? 1 : c.jobExp, max ? 1 : c.jobExpNeeded, '');
    const pts = this.root.querySelector('.g-sk-pts'); pts.querySelector('b').textContent = c.skillPoints; pts.classList.toggle('g-has-points', c.skillPoints > 0);
    const reset = this.root.querySelector('.g-skill-reset');
    reset.innerHTML = `รีเซ็ตสกิล <span class="g-cost"><i class="g-coin"></i>${c.skillResetCost.toLocaleString()}</span>`; reset.disabled = c.skillPointsSpent <= 0;
    const tree = this.root.querySelector('.g-sk-tree'), card = this.root.querySelector('.g-sk-card');
    if (!this.kit) { tree.innerHTML = '<p class="g-skill-none">อาชีพนี้ยังไม่มีสกิลให้อัป</p>'; card.innerHTML = ''; return; }

    // tree
    const rows = this.layout(), spans = BRANCHES.map((_, col) => { const r = rows.map((row, i) => row.cells[col] ? i : -1).filter(i => i >= 0); return [Math.min(...r), Math.max(...r)]; });
    const cells = ['<div></div>', ...BRANCHES.map((b, i) => `<div class="g-colh" style="--c:${b.color}"><b>${b.name}</b><small>ลงแล้ว ${this.kit.skills.filter(s => branchOf(s.id) === i).reduce((n, s) => n + c.skillLevel(s.id), 0)} แต้ม</small></div>`)];
    rows.forEach((row, r) => {
      cells.push(`<div class="g-rowl${c.jobLevel < row.job ? ' lock' : ''}"><span>Job<br>${row.job}</span></div>`);
      BRANCHES.forEach((_, col) => {
        const [first, last] = spans[col], line = r >= first && r <= last ? ` line${r === first ? ' first' : ''}${r === last ? ' last' : ''}` : '';
        const s = row.cells[col];
        if (!s) { cells.push(`<div class="g-cell${line}"></div>`); return; }
        const lv = c.skillLevel(s.id), need = c.skillUnlockJob(s.id), state = lv ? 'learned' : c.jobLevel >= need ? 'avail' : 'locked';
        const ult = SKILL_BY_ID[s.id]?.ultimate, evo = c.evo[s.id];
        cells.push(`<div class="g-cell${line}"><button type="button" class="g-node ${state}${s.id === this.sel ? ' sel' : ''}" data-sk="${s.id}" title="${esc(s.name)}">
          <span class="g-ic">${s.icon ? `<img src="${s.icon}" alt="">` : ''}</span><b class="g-lvp">${state === 'locked' ? `Job ${need}` : `${lv}/${MAX_SKILL_LEVEL}`}</b>
          <span class="g-nm">${esc(s.name)}</span>${ult ? '<span class="g-bdg ult">★</span>' : evo ? `<span class="g-bdg" style="--evo:${EVOLUTIONS[s.id][evo].color}">${evo}</span>` : ''}${c.skillBlock(s.id) ? '' : '<span class="g-plus">+</span>'}</button></div>`);
      });
    });
    tree.style.setProperty('--rows', rows.length);
    tree.innerHTML = cells.join('');

    // the selected skill's card
    const s = this.kit.skills.find(k => k.id === this.sel) ?? this.kit.skills[0];
    const lv = c.skillLevel(s.id), need = c.skillUnlockJob(s.id), locked = c.jobLevel < need, maxed = lv >= MAX_SKILL_LEVEL, block = c.skillBlock(s.id);
    const now = statsAt(s, lv, c.skillVariant(s.id)), nx = statsAt(s, lv + 1);
    const cmp = ROWS.filter(([, has]) => has(now) || has(nx)).map(([k, has, f]) => `<div><span>${k}</span><b>${!lv || maxed ? f(lv ? now : nx) : `${f(now)} → <i>${f(nx)}</i>`}</b></div>`).join('');
    const pips = Array.from({ length: MAX_SKILL_LEVEL }, (_, i) => `<i class="${i < lv ? 'on' : ''}"></i>`).join('');
    const paths = EVOLUTIONS[s.id], ready = lv >= EVO_LEVEL;
    const evoHtml = !paths ? '' : `<div class="g-sk-evo"><span>สายวิวัฒน์ ${ready ? '' : `<small>เปิดที่สกิล Lv.${EVO_LEVEL}</small>`}</span>${['A', 'B'].map(p => {
      const on = c.evo[s.id] === p, cost = c.evoCost(s.id, p);
      return `<button type="button" data-evo="${s.id}:${p}" class="${on ? 'on' : ''}" ${ready && !on ? '' : 'disabled'} title="${esc(paths[p].desc)}" style="--evo:${paths[p].color}"><b>${p}</b> ${esc(paths[p].name)}${on ? ' ✓' : cost && ready ? ` · ${cost} ทอง` : ''}<small>${esc(paths[p].desc)}</small></button>`;
    }).join('')}</div>`;
    const label = locked ? `ปลดที่ Job Lv ${need}` : maxed ? 'เลเวลสูงสุดแล้ว' : block ?? (lv ? 'อัปเลเวล <small>ใช้ 1 แต้ม</small>' : 'เรียนสกิล <small>ใช้ 1 แต้ม</small>');
    card.innerHTML = `<div class="g-skd-head"><span class="g-ic">${s.icon ? `<img src="${s.icon}" alt="">` : ''}</span><div><b>${esc(s.name)}</b><small>${TYPE_TH[SKILL_BY_ID[s.id]?.type] ?? 'สกิล'} · ${SKILL_BY_ID[s.id]?.kind === 'physical' ? 'กายภาพ' : SKILL_BY_ID[s.id]?.kind === 'magic' ? 'เวทย์' : 'สนับสนุน'}</small><div class="g-pips">${pips}</div></div>
        <span class="g-skd-lv">Lv ${lv}/${MAX_SKILL_LEVEL}<small>${locked ? 'ยังไม่ปลด' : lv ? 'เรียนแล้ว' : 'เรียนได้'}</small></span></div>
      ${cmp ? `<div class="g-cmp">${cmp}</div>` : ''}
      ${s.desc ? `<p class="g-skd-desc">${esc(s.desc)}</p>` : ''}
      ${evoHtml}
      <div class="g-reqs"><span><b class="g-lvtag">ปลด</b><span class="${locked ? 'no' : 'ok'}">${locked ? '✗' : '✓'} ต้อง Job Lv ${need}</span></span><span><b class="g-lvtag">แต้ม</b><span class="${c.skillPoints > 0 ? 'ok' : 'no'}">${c.skillPoints > 0 ? '✓' : '✗'} เหลือ ${c.skillPoints} แต้ม</span></span></div>
      <button type="button" class="g-skd-up" data-learn="${s.id}" ${block ? 'disabled' : ''}>${label}</button>`;

    // the action bar's ten slots
    this.root.querySelector('.g-sk-slots').innerHTML = this.kit.skills.map((k, i) => c.skillLevel(k.id)
      ? `<div class="g-skslot">${k.icon ? `<img src="${k.icon}" alt="">` : ''}<kbd>${(i + 1) % 10}</kbd><span>${esc(k.name)}</span></div>`
      : `<div class="g-skslot empty">${(i + 1) % 10} · ว่าง</div>`).join('');
  }
}
