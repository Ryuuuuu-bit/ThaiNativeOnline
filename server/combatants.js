// Server-side damage (phase 3b of docs/technical/SERVER_SPLIT.md). The browser no longer
// says how hard it hit: it says "I cast skill X" and "skill X landed on monster N", and the
// server rolls the blow with the same rules the browser uses (src/training/kitCombat.js,
// src/rules/stats.js) from its own copy of the character, then applies it to the shared
// monsters (server/monsters.js). What it checks:
//   · the skill belongs to the player's class kit (or its basic attack / the hunter's dog);
//   · skill cooldowns (with the character's DEX cut, plus a little slack for lag);
//   · a cast allows only so many blows, for a few seconds (multi-hit skills, the dog);
//   · basic attacks and dog bites come no faster than the character's attack speed allows;
//   · the monster is within the skill's reach of where the server last saw the player.
// Area skills: the browser names only the main target; the server finds who else is in the
// circle / line / fan and hits them too. Skill side effects (stun, slow, damage over time)
// and self buffs (which raise the next rolls) are applied here as well.
//
// Signed-in characters (phase 3c): the server's copy is the real one (server/progress.js) — it
// is loaded from the save, earns the kill rewards, pays MP for casts, and replays the
// player's own actions (`op`); the browser's `ch` sheet is ignored for them. Guests still send
// their sheet with `ch` (sanity-checked here) and keep their progress in their own browser.
// Phase 4: their HP is the server's too — a monster's swing is resolved here (`swing`) — and so
// are their quests (`quests`, the browser's QuestSystem) and shop purchases (a shop of that
// kind on their map, not in a fight).
//
//   const cs = new Combatants({ now })
//   cs.set(playerId, data, cls)                      → true | false (data: Character.toJSON(), a guest's sheet)
//   cs.load(playerId, saved, { account, slot }, questsJson) → true | false (a signed-in character, in full)
//   cs.op(playerId, msg, map) → true | false · cs.reward(playerId, kill) → { level? } · cs.respawn(playerId) → bool
//   cs.swing(playerId, monsterDef, power) → { dodge } | { dmg, hp, mp, dead } | null (guests resolve their own;
//     a landed hit also poisons / drains MP as the monster does: src/combat/monsterHit.js)
//   cs.me(playerId) → the character's JSON (+ ack: actions replayed so far, quests: quest state)
//   cs.cast(playerId, skillId)                      → { ok, buff? } | { ok: false, why }
//   cs.blow(playerId, world, players, msg, phase)   → events (as MonsterWorld.damage)
//   cs.tick(dt, night) · cs.drop(playerId)
//   cs.sit(playerId, on) (resting: double regen out of a fight)
//   cs.touch(playerId) (a blow or a swing: in a fight) · cs.fighting(playerId) → bool
//   cs.casting(playerId, skillId) (a cast bar started; a skill with a cast time is refused before it could fill)
// Skills on an evolution path roll with the path's rules ('<id>@A', src/rules/data/evolutions.js).
import { Character } from '../src/character/Character.js';
import { CLASSES, POINTS_PER_LEVEL } from '../src/character/data/classes.js';
import { ITEMS, EQUIP_SLOTS, slotKind } from '../src/character/data/items.js';
import { SKILLS as LEGACY } from '../src/combat/data/skills.js';
import { RULES } from '../src/combat/data/rules.js';
import { SKILL_BY_ID } from '../src/rules/data/skills.js';
import { rollDamage } from '../src/rules/stats.js';
import { skillHitSchedule } from '../src/rules/skillHits.js';
import { allyHeal, castInfo, hitEffects, inShape, monsterDefense, rollBlow, selfEffects, supportOf, within } from '../src/training/kitCombat.js';
import { fromSave, applyOp, questsFor, nearShop } from './progress.js';
import { applyQuestOp, reconcileQuestMasteries, recordQuestCast, recordQuestSkillHit } from './class-quests.js';
import { nearAnyShop } from '../src/data/shopSites.js';
import { MONSTER_ACCURACY, MAX_LEVEL } from '../src/character/data/progression.js';
import { afterHit, shielded, SHIELD } from '../src/combat/monsterHit.js';
import { STRIP } from '../src/character/data/cards.js';
import { REFINE_SHOP, sameGear } from '../src/character/data/refine.js';
import { MUAYTHAI_SKILLS } from '../src/classes/muaythai-moves.js';
import { WARRIOR_SKILLS } from '../src/classes/warrior-moves.js';
import { HUNTER_SKILLS } from '../src/classes/hunter-moves.js';
import { SHAMAN_SKILLS } from '../src/classes/shaman-moves.js';
import { HERBALIST_SKILLS } from '../src/classes/herbalist-moves.js';

