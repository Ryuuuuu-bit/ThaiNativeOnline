import { RULES } from '../combat/data/rules.js';
import { allyHeal, castInfo, hitEffects, inShape, monsterDefense, rollBlow, selfEffects, within } from './kitCombat.js';
import { rollSkill } from './damage.js';
import { allyTarget, createTargetProxy, monsterTarget, stubTarget } from './targets.js';
import { evoOf } from '../rules/data/evolutions.js';

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
// Evolution paths (src/rules/data/evolutions.js): a skill the character has taken down path A / B
// rolls, reaches and debuffs with that path's rules ('<id>@A'); the FX stays the skill's own,
// with a flash in the path's colour. Cast times: a skill with one fills a cast bar first
// (combat 'casting' / 'cast-done' / 'cast-cancel'); walking or losing the target cancels it.
//   stats(): rules-shaped attacker stats (patk, matk, accuracy, critRate, critDmg)
const KIT = RULES.kit;
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

export class KitCaster {
  constructor(o) {
    Object.assign(this, o);
    this.cd = new Map(); this.pending = null; this.cast_ = 0; this.affected = new Set();
    this.slots = o.kit.skills.map(s => ({ id: s.id, name: s.name, icon: s.icon, lv: s.lv, desc: s.desc, cd: 0, mp: 0 }));
    this.refreshLevels();
    // learning a skill (or a reset) changes its numbers: MP, cooldown, reach
    o.character?.on?.('skills', () => this.refreshLevels());
    this.stub = stubTarget(o.fx, o.player.group);
    this.proxy = createTargetProxy(this.stub);
    this.adapters = new WeakMap();
    this.runner = o.runnerFactory(this.proxy, id => this.roll(id));
    o.character.evoContext = () => ({ fighting: !!o.combat.inCombat, busy: (!o.combat.remote && o.combat.monsters.some(m => m.alive && m.debuffs.some(d => (d.remaining ?? d.duration ?? 0) > 0))) || !!o.combat.pending || o.combat.projectiles.length > 0 || o.character.buffs.length > 0 || this.busy });
  }

  // ---- action bar controller --------------------------------------------------
  get busy() { return this.runner.busy || !!this.pending || !!this.casting; }
  cooldown(i) { return [this.cd.get(this.slots[i].id) ?? 0, this.slots[i].cd * (1 - (this.character.cooldownCut || 0))]; }
  mpOf(i) { return Math.round(this.infos[i].mp * (this.character.mpCostMul ?? 1)); }
  usable(i) { return this.learned(i) && (this.nearDummy() || this.character.mp >= this.mpOf(i)); }
  // the rules id a skill casts with (its evolution path, if the character took one)
  eid(id) { return this.character?.skillVariant?.(id) ?? id; }
  // Skill levels: the character's learnt levels (job levels, src/character/Character.js);
  // ?skill=N on the URL forces one level for testing. 0 = not learnt yet.
  lv(id) { return this.forceLevel ?? (this.character?.skillLevel ? this.character.skillLevel(id) : this.skillLevel ?? 1); }
  learned(i) { return this.lv(this.slots[i].id) >= 1; }
  locked(i) { return !this.learned(i); }
  level(i) { return this.lv(this.slots[i].id); }
  refreshLevels() {
    this.infos = this.kit.skills.map(s => castInfo({ ...s, id: this.eid(s.id) }, Math.max(1, this.lv(s.id))));
    this.slots.forEach((sl, i) => { sl.cd = this.infos[i].cd; sl.mp = this.infos[i].mp; sl.unlock = this.character?.skillUnlockJob?.(sl.id); });
  }
  active(i) { return this.pending?.i === i; }

