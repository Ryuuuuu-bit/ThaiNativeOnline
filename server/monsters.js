import { monsterAttackMul, sameStatusSource } from '../src/combat/statusEffects.js';
// Shared monsters (phase 3a of docs/technical/SERVER_SPLIT.md): one set of monsters per
// map, run on the server so everyone on the map fights the same ones. The behaviour
// mirrors the browser's src/combat/Combat.js (wander → aggro → chase → attack → leash
// back home; respawn by the spawn's day/night times), but with many players: a monster
// goes for the nearest player who may be aggroed, or for whoever hits it.
//
// Pure (no sockets): server/index.js feeds it players and hits and sends what it returns.
//   const w = new MonsterWorld(mapId, { elites? })   elites: false for CH 2+ (server/channels.js)
//   w.update(dt, players, phase) → events     players: [{ id, x, z, lv, dead }]
//   w.damage(m, playerId, amount, { crit, dot, pet }, players, night) → events   (blows rolled by server/combatants.js)
//   w.debuff(m, { id, stun?, slow?, dot?, label?, source?, by?, remaining }) → md event · w.aggro(m, playerId)
//   w.snapshot() → [[id, x, z, facing, hp, stateCode, moving], …] of monsters that changed
//   w.list() → every live monster in full (for a player arriving on the map)
// Events: { t: 'mspawn', m } · { t: 'mgone', id, killed } · { t: 'ma', id, to, power, knock?, pull? } (monster
// swings at player `to`; knock / pull: the player is thrown back / dragged in if it lands) ·
// { t: 'mh', id, amount, crit, dot, pet, by } · { t: 'md', id, d } (a stun / slow / damage over time landed) ·
// { t: 'kill', id, type, to, exp, gold, drops, card? }
// (card: the monster's card fell to the top damager, src/character/data/cards.js — server/index.js announces it)
//
// Monster behaviours (src/combat/data/monsters.js): passive ones never start a fight; flee runs
// from the blow for a moment; pack / callSpirits bring the neighbours in; charge dashes from
// 3.5–10 m for a heavier hit; speed 0 stands still (and, with pull, drags its target in from
// up to PULL_REACH m); attackDelay sets its own swing pace; summon calls minions (no respawn)
// as its HP drops. Poison, MP drain and shields are resolved by server/combatants.js.
//
// Since 3b the damage is rolled on the server (server/combatants.js); still trusted from the
// browser: the player's own HP / defence (a monster's swing is resolved there). 3c keeps the rewards here.
import { MONSTERS, NIGHT } from '../src/combat/data/monsters.js';
import { LOOT } from '../src/combat/data/loot.js';
import { RULES } from '../src/combat/data/rules.js';
import { combatSpawns } from '../src/data/spawns.js';
import { cardId, cardRate, hasCard } from '../src/character/data/cards.js';
import { mapOf } from '../src/world/maps.js';
import { PARTY, sharers, evenShare } from './parties.js';
import { killExp } from '../src/character/data/progression.js';
import { resetBossSkills, cancelBossSkill, tickBossSkills } from '../src/combat/bossSkills.js';
import { WORLD_BOSS, worldBossHp, worldBossTier, WORLD_BOSS_SKILLS, WORLD_BOSS_CAST } from '../src/combat/data/worldBoss.js';
// World bosses (`worldBoss` in src/combat/data/monsters.js, rules in src/combat/data/worldBoss.js):
// one rise a night (`w.online()` = players online, set by server/index.js, locks the HP), gone at
// dawn; twins linked by the red thread (heal, half damage) and rising again unless both fall within
// WORLD_BOSS.revive s. Events: { t: 'wb', state: 'fall' | 'rise' | 'down', type, mvp? } (server/index.js
// announces them) and one `kill` per player who did WORLD_BOSS.minShare of the damage.
// A world boss rises at the tier of the players on its map (worldBossTier: level, HP, swing power)
// and casts its skills (WORLD_BOSS_SKILLS), each warned first:
//   { t: 'wbcast', id, skill, spots: [{x, z, r}], warn } → after `warn` s { t: 'wbfx', id, skill, spots }
//   and { t: 'wbhit', id, to, pct, skill, knock? } for each player standing in a spot (a share of
//   their max HP, server/index.js resolves it) · bleeds tick as wbhit · pools: { t: 'wbzone', id, spots, secs }

