# src/training — class avatars and the city training ground

Once the character exists (after creation or load), `Game` calls `createClassAvatar(classId, opts)`:

- **A class with a modelled GLB** (`AVATARS` in `src/data/training.js`) wears that model instead of its procedural rig. The model is shown only after it loads, so a missing file keeps the rig.
- **Muay Thai** (`skills: 'muaythai'`) also gets the training ground below.
- **Other classes** return `null` and keep their rig.

The หมอยา (herbalist) entry is ready and waits for `models/herbalist.glb` (see `docs/art/classes/herbalist/PRODUCTION.md`).

## Training ground (Muay Thai)

In the city, a straw dummy stands just north of the spawn. Near the dummy (within `TRAINING.range` = 12 m):

- keys **1–0** cast the ten Muay Thai skills with full FX
- **Q** toggles auto-cast
- the skill hotbar replaces the class skill bar
- a damage log shows every blow, the total, DPS, crit and miss rates, and a per-skill table

`?rig` turns all of this off and keeps the class rig.

| File | Role |
|---|---|
| `TrainingGround.js` | wires the fighter, FX, dummy, hotbar and log into `Game` |
| `damage.js` | pure damage math, tested in `tests/training-damage.test.js` |
| `training.css` | city-themed styles for the FX labels, hotbar and log |

Data lives in `src/data/training.js`: class avatars (model URL, height, skill set), dummy position, HP, DEF and EVA, plus the fighter's level, stats and skill level. You can override values from the URL: `?lv=50&skill=5&ddef=40&deva=30`.

## Damage

Damage comes from `src/rules`, not from the hand-tuned FX numbers:

- the fighter's stats come from `computeDerived(stats, JOBS.boxer, level)`
- each blow uses `skillStats(skill, skillLevel).mult` with `rollDamage` against `{ def, eva }`
- the hit chance, the ±10% variance and crits all come from the rules

The blood ticks of ศอกกลับ still deal a flat 30, as in the forest dummy.

## Hooks into shared code (documented interface changes)

- **`Player.useModel(model)`** (`src/entities/Player.js`): hides the class rig and shows `model.group` in its place.
  - `Player.animate` calls `model.update(dt, time, moving, null)` instead of updating the rig.
  - Movement and turning stay in `Player`.
- **`Game`** (`src/core/Game.js`): `this.training = createClassAvatar(...)` is created once `game.ready` (the character exists). Game then:
  - calls `enterMap(map.id)` on every map change
  - gives `handleKey(e)` first pick of keys (before combat)
  - blocks walking while `training.busy`
  - calls `update(dt)` each frame
- **`createFx({ scale, gain })`** (`src/forest/fx/engine.js`) takes an FX scale for fighters of other heights and now also works with an orthographic camera.
- **`createBoxerSkills({ damage })`**: optional `damage(skillId) → { hit, crit, dmg }` rolls each blow; without it the forest numbers stay.
- **`createDummy(…, { hp, onHit })`**:
  - `onHit` receives `{ amount, crit, miss, bleed, killed }`
  - `hurt(..., exact)` skips the ±10% spread
  - `miss()` shows MISS
