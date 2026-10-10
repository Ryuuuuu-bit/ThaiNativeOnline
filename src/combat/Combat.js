// Combat rules and monster AI on the XZ plane. No rendering: views listen to events.
import { MONSTERS, NIGHT } from './data/monsters.js';
import { SKILLS } from './data/skills.js';
import { rollLootDrops } from './lootDrops.js';
import { Emitter } from '../character/Emitter.js';

const rand = (a, b) => a + Math.random() * (b - a);
const randInt = (a, b) => Math.floor(rand(a, b + 1));
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
import { RULES } from './data/rules.js';
import { monsterAttackMul, effectiveDefense, sameStatusSource } from './statusEffects.js';
import { rollDamage } from '../rules/stats.js';
import { followerAway } from '../classes/dog.js';
import { MONSTER_ACCURACY, killExp } from '../character/data/progression.js';
import { afterHit, shoveTo } from './monsterHit.js';
import { cardId, cardRate, hasCard } from '../character/data/cards.js';
import { resetBossSkills, cancelBossSkill, tickBossSkills } from './bossSkills.js';
import { monsterAttackImpact, beginMonsterStrike, tickMonsterStrike, cancelMonsterStrike } from './monsterAttackTiming.js';

const { leash: LEASH, combatTimeout: COMBAT_TIMEOUT, projectileSpeed: PROJECTILE_SPEED, globalCooldown: GLOBAL_COOLDOWN, petBite: PET_BITE, petInstinct: PET_INSTINCT } = RULES;

let nextId = 1;

export class Monster {
  constructor(type, spawn, x, z) {
    const def = MONSTERS[type];
    this.id = nextId++; this.type = type; this.def = def; this.spawn = spawn;
    this.home = { x, z }; this.x = x; this.z = z; this.facing = Math.random() * Math.PI * 2;
    this.maxHp = def.hp; this.hp = def.hp; this.state = 'idle';
    this.attackTimer = 0; this.wanderTimer = rand(1, 4); this.wanderTarget = null;
    this.debuffs = []; this.respawnTimer = 0; this.moving = false; this.dotTimer = 0;
  }
  get alive() { return this.hp > 0; }
  get name() { return this.def.name; }
  get level() { return this.def.level; }
  get speedFactor() { return 1 - Math.max(0, ...this.debuffs.map(d => d.slow || 0)); }
}

export class Combat extends Emitter {
  // world: { canStand(x,z), playerPos() -> {x,z}, moveTo(x,z) | null, stop() }
  constructor(character, world, spawns = []) {
    super();
    this.character = character; this.world = world;
    this.monsters = []; this.target = null; this.autoAttack = false;
    this.pending = null; // { skillId, target } waiting to get in range
    this.attackTimer = 0; this.gcd = 0; this.combatTimer = 0; this.projectiles = []; this.hold = false;
    this.phase = 'day';
    character.evoContext = () => ({ fighting: this.inCombat, busy: !!this.pending || this.projectiles.length > 0 || character.buffs.length > 0 });
    // Hunter's dog: follows the player and bites whatever the player fights.
    this.pet = character.cls.pet ? { kind: character.cls.pet, x: 0, z: 0, facing: 0, moving: false, attackTimer: 0, frenzy: 0, placed: false } : null;
    for (const spawn of spawns) for (let i = 0; i < spawn.count; i++) {
      const m = new Monster(spawn.type, spawn, spawn.x, spawn.z);
      m.hp = 0; m.state = 'dormant'; m.respawnTimer = 0;
      this.monsters.push(m);
    }
  }

  // ---- Day / night ----
  // Phases follow the world clock (morning, day, evening, night); 'day' in
  // spawn data means any phase that is not night.
  get night() { return this.phase === 'night'; }
  isActive(spawn) {
    if (spawn.active) return spawn.active.includes(this.phase);
    return !spawn.time || spawn.time === 'any' || (spawn.time === 'night') === this.night;
  }
  setPhase(phase) {
    if (phase === this.phase) return;
    this.phase = phase;
    this.character.night = this.night; this.character.emit('change');
    // Staggered so a new night does not pop every ghost in on the same frame; the first phase spawns at once.
    if (this.started) for (const m of this.monsters) if (m.state === 'dormant' && this.isActive(m.spawn)) m.respawnTimer = rand(.5, 3);
    this.emit('phase', phase);
  }
  isGhost(m) { return m.def.loot === 'spirit' || m.def.loot === 'rare'; }

