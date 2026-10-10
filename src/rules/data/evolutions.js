// Skill evolution A/B and cast times for the class kits (src/classes/*-moves.js).
//
// Evolution: a kit skill at skill Lv.5 (EVO_LEVEL) can take path A or B. The first choice is
// free; switching later costs Job level × 10 ตำลึง outside combat. A path is the rules skill
// (src/rules/data/skills.js) with some fields replaced — damage (mult), area (radius, or a
// `splash` in metres), side effects (`effect` replaces the whole effect), buffs, heals, cast
// time — registered in SKILL_BY_ID as '<skill id>@A' / '@B', so every rules function
// (kitCombat castInfo / rollBlow / hitEffects / selfEffects, the server's rolls) reads it like
// any other skill. `chain: n` sends a blow on to the n nearest monsters around the target.
// `color` tints the cast flash (src/combat/CombatView.js) so the two paths look apart.
// The choice lives on the character (Character.evo, chooseEvo, skillVariant).
//
// Cast times: CAST_MS (ms, before the character's cast speed) for the big caster skills;
// melee stays instant. A cast bar fills first (src/training/KitCaster.js), walking cancels it.
import { SKILL_BY_ID } from './skills.js';
import { PASSIVE_PATH_BONUSES } from './kitpassives.js';
import { PROPOSED_ACTIVE_PATHS, PROPOSED_PASSIVE_PATHS } from '../../character/data/skill-path-design.js';

export const EVO_LEVEL = 5;
// Legacy constant retained for import compatibility; new transactions use the helper.
export const EVO_SWITCH_GOLD = 500;
// First choice is free; subsequent A/B changes cost Job level × 10 ตำลึง.
// State/proximity/combat authorization belongs to Character and the server.
export function evolutionSwitchCost(jobLevel, current, next) {
  if (!['A', 'B'].includes(next) || !['A', 'B'].includes(current) || current === next) return 0;
  const job = Math.min(50, Math.max(1, Math.trunc(Number(jobLevel) || 1)));
  return job * 10;
}
export const evoId = (id, pick) => `${id}@${pick}`;
export const baseSkillId = id => String(id).split('@')[0];

export const CAST_MS = {
  mage_kalp: 1000, mage_curse: 800, mage_ghostfire: 600, mage_storm: 1500,
  heal_mist: 800, heal_mother: 1200, heal_khwan: 1200, heal_amrita: 900,
  arch_snipe: 1000, arch_meteor: 800,
};

