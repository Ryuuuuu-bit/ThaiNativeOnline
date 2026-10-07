// Shared monsters (phase 3a of docs/technical/SERVER_SPLIT.md): one set of monsters per
// map, run on the server so everyone on the map fights the same ones. The behaviour
// mirrors the browser's src/combat/Combat.js (wander → aggro → chase → attack → leash
// back home; respawn by the spawn's day/night times), but with many players: a monster
// goes for the nearest player who may be aggroed, or for whoever hits it.
//
// Pure (no sockets): server/index.js feeds it players and hits and sends what it returns.
//   const w = new MonsterWorld(mapId)
//   w.update(dt, players, phase) → events     players: [{ id, x, z, lv, dead }]
//   w.damage(m, playerId, amount, { crit, dot, pet }, players, night) → events   (blows rolled by server/combatants.js)
//   w.debuff(m, { id, stun?, slow?, dot?, source?, by?, remaining }) · w.aggro(m, playerId)
//   w.snapshot() → [[id, x, z, facing, hp, stateCode, moving], …] of monsters that changed
//   w.list() → every live monster in full (for a player arriving on the map)
// Events: { t: 'mspawn', m } · { t: 'mgone', id, killed } · { t: 'ma', id, to } (monster swings at
// player `to`) · { t: 'mh', id, amount, crit, dot, pet, by } · { t: 'kill', id, to, exp, gold, drops }
//
// Since 3b the damage is rolled on the server (server/combatants.js); still trusted from the
// browser: the player's own HP / defence (a monster's swing is resolved there). 3c keeps the rewards here.
import { MONSTERS, NIGHT } from '../src/combat/data/monsters.js';
import { LOOT } from '../src/combat/data/loot.js';
import { RULES } from '../src/combat/data/rules.js';
import { combatSpawns } from '../src/data/spawns.js';
import { mapOf } from '../src/world/maps.js';

const { leash: LEASH, wanderRadius: WANDER, monsterAttackDelay: ATTACK_DELAY, eliteAttackDelay: ELITE_DELAY, monsterRespawn: RESPAWN } = RULES;
const STATES = ['dormant', 'idle', 'chase', 'return', 'dead'];
const rand = (a, b, r = Math.random) => a + r() * (b - a);
const randInt = (a, b, r = Math.random) => Math.floor(rand(a, b + 1, r));
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const isActive = (spawn, phase) => (spawn.active ? spawn.active.includes(phase) : !spawn.time || spawn.time === 'any' || (spawn.time === 'night') === (phase === 'night'));
const isGhost = def => def.loot === 'spirit' || def.loot === 'rare';

let nextId = 1;
export class MonsterWorld {
  constructor(mapId, { random = Math.random, zones = combatSpawns().filter(z => mapOf(z.x, z.z) === mapId) } = {}) {
    this.map = mapId; this.r = random; this.monsters = [];
    for (const spawn of zones) for (let i = 0; i < (spawn.count ?? 1); i++) {
      const def = MONSTERS[spawn.type]; if (!def) continue;
      this.monsters.push({ get alive() { return this.hp > 0; }, id: nextId++, type: spawn.type, def, spawn, x: spawn.x, z: spawn.z, home: { x: spawn.x, z: spawn.z }, f: 0, hp: 0, maxHp: def.hp,
        state: 'dormant', respawn: rand(0, 2, random), attackTimer: 0, wanderTimer: rand(1, 4, random), wanderTarget: null, debuffs: [], dotTimer: 0, target: null, contrib: new Map(), moving: false, dirty: true });
    }
  }
  byId(id) { return this.monsters.find(m => m.id === id); }
  info(m) { return { id: m.id, type: m.type, x: round(m.x), z: round(m.z), f: round(m.f), hp: Math.round(m.hp), maxHp: m.maxHp, st: STATES.indexOf(m.state) }; }
  list() { return this.monsters.filter(m => m.hp > 0).map(m => this.info(m)); }
  snapshot() {
    const out = [];
    for (const m of this.monsters) if (m.dirty && m.hp > 0) { out.push([m.id, round(m.x), round(m.z), round(m.f), Math.round(m.hp), STATES.indexOf(m.state), m.moving ? 1 : 0]); m.dirty = false; }
    return out;
  }

  spawn(m) {
    if (m.spawn.chance && this.r() > m.spawn.chance) return false;
    const a = this.r() * Math.PI * 2, rr = Math.sqrt(this.r()) * (m.spawn.radius ?? 0);
    Object.assign(m, { x: m.spawn.x + Math.cos(a) * rr, z: m.spawn.z + Math.sin(a) * rr, hp: m.maxHp, state: 'idle', debuffs: [], attackTimer: 0, target: null, contrib: new Map(), dirty: true });
    m.home = { x: m.x, z: m.z };
    return true;
  }
  step(m, to, speed, dt) {
    const dx = to.x - m.x, dz = to.z - m.z, len = Math.hypot(dx, dz);
    if (len < 1e-3) return 0;
    const s = Math.min(len, speed * dt);
    m.x += dx / len * s; m.z += dz / len * s; m.f = Math.atan2(dx, dz); m.moving = true; m.dirty = true;
    return len - s;
  }