  cast(i, quiet = false) {
    const s = this.slots[i], info = this.infos[i], c = this.character;
    if (!s || !c.alive || this.runner.busy || this.casting || (this.cd.get(s.id) ?? 0) > 0) return false;
    // not learnt yet: not even at the training dummy (practice is free of MP, not of learning)
    if (!this.learned(i)) { if (!quiet) this.fail(`ยังไม่ได้เรียนสกิลนี้ · ปลดที่ Job Lv.${s.unlock ?? '?'} แล้วอัปด้วยแต้มสกิล (K)`); return false; }
    if (quiet && this.pending) return false;
    if (quiet && !info.needsTarget) {
      if (!this.combat.inCombat && !this.combat.target?.alive) return false;   // a buff or a heal on an empty field is MP for nothing
      const e = selfEffects(this.eid(s.id), Math.max(1, this.lv(i)), c.defense, 0, c.healPow ?? 1);
      if ((e?.heal || e?.hp) && !e?.buff && c.hp >= c.maxHp * .9) return false;
    }
    this.combat.sit?.(false);
    const pick = this.allyPick(s.id, info) ?? this.pick(info);
    if (!pick) { if (!quiet) this.fail(this.dummy() ? 'หุ่นซ้อมไกลเกินไป · เดินเข้าไปใกล้ ๆ' : 'ไม่มีเป้าหมายใกล้ๆ'); return false; }
    if ((pick.monster || pick.ally) && c.mp < this.mpOf(i)) { if (!quiet) this.fail('MP ไม่พอ'); return false; }
    // the skill's own reach, for a monster and for the training dummy alike: walk in first
    const at = this.spotOf(pick);
    if (at && dist(at, this.player.position) > info.range) { if (!quiet) this.combat.world.stop?.(); this.pending = { i, ...pick, t: 0, quiet }; return true; }
    this.pending = null;
    return this.fire(i, pick);
  }

  // Where a pick stands in the world (null for a self cast).
  spotOf(pick) {
    if (pick.monster) return pick.monster;
    if (pick.ally) return this.allyOf(pick.ally);
    if (pick.dummy) { const d = this.dummy(); if (!d) return null; const w = this.fx.toWorld(d.pos.clone()); return { x: w.x, z: w.z }; }
    return null;
  }
  // A heal aimed at one friend (kitCombat.allyHeal: the vine, the bouncing pill), online in a party:
  // the friend picked (Combat.ally: party frame or name plate), walked up to when far; else, as in
  // ThaiNative, the party member lowest on HP (by share) within reach, when lower than the caster.
  // → { ally: id } | null (the caster's own heal, as before). Combat.allies(): the members in this room.
  allyOf(id) { const a = this.combat.allies?.().find(x => x.id === id); return a?.alive ? a : null; }
  allyPick(id, info) {
    if (!allyHeal(this.eid(id)) || this.nearDummy()) return null;
    const cb = this.combat, me = this.player.position, c = this.character;
    if (cb.ally && this.allyOf(cb.ally.id)) return { ally: cb.ally.id };
    const share = a => a.hp / Math.max(1, a.maxHp);
    const low = (cb.allies?.() ?? []).filter(a => a.alive && a.maxHp && dist(a, me) <= info.range).sort((a, b) => share(a) - share(b))[0];
    return low && share(low) < c.hp / c.maxHp ? { ally: low.id } : null;
  }
  // Target for a cast: { monster } | { dummy } | { self } | null.
  pick(info) {
    const cb = this.combat, t = cb.target;
    if (t?.alive && dist(t, this.player.position) <= KIT.targetRange) return { monster: t };
    if (this.nearDummy()) return { dummy: true };
    if (info.needsTarget) { const m = cb.cycleTarget(); return m ? { monster: m } : null; }
    return { self: true };
  }

