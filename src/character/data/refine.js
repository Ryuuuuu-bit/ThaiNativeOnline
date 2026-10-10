// ตีบวก (refining, RO style) at หมื่นเพชรศาสตรา's โรงหลอมศาสตรา (shop 'enhance', src/data/shops.js).
// Every piece of gear but a charm goes from +0 up to +REFINE_MAX, one step a try. A try costs
// one ore (แร่ศักดิ์สิทธิ์ for a weapon, ทองคำเปลว for the rest, sold at the forge) and
// refineFee(to) gold. Up to +REFINE_SAFE it always works; past that it works with
// REFINE_RATE[to] and otherwise the item breaks, with every card in it (RO: no safety net).
// The plus travels with the item: `plus` on the bag item, Character.refine[slot] when worn.
//   weapon: ATK (MATK for a caster's weapon), scaled to the item's own power/rarity
//   armor · head · cape · shoes: DEF, scaled to the item's own defense
// Online the server rolls the outcome (server/combatants.js op 'refine').
import { sameCards } from './cards.js';

export const REFINE_MAX = 10, REFINE_SAFE = 4, REFINE_SHOP = 'enhance';
// chance a try to reach +n works (index n)
export const REFINE_RATE = [1, 1, 1, 1, 1, .6, .5, .4, .3, .2, .1];
export const REFINE_ORE = { weapon: 'sacred_ore', gear: 'gold_leaf' };
const WEAPON_STEP = { common: 2, rare: 3, epic: 5 };
// Cumulative weights: larger gains at +4, +7 and +10 reward the unchanged risks.
// +10 bounds the bonus at max(33 rarity steps, 132% base attack), or
// max(33 DEF, 82.5% base defense). Only native item stats scale; cards never do.
const BONUS_WEIGHT = [0, 1, 2, 3, 5, 7, 10, 14, 19, 25, 33];
export const REFINE_MILESTONES = Object.freeze([4, 7, 10]);

export const refinable = def => def?.type === 'equip' && (def.slot !== 'charm' || def.refinable === true);
export const oreFor = def => (def.slot === 'weapon' ? REFINE_ORE.weapon : REFINE_ORE.gear);
export const refineFee = to => 100 * to;
export const plusOf = n => (Number.isInteger(n) && n > 0 ? Math.min(REFINE_MAX, n) : 0);

// The stats a plus adds to an item: { atk | matk | def: n }.
export function refineBonus(def, plus) {
  plus = plusOf(plus);
  if (!plus || !refinable(def)) return null;
  const weapon = def.slot === 'weapon', weight = BONUS_WEIGHT[plus];
  const key = weapon ? ((def.bonus?.matk ?? 0) > (def.bonus?.atk ?? 0) ? 'matk' : 'atk') : 'def';
  const base = Number.isFinite(def.bonus?.[key]) ? Math.max(0, def.bonus[key]) : 0;
  const floor = weight * (weapon ? WEAPON_STEP[def.rarity] ?? 2 : 1);
  return { [key]: Math.max(floor, Math.ceil(base * weight / (weapon ? 25 : 40))) };
}

// What the next try costs and risks, or null when it cannot go higher.
export function refineCost(def, plus = 0) {
  if (!refinable(def) || !Number.isInteger(plus) || plus < 0 || plus >= REFINE_MAX) return null;
  const to = plus + 1;
  return { to, gold: refineFee(to), ore: oreFor(def), rate: REFINE_RATE[to], risky: to > REFINE_SAFE };
}

// Gear is named by id, cards and plus: two swords that differ in either are different items.
export const sameGear = (s, cards, plus, iid) => !!s && s.roll?.iid === iid && sameCards(s.cards, cards) && (s.plus ?? 0) === (plus ?? 0);
export const gearName = (name, plus) => (plus ? `+${plus} ${name}` : name);
