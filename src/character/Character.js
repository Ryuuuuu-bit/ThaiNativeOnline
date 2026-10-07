// Character model: stats, level/EXP, HP/MP, inventory, equipment, buffs, save/load.
// Pure logic so it can be reused by any world or a future server.
import { CLASSES, CLASS_ALIASES, STATS, START_ITEMS, POINTS_PER_LEVEL } from './data/classes.js';
import { ITEMS, EQUIP_SLOTS, slotKind } from './data/items.js';
import { MAX_LEVEL, expToNext, CARRY, RECOVERY, MONSTER_ACCURACY, MAX_JOB_LEVEL, JOB_EXP_RATE, jobExpToNext, MAX_SKILL_LEVEL, SKILL_UNLOCK_JOB, SKILL_RESET_GOLD } from './data/progression.js';
import { KIT_SKILL_IDS } from './data/kits.js';
import { RESIST_CAP, socketCards, STRIP } from './data/cards.js';
import { refinable, refineBonus, refineCost, plusOf } from './data/refine.js';
import { EVOLUTIONS, EVO_LEVEL, EVO_SWITCH_GOLD, evoId } from '../rules/data/evolutions.js';
// Skill timing from gear and DEX: cooldown cut (DEX + `cdr`, ≤ CDR_MAX) and cast speed
// (DEX + `cast`, ≤ CAST_MAX); `mpCost` makes skills dearer (src/character/data/items.js).
export const CDR_MAX = .3, CAST_MAX = .5, CAST_PER_DEX = .003;
import { computeDerived, hitChanceOf, ASPD_BUFF_MAX } from '../rules/stats.js';
import { JOBS } from '../rules/data/classes.js';
import { Emitter } from './Emitter.js';
import { slotStorage } from '../core/SaveSlot.js'; // per-character save slot (src/account)
import { TITLE_BY_ID, BOSS_TITLES, checkTitles } from '../data/titles.js';

