import { CARD_ITEMS, socketCards } from '../character/data/cards.js';
import { ITEMS, EQUIP_SLOTS, slotKind } from '../character/data/items.js';
import { WEAPON_KINDS } from '../character/data/classes.js';

export const BOSS_CARD_DAMAGE_CAP = .3, BOSS_CARD_REDUCTION_CAP = .3;

// Pure reads: only valid sockets on active, currently worn gear count.
export function activeBossCardEffects(c) {
  const effects = new Map();
  for (const slot of EQUIP_SLOTS) {
    const id = c?.equipment?.[slot], gear = ITEMS[id];
    if (!gear || gear.type !== 'equip' || gear.retired || gear.slot !== slotKind(slot)
      || (c.level ?? 1) < (gear.minLevel ?? 1)) continue;
    if (gear.weapon && !(WEAPON_KINDS[c.classId] ?? []).includes(gear.weapon)) continue;
    for (const card of socketCards(id, c.cards?.[slot], ITEMS)) {
      const special = CARD_ITEMS[card]?.special;
      if (special) effects.set(special.id, special);
    }
  }
  return [...effects.values()];
}

const alive = c => Number.isFinite(c?.hp) && c.hp > 0;
const matches = (c, e, def, hp = c.hp) => {
  return (!e.race || e.race === def?.race) && (!e.element || e.element === def?.element)
    && (!e.boss || !!def?.boss) && (e.hpAtMost === undefined || hp <= c.maxHp * e.hpAtMost)
    && (e.hpAtLeast === undefined || hp >= c.maxHp * e.hpAtLeast);
};
const definition = target => target?.def && typeof target.def === 'object' ? target.def : target;

export function bossCardOutgoingMul(c, target, { dot = false, pvp = false, hpFraction } = {}) {
  if (!alive(c) || dot || pvp) return 1;
  // Guest HP remains browser-owned. This bounded context changes only the
  // condition evaluation, never Character's vitals or the rolled damage stats.
  const hp = Number.isFinite(hpFraction) ? Math.max(0, Math.min(1, hpFraction)) * c.maxHp : c.hp;
  if (!(hp > 0)) return 1;
  const bonus = activeBossCardEffects(c).filter(e => e.kind === 'outgoing' && matches(c, e, definition(target), hp))
    .reduce((sum, e) => sum + e.bonus, 0);
  return 1 + Math.min(BOSS_CARD_DAMAGE_CAP, bonus);
}
export function bossCardIncomingMul(c, { pvp = false } = {}) {
  if (!alive(c) || pvp) return 1;
  const effects = activeBossCardEffects(c);
  const reduction = effects.filter(e => e.kind === 'incoming' && matches(c, e)).reduce((sum, e) => sum + e.reduction, 0);
  const penalty = effects.reduce((sum, e) => sum + (e.incomingPenalty ?? 0), 0);
  return (1 - Math.min(BOSS_CARD_REDUCTION_CAP, reduction)) * (1 + penalty);
}

// Cooldowns belong to the combat character, not its equipment or saved inventory.
export const createBossCardProcState = () => ({ hitReadyAt: -Infinity, killReadyAt: -Infinity });
const procStates = new WeakMap();
export function bossCardProcStateFor(c) {
  if (!procStates.has(c)) procStates.set(c, createBossCardProcState());
  return procStates.get(c);
}

// Pure proc plans. Runtime callers provide actual HP removed and a seconds clock.
export function bossCardHitPlan(c, actualDamage, now, state, { pet = false, dot = false, pvp = false } = {}) {
  if (!alive(c) || pet || dot || pvp || !Number.isFinite(actualDamage) || actualDamage <= 0
    || !Number.isFinite(now) || now < state.hitReadyAt) return null;
  const e = activeBossCardEffects(c).find(e => e.kind === 'lifesteal');
  if (!e) return null;
  const amount = Math.max(0, Math.min(Math.round(actualDamage * e.ratio), Math.floor(c.maxHp * e.maxHpRatio), Math.floor(c.maxHp - c.hp)));
  return amount > 0 ? { amount, readyAt: now + e.cooldown } : null;
}
export function bossCardKillPlan(c, now, state) {
  if (!alive(c) || !Number.isFinite(now) || now < state.killReadyAt) return null;
  const e = activeBossCardEffects(c).find(e => e.kind === 'killMp');
  if (!e) return null;
  const amount = Math.max(0, Math.min(Math.floor(c.maxMp * e.ratio), Math.floor(c.maxMp - c.mp)));
  return amount > 0 ? { amount, readyAt: now + e.cooldown } : null;
}

export function applyBossCardHit(c, state, now, actualDamage, options) {
  const plan = bossCardHitPlan(c, actualDamage, now, state, options);
  if (!plan) return 0;
  const healed = c.heal(plan.amount);
  if (healed > 0) state.hitReadyAt = plan.readyAt;
  return healed;
}
// Only call after consuming a genuine, owner-bound kill receipt.
export function applyBossCardKill(c, state, now) {
  const plan = bossCardKillPlan(c, now, state);
  if (!plan) return 0;
  c.mp += plan.amount; state.killReadyAt = plan.readyAt; c.emit('change');
  return plan.amount;
}
