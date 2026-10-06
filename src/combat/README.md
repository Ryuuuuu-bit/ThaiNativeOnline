# Combat system (`src/combat/`)

Owner: gameplay-engineer (`data/`: content-designer). Rules and AI in `Combat.js` (no rendering), visuals in `CombatView.js`, HUD in `ui/`, content in `data/`.

## Files

| File | Purpose |
| --- | --- |
| `index.js` | Public entry: `createGame(options)` wires character, combat, view and UI into a world |
| `Combat.js` | Targeting, skills, global cooldown, damage, crits, dodge, debuffs, pet, monster AI, loot, respawn, day/night |
| `CombatView.js` | Monster models, hunter's dog, target ring, projectiles, AoE rings, hit flashes |
| `ui/CombatHUD.js` | Target frame, action bar, floating numbers, nameplates, death screen, night theme |
| `data/skills.js` | `SKILLS`, `BUFF_ICONS` |
| `data/monsters.js` | `MONSTERS`, `NIGHT` (night EXP and ghost bonuses) |
| `data/loot.js` | `LOOT` tables: `[itemId, chance, min, max]` |
| `data/rules.js` | `RULES`: leash, cooldowns, timeouts, death penalty and other tuning |
| `data/zones.js` | `DEFAULT_ZONES` for the forest prototype; the city passes `src/data/spawns.js` |

## Public interface

```js
import { createGame } from '../combat/index.js';
const rpg = createGame({
  root, host, scene, camera, player,          // player: { group: THREE.Object3D }
  canStand(x, z), groundHeight(x, z),         // world queries
  moveTo(x, z), stop(),                       // walk the player toward a target / stop
  respawnPoint: { x, z }, spawns,             // spawns optional
});
rpg.setPhase('morning' | 'day' | 'evening' | 'night');
rpg.update(dt, elapsed);                      // every frame
rpg.handleKey(event) → boolean                // true when the key was used
rpg.onManualMove();                           // player steered by hand: stop chasing
rpg.canMove                                   // false while dead
rpg.ready, rpg.character, rpg.combat, rpg.view, rpg.hud, rpg.characterUI
```

The character is loaded or created asynchronously, so `ready` stays false until the creation screen closes; every method is safe to call before that.

Keys: `1–4` skills, `Space` basic attack, `Tab` next target, `Esc` clear target. Clicking a monster targets and attacks it. The click event's propagation is stopped, so the world's click-to-move does not fire.

### Spawn zones

```js
{ type: 'boar', x, z, radius, count, time: 'day' | 'night' | 'any', respawn?, chance? }
// or active: ['morning', 'day', 'evening', 'night'] instead of time
```

`chance` rolls on every spawn attempt (used for rare monsters). Zones outside their time fade out once they are no longer fighting.

### Combat events (`rpg.combat.on(name, fn)`)

`spawn`, `despawn`, `target`, `cast`, `hit`, `miss`, `dodge`, `kill({monster, exp, gold, drops})`, `aggro`, `monster-attack`, `player-hit`, `player-death`, `player-respawn`, `heal`, `buff`, `aoe`, `projectile`, `pet-command`, `pet-bite`, `fail(reason)`, `phase`.

## Adding content

- Monster: add to `MONSTERS` (`shape` is one of `boar`, `tiger`, `monkey`, `spirit`, `krasue`; set `elite`/`boss`/`rare` as needed) and give it a `LOOT` table.
- Skill: add to `SKILLS`. `kind` is `damage`, `aoe`, `buff`, `heal`, `debuff` or `pet`. Then reference the id from a class in `src/character/data/classes.js`.