export const KITS = { muaythai: MUAYTHAI_SKILLS, warrior: WARRIOR_SKILLS, hunter: HUNTER_SKILLS, shaman: SHAMAN_SKILLS, herbalist: HERBALIST_SKILLS };
export const SKILL_LV = 1;          // the level of a skill a character has no level for (legacy callers)
// A character's level in a kit skill (job levels: src/character/Character.js); 0 = not learnt.
const lvOf = (c, id) => (c.skillLevel ? c.skillLevel(id) : SKILL_LV);
export const CAST_WINDOW = 6;       // s a cast's blows may keep landing (slow projectiles, the dog's errands)
export const REACH_SLACK = 2.5;     // m added to a reach (the monster and the player both move; ~150 ms of lag at a run)
const CD_SLACK = .85, CD_LAG = .3;  // a cooldown may come back 15% + 0.3 s early (lag, frame timing)
const PET_EVERY = 1.3, PET_FRENZY = .55, POUNCE_EVERY = 2;   // s: the dog's bite, its bite in a frenzy (ไอ้ด่าง ลุย!), and the least between pounces
const MP_SLACK = .25;               // a cast may dip this share of its cost below 0 MP (the browser's regen ticks on its own clock)
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

// A character sheet from the browser, made safe enough to roll with: a known class, a level
// in range, no more stat points than the level gives, real items only.
export function sane(data, cls) {
  if (!data || typeof data !== 'object') return null;
  const level = Math.max(1, Math.min(MAX_LEVEL, Math.floor(Number(data.level) || 1)));
  const alloc = {};
  let spent = 0;
  for (const [k, v] of Object.entries(data.alloc ?? {})) { const n = Math.max(0, Math.floor(Number(v) || 0)); alloc[k] = n; spent += n; }
  const budget = POINTS_PER_LEVEL * (level - 1) + 10;   // a few starting points of slack
  if (spent > budget) return null;
  const equipment = {};
  for (const slot of EQUIP_SLOTS) { const id = data.equipment?.[slot]; equipment[slot] = id && ITEMS[id]?.type === 'equip' && ITEMS[id].slot === slotKind(slot) ? id : null; }
  // job level and skills are checked by Character itself (unlock levels, no more points than the job level gives)
  const jobLevel = Number.isFinite(Number(data.jobLevel)) ? Number(data.jobLevel) : undefined;
  const skills = data.skills && typeof data.skills === 'object' ? data.skills : undefined;
  // cards in the worn gear: only real ones of the item's kind, no more than its slots (Character checks)
  const cards = data.cards && typeof data.cards === 'object' ? data.cards : undefined;
  const evo = data.evo && typeof data.evo === 'object' ? data.evo : undefined;   // paths: Character checks
  const refine = undefined;   // a guest's pluses are not taken at their word (ตีบวก is the server's, for signed-in characters)
  try { return new Character({ name: String(data.name ?? ''), classId: cls ?? data.classId, gender: data.gender, level, alloc, equipment, inventory: [], jobLevel, skills, cards, evo, refine }); } catch { return null; }
}

export class Combatants {
  constructor({ now = () => Date.now() / 1000, random = Math.random } = {}) {
    this.now = now; this.r = random; this.list = new Map();   // player id → state
  }
  get(id) { return this.list.get(id); }
  touch(id) { const s = this.list.get(id); if (s) { s.fightAt = this.now(); s.c.sitting = false; } }
  // sitting to rest (Combat.sit): double regen, never in a fight; any blow or swing stands up
  sit(id, on) { const s = this.list.get(id); if (s) s.c.sitting = !!on && s.c.alive && !this.fighting(id); }
  fighting(id) { const s = this.list.get(id); return !!s && this.now() - s.fightAt < RULES.combatTimeout; }
  drop(id) { this.list.delete(id); }

