# Level Progression

## Ordinary route rebalance — October 2026

The current ordinary progression is Paddy **1–4**, Forest **5–9**, Wat **10–14**, Marsh **15–20**. These are primary hunting bands, not a promise that every creature in a map has that level. Existing entry monkeys (3), forest spirits in the northern paddy (5), and entry spirits at the wat (5/8) remain deliberate transition wildlife. The marsh dancer remains 22. Bosses and elites retain their previous levels and stats; some are stronger than nearby ordinary monsters and should not determine the suggested map band.

| Primary habitat | Ordinary species and level |
| --- | --- |
| Paddy | Fowl 1, boar 1, crab 2, monkey 3, cobra 4 |
| Forest | Dhole 5, forest ghost 5, water ghost 5, monitor 6, kongkoi 7, wandering spirit 8, khamot 9 |
| Wat | Pret 10, headless ghost 11, krahang 12, violent-death ghost 13, soldier 14 |
| Marsh | Leech 15, water wraith 16, crocodile 17, python 18, phong 18, maternal ghost 19, kumphi 20 |

Every level 1–20 now has an ordinary target. Three forest species share level 5 so the existing class introduction quests remain achievable when offered at level 5; their pack, melee and spirit roles differ. Advanced quest targets remain no higher than their level-20 acceptance floor. All quest IDs, objectives, loot tables and reward baskets remain intact.

Twenty-one ordinary species changed. For each shifted species HP, ATK, DEF and both ตำลึง endpoints were rounded after multiplying by `(new level + 4) / (old level + 4)`. EXP uses the existing `MONSTER_EXP_RATE(new level)`; no progression formula changed. Scaling retains species differences: headless ghosts hit hard but slowly, crabs/crocodiles remain armored, and ranged/control enemies retain their behaviors. Boar/fowl level 1 and crab level 2 remain unchanged for beginner and night hunting.

Every regional and supplemental sign computes its minimum/maximum from its actual roster after night coverage is added. The older pocket tables below describe the original release allocation; the current signs and roster-derived levels take precedence.

### Bounded combat estimates

Thirty deterministic probes sampled 10,000 basic attacks and incoming hits for each of five ready classes against six representative species. Characters used starter equipment and spent level stat points on their two class stats. Estimated basic-only kill times: level-1 boar **3.5–4.9 s**, level-1 player versus level-3 monkey **3.8–5.4 s**, equal-level forest ghost **2.8–4.1 s**, headless ghost **3.4–5.2 s**, water wraith **3.9–6.3 s**, kumphi **6.1–10.1 s**. Mean incoming monkey hit was **12.2–13.9 HP** against **130–218 HP** starter characters, supporting the gentler level-3 first-quest target.

Theoretical uninterrupted basic-only throughput falls from **12.1–17.2 boars/min** to **5.9–9.8 kumphi/min**. Equal-level kill EXP is 65/123/165/198 for forest ghost/headless/wraith/kumphi. Level-1 boar and monkey rewards are capped at 16 EXP by the unchanged 20% kill cap. These estimates exclude travel, respawn competition, skills, dog damage, poison, charge, pack aggro, potions and player input; they do not establish final EXP/hour or natural time-to-level balance.

The exact final level curve is not locked yet.

For production, use milestone-based bands instead of designing the full MMO immediately.

## Vertical Slice
- Starting city/tutorial
- low-level farmland/forest
- cemetery danger zone
- first dungeon

Only expand to higher fantasy realms after the first region is fun, readable, stable, and performant.
## Hunting pockets (October 2026)

Each outdoor map now has two marked hunting pockets. These supplement the existing
monster areas and boss encounters; they do not replace the progression curve.

| Map | Pocket | Monster levels |
| --- | --- | --- |
| Paddy | คันนาฝึกหัด | 1–2 |
| Paddy | ทุ่งเงาต้นไทร | 2–3 |
| Deep forest | ดงปากป่าตะวันออก | 3–4 |
| Deep forest | ดงหลังเจดีย์ | 4–5 |
| Wat rang | ดงวิญญาณตะวันตก | 6–7 |
| Wat rang | ลานทหารผี | 8 |
| Klong | ชายบึงดงอ้อ | 11–12 |
| Klong | ทุ่งรำวิญญาณ | 17–22 |

