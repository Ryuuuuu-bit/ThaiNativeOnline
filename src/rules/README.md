# src/rules — game rules ported from ThaiNative

Pure ES modules (no three, no DOM, no Node APIs) holding the stats, damage, progression, economy and
content data of the original ThaiNative project (`shared/` + parts of `server/td.js`). The formulas
and numbers are the ones balanced in the live game; keep them unless the lead decides otherwise.
Content comments are in Thai as in the original.

Owner: game-director, the lead (see CLAUDE.md). Character and Combat consume this layer; they do not edit it.

## Skill paths and previews — 2026-10-10

The user requested an A/B choice for every playable skill and readable calculated
values. The five ready class kits have 50 active skills and 15 tree passives.
The original fifteen active A/B pairs remain; additional pairs trade area, reach,
control, recovery, tempo or stat focus. They use existing combat fields instead
of adding new skills or effects. Proposal content is in
`src/character/data/skill-path-design.js`, registered by `data/evolutions.js`.
Passive choices replace that passive's per-level bonus through `passiveBonusAt`.
Base skills remain unchanged until a valid choice at skill Lv 5. Existing saves
without choices retain their original stats. Global damage, progression and
economy formulas are unchanged.

The user explicitly selected a switching fee of Job level × 10 **ตำลึง**, with
the first selection free. `evolutionSwitchCost` centralizes that calculation;
the server authorizes combat locks, charges once and preserves cooldowns,
effects and current HP/MP. Currency labels change only presentation; `gold`
keys and numerical balances remain compatible.

`skillPreview.js` returns presentation data from the actual `skillStats`,
`castInfo`, healing and support helpers. Damage ranges apply `rollDamage`'s
variance, armor subtraction, minimum damage, critical multiplier and rounding.
No selected target means a clearly marked before-armor estimate. Multi-hit
totals assume every scheduled blow lands; they do not include additional
targets, DoT, pet damage or guarantee hits. Healing is potential before HP/MP
caps and combat context. Natural party balance and physical-device play remain
separate validation from formula and authority tests.

## Modules

| Module | What it holds |
|---|---|
| `stats.js` | stat keys, level cap, EXP curve, derived stats, hit/damage roll, stat point costs |
| `character.js` | derived stats of a saved character (gear, sets, cards, passives, blessings), attack spec/gate |
| `charmodel.js` | the save object: create, migrate, level up, stats, skills, hotbar, path, presets |
| `economy.js` | every inventory / gold / quest / craft / enhance action (`runAction`) and kill rewards |
| `effects.js` | **new** — skill status effects (stun, slow, armor break, weak, poison/bleed/burn) |
| `exp.js` | **new** — RO-style EXP split for one kill (damage share, party pool) |
| `constants.js` | `WORLD`, `VIEW`, `RENDER_SCALE` (legacy 2D), `CURRENCY`, `NET`, `PARTY` |
| `data/*` | content tables: classes, skills, passives, items, gear, affixes, cards, monsters, village (quests, recipes, fish, enhance), crafting, trade, titles, life skills, blessings, appearance, slots, names, world, worldboss, crypt, ghostdg, ghostgear, sources, maps (legacy), npcs, herbs (new) |

### stats.js