  get inCombat() { return this.combatTimer > 0; }

  spawnMonster(spawn, existing) {
    if (spawn.chance && Math.random() > spawn.chance) return null;
    for (let tries = 0; tries < 20; tries++) {
      const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * spawn.radius;
      const x = spawn.x + Math.cos(a) * r, z = spawn.z + Math.sin(a) * r;
      if (!this.world.canStand(x, z)) continue;
      const monster = existing || new Monster(spawn.type, spawn, x, z);
      if (existing) Object.assign(existing, { x, z, home: { x, z }, hp: existing.maxHp, state: 'idle', debuffs: [], attackTimer: 0 });
      else this.monsters.push(monster);
      resetBossSkills(monster);
      this.cancelMonsterAttack(monster);
      monster.strikeGeneration = (monster.strikeGeneration ?? 0) + 1;
      this.emit('spawn', monster);
      return monster;
    }
    return null;
  }

  // ---- Targeting ----
  setTarget(monster) {
    if (monster && !monster.alive) monster = null;
    if (this.target === monster) return;
    this.target = monster; this.pending = null;
    if (!monster) this.autoAttack = false;
    this.emit('target', monster);
  }
  cycleTarget() {
    const p = this.world.playerPos();
    const list = this.monsters.filter(m => m.alive && dist(m, p) < 14).sort((a, b) => dist(a, p) - dist(b, p));
    if (!list.length) { this.setTarget(null); return null; }
    const i = list.indexOf(this.target);
    this.setTarget(list[(i + 1) % list.length]);
    return this.target;
  }
  // Player moved by hand: stop chasing and swinging but keep the target selected.
  cancelPending() { this.pending = null; this.autoAttack = false; }

  // ---- Player actions ----
  // Sitting to rest (AUTO, src/ui/ActionBar.js): double regen out of a fight (Character.tick).
  // Any move, skill, blow or fight stands the player up. Emits 'sit' (src/net tells the server).
  sit(on) {
    const c = this.character; on = !!on && c.alive && !this.inCombat;
    if (!!c.sitting === on) return;
    c.sitting = on;
    if (on) { this.world.stop?.(); this.pending = null; this.autoAttack = false; }
    this.emit('sit', on);
  }
  basicSkillId() { return this.character.cls.skills.find(id => SKILLS[id].basic); }
  get basicApproachRange() { return Math.max(5, this.character.cls.range + 3); }

  useSkill(skillId) {
    const c = this.character, skill = SKILLS[skillId];
    if (!skill || !c.alive) return { ok: false };
    this.sit(false);
    if (c.cooldowns[skillId] > 0) return this.fail('ยังใช้ไม่ได้');
    if (!skill.basic && this.gcd > 0) return { ok: false, reason: 'gcd' };
    if (c.mp < skill.mp) return this.fail('MP ไม่พอ');

    const needsTarget = skill.kind === 'damage' || skill.kind === 'debuff' || skill.kind === 'pet' || (skill.kind === 'aoe' && skill.around === 'target');
    if (needsTarget) {
      if (!this.target?.alive) this.cycleTarget();
      const target = this.target;
      if (!target) return this.fail('ไม่มีเป้าหมายใกล้ๆ');
      const range = this.skillRange(skill);
      if (skill.basic && dist(target, this.world.playerPos()) > this.basicApproachRange) {
        this.pending = null; this.autoAttack = false; this.world.stop?.();
        return this.fail('เป้าหมายไกลเกินไป · เดินเข้าใกล้ก่อนโจมตี');
      }
      if (dist(target, this.world.playerPos()) > range) {
        this.world.stop?.();   // the clicked walk gives way to this
        this.pending = { skillId, target };
        if (skill.basic) this.autoAttack = true;
        return { ok: true, moving: true };
      }
      if (skill.basic) {
        this.autoAttack = true;
        if (this.attackTimer > 0) { this.pending = { skillId, target }; return { ok: true, queued: true }; }
      }
      this.pending = null;
      this.execute(skillId, target);
      return { ok: true };
    }
    this.execute(skillId, null);
    return { ok: true };
  }
  skillRange(skill) {
    if (skill.kind === 'pet') return 12;
    return skill.kind === 'aoe' && skill.around === 'target' ? Math.max(this.character.cls.range, 6) : this.character.cls.range;
  }
  fail(reason) { this.emit('fail', reason); return { ok: false, reason }; }