  update(dt, players, phase = 'day') {
    const ev = [], live = players.filter(p => !p.dead), night = phase === 'night';
    for (const m of this.monsters) {
      const wasMoving = m.moving; m.moving = false;
      if (m.state === 'dead' || m.state === 'dormant') {
        if (!isActive(m.spawn, phase)) { m.state = 'dormant'; continue; }
        if ((m.respawn -= dt) <= 0) {
          if (this.spawn(m)) ev.push({ t: 'mspawn', m: this.info(m) });
          else { m.state = 'dormant'; m.respawn = m.spawn.respawn ?? RESPAWN; }
        }
        continue;
      }
      // out of its time: fade away once it is not fighting
      if (!isActive(m.spawn, phase) && m.state !== 'chase') { m.hp = 0; m.state = 'dormant'; m.respawn = rand(.5, 3, this.r); ev.push({ t: 'mgone', id: m.id, killed: false }); continue; }
      m.debuffs = m.debuffs.filter(d => (d.remaining -= dt) > 0);
      const dot = m.debuffs.find(d => d.dot);
      if (dot && (m.dotTimer += dt) >= 1) {
        m.dotTimer = 0;
        const amount = Math.max(1, Math.round(dot.source * dot.dot));
        ev.push(...this.damage(m, dot.by, amount, { dot: true }, players, night));
        if (m.hp <= 0) continue;
      }
      m.attackTimer = Math.max(0, m.attackTimer - dt);
      if (m.debuffs.some(d => d.stun) && m.state !== 'return') { if (wasMoving) m.dirty = true; continue; }
      const speed = m.def.speed * (1 - Math.max(0, ...m.debuffs.map(d => d.slow || 0)));
      if (m.state === 'idle') {
        const near = live.filter(p => dist(m, p) < m.def.aggro && (m.def.elite || m.def.level >= p.lv - 2)).sort((a, b) => dist(m, a) - dist(m, b))[0];
        if (near) { m.state = 'chase'; m.target = near.id; m.dirty = true; }
        else {
          if ((m.wanderTimer -= dt) <= 0) {
            m.wanderTimer = rand(3, 7, this.r);
            const a = this.r() * Math.PI * 2, rr = this.r() * Math.min(m.spawn.radius ?? WANDER, WANDER);
            m.wanderTarget = { x: m.home.x + Math.cos(a) * rr, z: m.home.z + Math.sin(a) * rr };
          }
          if (m.wanderTarget && this.step(m, m.wanderTarget, speed * .35, dt) < .2) m.wanderTarget = null;
        }
      } else if (m.state === 'chase') {
        let tg = live.find(p => p.id === m.target);
        // the target left, died or ran: turn on whoever else hit it and is close, else go home
        if (!tg) { const other = live.filter(p => m.contrib.has(p.id) && dist(m, p) < LEASH).sort((a, b) => dist(m, a) - dist(m, b))[0]; if (other) { m.target = other.id; tg = other; } }
        if (!tg || dist(m, m.home) > LEASH) { m.state = 'return'; m.target = null; m.dirty = true; }
        else if (dist(m, tg) > m.def.range) this.step(m, tg, speed, dt);
        else {
          m.f = Math.atan2(tg.x - m.x, tg.z - m.z);
          if (m.attackTimer <= 0) {
            m.attackTimer = m.def.elite ? ELITE_DELAY : ATTACK_DELAY;
            ev.push({ t: 'ma', id: m.id, to: tg.id, power: night && isGhost(m.def) ? NIGHT.ghostPower : 1 });
          }
        }
      } else if (m.state === 'return') {
        m.hp = Math.min(m.maxHp, m.hp + m.maxHp * dt * .5); m.dirty = true;
        if (this.step(m, m.home, speed * 1.3, dt) < .3) { m.state = 'idle'; m.hp = m.maxHp; m.contrib.clear(); }
      }
      if (wasMoving !== m.moving) m.dirty = true;
    }
    return ev;
  }

  debuff(m, d) { m.debuffs = m.debuffs.filter(o => o.id !== d.id); m.debuffs.push(d); }
  aggro(m, playerId) { if (m.state !== 'return') { if (m.state !== 'chase') m.target = playerId; m.state = 'chase'; m.dirty = true; } }

  damage(m, by, amount, { crit = false, dot = false, pet = false } = {}, players = [], night = false) {
    m.hp = Math.max(0, m.hp - amount); m.dirty = true;
    if (by != null) m.contrib.set(by, (m.contrib.get(by) ?? 0) + amount);
    const ev = [{ t: 'mh', id: m.id, amount, crit, dot, pet, by }];
    if (m.hp > 0) { if (by != null) this.aggro(m, by); return ev; }
    m.state = 'dead'; m.respawn = m.spawn.respawn ?? RESPAWN; m.debuffs = []; m.target = null;
    ev.push({ t: 'mgone', id: m.id, killed: true });
    ev.push(...this.rewards(m, players, night));
    return ev;
  }
  // Everyone who did at least 15% of the damage gets the EXP (for their own level);
  // the top damager also gets the gold and the loot.
  rewards(m, players, night) {
    const total = [...m.contrib.values()].reduce((a, b) => a + b, 0) || 1;
    const ranked = [...m.contrib.entries()].sort((a, b) => b[1] - a[1]);
    const out = [];
    ranked.forEach(([id, dmg], i) => {
      const p = players.find(x => x.id === id);
      if (!p || (i > 0 && dmg / total < .15)) return;
      const exp = Math.round(m.def.exp * Math.max(.2, 1 + (m.def.level - p.lv) * .1) * (night ? NIGHT.expBonus : 1));
      const top = i === 0, drops = [];
      if (top) for (const [item, chance, min, max] of LOOT[m.def.loot] || []) if (this.r() < chance) drops.push({ id: item, qty: randInt(min, max, this.r) });
      out.push({ t: 'kill', id: m.id, to: id, exp, gold: top ? randInt(...m.def.gold, this.r) : 0, drops });
    });
    m.contrib = new Map();
    return out;
  }
}
const round = v => Math.round(v * 100) / 100;
