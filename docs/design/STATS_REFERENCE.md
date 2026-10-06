# Stats reference (PvE & PvP)

The target stat sheet for Thai Native Online: [stats-reference.jpg](stats-reference.jpg).
It splits stats into base, offensive, defensive, utility, PvE-only and PvP-only
groups, and says to start with 12–18 core stats and grow from there.

Owner: game-director (rules in `src/rules/**`), with content-designer for values.

## Where the game is today

The client has 18 core stats, inside the sheet's 12–18 starting range. Derived
stats use `computeDerived` from `src/rules/stats.js`, so city combat and the
training dummy share one formula.

| Sheet group | In the game (`src/character/Character.js`) | Comes from |
|---|---|---|
| Base (6) | `str agi vit int dex luk` | class base + growth per level + 3 points per level + gear |
| Offensive (6) | `patk` (ATK), `matk`, `accuracy`, `critChance`, `critDamage`, `attackSpeed` | STR (DEX for `ranged`) / INT / DEX+LUK / LUK / LUK / AGI |
| Defensive (4) | `maxHp`, `defense` (DEF), `evasion`, `maxMp` | VIT / VIT / AGI+LUK / INT |
| Utility (2) | `cooldownCut`, carry `weight` | DEX / STR |
| PvE layer | none yet | the city is a safe zone |
| PvP layer | none yet | no PvP yet |

Combat (`src/combat/Combat.js`) rolls every player blow with `rollDamage`:
- INT skills deal MATK, always hit and go through half the armour; the rest deal ATK and can miss against `eva`.
- Monsters hit against the player's evasion. Their accuracy is `acc`, or `MONSTER_ACCURACY(level)` by default.
- AGI shortens the basic-attack interval and DEX shortens skill cooldowns.

| Class | Rules job | Main stats | Lv 1 → Lv 30 (no points spent) |
|---|---|---|---|
| มวยไทย | boxer | STR, AGI | ATK 27 → 275, dodge about 10% |
| นักรบ | swordman | STR, VIT | HP 202 → 1187, DEF 8 → 46 |
| นายพราน | archer (ranged) | DEX, AGI | ATK 17 → 184, crit 15% → 25% |
| หมอผี | mage (magic) | INT, DEX | MATK 30 → 392 |
| หมอยา | healer (magic) | INT, VIT | MATK 31 → 314, HP 163 → 861 |
| โจรป่า | boxer | AGI, LUK | dodge 13% → 25%, crit 7% → 17% (+12% at night) |

Stat points cost 1 each (the client's level cap is 30). The rules' RO cost curve,
for a later level cap of 150, is not used yet.

## Carry weight

- Every item has a `weight` (`src/character/data/items.js`); bag stacks and equipped items both count.
- Limit = `1000 + STR × 30` (`CARRY` in `src/character/data/progression.js`).
- At 70% of the limit the bag is heavy and natural HP/MP regeneration stops.
- Past the limit, pickups keep what fits and the rest is refused (`overweight` event), and shops won't sell.

| Item group | Weight |
|---|---|
| Potions, honey | 5–15 |
| Materials | 3–20 |
| Charms | 5 |
| Light weapons (wraps, knives, wands, bow) | 10–60 |
| Swords | 50–120 |
| Armour | 30–110 |

## Suggested next steps (from the sheet)

1. MDEF and resistances (element, status), once monsters cast spells.
2. Rebalance monster HP/ATK when zones open: player damage is about 30–50% higher than under the old formula.
3. Add the PvE layer (damage to monster/boss, threat) when monster zones open.
4. Keep PvP numbers apart from PvE (PvP damage at 45–60% of PvE, burst at 25–40%, healing at 50–70%, crit damage reduced or capped).