  execute(skillId, target) {
    const c = this.character, skill = SKILLS[skillId], p = this.world.playerPos();
    if (!c.spendMp(skill.mp)) { this.autoAttack = false; this.fail('MP ไม่พอ'); return false; }
    if (skill.cd) c.cooldowns[skillId] = skill.cd * (1 - c.cooldownCut);          // DEX shortens skill cooldowns
    if (skill.basic) this.attackTimer = c.cls.attackSpeed * (1 - c.attackSpeed);   // AGI speeds up basic attacks
    else { this.gcd = GLOBAL_COOLDOWN; this.attackTimer = Math.max(this.attackTimer, GLOBAL_COOLDOWN * .6); }
    this.combatTimer = Math.max(this.combatTimer, skill.kind === 'heal' || skill.kind === 'buff' ? 0 : COMBAT_TIMEOUT);
    this.emit('cast', { skillId, skill, target, from: { x: p.x, z: p.z } });

    if (skill.kind === 'heal') { const amount = c.heal(c.maxHp * skill.heal); this.emit('heal', { amount, x: p.x, z: p.z }); return; }
    if (skill.kind === 'buff') { c.addBuff(skill.buff); this.emit('buff', { skill }); return; }
    if (skill.kind === 'pet') {
      if (!this.pet) return;
      this.pet.frenzy = skill.frenzy; this.pet.attackTimer = 0; this.pet.pounce = skill;
      this.emit('pet-command', { target });
      return;
    }

    if (skill.kind === 'aoe') {
      const center = skill.around === 'self' ? p : target;
      this.emit('aoe', { x: center.x, z: center.z, radius: skill.radius, skillId });
      const caught = this.monsters.filter(m => m.alive && dist(m, center) <= skill.radius).sort((a, b) => dist(a, center) - dist(b, center));
      // online the server splashes from one blow; offline every monster in the circle is struck here
      for (const m of this.remote ? caught.slice(0, 1) : caught) this.hitMonster(m, skill);
      return;
    }
    if (skill.projectile) {
      const delay = dist(p, target) / PROJECTILE_SPEED;
      this.projectiles.push({ target, skill, delay });
      this.emit('projectile', { from: { x: p.x, z: p.z }, target, color: skill.projectile, duration: delay, look: skill.look });
    } else this.hitMonster(target, skill);
  }

  // One blow with the rules' formula (src/rules/stats.js rollDamage): INT skills deal
  // MATK (always hit, half armour), the rest ATK against the monster's DEF and evasion.
  rollPlayerDamage(skill, m) {
    const c = this.character;
    const atk = { patk: c.patk, matk: c.matk, accuracy: c.accuracy, critRate: skill.alwaysCrit ? 1 : c.critChance, critDmg: c.critDamage };
    return rollDamage(atk, effectiveDefense(m), skill.scale === 'int' ? 'magic' : 'physical', skill.power);
  }

  hitMonster(m, skill) {
    if (!m.alive) return;
    const { hit, dmg: dealt, crit } = this.rollPlayerDamage(skill, m);
    // สัญชาตญาณหมาล่า: a hunter's landed basic hit may send the dog in at once (LUK helps)
    if (hit && skill.basic && this.pet && Math.random() < PET_INSTINCT + (this.character.stat?.('luk') || 0) * .002) { this.pet.attackTimer = 0; this.pet.pounce = this.pet.pounce || { power: PET_BITE * 1.5 * (this.character.petBiteMul ?? 1) }; }
    const id = skill.basic ? 'basic' : Object.keys(SKILLS).find(k => SKILLS[k] === skill);
    if (this.damageMonster(m, hit ? dealt : 0, { crit, miss: !hit, skill: id }) && skill.debuff && !this.remote) this.debuff(m, { ...skill.debuff, source: this.character.attack });
  }