- `STAT_KEYS = ['STR','AGI','VIT','INT','DEX','LUK']`, `STAT_INFO`, `STAT_START = 1`, `STAT_CAP = 130`, `START_STAT_POINTS = 48`
- `MAX_LEVEL = 150`
- `statCost(x) = floor((x−1)/10) + 2`: the cost to raise a stat from x to x+1. `raiseCost(from, n)`, `statSpentOn(v)`, `maxRaise(from, pts)`, `planRaise(stats, pts, weights) → { add, used }`
- `pointsForLevel(L) = floor((L−1)/5) + 3`, `statPointsAt(level)` (Lv.1 = 48, Lv.150 = 2670)
- `expToNext(L) = floor(40·L^1.6 · (L ≤ 30 ? 1 : (L/30)^1.5))`
- `expLevelMul(playerLv, mobLv)`: 100% when the mob is within 5 levels below up to equal; +2% per level for a mob up to 10 levels above (max +20%); −10% per level beyond +10 (min 20%); −10% per level beyond −5 (min 10%)
- `mobExp(base, playerLv, mobLv, boss=false)` = min(base·expLevelMul, expToNext(playerLv)·(boss ? 1 : 0.2)), rounded
- `mobAtkMul(level)`: 1 up to Lv.20, then +3.5% per level, max ×1.35
- `computeDerived(stats, job, level, bonus = {}, opt = { ranged })` → `{ maxHp, maxMp, patk, matk, accuracy, critRate, critDmg, def, eva, aspd, castRed, healPow }`
  - `maxHp = round(((baseHp + L·hpPerLevel + bonus.hp)·(1 + VIT/300) + 8·VIT)·hpMul)`
  - `maxMp = round(((baseMp + 4L + bonus.mp)·(1 + INT/100) + 3·INT)·mpMul)`
  - `patk = round(((main + (main/12)² + sec/5 + LUK/3)·2.15·(ranged ? 0.6 : 1) + 1.5L + bonus.atk)·patkMul)`. Melee uses main = STR and sec = DEX; ranged swaps them.
  - `matk = round((2.7·(INT + (INT/12)²) + 1.5L + bonus.matk)·matkMul)`
  - `accuracy = 85 + DEX + LUK/3`; `def = 0.65·VIT`; `eva = 0.6·AGI + 0.2·LUK`
  - `critRate = clamp(soft(0.05 + 0.003·LUK + 0.001·DEX + job.critBonus + bonus.crit, 0.4), 0, 0.75)`. `soft` halves whatever exceeds the cap.
  - `critDmg = 1.5 + soft(0.005·LUK + bonus.critDmg, 1.0)`
  - `aspd = min(0.3, 0.002·AGI + 0.0004·DEX) + bonus.aspd`; `castRed ≤ 0.25`
- `hitChanceOf(acc, eva) = clamp(0.95 + (acc − 90 − eva)/100, 0.6, 0.99)`
- `rollDamage(atk, def, kind = 'physical'|'magic'|'best', mult = 1, rng = Math.random) → { hit, crit, dmg }`. Player magic always hits. Damage = max(1, power·mult·U(0.9, 1.1) − DEF·(magic ? 0.25 : 0.5)), multiplied by critDmg on a crit.
- `attackInterval(baseCd, aspd)` (min 260 ms, aspd ≤ 0.45), `skillCooldown(cd, castRed)`, `buffAspd(buffs, now)`, `createBaseStats(job)`, `clamp`, constants `ASPD_MAX`, `ASPD_BUFF_MAX`, `CAST_RED_MAX`, `CRIT_SOFT`, `CRITDMG_SOFT`, `EXP_*`

### charmodel.js

`newCharacter(name, appearance = {})` returns the save object:

```js
{
  v: 2, name,
  appearance: { gender, outfit, hair, face, job /* combat style from weapon; bare hands = 'boxer' */, weapon, armor, path, aura, wenh, aenh, wtier, title },
  path: null,                         // main path (swordman|mage|archer|boxer|healer) or null = villager
  level: 1, exp: 0, statPoints: 0, statsRO: true, spV2: true,
  stats: { STR: 5, AGI: 5, VIT: 5, INT: 5, DEX: 5, LUK: 5 },   // the 48 start points pre-spent evenly
  hp, mp,                             // filled to max
  gold: 150,
  inventory: [{ id, qty }],          // hp_s×3, mp_s×2, yant_home×3 + all five starter weapons (wood_sword, oak_staff, bamboo_bow, hand_wrap, herb_staff)
  equipment: { weapon, helm, armor, gloves, boots, belt, accessory, accessory2, flask: 'flask_hp1', flask2: 'flask_mp1' },
  flaskCh: { flask: 3, flask2: 3 }, starterFlask: true,
  sp: 1, skills: {}, hotbar: { 0..9: skillId | 'it:<itemId>' | null }   // 1 = 'it:hp_s', 2 = 'it:mp_s'
  quests: { active: {}, done: [] }, enhance: {}, rec: {}, titles: [], friends: [],
  passives: ['root'], life: {}, wm: {} /* weapon mastery */, cards: {}, cardBook: {},
}
```

