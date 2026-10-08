import { assetIcon } from '../../ui/icons.js';
// Skill window (K), laid out as the design "UI ใหม่" draws it: the class path and job strip on
// top, the class's skill tree (src/character/data/skilltree.js: the root on top, the three
// lines of the class as columns, a row per step down a line) and the selected skill's card on
// the right, the action bar's ten slots at the bottom. A skill opens when the skills before it
// on its line have enough levels and the job level has reached its floor, and goes up to
// MAX_SKILL_LEVEL with skill points (one per job level); the numbers shown are the rules'
// (src/rules/data/skills.js skillStats) at the current and next level. Reset gives every
// point back for gold. At Lv.5 some skills take path A or B (src/rules/data/evolutions.js):
// free the first time, gold to switch.
//
//   new SkillPanel(layer, character, feed, open)   open(name) shows 'sheet' or 'bag' (the tabs)
import { CLASS_KITS } from '../../classes/index.js';
import { SKILL_BY_ID, skillStats } from '../../rules/data/skills.js';
import { castInfo } from '../../training/kitCombat.js';
import { RULES } from '../../combat/data/rules.js';
import { EVOLUTIONS, EVO_LEVEL } from '../../rules/data/evolutions.js';
import { MAX_SKILL_LEVEL, MAX_JOB_LEVEL } from '../data/progression.js';
import { treeOf } from '../data/skilltree.js';
import { KIT_PASSIVES, KIT_PASSIVE_IDS } from '../../rules/data/kitpassives.js';
import { healPower } from '../../training/kitCombat.js';
import { scaleOf } from '../data/statguide.js';
import { classBadge } from '../../ui/icons.js';
import { el, esc, setBar } from './dom.js';
import { draggable } from '../../ui/draggable.js';

const TYPE_TH = { melee: 'โจมตีประชิด', projectile: 'โจมตีระยะไกล', strike: 'สายฟ้าใส่เป้า', tether: 'สายใยผูกเพื่อน', bounce: 'เด้งเพื่อน ↔ ผี', seed: 'เมล็ดฝังเพื่อน',
  aoe: 'โจมตีรอบตัว', dash: 'พุ่งเข้าหา', mortar: 'ลงพื้นเป็นวง', buff: 'บัฟตัวเอง', party: 'บัฟทั้งปาร์ตี้', revive: 'ชุบชีวิต · รักษา', passive: 'ติดตัว' };

// What a skill does at a level, as label → value rows for the card.
const statsAt = (kitSkill, lv, id = kitSkill.id) => {
  const base = SKILL_BY_ID[id], L = Math.max(1, lv), st = base ? skillStats(base, L) : null, info = castInfo({ ...kitSkill, id }, L);
  return { mult: st?.mult, hmult: st?.hmult, hits: Array.isArray(kitSkill.hits) ? kitSkill.hits.length : 0, mp: info.mp, cd: info.cd, cast: info.cast, dur: st?.duration ? st.duration / 1000 : 0 };
};
// Tree passives: the bonus keys as the card shows them (src/rules/data/kitpassives.js).
const pct = v => `+${Math.round(v * 1000) / 10}%`;
const BONUS_TH = { patkMul: 'พลังโจมตีกายภาพ', matkMul: 'พลังเวทย์', hpMul: 'HP สูงสุด', mpMul: 'MP สูงสุด', hp: 'HP', mp: 'MP', def: 'ป้องกัน', eva: 'หลบหลีก', aspd: 'ความเร็วโจมตี', crit: 'อัตราคริ', critDmg: 'แรงคริ', castRed: 'ลดคูลดาวน์สกิล', healMul: 'พลังรักษา', petMul: 'น้องหมากัดแรงขึ้น', acc: 'แม่นยำ', atk: 'พลังโจมตี', matk: 'พลังเวทย์' };
const BONUS_FMT = { patkMul: pct, matkMul: pct, hpMul: pct, mpMul: pct, aspd: pct, crit: pct, critDmg: pct, castRed: pct, healMul: pct, petMul: pct, hp: v => `+${v}`, mp: v => `+${v}`, def: v => `+${v}`, eva: v => `+${v}`, acc: v => `+${v}`, atk: v => `+${v}`, matk: v => `+${v}` };
const ROWS = [
  ['ดาเมจต่อครั้ง', s => s.mult, s => `${Math.round(s.mult * 100)}% ATK${s.hits > 1 ? ` × ${s.hits}` : ''}`],
  ['รักษา', s => s.hmult, s => `${Math.round(s.hmult * 100)}% พลังเวทย์`],
  ['ระยะเวลา', s => s.dur, s => `${s.dur.toFixed(1)} วิ`],
  ['MP', s => s.mp, s => s.mp],
  ['คูลดาวน์', s => s.cd, s => `${(+s.cd).toFixed(1)} วิ`],
  ['ร่าย', s => s.cast, s => `${(+s.cast).toFixed(1)} วิ`],
];

