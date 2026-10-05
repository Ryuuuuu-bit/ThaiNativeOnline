// Combat rules without rendering: player resources, abilities, targeting,
// enemy AI, death and respawn. No three.js — testable under `node --test`.
// The Three.js layer (../index.js) wraps this and listens to its events.
import { abilities as defaultAbilities, GLOBAL_COOLDOWN } from '../data/abilities.js';
import { enemyDefs as defaultEnemyDefs } from '../data/enemies.js';
import { spawns as defaultSpawns, PLAYER_START, PLAYER_RESPAWN_DELAY } from '../data/spawns.js';
import { computeDamage, distance, restore, spend, clamp } from './math.js';
import { createCooldownTracker } from './cooldowns.js';
import { createEnemyState, killEnemy, stepEnemy, ENEMY_RADIUS } from './ai.js';

export const DEFAULT_PLAYER_STATS = { maxHp: 150, maxMp: 60, attack: 15, defense: 4, moveSpeed: 3.1 };
const MP_REGEN = 2.5;            // per second, always
const HP_REGEN = 3;              // per second, only out of combat
const OUT_OF_COMBAT_AFTER = 6;   // seconds without dealing/taking damage
const PLAYER_CRIT = 0.1;
const TAB_RANGE = 14;            // cycleTarget considers enemies this close
const DROP_TARGET_RANGE = 25;    // target is cleared when the player gets this far away

/** Find the closest standable point to (x, z) by spiralling outwards. */
export function findStandable(x, z, canStand, radius = ENEMY_RADIUS, maxRadius = 4) {
  if (canStand(x, z, radius)) return { x, z };
  for (let r = 0.5; r <= maxRadius; r += 0.5) {
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
      if (canStand(px, pz, radius)) return { x: px, z: pz };
    }
  }
  return null;
}

export function createEmitter() {
  const handlers = new Map();
  return {
    on(event, fn) {
      if (!handlers.has(event)) handlers.set(event, new Set());
      handlers.get(event).add(fn);
      return () => handlers.get(event)?.delete(fn);
    },
    emit(event, payload) {
      for (const fn of handlers.get(event) ?? []) fn(payload);
    },
  };
}

/**
 * @param opts.getPlayerPosition () => { x, z }  live position (e.g. player.group.position)
 * @param opts.setPlayerPosition (x, z) => void  used on respawn
 * @param opts.canStand (x, z, radius) => boolean
 */