const { leash: LEASH, wanderRadius: WANDER, monsterAttackDelay: ATTACK_DELAY, eliteAttackDelay: ELITE_DELAY, monsterRespawn: RESPAWN } = RULES;
const STATES = ['dormant', 'idle', 'chase', 'return', 'dead', 'flee'];
export const CHARGE = { min: 3.5, max: 10, speed: 3, power: 1.6, every: 6 };
export const FLEE = { secs: 2.5, every: 8 };
export const PULL_REACH = 14, PULL_EVERY = 5;
const ALWAYS = ['morning', 'day', 'evening', 'night'];
const rand = (a, b, r = Math.random) => a + r() * (b - a);
const randInt = (a, b, r = Math.random) => Math.floor(rand(a, b + 1, r));
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const isActive = (spawn, phase) => (spawn.active ? spawn.active.includes(phase) : !spawn.time || spawn.time === 'any' || (spawn.time === 'night') === (phase === 'night'));
const isGhost = def => def.loot === 'spirit' || def.loot === 'rare';
const swingDelay = def => def.attackDelay ?? (def.elite ? ELITE_DELAY : ATTACK_DELAY);

let nextId = 1;
export class MonsterWorld {
  constructor(mapId, { random = Math.random, elites = true, navigation = null, idleRadius = 0, zones = combatSpawns().filter(z => mapOf(z.x, z.z) === mapId) } = {}) {
    this.idleRadius=idleRadius; this.navigation = navigation; this.map = mapId; this.r = random; this.monsters = [];
    if (!elites) zones = zones.filter(z => !MONSTERS[z.type]?.elite && !MONSTERS[z.type]?.boss);
    for (const spawn of zones) for (let i = 0; i < (spawn.count ?? 1); i++) { const m = this.make(spawn); if (m) this.monsters.push(m); }
  }
  make(spawn) {
    const def = MONSTERS[spawn.type]; if (!def) return null;
    return { get alive() { return this.hp > 0; }, id: nextId++, type: spawn.type, def, spawn, x: spawn.x, z: spawn.z, home: { x: spawn.x, z: spawn.z }, f: 0, hp: 0, maxHp: def.hp,
      state: 'dormant', respawn: rand(0, 2, this.r), attackTimer: 0, wanderTimer: rand(1, 4, this.r), wanderTarget: null, debuffs: [], taunt: null, dotTimer: 0, target: null, contrib: new Map(), moving: false, dirty: true,
      chargeCd: 0, fleeCd: 0, pullCd: 0 };
  }
  byId(id) { return this.monsters.find(m => m.id === id); }
  info(m) { return { id: m.id, type: m.type, x: round(m.x), z: round(m.z), f: round(m.f), hp: Math.round(m.hp), maxHp: m.maxHp, st: STATES.indexOf(m.state), ...(m.skillCast ? { skillCast: { ...m.skillCast } } : {}), ...(m.tier ? { lv: m.tier.lv } : {}) }; }
  list() { return this.monsters.filter(m => m.hp > 0).map(m => this.info(m)); }
  snapshot() {
    const out = [];
    for (const m of this.monsters) if (m.dirty && m.hp > 0) { out.push([m.id, round(m.x), round(m.z), round(m.f), Math.round(m.hp), STATES.indexOf(m.state), m.moving ? 1 : 0]); m.dirty = false; }
    return out;
  }