  // Apply an already rolled blow to a monster (hook for the class skill kits,
  // src/training/KitCaster.js): emits hit/miss, then kills (EXP, gold, loot) or aggroes.
  // → true when the monster took the blow and is still alive.
  damageMonster(m, amount, { crit = false, miss = false } = {}) {
    if (!m?.alive) return false;
    if (miss) { this.emit('miss', { x: m.x, z: m.z, monster: m }); this.aggro(m); return false; }
    amount *= 1 + this.character.vsRace(m.def);   // cards (offline; online the server rolls)
    m.hp = Math.max(0, m.hp - Math.max(0, Math.round(amount)));
    this.emit('hit', { monster: m, amount: Math.round(amount), crit, x: m.x, z: m.z });
    if (m.hp <= 0) { this.kill(m); return false; }
    this.aggro(m); return true;
  }
  // Debuff on a monster: { id, duration, slow?, stun?, dot?, source?, label? }; one of each id at a time.
  debuff(m, d) { if (!m.alive) return; if (d.taunt) { if (m.state === 'return') return; d = { ...d, duration: Math.min(m.def.boss ? 2 : 8, d.duration) }; m.state = 'chase'; } m.debuffs = m.debuffs.filter(o => !sameStatusSource(o, d)); m.debuffs.push({ ...d, remaining: d.duration }); this.emit('debuffed', { monster: m, debuff: d }); }

  aggro(m) { if (m.state !== 'return') m.state = 'chase'; this.combatTimer = COMBAT_TIMEOUT; }

  kill(m) {
    this.cancelMonsterAttack(m);
    for (const e of cancelBossSkill(m)) this.emit('boss-skill', { ...e, monster: m });
    m.state = 'dead'; m.respawnTimer = m.spawn.respawn ?? RULES.monsterRespawn; m.debuffs = [];
    const c = this.character;
    const exp = killExp(m.def.exp, c.level, m.level ?? m.def.level, !!(m.def.elite || m.def.boss), this.night ? NIGHT.expBonus : 1);
    const gold = randInt(...m.def.gold);
    const drops = rollLootDrops(m.def);
    if (hasCard(m.type) && Math.random() < cardRate(m.def)) drops.push({ id: cardId(m.type), qty: 1 });
    this.emit('kill', { monster: m, exp, gold, drops });
    c.gold += gold; c.gainExp(exp);
    c.refillFlasks('kill', m.def.boss ? 10 : m.def.elite ? 3 : 1);
    for (const d of drops) c.addInstance(d);
    if (this.target === m) { this.target = null; this.autoAttack = false; this.pending = null; this.emit('target', null); }
  }

  // ---- Simulation ----
  update(dt) {
    const c = this.character, p = this.world.playerPos();
    this.started = true;
    this.attackTimer = Math.max(0, this.attackTimer - dt);
    this.gcd = Math.max(0, this.gcd - dt);
    this.combatTimer = Math.max(0, this.combatTimer - dt);
    c.tick(dt, this.inCombat);

    for (const proj of this.projectiles) proj.delay -= dt;
    const landed = this.projectiles.filter(proj => proj.delay <= 0);
    this.projectiles = this.projectiles.filter(proj => proj.delay > 0);
    for (const proj of landed) this.hitMonster(proj.target, proj.skill);

    // Chase toward pending target, then fire. `hold` (set while a class kit skill
    // plays, src/training) pauses the player's own swings and chasing.
    const byHand = !!this.world.manualMove?.();
    if (c.sitting && (byHand || this.inCombat || !c.alive)) this.sit(false);
    if (byHand) { this.pending = null; this.autoAttack = false; }
    if (c.alive && this.pending && !this.hold) {
      const { skillId, target } = this.pending, skill = SKILLS[skillId];
      this.pending.elapsed = (this.pending.elapsed ?? 0) + dt;
      if (!target?.alive || this.pending.elapsed > 6 || (skill.basic && dist(target, p) > this.basicApproachRange)) {
        this.pending = null; this.autoAttack = false; this.world.stop?.();
      }
      else {
        if (dist(target, p) <= this.skillRange(skill)) {
          this.world.stop?.();
          const waiting = skill.basic ? this.attackTimer > 0 : this.gcd > 0;
          if (!waiting) { this.pending = null; this.execute(skillId, target); }
        } else if (this.world.moveTo?.(target.x, target.z) === false) {
          // no way to it (behind trees or water): let it go for a while, AUTO picks another
          target.unreachableAt = Date.now(); this.pending = null; this.autoAttack = false;
          if (this.target === target) this.setTarget(null);
        }
      }
    }
    // Auto attack keeps swinging at the current target while in range.
    if (c.alive && !this.hold && this.autoAttack && !this.pending && this.target?.alive && this.attackTimer <= 0) {
      const basic = this.basicSkillId();
      if (dist(this.target, p) <= c.cls.range) this.execute(basic, this.target);
      else if (dist(this.target, p) <= this.basicApproachRange) this.pending = { skillId: basic, target: this.target };
      else { this.autoAttack = false; this.world.stop?.(); }
    }

    // online (src/net/NetCombat.js) the server runs the monsters; offline they live here
    if (!this.remote) for (const m of this.monsters) this.updateMonster(m, dt, p);
    // online the server's effects (stun, slow, damage over time) run down here for the tint and the tags
    else for (const m of this.monsters) if (m.debuffs.length) m.debuffs = m.debuffs.filter(d => (d.remaining -= dt) > 0);
    if (this.pet) this.updatePet(dt, p);
  }

