// Character model: stats, level/EXP, HP/MP, inventory, equipment, buffs, save/load.
// Pure logic so it can be reused by any world or a future server.
import { CLASSES, CLASS_ALIASES, STATS, START_ITEMS, POINTS_PER_LEVEL } from './data/classes.js';
import { ITEMS } from './data/items.js';
import { MAX_LEVEL, expToNext, CARRY, MONSTER_ACCURACY, MAX_JOB_LEVEL, JOB_EXP_RATE, jobExpToNext, MAX_SKILL_LEVEL, SKILL_UNLOCK_JOB, SKILL_RESET_GOLD } from './data/progression.js';
import { KIT_SKILL_IDS } from './data/kits.js';
import { computeDerived, hitChanceOf, ASPD_BUFF_MAX } from '../rules/stats.js';
import { JOBS } from '../rules/data/classes.js';
import { Emitter } from './Emitter.js';
import { slotStorage } from '../core/SaveSlot.js'; // per-character save slot (src/account)

const SAVE_KEY = 'tno.character.v1';
const INVENTORY_SIZE = 24;
// Gear bonus keys passed to computeDerived besides the base stats.
const DERIVED_BONUS = ['atk', 'matk', 'def', 'hp', 'mp', 'crit', 'critDmg', 'acc', 'eva'];
const emptyAlloc = () => Object.fromEntries(STATS.map(k => [k, 0]));

export class Character extends Emitter {
  constructor({ name, classId, gender = 'male', level = 1, exp = 0, gold = 20, points = 0, alloc, inventory, equipment, hp, mp, jobLevel, jobExp = 0, skills } = {}) {
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
    this.alloc = { ...emptyAlloc(), ...alloc };
    this.inventory = inventory ? inventory.map(s => s && { ...s }) : Array(INVENTORY_SIZE).fill(null);
    this.equipment = { weapon: null, armor: null, charm: null, ...equipment };
    this.buffs = []; // {id, def?, slow?, dot?, remaining}
    this.cooldowns = {};
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
    for (const slot of Object.values(this.equipment)) if (slot) total += ITEMS[slot].bonus?.[key] || 0;
    return total;
  }

  // Base stat: class base + growth per level (rounded down) + allocated points + gear.
  stat(key) { return Math.floor((this.cls.base[key] || 0) + (this.cls.growth[key] || 0) * (this.level - 1)) + (this.alloc[key] || 0) + this.equipBonus(key); }
  get stats() { return Object.fromEntries(STATS.map(k => [k, this.stat(k)])); }

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
  // share cut from the basic-attack interval: AGI/DEX (≤30%) plus buffs, all together ≤45%
  get attackSpeed() { return Math.min(ASPD_BUFF_MAX, this.derived.aspd + this.buffSum('aspd')); }
  get cooldownCut() { return this.derived.castRed; }     // share cut from skill cooldowns
  // Chance to avoid a blow from an attacker with this accuracy (buffs such as smoke add on top).
  evadeChance(accuracy) { return Math.min(.9, 1 - hitChanceOf(accuracy, this.evasion) + this.buffSum('dodge')); }
  // Kept for callers without an attacker: evasion against an even-level monster.
  get dodge() { return this.evadeChance(MONSTER_ACCURACY(this.level)); }
  // Bag weight: bag stacks plus equipped items, against a STR-based limit.
  get weight() {
    let w = 0;
    for (const s of this.inventory) if (s) w += (ITEMS[s.id].weight || 0) * s.qty;
    for (const id of Object.values(this.equipment)) if (id) w += ITEMS[id].weight || 0;
    return w;
  }
  get maxWeight() { return Math.round(CARRY.base + this.stat('str') * CARRY.perStr); }
  get heavy() { return this.weight >= this.maxWeight * CARRY.heavy; }
  // How many of an item still fit under the weight limit.
  carryRoom(id) {
    const w = ITEMS[id]?.weight || 0;
    return w ? Math.max(0, Math.floor((this.maxWeight - this.weight) / w)) : Infinity;
  }
  get expNeeded() { return expToNext(this.level); }
  get alive() { return this.hp > 0; }