  set(id, data, cls) {
    const old = this.list.get(id);
    if (old?.persist) return false;                               // a signed-in character is the server's own
    const c = sane(data, cls); if (!c) return false;
    if (old) { c.buffs = old.c.buffs; old.c = c; return true; }   // gear / stats changed: buffs carry over
    this.list.set(id, this.entry(c));
    return true;
  }
  load(id, saved, persist, questsJson = '{}') {
    const c = fromSave(saved); if (!c) return false;
    const state = { ...this.entry(c), persist, ack: 0, dirty: !!c.starterEquipmentMigrated, quests: questsFor(c, questsJson) };
    if (reconcileQuestMasteries(c, state.quests)) state.dirty = true;
    this.list.set(id, state);
    return true;
  }
  entry(c) { const t = this.now(); return { c, cds: new Map(), casts: [], casting: new Map(), basic: { at: t, credit: 2 }, pet: { at: t, credit: 2, pounceAt: -Infinity }, fightAt: -Infinity }; }
  casting(id, skillId) { const s = this.list.get(id); if (s && typeof skillId === 'string' && KITS[s.c.classId]?.some(k => k.id === skillId)) s.casting.set(skillId, this.now()); }
  // walking off interrupts a cast bar (the browser cancels it too)
  interrupt(id) { const s = this.list.get(id); if (s) s.casting.clear(); }
  // ---- signed-in characters ------------------------------------------------------------------
  // `at`: where the player is ({ map, x, z }, server/presence.js)
  op(id, msg, at = {}) {
    const s = this.list.get(id); if (!s?.persist) return false;
    s.ack++;
    // shops: next to an NPC of that shop (src/data/shopSites.js), and not in the middle of a fight
    const atShop = shop => nearShop(shop, at.map, at.x, at.z) && this.now() - s.fightAt >= RULES.combatTimeout;
    if (msg.op === 'buy' && !atShop(msg.shop)) return false;
    // taking cards out: at หมออาคม's; the server rolls the outcome (sent back as `stripped`)
    if (msg.op === 'strip') {
      s.stripped = { ok: false, why: 'no_shop' };
      if (!atShop(STRIP.shop)) return false;
      const i = s.c.inventory.findIndex(x => x?.id === msg.id && sameGear(x, msg.cards, msg.plus));
      s.stripped = i >= 0 ? s.c.stripCards(i, this.r) : { ok: false, why: 'no_cards' };
      if (s.stripped.ok) s.dirty = true;
      return s.stripped.ok;
    }
    // ตีบวก: at หมื่นเพชรศาสตรา's; worn {worn: slot} or bag gear {id, cards, plus}; rolled here (sent back as `refined`)
    if (msg.op === 'refine') {
      s.refined = { ok: false, why: 'no_shop' };
      if (!atShop(REFINE_SHOP)) return false;
      const where = typeof msg.worn === 'string' ? msg.worn : s.c.inventory.findIndex(x => x?.id === msg.id && sameGear(x, msg.cards, msg.plus));
      s.refined = where === -1 ? { ok: false, why: 'no_item' } : s.c.refineGear(where, this.r);
      if (s.refined.ok) s.dirty = true;
      return s.refined.ok;
    }
    // selling is done at a shop counter too; the fallen handle no items and no stats
    if (['sell', 'sell_batch'].includes(msg.op) && !nearAnyShop(at.map, at.x, at.z)) return false;
    if (!s.c.alive && ['sell', 'sell_batch', 'use', 'equip', 'card', 'unequip', 'alloc', 'reset', 'learn', 'skill_reset', 'evo'].includes(msg.op)) return false;
    const questResult = applyQuestOp(s.c, msg, s.quests, at);
    const ok = questResult === null
      ? applyOp(s.c, msg, s.quests, at.map ? at : null, { fighting: this.fighting(id), busy: at.loadoutBusy === true || (msg.op === 'evo' && ((s.variantEffectsUntil ?? 0) > this.now() || s.casting.size > 0 || s.casts.some(cast => this.now() - cast.at < (cast.window ?? CAST_WINDOW) && cast.left > 0) || s.c.buffs.length > 0)) })
      : questResult;
    if (ok) s.dirty = true;
    return ok;
  }
  reward(id, k) {
    const s = this.list.get(id); if (!s?.persist) return {};
    const c = s.c, before = c.level;
    c.gold += Math.max(0, k.gold | 0); c.gainExp(Math.max(0, k.exp | 0));
    const lost = [];   // a full or overweight bag: the drop is lost (told, not silently)
    for (const d of k.drops ?? []) if (!c.addItem(d.id, d.qty)) lost.push(d);
    if (k.type) s.quests.onKill(k.type);
    c.noteKill(k.type);   // the records behind the titles (src/data/titles.js)
    s.dirty = true;
    return { ...(c.level !== before ? { level: c.level } : {}), ...(lost.length ? { lost } : {}) };
  }
  // back up after a death (only when the server saw the death)
  respawn(id) {
    const s = this.list.get(id); if (!s?.persist || s.c.alive) return false;
    s.c.gold -= Math.floor(s.c.gold * RULES.deathGoldLoss); s.c.revive(RULES.reviveRatio); s.dirty = true;
    return true;
  }
  // A monster's swing at a signed-in player, with the browser's formula (Combat.monsterAttack).
  swing(id, def, power = 1, { skill = false } = {}) {
    const s = this.list.get(id); if (!s?.persist || !def) return null;
    const c = s.c; if (!c.alive) return null;
    if (s.god) return { dodge: true, hp: c.hp };   // /gm god (server/gm.js)
    s.fightAt = this.now(); c.sitting = false;
    if (this.r() < c.evadeChance(def.acc ?? MONSTER_ACCURACY(def.level))) return { dodge: true, hp: c.hp };
    const raw = def.atk * power * (.85 + this.r() * .3) * (!skill && def.elite && this.r() < RULES.eliteHeavyChance ? 1.8 : 1);
    const dmg = c.damage(Math.max(1, (raw - c.defense * .4) * (1 - c.resist(def))));   // cards: less from that race / element
    if (c.alive) afterHit(c, def);
    s.dirty = true;
    return { dmg, hp: c.hp, mp: Math.round(c.mp), dead: !c.alive };
  }
  // A world boss skill (server/monsters.js wbhit): a share of the character's max HP, no dodge or
  // defence (it was warned on the floor), so it hurts every level the same.
  pctHit(id, pct) {
    const s = this.list.get(id); if (!s?.persist) return null;
    const c = s.c; if (!c.alive) return null;
    if (s.god) return { dodge: true, hp: c.hp };
    s.fightAt = this.now(); c.sitting = false;
    const dmg = c.damage(Math.max(1, Math.round(c.maxHp * pct)));
    s.dirty = true;
    return { dmg, hp: c.hp, mp: Math.round(c.mp), dead: !c.alive };
  }
  // the signed-in character in play for an account's slot (the save API asks), or null
  live(account, slot) { for (const s of this.list.values()) if (s.persist?.account === account && s.persist.slot === slot) return s; return null; }
  me(id) { const s = this.list.get(id); return s?.persist ? { ...s.c.toJSON(), ack: s.ack, quests: s.quests.state, ...(s.c.loadoutResult ? { loadoutResult: { ...s.c.loadoutResult } } : {}) } : null; }