  spawn(m) {
    if (m.spawn.chance && this.r() > m.spawn.chance) return false;
    if (m.def.worldBoss) {   // locked for this night: the tier of the players on the map, the HP of the players online
      m.tier = worldBossTier((this.seen ?? []).map(p => p.lv));
      m.maxHp = worldBossHp(m.def.hp * m.tier.hp, this.online?.() ?? 1);
      Object.assign(m, { cast: null, cds: {}, skillGap: WORLD_BOSS_CAST.gap });
    }
    const a = this.r() * Math.PI * 2, rr = Math.sqrt(this.r()) * (m.spawn.radius ?? 0);
    Object.assign(m, { x: m.spawn.x + Math.cos(a) * rr, z: m.spawn.z + Math.sin(a) * rr, hp: m.maxHp, state: 'idle', debuffs: [], taunt: null, attackTimer: 0, target: null, contrib: new Map(), dirty: true, charging: false, summonAt: null });
    if (this.navigation && !this.navigation.canStand(m.x, m.z)) {
      let found = false;
      for (let i = 0; i < 80; i++) { const a = this.r() * Math.PI * 2, r = this.r() * Math.max(6, m.spawn.radius ?? 6); const x = m.spawn.x + Math.cos(a) * r, z = m.spawn.z + Math.sin(a) * r; if (this.navigation.canStand(x, z)) { m.x = x; m.z = z; found = true; break; } }
      if (!found) { m.hp = 0; m.state = 'dormant'; return false; }
    }
    m.home = { x: m.x, z: m.z };
    resetBossSkills(m);
    return true;
  }
  step(m, to, speed, dt) {
    if (!(speed > 0)) return Math.hypot(to.x - m.x, to.z - m.z);   // rooted (a tree spirit)
    const dx = to.x - m.x, dz = to.z - m.z, len = Math.hypot(dx, dz);
    if (len < 1e-3) return 0;
    const s = Math.min(len, speed * dt);
    const next = { x: m.x + dx / len * s, z: m.z + dz / len * s };
    if (!this.navigation || this.navigation.clear(m, next)) { m.x = next.x; m.z = next.z; }
    else if (this.navigation.clear(m, { x: next.x, z: m.z })) m.x = next.x;
    else if (this.navigation.clear(m, { x: m.x, z: next.z })) m.z = next.z;
    else return len; m.f = Math.atan2(dx, dz); m.moving = true; m.dirty = true;
    return Math.hypot(to.x - m.x, to.z - m.z);
  }

