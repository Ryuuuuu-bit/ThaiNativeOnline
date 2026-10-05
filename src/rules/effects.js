// ============================================================
//  Skill status effects on a target (mob) — pure port of the original server logic
//  (thainative server/td.js: onHit "ผลพิเศษของสกิล" + tickMobs DoT loop + the inline
//  slow / armorBreak / weak reads). No timers, no sockets: callers pass `now` (ms).
//
//  Effect spec (data/skills.js `effect`, returned by character.attackSpec(...).effect):
//    stun: { ms } · slow: { ms, pct } · armorBreak: { ms, pct } · weak: { ms, pct }
//    poison | bleed | burn: { ticks, every, ratio }
//  State is stored on the target with the original field names:
//    stunUntil · dots { poison|bleed|burn: { by, dmg, left, every, next } } | null
//    slowUntil, slowPct · defDownUntil, defDownPct · weakUntil, weakPct
// ============================================================

export const DOT_KINDS = ['poison', 'bleed', 'burn'];
/** บอสติดสถานะครึ่งเวลา */
export const BOSS_EFFECT_MUL = 0.5;

/**
 * Apply a skill's effects after a successful hit. Call AFTER subtracting the hit from target.hp
 * (like the server): nothing is applied to a target whose hp is already <= 0.
 * @param {object} target  mob state (mutated). `target.boss` → durations ×0.5 (DoT ticks unchanged).
 * @param {object|null} effects  skill effect spec (see header)
 * @param {number} hitDamage  damage of the hit that applied it (DoT per tick = max(1, round(hitDamage × ratio)))
 * @param {number} now  ms timestamp
 * @param {{ by?: any }} [opts]  by = source id stored on DoTs (credit for damage/kill)
 * @returns {object} target
 */
export function applyEffects(target, effects, hitDamage, now, opts = {}) {
  const eff = effects || {}, effMul = target.boss ? BOSS_EFFECT_MUL : 1;
  const alive = !(target.hp <= 0);
  if (!alive) return target;
  // ดีบัฟเดิมหมดแล้ว = ใช้ความแรงใหม่ (ไม่ค้างค่าแรงสุด) · ยังติดอยู่ = เก็บค่าที่แรงกว่า
  const slowActive = now < (target.slowUntil || 0), defActive = now < (target.defDownUntil || 0), weakActive = now < (target.weakUntil || 0);
  if (eff.stun) target.stunUntil = Math.max(target.stunUntil || 0, now + eff.stun.ms * effMul);
  for (const k of DOT_KINDS) if (eff[k]) {
    const P = eff[k];
    (target.dots ||= {})[k] = { by: opts.by ?? null, dmg: Math.max(1, Math.round(hitDamage * P.ratio)), left: P.ticks, every: P.every, next: now + P.every };
  }
  if (eff.slow) { target.slowUntil = Math.max(target.slowUntil || 0, now + eff.slow.ms * effMul); target.slowPct = slowActive ? Math.max(target.slowPct, eff.slow.pct) : eff.slow.pct; }
  if (eff.armorBreak) { target.defDownUntil = Math.max(target.defDownUntil || 0, now + eff.armorBreak.ms * effMul); target.defDownPct = defActive ? Math.max(target.defDownPct, eff.armorBreak.pct) : eff.armorBreak.pct; }
  if (eff.weak) { target.weakUntil = Math.max(target.weakUntil || 0, now + eff.weak.ms * effMul); target.weakPct = weakActive ? Math.max(target.weakPct, eff.weak.pct) : eff.weak.pct; }
  return target;
}

/**
 * Advance damage-over-time. Each due DoT deals its fixed dmg, decrements `left`, reschedules
 * `next = now + every`, and is removed when `left` reaches 0. Kinds stack; same kind replaces.
 * Subtracts from target.hp and stops at the first tick that drops hp to <= 0 (event.killed = true;
 * the caller resolves the kill). `target.dots` becomes null when empty.
 * @param {object} target
 * @param {number} now
 * @param {{ ownerOk?: (by:any) => boolean }} [opts]  ownerOk(by) false → that DoT is dropped
 *        without dealing damage (server: the caster left the map or died)
 * @returns {Array<{ kind: string, by: any, dmg: number, hp: number, killed: boolean }>}
 */
export function tickEffects(target, now, opts = {}) {
  const events = [];
  if (!target.dots) return events;
  for (const k of Object.keys(target.dots)) {
    const P = target.dots[k];
    if (now < P.next) continue;
    if (opts.ownerOk && !opts.ownerOk(P.by)) { delete target.dots[k]; continue; }
    target.hp -= P.dmg; P.left--; P.next = now + P.every;
    const killed = target.hp <= 0;
    events.push({ kind: k, by: P.by, dmg: P.dmg, hp: Math.max(0, Math.round(target.hp)), killed });
    if (P.left <= 0) delete target.dots[k];
    if (killed) break;
  }
  if (!Object.keys(target.dots || {}).length) target.dots = null;
  return events;
}

/** ติดมึน: ไม่เดิน ไม่ตี (server also cancels queued strikes) */
export const isStunned = (t, now) => now < (t.stunUntil || 0);
/** ตัวคูณความเร็วเดิน (เชื่องช้า) */
export const slowMul = (t, now) => (now < (t.slowUntil || 0) ? 1 - (t.slowPct || 0) : 1);
/** ตัวคูณ DEF ของเป้า (เกราะแตก) */
export const defMul = (t, now) => (now < (t.defDownUntil || 0) ? 1 - (t.defDownPct || 0) : 1);
/** ดาเมจที่เป้า (อ่อนแรง) ทำได้ → max(1, round(dmg × (1 − weakPct))) ขณะติด · ไม่ติด = เท่าเดิม */
export const weakenDamage = (t, dmg, now) => (now < (t.weakUntil || 0) ? Math.max(1, Math.round(dmg * (1 - (t.weakPct || 0)))) : dmg);
/** ล้างสถานะทั้งหมด (server: ผีตาย/เกิดใหม่) */
export function clearEffects(t) {
  Object.assign(t, { stunUntil: 0, dots: null, slowUntil: 0, slowPct: 0, defDownUntil: 0, defDownPct: 0, weakUntil: 0, weakPct: 0 });
  return t;
}
