// Combat system — Three.js layer over the pure rules in ./logic/core.js.
// Public contract: docs/INTERFACES.md → "Combat".
import * as THREE from 'three';
import { createCombatCore, DEFAULT_PLAYER_STATS } from './logic/core.js';
import { buildEnemyModel } from './view/enemyModels.js';
import { createHpBillboard, createFloatingText, createSelectionRing, createPulses } from './view/effects.js';

export { createCombatHud } from './hud.js';

const FLASH_TIME = 0.16;
const LUNGE_TIME = 0.32;
const DEATH_TIME = 1.4;
const SPAWN_TIME = 0.45;
const flashColor = new THREE.Color('#fff4d6');

/**
 * @param {{ scene: THREE.Scene, player: object, groundHeight: (x:number,z:number)=>number,
 *           canStand: (x:number,z:number,r?:number)=>boolean, rng?: ()=>number }} opts
 */
export function createCombatSystem({ scene, player, groundHeight = () => 0, canStand = () => true, rng } = {}) {
  const playerPos = player.group.position;
  const playAction = name => { try { player.playAction?.(name); } catch { /* poses are optional */ } };

  const core = createCombatCore({
    playerStats: { ...DEFAULT_PLAYER_STATS, ...(player.stats ?? {}) },
    getPlayerPosition: () => playerPos,
    setPlayerPosition: (x, z) => playerPos.set(x, groundHeight(x, z), z),
    canStand,
    rng,
  });

  const root = new THREE.Group();
  root.name = 'combat';
  scene.add(root);
  const numbers = createFloatingText(root);
  const ring = createSelectionRing(root);
  const pulses = createPulses(root);
  const views = new Map(); // enemy -> view

  for (const enemy of core.enemies) {
    const model = buildEnemyModel(enemy.def);
    const bar = createHpBillboard(enemy);
    bar.sprite.position.y = model.height + model.hover + 0.55;
    model.root.add(bar.sprite);
    model.hitbox.userData.enemy = enemy;
    model.root.userData.enemy = enemy;
    model.root.position.set(enemy.x, groundHeight(enemy.x, enemy.z), enemy.z);
    model.root.rotation.y = enemy.facing;
    root.add(model.root);
    views.set(enemy, { ...model, bar, flash: 0, lunge: 0, deathT: 0, spawnT: SPAWN_TIME, walk: Math.random() * 10 });
    enemy.object3d = model.root;
  }

  const tmp = new THREE.Vector3();
  const headPos = (enemy) => {
    const v = views.get(enemy);
    return tmp.set(enemy.x, groundHeight(enemy.x, enemy.z) + v.height + v.hover + 1.25, enemy.z);
  };
  const playerHead = () => tmp.set(playerPos.x, playerPos.y + 2.2, playerPos.z);
  const faceToward = (x, z) => { player.group.rotation.y = Math.atan2(x - playerPos.x, z - playerPos.z); };

  // Visual reactions to rule events.
  core.on('ability', ({ ability, target }) => {
    playAction(ability.playerAction);
    if (target) faceToward(target.x, target.z);
    if (ability.type === 'aoe') pulses.spawn(playerPos, '#f1d48c', ability.radius, 0.45);
    if (ability.type === 'heal') pulses.spawn(playerPos, '#a8f0a0', 1.6, 0.8);
  });
  core.on('damage', (event) => {
    if (event.targetKind === 'enemy') {
      const v = views.get(event.enemy);
      if (v) v.flash = FLASH_TIME;
      numbers.spawn(String(event.amount), event.crit ? 'crit' : 'dealt', headPos(event.enemy));
    } else {
      numbers.spawn(`-${event.amount}`, 'taken', playerHead());
      playAction('hit');
    }
  });
  core.on('heal', ({ amount }) => numbers.spawn(`+${amount}`, 'heal', playerHead()));
  core.on('enemyAttack', ({ enemy }) => { const v = views.get(enemy); if (v) v.lunge = LUNGE_TIME; });
  core.on('death', (event) => {
    if (event.who === 'enemy') {
      const v = views.get(event.enemy);
      if (v) v.deathT = 0;
      pulses.spawn(tmp.set(event.enemy.x, groundHeight(event.enemy.x, event.enemy.z), event.enemy.z), '#efe6c8', 1.2, 0.6);
    } else {
      playAction('death');
    }
  });
  core.on('respawn', (event) => {
    if (event.who === 'enemy') {
      const v = views.get(event.enemy);
      if (v) { v.spawnT = 0; v.root.visible = true; }
    } else {
      playAction('respawn');
      pulses.spawn(playerPos, '#f1d48c', 1.8, 0.9);
    }
  });

  function animateEnemy(enemy, v, dt, elapsed, target) {
    const { root: r, body } = v;
    const ground = groundHeight(enemy.x, enemy.z);
    r.position.set(enemy.x, ground, enemy.z);

    if (!enemy.alive) {
      v.deathT += dt;
      const k = Math.min(1, v.deathT / DEATH_TIME);
      body.rotation.z = Math.min(1, v.deathT / 0.35) * (Math.PI / 2) * 0.9;
      body.position.y = v.hover * (1 - k) - Math.max(0, k - 0.5) * 1.2;
      v.bar.sprite.visible = false;
      if (k >= 1) r.visible = false;
      return;
    }

    // facing (shortest-arc lerp)
    let diff = enemy.facing - r.rotation.y;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    r.rotation.y += diff * Math.min(1, dt * 10);

    // spawn-in
    if (v.spawnT < SPAWN_TIME) {
      v.spawnT += dt;
      const s = Math.min(1, v.spawnT / SPAWN_TIME);
      r.scale.setScalar(s * (2 - s));
      body.rotation.z = 0;
    } else r.scale.setScalar(1);

    // walk cycle / idle bob / lunge
    if (enemy.moving) v.walk += dt * (enemy.state === 'chase' || enemy.state === 'return' ? 12 : 7);
    const swing = enemy.moving ? Math.sin(v.walk) * 0.5 : 0;
    for (const s of v.swingers) s.rotation.x = swing * s.userData.swing;
    const bob = enemy.moving ? Math.abs(Math.sin(v.walk)) * 0.06 : Math.sin(elapsed * 2 + v.walk) * 0.02;
    const hoverBob = v.hover ? Math.sin(elapsed * 2.4 + v.walk) * 0.08 : 0;
    body.position.y = v.hover + bob + hoverBob;
    body.rotation.z = 0;
    if (v.lunge > 0) {
      v.lunge -= dt;
      const k = 1 - Math.max(0, v.lunge) / LUNGE_TIME;
      body.position.z = Math.sin(k * Math.PI) * 0.35;
      body.rotation.x = Math.sin(k * Math.PI) * 0.18;
    } else { body.position.z = 0; body.rotation.x = 0; }
    for (const child of body.children) if (child.userData.aura) child.rotation.z = elapsed * 1.5;

    // hit flash
    if (v.flash > 0) v.flash = Math.max(0, v.flash - dt);
    const f = v.flash / FLASH_TIME;
    for (const m of v.materials) {
      m.emissive.copy(m.userData.baseEmissive).lerp(flashColor, f);
      m.emissiveIntensity = m.userData.baseEmissiveIntensity + f * 0.9;
    }

    // HP billboard: shown when targeted, hurt or engaged
    const targeted = enemy === target;
    const show = targeted || enemy.hp < enemy.maxHp || enemy.state === 'chase' || enemy.state === 'attack';
    v.bar.sprite.visible = show;
    if (show) v.bar.draw(targeted);
  }

  function update(dt, elapsed = 0) {
    core.update(dt);
    const target = core.getTarget();
    for (const [enemy, v] of views) animateEnemy(enemy, v, dt, elapsed, target);
    if (target && target.alive) {
      ring.group.visible = true;
      ring.update(elapsed, target.x, groundHeight(target.x, target.z), target.z, target.def.size * 1.15);
    } else ring.group.visible = false;
    numbers.update(dt);
    pulses.update(dt);
  }

  function pickEnemy(raycaster) {
    const hitboxes = [];
    for (const [enemy, v] of views) if (enemy.alive && v.root.visible) hitboxes.push(v.hitbox);
    const hit = raycaster.intersectObjects(hitboxes, false)[0];
    const enemy = hit?.object.userData.enemy ?? null;
    if (enemy) core.selectTarget(enemy);
    return enemy;
  }

  return {
    update,
    useAbility: core.useAbility,
    cycleTarget: core.cycleTarget,
    selectTarget: core.selectTarget,
    getTarget: core.getTarget,
    pickEnemy,
    enemies: core.enemies,
    playerState: core.playerState,
    abilities: core.abilities,
    getCooldown: core.getCooldown,
    on: core.on,
    root,
  };
}