// The card's "ของคุณตอนนี้" block: the skill's numbers worked out from this character's stats, so a
// player sees where a skill's strength comes from (rules: src/rules/stats.js rollDamage —
// power × multiplier × 90–110 % − armour, × crit damage on a crit).
const fmt = n => Math.round(n).toLocaleString('en-US');
const BUFF_TH = { atkMul: ['พลังโจมตี', v => `+${Math.round(v * 100)}%`], critAdd: ['โอกาสคริ', v => `+${Math.round(v * 100)}%`], def: ['ป้องกัน', v => `+${v}`], aspd: ['ความเร็วตี', v => `+${Math.round(v * 100)}%`], eva: ['หลบหลีก', v => `+${v}`], speed: ['ความเร็ววิ่ง', v => `+${Math.round(v * 100)}%`], regen: ['ฟื้น HP', v => `${Math.round(v * 100)}%/วิ`] };
function yourNumbers(c, kitSkill, id, lv) {
  const base = SKILL_BY_ID[id]; if (!base) return '';
  const L = Math.max(1, lv), st = skillStats(base, L), kind = base.kind || 'physical', ranged = !!c.cls.ranged;
  const hits = Array.isArray(kitSkill.hits) ? Math.max(1, kitSkill.hits.length) : 1;
  const rows = [], tips = [];
  const scale = scaleOf(kind, ranged);
  const power = kind === 'magic' ? c.matk : kind === 'best' ? Math.max(c.patk, c.matk) : c.patk;
  const mult = st.mult ?? (base.type !== 'buff' && base.type !== 'party' && base.type !== 'revive' && !base.heals ? RULES.kit.fallbackMult : null);
  if (mult) {
    const per = power * mult, crit = per * c.critDamage;
    rows.push(['ดาเมจต่อครั้ง', `${scale.label} ${fmt(power)} × ${Math.round(mult * 100)}% ≈ <b>${fmt(per)}</b>`]);
    if (hits > 1) rows.push([`รวม ${hits} ครั้ง`, `≈ <b>${fmt(per * hits)}</b>`]);
    rows.push([`ติดคริ (${Math.round(c.critChance * 100)}%)`, `× ${c.critDamage.toFixed(2)} ≈ <b>${fmt(crit)}</b> ต่อครั้ง`]);
    rows.push(['ก่อนหักเกราะ', `ผีลด ${kind === 'magic' ? 'DEF × 0.25' : 'DEF × 0.5'} ต่อครั้ง · สุ่ม 90–110%`]);
    tips.push(`${scale.how}`, kind === 'magic' ? 'อุปกรณ์ MATK' : 'อุปกรณ์ ATK');
  }
  if (base.heals && st.hmult) {
    const heal = Math.round(healPower(id, L, c.matk) * c.healPow);
    const ticks = Math.max(1, Math.round(heal / Math.max(1, st.hmult * c.matk * c.healPow)));
    rows.push(['รักษา', `MATK ${fmt(c.matk)} × ${Math.round(st.hmult * 100)}%${ticks > 1 ? ` × ${ticks} ครั้ง` : ''}${c.healPow !== 1 ? ` × พลังรักษา ${c.healPow.toFixed(2)}` : ''} ≈ <b>${fmt(heal)}</b>`]);
    tips.push('INT ยิ่งสูงยิ่งคุ้ม', 'อุปกรณ์ MATK / พลังรักษา');
  }
  if (typeof st.heal === 'number' && st.heal > 0) rows.push(['ฟื้น HP', `${Math.round(st.heal * 100)}% ของ HP สูงสุด ≈ <b>${fmt(c.maxHp * st.heal)}</b>`]);
  if (st.mpHeal) rows.push(['ฟื้น MP', `${Math.round(st.mpHeal * 100)}% ≈ <b>${fmt(c.maxMp * st.mpHeal)}</b>`]);
  if (st.buff) for (const [k, v] of Object.entries(st.buff)) { if (typeof v !== 'number') continue; const [th, f] = BUFF_TH[k] ?? [k, v => v]; rows.push([th, `<b>${f(v)}</b>${k === 'atkMul' ? ` (ATK ${fmt(c.patk)} → ${fmt(c.patk * (1 + v))})` : ''}`]); }
  if (st.cd) { const cut = c.cooldownCut, real = st.cd / 1000 * (1 - cut); rows.push(['คูลดาวน์ของคุณ', `<b>${real.toFixed(1)} วิ</b>${cut ? ` (DEX/อุปกรณ์ ลด ${Math.round(cut * 100)}%)` : ''}`]); }
  if (base.castMs) { const cs = c.castSpeed, real = base.castMs / 1000 * (1 - cs); rows.push(['ร่ายของคุณ', `<b>${real.toFixed(1)} วิ</b>${cs ? ` (ร่ายเร็ว ${Math.round(cs * 100)}%)` : ''}`]); }
  // the tree passive of this class that feeds this skill
  const key = base.heals ? 'healMul' : kind === 'magic' ? 'matkMul' : 'patkMul';
  const pas = (KIT_PASSIVE_IDS[c.classId] ?? []).find(pid => KIT_PASSIVES[pid].bonus(1)[key]);
  if (pas) tips.push(`${KIT_PASSIVES[pas].nameTh} (ติดตัว)`);
  if (!rows.length) return '';
  return `<div class="g-yours"><span class="g-yours-h">ของคุณตอนนี้ · Lv ${L}</span>${rows.map(([k, v]) => `<div><span>${k}</span><em>${v}</em></div>`).join('')}${tips.length ? `<small>แรงขึ้นได้จาก: ${[...new Set(tips)].join(' · ')}</small>` : ''}</div>`;
}