  // ---- HP/MP ----
  damage(amount) {
    if (!this.alive) return 0;
    const dealt = Math.min(this.hp, Math.max(0, Math.round(amount)));
    this.hp -= dealt; this.emit('change'); if (dealt) this.emit('damaged', dealt);
    if (this.hp <= 0) this.emit('death');
    return dealt;
  }
  heal(amount) {
    if (!this.alive) return 0;
    const before = this.hp; this.hp = Math.min(this.maxHp, this.hp + Math.round(amount)); this.emit('change');
    return this.hp - before;
  }
  restoreMp(amount) { this.mp = Math.min(this.maxMp, this.mp + Math.round(amount)); this.emit('change'); }
  spendMp(amount) { if (this.mp < amount) return false; this.mp -= amount; this.emit('change'); return true; }
  revive(ratio = .5) { this.hp = Math.max(1, Math.round(this.maxHp * ratio)); this.mp = Math.round(this.maxMp * ratio); this.buffs = []; this.emit('change'); }

  // Slow natural regeneration, faster out of combat.
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
    const rate = inCombat ? .004 : .025;
    this.regen = (this.regen || 0) + dt;
    if (this.regen >= 1 && !this.heavy) {   // a heavy bag stops natural regeneration
      this.regen = 0;
      if (this.hp < this.maxHp || this.mp < this.maxMp) {
        this.hp = Math.min(this.maxHp, this.hp + Math.ceil(this.maxHp * rate));
        this.mp = Math.min(this.maxMp, this.mp + Math.ceil(this.maxMp * rate * 1.5));
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
  allocate(key) {
    if (this.points <= 0 || !STATS.includes(key)) return false;
    const hpRatio = this.hp / this.maxHp;
    this.points -= 1; this.alloc[key] += 1;
    this.hp = Math.round(this.maxHp * hpRatio); this.emit('change');
    return true;
  }
  resetStats() {
    this.points += Object.values(this.alloc).reduce((a, b) => a + b, 0);
    this.alloc = emptyAlloc();
    this.hp = Math.min(this.hp, this.maxHp); this.mp = Math.min(this.mp, this.maxMp); this.emit('change');
  }

  // ---- Inventory ----
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
    if (def.type !== 'use') return false;
    if (def.use.hp && this.hp >= this.maxHp && !def.use.mp) return false;
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
  equip(index) {
    const slot = this.inventory[index]; if (!slot) return false;
    const def = ITEMS[slot.id]; if (def.type !== 'equip') return false;
    const ratio = this.hp / this.maxHp;
    const previous = this.equipment[def.slot];
    this.equipment[def.slot] = slot.id;
    this.inventory[index] = previous ? { id: previous, qty: 1 } : null;
    this.hp = Math.max(1, Math.round(this.maxHp * ratio)); this.mp = Math.min(this.mp, this.maxMp);
    this.emit('inventory'); this.emit('change');
    return true;
  }
  unequip(slotName) {
    const id = this.equipment[slotName]; if (!id) return false;
    const free = this.inventory.indexOf(null);
    if (free < 0) { this.emit('inventory-full', id); return false; }
    this.inventory[free] = { id, qty: 1 }; this.equipment[slotName] = null;
    this.hp = Math.min(this.hp, this.maxHp); this.emit('inventory'); this.emit('change');
    return true;
  }
  sellAt(index) {
    const slot = this.inventory[index]; if (!slot) return 0;
    const value = Math.max(1, Math.floor(ITEMS[slot.id].price / 2));
    this.gold += value; this.removeAt(index); this.emit('change');
    return value;
  }

  // ---- Persistence ----
  toJSON() {
    const { name, classId, gender, level, exp, gold, points, alloc, inventory, equipment, hp, mp, jobLevel, jobExp, skills } = this;
    return { name, classId, gender, level, exp, gold, points, alloc, inventory, equipment, hp, mp, jobLevel, jobExp, skills: { ...skills } };
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
