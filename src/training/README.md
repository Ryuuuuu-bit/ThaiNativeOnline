# src/training — class avatars, class skill kits and the city training ground

Once the character exists (after creation or load), `Game` calls `createClassAvatar(classId, opts)`:

- **Every class wears a Tripo GLB.** The model comes from `avatarFor(classId)` (`AVATARS` in `src/data/training.js`); a class without its own model wears `AVATAR_FALLBACK`'s. The model is shown once it loads, through `Player.setAvatar(model, casts)`, and plays the `casts` clip on each combat cast.
- **Classes with a skill kit** (`skills: '<kit id>'`, kits in `src/classes/index.js` `CLASS_KITS`: มวยไทย, หมอยา, นายพราน, นักรบ, หมอผี, and any kit added later with no extra code) put their ten skills on the action bar on every map and get the training ground below.
- **Other classes** get a model-only avatar and keep their four combat skills on the same action bar (`src/combat/LegacyCaster.js`).

```js
const training = createClassAvatar(classId, { scene, camera, renderer, root, player, canStand, groundHeight, character, combat, hud });
training.enterMap(mapId)   // after each map change; the dummy lives in TRAINING.map
training.busy              // true while a skill plays (Game blocks walking)
training.onManualMove()    // the player steered: drop a cast that was walking into range
training.update(dt)        // every frame, after the player moved
```

## The action bar and keys

The bar is `src/ui/ActionBar.js` (owned by `CombatHUD`, the same on every map): keys **1–0** cast, **G** toggles AUTO (casts the next ready skill on the target), then the potions (**Q** / **F**) and the **C** / **I** menus. A kit class's `KitCaster` replaces the legacy skills through `hud.setSkills(caster, label)`.

## Kit skills in combat (`KitCaster.js`, `kitCombat.js`, `targets.js`)

Each cast picks its target:

1. the combat target (Tab / click, `src/combat`) within `RULES.kit.targetRange`
2. else the training dummy, when standing at it in the city
3. else the nearest monster (`combat.cycleTarget()`)
4. else, for self skills (rules type `buff` / `party` / `revive`), nobody: a point ahead of the player stands in

On a monster:

- **cost and cooldown:** MP from the kit entry (`mp`) or the rules skill (`skillStats(...).mp`); the kit's own cooldown (`cd`). The dummy stays free, as before.
- **range:** the rules `range` / `distance` / `offset + radius` in metres (`RULES.kit.pxPerMeter`), clamped to `[minRange, maxRange]`; melee kits dash the last metres themselves. Farther away, the player walks in (like Combat's pending skills) for up to `approachTimeout` s, then "ไกลเกินไป".
- **damage:** every blow the FX lands (the skill's `hits[]` timing, multi-hits included) is `rollSkill` with the player's live derived stats against the monster's DEF / EVA, the same as on the dummy. A blow of a skill with no rules multiplier rolls at `RULES.kit.fallbackMult`.
- **area skills** (rules `aoe` / `mortar` / `dash` with a radius / `melee` with `all`) roll each blow again on every monster within the radius, around the caster or the target (`kitCombat.splashOf`).
- **effects:** the rules `effect` (stun, slow, poison / bleed / burn) becomes Combat debuffs once per cast per monster; `heal`, `mpHeal` and `buff` of the skill apply to the caster (Character buffs), on the dummy too.
- **results** go through `combat.damageMonster`: the `hit` / `miss` events (floating numbers, sounds, target frame), aggro, and the kill path (EXP, gold, loot, quests).

The FX runners (`src/classes/fx/*-skills.js`) still take one `dummy`: `createTargetProxy()` hands them a stand-in that forwards to whichever target the cast bound (the dummy, `monsterTarget(m)` or `stubTarget()`). Target API: `pos`, `off`, `alive`, `barY`, `stun`, `chest()`, `head()`, `hurt(amount, crit, push, from, exact)`, `miss()`, `knock(dir, dist, dur)`, `bleed()`.

## Training ground (classes with a kit)

In the city, a straw dummy stands just north of the spawn. Within `TRAINING.range` (12 m) of it, casts with no combat target hit the dummy and a damage log shows every blow, the total, DPS, crit and miss rates, and a per-skill table.

| File | Role |
|---|---|
| `TrainingGround.js` | wires the avatar, FX, dummy, KitCaster and the damage log into `Game` |
| `KitCaster.js` | the kit's action bar controller: target choice, MP, cooldowns, range, blows on monsters |
| `kitCombat.js` | pure rules: cast info, blows, splash, effects (tested in `tests/kit-combat.test.js`) |
| `targets.js` | the target proxy, monster and no-target adapters for the FX runners |
| `damage.js` | pure damage math, tested in `tests/training-damage.test.js` |
| `training.css` | the damage log |

Data lives in `src/data/training.js`: class avatars (model URL, height, skill set), dummy position, HP, DEF and EVA, plus the fallback fighter's level and stats, and the skill level. You can override values from the URL: `?lv=50&skill=5&ddef=40&deva=30`.

## Damage

Damage comes from `src/rules`, not from the hand-tuned FX numbers:

- the trainee is the player: its live stats come from the `Character` (six base stats, gear and buffs, through the same `computeDerived`); with `?lv=` or no character it falls back to the fixed fighter (`computeDerived(stats, JOBS[avatar.job], level)`)
- each blow uses `skillStats(skill, skillLevel).mult` with `rollDamage` against `{ def, eva }`
- the hit chance, the ±10% variance and crits all come from the rules; a miss shows MISS (KitCaster hands the runners `dmg: -1` for a miss, since they fall back to their own number when `dmg` is 0)

On the dummy the blood ticks of ศอกกลับ still deal a flat 30; on monsters bleeding is the rules effect.

## Hooks into shared code (documented interface changes)

- **`Player.setAvatar(model, casts)`** (`src/entities/Player.js`): the player's only look.
- **`Game`** (`src/core/Game.js`): `this.training = createClassAvatar(...)` is created once `game.ready`, with `combat` and `hud`. Game then calls `enterMap(map.id)` on every map change, `onManualMove()` when the player steers, blocks walking while `training.busy`, and calls `update(dt)` each frame. Keys go to `game.handleKey` (CharacterUI, then CombatHUD and its action bar).
- **`CombatHUD.setSkills(controller, label)`** and **`Combat.damageMonster / debuff / hold`**: see `src/combat/README.md`.
- **`createFx({ scale, gain })`** (`src/classes/fx/engine.js`) takes an FX scale for fighters of other heights and also works with an orthographic camera.
- **`createXSkills({ damage })`**: optional `damage(skillId) → { hit, crit, dmg }` rolls each blow; without it the hand-tuned FX numbers stay.
- **`createDummy(…, { hp, onHit })`**: `onHit` receives `{ amount, crit, miss, bleed, killed }`; `hurt(..., exact)` skips the ±10% spread; `miss()` shows MISS.
- `src/classes/fx/hotbar.js` (`createHotbar`) is no longer used by the game; the action bar replaced it.