The shared roster lives in `src/data/hunting.js`. Ordinary monsters respawn after
24 seconds, with up to four extra slots per pocket after the existing density
multiplier (32 total). Fowl and monkeys retain daylight activity; every pocket
has another species active at night. Existing monster stats, XP, drops and bosses
are unchanged. Displayed levels describe monster levels, not a difficulty guarantee.

## Party expedition release candidate — levels 1–100 (October 2026)

This supersedes the two-pocket-per-map allocation above. The playable Character
and combatant cap is 100. The separate generic rules engine retains its existing
future cap of 150; no 100–150 hunting content is enabled here.

| Map | Monster band | Marked hunting pockets | Extra boss |
| --- | --- | --- | --- |
| Paddy | primary 1–4; transition 5 | 8 | existing encounters |
| Deep forest | primary 5–9; entry monkeys 3 | 10 | existing encounters |
| Wat rang | primary 10–14; entry spirits 5/8 | 10 | existing encounters |
| Klong | primary 15–20; dancer 22; boss 25 | 12 | existing encounters |
| ป่าช้าไผ่ดำ | 23–30 | 12 | เจ้าป่าช้า 30 |
| เหมืองอาคมร้าง | 30–40 | 12 | ผู้พิทักษ์เหมือง 40 |
| นครบาดาล | 40–50 | 12 | นาคราชเฝ้าประตู 50 |
| ป้อมอสูรสนธยา | 50–60 | 12 | เจ้าอสูรสนธยา 60 |
| หุบเขายักษ์ | 60–70 | 12 | ยักษ์เฝ้าหุบเขา 70 |
| ป่าหิมพานต์ | 70–80 | 12 | พญาปักษาทมิฬ 80 |
| นครอาคมล่มสลาย | 80–90 | 12 | ขุนพลอาคม 90 |
| ประตูรอยแยกอสูร | 90–100 | 12 | เจ้าอสูรรอยแยก 100 |

136 marked pockets in total. Existing regional pockets are promoted into the
shared sign/map system without duplicating their spawn IDs. Some additional
regional pockets fill gaps; camps with daylight-only animals also offer another
night species. Boss areas are separate from this total.

Each expedition has three hunting circuits with four pockets each. A circuit's
monster level is the low/middle/high point of the map band. Ordinary encounters
stay within three levels of every player level from 1 to 100. Suggested party
size is 3–5 (existing party maximum stays six). First two expedition maps have
six monsters per pocket, later maps eight: 73/97 total monsters including the
boss, per CH1 map. Bosses remain CH1-only, respawn in 900 seconds; normal pockets
use the shared 24-second respawn. Pocket count is not multiplied again elsewhere.

32 new identities (24 ordinary and eight bosses) use existing procedural shape
builders with distinct look/color/combat data. These are initial art, not bespoke
new GLB assets. Eight equipment tiers provide all six weapon kinds, armor and
shoes (64 gear items). The tier's minimum level is enforced by Character.equip;
vendors and shared loot tables recognize each ID. New cards use known bonus keys
and existing card artwork. Drops reuse existing material/potion supplies.

The EXP curve, party sharing (nearby members, existing level-gap and capped
membership bonus), skill tree and loot ownership remain unchanged. This is a
playable hunting route, not a completed quest/dungeon progression or a claim of
final time-to-level balance. Tune clear speed, potion usage, EXP per hour and
loot supply with actual 3–5 player parties before deploying broadly.

## Map boss skills

Each of the 12 hunting maps has one designated primary boss at its existing
encounter site. Each primary has two themed, dodgeable attacks, with a fixed-aim
warning, recovery and a faster cadence below half HP. Ordinary hunting pockets
do not receive duplicate boss spawns. Full roster, attack timings, authority and
limitations: `docs/technical/BOSS_ENCOUNTERS.md`.
