// Character model: stats, level/EXP, HP/MP, inventory, equipment, buffs, save/load.
// Pure logic so it can be reused by any world or a future server.
import { CLASSES, CLASS_ALIASES, ITEMS, STATS, MAX_LEVEL, START_ITEMS, expToNext } from './data.js';

const SAVE_KEY = 'tno.character.v1';
const INVENTORY_SIZE = 24;

export class Emitter {
  constructor() { this.handlers = {}; }
  on(type, fn) { (this.handlers[type] ||= []).push(fn); return () => this.off(type, fn); }
  off(type, fn) { this.handlers[type] = (this.handlers[type] || []).filter(h => h !== fn); }
  emit(type, payload) { for (const fn of this.handlers[type] || []) fn(payload); }
}

export class Character extends Emitter {
  constructor({ name, classId, gender = 'male', level = 1, exp = 0, gold = 20, points = 0, alloc, inventory, equipment, hp, mp } = {}) {
    super();
    classId = CLASS_ALIASES[classId] || classId;
    if (!CLASSES[classId]) throw new Error(`Unknown class ${classId}`);
    this.name = name; this.classId = classId; this.gender = gender; this.night = false; this.level = level; this.exp = exp; this.gold = gold;
    this.points = points; // unspent stat points
    this.alloc = { str: 0, agi: 0, int: 0, vit: 0, ...alloc };
    this.inventory = inventory ? inventory.map(s => s && { ...s }) : Array(INVENTORY_SIZE).fill(null);
    this.equipment = { weapon: null, armor: null, charm: null, ...equipment };
    this.buffs = []; // {id, def?, slow?, dot?, remaining}
    this.cooldowns = {};
    this.hp = hp ?? this.maxHp; this.mp = mp ?? this.maxMp;
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

  stat(key) { return this.cls.base[key] + this.cls.growth[key] * (this.level - 1) + this.alloc[key] + this.equipBonus(key); }
  get stats() { return Object.fromEntries(STATS.map(k => [k, this.stat(k)])); }

  get maxHp() { return Math.round(80 + this.stat('vit') * 12 + this.level * 10 + this.equipBonus('hp')); }
  get maxMp() { return Math.round(30 + this.stat('int') * 6 + this.level * 4); }
  get attack() {
    const s = this.stats, main = Math.max(s.str, s.agi, s.int);
    const buff = this.buffs.reduce((n, b) => n + (b.atk || 0), 0);
    return Math.round((main * 1.4 + this.level * 1.5 + this.equipBonus('atk')) * (1 + buff));
  }
  get defense() {
    const base = this.stat('vit') * .8 + this.equipBonus('def');
    const guard = this.buffs.find(b => b.def);
    return Math.round(base * (1 + (guard?.def || 0)));
  }
  get critChance() { return Math.min(.6, .05 + this.stat('agi') * .006 + this.equipBonus('crit') + (this.night ? this.cls.nightCrit || 0 : 0)); }
  get dodge() { return Math.min(.25, this.stat('agi') * .008) + this.buffs.reduce((n, b) => n + (b.dodge || 0), 0); }
  get expNeeded() { return expToNext(this.level); }
  get alive() { return this.hp > 0; }

  // ---- HP/MP ----
  damage(amount) {
    if (!this.alive) return 0;
    const dealt = Math.min(this.hp, Math.max(0, Math.round(amount)));
    this.hp -= dealt; this.emit('change');
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
    const rate = inCombat ? .004 : .025;
    this.regen = (this.regen || 0) + dt;
    if (this.regen >= 1) {
      this.regen = 0;
      if (this.hp < this.maxHp || this.mp < this.maxMp) {
        this.hp = Math.min(this.maxHp, this.hp + Math.ceil(this.maxHp * rate));
        this.mp = Math.min(this.maxMp, this.mp + Math.ceil(this.maxMp * rate * 1.5));
        this.emit('change');
      }
    }
  }
  addBuff(buff) { this.buffs = this.buffs.filter(b => b.id !== buff.id); this.buffs.push({ ...buff, remaining: buff.duration }); this.emit('change'); }

  // ---- EXP / level ----
  gainExp(amount) {
    if (this.level >= MAX_LEVEL) return;
    this.exp += Math.round(amount); this.emit('exp', amount);
    while (this.level < MAX_LEVEL && this.exp >= this.expNeeded) {
      this.exp -= this.expNeeded; this.level += 1; this.points += 3;
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
    this.alloc = { str: 0, agi: 0, int: 0, vit: 0 };
    this.hp = Math.min(this.hp, this.maxHp); this.mp = Math.min(this.mp, this.maxMp); this.emit('change');
  }

  // ---- Inventory ----
  addItem(id, qty = 1) {
    const def = ITEMS[id]; if (!def) return false;
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
    const { name, classId, gender, level, exp, gold, points, alloc, inventory, equipment, hp, mp } = this;
    return { name, classId, gender, level, exp, gold, points, alloc, inventory, equipment, hp, mp };
  }
  save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(this)); } catch { /* storage unavailable */ } }
  static load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY); if (!raw) return null;
      const data = JSON.parse(raw);
      if (!CLASSES[CLASS_ALIASES[data.classId] || data.classId]) return null;
      data.inventory = data.inventory?.map(s => (s && ITEMS[s.id] ? s : null));
      return new Character(data);
    } catch { return null; }
  }
  static clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ } }
}
