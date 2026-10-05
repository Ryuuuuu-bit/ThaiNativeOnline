// Enemy AI state machine on plain {x, z} positions. No three.js.
//
//   idle ⇄ wander ──(player within aggroRange, or provoked)──▶ chase
//   chase ──(within attackRange)──▶ attack ──(target drifts away)──▶ chase
//   chase/attack ──(beyond leashRange from home, or player dead)──▶ return
//   return ──(home reached; HP restored)──▶ idle
//   any ──(hp ≤ 0)──▶ dead ──(respawnTime elapsed)──▶ idle at home (full HP)
//
// stepEnemy mutates the enemy and returns a list of events:
//   { type: 'attack' }   — the enemy lands an attack on the player this frame
//   { type: 'respawn' }  — the enemy came back to life
import { distance } from './math.js';

export const AI_STATES = ['idle', 'wander', 'chase', 'attack', 'return', 'dead'];
export const ENEMY_RADIUS = 0.3;
const WINDUP = 0.45;      // delay before the first swing after reaching the player
const ATTACK_EXIT = 1.2;  // hysteresis: leave attack only past attackRange * this

let nextId = 1;

export function createEnemyState(def, home, rng = Math.random) {
  return {
    id: `${def.id}#${nextId++}`,
    defId: def.id,
    def,
    name: def.name,
    x: home.x,
    z: home.z,
    homeX: home.x,
    homeZ: home.z,
    facing: 0,
    hp: def.hp,
    maxHp: def.hp,
    state: 'idle',
    stateTime: 0,
    idleFor: 1 + rng() * 2,
    wanderTarget: null,
    attackTimer: 0,
    respawnTimer: 0,
    provoked: false,
    moving: false,
    alive: true,
  };
}

export function setState(enemy, state) {
  if (enemy.state === state) return;
  enemy.state = state;
  enemy.stateTime = 0;
  if (state === 'attack') enemy.attackTimer = Math.max(enemy.attackTimer, WINDUP);
}

/** Step toward (tx, tz); slides along an axis when blocked. Returns true if moved. */
export function moveToward(enemy, tx, tz, step, canStand, radius = ENEMY_RADIUS) {
  const dx = tx - enemy.x, dz = tz - enemy.z;
  const len = Math.hypot(dx, dz);
  if (len < 1e-6) return false;
  const s = Math.min(step, len);
  const nx = enemy.x + (dx / len) * s, nz = enemy.z + (dz / len) * s;
  enemy.facing = Math.atan2(dx, dz);
  if (canStand(nx, nz, radius)) { enemy.x = nx; enemy.z = nz; return true; }
  if (Math.abs(dx) > 1e-4 && canStand(nx, enemy.z, radius)) { enemy.x = nx; return true; }
  if (Math.abs(dz) > 1e-4 && canStand(enemy.x, nz, radius)) { enemy.z = nz; return true; }
  return false;
}

export function killEnemy(enemy) {
  enemy.hp = 0;
  enemy.alive = false;
  enemy.provoked = false;
  enemy.moving = false;
  enemy.respawnTimer = enemy.def.respawnTime;
  setState(enemy, 'dead');
}

export function respawnEnemy(enemy) {
  enemy.hp = enemy.maxHp;
  enemy.alive = true;
  enemy.x = enemy.homeX;
  enemy.z = enemy.homeZ;
  enemy.provoked = false;
  enemy.attackTimer = 0;
  enemy.wanderTarget = null;
  setState(enemy, 'idle');
}

/**
 * @param enemy  state from createEnemyState
 * @param ctx    { dt, player: { x, z, dead }, canStand(x, z, r), rng }
 */
export function stepEnemy(enemy, ctx) {
  const { dt, player, canStand, rng = Math.random } = ctx;
  const def = enemy.def;
  const events = [];
  enemy.stateTime += dt;
  enemy.moving = false;

  if (enemy.state === 'dead') {
    enemy.respawnTimer -= dt;
    if (enemy.respawnTimer <= 0) { respawnEnemy(enemy); events.push({ type: 'respawn' }); }
    return events;
  }

  const home = { x: enemy.homeX, z: enemy.homeZ };
  const toPlayer = distance(enemy, player);
  const fromHome = distance(enemy, home);
  const hunting = enemy.state === 'chase' || enemy.state === 'attack';

  // Leash / give up.
  if (hunting && (player.dead || fromHome > def.leashRange)) {
    enemy.provoked = false;
    setState(enemy, 'return');
  }

  // Aggro check (not while walking home).
  if (!player.dead && (enemy.state === 'idle' || enemy.state === 'wander')) {
    if (enemy.provoked || (def.aggressive && toPlayer <= def.aggroRange)) setState(enemy, 'chase');
  }

  switch (enemy.state) {
    case 'idle': {
      if (enemy.stateTime >= enemy.idleFor) {
        const angle = rng() * Math.PI * 2, r = (0.3 + rng() * 0.7) * def.wanderRadius;
        const target = { x: enemy.homeX + Math.cos(angle) * r, z: enemy.homeZ + Math.sin(angle) * r };
        if (canStand(target.x, target.z, ENEMY_RADIUS)) {
          enemy.wanderTarget = target;
          setState(enemy, 'wander');
        } else {
          enemy.stateTime = 0;
        }
        enemy.idleFor = 2 + rng() * 3;
      }
      break;
    }
    case 'wander': {
      const t = enemy.wanderTarget;
      if (!t || distance(enemy, t) < 0.15 || enemy.stateTime > 8) { setState(enemy, 'idle'); break; }
      enemy.moving = moveToward(enemy, t.x, t.z, def.speed * 0.4 * dt, canStand);
      if (!enemy.moving) setState(enemy, 'idle');
      break;
    }
    case 'chase': {
      if (toPlayer <= def.attackRange) { setState(enemy, 'attack'); break; }
      enemy.moving = moveToward(enemy, player.x, player.z, def.speed * dt, canStand);
      break;
    }
    case 'attack': {
      enemy.facing = Math.atan2(player.x - enemy.x, player.z - enemy.z);
      if (toPlayer > def.attackRange * ATTACK_EXIT) { setState(enemy, 'chase'); break; }
      enemy.attackTimer -= dt;
      if (enemy.attackTimer <= 0) {
        enemy.attackTimer = def.attackCooldown;
        events.push({ type: 'attack' });
      }
      break;
    }
    case 'return': {
      // Regenerate quickly while disengaged so kiting to the leash resets the fight.
      enemy.hp = Math.min(enemy.maxHp, enemy.hp + enemy.maxHp * 0.5 * dt);
      if (fromHome < 0.2) { enemy.hp = enemy.maxHp; setState(enemy, 'idle'); break; }
      enemy.moving = moveToward(enemy, home.x, home.z, def.speed * 1.2 * dt, canStand);
      if (!enemy.moving) { // stuck: snap home rather than walking into a wall forever
        enemy.x = home.x; enemy.z = home.z; enemy.hp = enemy.maxHp; setState(enemy, 'idle');
      }
      break;
    }
  }
  return events;
}