  updatePet(dt, p) {
    const pet = this.pet, c = this.character;
    if (!pet.placed) { Object.assign(pet, { x: p.x - 1, z: p.z + 1, placed: true }); }
    pet.attackTimer = Math.max(0, pet.attackTimer - dt);
    pet.frenzy = Math.max(0, pet.frenzy - dt);
    pet.moving = false;
    const target = this.target;
    const fighting = c.alive && target?.alive && dist(target, p) < 10 && (this.inCombat || pet.pounce);
    if (fighting) {
      const d = dist(pet, target);
      if (d > 1.1) this.step(pet, target, pet.pounce ? 9 : 5.5, dt);
      else {
        pet.facing = Math.atan2(target.x - pet.x, target.z - pet.z);
        // a skill has the dog out on an errand (its bites are the skill's own): no second set of bites
        if (pet.attackTimer <= 0 && !followerAway()) {
          pet.attackTimer = (pet.frenzy > 0 ? .55 : 1.3) * (1 - c.attackSpeed);
          const pounce = !!pet.pounce, skill = pet.pounce || { power: PET_BITE * (c.petBiteMul ?? 1) };   // สายใยคู่หู: a stronger bite
          pet.pounce = null;
          if (this.remote) { this.damageMonster(target, 0, { skill: 'pet', pounce }); return; }   // online the server rolls the bite
          const atk = { patk: c.patk, matk: c.matk, accuracy: c.accuracy, critRate: c.critChance, critDmg: c.critDamage };
          const r = rollDamage(atk, effectiveDefense(target), 'physical', skill.power);
          if (!r.hit) { this.emit('miss', { x: target.x, z: target.z, monster: target }); this.aggro(target); return; }
          const dealt = r.dmg;
          target.hp = Math.max(0, target.hp - dealt);
          this.emit('pet-bite', { monster: target, amount: dealt });
          this.emit('hit', { monster: target, amount: dealt, crit: r.crit, pet: true, x: target.x, z: target.z });
          if (target.hp <= 0) this.kill(target); else this.aggro(target);
        }
      }
      return;
    }
    pet.pounce = null;
    // Heel: trot to a spot just behind the player.
    const heel = { x: p.x - 1.1, z: p.z + .9 }, d = dist(pet, heel);
    if (d > 6) Object.assign(pet, heel);
    else if (d > .6) this.step(pet, heel, d > 2.5 ? 6 : 3.4, dt);
  }