const stun = ms => ({ stun: { ms } });
export const EVOLUTIONS = {
  // ---- มวยไทย ----
  boxer_kick: {
    A: { name: 'เตะตัดขา', desc: 'เตะต่ำล้มคว่ำ มึนนาน 1.5 วิ', color: '#ffd36b', mult: 2.1, effect: stun(1500) },
    B: { name: 'เตะกวาดวง', desc: 'เตะเหวี่ยงโดนทุกตัวรอบเป้า 2.5 ม. มึนสั้น', color: '#ff8a4a', mult: 1.7, splash: { radius: 2.5, around: 'target' }, effect: stun(500) },
  },
  boxer_croc: {
    A: { name: 'ฟาดหางยักษ์', desc: 'วงกว้างขึ้น 50% แรงลดนิด', color: '#7fd0a0', mult: 1.5, radius: 72 },
    B: { name: 'ฟาดหางเลือด', desc: 'แรงขึ้น และทุกตัวเลือดไหล', color: '#e04848', mult: 2.2, effect: { bleed: { ticks: 4, every: 600, ratio: .25 } } },
  },
  boxer_elbow: {
    A: { name: 'ศอกกลับมึน', desc: 'มึน 1.2 วิ ไม่มีเลือดไหล', color: '#ffd36b', effect: stun(1200) },
    B: { name: 'ศอกกรีดเลือด', desc: 'เลือดไหลแรงและนาน ไม่มีมึน', color: '#e04848', effect: { bleed: { ticks: 5, every: 600, ratio: .4 } } },
  },
  // ---- นักรบ ----
  sword_twin: {
    A: { name: 'ดาบคู่พายุ', desc: 'ฟันกว้าง 3 ม. รอบเป้า แรงลดนิด', color: '#a8d4ff', mult: .8, splash: { radius: 3, around: 'target' } },
    B: { name: 'ดาบคู่เชือด', desc: 'แรงขึ้น เลือดไหลหนักขึ้น', color: '#e04848', mult: 1.1, effect: { bleed: { ticks: 3, every: 600, ratio: .35 } } },
  },
  sword_thrust: {
    A: { name: 'แทงทะลุแนว', desc: 'แทงทะลุทุกตัวในแนวยาว 6 ม.', color: '#a8d4ff', mult: 2.6, splash: { line: true, length: 6, width: 1.1 } },
    B: { name: 'แทงตรึง', desc: 'ตรึงเป้านิ่ง 1.5 วิ', color: '#ffd36b', effect: stun(1500) },
  },
  sword_whirl: {
    A: { name: 'จักรพายุ', desc: 'วงกว้างขึ้นมาก แรงลดลง', color: '#a8d4ff', mult: 1.3, radius: 110 },
    B: { name: 'จักรหนัก', desc: 'แรงขึ้น ทุกตัวช้าลง 40%', color: '#c8a070', mult: 2.1, effect: { slow: { ms: 2500, pct: .4 } } },
  },
  // ---- นายพราน ----
  arch_poison: {
    A: { name: 'ขย้ำ', desc: 'น้องหมางับค้างนานขึ้น เลือดไหลหนัก', color: '#e04848', effect: { stun: { ms: 2500 }, bleed: { ticks: 4, every: 1000, ratio: .35 } } },
    B: { name: 'เรียกฝูง', desc: 'งับต่อไปอีก 3 ตัวรอบเป้า', color: '#c8a070', mult: 1.8, chain: 3 },
  },
  arch_pierce: {
    A: { name: 'ห่าศรเจาะ', desc: 'วงแคบลง แต่แรงขึ้นมาก', color: '#ffd36b', mult: 2.8, radius: 60 },
    B: { name: 'ห่าศรพายุ', desc: 'วงกว้างขึ้นเกือบเท่าตัว แรงลดลง', color: '#a8d4ff', mult: 1.6, radius: 130 },
  },
  arch_trap: {
    A: { name: 'กับดักหนาม', desc: 'ตรึงนาน 2.5 วิ แล้วช้าลง', color: '#c8a070', effect: { stun: { ms: 2500 }, slow: { ms: 3000, pct: .4 } } },
    B: { name: 'กับดักไฟ', desc: 'ไฟลุกต่อเนื่อง ตรึงสั้น', color: '#ff8a4a', effect: { stun: { ms: 800 }, burn: { ticks: 5, every: 600, ratio: .3 } } },
  },
  // ---- หมอผี ----
  mage_yant: {
    A: { name: 'โซ่ตรึงวิญญาณ', desc: 'ตรึงนาน 2.8 วิ แรงลดลง', color: '#9fc4ff', mult: 2.4, effect: stun(2800) },
    B: { name: 'โซ่นรกกระชาก', desc: 'แรงขึ้นมาก ตรึงสั้น', color: '#e04848', mult: 3.6, effect: stun(900) },
  },
  mage_kalp: {
    A: { name: 'ไฟนรกอัดแน่น', desc: 'วงแคบลง แรงขึ้น ร่ายไวขึ้น', color: '#ff5a3c', mult: 2.8, radius: 110, castMs: 700 },
    B: { name: 'ทุ่งไฟนรก', desc: 'วงกว้าง ไฟลุกนานและแรง ร่ายนานขึ้น', color: '#ffb060', mult: 1.9, radius: 220, castMs: 1300, effect: { burn: { ticks: 6, every: 600, ratio: .45 } } },
  },
  mage_curse: {
    A: { name: 'คำสาปพิษ', desc: 'พิษแรงและนาน ไม่ช้า', color: '#9cf07a', effect: { poison: { ticks: 8, every: 700, ratio: .6 } } },
    B: { name: 'คำสาปตรึง', desc: 'ช้าลง 60% และมึน พิษเบา', color: '#b98bd9', effect: { stun: { ms: 600 }, slow: { ms: 5000, pct: .6 }, poison: { ticks: 6, every: 700, ratio: .25 } } },
  },
  // ---- หมอยา ----
  heal_mortar: {
    A: { name: 'ครกระเบิด', desc: 'ระเบิดแรงขึ้น มึนนานขึ้น', color: '#ff8a4a', mult: 2.8, effect: { stun: { ms: 800 }, slow: { ms: 2500, pct: .3 } } },
    B: { name: 'ครกยาชุ่ม', desc: 'วงกว้างขึ้น ทุกตัวช้าลงครึ่งหนึ่ง', color: '#9df0a8', radius: 150, effect: { stun: { ms: 400 }, slow: { ms: 3500, pct: .5 } } },
  },
  heal_mist: {
    A: { name: 'หมอกฟื้นกาย', desc: 'ฟื้น HP มากขึ้น ไม่ฟื้น MP', color: '#9df0a8', heal: .26, mpHeal: 0 },
    B: { name: 'หมอกฟื้นใจ', desc: 'ฟื้น MP มาก ป้องกันเพิ่ม HP น้อยลง', color: '#9fc4ff', heal: .12, mpHeal: .25, buff: { def: 12 } },
  },
  heal_tiger: {
    A: { name: 'ยาพยัคฆ์เหล็ก', desc: 'ป้องกัน +35%', color: '#c8a070', buff: { defMul: .35, cleanse: true }, grow: { defMul: .03 } },
    B: { name: 'ยาพยัคฆ์ดุ', desc: 'โจมตี +20% ป้องกัน +10%', color: '#e04848', buff: { atkMul: .2, defMul: .1, cleanse: true }, grow: { atkMul: .02 } },
  },
};