  // Attacker stats for a roll, buffs included.
  stats(c) { return { ...c.derived, patk: c.patk, matk: c.matk, critRate: c.critChance, critDmg: c.critDamage, accuracy: c.accuracy }; }

  // `ally`: the heal is aimed at one friend (kitCombat.allyHeal): the caster does not get it, and
  // the result says `single` (server/index.js gives it to that friend alone).
  cast(id, skillId, { ally = false } = {}) {
    const s = this.list.get(id); if (!s) return { ok: false, why: 'no_sheet' };
    const c = s.c, now = this.now();
    if (!c.alive) return { ok: false, why: 'dead' };
    const kitSkill = KITS[c.classId]?.find(k => k.id === skillId);
    const legacy = !kitSkill && c.cls.skills.includes(skillId) && !LEGACY[skillId]?.basic ? LEGACY[skillId] : null;
    if (!kitSkill && !legacy) return { ok: false, why: 'not_yours' };
    // a kit skill must be learnt (job levels and skill points)
    if (kitSkill && lvOf(c, skillId) < 1) return { ok: false, why: 'not_learnt' };
    const slv = kitSkill ? lvOf(c, skillId) : 1;
    const eff = kitSkill ? c.skillVariant?.(skillId) ?? skillId : skillId;   // its evolution path, if any
    const info = kitSkill ? castInfo({ ...kitSkill, id: eff }, slv) : null;
    const cd = kitSkill ? info.cd * (1 - (c.cooldownCut || 0)) : (legacy.cd ?? 0);
    if (now < (s.cds.get(skillId) ?? -Infinity)) return { ok: false, why: 'cooldown' };
    // a cast time: the bar must have had (most of) its time since the browser said it started
    if (info?.cast) {
      const need = info.cast * (1 - (c.castSpeed || 0)), at = s.casting.get(skillId);
      if (need > .25) {
        if (at !== undefined && now - at > need * 3 + 3) { s.casting.delete(skillId); return { ok: false, why: 'casting' }; }   // a start from long ago is no cast
        if (at === undefined || now - at < need * .7 - .25) return { ok: false, why: 'casting' };
      }
      s.casting.delete(skillId);
    }
    // a signed-in character pays MP here (a little slack: the browser's regen ticks on its own clock)
    const mp = kitSkill ? Math.round(info.mp * (c.mpCostMul ?? 1)) : legacy.mp ?? 0;
    if (s.persist && mp) { if (c.mp + Math.max(2, mp * MP_SLACK) < mp) return { ok: false, why: 'mp' }; c.mp = Math.max(0, c.mp - mp); }
    s.cds.set(skillId, now + Math.max(0, cd * CD_SLACK - CD_LAG));
    // The client timeline and authoritative hit budget share the same rules.
    // Support-only casts open no offensive budget; splash is selected here.
    const schedule = kitSkill ? skillHitSchedule(kitSkill, eff) : [0];
    const hits = schedule.length, window = Math.max(CAST_WINDOW, (schedule.at(-1) ?? 0) + .75);
    const perTarget = kitSkill ? hits : 2, blows = kitSkill ? hits : legacy.kind === 'aoe' ? 3 : 2;
    s.casts = s.casts.filter(k => now - k.at < (k.window ?? CAST_WINDOW));
    s.casts.push({ skill: skillId, eff, at: now, window, left: blows, perTarget, struck: new Map(), kit: !!kitSkill, hit: new Set(), splashed: new Set() });
    if (legacy?.kind === 'pet' && legacy.frenzy) s.pet.frenzyUntil = now + legacy.frenzy;   // ไอ้ด่าง ลุย!: the dog bites faster for a while
    // the caster's side happens here: buffs raise the next rolls; a signed-in caster's own heal
    // and MP land on the server's copy (the browser shows the same)
    const single = !!kitSkill && ally && allyHeal(eff);
    if (kitSkill) {
      const e = selfEffects(eff, slv, c.defense, c.matk, c.healPow ?? 1);
      if (e?.buff) c.addBuff(e.buff);
      if (s.persist && !single && (e?.heal || e?.hp)) c.heal(c.maxHp * e.heal + e.hp);
      if (s.persist && e?.mp) c.mp = Math.min(c.maxMp, c.mp + c.maxMp * e.mp);
      if (e?.heal || e?.hp || e?.mp) s.dirty = true;
    } else if (legacy.kind === 'buff' && legacy.buff) c.addBuff(legacy.buff);
    // a party / revive / healing skill: what the members near the caster get (server/index.js hands it out)
    const support = kitSkill ? supportOf(eff, slv, c.defense, c.matk, c.healPow ?? 1) : null;
    recordQuestCast(this, id, skillId, now);
    return support ? { ok: true, support, ...(single ? { single: true } : {}) } : { ok: true };
  }
  // A healer's support landing on another player: heal, MP and buff; a revive brings a fallen one
  // back where they lie. → what happened ({ heal, revived }) or null.
  aid(id, sup) {
    const s = this.list.get(id); if (!s) return null;
    const c = s.c;
    if (!c.alive) { if (!sup.revive) return null; c.revive(sup.revive); s.dirty = true; return { revived: true }; }
    const before = c.hp;
    if (sup.heal || sup.hp) c.heal(c.maxHp * (sup.heal || 0) + (sup.hp || 0));
    if (sup.mp) c.mp = Math.min(c.maxMp, c.mp + c.maxMp * sup.mp);
    if (sup.buff) c.addBuff(sup.buff);
    s.dirty = true;
    return { heal: Math.round(c.hp - before) };
  }

