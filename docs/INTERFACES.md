# Public Interfaces (v0.2)

Contract between agent-owned systems. Changing anything here requires review
and an update to this file. `src/main.js` (bootstrap, render loop, camera,
input wiring, UI glue) is owned by the lead and is the only place that wires
systems together. Systems never import each other directly; they receive
what they need through constructor arguments.

All content (names, numbers, colours, layouts, text) lives in `data/` modules
inside each system. Pure logic that does not need Three.js goes in files that
do not import `three`, so it can run under `node --test`.

## World — `src/world/index.js` (World Agent)

```js
buildWorld(scene) -> { ground: THREE.Mesh, water: { uniforms }, atmosphere: { particles, leaves, update }, update(time, dt) }
groundHeight(x, z) -> number
inWater(x, z) -> boolean
pathX(z) -> number
riverX(z) -> number
canStand(x, z, radius = 0.25) -> boolean   // walkability: bounds + water + obstacles (moved from main.js)
landmarks      // [{ id, x, z, radius, name, kind, exploreText }]
obstacles      // [{ x, z, radius }] filled by buildWorld
treePositions  // [{ x, z, radius }] filled by buildWorld
windUniforms   // { uTime, uWind }
worldBounds    // { minX, maxX, minZ, maxZ }
```

## Character — `src/character/index.js` (Character Agent)

```js
createPlayer(scene, { classId = 'swordsman' } = {}) -> {
  group: THREE.Group,
  classId, stats: { maxHp, maxMp, attack, defense, moveSpeed },
  update(time, moving),
  playAction(name)          // e.g. 'attack', 'hit', 'cast' — one-shot pose, safe to ignore unknown names
}
createMovementController({ player, canStand, groundHeight }) -> {
  setDestination(THREE.Vector3 | null),
  hasDestination() -> boolean,
  update(dt, elapsed, inputDirection: THREE.Vector3 /* world-space XZ, may be zero */) -> { moved, blocked, arrived }
}
```
Keyboard/pointer handling stays in `main.js`; it resolves keys into a world
direction and passes it to the controller.

## Combat — `src/combat/index.js` (Combat Agent)

```js
createCombatSystem({ scene, player /* from createPlayer */, groundHeight, canStand }) -> {
  update(dt, elapsed),
  useAbility(slot) -> { ok, reason? },   // slot 0..n from data/abilities
  cycleTarget(), selectTarget(enemy | null), getTarget(),
  pickEnemy(raycaster) -> enemy | null,
  enemies,                                // live enemy list
  playerState: { hp, maxHp, mp, maxMp, dead },
  on(event, handler)                      // 'damage', 'death', 'targetChanged', 'playerChanged', 'respawn'
}
createCombatHud(container: HTMLElement, combat) -> { update() }
```
Enemies are owned by combat for now (data-driven, geometry-built,
Thai-folklore-inspired). Combat calls `player.playAction(...)` for poses.