// Preserve the original fifteen paths; add choices for every remaining kit skill.
for (const [id, paths] of Object.entries(PROPOSED_ACTIVE_PATHS)) if (!EVOLUTIONS[id]) {
  EVOLUTIONS[id] = Object.fromEntries(Object.entries(paths).map(([pick, path]) => [pick, { color: pick === 'A' ? '#9fd8c0' : '#e0b276', ...path }]));
}
for (const [id, paths] of Object.entries(PROPOSED_PASSIVE_PATHS)) {
  EVOLUTIONS[id] = Object.fromEntries(Object.entries(paths).map(([pick, path]) => [pick, { color: pick === 'A' ? '#9fd8c0' : '#e0b276', passive: true, ...path }]));
  PASSIVE_PATH_BONUSES[id] = Object.fromEntries(Object.entries(paths).map(([pick, path]) => [pick, path.bonusPerLevel]));
}

const META = new Set(['name', 'desc', 'color', 'passive', 'bonusPerLevel']);
// cast times, then the paths (which inherit them unless they set their own)
for (const [id, ms] of Object.entries(CAST_MS)) if (SKILL_BY_ID[id]) SKILL_BY_ID[id].castMs = ms;
for (const [id, paths] of Object.entries(EVOLUTIONS)) {
  const base = SKILL_BY_ID[id]; if (!base) continue;
  for (const [pick, p] of Object.entries(paths)) {
    const over = Object.fromEntries(Object.entries(p).filter(([k]) => !META.has(k)));
    SKILL_BY_ID[evoId(id, pick)] = { ...base, ...over, id: evoId(id, pick), evo: pick, nameTh: p.name };
  }
}
export const evoOf = id => EVOLUTIONS[baseSkillId(id)]?.[String(id).split('@')[1]] ?? null;