Other exports: `migrate(save)` (repairs and upgrades old or broken saves), `gainExp(c, n) → levels gained` (a level-up fully heals), `allocateStat(c, key)`, `resetStats`, `learnSkill(c, id) → { ok, msg }`, `assignHotbar(c, key, id) → bool`, `resetSkills`, `resetWeaponSkills(c, job)`, `syncAppearance(c)` (weapon → combat style), `choosePath(c, path)` (Lv.10+), `recomputePath`, `classTitle`, `pathName`, `styleOf`, `allocPassive`, `resetPassives`, `passiveFree`, `addLifeXp`, `lifeLv`, `addMastery`, `clampSkills`, `totalSp`, `totalStatPts`, presets (`ensurePresets`, `snapPreset`, `blankPreset`, `applyPresetStats`, `presetReserved`, `presetOf`, `presetInfo`, `PRESET_N`, `PRESET_LABEL`, `PRESET_SLOTS`), hotbar helpers (`emptyHotbar`, `hotbarItemOk`, `HOTBAR_ITEM_TYPES`), and `SAVE_VERSION`.

**Classes.** Every character is a *villager* (`VILLAGER` in `data/classes.js`: baseHp 105, baseMp 40, hpPerLevel 12). The held weapon sets the combat style: sword → `swordman`, staff → `mage`, bow → `archer`, bare hands or wraps → `boxer`, herb staff → `healer`. At Lv.10 the player picks one of the 5 `JOBS` as the main path (`PATH_LV = 10`). Main-path skills go to Lv.5 and the path grants `pathBonus`. Other paths' skills cap at Lv.2 (`SUB_CAP`) and cannot use ultimates. SP: 1 per level to Lv.60, then 1 per 2 levels (Lv.150 = 105).

### character.js

`getDerived(c)`, `combatDerived(c, buffs = [], now = Date.now())`, `equipmentBonus(c)`, `combatPower(c, d?)`, `attackSpec(c, job, skillId = null, combo = false) → { kind, mult, effect, hits }`, `attackGate(p, skillId, combo, now)`, `blessingsOf(c, now) → { atkMul, def, critAdd, expMul, goldMul, dropMul }`, `charPayload`, `sanitizeChar`, `EQUIP_SLOTS`, `SLOT_TYPE`.

### economy.js

`runAction(c, name, args = {}, ctx = {}) → { ok, msg, ...fx, titles? }`. Name is a key of `ACTIONS`: use, equip, unequip, buy, sell, sellMany, sellCart, buyback, lock, offer, siamsi, craft, enhance, qAccept, qDrop, qClaim, path, passive, passiveReset, bounty, fishBite, fishLand, fishLose, gather, alloc, learn, hotbar, recall, dye, title, friendDel, gm, cardIn, cardOut, cardTrade, flask, preset, demandSell, cosAck, statsAck, spAck.

`ctx = { rnd = Math.random, now = Date.now(), nearNpc?, night, admin, trade, sess = {} /* per-session cooldowns, fishing state */, tdMap? /* fish table key */ }`

