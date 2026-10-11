# Newcomer journey, levels 1–20

The shared route teaches supply checks, accepting a quest before hunting, returning
to known contacts, and moving into the existing class lessons. It supplements the
current hunting progression. Completing six short quests does **not** reach Lv 20;
normal hunting between milestones remains the main source of EXP. No curve, drop
rate, monster stat, shop price or class requirement changes.

## Shared route

| Quest ID | Minimum level | Giver → return | Objectives | Gold / EXP / supplies |
| --- | --- | --- | --- | --- |
| newcomer_supplies | 1 | warp_city_gate → warp_paddy | talk warp_paddy | 20 / 20 / small HP ×3, MP ×1 |
| newcomer_paddy | 1 | warp_paddy → same | crab Lv 2 ×3, hide ×1 | 30 / 60 / small HP ×2 |
| newcomer_forest | 3 | warp_paddy → forest_herbalist | talk forest_herbalist, phibpa Lv 3 ×3, ash ×1 | 40 / 100 / small HP ×3, MP ×1 |
| newcomer_wat | 6 | forest_herbalist → wat_hermit | talk wat_hermit, headless Lv 6 ×3 | 50 / 200 / large HP ×2, MP ×1 |
| newcomer_marsh | 10 | wat_hermit → marsh_trader | talk marsh_trader, leech Lv 11 ×4 | 70 / 400 / large HP ×2, MP ×1 |
| newcomer_homecoming | 20 | marsh_trader → forest_herbalist | talk forest_herbalist | 90 / 600 / large HP ×2, MP ×2 |

Each quest requires the previous shared quest. All classes use the same route;
existing class lessons remain independent and available under their own rules.
All required contacts remain present in every clock phase. Warp keepers are
existing NPCs with fixed positions, including the city north-gate keeper and the
paddy arrival keeper. Yai Phian's daytime shop is an optional supply stop, never
a required wait for dawn. Forest, wat and marsh suppliers also remain all day.

The named targets have all-phase entries in `HUNTING_GROUNDS`: crab at
คันนาฝึกหัด, phibpa at ดงปากป่าตะวันออก, headless at ดงวิญญาณตะวันตก and leech
at ชายบึงดงอ้อ. These pockets contain other monsters too. Instructions recommend
one opponent at a time, checking the bestiary and returning when supplies run
low; they do not claim a level alone guarantees safety. No elite, boss, rare card,
night-only encounter or unsupported cure item is required. The marsh warning
mentions poison and MP drain without advertising a purchasable antidote.

Kill counts start at acceptance. Existing unlocked bag materials count toward
collection and hide ×1 / ash ×1 are consumed on hand-in. Neither is a guaranteed
drop: beast tables roll hide at 60% (1–2), spirit tables ash at 60% (1–2). Players
may need extra ordinary kills; locked materials do not count. Subsequent class
lessons may need these same materials, so the guide says to retain a reserve.

## Reward pacing

The six quests total **340 gold, 1,380 EXP, potion_s ×8, potion_m ×6, ether ×6**.
At current listed item prices (10 / 30 / 14 gold), supplies are worth 404 gold;
the complete cash plus supply basket is 744 gold, before the two consumed
materials. Actual vendor buyback uses the existing economy rules. Rewards are
one-time recovery supplies; they grant no equipment, rare cards or permanent
stats. Early cash can cover starter armor (15 gold), shoes (20) or replenishment;
later cash remains below a single 260-gold marsh weapon per hand-in.

| Minimum level | Quest EXP / next-level EXP | Approximate ordinary target EXP |
| --- | --- | --- |
| 1 supply | 20 / 80 = 25% | no kill |
| 1 paddy | 60 / 80 = 75% | crab 33 before level adjustment/cap |
| 3 forest | 100 / 1,247 = 8.02% | phibpa 43 |
| 6 wat | 200 / 7,055 = 2.83% | headless 75 |
| 10 marsh | 400 / 25,298 = 1.58% | leech 123 |
| 20 return | 600 / 143,108 = 0.42% | no kill |

Percentages compare the acceptance floor to `expToNext`; delivery often occurs
later. For example, at Lv 2 the paddy reward is 60 / 453 = 13.25%, rather than
75%. The two initial rewards plus hunting ease the first step without rushing
the later curve. Monster rewards still obey existing level-gap adjustment and
per-kill cap. No time-to-level promise is made; actual clear speed, supply use,
party play and detours need playtesting.

## Guide contract

`src/data/newcomer-guide.js` exports `NEWCOMER_GUIDE`, seven informational
milestones with `id`, `minLevel`, `maxLevel`, `title`, `lines`, `questIds` and
`actions: [{label, panel}]`. Supported panels are `quests`, `bag`, `sheet`,
`skills`, `map` and `bestiary`. These are existing UI actions, not new objective
types or saved completion flags. The Lv 5 and Lv 20 milestones carry
`classStage: intro / advanced`; the consumer resolves the current class's real
lesson and does not offer an unavailable class or invent a lesson unlock.

Lv 5 points to the existing **Lv 5 / Job 3** introduction. Lv 15–19 reminds the
player to check learned skills and tree prerequisites for a second offensive
skill. Lv 20 points to the existing **Lv 20 / Job 12**, completed-introduction
advanced lesson. The guide repeats real combat requirements and the 12-second
two-skill condition; dummy hits do not count. Requirements and mastery rewards
remain defined by the original class quests.

The guide remains useful for returning saves: it derives the visible milestone
from the character level and existing quest state, and does not reset progress.
Travel, conversations and hand-ins use the normal NPC authority path. Shared
quests do not depend on the class-specific practice/combo acknowledgement path.

## Validation and limitations

Content reference checks cover existing NPCs, monsters, items, predecessor IDs,
all-phase required contacts and supported guide actions. Full test and build
results are reported with the integrated implementation. Natural playthroughs
for each class and measured EXP per hour are still required before retuning
rewards. This content adds no visuals; UI screenshots belong to the onboarding
implementation review.
