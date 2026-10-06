# World Map Direction

Owner: world-designer. Coordinates are world space (`src/world/CityMap.js`):
`+x` east, `-z` north, the river to the south. Maps: `src/world/maps.js`
(interface: `src/world/README.md`).

Progression: นครอโยธยา (city, safe) → warp → ทุ่งนอกเมือง: orchards and fields →
grassland → forest edge → dense forest → deep forest → old cemetery → (dungeon, later).

Every zone below gives its gameplay purpose, level band, safe area, farming
area, landmark, elite/boss slot and the way on. Geography is intentional: the
farther from the warp, the wilder, darker and stronger it gets.

## Maps

| id | Name | Band | Walk area | Safe | Purpose |
| --- | --- | --- | --- | --- | --- |
| `city` | นครอโยธยา | `z ≥ -112` (`SEAM_Z`) | x ±122, z -108.5 … 266 (inside the walls, port, river bank) | yes | trade, equipment, quests, class halls, training dummy |
| `fields` | ทุ่งนอกเมือง (ทุ่งนา · ป่า · ป่าช้า) | `z < -112` | x ±122, z -592 … -113.5 | no | hunting Lv 1-7, gathering, story beyond the wall |

The maps never touch: the North City Gate stays closed (the walk areas end on
each side of the wall). The only link is a pair of warps (ประตูวาป):

| Warp | Map | Trigger (x, z, r) | Arrives at | NPC exit node |
| --- | --- | --- | --- | --- |
| `warp_to_fields` | city | 0, -107, 2.2 (in the gate passage) | fields 0, -130, facing north | `gate_in` |
| `warp_to_city` | fields | 0, -122.5, 2.2 (outside the gate) | city 0, -99, facing south | `gate_out` |

From the city spawn (port, 4, 151) the warp is reached along the main avenue:
port → fish market → market → bridge → ศาลหลักเมือง → avenue → gate.

## นครอโยธยา (`city`) — safe, all levels

Who: everyone. Why: shops, smiths, quests, learning a class, trying skills on
the straw dummy at the port. No monsters (`src/data/spawns.js` has none in the city).

### ย่านสำนักครู (training-hall quarter)

East of ลานฝึกครู (47, 62), between the e-road and the port, backed by the
east wall. A sandy lane (`hq_*` junctions, ROADS kind `plaza`) runs south from
`e3` (92, 30) to the head hall. One Thai-style hall per class, each with its
master (`src/data/halls.js`, `HALLS`). Region `halls` (ย่านสำนักครู).

| Hall | Class | Footprint centre | w × d | Door faces | Door | Master spot | Junction |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `hall_muaythai` ค่ายมวยไทย | muaythai | 98, 115 | 15 × 11 | north | 98, 108.7 | 98, 111.5 | `hq_s` |
| `hall_warrior` สำนักดาบนักรบ | warrior | 107.5, 62 | 13 × 11 | west | 101.2, 62 | 104, 62 | `hq_1` |
| `hall_hunter` ทับนายพราน | hunter | 107.5, 78 | 13 × 11 | west | 101.2, 78 | 104, 78 | `hq_2` |
| `hall_herbalist` สำนักหมอยา | herbalist | 107.5, 94 | 13 × 11 | west | 101.2, 94 | 104, 94 | `hq_3` |
| `hall_shaman` ตำหนักหมอผี | shaman | 87, 85.5 | 11 × 9 | east | 92.3, 85.5 | 89.5, 85.5 | `hq_3` |
| `hall_assassin` เรือนโจรป่า | assassin | 87, 98.5 | 10 × 9 | east | 92.3, 98.5 | 89.5, 98.5 | `hq_s` |

Each hall's yard is reserved as an `earth` rect in `PLAZAS`, so the house
filler and gardens keep out. Spots for the builder: `hallSpots()` →
`<hall id>_master` (link `<hall id>_door`) and `<hall id>_door` (link: junction).
The old ลานฝึกครู yard (ring, dummies, targets, camps) stays as the shared
practice ground.

## ทุ่งนอกเมือง (`fields`) — not safe

Zones from the warp outward. Phases: morning, day, evening, night
(`DAYLIGHT` = morning/day/evening).

| Zone | Where | Level | Day | Night | Landmark |
| --- | --- | --- | --- | --- | --- |
| Warp yard / farmers' village | 0, -130 / -62, -132 | — | safe ground, gate guards, herbalist (morning) | quiet | `outer_warp`, `farm_village` |
| ทุ่งนาหลวง rice fields (west) | x -118 … -13, z -150 … -255 | — | gathering, no monsters | quiet | `rice_fields` |
| สวนผลไม้ orchards (east) | `orchard_boars` 56, -172 r13; `orchard_monkeys` 86, -214 r14 | 1-2 | boar ×4, monkey ×4 | empty (beasts sleep) | `orchards` |
| ทุ่งหญ้าชายป่า grassland | `grassland` -34, -276 r16 | 1-3 | boar ×3, monkey ×1 | ผีป่า ×3 | `banyan` (12, -280) |
| ชายป่า forest edge | `forest_edge` 26, -334 r15 | 2-4 | monkey ×3 | ผีป่า ×3, ผีพราย ×1 | `forest_gate` (4, -310) |
| ป่าทึบ dense forest | `dense_forest` -28, -372 r18 | 2-4 | monkey ×2, ผีป่า ×2 | ผีป่า ×2, ผีพราย ×3 | `ruined_chedi` (-48, -368) |
| ป่าลึก deep forest (past the log bridge) | `deep_forest` 42, -456 r20 | 4-5 | ผีพราย ×3 | ผีพราย ×2, วิญญาณ ×3 | — |
| ศาลร้างกลางไพร | `abandoned_shrine` -36, -470 r9 | 5 | — | วิญญาณ ×2 (evening, night) | `forest_shrine` (hidden) |
| สุสานเก่า cemetery | `cemetery_path` 4, -492 r11; `cemetery_graves` 14, -548 r10 | 5-7 | empty, eerie | วิญญาณ ×3 (evening, night); ผีตายโหง ×2 + วิญญาณ ×1 | `cemetery` (hidden; reveals the region name) |

Elite / boss slots, not placed yet (content-designer decides when):
เสือสมิง (tiger) in the deep forest at night, กระสือ (krasue, rare) among the
cemetery stupas, ปอบ (pop, boss) in the ruined ordination hall (0, -568).

Death on the fields respawns at the warp yard (0, -130), or the farmers'
village if that is blocked.

Next zone: a dungeon below the ruined ordination hall, reached from the cemetery.