export class SkillPanel {
  constructor(layer, character, feed, open) {
    this.c = character; this.feed = feed; this.open = open;
    this.kit = CLASS_KITS[character.classId] ?? null;
    this.tree = treeOf(character.classId);
    this.sel = this.kit?.skills[0]?.id ?? null;
    this.root = el('section', 'g-panel g-skills glass', `<div class="panel-heading"><kbd class="g-kc">K</kbd>สกิล · ${esc(character.cls?.name ?? '')}<button aria-label="ปิด">×</button></div>
      <div class="g-sk-tabs"><div class="g-seg"><button data-go="sheet">ตัวละคร</button><button aria-pressed="true">สกิล</button><button data-go="bag">กระเป๋า</button></div></div>
      <div class="g-sk-top"><div class="g-sk-path"></div><span class="g-sk-sp"></span>
        <div class="g-sk-job"><span class="g-sk-jt"></span><div class="g-bar g-jexp" title="Job EXP"><span></span><em></em></div><small>Job Lv. ละ 1 แต้ม · สกิลสูงสุด Lv.${MAX_SKILL_LEVEL} · เลือกสายให้ดี แต้มไม่พอทุกสกิล</small></div>
        <span class="g-sk-pts"><b></b>แต้มสกิล</span><button class="g-skill-reset"></button></div>
      <div class="g-sk-main"><div class="g-sk-tree g-parch"></div><div class="g-sk-card"></div></div>
      <div class="g-sk-bar"><b>ช่องลัด</b><div class="g-sk-slots"></div></div>`);
    this.root.hidden = true;
    this.root.querySelector('.panel-heading button').addEventListener('click', () => { this.root.hidden = true; });
    draggable(this.root, { key: 'skills', handle: '.panel-heading' });
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
      if (up) {
        const id = up.dataset.learn, opens = this.c.skillOpensNext(id);
        if (this.c.learnSkill(id)) { this.feed?.log(`อัปสกิล ${this.name(id)} เป็น Lv.${this.c.skillLevel(id)}`, 'gold'); for (const k of opens) this.feed?.log(`ปลดสกิลใหม่ · ${this.name(k)}`, 'gold'); }
        else this.feed?.log(this.c.skillBlock(id) ?? 'อัปไม่ได้', 'bad', true);
      }
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
      const opened = this.kit?.skills.filter(s => this.c.skillUnlockJob(s.id) === lv && this.c.skillOpen(s.id) && !this.c.skillLevel(s.id));
      for (const s of opened ?? []) this.feed?.log(`ปลดสกิลใหม่ · ${s.name}`, 'gold');
    });
    layer.append(this.root);
  }
  get hidden() { return this.root.hidden; }
  toggle() { this.root.hidden = !this.root.hidden; if (!this.root.hidden) { this.key = null; this.refresh(); } }
  name(id) { return this.kit?.skills.find(s => s.id === id)?.name ?? KIT_PASSIVES[id]?.nameTh ?? id; }
  // A tree passive as the panel's skill entry ({ id, name, icon, desc, passive: true }).
  entry(id) { const p = KIT_PASSIVES[id]; return p ? { id, name: p.nameTh, icon: p.icon, desc: p.desc, passive: true } : this.kit?.skills.find(s => s.id === id); }

  // Rows of the tree: the root alone on top (middle column), then row i holds step i of each
  // line. A row is labelled with the lowest job floor among its skills.
  layout() {
    const byId = Object.fromEntries(this.kit.skills.map(s => [s.id, s])), lines = this.tree?.lines ?? [];
    const depth = Math.max(0, ...lines.map(l => l.skills.length));
    const rows = [{ job: 1, root: true, cells: [, byId[this.kit.skills[0].id]] }];
    for (let i = 0; i < depth; i++) {
      const cells = lines.map(l => byId[l.skills[i]]), side = lines.map(l => i === 0 && l.passive ? this.entry(l.passive) : null);
      rows.push({ job: Math.min(...cells.filter(Boolean).map(s => this.c.skillUnlockJob(s.id))), cells, side });
    }
    return rows;
  }

  // Re-drawn only when something it shows changed ('change' fires for every HP tick, and a
  // tree rebuilt under a finger would eat the tap).
  refresh() {
    const c = this.c, max = c.jobLevel >= MAX_JOB_LEVEL;
    // the Job EXP bar moves on its own; the tree and card below are rebuilt only when they changed
    this.root.querySelector('.g-sk-jt').textContent = max ? 'Job สูงสุด' : `Job EXP ${(c.jobExp / c.jobExpNeeded * 100).toFixed(1)}%`;
    setBar(this.root.querySelector('.g-jexp'), max ? 1 : c.jobExp, max ? 1 : c.jobExpNeeded, '');
    const key = JSON.stringify([this.sel, c.jobLevel, c.skills, c.evo, c.gold >= c.skillResetCost, c.gold >= 500]);   // not jobExp: every kill would rebuild the tree under the pointer
    if (key === this.key) return;
    this.key = key;
    this.root.querySelector('.g-sk-path').innerHTML = `<span class="g-pchip done">${classBadge(c.classId, c.cls, { size: 17 })}<span>ผู้ฝึกหัด<small>ผ่านแล้ว</small></span></span><i>»»</i>
      <span class="g-pchip cur">${classBadge(c.classId, c.cls, { size: 17 })}<span>${esc(c.cls?.name ?? '')}<small>ปัจจุบัน · Job Lv ${c.jobLevel} / ${MAX_JOB_LEVEL}</small></span></span><i>»»</i>
      <span class="g-pchip lock"><span class="g-q2">?</span><span>อาชีพขั้นสอง<small>ยังไม่เปิด</small></span></span>`;
    const pts = this.root.querySelector('.g-sk-pts'); pts.querySelector('b').textContent = c.skillPoints; pts.classList.toggle('g-has-points', c.skillPoints > 0);
    const reset = this.root.querySelector('.g-skill-reset');
    reset.innerHTML = `รีเซ็ตสกิล <span class="g-cost"><i class="g-coin"></i>${c.skillResetCost.toLocaleString()}</span>`; reset.disabled = c.skillPointsSpent <= 0;
    const tree = this.root.querySelector('.g-sk-tree'), card = this.root.querySelector('.g-sk-card');
    if (!this.kit) { tree.innerHTML = '<p class="g-skill-none">อาชีพนี้ยังไม่มีสกิลให้อัป</p>'; card.innerHTML = ''; return; }

    // tree: the root on top, the three lines below it
    const lines = this.tree?.lines ?? [], rows = this.layout();
    const cells = ['<div></div>', ...lines.map(l => `<div class="g-colh" style="--c:${l.color}"><b>${esc(l.name)}</b><small>${esc(l.role)} · ลงแล้ว ${[...l.skills, l.passive].filter(Boolean).reduce((n, id) => n + c.skillLevel(id), 0)} แต้ม</small></div>`)];
    const node = (s, small = false) => {
      const lv = c.skillLevel(s.id), open = c.skillOpen(s.id), state = lv ? 'learned' : open ? 'avail' : 'locked';
      const ult = SKILL_BY_ID[s.id]?.ultimate, evo = c.evo[s.id], { req = {}, job = 1 } = c.skillReqs(s.id);
      const unmet = Object.entries(req).find(([k, n]) => c.skillLevel(k) < n), needText = c.jobLevel < job ? `Job ${job}` : unmet ? `ต้อง Lv.${unmet[1]}` : '';
      return `<button type="button" class="g-node ${state}${s.id === this.sel ? ' sel' : ''}${small ? ' g-pnode' : ''}" data-sk="${s.id}" title="${esc(s.name)}${small ? ' · ติดตัว' : ''}${state === 'locked' ? ` · ${esc(c.skillTreeBlock(s.id) ?? '')}` : ''}">
          <span class="g-ic">${s.icon ? assetIcon(s.icon) : ''}</span><b class="g-lvp">${state === 'locked' ? needText : `${lv}/${MAX_SKILL_LEVEL}`}</b>
          <span class="g-nm">${esc(s.name)}</span>${ult ? '<span class="g-bdg ult">★</span>' : evo ? `<span class="g-bdg" style="--evo:${EVOLUTIONS[s.id][evo].color}">${evo}</span>` : ''}${c.skillBlock(s.id) ? '' : '<span class="g-plus">+</span>'}</button>`;
    };
    rows.forEach((row, r) => {
      cells.push(`<div class="g-rowl${c.jobLevel < row.job ? ' lock' : ''}"><span>${row.root ? 'เริ่ม' : `Job<br>${row.job}`}</span></div>`);
      lines.forEach((l, col) => {
        const s = row.cells[col];
        if (row.root) { cells.push(`<div class="g-cell fork ${col === 0 ? 'left' : col === lines.length - 1 ? 'right' : 'mid'}">${s ? node(s) : ''}</div>`); return; }
        const last = r >= l.skills.length, line = last ? (r === l.skills.length ? ' line last' : '') : ' line', p = row.side?.[col];
        cells.push(`<div class="g-cell${line}${p ? ' dual' : ''}">${s ? node(s) : ''}${p ? `<i class="g-tie"></i>${node(p, true)}` : ''}</div>`);
      });
    });
    tree.style.setProperty('--rows', rows.length);
    tree.innerHTML = cells.join('');

    // the selected skill's card
    const s = this.entry(this.sel) ?? this.kit.skills[0];
    const lv = c.skillLevel(s.id), need = c.skillUnlockJob(s.id), treeBlock = c.skillTreeBlock(s.id), locked = !!treeBlock, maxed = lv >= MAX_SKILL_LEVEL, block = c.skillBlock(s.id);
    const reqs = Object.entries(c.skillReqs(s.id).req ?? {});
    const now = s.passive ? null : statsAt(s, lv, c.skillVariant(s.id)), nx = s.passive ? null : statsAt(s, lv + 1);
    const cmp = s.passive
      ? Object.entries(KIT_PASSIVES[s.id].bonus(Math.max(1, lv))).map(([k, v]) => { const next = KIT_PASSIVES[s.id].bonus(lv + 1)[k], f = v => BONUS_FMT[k] ? BONUS_FMT[k](v) : v; return `<div><span>${BONUS_TH[k] ?? k}</span><b>${!lv || maxed ? f(lv ? v : next) : `${f(v)} → <i>${f(next)}</i>`}</b></div>`; }).join('')
      : ROWS.filter(([, has]) => has(now) || has(nx)).map(([k, has, f]) => `<div><span>${k}</span><b>${!lv || maxed ? f(lv ? now : nx) : `${f(now)} → <i>${f(nx)}</i>`}</b></div>`).join('');
    const pips = Array.from({ length: MAX_SKILL_LEVEL }, (_, i) => `<i class="${i < lv ? 'on' : ''}"></i>`).join('');
    const paths = s.passive ? null : EVOLUTIONS[s.id], ready = lv >= EVO_LEVEL;
    const evoHtml = !paths ? '' : `<div class="g-sk-evo"><span>สายวิวัฒน์ ${ready ? '' : `<small>เปิดที่สกิล Lv.${EVO_LEVEL}</small>`}</span>${['A', 'B'].map(p => {
      const on = c.evo[s.id] === p, cost = c.evoCost(s.id, p);
      return `<button type="button" data-evo="${s.id}:${p}" class="${on ? 'on' : ''}" ${ready && !on ? '' : 'disabled'} title="${esc(paths[p].desc)}" style="--evo:${paths[p].color}"><b>${p}</b> ${esc(paths[p].name)}${on ? ' ✓' : cost && ready ? ` · ${cost} ทอง` : ''}<small>${esc(paths[p].desc)}</small></button>`;
    }).join('')}</div>`;
    const label = locked ? esc(treeBlock) : maxed ? 'เลเวลสูงสุดแล้ว' : block ?? (lv ? 'อัปเลเวล <small>ใช้ 1 แต้ม</small>' : 'เรียนสกิล <small>ใช้ 1 แต้ม</small>');
    card.innerHTML = `<div class="g-skd-head"><span class="g-ic">${s.icon ? assetIcon(s.icon) : ''}</span><div><b>${esc(s.name)}</b><small>${s.passive ? 'ติดตัว · ไม่ต้องร่าย ไม่กินช่องลัด' : `${TYPE_TH[SKILL_BY_ID[s.id]?.type] ?? 'สกิล'} · ${SKILL_BY_ID[s.id]?.kind === 'physical' ? 'กายภาพ' : SKILL_BY_ID[s.id]?.kind === 'magic' ? 'เวทย์' : 'สนับสนุน'}`}</small><div class="g-pips">${pips}</div></div>
        <span class="g-skd-lv">Lv ${lv}/${MAX_SKILL_LEVEL}<small>${locked ? 'ยังไม่ปลด' : lv ? 'เรียนแล้ว' : 'เรียนได้'}</small></span></div>
      ${cmp ? `<div class="g-cmp">${cmp}</div>` : ''}
      ${s.passive ? '' : yourNumbers(c, s, c.skillVariant(s.id), lv)}
      ${s.desc ? `<p class="g-skd-desc">${esc(s.desc)}</p>` : ''}
      ${evoHtml}
      <div class="g-reqs"><span><b class="g-lvtag">ปลด</b><span class="${c.jobLevel >= need ? 'ok' : 'no'}">${c.jobLevel >= need ? '✓' : '✗'} Job Lv ${need}</span></span>${reqs.map(([k, n]) => `<span><b class="g-lvtag">ก่อน</b><span class="${c.skillLevel(k) >= n ? 'ok' : 'no'}">${c.skillLevel(k) >= n ? '✓' : '✗'} ${esc(this.name(k))} Lv ${n}</span></span>`).join('')}<span><b class="g-lvtag">แต้ม</b><span class="${c.skillPoints > 0 ? 'ok' : 'no'}">${c.skillPoints > 0 ? '✓' : '✗'} เหลือ ${c.skillPoints} แต้ม</span></span></div>
      <button type="button" class="g-skd-up" data-learn="${s.id}" ${block ? 'disabled' : ''}>${label}</button>`;

    // the action bar's ten slots
    this.root.querySelector('.g-sk-slots').innerHTML = this.kit.skills.map((k, i) => c.skillLevel(k.id)
      ? `<div class="g-skslot">${k.icon ? assetIcon(k.icon) : ''}<kbd>${(i + 1) % 10}</kbd><span>${esc(k.name)}</span></div>`
      : `<div class="g-skslot empty">${(i + 1) % 10} · ว่าง</div>`).join('');
  }
}