  update(dt, players, phase = 'day') {
    const ev = [], live = players.filter(p => !p.dead), night = phase === 'night';
    this.seen = players;
    if (this.wbZones?.length || this.wbDots?.length) this.worldBossAreas(dt, live, ev);
    for (const m of this.monsters) {
      if (m.skillCast && m.state !== 'chase') ev.push(...cancelBossSkill(m));
      const wasMoving = m.moving; m.moving = false;
      if (m.spawn.summoned && (m.state === 'dead' || m.state === 'dormant')) { m.gone = true; continue; }   // minions do not come back
      if (m.hp > 0) m.debuffs = m.debuffs.filter(d => (d.remaining -= dt) > 0);
      if (m.taunt) {
        const forced = live.find(p => p.id === m.taunt.by && dist(m, p) <= LEASH);
        if (!forced || m.state === 'return' || dist(m, m.home) > LEASH || !m.debuffs.some(d => d.taunt && d.remaining > 0)) {
          const prior = live.find(p => p.id === m.taunt.previous && dist(m, p) <= LEASH);
          if (prior) m.target = prior.id;
          m.debuffs = m.debuffs.filter(d => !d.taunt);
          m.taunt = null;
        } else m.target = forced.id;
      }
      if (m.def.worldBoss && this.worldBossStep(m, dt, night, ev, live)) continue;
      if (m.state === 'dead' || m.state === 'dormant') {
        if (!isActive(m.spawn, phase)) { m.state = 'dormant'; continue; }
        if ((m.respawn -= dt) <= 0) {
          if (this.spawn(m)) ev.push({ t: 'mspawn', m: this.info(m) });
          else { m.state = 'dormant'; m.respawn = m.spawn.respawn ?? RESPAWN; }
        }
        continue;
      }
      // out of its time: fade away once it is not fighting
      if (!isActive(m.spawn, phase) && m.state !== 'chase') { m.hp = 0; m.state = 'dormant'; m.debuffs = []; m.taunt = null; m.respawn = rand(.5, 3, this.r); ev.push({ t: 'mgone', id: m.id, killed: false }); continue; }
      if(this.idleRadius && m.state==='idle' && !m.debuffs.length && live.every(p=>dist(m,p)>this.idleRadius)){m.wanderTarget=null;if(wasMoving)m.dirty=true;continue;}
      const dot = m.debuffs.find(d => d.dot);
      if (dot && (m.dotTimer += dt) >= 1) {
        m.dotTimer = 0;
        const amount = Math.max(1, Math.round(dot.source * dot.dot));
        ev.push(...this.damage(m, dot.by, amount, { dot: true }, players, night));
        if (m.hp <= 0) continue;
      }
      m.attackTimer = Math.max(0, m.attackTimer - dt);
      m.chargeCd = Math.max(0, m.chargeCd - dt); m.fleeCd = Math.max(0, m.fleeCd - dt); m.pullCd = Math.max(0, m.pullCd - dt);
      if (m.debuffs.some(d => d.stun) && m.state !== 'return') { ev.push(...cancelBossSkill(m)); m.charging = false; if (wasMoving) m.dirty = true; continue; }
      const rage = m.enraged ? WORLD_BOSS.rage : null;   // a world boss gone berserk
      const def = m.def, speed = def.speed * (rage?.speed ?? 1) * (1 - Math.max(0, ...m.debuffs.map(d => d.slow || 0)));
      const power = monsterAttackMul(m) * (night && isGhost(def) ? NIGHT.ghostPower : 1) * (rage?.power ?? 1);
      if (m.state === 'flee') {
        // run from the blow, then turn and fight
        const from = m.fleeFrom, dx = m.x - from.x, dz = m.z - from.z, len = Math.hypot(dx, dz) || 1;
        this.step(m, { x: m.x + dx / len * 4, z: m.z + dz / len * 4 }, speed * 1.15, dt);
        if ((m.fleeT -= dt) <= 0 || dist(m, m.home) > LEASH) { m.state = dist(m, m.home) > LEASH ? 'return' : 'chase'; m.dirty = true; }
      } else if (m.state === 'idle') {
        const near = def.passive ? null : live.filter(p => dist(m, p) < def.aggro && (def.elite || def.bold || def.level >= p.lv - 2)).sort((a, b) => dist(m, a) - dist(m, b))[0];
        if (near) { m.state = 'chase'; m.target = near.id; m.dirty = true; this.rally(m, near.id); }
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
        const d = tg && dist(m, tg), rooted = !(def.speed > 0);
        if (!tg || dist(m, m.home) > LEASH || (rooted && d > PULL_REACH + 2)) { ev.push(...cancelBossSkill(m)); m.state = 'return'; m.target = null; m.charging = false; m.dirty = true; }
        else {
          const mayCast = m.skillCast || !this.navigation || this.navigation.clear(m, tg, .05);
          const skill = mayCast ? tickBossSkills(m, dt, tg, live, power) : { busy: false, events: [] };
          ev.push(...skill.events);
          if (skill.busy) { m.charging = false; m.f = m.skillCast?.facing ?? m.f; if (wasMoving) m.dirty = true; continue; }
          if (d > def.range) {
            if (rooted) {
              // a rooted monster lashes out and drags its target in
              if (def.pull && m.pullCd <= 0 && d <= PULL_REACH) {
                m.pullCd = PULL_EVERY; m.attackTimer = swingDelay(def); m.f = Math.atan2(tg.x - m.x, tg.z - m.z); m.dirty = true;
                ev.push({ t: 'ma', id: m.id, to: tg.id, power, pull: 1 });
              }
            } else {
              if (def.charge && !m.charging && m.chargeCd <= 0 && d >= CHARGE.min && d <= CHARGE.max) m.charging = true;
              this.step(m, tg, speed * (m.charging ? CHARGE.speed : 1), dt);
            }
          } else {
            m.f = Math.atan2(tg.x - m.x, tg.z - m.z);
            if (m.charging) { m.charging = false; m.chargeCd = CHARGE.every; m.attackTimer = 0; m.charged = true; }
            if (m.attackTimer <= 0) {
              const charged = m.charged; m.charged = false;
              m.attackTimer = swingDelay(def) * (rage?.swing ?? 1);
              ev.push({ t: 'ma', id: m.id, to: tg.id, power: power * (m.tier?.atk ?? 1) * (charged ? CHARGE.power : 1), ...(def.knock && this.r() < def.knock ? { knock: 1 } : {}) });
            }
          }
        }
      } else if (m.state === 'return') {
        m.hp = Math.min(m.maxHp, m.hp + m.maxHp * dt * .5); m.dirty = true;
        if (this.step(m, m.home, speed * 1.3, dt) < .3) { m.state = 'idle'; m.hp = m.maxHp; m.contrib.clear(); ev.push(...this.dismiss(m)); }   // its summons stay spent (summonAt) until it dies: no farming the minions by pulling it home
      }
      if (wasMoving !== m.moving) m.dirty = true;
    }
    if (this.monsters.some(m => m.gone)) this.monsters = this.monsters.filter(m => !m.gone);
    return ev;
  }