  // A skill with a cast time fills its bar first (shortened by cast speed), then goes off.
  fire(i, pick) {
    const s = this.slots[i], info = this.infos[i], total = (info.cast || 0) * (1 - (this.character.castSpeed || 0));
    if (total < .05) return this.release(i, pick);
    this.casting = { i, pick, t: 0, total };
    if (pick.monster) { this.combat.setTarget(pick.monster); this.combat.pending = null; }
    this.combat.emit('casting', { id: s.id, name: s.name, total, practice: !!pick.dummy });
    return true;
  }
  release(i, pick) {
    const s = this.slots[i], info = this.infos[i], c = this.character;
    const friend = pick.ally ? this.allyOf(pick.ally) : null;
    this.proxy.bind(pick.dummy ? this.dummy() : pick.monster ? this.adapter(pick.monster) : friend ? allyTarget(() => this.allyOf(friend.id), this.fx) : this.stub);
    if (this.fx) this.fx.statusTarget = pick.monster ? this.adapter(pick.monster) : null;   // its effects are named by the rules (engine.js popup)
    this.runner.range = pick.dummy ? this.dummyRange : Infinity;
    // a skill drops any walk-in, but the basic attack keeps swinging after it (Combat.hold pauses it while the skill plays)
    if (pick.monster) { this.combat.setTarget(pick.monster); this.combat.pending = null; }
    const ok = this.runner.cast(s.id, true);
    if (ok === false) return false;
    // online, the others see this cast played on this player (src/net/RemoteSkills.js)
    // (at the training dummy: where it stands, so the others see the practice too)
    const d = pick.dummy ? this.dummy() : null, at = d ? this.fx.toWorld(d.pos.clone()) : friend;
    this.combat.emit('kit-fx', { id: s.id, monster: pick.monster ?? null, ...(at ? { at: { x: +at.x.toFixed(2), z: +at.z.toFixed(2) } } : {}) });
    if (!pick.dummy) c.spendMp(this.mpOf(i));
    this.cd.set(s.id, info.cd * (1 - (c.cooldownCut || 0)));   // DEX / cards shorten skill cooldowns
    this.cast_++; this.affected.clear(); this.splashed?.clear(); this.lastSkill = s.id;
    if (pick.monster) this.combat.combatTimer = Math.max(this.combat.combatTimer, RULES.combatTimeout);
    if (!friend) this.applySelf(s.id);   // a heal sent to a friend lands on them (server/index.js), not on the caster
    // online: the server opens the cast (src/net/NetCombat.js); `ally` = the friend the heal goes to
    if (!pick.dummy) this.combat.emit('kit-cast', { id: s.id, ...(friend ? { ally: friend.id } : {}) });
    const evo = evoOf(this.eid(s.id));
    if (evo) { const p = pick.monster ?? this.player.position; this.combat.emit('evo-fx', { x: p.x, z: p.z, color: evo.color, name: evo.name }); }
    this.onCast?.(this.kit.skills[i]);
    return true;
  }

  applySelf(id) {
    const c = this.character, e = selfEffects(this.eid(id), Math.max(1, this.lv(id)), c.defense, this.stats()?.matk ?? 0, c.healPow ?? 1);
    if (!e) return;
    const p = this.player.position;
    if (e.heal || e.hp) { const amount = c.heal(c.maxHp * e.heal + e.hp); if (amount) this.combat.emit('heal', { amount, x: p.x, z: p.z }); }
    if (e.mp) { c.mp = Math.min(c.maxMp, Math.round(c.mp + c.maxMp * e.mp)); c.emit('change'); }
    if (e.buff) c.addBuff(e.buff);
  }

  // Per frame: cooldowns tick, a pending cast walks the player into range.
  update(dt) {
    for (const [id, v] of this.cd) this.cd.set(id, Math.max(0, v - dt));
    const k = this.casting;
    if (k) {
      const m = k.pick.monster, a = k.pick.ally ? this.allyOf(k.pick.ally) : null, far = x => dist(x, this.player.position) > this.infos[k.i].range + 1.5;
      if (k.pick.ally && (!a || far(a))) this.cancel(a ? 'เพื่อนอยู่ไกลเกินไป' : 'เพื่อนหมดสติหรือออกไปแล้ว');
      else if (!this.character.alive || (m && (!m.alive || far(m)))) this.cancel(m && !m.alive ? null : 'การร่ายถูกขัด');
      else if ((k.t += dt) >= k.total) { this.casting = null; this.combat.emit('cast-done', { id: this.slots[k.i].id }); this.release(k.i, k.pick); }
      return;
    }
    const p = this.pending;
    if (!p) return;
    const m = p.monster, at = this.spotOf(p);
    if ((m && !m.alive) || !at || !this.character.alive) { this.pending = null; if (p.ally && !p.quiet) this.fail('เพื่อนหมดสติหรือออกไปแล้ว'); return; }
    if ((p.t += dt) > KIT.approachTimeout) { this.pending = null; this.combat.world.stop?.(); if (!p.quiet) this.fail('ไกลเกินไป'); return; }
    if (dist(at, this.player.position) <= this.infos[p.i].range) {
      this.combat.world.stop?.();
      if (!this.runner.busy) { this.pending = null; this.fire(p.i, m ? { monster: m } : p.ally ? { ally: p.ally } : { dummy: true }); }
    } else if (this.combat.world.manualMove?.()) { /* the player is walking by hand: the walk-in waits */ }
    else if (this.combat.world.moveTo?.(at.x, at.z) === false) {
      this.pending = null; if (m) m.unreachableAt = Date.now();
      if (!p.quiet) this.fail('ไปถึงไม่ได้');
    }
  }
  cancel(why = 'ยกเลิกการร่าย') {
    if (this.pending) this.pending = null;
    if (this.casting) { const k = this.casting; this.casting = null; this.combat.emit('cast-cancel', { id: this.slots[k.i].id }); if (why) this.fail(why); }
  }
  get castProgress() { const k = this.casting; return k ? { id: this.slots[k.i].id, name: this.slots[k.i].name, t: k.t, total: k.total } : null; }
  fail(reason) { this.combat.emit('fail', reason); }