  // One blow: msg { id (monster), skill: kit id | legacy id | 'basic' | 'pet', pounce? }.
  blow(id, world, players, msg = {}, phase = 'day') {
    const s = this.list.get(id), p = players.find(x => x.id === id), m = world.byId(msg.id);
    if (!s || !p || p.dead || !m || m.hp <= 0) return [];
    const c = s.c, now = this.now(), night = phase === 'night';
    const def = monsterDefense(m.def);
    s.fightAt = now; c.sitting = false;
    if (msg.skill === 'basic' || msg.skill === 'pet') {
      const pet = msg.skill === 'pet';
      if (pet && !c.cls.pet) return [];
      const basicId = c.cls.skills.find(k => LEGACY[k]?.basic), skill = LEGACY[basicId];
      const reach = pet ? 12 : c.cls.range + REACH_SLACK;
      if (dist(m, p) > reach) return [];
      const every = pet ? (now < (s.pet.frenzyUntil ?? -Infinity) ? PET_FRENZY : PET_EVERY) * (1 - c.attackSpeed) : c.cls.attackSpeed * (1 - c.attackSpeed);
      if (!this.spend(pet ? s.pet : s.basic, now, every)) return [];
      let power = pet ? RULES.petBite * (c.petBiteMul ?? 1) : skill.power;   // สายใยคู่หู: the dog bites harder
      // a pounce (สัญชาตญาณหมาล่า) is rolled here, not taken from the browser
      if (pet && msg.pounce && now - s.pet.pounceAt >= POUNCE_EVERY && this.r() < RULES.petInstinct + (c.stat?.('luk') || 0) * .002) { s.pet.pounceAt = now; power *= 1.5; }
      const atk = { patk: c.patk, matk: c.matk, accuracy: c.accuracy, critRate: skill.alwaysCrit && !pet ? 1 : c.critChance, critDmg: c.critDamage };
      const r = rollDamage(atk, def, !pet && skill.scale === 'int' ? 'magic' : 'physical', power, this.r);
      const ev = this.land(world, players, m, id, r, night, { pet });
      if (r.hit && !pet && skill.debuff && m.hp > 0) ev.push(world.debuff(m, { id: skill.debuff.id ?? 'basic', ...skill.debuff, remaining: skill.debuff.duration, source: c.attack, by: id }));
      return ev;
    }
    // a skill: it needs a live cast with blows left
    const cast = [...s.casts].reverse().find(k => k.skill === msg.skill && now - k.at < (k.window ?? CAST_WINDOW) && k.left > 0);
    if (!cast) return [];
    const kitSkill = cast.kit ? KITS[c.classId].find(k => k.id === cast.skill) : null, legacy = cast.kit ? null : LEGACY[cast.skill];
    const slv = kitSkill ? Math.max(1, lvOf(c, cast.skill)) : 1;
    const info = kitSkill ? castInfo({ ...kitSkill, id: cast.eff ?? cast.skill }, slv) : null;
    const reach = (info ? info.range + (info.splash?.length ?? info.splash?.radius ?? 0) : 10) + REACH_SLACK;
    if (dist(m, p) > reach) return [];
    cast.left--;
    const stats = this.stats(c);
    const roll = o => (kitSkill ? rollBlow(stats, monsterDefense(o.def), cast.eff ?? cast.skill, slv, this.r)
      : rollDamage({ ...stats, critRate: legacy.alwaysCrit ? 1 : stats.critRate }, monsterDefense(o.def), legacy.scale === 'int' ? 'magic' : 'physical', legacy.power ?? 1, this.r));
    const primary = roll(m);
    const ev = this.strike(world, players, m, id, primary, cast, night);
    if (!primary.hit) return ev;
    // area skills: the server picks who else is caught
    const sp = info?.splash;
    if (sp && m) {
      const live = world.monsters.filter(o => o.hp > 0);
      if (sp.line || sp.cone) {
        for (const o of inShape(live, p, m, sp, m)) if (!cast.splashed.has(o.id)) { cast.splashed.add(o.id); ev.push(...this.strike(world, players, o, id, roll(o), cast, night)); }
      } else if (sp.chain) {
        // a chain: the blow jumps on to the nearest few around the target, each once per cast
        for (const o of within(live, m, sp.radius, m).filter(o => !cast.splashed.has(o.id)).slice(0, sp.chain)) { cast.splashed.add(o.id); ev.push(...this.strike(world, players, o, id, roll(o), cast, night)); }
      } else {
        for (const o of within(live, sp.around === 'self' ? p : m, sp.radius, m)) ev.push(...this.strike(world, players, o, id, roll(o), cast, night));
      }
    } else if (legacy?.kind === 'aoe') {
      const live = world.monsters.filter(o => o.hp > 0);
      for (const o of within(live, legacy.around === 'self' ? p : m, legacy.radius ?? 3, m)) ev.push(...this.strike(world, players, o, id, roll(o), cast, night));
    }
    return ev;
  }