  // pack / callSpirits: neighbours that are standing about join the fight on the same player
  rally(m, playerId) {
    const r = m.def.pack ?? m.def.callSpirits; if (!r) return;
    for (const o of this.monsters) {
      if (o === m || o.hp <= 0 || o.state !== 'idle' || dist(o, m) > r) continue;
      if (m.def.pack ? o.type === m.type : isGhost(o.def)) { o.state = 'chase'; o.target = playerId; o.dirty = true; }
    }
  }
  // summon: minions come out as the HP crosses each share in `at`
  summon(m, by) {
    const sm = m.def.summon; if (!sm || m.hp <= 0) return [];
    m.summonAt ??= [...sm.at].sort((a, b) => b - a);
    const ev = [];
    while (m.summonAt.length && m.hp / m.maxHp <= m.summonAt[0]) {
      m.summonAt.shift();
      for (let i = 0; i < sm.count; i++) {
        const o = this.make({ type: sm.type, x: m.x, z: m.z, radius: 3, active: ALWAYS, summoned: true, by: m.id });
        if (!o || !this.spawn(o)) continue;
        if (by != null) { o.state = 'chase'; o.target = by; }
        this.monsters.push(o); ev.push({ t: 'mspawn', m: this.info(o) });
      }
    }
    return ev;
  }
  // a summoner going home (or down) takes its minions with it
  dismiss(m) {
    const ev = [];
    for (const o of this.monsters) if (o.spawn.summoned && o.spawn.by === m.id && o.hp > 0) { o.hp = 0; o.state = 'dead'; o.debuffs = []; ev.push({ t: 'mgone', id: o.id, killed: false }); }
    return ev;
  }

  // → the event that shows it to the players on the map ({ t: 'md', id, d: { id, stun, slow, dot, label, secs } })
  debuff(m, d) {
    if (d.taunt) {
      if (m.state === 'return' || m.hp <= 0) return { t: 'md', id: m.id, d: { id: d.id, secs: 0 } };
      d = { ...d, remaining: Math.min(m.def.boss ? 2 : 8, d.remaining) };
      m.taunt = { by: d.by, previous: m.taunt?.previous ?? m.target };
      m.target = d.by; m.state = 'chase'; m.dirty = true;
    }
    m.debuffs = m.debuffs.filter(o => !sameStatusSource(o, d)); m.debuffs.push(d);
    return { t: 'md', id: m.id, d: { id: d.id, by: d.by, sourceSkill: d.sourceSkill, stun: !!d.stun, slow: d.slow || 0, dot: d.dot || 0, armorBreak: d.armorBreak || 0, weak: d.weak || 0, taunt: !!d.taunt, ...(d.label ? { label: d.label } : {}), secs: d.remaining } };
  }
  aggro(m, playerId) {
    if (m.state === 'return' || m.state === 'flee') return;
    if (m.state !== 'chase') { m.target = playerId; this.rally(m, playerId); }
    m.state = 'chase'; m.dirty = true;
  }