export function createCombatCore({
  playerStats = DEFAULT_PLAYER_STATS,
  getPlayerPosition,
  setPlayerPosition = () => {},
  canStand = () => true,
  abilities = defaultAbilities,
  enemyDefs = defaultEnemyDefs,
  spawns = defaultSpawns,
  playerStart = PLAYER_START,
  respawnDelay = PLAYER_RESPAWN_DELAY,
  rng = Math.random,
} = {}) {
  const stats = { ...DEFAULT_PLAYER_STATS, ...playerStats };
  const emitter = createEmitter();
  const cooldowns = createCooldownTracker();
  const playerState = {
    hp: stats.maxHp, maxHp: stats.maxHp, mp: stats.maxMp, maxMp: stats.maxMp,
    attack: stats.attack, defense: stats.defense,
    dead: false, respawnIn: 0, exp: 0, inCombat: false,
  };
  let target = null;
  let sinceCombat = Infinity;
  const pendingHits = []; // { delay, ability, enemy }

  const enemies = [];
  for (const spawn of spawns) {
    const def = enemyDefs[spawn.enemy];
    if (!def) continue;
    const home = findStandable(spawn.x, spawn.z, canStand);
    if (home) enemies.push(createEnemyState(def, home, rng));
  }

  const playerPos = () => {
    const p = getPlayerPosition();
    return { x: p.x, z: p.z, dead: playerState.dead };
  };
  const playerChanged = () => emitter.emit('playerChanged', playerState);
  const markCombat = () => { sinceCombat = 0; playerState.inCombat = true; };

  function selectTarget(enemy) {
    const next = enemy && enemy.alive ? enemy : null;
    if (next === target) return target;
    target = next;
    emitter.emit('targetChanged', target);
    return target;
  }

  function nearestEnemy(maxRange, exclude = null) {
    const p = playerPos();
    let best = null, bestD = Infinity;
    for (const e of enemies) {
      if (!e.alive || e === exclude) continue;
      const d = distance(p, e);
      if (d <= maxRange && d < bestD) { best = e; bestD = d; }
    }
    return best;
  }

  /** Tab targeting: alive enemies within TAB_RANGE ordered by distance; advance past current. */
  function cycleTarget() {
    const p = playerPos();
    const list = enemies.filter(e => e.alive && distance(p, e) <= TAB_RANGE)
      .sort((a, b) => distance(p, a) - distance(p, b));
    if (!list.length) return selectTarget(null);
    const index = list.indexOf(target);
    return selectTarget(list[(index + 1) % list.length]);
  }

  function damageEnemy(enemy, ability) {
    if (!enemy.alive) return;
    const { amount, crit } = computeDamage({
      attack: playerState.attack, multiplier: ability.multiplier, defense: enemy.def.defense,
      critChance: PLAYER_CRIT, rng,
    });
    enemy.hp = clamp(enemy.hp - amount, 0, enemy.maxHp);
    enemy.provoked = true;
    markCombat();
    emitter.emit('damage', { source: 'player', targetKind: 'enemy', enemy, amount, crit, abilityId: ability.id, x: enemy.x, z: enemy.z });
    if (enemy.hp <= 0) {
      killEnemy(enemy);
      playerState.exp += enemy.def.exp;
      emitter.emit('death', { who: 'enemy', enemy, exp: enemy.def.exp });
      if (target === enemy) selectTarget(null);
      playerChanged();
    }
  }

  function damagePlayer(enemy) {
    if (playerState.dead) return;
    const { amount } = computeDamage({ attack: enemy.def.attack, defense: playerState.defense, rng });
    spend(playerState, 'hp', 'maxHp', amount);
    markCombat();
    const p = playerPos();
    emitter.emit('damage', { source: 'enemy', targetKind: 'player', enemy, amount, crit: false, x: p.x, z: p.z });
    if (playerState.hp <= 0) {
      playerState.dead = true;
      playerState.respawnIn = respawnDelay;
      pendingHits.length = 0;
      emitter.emit('death', { who: 'player' });
    }
    playerChanged();
  }

  function useAbility(slot) {
    const result = tryAbility(slot);
    if (!result.ok) emitter.emit('abilityFailed', { slot, reason: result.reason });
    return result;
  }

  function tryAbility(slot) {
    const ability = abilities.find(a => a.slot === slot) ?? abilities[slot];
    if (!ability) return { ok: false, reason: 'invalid_slot' };
    if (playerState.dead) return { ok: false, reason: 'dead' };
    if (!cooldowns.ready(ability.id)) return { ok: false, reason: 'cooldown' };
    if (!cooldowns.ready('gcd')) return { ok: false, reason: 'gcd' };
    if (playerState.mp < ability.mpCost) return { ok: false, reason: 'no_mp' };

    let victim = null;
    if (ability.type === 'melee') {
      if (target && !target.alive) selectTarget(null);
      if (!target) {
        const nearest = nearestEnemy(ability.range);
        if (!nearest) return { ok: false, reason: 'no_target' };
        selectTarget(nearest);
      }
      if (distance(playerPos(), target) > ability.range) return { ok: false, reason: 'out_of_range', target };
      victim = target;
    } else if (ability.type === 'heal' && playerState.hp >= playerState.maxHp) {
      return { ok: false, reason: 'full_hp' };
    }

    spend(playerState, 'mp', 'maxMp', ability.mpCost);
    cooldowns.start(ability.id, ability.cooldown);
    cooldowns.start('gcd', GLOBAL_COOLDOWN);
    emitter.emit('ability', { ability, target: victim });

    if (ability.type === 'melee') {
      const hits = ability.hits ?? 1;
      damageEnemy(victim, ability);
      for (let i = 1; i < hits; i++) pendingHits.push({ delay: (ability.hitInterval ?? 0.2) * i, ability, enemy: victim });
    } else if (ability.type === 'aoe') {
      const p = playerPos();
      for (const e of enemies) if (e.alive && distance(p, e) <= ability.radius) damageEnemy(e, ability);
      if (!target) selectTarget(nearestEnemy(ability.radius));
    } else if (ability.type === 'heal') {
      const amount = Math.round(playerState.maxHp * (ability.healPct ?? 0) + playerState.attack * ability.multiplier);
      const healed = restore(playerState, 'hp', 'maxHp', amount);
      const p = playerPos();
      emitter.emit('heal', { amount: healed, abilityId: ability.id, x: p.x, z: p.z });
    }
    playerChanged();
    return { ok: true, ability, target: victim };
  }

  function respawnPlayer() {
    playerState.dead = false;
    playerState.respawnIn = 0;
    playerState.inCombat = false;
    sinceCombat = Infinity;
    playerState.hp = playerState.maxHp;
    playerState.mp = playerState.maxMp;
    cooldowns.reset();
    selectTarget(null);
    setPlayerPosition(playerStart.x, playerStart.z);
    emitter.emit('respawn', { who: 'player', x: playerStart.x, z: playerStart.z });
    playerChanged();
  }

  function update(dt) {
    cooldowns.tick(dt);
    sinceCombat += dt;

    if (playerState.dead) {
      playerState.respawnIn = Math.max(0, playerState.respawnIn - dt);
      if (playerState.respawnIn <= 0) respawnPlayer();
    } else {
      const inCombat = sinceCombat < OUT_OF_COMBAT_AFTER;
      let changed = inCombat !== playerState.inCombat;
      playerState.inCombat = inCombat;
      if (restore(playerState, 'mp', 'maxMp', MP_REGEN * dt) > 0) changed = true;
      if (!inCombat && restore(playerState, 'hp', 'maxHp', HP_REGEN * dt) > 0) changed = true;
      if (changed) playerChanged();
    }

    for (let i = pendingHits.length - 1; i >= 0; i--) {
      const hit = pendingHits[i];
      hit.delay -= dt;
      if (hit.delay <= 0) {
        pendingHits.splice(i, 1);
        if (!playerState.dead) damageEnemy(hit.enemy, hit.ability);
      }
    }

    const player = playerPos();
    for (const enemy of enemies) {
      for (const event of stepEnemy(enemy, { dt, player, canStand, rng })) {
        if (event.type === 'attack') {
          emitter.emit('enemyAttack', { enemy });
          damagePlayer(enemy);
          player.dead = playerState.dead;
        } else if (event.type === 'respawn') {
          emitter.emit('respawn', { who: 'enemy', enemy });
        }
      }
    }
    if (target && (!target.alive || distance(player, target) > DROP_TARGET_RANGE)) selectTarget(null);
  }

  return {
    update,
    useAbility,
    cycleTarget,
    selectTarget,
    getTarget: () => target,
    enemies,
    playerState,
    abilities,
    getCooldown(slot) {
      const ability = abilities.find(a => a.slot === slot) ?? abilities[slot];
      if (!ability) return { remaining: 0, duration: 0, fraction: 0 };
      const own = cooldowns.remaining(ability.id), gcd = cooldowns.remaining('gcd');
      return own >= gcd
        ? { remaining: own, duration: cooldowns.duration(ability.id), fraction: cooldowns.fraction(ability.id) }
        : { remaining: gcd, duration: GLOBAL_COOLDOWN, fraction: cooldowns.fraction('gcd') };
    },
    on: emitter.on,
    emit: emitter.emit,
  };
}