  updateMonster(m, dt, p) {
    const c = this.character;
    if (m.strike && (!m.alive || !c.alive || m.state !== 'chase')) this.cancelMonsterAttack(m);
    if (m.skillCast && m.state !== 'chase') for (const e of cancelBossSkill(m)) this.emit('boss-skill', { ...e, monster: m });
    if (m.state === 'dead' || m.state === 'dormant') {
      if (!this.isActive(m.spawn)) { m.state = 'dormant'; return; }
      if ((m.respawnTimer -= dt) <= 0 && !this.spawnMonster(m.spawn, m)) {
        m.state = 'dormant'; m.respawnTimer = m.spawn.respawn ?? RULES.monsterRespawn;
      }
      return;
    }
    // Out of its time: fade away once it is no longer fighting.
    if (!this.isActive(m.spawn) && m.state !== 'chase') {
      for (const e of cancelBossSkill(m)) this.emit('boss-skill', { ...e, monster: m });
      m.hp = 0; m.state = 'dormant'; m.debuffs = [];
      if (this.target === m) this.setTarget(null);
      this.emit('despawn', m);
      return;
    }
    m.debuffs = m.debuffs.filter(d => (d.remaining -= dt) > 0);
    const dot = m.debuffs.find(d => d.dot);
    if (dot && (m.dotTimer += dt) >= 1) {
      m.dotTimer = 0;
      const amount = Math.max(1, Math.round(dot.source * dot.dot));
      m.hp = Math.max(0, m.hp - amount);
      this.emit('hit', { monster: m, amount, dot: true, x: m.x, z: m.z });
      if (m.hp <= 0) { this.kill(m); return; }
    }
    m.attackTimer = Math.max(0, m.attackTimer - dt);
    m.moving = false;
    if (m.strike) {
      const valid = c.alive && m.state === 'chase' && !m.debuffs.some(d => d.stun)
        && dist(m, m.home) <= LEASH && dist(m, p) <= m.def.range;
      if (!valid) this.cancelMonsterAttack(m);
      else {
        const release = tickMonsterStrike(m, dt);
        if (release) this.releaseMonsterAttack(m, null, release.fx);
        return;
      }
    }
    if (m.debuffs.some(d => d.stun) && m.state !== 'return') {
      for (const e of cancelBossSkill(m)) this.emit('boss-skill', { ...e, monster: m });
      return;
    }   // stunned: no move, no attack
    const d = dist(m, p), fromHome = dist(m, m.home), speed = m.def.speed * m.speedFactor;

    if (m.state === 'idle') {
      if (c.alive && d < m.def.aggro && (m.def.elite || m.def.bold || m.level >= c.level - 2)) { m.state = 'chase'; this.emit('aggro', m); }
      else if ((m.wanderTimer -= dt) <= 0) {
        m.wanderTimer = rand(3, 7);
        const a = Math.random() * Math.PI * 2, r = Math.random() * Math.min(m.spawn.radius, RULES.wanderRadius);
        m.wanderTarget = { x: m.home.x + Math.cos(a) * r, z: m.home.z + Math.sin(a) * r };
      }
      if (m.wanderTarget) { if (this.step(m, m.wanderTarget, speed * .35, dt) < .2) m.wanderTarget = null; }
    } else if (m.state === 'chase') {
      // a rooted monster (speed 0: นางตะเคียน) cannot leash: it gives up once the player is well out of reach
      if (!c.alive || fromHome > LEASH || (!(m.def.speed > 0) && d > m.def.range * 2 + 4)) {
        for (const e of cancelBossSkill(m)) this.emit('boss-skill', { ...e, monster: m });
        m.state = 'return'; return;
      }
      const power = this.night && this.isGhost(m) ? NIGHT.ghostPower : 1;
      const skill = tickBossSkills(m, dt, p, [{ ...p, id: 'local', dead: !c.alive }], power);
      for (const e of skill.events) {
        if (e.t === 'mskill') this.emit('boss-skill', { ...e, monster: m });
        else if (e.t === 'ma') this.monsterAttack(m, null, { skill: e.skill, power: e.power });
      }
      if (skill.busy) return;
      if (d > m.def.range) this.step(m, p, speed, dt);
      else {
        m.facing = Math.atan2(p.x - m.x, p.z - m.z);
        if (m.attackTimer <= 0) this.monsterAttack(m);
      }
    } else if (m.state === 'return') {
      m.hp = Math.min(m.maxHp, m.hp + m.maxHp * dt * .5);
      if (this.step(m, m.home, speed * 1.3, dt) < .3) { m.state = 'idle'; m.hp = m.maxHp; }
    }
  }

  step(m, to, speed, dt) {
    const dx = to.x - m.x, dz = to.z - m.z, len = Math.hypot(dx, dz);
    if (len < 1e-3) return 0;
    const s = Math.min(len, speed * dt), nx = m.x + dx / len * s, nz = m.z + dz / len * s;
    m.facing = Math.atan2(dx, dz);
    if (this.world.canStand(nx, nz)) { m.x = nx; m.z = nz; m.moving = true; }
    else if (this.world.canStand(nx, m.z)) { m.x = nx; m.moving = true; }
    else if (this.world.canStand(m.x, nz)) { m.z = nz; m.moving = true; }
    return len - s;
  }

