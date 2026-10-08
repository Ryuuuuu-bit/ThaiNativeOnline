# Level Progression

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
| Paddy | 1–3 | 8 | existing encounters |
| Deep forest | 2–5 | 10 | existing encounters |
| Wat rang | 4–10 | 10 | existing encounters |
| Klong | 10–25 | 12 | existing encounters |
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
