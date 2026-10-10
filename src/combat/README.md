# Combat system (`src/combat/`)

Owner: gameplay-engineer (`data/`: content-designer). Rules and AI in `Combat.js` (no rendering), visuals in `CombatView.js`, HUD in `ui/`, content in `data/`.

## Files

| File | Purpose |
| --- | --- |
| `index.js` | Public entry: `createGame(options)` wires character, combat, view and UI into a world |
| `Combat.js` | Targeting, skills, global cooldown, damage, crits, dodge, debuffs, pet, monster AI, loot, respawn, day/night |
| `CombatView.js` | Monster models, hunter's dog, target ring, projectiles, AoE rings, hit flashes |
| `ui/CombatHUD.js` | Target frame, the action bar (`src/ui/ActionBar.js`), floating numbers, nameplates, death screen, night theme |
| `LegacyCaster.js` | The class's four `SKILLS` as an action bar controller (classes without a ten-skill kit) |
| `data/skills.js` | `SKILLS`, `BUFF_ICONS` |
| `data/monsters.js` | `MONSTERS`, `NIGHT` (night EXP and ghost bonuses) |
| `data/loot.js` | `LOOT` tables: `[itemId, chance, min, max]` |
| `data/rules.js` | `RULES`: leash, cooldowns, timeouts, death penalty and other tuning; `RULES.kit` tunes class kits fighting monsters |

## Public interface

```js
import { createGame } from '../combat/index.js';
const rpg = createGame({
  root, host, scene, camera, player,          // player: { group: THREE.Object3D }
  canStand(x, z), groundHeight(x, z),         // world queries
  moveTo(x, z), stop(),                       // walk the player toward a target / stop
  respawnPoint: { x, z }, spawns,             // spawns optional
  isSafe(),                                   // optional: true while the loaded map is a safe zone (default: no spawns)
});
rpg.setPhase('morning' | 'day' | 'evening' | 'night');
rpg.update(dt, elapsed);                      // every frame
rpg.handleKey(event) → boolean                // true when the key was used
rpg.onManualMove();                           // player steered by hand: stop chasing
rpg.canMove                                   // false while dead
rpg.ready, rpg.character, rpg.combat, rpg.view, rpg.hud, rpg.characterUI
```

The character is loaded or created asynchronously, so `ready` stays false until the creation screen closes; every method is safe to call before that.

Keys: `1–0` the action bar's skills, `G` AUTO, `Q` / `F` potions, `C` character, `I` bag (CharacterUI), `Space` basic attack, `Tab` next target, `Esc` clear target. Clicking a monster targets it and starts the class's basic attack. The click event's propagation is stopped, so the world's click-to-move does not fire.

### Action bar (`rpg.hud.bar`, `src/ui/ActionBar.js`)

One bar on every map, in the shared hotbar look: up to ten skills (keys 1–0), AUTO (G), the potion buttons (Q / F, with counts) and the C / I menu buttons from CharacterUI. A controller fills the skill slots:

- `LegacyCaster.js`: the class's four `SKILLS` through `Combat.useSkill` (default, and for classes without a kit).
- `src/training/KitCaster.js`: the class's ten-skill kit (`src/classes` `CLASS_KITS`); TrainingGround swaps it in with `rpg.hud.setSkills(controller, label)` once the character exists.

The controller interface is documented at the top of `ActionBar.js`. `hud.setSafe(on)` (safe map) only silences the fight tips and Tab / Space; the bar is the same everywhere.

### Hooks for ordinary monster strikes

- `monsterAttackTiming.js` owns clip contact seconds (`tani: 13/24`, `phong: 0.5`, all other types: 0) and one-shot strike identities. Cooldown starts at windup, so the existing attack cadence is unchanged; a cancelled strike consumes that cooldown.
- Offline `Combat.monsterAttack` reserves a normal strike and `updateMonster` releases the existing damage/status/knock/death path at contact. `cancelMonsterAttacks()` clears reservations on map leave. Boss skill telegraphs keep their separate lifecycle.
- `server/monsters.js` sends targeted `mstrike` windup/cancel packets with spawn `generation`, monotonic `attackId`, target `to` and `remaining` seconds. A reserved strike releases one existing `ma` packet after rechecking live target, identity, range, leash and navigation. At 10 Hz, release occurs on the first server tick at or after contact.
- `NetCombat` never turns a remote timer into damage: only `ma` applies HP. Generation/serial deduplication rejects old results and the first authoritative result still applies if its windup was lost. Reconnect `mlist` includes remaining strike time; `CombatView` starts/seeks the clip from explicit cues and cancels it on invalidation. Zero-contact monsters keep their immediate packet behavior.

### Hooks for class kits (`src/training/KitCaster.js`)

- `combat.damageMonster(monster, amount, { crit, miss })`: apply an already rolled blow; emits `hit` / `miss`, then aggro, or the kill path (`kill` event, EXP, gold, loot). Returns true while the monster lives.
- `combat.debuff(monster, { id, duration, slow?, stun?, dot?, source?, label? })`: one debuff per id. `stun` stops the monster moving and attacking; `label` is the tag on the target frame.
- `combat.hold`: true while a kit skill plays; the player's own chase and basic-attack swings wait.
- `RULES.kit` (`data/rules.js`): pixel → metre scale for rules ranges/radii, min/max cast range, approach timeout, fallback multiplier, target search range.

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

### Hooks for coordinated class skills

- `statusEffects.js` reads live debuffs: strongest active armor break / weakness wins, capped at 60%. Distinct caster + skill sources keep independent expiry; `md` packets preserve these keys.
- `kitCombat.rollBlow(..., rng, liveTarget)` grants the skill's optional `synergy` bonus once per blow when any condition is active, capped at 25%; DOT ticks never re-evaluate the bonus.
- `effect.taunt: { ms, radius }` uses pixel radius. `KitCaster.applySelf` and server `Combatants.cast(..., { world, player })` challenge nearby enemies without a target or damage callback. Normal taunts cap at 8 seconds, bosses at 2; fixed boss telegraphs retain their aim.
- Character support accepts `defFlat`, proportional `def`, `dodge`, `hot`, and `cleanse`. Defense takes strongest active flat and strongest proportional bonuses (proportional capped at 60%); cleansing removes negative effects immediately while preserving positive buffs.