  // ---- blows ----------------------------------------------------------------------
  // The runner's damage(skillId) for the bound target. A miss carries dmg -1 so the
  // runners show MISS (they fall back to the effect's own number when dmg is 0).
  roll(id) {
    this.lastSkill = id;
    const t = this.proxy.current, defense = t?.monster ? monsterDefense(t.monster.def) : this.dummyDefense();
    const r = rollSkill(this.stats(), defense, this.eid(id), Math.max(1, this.lv(id)));
    return r.hit ? r : { ...r, dmg: -1 };
  }
  adapter(m) {
    let a = this.adapters.get(m);
    if (!a) {
      a = monsterTarget(m, { fx: this.fx, canStand: this.canStand, onHurt: (mm, amt, crit, exact) => this.hurt(mm, amt, crit, exact), onMiss: mm => this.combat.damageMonster(mm, 0, { miss: true, skill: this.runner.current ?? this.lastSkill }) });
      this.adapters.set(m, a);
    }
    return a;
  }
  // One blow of the current skill on monster `m` (already rolled when `exact`), then
  // the rules effects (once per cast per monster) and the splash around it.
  hurt(m, amount, crit, exact) {
    if (!m.alive) return 0;
    const id = this.runner.current ?? this.lastSkill, eff = this.eid(id), lv = Math.max(1, this.lv(id));
    const r = exact ? { hit: true, crit, dmg: amount } : rollBlow(this.stats(), monsterDefense(m.def), eff, lv);
    this.strike(m, r, id);
    const info = this.infos[this.slots.findIndex(s => s.id === id)];
    const sp = this.combat.remote ? null : info?.splash;   // online the server finds who else an area skill catches
    if (sp?.line || sp?.cone) {
      // a piercing shot / a fan: everyone else on its path takes one blow per cast
      this.splashed ??= new Set();
      for (const o of inShape(this.combat.monsters, this.player.position, m, sp, m)) if (!this.splashed.has(o)) { this.splashed.add(o); this.strike(o, rollBlow(this.stats(), monsterDefense(o.def), eff, lv), id); }
    } else if (sp?.chain) {
      // a chain (an evolution path): the blow jumps on to the nearest few, each once per cast
      this.splashed ??= new Set();
      for (const o of within(this.combat.monsters, m, sp.radius, m).filter(o => !this.splashed.has(o)).slice(0, sp.chain)) { this.splashed.add(o); this.strike(o, rollBlow(this.stats(), monsterDefense(o.def), eff, lv), id); }
    } else if (sp) {
      const center = sp.around === 'self' ? this.player.position : m;
      for (const o of within(this.combat.monsters, center, sp.radius, m)) this.strike(o, rollBlow(this.stats(), monsterDefense(o.def), eff, lv), id);
    }
    return r.hit ? r.dmg : 0;
  }
  strike(m, r, id) {
    if (!r.hit) { this.combat.damageMonster(m, 0, { miss: true, skill: id }); return; }
    const alive = this.combat.damageMonster(m, r.dmg, { crit: r.crit, skill: id });
    // offline the effects land here; online the server rolls them and sends them (src/net/NetCombat.js 'md')
    if (alive && !this.combat.remote && !this.affected.has(m)) { this.affected.add(m); for (const d of hitEffects(this.eid(id), r.dmg)) this.combat.debuff(m, d); }
  }
}
