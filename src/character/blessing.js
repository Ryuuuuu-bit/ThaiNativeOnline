// พรจากการไหว้พระในอุโบสถ (map ubosot, src/world/ubosot.js): once a Thai calendar day the
// player lights incense before the presiding Buddha and shakes the siamsi; the card drawn
// (TEMPLE_SIAMSI below) blesses the character for BLESSING_HOURS of real time. The day
// resets at midnight Thai time (todayKey); a new card replaces the old one. Pure: shared by
// Character, the server and tests.
//
// Saved on the character as `blessing: { day, no, at, until }` (ms timestamps). It is kept
// apart from `buffs`: death does not clear it and it never blocks skill-evolution choices.
// Every card blesses one of three things, by luck: ดีเลิศ +20% · ดีมาก +15% · ดี +10% · กลาง +5%
//   atkMul  damage (ATK/MATK ratio)   expMul  kill EXP   dropMul  loot chance
// No card is harmful; the twelve are drawn with equal chance.
import { todayKey } from '../rules/data/blessings.js';

const LUCK = [['ดีเลิศ', .20], ['ดีมาก', .15], ['ดี', .10], ['กลาง', .05]];
const KINDS = {
  dmg: { mod: 'atkMul', label: 'ดาเมจ', text: ['ดาบคมดั่งสายฟ้า ศัตรูที่ขวางหน้าล้วนพ่ายแพ้', 'แขนแกร่งดั่งช้างสาร ทุกหมัดมีน้ำหนัก', 'จิตนิ่งมือมั่น การรบครั้งนี้จะราบรื่น', 'ค่อยเป็นค่อยไป แรงที่สะสมไว้จะส่งผล'] },
  exp: { mod: 'expMul', label: 'EXP', text: ['ดั่งพระจันทร์เต็มดวง ปัญญาสว่างไสว เรียนรู้สิ่งใดก็แตกฉาน', 'ปลูกข้าวในนาดี ได้ผลงามเกินคาด งานที่ทำจะให้ผล', 'น้ำนิ่งไหลลึก ทุกก้าวคือบทเรียน', 'ทางยาวไกลแต่ไม่โดดเดี่ยว มีมิตรร่วมทาง'] },
  drop: { mod: 'dropMul', label: 'ของดรอป', text: ['พญานาคให้พร ทรัพย์สมบัติไหลมาเทมา', 'ทองคำฝังดิน ขุดพบโดยบังเอิญ โชคลาภมาจากทางไม่คาดคิด', 'ของหายได้คืน ของดีจะตกถึงมือ', 'ฟ้าหลังฝนย่อมสดใส อดทนไว้แล้วจะดีเอง'] },
};
// ใบที่ 1–12: by luck tier (ดีเลิศ first), each tier one card of each kind.
export const TEMPLE_SIAMSI = Object.freeze(LUCK.flatMap(([luck, bonus], tier) => Object.entries(KINDS).map(([kind, k], i) => Object.freeze({
  no: tier * 3 + i + 1, luck, kind, bonus, text: k.text[tier],
  mods: Object.freeze({ [k.mod]: k.mod === 'atkMul' ? bonus : +(1 + bonus).toFixed(2) }),
}))));
export const SIAMSI = TEMPLE_SIAMSI;
// "ดาเมจ +20%"
export const modsText = m => Object.entries(KINDS).filter(([, k]) => m?.[k.mod] != null)
  .map(([, k]) => `${k.label} +${Math.round((k.mod === 'atkMul' ? m[k.mod] : m[k.mod] - 1) * 100)}%`).join(' · ');

export const BLESSING_HOURS = 3;
export const BLESSING_MS = BLESSING_HOURS * 3600e3;
export { todayKey };
export const siamsiCard = no => SIAMSI.find(card => card.no === no) ?? null;

// A saved blessing made valid (null if malformed).
export function cleanBlessing(b) {
  if (!b || typeof b !== 'object') return null;
  const { day, no, at, until } = b;
  if (typeof day !== 'string' || !/^\d{4}-\d{1,2}-\d{1,2}$/.test(day) || !siamsiCard(no)) return null;
  if (![at, until].every(Number.isSafeInteger) || until <= at || until - at > BLESSING_MS) return null;
  return { day, no, at, until };
}
// The card in force at `now`, or null.
export function activeBlessing(b, now = Date.now()) {
  return b && now < b.until && now >= b.at ? siamsiCard(b.no) : null;
}
// The mods in force (an empty object when none).
export const blessingMods = (b, now = Date.now()) => activeBlessing(b, now)?.mods ?? {};
// Whether a new card may be drawn today.
export const canDrawBlessing = (b, now = Date.now()) => !b || b.day !== todayKey(now);
export const drawSiamsiNo = (random = Math.random) => SIAMSI[Math.min(SIAMSI.length - 1, Math.floor(random() * SIAMSI.length))].no;

// Draw today's card onto the character → { ok: true, blessing } or { ok: false, why: 'today' }.
export function grantBlessing(c, { now = Date.now(), random = Math.random } = {}) {
  if (!canDrawBlessing(c.blessing, now)) return { ok: false, why: 'today', blessing: c.blessing };
  const blessing = { day: todayKey(now), no: drawSiamsiNo(random), at: now, until: now + BLESSING_MS };
  c.blessing = blessing;
  c.emit?.('blessing', blessing); c.emit?.('change');
  return { ok: true, blessing };
}

// Kill reward multipliers for a character at `now` (1 when unblessed).
export function blessingRewardMul(b, now = Date.now()) {
  const m = blessingMods(b, now);
  return { exp: m.expMul ?? 1, gold: m.goldMul ?? 1, drop: m.dropMul ?? 1 };
}
