# src/training — class avatars and the city training ground

Once the character exists (after creation or load), `Game` calls `createClassAvatar(classId, opts)`:

- **Every class wears a Tripo GLB.** The model comes from `avatarFor(classId)` (`AVATARS` in `src/data/training.js`); a class without its own model wears `AVATAR_FALLBACK`'s. The model is shown once it loads, through `Player.setAvatar(model, casts)`, and plays the `casts` clip on each combat cast.
- **มวยไทย and หมอยา** (`skills: 'muaythai'` / `'herbalist'`, kits in `src/classes/index.js`) also get the training ground below.
- **Other classes** get a model-only avatar.

## Training ground (classes with a skill kit)

In the city, a straw dummy stands just north of the spawn. Near the dummy (within `TRAINING.range` = 12 m):

- keys **1–0** cast the class's ten skills with full FX (the herbalist's grimoire orbits while casting)
- **Q** toggles auto-cast
- the skill hotbar replaces the class skill bar
- a damage log shows every blow, the total, DPS, crit and miss rates, and a per-skill table

| File | Role |
|---|---|
| `TrainingGround.js` | wires the fighter, FX, dummy, hotbar and log into `Game` |
| `damage.js` | pure damage math, tested in `tests/training-damage.test.js` |
| `training.css` | city-themed styles for the FX labels, hotbar and log |

Data lives in `src/data/training.js`: class avatars (model URL, height, skill set), dummy position, HP, DEF and EVA, plus the fallback fighter's level and stats, and the skill level. You can override values from the URL: `?lv=50&skill=5&ddef=40&deva=30`.

## Damage

Damage comes from `src/rules`, not from the hand-tuned FX numbers:

- the trainee is the player: its live stats come from the city `Character` (six base stats, gear and buffs, through the same `computeDerived`); with `?lv=` or no character it falls back to the fixed fighter (`computeDerived(stats, JOBS[avatar.job], level)`, `boxer` or `healer`)
- each blow uses `skillStats(skill, skillLevel).mult` with `rollDamage` against `{ def, eva }`
- the hit chance, the ±10% variance and crits all come from the rules

The blood ticks of ศอกกลับ still deal a flat 30.

## Hooks into shared code (documented interface changes)

- **`Player.setAvatar(model, casts)`** (`src/entities/Player.js`): the player's only look.
  - `Player.animate` calls `model.update(dt, time, moving, null)`.
  - Movement and turning stay in `Player`.
- **`Game`** (`src/core/Game.js`): `this.training = createClassAvatar(...)` is created once `game.ready` (the character exists). Game then:
  - calls `enterMap(map.id)` on every map change
  - gives `handleKey(e)` first pick of keys (before combat)
  - blocks walking while `training.busy`
  - calls `update(dt)` each frame
- **`createFx({ scale, gain })`** (`src/classes/fx/engine.js`) takes an FX scale for fighters of other heights and now also works with an orthographic camera.
- **`createBoxerSkills({ damage })`**: optional `damage(skillId) → { hit, crit, dmg }` rolls each blow; without it the hand-tuned FX numbers stay.
- **`createDummy(…, { hp, onHit })`**:
  - `onHit` receives `{ amount, crit, miss, bleed, killed }`
  - `hurt(..., exact)` skips the ±10% spread
  - `miss()` shows MISS
