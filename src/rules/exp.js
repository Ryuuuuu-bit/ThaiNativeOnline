// ============================================================
//  แบ่ง EXP ผี 1 ตัวแบบ RO — pure port of splitExp() in the original server/td.js
//  ▸ แต่ละคนได้ส่วนตามดาเมจที่ทำ · สมาชิกปาร์ตี้รวมส่วนเข้ากองกลาง แล้วหารเท่ากันให้เพื่อนที่อยู่แมพเดียวกัน (ยังไม่ตาย)
//  ▸ กองกลางได้โบนัส +10%/เพื่อนเพิ่ม 1 คน · เลเวลในกลุ่มห่างเกิน 15 = ไม่หาร (ต่างคนต่างได้ส่วนตัวเอง)
//  ▸ แต่ละคนคิดแคปตามช่วงเลเวล/เพดาน 20% ของหลอดของตัวเอง (mobExp) + พร EXP ของตัวเอง (expMul)
//  The server's socket/player registry is replaced by an injected `world` lookup.
// ============================================================
import { PARTY } from './constants.js';
import { mobExp } from './stats.js';

export const PARTY_LV_GAP = PARTY.lvGap;       // 15
export const PARTY_EXP_BONUS = PARTY.mapBonus; // +0.10 per extra member on the map

const entriesOf = (dmgBy) => (dmgBy instanceof Map ? [...dmgBy] : Object.entries(dmgBy || {}));

/**
 * @param {{ dmgBy: Map<any,number>|Record<string,number>, level: number, boss?: boolean }} mob
 *        dmgBy = damage dealt per player id · level = mob level · boss → boss EXP cap
 * @param {any} killerId  always counted (with weight 1 if it dealt no recorded damage)
 * @param {number} baseExp  mob EXP after time-of-day multiplier (server: d.exp × timeMods(d).exp)
 * @param {{ player: (id:any) => ({ level: number, expMul?: number, dead?: boolean, sameMap?: boolean, party?: any } | null | undefined),
 *           members?: (party:any) => Iterable<any> }} world
 *        player(id): null/undefined = gone · sameMap false = not on the mob's map (default true)
 *        expMul = the player's EXP blessing multiplier (blessingsOf(char).expMul, default 1)
 *        party = any party key (null = solo) · members(party) → ids of that party
 * @returns {Map<any, { exp: number, bonus: number }>} bonus = party bonus in % (0 when not shared)
 */
export function splitExp(mob, killerId, baseExp, world) {
  const P = (id) => world.player(id);
  const here = (q) => !!q && q.sameMap !== false;
  const contrib = new Map(entriesOf(mob.dmgBy).filter(([id, v]) => v > 0 && here(P(id))));
  if (!contrib.has(killerId)) contrib.set(killerId, 1);
  const total = [...contrib.values()].reduce((a, b) => a + b, 0) || 1;
  const out = new Map(), pools = new Map();
  const give = (id, q, raw, bonus = 0) => {
    if (!q) return;
    const e = Math.round(mobExp(raw * (q.expMul ?? 1), q.level, mob.level, !!mob.boss));
    const cur = out.get(id); out.set(id, { exp: (cur?.exp || 0) + e, bonus: Math.max(cur?.bonus || 0, bonus) });
  };
  for (const [id, dmg] of contrib) {
    const q = P(id), party = q?.party ?? null, raw = baseExp * dmg / total;
    if (party == null) { give(id, q, raw); continue; }
    const pool = pools.get(party) || { raw: 0, own: [] }; pool.raw += raw; pool.own.push([id, q, raw]); pools.set(party, pool);
  }
  for (const [party, pool] of pools) {
    const mates = [...(world.members?.(party) || [])].map((id) => [id, P(id)]).filter(([, q]) => q && !q.dead && here(q));
    const lv = mates.map(([, q]) => q.level);
    if (mates.length < 2 || Math.max(...lv) - Math.min(...lv) > PARTY_LV_GAP) { for (const [id, q, raw] of pool.own) give(id, q, raw); continue; }
    const bonus = PARTY_EXP_BONUS * (mates.length - 1);
    for (const [id, q] of mates) give(id, q, pool.raw * (1 + bonus) / mates.length, Math.round(bonus * 100));
  }
  return out;
}
