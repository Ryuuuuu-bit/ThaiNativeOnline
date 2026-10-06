# Character system (`src/character/`)

Owner: gameplay-engineer (`data/`: content-designer). Pure game logic in `Character.js`; content lives in `data/`.

## Files

| File | Purpose |
| --- | --- |
| `index.js` | Public entry: `loadOrCreateCharacter`, `Character`, `CharacterUI`, `Feed` |
| `Character.js` | Stats, level/EXP, HP/MP, buffs, cooldowns, inventory, equipment, save/load |
| `Emitter.js` | Tiny event emitter (also used by combat) |
| `data/classes.js` | `CLASSES` (6 classes), `STATS`, `STAT_LABELS`, `START_ITEMS`, `CLASS_ALIASES` |
| `data/items.js` | `ITEMS`, `RARITY_COLORS` |
| `data/progression.js` | `MAX_LEVEL`, `expToNext(level)` |
| `ui/CreationScreen.js` | Name, gender and class picker; resolves `{ name, classId, gender }` |
| `ui/CharacterUI.js` | Player frame, quick potions, character sheet (C), bag (I) |
| `ui/Feed.js` | Message feed and centre banner shared by all game UI |
| `ui/dom.js` | `el`, `esc`, `pct`, `setBar` helpers |

## Public interface

```js
import { loadOrCreateCharacter } from '../character/index.js';
const character = await loadOrCreateCharacter(rootElement);
```

`Character`:

- Read: `name, classId, gender, level, exp, gold, points, hp, mp, maxHp, maxMp, attack, defense, critChance, dodge, stats, cls, inventory, equipment, buffs, cooldowns, alive, night`
- Combat-facing: `damage(n)`, `heal(n)`, `spendMp(n) → bool`, `restoreMp(n)`, `addBuff({id, duration, def?, atk?, dodge?, hot?})`, `gainExp(n)`, `revive(ratio)`, `tick(dt, inCombat)`
- Items: `addItem(id, qty)`, `useAt(i)`, `quickUse('hp'|'mp')`, `equip(i)`, `unequip(slot)`, `sellAt(i)`, `count(id)`
- Stats: `allocate(stat)`, `resetStats()`
- Persistence: `save()`, `Character.load()`, `Character.clearSave()` (localStorage key `tno.character.v1`)
- `night` is set by the combat system; classes with `nightCrit` gain crit chance at night.

Events (`character.on(name, fn)`): `change`, `damaged(amount)`, `death`, `exp(amount)`, `levelup(level)`, `inventory`, `inventory-full(itemId)`, `used(itemId)`.

## Adding content

- New class: add an entry to `CLASSES` (stats, growth, range, attackSpeed, colour, four skill ids from `src/combat/data/skills.js`, optional `pet`, `nightCrit`) and a `START_ITEMS` entry.
- New item: add to `ITEMS`. `type` is `use`, `material` or `equip`; equipment needs `slot` and `bonus`.
- Renamed class ids go in `CLASS_ALIASES` so old saves still load.

## Look

Classes have no models here. The player wears the class's Tripo GLB (`AVATARS` in `src/data/training.js`, attached by `src/training` through `Player.setAvatar`), which plays the `casts` clip on every combat `cast`.