  damage(m, by, amount, { crit = false, dot = false, pet = false } = {}, players = [], night = false) {
    if (m.def.worldBoss && this.linked(m)) amount = Math.max(1, Math.round(amount * WORLD_BOSS.link.taken));
    const removed = Math.min(m.hp, Math.max(0, amount));
    m.hp = Math.max(0, m.hp - amount); m.dirty = true;
    if (by != null) m.contrib.set(by, (m.contrib.get(by) ?? 0) + removed);
    const ev = [{ t: 'mh', id: m.id, amount, crit, dot, pet, by }];
    if (m.hp > 0) {
      if (by == null) return ev;
      const from = players.find(p => p.id === by);
      if (m.def.flee && !dot && m.fleeCd <= 0 && from && m.state !== 'return') {
        Object.assign(m, { state: 'flee', fleeT: FLEE.secs, fleeCd: FLEE.every, fleeFrom: { x: from.x, z: from.z }, target: by, charging: false });
        this.rally(m, by);
      } else this.aggro(m, by);
      ev.push(...this.summon(m, by));
      return ev;
    }
    m.state = 'dead'; m.respawn = m.spawn.respawn ?? RESPAWN; m.debuffs = []; m.taunt = null; m.target = null; m.charging = false;
    ev.push(...cancelBossSkill(m));
    ev.push({ t: 'mgone', id: m.id, killed: true });
    if (m.def.worldBoss) { ev.push(...this.worldBossFall(m, players, night)); return ev; }
    ev.push(...this.dismiss(m));
    ev.push(...this.rewards(m, players, night));
    return ev;
  }
  // ---- world bosses ----
  twin(m) { const t = m.def.worldBoss?.twin; return t ? this.monsters.find(o => o.type === t) ?? null : null; }
  linked(m) { const o = this.twin(m); return !!o && o.hp > 0 && m.hp > 0 && dist(m, o) <= WORLD_BOSS.link.range; }
  // Before the usual step: true when this monster is done for the frame.
  worldBossStep(m, dt, night, ev, live = []) {
    if (!night) {   // dawn: whatever still stands fades, and the next night is a new round
      if (m.hp > 0) { m.hp = 0; ev.push({ t: 'mgone', id: m.id, killed: false }); ev.push(...this.dismiss(m)); }
      this.wbZones = []; this.wbDots = [];
      Object.assign(m, { state: 'dormant', wbDone: false, revive: null, enraged: false, cast: null, respawn: rand(.5, 3, this.r), debuffs: [], taunt: null, target: null, contrib: new Map() });
      return true;
    }
    if (m.state === 'dead' || m.state === 'dormant') {
      if (m.revive != null) {   // the twin still stands: rise again unless it falls first
        if ((m.revive -= dt) > 0) return true;
        const o = this.twin(m);
        Object.assign(m, { revive: null, enraged: false, cast: null, hp: Math.round(m.maxHp * WORLD_BOSS.reviveHp), state: o?.target != null ? 'chase' : 'idle', target: o?.target ?? null, debuffs: [], taunt: null, attackTimer: 0, dirty: true });
        ev.push({ t: 'mspawn', m: this.info(m) }, { t: 'wb', state: 'rise', type: m.type });
        return true;
      }
      return !!m.wbDone;   // risen and put down this night already
    }
    if (!m.enraged && m.hp < m.maxHp * WORLD_BOSS.rage.at) { m.enraged = true; ev.push({ t: 'wb', state: 'rage', type: m.type }); }
    if (this.linked(m) && m.hp < m.maxHp) { m.hp = Math.min(m.maxHp, m.hp + m.maxHp * WORLD_BOSS.link.heal * dt); m.dirty = true; }
    return this.worldBossCast(m, dt, ev, live);
  }
  // Skills: a cast holds her still for its warning, then lands; between casts she fights as usual.
  worldBossCast(m, dt, ev, live) {
    if (m.cast) { if ((m.cast.t -= dt) <= 0) this.worldBossLand(m, ev, live); return true; }
    for (const k of Object.keys(m.cds ?? {})) m.cds[k] -= dt;
    if ((m.skillGap -= dt) > 0 || m.state !== 'chase' || !live.length) return false;
    const near = live.filter(p => dist(m, p) <= WORLD_BOSS_CAST.reach), tg = live.find(p => p.id === m.target);
    if (!near.length) return false;
    const twin = this.twin(m), share = m.hp / m.maxHp, rage = m.enraged ? WORLD_BOSS.rage.swing : 1;
    const ready = (WORLD_BOSS_SKILLS[m.type] ?? []).filter(s => (m.cds[s.id] ?? 0) <= 0 && (s.below == null || share < s.below)
      && (s.at !== 'twin' || (twin?.hp > 0 && dist(m, twin) > WORLD_BOSS.link.range + 2))
      && (s.at !== 'target' || tg) && (s.at !== 'far' || near.some(p => dist(m, p) > 5)));
    if (!ready.length) return false;
    const s = ready[Math.floor(this.r() * ready.length)];
    m.cds[s.id] = s.cd * rage; m.skillGap = WORLD_BOSS_CAST.gap * rage;
    if (s.at === 'twin') {   // the elder vanishes and comes out beside her sister: the thread is whole again
      const from = { x: round(m.x), z: round(m.z) }, a = this.r() * Math.PI * 2;
      const to = { x: twin.x + Math.cos(a) * 1.6, z: twin.z + Math.sin(a) * 1.6 };
      if (!this.navigation || this.navigation.canStand(to.x, to.z)) { m.x = to.x; m.z = to.z; m.home = { ...to }; m.dirty = true; }
      ev.push({ t: 'wbfx', id: m.id, skill: s.id, spots: [{ ...from, r: 1 }, { x: round(m.x), z: round(m.z), r: 1 }] });
      return true;
    }
    const spot = (x, z) => ({ x: round(x), z: round(z), r: s.r });
    const far = () => near.reduce((a, p) => (dist(m, p) > dist(m, a) ? p : a));
    const spots = s.at === 'target' ? [spot(tg.x, tg.z)]
      : s.at === 'far' ? [(p => spot(p.x, p.z))(far())]
      : s.at === 'each' ? near.map(p => spot(p.x, p.z))
      : s.at === 'around' ? Array.from({ length: s.n ?? 3 }, (_, i) => { const a = i / (s.n ?? 3) * Math.PI * 2 + this.r(), d = 1.5 + this.r() * 3; return spot(m.x + Math.cos(a) * d, m.z + Math.sin(a) * d); })
      : [spot(m.x, m.z)];
    m.cast = { s, spots, t: s.warn };
    m.f = Math.atan2(spots[0].x - m.x, spots[0].z - m.z); m.moving = false; m.dirty = true;
    ev.push({ t: 'wbcast', id: m.id, skill: s.id, spots, warn: s.warn });
    return true;
  }
  worldBossLand(m, ev, live) {
    const { s, spots } = m.cast; m.cast = null;
    if (s.at === 'far') {   // the pounce carries her there
      const to = spots[0]; if (!this.navigation || this.navigation.canStand(to.x, to.z)) { m.x = to.x; m.z = to.z; m.dirty = true; }
    }
    ev.push({ t: 'wbfx', id: m.id, skill: s.id, spots });
    const hit = new Set();
    for (const sp of spots) for (const p of live) if (!hit.has(p.id) && Math.hypot(p.x - sp.x, p.z - sp.z) <= sp.r) {
      hit.add(p.id);
      if (s.pct) ev.push({ t: 'wbhit', id: m.id, to: p.id, pct: s.pct * monsterAttackMul(m) * (m.enraged ? WORLD_BOSS.rage.power : 1), skill: s.id, ...(s.knock ? { knock: 1 } : {}) });
      if (s.bleed) (this.wbDots ??= []).push({ id: m.id, to: p.id, pct: s.bleed.pct * monsterAttackMul(m), left: s.bleed.secs, tick: 1, skill: s.id });
    }
    if (s.pool) {
      (this.wbZones ??= []).push(...spots.map(sp => ({ ...sp, id: m.id, pct: s.pool.pct * monsterAttackMul(m), left: s.pool.secs, tick: 1, skill: s.id })));
      ev.push({ t: 'wbzone', id: m.id, skill: s.id, spots, secs: s.pool.secs });
    }
  }
  // Pools and bleeds tick once a second.
  worldBossAreas(dt, live, ev) {
    for (const z of this.wbZones ?? []) {
      z.left -= dt;
      if ((z.tick -= dt) <= 0) { z.tick = 1; for (const p of live) if (Math.hypot(p.x - z.x, p.z - z.z) <= z.r) ev.push({ t: 'wbhit', id: z.id, to: p.id, pct: z.pct, skill: z.skill, dot: 1 }); }
    }
    for (const d of this.wbDots ?? []) {
      d.left -= dt;
      if ((d.tick -= dt) <= 0) { d.tick = 1; if (live.some(p => p.id === d.to)) ev.push({ t: 'wbhit', id: d.id, to: d.to, pct: d.pct, skill: d.skill, dot: 1 }); }
    }
    this.wbZones = (this.wbZones ?? []).filter(z => z.left > 0); this.wbDots = (this.wbDots ?? []).filter(d => d.left > 0);
  }
  // One sister down: the other has WORLD_BOSS.revive s. Both down: the round is won.
  worldBossFall(m, players, night) {
    m.respawn = 1e9;
    const o = this.twin(m);
    if (o && o.hp > 0) { m.revive = WORLD_BOSS.revive; return [{ t: 'wb', state: 'fall', type: m.type }]; }
    const all = [m, o].filter(Boolean);
    for (const b of all) { b.revive = null; b.wbDone = true; }
    return this.worldBossRewards(all, players, night);
  }
  // Everyone who did WORLD_BOSS.minShare of the damage to the boss (both twins together) is paid:
  // EXP for their own level, gold and a roll of the loot table by rank (top, 2nd–3rd, the rest).
  worldBossRewards(bosses, players, night) {
    const contrib = new Map();
    for (const b of bosses) { for (const [id, d] of b.contrib) contrib.set(id, (contrib.get(id) ?? 0) + d); b.contrib = new Map(); }
    const total = [...contrib.values()].reduce((a, d) => a + d, 0) || 1;
    const ranked = [...contrib].filter(([, d]) => d / total >= WORLD_BOSS.minShare).sort((a, b) => b[1] - a[1]);
    const nightMul = night ? NIGHT.expBonus : 1, out = [], head = bosses[0];
    ranked.forEach(([id, dmg], i) => {
      const p = players.find(x => x.id === id); if (!p) return;
      const tier = i === 0 ? 0 : i < 3 ? 1 : 2, drops = [];
      let exp = 0, gold = 0, card = null;
      for (const b of bosses) {
        exp += Math.round(killExp(b.def.exp, p.lv, b.tier?.lv ?? b.def.level, true, nightMul) * (b.tier?.hp ?? 1));
        gold += Math.round(randInt(...b.def.gold, this.r) * WORLD_BOSS.goldShare[tier]);
        for (const [item, chance, min, max] of LOOT[b.def.loot] || []) if (this.r() < chance * WORLD_BOSS.lootChance[tier]) drops.push({ id: item, qty: randInt(min, max, this.r) });
        if (!card && i === 0 && hasCard(b.type) && this.r() < cardRate(b.def)) { card = cardId(b.type); drops.push({ id: card, qty: 1 }); }
      }
      out.push({ t: 'kill', id: head.id, type: head.type, to: id, exp, gold, drops, share: +(dmg / total).toFixed(3), ...(card ? { card } : {}) });
    });
    out.push({ t: 'wb', state: 'down', type: head.type, mvp: ranked[0]?.[0] ?? null });
    return out;
  }

