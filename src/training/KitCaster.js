import { RULES } from '../combat/data/rules.js';
import { castInfo, hitEffects, inShape, monsterDefense, rollBlow, selfEffects, within } from './kitCombat.js';
import { rollSkill } from './damage.js';
import { createTargetProxy, monsterTarget, stubTarget } from './targets.js';

// Casts a class kit's ten skills (src/classes CLASS_KITS) on any map, as the
// action bar's controller (src/ui/ActionBar.js). Each cast picks its target:
//   the combat target (Tab / click, src/combat) → else the training dummy when
//   standing at it → else the nearest monster → else, for self skills, nobody.
// Monsters: MP and the kit cooldown are paid, the player walks into range first,
// and every blow of the FX is a rules roll (src/training/damage.js) against the
// monster's DEF/EVA, applied through Combat.damageMonster (numbers, aggro, kill,
// EXP and loot). Area skills also hit the monsters around (kitCombat.splashOf).
// The dummy stays free to practise on, as before.
//
//   const caster = new KitCaster({ kit, runnerFactory, fx, player, combat, character, canStand, skillLevel,
//     stats: () => derived, dummy: () => dummy | null, nearDummy: () => bool, dummyDefense: () => { def, eva },
//     dummyRange, onCast(kitSkill) })
//   runnerFactory(target, damage) → the kit runner (kit.createSkills with `dummy: target`)
//   stats(): rules-shaped attacker stats (patk, matk, accuracy, critRate, critDmg)
const KIT = RULES.kit;
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

export class KitCaster {
  constructor(o) {
    Object.assign(this, o);
    this.cd = new Map(); this.pending = null; this.cast_ = 0; this.affected = new Set();
    this.infos = o.kit.skills.map(s => castInfo(s, o.skillLevel));
    this.slots = o.kit.skills.map((s, i) => ({ id: s.id, name: s.name, icon: s.icon, lv: s.lv, desc: s.desc, cd: this.infos[i].cd, mp: this.infos[i].mp }));
    this.stub = stubTarget(o.fx, o.player.group);
    this.proxy = createTargetProxy(this.stub);
    this.adapters = new WeakMap();
    this.runner = o.runnerFactory(this.proxy, id => this.roll(id));
  }

  // ---- action bar controller --------------------------------------------------
  get busy() { return this.runner.busy || !!this.pending; }
  cooldown(i) { return [this.cd.get(this.slots[i].id) ?? 0, this.slots[i].cd * (1 - (this.character.cooldownCut || 0))]; }
  usable(i) { return this.nearDummy() || this.character.mp >= this.infos[i].mp; }
  active(i) { return this.pending?.i === i; }

  cast(i, quiet = false) {
    const s = this.slots[i], info = this.infos[i], c = this.character;
    if (!s || !c.alive || this.runner.busy || (this.cd.get(s.id) ?? 0) > 0) return false;
    if (quiet && this.pending) return false;
    const pick = this.pick(info);
    if (!pick) { if (!quiet) this.fail(this.dummy() ? 'หุ่นซ้อมไกลเกินไป · เดินเข้าไปใกล้ ๆ' : 'ไม่มีเป้าหมายใกล้ๆ'); return false; }
    if (pick.monster) {
      if (c.mp < info.mp) { if (!quiet) this.fail('MP ไม่พอ'); return false; }
      if (dist(pick.monster, this.player.position) > info.range) { this.pending = { i, monster: pick.monster, t: 0, quiet }; return true; }
    }
    this.pending = null;
    return this.fire(i, pick);
  }

  // Target for a cast: { monster } | { dummy } | { self } | null.
  pick(info) {
    const cb = this.combat, t = cb.target;
    if (t?.alive && dist(t, this.player.position) <= KIT.targetRange) return { monster: t };
    if (this.nearDummy()) return { dummy: true };
    if (info.needsTarget) { const m = cb.cycleTarget(); return m ? { monster: m } : null; }
    return { self: true };
  }

  fire(i, pick) {
    const s = this.slots[i], info = this.infos[i], c = this.character;
    this.proxy.bind(pick.dummy ? this.dummy() : pick.monster ? this.adapter(pick.monster) : this.stub);
    this.runner.range = pick.dummy ? this.dummyRange : Infinity;
    // a skill drops any walk-in, but the basic attack keeps swinging after it (Combat.hold pauses it while the skill plays)
    if (pick.monster) { this.combat.setTarget(pick.monster); this.combat.pending = null; }
    const ok = this.runner.cast(s.id, true);
    if (ok === false) return false;
    if (!pick.dummy) c.spendMp(info.mp);
    this.cd.set(s.id, info.cd * (1 - (c.cooldownCut || 0)));   // DEX / cards shorten skill cooldowns
    this.cast_++; this.affected.clear(); this.splashed?.clear(); this.lastSkill = s.id;
    if (pick.monster) this.combat.combatTimer = Math.max(this.combat.combatTimer, RULES.combatTimeout);
    this.applySelf(s.id);
    this.onCast?.(this.kit.skills[i]);
    return true;
  }

