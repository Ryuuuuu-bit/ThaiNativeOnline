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