**Proximity** is injected through `ctx.nearNpc(target) → boolean`, where target is one of:
- an NPC id from `data/npcs.js`: `shop`, `quest` (village chief, also the realm patrol captain), `smith`, `tailor`, `cook`, `kru_sword`, `kru_mage`, `kru_archer`, `kru_boxer`, `kru_healer`, `market`, `dungeon`;
- a spot: `shrine`, `temple`, `fish` (water's edge), `camp` (bounty hunter), or `` `herb:${i}` `` (index into `data/herbs.js` `HERB_NODES`).

If you supply no callback, everything counts as in range. The original server's `ctx.tdNpc` (id of the nearest NPC) still works for NPC targets, and `ctx.td` with `ctx.tdFish` still works for water. `near(ctx, target)` is exported.

Reward hooks: `grantKill(c, { mon, exp, gold, items, boss }) → { ups, quests, bounty, mastery, titles }` and `grant(c, { exp, gold, items })`. Other exports: `addItem`, `removeItem`, `count`, `freeQty`, `questEvent`, `questState`, `bountyList`, `shopPrice` (lvPrice items cost price·(1 + (Lv−1)/3)), `bulkSellList`, `packChar`.

### effects.js (new, extracted from server/td.js)

- `applyEffects(target, effects, hitDamage, now, { by }?)`. Call it after subtracting the hit from `target.hp`; a target with hp ≤ 0 gets nothing. `effects` is a skill `effect` spec. Bosses (`target.boss`) get half duration on stun, slow, armorBreak and weak. DoTs are stored as `dots[kind] = { by, dmg: max(1, round(hitDamage·ratio)), left: ticks, every, next: now + every }`. A new DoT of the same kind replaces the old one; different kinds stack. Slow, armorBreak and weak extend `…Until` to the later end and keep the larger pct while the old effect is active. Once it has expired, the new pct replaces it.
- `tickEffects(target, now, { ownerOk }?) → [{ kind, by, dmg, hp, killed }]`. Each due DoT subtracts its dmg, decrements `left` and reschedules. It stops after the killing tick; the caller resolves the kill. When `ownerOk(by)` returns false, that DoT is dropped without dealing damage (the server's "caster left or died" rule).
- Readers used by the AI and damage code: `isStunned(t, now)`, `slowMul(t, now)` (move speed ×), `defMul(t, now)` (target DEF ×), `weakenDamage(t, dmg, now)` (damage the weakened mob deals: max(1, round(dmg·(1 − pct)))). Also `clearEffects(t)`, `DOT_KINDS`, `BOSS_EFFECT_MUL`.
- Target fields match the original: `stunUntil, dots, slowUntil, slowPct, defDownUntil, defDownPct, weakUntil, weakPct`.

### exp.js (new, extracted from server/td.js)

`splitExp(mob, killerId, baseExp, world) → Map(id → { exp, bonus })`

- `mob = { dmgBy: Map|object (id → damage), level, boss? }`; `baseExp` is the mob's EXP after the time-of-day multiplier.
- `world.player(id) → { level, expMul = 1, dead, sameMap = true, party } | null`; `world.members(party) → ids`.
- Each contributor's raw share is `baseExp·dmg/total`. The killer counts with weight 1 if it dealt no recorded damage. Contributors who are gone or off the map are dropped.
- Party members pool their raw shares. If at least 2 living members are on the map and their level spread is ≤ 15 (`PARTY_LV_GAP`), each of them, damage dealer or not, gets `pool·(1 + 0.10·(n − 1))/n` with `bonus = round(10·(n − 1))` %. Otherwise each contributor keeps their own share.
- Each player receives `round(mobExp(raw·expMul, playerLv, mob.level, boss))`, so the per-player level-band and 20%/1-level caps apply.

### Legacy data and 2D fields

- `data/maps.js` is **legacy data**: the old side-scroller realm table (village, hunt maps m1–m20, arena, dungeon), with region, level ranges (`minLv`, monster level), monster → map (`MONSTERS[id].mapId`) and the region-boss generation. It is **not** a runtime map registry; the 3D world owns maps (src/world, src/data). Rules use it only for `recall` (`c.lastHunt`) and the `'grave'` quest goal (`isGraveMon`: monsters of hunt maps no. 13 and above).
- `constants.js` `WORLD` and `VIEW` are legacy side-scroller numbers that no rule reads any more.
- The 2D client's art and audio keys stay in the data, and the 3D client ignores them: `d8`, `frame`, `palette`, `tint`, `key`, `look`, `art`, `flip`, `forceTint`, `color`, emoji `icon`s, `sfx`, `proj`, `fx`, the `REGIONS` fog/sky/ground/decor values, `RENDER_SCALE`, and monster `zone` (old x spawn range, now stale; see below).

## Changes vs the original (and why)

| Where | Change | Why |
|---|---|---|
| removed files | `data/td_assets.js`, `gear_art.js`, `news.js`, `dungeon.js`, `raid.js`, `shared/td/*` not ported | 2D assets, news feed, and old side-scroller dungeon/raid content |
| `data/gear.js` | no `GEAR_ART` import (`const GEAR_ART = {}`): 368 weapons lose `grip`, 400 armors lose `look` | 2D icon grip points and armor colours only; no stat changes |
| `data/worldboss.js` | `const TILE = 16` instead of importing it from `shared/td/ayutthaya.js` | same value, no 2D map dependency |
| `data/maps.js` | dropped `minX/maxX`, `gates`, `respawnX/arriveX/fireX/safeEndX`, `HUNT_X0/MAP_W/MAP_STEP`, `mapAt/gateNear/canTravelFrom`, the `WORLD` consistency warning, `REGIONS[*].music/bg`, and the rewrite of `MONSTERS[*].zone`; added `GRAVE_MAP_NO = 13` and `isGraveMon(id)` | positional side-scroller data. `zone` now keeps the raw `monsters.js` value (unused by rules) |
| `data/npcs.js` | dropped NPC `x`, `SPOTS`, `FISH_SPOT`, `CAMP`, `HERB_NODES`, `nearNpc(x, id)`, `nearSpot(x, key)` | positional; proximity is now injected |
| `data/herbs.js` (new) | `HERB_NODES = [{ i, item }]`: the original `shared/td/ayutthaya.js` `HERB_SPOTS` without tile coordinates, same order and items (26 nodes) | gather nodes keep their indices |
| `data/sources.js` | "where to find" texts come from a snapshot (`LEGACY_MON_WHERE`, `LEGACY_HERB_WHERE`, `LEGACY_FISH_MAPS`) of what the original computed from the 2D maps; `setSourceWorld({ monWhere, herbWhere, fishMaps })` overrides it | `itemSources(id)` output is identical to the original for all 1261 items (checked) |
| `economy.js` | every `ctx.x` / `tdPos` / `mapAt` / `nearNpc` / `nearSpot` check now goes through `near(ctx, target)`. No callback means in range. The original skipped checks only when `ctx.x == null` | no positions in rules |
| `economy.js` `gather` | one node table (`HERB_NODES`, cooldown key `'t'+i`) instead of the legacy side-scroller nodes (`'v'+i`) plus the top-down `HERB_SPOTS`; the distance check (44/45 px) is replaced by `near(ctx, 'herb:i')` | the side-scroller herb nodes were derived from legacy map x positions |
| `economy.js` `bounty` | `near(ctx, 'camp')` instead of "on map m1 within 160 px of the camp" | positional |
| `economy.js` quest `kill: 'grave'` | `isGraveMon(id)` instead of `MONSTERS[id].zone[0] >= WORLD.graveX` | same 10 monsters (checked against the original, crypt mobs included) |
| `constants.js` | `RENDER_SCALE` kept verbatim (its `window` access was already guarded) and marked legacy | no unguarded `window` |
| `effects.js`, `exp.js` | new pure modules lifted from `server/td.js` `onHit`, `tickMobs` and `splitExp` | the server's sockets, player map and party registry are replaced by arguments and callbacks. Tiny differences: a target without numeric `hp` counts as alive, and the DoT owner check is optional (`ownerOk`) |

Known quirks kept as-is: `use` stamps food buffs with `Date.now()` rather than `ctx.now`; `character.charPayload` uses `Date.now()`.

Not ported: the server's combat loop (range, cooldown and cast-token checks, mob AI, drops via `rollGearDrop`/`rollCard` in `kill`), the old dungeon and raid, the world-boss controller, trade, market, ranking and social.

## Integration notes (current 3D game → rules)

The current game picks one of 6 classes at creation (`src/character/data/classes.js`: 4 stats `str/agi/int/vit`). The original instead uses a villager whose weapon sets the combat style, picks a path at Lv.10, and has 6 stats. Proposed bridge:

| Game class | Rules job (`JOBS`) | Starter weapon (rules item) |
|---|---|---|
| warrior | `swordman` | `wood_sword` |
| shaman | `mage` | `oak_staff` |
| hunter | `archer` | `bamboo_bow` |
| muaythai | `boxer` | `hand_wrap` (or bare hands) |
| herbalist | `healer` | `herb_staff` |
| assassin | **new** (see below) | none yet (the game's `krabi`; rules have no dagger items) |

Suggested wiring: on creation call `newCharacter(name, { gender })` (the inventory already holds every starter weapon), `runAction(c, 'equip', { id })` the class's weapon, and either set `c.path` at Lv.10 via `choosePath` or let `recomputePath` take it from weapon mastery. Map the game's 4 stats onto the 6 (str → STR, agi → AGI, int → INT, vit → VIT; DEX and LUK only exist in rules) or switch the UI to the 6 stats. Combat calls `combatDerived` → `attackSpec` → `rollDamage`, then `applyEffects` with `spec.effect`, `tickEffects` each frame, and on a kill `splitExp` + `grantKill`. Economy UI calls `runAction` with `nearNpc` answered by the world's NPC proximity.

### Proposed 6th job: assassin (`rogue`), README only, not in data

```js
rogue: {
  id: 'rogue', nameTh: 'โจรป่า', nameEn: 'Assassin',
  pathTitle: 'เงามรณะแห่งพงไพร', pathBonus: { crit: 0.05, eva: 6 }, pathTextTh: 'คริติคอล +5% · หลบ +6',
  weaponTh: 'มีด/กริช', icon: '🗡', weapon: 'dagger', color: '#9c6bd6', critBonus: 0.05,
  desc: 'มีดคู่ คริติคอลสูง หลบเก่ง แข็งแกร่งยามค่ำคืน ใช้ AGI + LUK',
  baseHp: 90, baseMp: 25, hpPerLevel: 11,
  startStats: { STR: 1, AGI: 1, VIT: 1, INT: 1, DEX: 1, LUK: 1 },
  attack: { kind: 'physical', style: 'melee', range: 24, cooldown: 400, mult: 0.85, mpCost: 0 },
}
// STAT_PLAN.rogue = { AGI: 1, LUK: 0.7, STR: 0.6, DEX: 0.3, VIT: 0.3 }
// WTYPE.rogue = 'dagger' · WTYPE_JOB.dagger = 'rogue' · STARTER_WEAPON.rogue = 'krabi'
// night bonus (game's nightCrit .12): pass { crit: 0.12 } in combat buffs/bonus while night
// skills (effect specs this layer already supports):
//   stab   melee  mult 1.6 → crit-heavy single hit
//   shadow dash   mult 1.8 distance 100, effect { stun: { ms: 500 } }
//   smoke  aoe    radius 70, effect { weak: { ms: 4000, pct: 0.25 }, slow: { ms: 2500, pct: 0.3 } }
//   venom  melee  mult 1.0, effect { poison: { ticks: 5, every: 700, ratio: 0.35 } }
```

At Lv.1 with 5 in every stat this kills the Lv.1 ghost in 3 hits at about 38 DPS. The existing jobs sit at 23–45 DPS, inside the original "DPS spread < 2.5×" balance check. It also has the lowest HP of the melee jobs (143). Adding it needs gear, skills, a trainer NPC, quests and shop stock across `classes.js`, `skills.js`, `gear.js`, `items.js`, `npcs.js` and `village.js`, so the lead should decide on it separately.

## Canonical kit damage delivery — 2026-10-10

The all-class audit found shaman ghostfire's elevated visual endpoint could
never pass its 3D proximity check, and kalp's visual wave range was shorter
than its accepted rules range. Combat damage now uses a rules-driven timeline
instead of visual callback proximity; effective A/B geometry drives hits.
`skillHits.js` preserves authored kit strikes, rules AoE waves, focused volley
counts, twelve tether ticks, and three alternating enemy bottle bounces.
Fan projectiles count once on the primary. Support-only skills never attack.
Repeated visual poison/burn callbacks no longer create extra full-strength
blows: the rules' poison/burn effects supply their own normalized ticks.
This deliberately removes accidental FX damage inflation without changing
damage multipliers, costs or cooldowns. The calculated preview uses the same
schedule and still assumes every displayed blow lands on its primary target.

## Class cooperation revision — 2026-10-10

Five complete kits retain their skill IDs, point budgets, prerequisite graphs,
damage multipliers, costs and cooldowns. See
`docs/design/CLASS_SKILL_SYNERGY.md` for the owner split and scope.

The deliberate balance changes give early defense and curse skills a useful party
role instead of redundant self healing. Warrior guard now protects nearby party
members with 25 flat DEF and 15% DEF for 8 seconds and provokes nearby enemies for
4 seconds; shaman shield protects nearby allies with 18 DEF for 6 seconds. Their
old self heals are removed, keeping recovery a reason to bring an herbalist.
The defensive guard A path trades attack speed for stronger nearby protection;
B remains a personal attack-tempo choice. The ancestor shield A protects a party
for a shorter period while B lasts longer on its caster.

Elbow applies 15% armor break for 4 seconds, curse applies 20% armor break and
weakening for 5 seconds, and herbal zone weakens by 10% for 4 seconds. Existing
warrior thrust, boxer kick, hunter volley and companion debuffs are preserved in
both A/B paths, making their party-opening roles dependable. Blade wind slows by
25% for 2 seconds to prepare crowd payoffs.

Eleven payoff skills receive a conditional 15–20% damage bonus against an existing
named condition. This bounded bonus rewards a teammate's setup without making
the class mandatory or replacing normal solo damage. Several matching conditions
give one bonus, capped at 25%; expired conditions do not count. The first source
blow can seed DOT damage but DOT ticks do not reevaluate or compound the bonus.
The implementation shares the calculation between local combat and the server.

Provocation is limited to 8 seconds on ordinary enemies and 2 seconds on bosses,
requires a living nearby caster and never redirects an already aimed boss warning.
Armor-break and weak effects use the strongest active source, capped at 60%.
Party defenses use strongest active flat/proportional values rather than unlimited
addition. Healing, cleansing and resource recovery keep their own skill range,
duration and server recipient rules. Fifteen existing passive A/B choices continue
to use their differentiated consumed stats; none gains a free new multiplier.

The former movement-speed field had no client movement consumer. Tiger tonic
deliberately replaces its advertised 25% running bonus with an actual 10% dodge
bonus, growing by one percentage point per skill scaling step. Berserk drops its
unused movement-speed field and retains its working attack-speed bonus. This avoids
adding a separate network movement/security change to the skill revision.

## Tests

`tests/rules/*.test.js` (`node --test`): ports of the original `combat`, `economy` and `skill-effects` tests (pure parts; positions replaced by `nearNpc`), plus tests for `effects.js` and `exp.js`.