  // a landed (or missed) skill blow, then the skill's effects on that monster once per cast
  strike(world, players, m, id, r, cast, night) {
    const n = cast.struck.get(m.id) ?? 0;
    if (n >= cast.perTarget) return [];   // this cast has struck that monster as often as the skill allows
    cast.struck.set(m.id, n + 1);
    if (r.hit && r.dmg > 0 && m.hp > 0) recordQuestSkillHit(this, id, cast, m, r, cast.window ?? CAST_WINDOW);
    const ev = this.land(world, players, m, id, r, night);
    if (r.hit && m.hp > 0 && !cast.hit.has(m.id)) {
      cast.hit.add(m.id);
      for (const d of cast.kit ? hitEffects(cast.eff ?? cast.skill, r.dmg) : LEGACY[cast.skill]?.debuff ? [{ ...LEGACY[cast.skill].debuff, source: r.dmg }] : []) {
        const owner = this.list.get(id);
        if (owner) owner.variantEffectsUntil = Math.max(owner.variantEffectsUntil ?? 0, this.now() + d.duration);
        ev.push(world.debuff(m, { id: d.id, stun: !!d.stun, slow: d.slow || 0, dot: d.dot || 0, label: d.label, source: d.source || r.dmg, by: id, remaining: d.duration }));
      }
    }
    return ev;
  }
  land(world, players, m, id, r, night, { pet = false } = {}) {
    if (!r.hit) { world.aggro(m, id); return [{ t: 'mh', id: m.id, miss: true, by: id }]; }
    const p = players.find(x => x.id === id), c = this.list.get(id)?.c;
    let dmg = r.dmg * (1 + (c?.vsRace(m.def) ?? 0));   // cards: more against that race
    if (m.def.shield && p && shielded(m, p)) dmg *= 1 - SHIELD;
    dmg = Math.max(1, Math.round(dmg));
    return world.damage(m, id, dmg, { crit: !!r.crit, pet }, players, night);
  }
  // PvP uses the same class stats and basic-attack rate bucket as PvE.
  // Clients supply a target only, never damage or attacker stats.
  pvpBasic(attacker, target, { knockout = false } = {}) {
    const a = this.list.get(attacker), b = this.list.get(target);
    if (!a?.persist || !b?.persist || !a.c.alive || !b.c.alive) return null;
    const c = a.c, t = b.c, basic = LEGACY[c.cls.skills.find(k => LEGACY[k]?.basic)];
    if (!basic || !this.spend(a.basic, this.now(), c.cls.attackSpeed * (1 - c.attackSpeed))) return null;
    this.touch(attacker); this.touch(target); c.sitting = false; t.sitting = false;
    const roll = rollDamage(this.stats(c), { def: t.defense, eva: t.evasion }, basic.scale === 'int' ? 'magic' : 'physical', basic.power, this.r);
    if (!roll.hit) return { miss: true, hp: t.hp, maxHp: t.maxHp };
    const amount = Math.min(t.hp - (knockout ? 1 : 0), Math.max(1, Math.round(roll.dmg * .5)));
    const won = knockout && t.hp - amount <= 1;
    t.hp = Math.max(knockout ? 1 : 0, t.hp - amount);
    if (!t.hp) t.fall();
    a.dirty = true; b.dirty = true;
    return { amount, crit: !!roll.crit, hp: t.hp, maxHp: t.maxHp, dead: !t.alive, won };
  }

  // a rate bucket: one blow per `every` seconds, up to 2 saved up (network bunching)
  spend(b, now, every) {
    b.credit = Math.min(2, b.credit + (now - b.at) / Math.max(.15, every * .9)); b.at = now;
    if (b.credit < 1) return false;
    b.credit -= 1; return true;
  }
  // buffs run out; night crit for night classes
  // (a signed-in character also regenerates MP, faster out of a fight)
  tick(dt, night) {
    const now = this.now();
    for (const s of this.list.values()) {
      s.c.night = night;
      if (s.persist) { const hp=s.c.hp,mp=s.c.mp; s.c.tick(dt, now - s.fightAt < RULES.combatTimeout); if(s.c.hp!==hp||s.c.mp!==mp)s.dirty=true; }
      else if (s.c.buffs.length) s.c.buffs = s.c.buffs.filter(b => (b.remaining -= dt) > 0);
    }
  }
}