  applySelf(id) {
    const c = this.character, e = selfEffects(id, this.skillLevel, c.defense);
    if (!e) return;
    const p = this.player.position;
    if (e.heal) { const amount = c.heal(c.maxHp * e.heal); if (amount) this.combat.emit('heal', { amount, x: p.x, z: p.z }); }
    if (e.mp) { c.mp = Math.min(c.maxMp, Math.round(c.mp + c.maxMp * e.mp)); c.emit('change'); }
    if (e.buff) c.addBuff(e.buff);
  }

  // Per frame: cooldowns tick, a pending cast walks the player into range.
  update(dt) {
    for (const [id, v] of this.cd) this.cd.set(id, Math.max(0, v - dt));
    const p = this.pending;
    if (!p) return;
    const m = p.monster;
    if (!m.alive || !this.character.alive) { this.pending = null; return; }
    if ((p.t += dt) > KIT.approachTimeout) { this.pending = null; this.combat.world.stop?.(); if (!p.quiet) this.fail('ไกลเกินไป'); return; }
    if (dist(m, this.player.position) <= this.infos[p.i].range) {
      this.combat.world.stop?.();
      if (!this.runner.busy) { this.pending = null; this.fire(p.i, { monster: m }); }
    } else this.combat.world.moveTo?.(m.x, m.z);
  }
  cancel() { if (this.pending) { this.pending = null; } }
  fail(reason) { this.combat.emit('fail', reason); }

  // ---- blows ----------------------------------------------------------------------
  // The runner's damage(skillId) for the bound target. A miss carries dmg -1 so the
  // runners show MISS (they fall back to the effect's own number when dmg is 0).
  roll(id) {
    this.lastSkill = id;
    const t = this.proxy.current, defense = t?.monster ? monsterDefense(t.monster.def) : this.dummyDefense();
    const r = rollSkill(this.stats(), defense, id, this.skillLevel);
    return r.hit ? r : { ...r, dmg: -1 };
  }
  adapter(m) {
    let a = this.adapters.get(m);
    if (!a) {
      a = monsterTarget(m, { fx: this.fx, canStand: this.canStand, onHurt: (mm, amt, crit, exact) => this.hurt(mm, amt, crit, exact), onMiss: mm => this.combat.damageMonster(mm, 0, { miss: true }) });
      this.adapters.set(m, a);
    }
    return a;
  }
  // One blow of the current skill on monster `m` (already rolled when `exact`), then
  // the rules effects (once per cast per monster) and the splash around it.
  hurt(m, amount, crit, exact) {
    if (!m.alive) return 0;
    const id = this.runner.current ?? this.lastSkill;
    const r = exact ? { hit: true, crit, dmg: amount } : rollBlow(this.stats(), monsterDefense(m.def), id, this.skillLevel);
    this.strike(m, r, id);
    const info = this.infos[this.slots.findIndex(s => s.id === id)];
    const sp = info?.splash;
    if (sp?.line || sp?.cone) {
      // a piercing shot / a fan: everyone else on its path takes one blow per cast
      this.splashed ??= new Set();
      for (const o of inShape(this.combat.monsters, this.player.position, m, sp, m)) if (!this.splashed.has(o)) { this.splashed.add(o); this.strike(o, rollBlow(this.stats(), monsterDefense(o.def), id, this.skillLevel), id); }
    } else if (sp) {
      const center = sp.around === 'self' ? this.player.position : m;
      for (const o of within(this.combat.monsters, center, sp.radius, m)) this.strike(o, rollBlow(this.stats(), monsterDefense(o.def), id, this.skillLevel), id);
    }
    return r.hit ? r.dmg : 0;
  }
  strike(m, r, id) {
    if (!r.hit) { this.combat.damageMonster(m, 0, { miss: true }); return; }
    const alive = this.combat.damageMonster(m, r.dmg, { crit: r.crit });
    if (alive && !this.affected.has(m)) { this.affected.add(m); for (const d of hitEffects(id, r.dmg)) this.combat.debuff(m, d); }
  }
}