const SAVE_KEY = 'tno.character.v1';
const INVENTORY_SIZE = 24;
export const FRIENDS_MAX = 50;
// Gear bonus keys passed to computeDerived besides the base stats.
const DERIVED_BONUS = ['atk', 'matk', 'def', 'hp', 'mp', 'crit', 'critDmg', 'acc', 'eva'];
const emptyAlloc = () => Object.fromEntries(STATS.map(k => [k, 0]));
// the records titles are earned from (src/data/titles.js): whole counts only
const REC_KEYS = ['kills', 'healOut', 'revive', 'deaths', 'cpRank', 'lvRank', 'enhRank'];
const count = v => (Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
const cleanRec = r => ({ ...Object.fromEntries(REC_KEYS.map(k => [k, count(r?.[k])])), boss: Object.fromEntries(Object.keys(BOSS_TITLES).map(t => [t, count(r?.boss?.[t])]).filter(([, n]) => n)) });

export class Character extends Emitter {
  constructor({ name, classId, gender = 'male', level = 1, exp = 0, gold = 20, points = 0, alloc, inventory, equipment, hp, mp, jobLevel, jobExp = 0, skills, cards, evo, refine, friends, title, titles, rec } = {}) {
    super();
    classId = CLASS_ALIASES[classId] || classId;
    if (!CLASSES[classId]) throw new Error(`Unknown class ${classId}`);
    this.name = name; this.classId = classId; this.gender = gender; this.night = false; this.level = level; this.exp = exp; this.gold = gold;
    this.points = points; // unspent stat points
    // Job level and learnt skills ({ kit skill id: level }). Saves from before job levels get a
    // job level that matches their base level and only the first skill (the points are theirs to spend).
    this.jobLevel = Math.max(1, Math.min(MAX_JOB_LEVEL, Math.floor(jobLevel ?? Math.min(MAX_JOB_LEVEL, Math.floor((level - 1) * .85) + 1))));
    this.jobExp = Math.max(0, jobExp || 0);
    this.skills = {};
    const ids = KIT_SKILL_IDS[classId] ?? [];
    for (const [id, lv] of Object.entries(skills ?? {})) { const i = ids.indexOf(id); if (i >= 0 && lv > 0 && SKILL_UNLOCK_JOB[i] <= this.jobLevel) this.skills[id] = Math.min(MAX_SKILL_LEVEL, Math.floor(lv)); }
    if (ids[0] && !this.skills[ids[0]]) this.skills[ids[0]] = 1;
    while (this.skillPoints < 0) { const top = Object.keys(this.skills).filter(id => id !== ids[0] || this.skills[id] > 1).pop(); if (!top) break; if (--this.skills[top] <= 0) delete this.skills[top]; }
    // skill evolution paths chosen ({ kit skill id: 'A' | 'B' }, src/rules/data/evolutions.js)
    this.evo = {};
    for (const [id, pick] of Object.entries(evo ?? {})) if (EVOLUTIONS[id]?.[pick] && ids.includes(id)) this.evo[id] = pick;
    this.alloc = { ...emptyAlloc(), ...alloc };
    // friends: other characters' names (server/index.js keeps the list; online / offline notices)
    this.friends = Array.isArray(friends) ? [...new Set(friends.filter(n => typeof n === 'string' && n.trim()).map(n => n.slice(0, 16)))].slice(0, FRIENDS_MAX) : [];
    // gear in the bag may carry cards (src/character/data/cards.js): only real ones, no more than its slots
    // and a plus from ตีบวก (src/character/data/refine.js): only on gear that takes one
    this.inventory = inventory ? inventory.map(s => {
      if (!s) return null;
      const { cards: held, plus, ...rest } = s, ok = socketCards(s.id, held, ITEMS), p = refinable(ITEMS[s.id]) ? plusOf(plus) : 0;
      return { ...rest, ...(ok.length ? { cards: ok } : {}), ...(p ? { plus: p } : {}) };
    }) : Array(INVENTORY_SIZE).fill(null);
    this.equipment = Object.fromEntries(EQUIP_SLOTS.map(s => [s, null]));
    for (const s of EQUIP_SLOTS) { const id = equipment?.[s]; if (id && ITEMS[id]?.type === 'equip' && ITEMS[id].slot === slotKind(s)) this.equipment[s] = id; }
    // the cards in the worn gear, per slot (they belong to that item and leave with it)
    this.cards = Object.fromEntries(EQUIP_SLOTS.map(s => [s, []]));
    for (const slot of Object.keys(this.cards)) if (this.equipment[slot]) this.cards[slot] = socketCards(this.equipment[slot], cards?.[slot], ITEMS);
    // the plus of the worn gear, per slot
    this.refine = Object.fromEntries(EQUIP_SLOTS.map(s => [s, this.equipment[s] && refinable(ITEMS[this.equipment[s]]) ? plusOf(refine?.[s]) : 0]));
    // a two-handed weapon leaves the off hand empty: an older save's shield goes back to the bag
    if (this.twoHanded && this.equipment.offhand) {
      const free = this.inventory.indexOf(null);
      if (free >= 0) this.inventory[free] = this.wornItem('offhand');
      this.equipment.offhand = null; this.cards.offhand = []; this.refine.offhand = 0;
    }
    this.buffs = []; // {id, def?, slow?, dot?, remaining}
    this.cooldowns = {};
    // ฉายา (src/data/titles.js): the ids earned, the one worn (null = none) and the records behind them
    this.rec = cleanRec(rec);
    this.titles = Array.isArray(titles) ? [...new Set(titles.filter(id => TITLE_BY_ID[id]))] : [];
    checkTitles(this);
    this.title = this.titles.includes(title) ? title : null;
    this.hp = Math.min(hp ?? this.maxHp, this.maxHp); this.mp = Math.min(mp ?? this.maxMp, this.maxMp);   // saves from older stat formulas may exceed the cap
  }

  static create(name, classId, gender = 'male') {
    const c = new Character({ name, classId, gender });
    for (const id of START_ITEMS[classId] || []) { c.addItem(id); c.equip(c.inventory.findIndex(s => s?.id === id)); }
    c.addItem('potion_s', 5); c.addItem('ether', 2);
    c.hp = c.maxHp; c.mp = c.maxMp;
    return c;
  }

  get cls() { return CLASSES[this.classId]; }

  equipBonus(key) {
    let total = 0;
    for (const [slot, id] of Object.entries(this.equipment)) {
      if (!id) continue;
      total += ITEMS[id].bonus?.[key] || 0;
      if (this.refine?.[slot]) total += refineBonus(ITEMS[id], this.refine[slot])?.[key] || 0;
      for (const card of this.cards?.[slot] ?? []) total += ITEMS[card].bonus?.[key] || 0;
    }
    return total;
  }
  // Cards: more damage against a monster's race; less damage taken from its race and element.
  vsRace(def) { return def?.race ? this.equipBonus(`vs_${def.race}`) : 0; }
  resist(def) { return Math.min(RESIST_CAP, (def?.race ? this.equipBonus(`res_${def.race}`) : 0) + (def?.element ? this.equipBonus(`res_${def.element}`) : 0)); }

  // Base stat: class base + growth per level (rounded down) + allocated points + gear.
  stat(key) { return Math.floor((this.cls.base[key] || 0) + (this.cls.growth[key] || 0) * (this.level - 1)) + (this.alloc[key] || 0) + this.equipBonus(key); }
  get stats() { return Object.fromEntries(STATS.map(k => [k, this.stat(k)])); }
  // Shown RO style (CharacterUI): the base, 1 + the points put in, and the bonus on top of it —
  // the class and its growth per level (like RO's job bonus) and the gear.
  baseStat(key) { return 1 + (this.alloc[key] || 0); }
  statParts(key) {
    const cls = Math.floor((this.cls.base[key] || 0) + (this.cls.growth[key] || 0) * (this.level - 1)) - 1, gear = this.equipBonus(key);
    return { base: this.baseStat(key), cls, gear, bonus: cls + gear };
  }

  // Derived stats from the rules (src/rules/stats.js computeDerived), before buffs:
  // { maxHp, maxMp, patk, matk, accuracy, critRate, critDmg, def, eva, aspd, castRed }
  get derived() {
    const s = this.stats, bonus = {};
    for (const key of DERIVED_BONUS) bonus[key] = this.equipBonus(key);
    const base = Object.fromEntries(STATS.map(k => [k.toUpperCase(), s[k]]));
    return computeDerived(base, JOBS[this.cls.job] ?? JOBS.boxer, this.level, bonus, { ranged: this.cls.ranged });
  }
  buffSum(key) { return this.buffs.reduce((n, b) => n + (b[key] || 0), 0); }

  get maxHp() { return this.derived.maxHp; }
  get maxMp() { return this.derived.maxMp; }
  // Attack power after buffs: MATK for spell classes, ATK for the rest.
  get attack() { const d = this.derived; return Math.round((this.cls.magic ? d.matk : d.patk) * (1 + this.buffSum('atk'))); }
  get patk() { return Math.round(this.derived.patk * (1 + this.buffSum('atk'))); }
  get matk() { return Math.round(this.derived.matk * (1 + this.buffSum('atk'))); }
  get defense() { return Math.round(this.derived.def * (1 + (this.buffs.find(b => b.def)?.def || 0))); }
  get accuracy() { return this.derived.accuracy; }
  get evasion() { return this.derived.eva; }
  get critChance() { return Math.min(.75, this.derived.critRate + this.buffSum('crit') + (this.night ? this.cls.nightCrit || 0 : 0)); }
  get critDamage() { return this.derived.critDmg; }
  // ค่าพลังรวม (CP): one number for the ranking boards and titles, without buffs (ThaiNative's
  // combatPower, src/rules/character.js, on this game's derived stats)
  get power() {
    const d = this.derived, off = Math.max(d.patk, d.matk) * (1 + d.critRate * Math.max(0, d.critDmg - 1)) * (1 + (d.aspd || 0) * .5 + (d.castRed || 0) * .5);
    return Math.max(0, Math.round(off * 3 + d.maxHp * .4 + d.maxMp * .15 + d.def * 6 + d.eva * 4 + Math.max(0, d.accuracy - 85) * 2));
  }
  // the highest plus on the worn gear (the ตีบวก board)
  get refineMax() { return Math.max(0, ...Object.values(this.refine ?? {})); }

  // ---- Records and titles (src/data/titles.js) ----
  noteKill(type) { this.rec.kills++; if (BOSS_TITLES[type]) this.rec.boss[type] = (this.rec.boss[type] || 0) + 1; }
  note(key, n = 1) { if (REC_KEYS.includes(key)) this.rec[key] += count(n); }
  // newly earned titles → their ids (emits 'titles' when the list or the worn one changed)
  checkTitles() { const before = this.titles.length, worn = this.title, got = checkTitles(this); if (got.length || before !== this.titles.length || worn !== this.title) this.emit('titles', got); return got; }
  setTitle(id) { if (id !== null && !this.titles.includes(id)) return false; this.title = id; this.emit('titles', []); return true; }
  // share cut from the basic-attack interval: AGI/DEX (≤30%) plus buffs, all together ≤45%
  get attackSpeed() { return Math.min(ASPD_BUFF_MAX, this.derived.aspd + this.buffSum('aspd')); }
  get cooldownCut() { return Math.min(CDR_MAX, this.derived.castRed + this.equipBonus('cdr')); }   // share cut from skill cooldowns
  get castSpeed() { return Math.min(CAST_MAX, this.stat('dex') * CAST_PER_DEX + this.equipBonus('cast')); }   // share cut from cast times
  get mpCostMul() { return 1 + this.equipBonus('mpCost'); }
  // Chance to avoid a blow from an attacker with this accuracy (buffs such as smoke add on top).
  evadeChance(accuracy) { return Math.min(.9, 1 - hitChanceOf(accuracy, this.evasion) + this.buffSum('dodge')); }
  // Kept for callers without an attacker: evasion against an even-level monster.
  get dodge() { return this.evadeChance(MONSTER_ACCURACY(this.level)); }
  // Bag weight: bag stacks plus equipped items, against a STR-based limit.
  get weight() {
    let w = 0;
    for (const s of this.inventory) if (s) w += (ITEMS[s.id].weight || 0) * s.qty;
    for (const id of Object.values(this.equipment)) if (id) w += ITEMS[id].weight || 0;
    return Math.round(w * 10) / 10;
  }
  get maxWeight() { return Math.round(CARRY.base + this.stat('str') * CARRY.perStr); }
  get heavy() { return this.weight >= this.maxWeight * CARRY.heavy; }
  // How many of an item still fit under the weight limit.
  carryRoom(id) {
    const w = ITEMS[id]?.weight || 0;
    return w ? Math.max(0, Math.floor((this.maxWeight * 10 - Math.round(this.weight * 10)) / Math.round(w * 10))) : Infinity;
  }
  get expNeeded() { return expToNext(this.level); }
  get alive() { return this.hp > 0; }

  // ---- HP/MP ----
  damage(amount) {
    if (!this.alive) return 0;
    const dealt = Math.min(this.hp, Math.max(0, Math.round(amount)));
    this.hp -= dealt; if (this.hp <= 0 || (dealt && this.hp < 1)) this.fall();   // a blow that leaves a fraction (poison ticks) is a kill
    this.emit('change'); if (dealt) this.emit('damaged', dealt);
    if (this.hp <= 0) this.emit('death');
    return dealt;
  }
  // Down: every buff and every effect on the player ends (as in RO); revive() starts clean too.
  fall() { this.hp = 0; this.buffs = []; this.sitting = false; }
  heal(amount) {
    if (!this.alive) return 0;
    const before = this.hp; this.hp = Math.min(this.maxHp, this.hp + Math.round(amount)); this.emit('change');
    return Math.round(this.hp - before);   // HP may carry a fraction from regen: the number shown is whole
  }
  restoreMp(amount) { this.mp = Math.min(this.maxMp, this.mp + Math.round(amount)); this.emit('change'); }
  spendMp(amount) { if (this.mp < amount) return false; this.mp -= amount; this.emit('change'); return true; }
  revive(ratio = .5) { this.hp = Math.max(1, Math.round(this.maxHp * ratio)); this.mp = Math.round(this.maxMp * ratio); this.buffs = []; this.emit('change'); }

  // Slow natural regeneration, faster out of combat, faster again sitting (`sitting`, not saved).
  tick(dt, inCombat) {
    for (const key of Object.keys(this.cooldowns)) if ((this.cooldowns[key] -= dt) <= 0) delete this.cooldowns[key];
    const before = this.buffs.length;
    this.buffs = this.buffs.filter(b => (b.remaining -= dt) > 0);
    if (before !== this.buffs.length) this.emit('change');
    if (!this.alive) return;
    const hot = this.buffs.reduce((n, b) => n + (b.hot || 0), 0);
    if (hot && this.hp < this.maxHp) { this.hp = Math.min(this.maxHp, this.hp + this.maxHp * hot * dt); this.emit('change'); }
    // a monster's poison (src/combat/monsterHit.js): HP a second, never the last one
    const poison = this.buffSum('poison');
    if (poison && this.hp > 1) { this.hp = Math.max(1, this.hp - poison * dt); this.emit('change'); }
    // sitting (Combat.sit) doubles it out of a fight, as in RO
    const factor = inCombat ? RECOVERY.combat : this.sitting ? RECOVERY.sitting : 1;
    this.regen = (this.regen || 0) + dt;
    if (this.regen >= 1) {
      const seconds = Math.floor(this.regen); this.regen -= seconds;
      if (this.heavy) return; // No accumulated recovery when weight is removed.
      if (this.hp < this.maxHp || this.mp < this.maxMp) {
        const vit = Math.max(0, this.stat('vit'));
        const hp = Math.min(RECOVERY.hpCap, Math.min(RECOVERY.hpCap, RECOVERY.hpBase + vit * RECOVERY.hpPerVit) * factor);
        const mp = Math.min(RECOVERY.mpCap, Math.min(RECOVERY.mpCap, RECOVERY.mpBase + vit * RECOVERY.mpPerVit) * factor);
        this.hp = Math.min(this.maxHp, this.hp + hp * seconds);
        this.mp = Math.min(this.maxMp, this.mp + mp * seconds);
        this.emit('change');
      }
    }
  }
  addBuff(buff) { this.buffs = this.buffs.filter(b => b.id !== buff.id); this.buffs.push({ ...buff, remaining: buff.duration }); this.emit('change'); }

  // ---- Job level and skills ----
  get jobExpNeeded() { return jobExpToNext(this.jobLevel); }
  get kitSkills() { return KIT_SKILL_IDS[this.classId] ?? []; }
  // Points spent: every learnt level beyond the free first skill's first level.
  get skillPointsSpent() { return Object.entries(this.skills).reduce((n, [id, lv]) => n + lv - (id === this.kitSkills[0] ? 1 : 0), 0); }
  get skillPoints() { return this.jobLevel - 1 - this.skillPointsSpent; }
  skillLevel(id) { return this.skills[id] ?? 0; }
  skillUnlockJob(id) { const i = this.kitSkills.indexOf(id); return i < 0 ? Infinity : SKILL_UNLOCK_JOB[i]; }
  // Why a skill cannot go up one level now (null: it can).
  skillBlock(id) {
    if (!this.kitSkills.includes(id)) return 'ไม่ใช่สกิลของอาชีพนี้';
    if (this.skillLevel(id) >= MAX_SKILL_LEVEL) return 'เลเวลสูงสุดแล้ว';
    if (this.jobLevel < this.skillUnlockJob(id)) return `ต้องถึง Job Lv.${this.skillUnlockJob(id)}`;
    if (this.skillPoints <= 0) return 'แต้มสกิลไม่พอ';
    return null;
  }
  learnSkill(id) {
    if (this.skillBlock(id)) return false;
    this.skills[id] = this.skillLevel(id) + 1; this.emit('skills'); this.emit('change');
    return true;
  }
  get skillResetCost() { return this.jobLevel * SKILL_RESET_GOLD; }
  resetSkills() {
    if (this.skillPointsSpent <= 0 || this.gold < this.skillResetCost) return false;
    this.gold -= this.skillResetCost;
    this.skills = this.kitSkills[0] ? { [this.kitSkills[0]]: 1 } : {};
    this.emit('skills'); this.emit('change');
    return true;
  }  // The rules id a kit skill casts with: its evolution path once the skill is at EVO_LEVEL.
  skillVariant(id) { const pick = this.evo?.[id]; return pick && this.skillLevel(id) >= EVO_LEVEL ? evoId(id, pick) : id; }
  evoCost(id, pick) { return this.evo[id] && this.evo[id] !== pick ? EVO_SWITCH_GOLD : 0; }
  // Take path A or B of a skill at EVO_LEVEL: free the first time, EVO_SWITCH_GOLD to switch.
  chooseEvo(id, pick) {
    if (!EVOLUTIONS[id]?.[pick] || this.skillLevel(id) < EVO_LEVEL || this.evo[id] === pick) return false;
    const cost = this.evoCost(id, pick); if (this.gold < cost) return false;
    this.gold -= cost; this.evo[id] = pick;
    this.emit('skills'); this.emit('change');
    return true;
  }

  gainJobExp(amount) {
    if (this.jobLevel >= MAX_JOB_LEVEL) return;
    this.jobExp += Math.round(amount);
    while (this.jobLevel < MAX_JOB_LEVEL && this.jobExp >= this.jobExpNeeded) {
      this.jobExp -= this.jobExpNeeded; this.jobLevel += 1;
      this.emit('joblevelup', this.jobLevel);
    }
    if (this.jobLevel >= MAX_JOB_LEVEL) this.jobExp = 0;
  }

  // ---- EXP / level ----
  // Every EXP gain also feeds the job level (JOB_EXP_RATE of it), on the server and here alike.
  gainExp(amount) {
    this.gainJobExp(amount * JOB_EXP_RATE);
    if (this.level >= MAX_LEVEL) { this.emit('change'); return; }
    this.exp += Math.round(amount); this.emit('exp', amount);
    while (this.level < MAX_LEVEL && this.exp >= this.expNeeded) {
      this.exp -= this.expNeeded; this.level += 1; this.points += POINTS_PER_LEVEL;
      this.hp = this.maxHp; this.mp = this.maxMp;
      this.emit('levelup', this.level);
    }
    if (this.level >= MAX_LEVEL) this.exp = 0;
    this.emit('change');
  }
  // A change of max HP / MP (stats, gear, cards, pluses) keeps the HP as it is, clamped: no free
  // heal from re-allocating or re-equipping, and the fallen stay fallen.
  clampVitals() { this.hp = Math.min(this.hp, this.maxHp); this.mp = Math.min(this.mp, this.maxMp); }
  allocate(key) {
    if (this.points <= 0 || !STATS.includes(key)) return false;
    this.points -= 1; this.alloc[key] += 1;
    this.clampVitals(); this.emit('change');
    return true;
  }
  resetStats() {
    this.points += Object.values(this.alloc).reduce((a, b) => a + b, 0);
    this.alloc = emptyAlloc();
    this.clampVitals(); this.emit('change');
  }

  // ---- Inventory ----
  // Would `qty` of `id` fit (weight, and a stack or free slots)? Checked before anything is paid.
  canTake(id, qty = 1) {
    const def = ITEMS[id]; if (!def || this.carryRoom(id) < qty) return false;
    if (def.type !== 'equip') return this.inventory.some(s => s?.id === id) || this.inventory.includes(null);
    return this.inventory.filter(s => !s).length >= qty;
  }
  // Adds as many as fit; false (with 'overweight') when any are left behind.
  addItem(id, qty = 1) {
    const def = ITEMS[id]; if (!def) return false;
    const room = this.carryRoom(id);
    if (room < qty) {
      this.emit('overweight', id);
      if (room === 0) return false;
      this.addItem(id, room);
      return false;
    }
    const stackable = def.type !== 'equip';
    if (stackable) {
      const slot = this.inventory.find(s => s?.id === id);
      if (slot) { slot.qty += qty; this.emit('inventory'); return true; }
    }
    for (let n = 0; n < (stackable ? 1 : qty); n++) {
      const free = this.inventory.indexOf(null);
      if (free < 0) { this.emit('inventory-full', id); return false; }
      this.inventory[free] = { id, qty: stackable ? qty : 1 };
    }
    this.emit('inventory');
    return true;
  }
  // A whole item instance into the bag: gear keeps its cards and plus (a trade, server/trades.js).
  addInstance(s) {
    const def = ITEMS[s?.id]; if (!def) return false;
    if (def.type !== 'equip') return this.addItem(s.id, s.qty);
    const free = this.inventory.indexOf(null);
    if (free < 0 || this.carryRoom(s.id) < 1) return false;
    this.inventory[free] = { id: s.id, qty: 1, ...(s.cards?.length ? { cards: [...s.cards] } : {}), ...(s.plus ? { plus: s.plus } : {}) };
    this.emit('inventory');
    return true;
  }
  removeAt(index, qty = 1) {
    const slot = this.inventory[index]; if (!slot) return;
    slot.qty -= qty; if (slot.qty <= 0) this.inventory[index] = null;
    this.emit('inventory');
  }
  count(id) { return this.inventory.reduce((n, s) => n + (s?.id === id ? s.qty : 0), 0); }

  useAt(index) {
    const slot = this.inventory[index]; if (!slot || !this.alive) return false;
    const def = ITEMS[slot.id];
    if (def.type === 'equip') return this.equip(index);
    if (def.type === 'card') { this.emit('card-choose', index); return false; }   // the bag asks which item (CharacterUI)
    if (def.type !== 'use') return false;
    if (def.use.hp && this.hp >= this.maxHp && !def.use.mp) return false;
    if (def.use.mp && this.mp >= this.maxMp && !def.use.hp) return false;
    if (def.use.hp) this.heal(def.use.hp);
    if (def.use.mp) this.restoreMp(def.use.mp);
    this.removeAt(index);
    this.emit('used', slot.id);
    return true;
  }
  // Uses the strongest potion of a kind; used by the quick-potion hotkey.
  quickUse(kind = 'hp') {
    const order = kind === 'hp' ? ['potion_m', 'potion_s'] : ['ether'];
    for (const id of order) {
      const index = this.inventory.findIndex(s => s?.id === id);
      if (index >= 0) return this.useAt(index);
    }
    return false;
  }
  // a weapon held in both hands (items.js twoHand): no shield or off-hand knife with it
  get twoHanded() { return !!ITEMS[this.equipment.weapon]?.twoHand; }
  // the worn item of a slot as a bag item (its cards and plus go with it)
  wornItem(slot) {
    const id = this.equipment[slot]; if (!id) return null;
    return { id, qty: 1, ...(this.cards[slot]?.length ? { cards: [...this.cards[slot]] } : {}), ...(this.refine?.[slot] ? { plus: this.refine[slot] } : {}) };
  }
  equip(index) {
    const slot = this.inventory[index]; if (!slot || !this.alive) return false;
    const def = ITEMS[slot.id]; if (def.type !== 'equip') return false;
    // the off hand is not free while a two-handed weapon is held
    if (def.slot === 'offhand' && this.twoHanded) { this.emit('two-hand', 'offhand'); return false; }
    // a two-handed weapon sends the off-hand item to the bag (it needs a free bag slot)
    const dropOff = def.slot === 'weapon' && def.twoHand && this.equipment.offhand;
    if (dropOff && !this.inventory.some((s, i) => !s && i !== index) && this.equipment.weapon) { this.emit('inventory-full', this.equipment.offhand); return false; }
    // a charm goes into the free charm slot (the first one when both are taken)
    const to = def.slot === 'charm' && this.equipment.charm && !this.equipment.charm2 ? 'charm2' : def.slot;
    const previous = this.wornItem(to);
    this.equipment[to] = slot.id; this.cards[to] = [...(slot.cards ?? [])]; this.refine[to] = slot.plus ?? 0;
    this.inventory[index] = previous;
    if (dropOff) {
      const free = this.inventory.indexOf(null);
      this.inventory[free] = this.wornItem('offhand'); this.equipment.offhand = null; this.cards.offhand = []; this.refine.offhand = 0;
      this.emit('two-hand', 'weapon');
    }
    this.clampVitals();
    this.emit('inventory'); this.emit('change');
    return true;
  }
  unequip(slotName) {
    const id = this.equipment[slotName]; if (!id || !this.alive) return false;
    const free = this.inventory.indexOf(null);
    if (free < 0) { this.emit('inventory-full', id); return false; }
    this.inventory[free] = this.wornItem(slotName); this.equipment[slotName] = null; this.cards[slotName] = []; this.refine[slotName] = 0;
    this.clampVitals(); this.emit('inventory'); this.emit('change');
    return true;
  }
  // Items a card from the bag can go into: { worn: true, slot } and { index } for bag gear of the
  // card's kind with a free card slot.
  cardTargets(cardIndex) {
    const card = ITEMS[this.inventory[cardIndex]?.id]; if (card?.type !== 'card') return [];
    const free = (id, held) => (ITEMS[id]?.slots ?? 0) - (held?.length ?? 0) > 0;
    const out = [];
    for (const s of EQUIP_SLOTS) {
      const worn = this.equipment[s];
      if (worn && slotKind(s) === card.slot && free(worn, this.cards[s])) out.push({ worn: true, slot: s, id: worn, cards: this.cards[s] });
    }
    this.inventory.forEach((s, i) => { if (s && ITEMS[s.id]?.type === 'equip' && ITEMS[s.id].slot === card.slot && free(s.id, s.cards)) out.push({ index: i, id: s.id, cards: s.cards ?? [] }); });
    return out;
  }
  // A card into a free slot of a piece of gear, for good (RO style). where: a worn slot ('weapon',
  // 'charm2', …; 'worn' = the first worn item that fits) or a bag index.
  insertCard(cardIndex, where) {
    const card = this.inventory[cardIndex], def = card && ITEMS[card.id]; if (def?.type !== 'card' || !this.alive) return false;
    const target = this.cardTargets(cardIndex).find(t => (typeof where === 'string' ? t.worn && (where === 'worn' || t.slot === where) : t.index === where));
    if (!target) { this.emit('card-no-slot', def.slot); return false; }
    const cardId = card.id;
    if (target.worn) this.cards[target.slot] = [...this.cards[target.slot], cardId];
    else { const s = this.inventory[target.index]; s.cards = [...(s.cards ?? []), cardId]; }
    this.removeAt(cardIndex);
    this.clampVitals();
    this.emit('card', { id: cardId, item: target.id, worn: !!target.worn }); this.emit('inventory'); this.emit('change');
    return true;
  }
  // หมออาคม takes every card out of a piece of gear in the bag (RO style): STRIP.gold and STRIP.ash
  // per card; 90% all is well, 7% the item breaks (the cards come back), 3% the cards break.
  // → { ok, outcome: 'ok' | 'item_broke' | 'cards_broke', cards } | { ok: false, why }
  stripCost(index) { const n = this.inventory[index]?.cards?.length ?? 0; return { n, gold: n * STRIP.gold, ash: n * STRIP.ash }; }
  stripCards(index, roll = Math.random) {
    const s = this.inventory[index], cost = this.stripCost(index);
    const fail = why => { const r = { ok: false, why }; this.emit('stripped', r); return r; };
    if (!s || !cost.n) return fail('no_cards');
    if (this.gold < cost.gold) return fail('gold');
    if (this.count('ash') < cost.ash) return fail('ash');
    const need = new Set(s.cards.filter(id => !this.inventory.some(x => x?.id === id))).size;
    if (this.inventory.filter(x => !x).length < need) return fail('bag_full');
    for (const id of new Set(s.cards)) if (this.carryRoom(id) < s.cards.filter(x => x === id).length) return fail('bag_full');   // by weight too
    this.gold -= cost.gold;
    for (let left = cost.ash; left > 0;) { const i = this.inventory.findIndex(x => x?.id === 'ash'); const take = Math.min(left, this.inventory[i].qty); this.removeAt(i, take); left -= take; }
    const cards = [...s.cards], r = roll();
    const outcome = r < STRIP.ok ? 'ok' : r < STRIP.ok + STRIP.itemBreaks ? 'item_broke' : 'cards_broke';
    if (outcome === 'item_broke') this.inventory[index] = null; else delete s.cards;
    if (outcome !== 'cards_broke') for (const id of cards) this.addItem(id, 1);
    const res = { ok: true, outcome, cards, item: s.id };
    this.emit('inventory'); this.emit('change'); this.emit('stripped', res);
    return res;
  }
  // ---- ตีบวก (src/character/data/refine.js) at หมื่นเพชรศาสตรา's ----
  // Gear that can go one step higher: worn ({ worn: true, slot }) and in the bag ({ index }).
  refineTargets() {
    const out = [];
    for (const s of EQUIP_SLOTS) { const id = this.equipment[s]; if (id && refineCost(ITEMS[id], this.refine[s])) out.push({ worn: true, slot: s, id, plus: this.refine[s], cards: this.cards[s] }); }
    this.inventory.forEach((s, i) => { if (s && refineCost(ITEMS[s.id], s.plus ?? 0)) out.push({ index: i, id: s.id, plus: s.plus ?? 0, cards: s.cards ?? [] }); });
    return out;
  }
  // One try at the next plus of a worn slot ('weapon', …) or a bag index. Up to +REFINE_SAFE it
  // always works; past that it may fail, and a failed try breaks the item with its cards.
  // → { ok, outcome: 'up' | 'broke', item, to, cards } | { ok: false, why }
  refineGear(where, roll = Math.random) {
    const worn = typeof where === 'string', s = worn ? null : this.inventory[where];
    const id = worn ? this.equipment[where] : s?.id, plus = worn ? this.refine[where] ?? 0 : s?.plus ?? 0;
    const fail = why => { const r = { ok: false, why }; this.emit('refined', r); return r; };
    if (!this.alive) return fail('dead');
    if (!id || (worn && !EQUIP_SLOTS.includes(where))) return fail('no_item');
    const cost = refineCost(ITEMS[id], plus);
    if (!cost) return fail(refinable(ITEMS[id]) ? 'max' : 'not_refinable');
    if (this.gold < cost.gold) return fail('gold');
    const ore = this.inventory.findIndex(x => x?.id === cost.ore); if (ore < 0) return fail('ore');
    this.gold -= cost.gold; this.removeAt(ore, 1);
    const cards = worn ? [...this.cards[where]] : [...(s.cards ?? [])];
    const up = !cost.risky || roll() < cost.rate;
    if (worn) {
      if (up) this.refine[where] = cost.to;
      else { this.equipment[where] = null; this.cards[where] = []; this.refine[where] = 0; }
    } else if (up) s.plus = cost.to;
    else this.inventory[where] = null;
    this.clampVitals();
    const res = { ok: true, outcome: up ? 'up' : 'broke', item: id, to: cost.to, cards: up ? [] : cards };
    this.emit('inventory'); this.emit('change'); this.emit('refined', res);
    return res;
  }
  sellAt(index) {
    const slot = this.inventory[index]; if (!slot) return 0;
    const value = Math.max(1, Math.floor(ITEMS[slot.id].price / 2));
    this.gold += value; this.removeAt(index); this.emit('change');
    return value;
  }

  // ---- Persistence ----
  toJSON() {
    const { name, classId, gender, level, exp, gold, points, alloc, inventory, equipment, hp, mp, jobLevel, jobExp, skills, cards } = this;
    return { name, classId, gender, level, exp, gold, points, alloc, inventory, equipment, hp, mp, jobLevel, jobExp, skills: { ...skills }, evo: { ...this.evo }, refine: { ...this.refine }, friends: [...this.friends], title: this.title, titles: [...this.titles], rec: { ...this.rec, boss: { ...this.rec.boss } }, cards: Object.fromEntries(Object.entries(cards).map(([k, v]) => [k, [...v]])) };
  }
  save() { try { slotStorage.setItem(SAVE_KEY, JSON.stringify(this)); } catch { /* storage unavailable */ } }
  static load() {
    try {
      const raw = slotStorage.getItem(SAVE_KEY); if (!raw) return null;
      const data = JSON.parse(raw);
      if (!CLASSES[CLASS_ALIASES[data.classId] || data.classId]) return null;
      data.inventory = data.inventory?.map(s => (s && ITEMS[s.id] ? s : null));
      if (data.equipment) data.equipment = Object.fromEntries(Object.entries(data.equipment).map(([k, id]) => [k, id && ITEMS[id] ? id : null]));
      if (!(data.hp > 0)) data.hp = undefined;   // never come back stuck at 0 HP (full HP instead)
      return new Character(data);
    } catch { return null; }
  }
  static clearSave() { try { slotStorage.removeItem(SAVE_KEY); } catch { /* ignore */ } }
}