  // A monster's swing at the player. `res` is the server's result for a signed-in player
  // online ({ dodge } | { dmg, hp, mp }, src/net/NetCombat.js); otherwise it is rolled here.
  // fx: { knock, pull } from the server (offline a knock is rolled here); a landed hit also
  // poisons / drains MP (src/combat/monsterHit.js).
  monsterAttack(m, res = null, fx = null) {
    if (m.strike) return;
    m.attackTimer = m.def.attackDelay ?? (m.def.elite ? RULES.eliteAttackDelay : RULES.monsterAttackDelay);
    m.swungAtMe = Date.now();   // AUTO goes for the ones attacking us first (src/ui/autoSettings.js)
    this.combatTimer = COMBAT_TIMEOUT;
    if (!this.remote && !res && !fx?.skill && monsterAttackImpact(m.type) > 0) {
      beginMonsterStrike(m, { fx });
      this.emit('monster-attack', m);
      return;
    }
    this.emit('monster-attack', m);
    this.releaseMonsterAttack(m, res, fx);
  }

  cancelMonsterAttack(m) {
    if (cancelMonsterStrike(m)) this.emit('monster-attack-cancel', m);
  }

  cancelMonsterAttacks() {
    for (const m of this.monsters) this.cancelMonsterAttack(m);
  }

  releaseMonsterAttack(m, res = null, fx = null) {
    const c = this.character;
    const at = this.world.playerPos();
    if (m.def.ranged) this.emit('projectile', { from: { x: m.x, z: m.z }, target: { x: at.x, z: at.z }, color: m.def.ranged, duration: .3 });
    if (res ? res.dodge : Math.random() < c.evadeChance(m.def.acc ?? MONSTER_ACCURACY(m.def.level))) { this.emit('dodge', { x: this.world.playerPos().x, z: this.world.playerPos().z }); return; }
    let dealt;
    if (res) { c.hp = Math.max(1, Math.round(res.hp + res.dmg)); dealt = c.damage(res.hp > 0 ? res.dmg : c.hp); }   // land exactly on the server's HP
    else {
      const night = this.night && this.isGhost(m) ? NIGHT.ghostPower : 1;
      const raw = m.def.atk * monsterAttackMul(m) * (fx?.power ?? night) * rand(.85, 1.15) * (!fx?.skill && m.def.elite && Math.random() < RULES.eliteHeavyChance ? 1.8 : 1);
      dealt = c.damage(Math.max(1, (raw - c.defense * .4) * (1 - c.resist(m.def))));
    }
    const p = this.world.playerPos();
    this.emit('player-hit', { amount: dealt, x: p.x, z: p.z, monster: m });
    if (c.alive) {
      afterHit(c, m.def);
      if (res?.mp !== undefined) c.mp = Math.min(c.maxMp, res.mp);   // the server's drain
      const shove = fx ?? (m.def.knock && Math.random() < m.def.knock ? { knock: true } : null);
      const to = shove && shoveTo(m, p, shove, this.world.canStand);
      if (to) { p.x = to.x; p.z = to.z; this.emit('shoved', { monster: m, ...to, pull: !!shove.pull }); }
    }
    if (!c.alive) {
      this.autoAttack = false; this.pending = null; this.setTarget(null);
      for (const other of this.monsters) if (other.state === 'chase') other.state = 'return';
      this.emit('player-death', m);
    }
  }

  // Down at once (a GM's /gm hp 0, server/gm.js): the death screen, as if a monster did it.
  knockOut() {
    const c = this.character; if (!c.alive) return;
    c.fall(); c.emit('change');
    this.autoAttack = false; this.pending = null; this.setTarget(null);
    for (const other of this.monsters) if (other.state === 'chase') other.state = 'return';
    this.emit('player-death', null);
  }
  // Brought back where they fell (a healer's revive, src/net/Social.js): no gold lost.
  reviveHere(ratio) {
    if (this.character.alive) return false;
    this.character.revive(ratio); this.combatTimer = 0;
    this.emit('player-revived', { ratio });
    return true;
  }
  respawnPlayer() {
    this.setTarget(null);
    const lost = Math.floor(this.character.gold * RULES.deathGoldLoss);
    this.character.gold -= lost;
    this.character.revive(RULES.reviveRatio);
    this.combatTimer = 0;
    this.emit('player-respawn', { goldLost: lost });
  }
}
