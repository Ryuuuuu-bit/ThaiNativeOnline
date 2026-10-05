// Combat rules and monster AI on the XZ plane. No rendering: views listen to events.
import { MONSTERS, SKILLS, LOOT, SPAWNS, NIGHT } from './data.js';
import { Emitter } from './Character.js';

const rand = (a, b) => a + Math.random() * (b - a);
const randInt = (a, b) => Math.floor(rand(a, b + 1));
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const LEASH = 11, COMBAT_TIMEOUT = 5, PROJECTILE_SPEED = 16, GLOBAL_COOLDOWN = 1;

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
  constructor(character, world, spawns = SPAWNS) {
    super();
    this.character = character; this.world = world;
    this.monsters = []; this.target = null; this.autoAttack = false;
    this.pending = null; // { skillId, target } waiting to get in range
    this.attackTimer = 0; this.gcd = 0; this.combatTimer = 0; this.projectiles = [];
    this.phase = 'day';
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
  basicSkillId() { return this.character.cls.skills.find(id => SKILLS[id].basic); }

  useSkill(skillId) {
    const c = this.character, skill = SKILLS[skillId];
    if (!skill || !c.alive) return { ok: false };
    if (c.cooldowns[skillId] > 0) return this.fail('ยังใช้ไม่ได้');
    if (!skill.basic && this.gcd > 0) return { ok: false, reason: 'gcd' };
    if (c.mp < skill.mp) return this.fail('MP ไม่พอ');

    const needsTarget = skill.kind === 'damage' || skill.kind === 'debuff' || skill.kind === 'pet' || (skill.kind === 'aoe' && skill.around === 'target');
    if (needsTarget) {
      if (!this.target?.alive) this.cycleTarget();
      const target = this.target;
      if (!target) return this.fail('ไม่มีเป้าหมายใกล้ๆ');
      const range = this.skillRange(skill);
      if (dist(target, this.world.playerPos()) > range) {
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
    if (skill.cd) c.cooldowns[skillId] = skill.cd;
    if (skill.basic) this.attackTimer = c.cls.attackSpeed;
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
      for (const m of this.monsters) if (m.alive && dist(m, center) <= skill.radius) this.hitMonster(m, skill);
      return;
    }
    if (skill.projectile) {
      const delay = dist(p, target) / PROJECTILE_SPEED;
      this.projectiles.push({ target, skill, delay });
      this.emit('projectile', { from: { x: p.x, z: p.z }, target, color: skill.projectile, duration: delay });
    } else this.hitMonster(target, skill);
  }

  rollPlayerDamage(skill) {
    const c = this.character, scale = skill.scale ? c.stat(skill.scale) : 0;
    let dmg = (c.attack + scale * .6) * skill.power * rand(.88, 1.12);
    const crit = skill.alwaysCrit || Math.random() < c.critChance;
    if (crit) dmg *= 1.6;
    return { dmg, crit };
  }

  hitMonster(m, skill) {
    if (!m.alive) return;
    if (Math.random() < .05) { this.emit('miss', { x: m.x, z: m.z, monster: m }); this.aggro(m); return; }
    const { dmg, crit } = this.rollPlayerDamage(skill);
    const dealt = Math.max(1, Math.round(dmg - m.def.def * .7));
    m.hp = Math.max(0, m.hp - dealt);
    this.emit('hit', { monster: m, amount: dealt, crit, x: m.x, z: m.z });
    if (skill.debuff) { m.debuffs = m.debuffs.filter(d => d.id !== skill.debuff.id); m.debuffs.push({ ...skill.debuff, remaining: skill.debuff.duration, source: this.character.attack }); }
    if (m.hp <= 0) this.kill(m); else this.aggro(m);
  }

  aggro(m) { if (m.state !== 'return') m.state = 'chase'; this.combatTimer = COMBAT_TIMEOUT; }

  kill(m) {
    m.state = 'dead'; m.respawnTimer = m.spawn.respawn ?? 18; m.debuffs = [];
    const c = this.character, levelGap = m.level - c.level;
    const exp = Math.round(m.def.exp * Math.max(.2, 1 + levelGap * .1) * (this.night ? NIGHT.expBonus : 1));
    const gold = randInt(...m.def.gold);
    const drops = [];
    for (const [id, chance, min, max] of LOOT[m.def.loot] || []) if (Math.random() < chance) drops.push({ id, qty: randInt(min, max) });
    this.emit('kill', { monster: m, exp, gold, drops });
    c.gold += gold; c.gainExp(exp);
    for (const d of drops) c.addItem(d.id, d.qty);
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

    // Chase toward pending target, then fire.
    if (c.alive && this.pending) {
      const { skillId, target } = this.pending, skill = SKILLS[skillId];
      if (!target?.alive) this.pending = null;
      else {
        if (dist(target, p) <= this.skillRange(skill)) {
          this.world.stop?.();
          const waiting = skill.basic ? this.attackTimer > 0 : this.gcd > 0;
          if (!waiting) { this.pending = null; this.execute(skillId, target); }
        } else this.world.moveTo?.(target.x, target.z);
      }
    }
    // Auto attack keeps swinging at the current target while in range.
    if (c.alive && this.autoAttack && !this.pending && this.target?.alive && this.attackTimer <= 0) {
      const basic = this.basicSkillId();
      if (dist(this.target, p) <= c.cls.range) this.execute(basic, this.target);
      else this.pending = { skillId: basic, target: this.target };
    }

    for (const m of this.monsters) this.updateMonster(m, dt, p);
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
        if (pet.attackTimer <= 0) {
          pet.attackTimer = pet.frenzy > 0 ? .55 : 1.3;
          const skill = pet.pounce || { power: .35 };
          pet.pounce = null;
          const dealt = Math.max(1, Math.round(c.attack * skill.power * rand(.85, 1.15) - target.def.def * .5));
          target.hp = Math.max(0, target.hp - dealt);
          this.emit('pet-bite', { monster: target, amount: dealt });
          this.emit('hit', { monster: target, amount: dealt, pet: true, x: target.x, z: target.z });
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
    if (m.state === 'dead' || m.state === 'dormant') {
      if (!this.isActive(m.spawn)) { m.state = 'dormant'; return; }
      if ((m.respawnTimer -= dt) <= 0 && !this.spawnMonster(m.spawn, m)) {
        m.state = 'dormant'; m.respawnTimer = m.spawn.respawn ?? 18;
      }
      return;
    }
    // Out of its time: fade away once it is no longer fighting.
    if (!this.isActive(m.spawn) && m.state !== 'chase') {
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
    const d = dist(m, p), fromHome = dist(m, m.home), speed = m.def.speed * m.speedFactor;

    if (m.state === 'idle') {
      if (c.alive && d < m.def.aggro && (m.def.elite || m.level >= c.level - 2)) { m.state = 'chase'; this.emit('aggro', m); }
      else if ((m.wanderTimer -= dt) <= 0) {
        m.wanderTimer = rand(3, 7);
        const a = Math.random() * Math.PI * 2, r = Math.random() * m.spawn.radius;
        m.wanderTarget = { x: m.home.x + Math.cos(a) * r, z: m.home.z + Math.sin(a) * r };
      }
      if (m.wanderTarget) { if (this.step(m, m.wanderTarget, speed * .35, dt) < .2) m.wanderTarget = null; }
    } else if (m.state === 'chase') {
      if (!c.alive || fromHome > LEASH) { m.state = 'return'; return; }
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

  monsterAttack(m) {
    const c = this.character;
    m.attackTimer = m.def.elite ? 1.3 : 1.6;
    this.combatTimer = COMBAT_TIMEOUT;
    this.emit('monster-attack', m);
    if (Math.random() < c.dodge) { this.emit('dodge', { x: this.world.playerPos().x, z: this.world.playerPos().z }); return; }
    const night = this.night && this.isGhost(m) ? NIGHT.ghostPower : 1;
    const raw = m.def.atk * night * rand(.85, 1.15) * (m.def.elite && Math.random() < .25 ? 1.8 : 1);
    const dealt = c.damage(Math.max(1, raw - c.defense * .4));
    const p = this.world.playerPos();
    this.emit('player-hit', { amount: dealt, x: p.x, z: p.z, monster: m });
    if (!c.alive) {
      this.autoAttack = false; this.pending = null;
      for (const other of this.monsters) if (other.state === 'chase') other.state = 'return';
      this.emit('player-death', m);
    }
  }

  respawnPlayer() {
    const lost = Math.floor(this.character.gold * .1);
    this.character.gold -= lost;
    this.character.revive(.6);
    this.combatTimer = 0;
    this.emit('player-respawn', { goldLost: lost });
  }
}