  // Everyone who did at least 15% of the damage gets the EXP (for their own level);
  // the top damager also gets the gold and the loot. A party (server/parties.js, set as
  // `this.party = { of, members }`) counts as one hunter: its nearby members share the EXP
  // evenly (with a bonus a member) and its top damager takes the loot.
  rewards(m, players, night) {
    const party = this.party, pidOf = id => party?.of(id) ?? null;
    const units = new Map();
    for (const [id, dmg] of m.contrib) {
      const pid = pidOf(id), key = pid ? `p${pid}` : `s${id}`;
      const u = units.get(key) ?? { pid, dmg: 0, ids: [], top: null, topDmg: -1 };
      u.dmg += dmg; u.ids.push(id); if (dmg > u.topDmg) { u.top = id; u.topDmg = dmg; }
      units.set(key, u);
    }
    const total = [...units.values()].reduce((a, u) => a + u.dmg, 0) || 1;
    const ranked = [...units.values()].sort((a, b) => b.dmg - a.dmg);
    const nightMul = night ? NIGHT.expBonus : 1, big = !!(m.def.elite || m.def.boss), solo = p => killExp(m.def.exp, p.lv, m.def.level, big, nightMul);
    const out = [];
    ranked.forEach((u, i) => {
      if (i > 0 && u.dmg / total < .15) return;
      let paid;
      if (u.pid) {
        const share = sharers(party.members(u.pid), players, m);
        if (evenShare(share)) {
          const mul = (1 + PARTY.bonus * (share.length - 1)) / share.length;
          paid = share.map(p => ({ p, exp: killExp(m.def.exp, p.lv, m.def.level, big, nightMul * mul) }));
        } else paid = u.ids.map(id => players.find(x => x.id === id)).filter(Boolean).map(p => ({ p, exp: solo(p) }));
      } else { const p = players.find(x => x.id === u.top); paid = p ? [{ p, exp: solo(p) }] : []; }
      const lootTo = players.find(x => x.id === u.top);
      if (lootTo && !paid.some(x => x.p === lootTo)) paid.push({ p: lootTo, exp: 0 });
      const top = i === 0, drops = [];
      let card = null, gold = 0;
      if (top && lootTo) {
        for (const [item, chance, min, max] of LOOT[m.def.loot] || []) if (this.r() < chance) drops.push({ id: item, qty: randInt(min, max, this.r) });
        if (hasCard(m.type) && this.r() < cardRate(m.def)) { card = cardId(m.type); drops.push({ id: card, qty: 1 }); }
        gold = randInt(...m.def.gold, this.r);
      }
      for (const { p, exp } of paid) {
        const mine = p === lootTo;
        out.push({ t: 'kill', id: m.id, type: m.type, to: p.id, exp, gold: mine ? gold : 0, drops: mine ? drops : [], ...(mine && card ? { card } : {}), ...(u.pid ? { party: true } : {}) });
      }
    });
    m.contrib = new Map();
    return out;
  }
}
const round = v => Math.round(v * 100) / 100;
