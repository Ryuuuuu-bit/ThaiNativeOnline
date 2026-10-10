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
import { healPower, supportOf, allyHeal, ALLY_FOCUS } from '../../training/kitCombat.js';
import { scaleOf } from '../data/statguide.js';
import { classBadge } from '../../ui/icons.js';
import { el, esc, setBar } from './dom.js';
import { draggable } from '../../ui/draggable.js';
import { Character } from '../Character.js';
import { skillPreview } from '../../rules/skillPreview.js';
import { skillHitSchedule } from '../../rules/skillHits.js';
import { passiveBonusAt } from '../../rules/data/kitpassives.js';
import './skill-choice.css';

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
const BUFF_TH = { atkMul: ['พลังโจมตี', v => `+${Math.round(v * 100)}%`], critAdd: ['โอกาสคริ', v => `+${Math.round(v * 100)}%`], def: ['ป้องกัน', v => `+${v}`], defMul: ['ป้องกัน', v => `+${Math.round(v * 100)}%`], aspd: ['ความเร็วตี', v => `+${Math.round(v * 100)}%`], eva: ['หลบหลีก', v => `+${v}`], speed: ['ความเร็ววิ่ง', v => `+${Math.round(v * 100)}%`], regen: ['ฟื้น HP', v => `${Math.round(v * 100)}%/วิ`] };
function yourNumbers(c, kitSkill, id, lv) {
  const stats = { ...c.derived, patk: c.patk, matk: c.matk, def: c.defense, accuracy: c.accuracy,
    critRate: c.critChance, critDmg: c.critDamage, maxHp: c.maxHp, maxMp: c.maxMp,
    healPow: c.healPow, cooldownCut: c.cooldownCut, castSpeed: c.castSpeed, mpCostMul: c.mpCostMul };
  const v = skillPreview(id, lv, stats, { hits: skillHitSchedule(kitSkill, id).length || 1 });
  if (!v) return '';
  const rows = [], d = v.damage, span = a => a.map(fmt).join('–');
  if (d) {
    const powerLabel = d.kind === 'magic' ? 'MATK' : d.kind === 'best' ? 'ค่าสูงสุด ATK/MATK' : 'ATK';
    rows.push(['สูตรต่อครั้ง', powerLabel + ' × ตัวคูณ × สุ่ม 90–110% − DEF × ' + (d.kind === 'magic' ? '0.25' : '0.5')]);
    rows.push(['แทนค่าจากตัวละคร', fmt(d.power) + ' × ' + d.mult.toFixed(2) + ' × 0.90–1.10']);
    rows.push(['ดาเมจปกติ / ครั้ง', '<b>' + span(d.normal) + '</b> ก่อนหักเกราะเป้าหมาย']);
    if (d.hits > 1) rows.push(['รวม ' + d.hits + ' ครั้ง', span(d.total) + ' เมื่อทุกครั้งโดนเป้าเดียวกัน']);
    rows.push(['คริติคอล / ครั้ง', span(d.crit) + ' · คริ ' + Math.round(d.critChance * 100) + '% × ' + d.critMultiplier.toFixed(2)]);
    rows.push(['การปัดเศษ', 'หักเกราะ → ขั้นต่ำ 1 → คูณคริ → ปัดเป็นจำนวนเต็ม']);
    rows.push(['โอกาสโดน', d.kind === 'magic' ? 'เวทผู้เล่นโดนเสมอ; พื้นที่และระยะยังต้องถึงเป้า' : 'จำกัด 60–99% ตามความแม่นยำและ EVA ของเป้าหมาย']);
  }
  if (v.healHp) { const parts = []; if (v.self?.heal) parts.push('HP สูงสุด ' + fmt(c.maxHp) + ' × ' + (v.self.heal * 100).toFixed(1) + '% (รวมพลังรักษาแล้ว)'); if (v.self?.hp) parts.push('MATK ' + fmt(c.matk) + ' × ' + ((v.stats.hmult ?? 0) * 100).toFixed(1) + '% × จำนวนครั้งฮีล × พลังรักษา ' + c.healPow.toFixed(2)); rows.push(['สูตรฮีล', parts.join(' + ')]); rows.push(['รักษารวมของคุณ', '<b>' + fmt(v.healHp) + ' HP</b>']); }
  if (v.restoreMp) rows.push(['ฟื้น SP', fmt(v.restoreMp) + ' จาก SP สูงสุด ' + fmt(c.maxMp)]);
  if (v.support) rows.push(['ผลปาร์ตี้', 'ระยะ ' + v.support.radius.toFixed(1) + ' ม.' + (v.support.revive ? ' · ชุบด้วย HP ' + Math.round(v.support.revive * 100) + '%' : '')]);
  if (allyHeal(id)) rows.push(['ฮีลเจาะจงเพื่อน', 'เลือกเพื่อนในปาร์ตี้ × ' + ALLY_FOCUS + ' (ไม่ใช่ฮีลทุกคน)']);
  if (v.stats.buff) for (const [k, value] of Object.entries(v.stats.buff)) {
    if (typeof value !== 'number') continue;
    const [label, format] = BUFF_TH[k] ?? [k, n => n]; rows.push([label, String(format(value))]);
  }
  if (v.self?.buff?.cleanse || v.stats.buff?.cleanse) rows.push(['ล้างสถานะ', 'ล้างพิษ เชื่องช้า มึน และความเสียหายต่อเนื่องเมื่อรับบัฟ']);
  if (v.self?.buff?.dodge) rows.push(['หลบการโจมตี', '+' + Math.round(v.self.buff.dodge * 100) + '% โอกาสหลบระหว่างบัฟ']);
  if (v.self?.buff?.hot) rows.push(['ฟื้นตัวต่อเนื่อง', (v.self.buff.hot * 100).toFixed(1) + '% HP สูงสุด / วิระหว่างบัฟ']);
  if (v.synergy) {
    const names = { stun: 'มึน', slow: 'เชื่องช้า', poison: 'พิษ', bleed: 'เลือดไหล', burn: 'ไฟลุก', armorBreak: 'เกราะแตก', weak: 'อ่อนแรง' };
    const conditions = (v.synergy.conditions ?? []).map(k => names[k] ?? k).join(' / ');
    rows.push(['จังหวะร่วมทีม', esc(v.synergy.label ?? 'ใช้ประโยชน์จากสถานะศัตรู')]);
    rows.push(['เงื่อนไข', 'เป้าหมายมี ' + esc(conditions)]);
    rows.push(['โบนัสเมื่อเข้าเงื่อนไข', '+' + Math.round(Math.min(.25, Math.max(0, v.synergy.damageBonus)) * 100) + '% ดาเมจ · ใช้โบนัสครั้งเดียวแม้ติดหลายสถานะ']);
  }
  if (v.duration) rows.push(['ระยะเวลาผล', v.duration.toFixed(1) + ' วิ']);
  if (v.splash) rows.push(['พื้นที่', v.splash.chain ? 'ส่งต่ออีก ' + v.splash.chain + ' เป้าใน ' + v.splash.radius + ' ม.' : v.splash.line ? 'แนวยาว ' + v.splash.length + ' ม. กว้าง ' + v.splash.width + ' ม.' : v.splash.cone ? 'พัดระยะ ' + v.splash.length + ' ม.' : 'รัศมี ' + v.splash.radius.toFixed(1) + ' ม. รอบ' + (v.splash.around === 'self' ? 'ตัวเอง' : 'เป้าหมาย')]);
  for (const effect of v.effects) rows.push([effect.label, effect.duration.toFixed(1) + ' วิ' + (effect.slow ? ' · ช้า ' + Math.round(effect.slow * 100) + '%' : effect.armorBreak ? ' · ลด DEF ' + Math.round(effect.armorBreak * 100) + '%' : effect.weak ? ' · ลดการโจมตี ' + Math.round(effect.weak * 100) + '%' : effect.dot ? ' · ต่อวินาที ' + (effect.dot * 100).toFixed(1) + '% ของดาเมจแรก' : '')]);
  if (v.effectSpec?.taunt) rows.push(['ยั่วยุ', 'รับเป้าในรัศมี ' + ((v.effectSpec.taunt.radius ?? v.stats.radius ?? 140) / RULES.kit.pxPerMeter).toFixed(1) + ' ม. · ศัตรูทั่วไป ' + (Math.min(8000, v.effectSpec.taunt.ms) / 1000).toFixed(1) + ' วิ · บอสไม่เกิน 2 วิ']);
  for (const key of ['poison', 'bleed', 'burn']) { const dot = v.effectSpec?.[key]; if (dot) rows.push(['สูตร ' + ({ poison: 'พิษ', bleed: 'เลือดไหล', burn: 'ไฟลุก' }[key]), 'ดาเมจแรก × ' + dot.ratio + ' × 1000/' + dot.every + ' ต่อวินาที · ระยะ ' + dot.ticks + ' × ' + (dot.every / 1000) + ' = ' + (dot.ticks * dot.every / 1000).toFixed(1) + ' วิ (ยอดเพิ่มนี้ไม่รวมในดาเมจตรง)']); }
  rows.push(['ใช้ SP', fmt(v.mp)], ['คูลดาวน์จริง', v.cooldown.toFixed(2) + ' วิ'], ['เวลาร่ายจริง', v.cast.toFixed(2) + ' วิ'], ['ระยะใช้สกิล', v.range.toFixed(1) + ' ม.']);
  return '<div class="g-yours"><span class="g-yours-h">ระบบคำนวณจากค่าสถานะปัจจุบัน · สกิล Lv ' + v.level + '</span>' + rows.map(([k,value]) => '<div><span>' + esc(k) + '</span><em>' + value + '</em></div>').join('') + '<small>ดาเมจนี้ก่อนหักเกราะ ไม่รวมโบนัสที่ขึ้นกับชนิดเป้าหมายหรือ PvP; การพลาด ระยะ การเคลื่อนที่ และผลซ้ำอาจทำให้ยอดจริงต่างกัน ผลฮีล/ฟื้น SP เป็นของคุณ สมาชิกปาร์ตี้ที่คิดเป็น % ใช้ค่าสูงสุดของคนนั้น ผลจริงไม่เกิน HP/SP ที่ขาด</small></div>';
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
      const node = e.target.closest('[data-sk]'); if (node) { this.pendingEvo = null; this.sel = node.dataset.sk; this.key = null; this.refresh(); return; }
      const up = e.target.closest('[data-learn]');
      const evo = e.target.closest('[data-evo]');
      if (evo) {
        const [id, pick] = evo.dataset.evo.split(':'), cost = this.c.evoCost(id, pick);
        const why = this.c.evoBlock(id, pick);
        if (why) { this.feed?.log(why, 'bad', true); return; }
        this.pendingEvo = { id, pick, cost }; this.key = null; this.refresh();
        this.root.querySelector('.g-evo-confirm')?.scrollIntoView({ block: 'center' });
        this.root.querySelector('[data-evo-confirm]')?.focus({ preventScroll: true });
        return;
      }
      if (e.target.closest('[data-evo-cancel]')) { const pending = this.pendingEvo; this.pendingEvo = null; this.key = null; this.refresh(); this.root.querySelector(`[data-evo="${pending?.id}:${pending?.pick}"]`)?.focus({ preventScroll: true }); return; }
      if (e.target.closest('[data-evo-confirm]')) {
        const pending = this.pendingEvo;
        if (!pending) return;
        const { id, pick, cost } = pending;
        const why = this.c.evoBlock(id, pick);
        if (cost !== this.c.evoCost(id, pick)) { this.pendingEvo.cost = this.c.evoCost(id, pick); this.key = null; this.refresh(); return; }
        this.pendingEvo = null;
        if (!why && this.c.chooseEvo(id, pick)) this.feed?.log(`${this.name(id)} → ${EVOLUTIONS[id][pick].name} · ${cost ? `−${cost} ตำลึง` : 'เลือกครั้งแรกฟรี'}`, 'epic');
        else this.feed?.log(why ?? 'เลือกสายไม่ได้', 'bad', true);
        this.key = null; this.refresh(); return;
      }
      if (up) {
        const id = up.dataset.learn, opens = this.c.skillOpensNext(id);
        if (this.c.learnSkill(id)) { this.feed?.log(`อัปสกิล ${this.name(id)} เป็น Lv.${this.c.skillLevel(id)}`, 'gold'); for (const k of opens) this.feed?.log(`ปลดสกิลใหม่ · ${this.name(k)}`, 'gold'); }
        else this.feed?.log(this.c.skillBlock(id) ?? 'อัปไม่ได้', 'bad', true);
      }
      if (e.target.closest('.g-skill-reset')) {
        if (this.c.resetSkills()) this.feed?.log('ลืมสกิลทั้งหมด · ได้แต้มสกิลคืน', 'gold');
        else this.feed?.log(this.c.skillPointsSpent ? `ตำลึงไม่พอ (${this.c.skillResetCost} ตำลึง)` : 'ยังไม่ได้ใช้แต้มสกิล', 'bad', true);
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
    if (this.pendingEvo) this.pendingEvo.cost = c.evoCost(this.pendingEvo.id, this.pendingEvo.pick);
    // the Job EXP bar moves on its own; the tree and card below are rebuilt only when they changed
    this.root.querySelector('.g-sk-jt').textContent = max ? 'Job สูงสุด' : `Job EXP ${(c.jobExp / c.jobExpNeeded * 100).toFixed(1)}%`;
    setBar(this.root.querySelector('.g-jexp'), max ? 1 : c.jobExp, max ? 1 : c.jobExpNeeded, '');
    const key = JSON.stringify([this.sel, c.jobLevel, c.skills, c.evo, c.gold, c.derived, c.patk, c.matk, c.critChance, c.cooldownCut, c.evoContext?.(), this.pendingEvo]);
    if (key === this.key) return;
    this.key = key;
    this.root.querySelector('.g-sk-path').innerHTML = `<span class="g-pchip cur">${classBadge(c.classId, c.cls, { size: 17 })}<span>${esc(c.cls?.name ?? '')}<small>ปัจจุบัน · Job Lv ${c.jobLevel} / ${MAX_JOB_LEVEL}</small></span></span>
      <small class="g-future-class">อาชีพขั้นสอง · ยังไม่เปิด</small>`;
    const pts = this.root.querySelector('.g-sk-pts'); pts.querySelector('b').textContent = c.skillPoints; pts.classList.toggle('g-has-points', c.skillPoints > 0);
    const reset = this.root.querySelector('.g-skill-reset');
    reset.innerHTML = `รีเซ็ตสกิล <span class="g-cost"><i class="g-coin"></i>${c.skillResetCost.toLocaleString()}</span>`; reset.disabled = c.skillPointsSpent <= 0;
    const tree = this.root.querySelector('.g-sk-tree'), card = this.root.querySelector('.g-sk-card');
    const openPaths = new Set([...card.querySelectorAll('details[data-path-details][open]')].map(e => e.dataset.pathDetails));
    const active = document.activeElement;
    const restoreFocus = card.contains(active) ? active.closest('[data-evo-confirm],[data-evo-cancel],[data-evo],[data-learn],summary[data-path-details]') : null;
    const focusKey = restoreFocus && ['data-evo-confirm', 'data-evo-cancel', 'data-evo', 'data-learn', 'data-path-details'].find(k => restoreFocus.hasAttribute(k));
    const focusSelector = focusKey ? `${restoreFocus.tagName === 'SUMMARY' ? 'summary' : ''}[${focusKey}="${restoreFocus.getAttribute(focusKey)}"]` : null;
    const cardScroll = card.scrollTop;
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
    const now = s.passive ? null : statsAt(s, lv, c.skillVariant(s.id)), nx = s.passive ? null : statsAt(s, lv + 1, c.skillVariant(s.id));
    const cmp = s.passive
      ? Object.entries(passiveBonusAt(s.id, Math.max(1, lv), c.evo[s.id])).map(([k, v]) => { const next = passiveBonusAt(s.id, lv + 1, c.evo[s.id])[k], f = v => BONUS_FMT[k] ? BONUS_FMT[k](v) : v; return `<div><span>${BONUS_TH[k] ?? k}</span><b>${!lv || maxed ? f(lv ? v : next) : `${f(v)} → <i>${f(next)}</i>`}</b></div>`; }).join('')
      : ROWS.filter(([, has]) => has(now) || has(nx)).map(([k, has, f]) => `<div><span>${k}</span><b>${!lv || maxed ? f(lv ? now : nx) : `${f(now)} → <i>${f(nx)}</i>`}</b></div>`).join('');
    const pips = Array.from({ length: MAX_SKILL_LEVEL }, (_, i) => `<i class="${i < lv ? 'on' : ''}"></i>`).join('');
    const paths = EVOLUTIONS[s.id], ready = lv >= EVO_LEVEL;
    const effective = SKILL_BY_ID[c.skillVariant(s.id)] ?? SKILL_BY_ID[s.id];
    const description = paths?.[c.evo[s.id]]?.desc ?? effective?.desc ?? s.desc;
    const evoHtml = !paths ? '' : `<div class="g-sk-evo"><span>เลือกสายสกิล A / B ${ready ? '' : `<small>ปลดล็อกเมื่อสกิล Lv.${EVO_LEVEL} · ตอนนี้ Lv.${lv}</small>`}</span><small class="g-evo-instruction">1. อ่านผลของแต่ละสาย → 2. กด “เลือกสาย” → 3. กดยืนยัน<br>เลือกได้หนึ่งสายต่อสกิล · ครั้งแรกฟรี · เปลี่ยนภายหลัง ${fmt(c.jobLevel * 10)} ตำลึง · ต้องพ้นการต่อสู้และรอผลสกิลจบ</small>${['A', 'B'].map(p => {
      const on = c.evo[s.id] === p, cost = c.evoCost(s.id, p);
      const why = c.evoBlock(s.id, p), previewCharacter = new Character({ ...c.toJSON(), evo: { ...c.evo, [s.id]: p } });
      previewCharacter.buffs = c.buffs.map(buff => ({ ...buff })); previewCharacter.night = c.night;
      const details = s.passive
        ? Object.entries(passiveBonusAt(s.id, Math.max(EVO_LEVEL, lv), p)).map(([k, v]) => `<div><span>${esc(BONUS_TH[k] ?? k)}</span><em>${esc(BONUS_FMT[k]?.(v) ?? v)}</em></div>`).join('')
        : yourNumbers(previewCharacter, s, `${s.id}@${p}`, Math.max(EVO_LEVEL, lv));
      const pending = this.pendingEvo?.id === s.id && this.pendingEvo.pick === p;
      const action = on ? `✓ กำลังใช้สาย ${p}` : !ready ? `ต้องมีสกิล Lv.${EVO_LEVEL}` : `${c.evo[s.id] ? 'เปลี่ยนเป็น' : 'เลือก'}สาย ${p} · ${cost ? `${fmt(cost)} ตำลึง` : 'ฟรี'}`;
      const confirmation = pending ? `<div class="g-evo-confirm" role="group" aria-label="ยืนยันเลือกสาย ${p}"><p>เลือกสาย ${p} · ${esc(paths[p].name)}<br>${cost ? `ค่าเปลี่ยนสาย ${fmt(cost)} ตำลึง` : 'เลือกครั้งแรกฟรี'} · คงคูลดาวน์เดิม<br>ยอดปัจจุบัน ${fmt(c.gold)} → ${fmt(c.gold - cost)} ตำลึง</p><button type="button" data-evo-confirm ${why ? 'disabled' : ''}>ยืนยัน${c.evo[s.id] ? 'เปลี่ยน' : 'เลือก'}สาย ${p}</button><button type="button" data-evo-cancel>ยกเลิก</button></div>` : '';
      return `<div class="g-path-option${on ? ' on' : ''}${pending ? ' is-pending' : ''}" style="--evo:${paths[p].color}"><div class="g-path-head"><b>สาย ${p}</b><strong>${esc(paths[p].name)}</strong>${on ? '<span>กำลังใช้อยู่</span>' : pending ? '<span>รอยืนยัน</span>' : ''}</div><p class="g-path-desc">${esc(paths[p].desc)}</p><details data-path-details="${s.id}:${p}" ${openPaths.has(`${s.id}:${p}`) ? 'open' : ''}><summary data-path-details="${s.id}:${p}">ดูตัวเลขและผลสกิล · สาย ${p}${lv < EVO_LEVEL ? ` · ตัวอย่าง Lv.${EVO_LEVEL}` : ''}</summary>${details}</details>${why && !on ? `<small class="g-path-block">${esc(why)}</small>` : ''}<button type="button" class="g-path-action${on ? ' on' : ''}" data-evo="${s.id}:${p}" ${ready && !why && !on ? '' : 'disabled'} aria-label="${esc(action)} · ${esc(paths[p].name)}" aria-expanded="${pending}" ${pending ? 'aria-controls="g-path-confirm"' : ''}>${action}</button>${confirmation.replace('class="g-evo-confirm"', 'id="g-path-confirm" class="g-evo-confirm"')}</div>`;
    }).join('')}</div>`;
    const label = locked ? esc(treeBlock) : maxed ? 'เลเวลสูงสุดแล้ว' : block ?? (lv ? 'อัปเลเวล <small>ใช้ 1 แต้ม</small>' : 'เรียนสกิล <small>ใช้ 1 แต้ม</small>');
    card.innerHTML = `<div class="g-skd-head"><span class="g-ic">${s.icon ? assetIcon(s.icon) : ''}</span><div><b>${esc(s.name)}</b><small>${s.passive ? 'ติดตัว · ไม่ต้องร่าย ไม่กินช่องลัด' : `${TYPE_TH[effective?.type] ?? 'สกิล'} · ${effective?.kind === 'physical' ? 'กายภาพ' : effective?.kind === 'magic' ? 'เวทย์' : 'สนับสนุน'}`}</small><div class="g-pips">${pips}</div></div>
        <span class="g-skd-lv">Lv ${lv}/${MAX_SKILL_LEVEL}<small>${locked ? 'ยังไม่ปลด' : lv ? 'เรียนแล้ว' : 'เรียนได้'}</small></span></div>
      ${description ? `<p class="g-skd-desc">${esc(description)}</p>` : ''}
      ${evoHtml}
      ${cmp ? `<div class="g-cmp">${cmp}</div>` : ''}
      ${s.passive ? '' : yourNumbers(c, s, c.skillVariant(s.id), lv)}
      <div class="g-reqs"><span><b class="g-lvtag">ปลด</b><span class="${c.jobLevel >= need ? 'ok' : 'no'}">${c.jobLevel >= need ? '✓' : '✗'} Job Lv ${need}</span></span>${reqs.map(([k, n]) => `<span><b class="g-lvtag">ก่อน</b><span class="${c.skillLevel(k) >= n ? 'ok' : 'no'}">${c.skillLevel(k) >= n ? '✓' : '✗'} ${esc(this.name(k))} Lv ${n}</span></span>`).join('')}<span><b class="g-lvtag">แต้ม</b><span class="${c.skillPoints > 0 ? 'ok' : 'no'}">${c.skillPoints > 0 ? '✓' : '✗'} เหลือ ${c.skillPoints} แต้ม</span></span></div>
      <button type="button" class="g-skd-up" data-learn="${s.id}" ${block ? 'disabled' : ''}>${label}</button>`;
    card.scrollTop = cardScroll;
    if (focusSelector) card.querySelector(focusSelector)?.focus({ preventScroll: true });

    // the action bar's ten slots
    this.root.querySelector('.g-sk-slots').innerHTML = this.kit.skills.map((k, i) => c.skillLevel(k.id)
      ? `<div class="g-skslot">${k.icon ? assetIcon(k.icon) : ''}<kbd>${(i + 1) % 10}</kbd><span>${esc(k.name)}</span></div>`
      : `<div class="g-skslot empty">${(i + 1) % 10} · ว่าง</div>`).join('');
  }
}
