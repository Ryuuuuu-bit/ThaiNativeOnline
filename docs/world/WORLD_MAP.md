# World Map Direction

Owner: world-designer. Coordinates are world space (`src/world/CityMap.js`):
`+x` east, `-z` north, the river to the south. Maps: `src/world/maps.js`
(interface: `src/world/README.md`).

Progression, one map at a time (Ragnarok-style, linked by portals):
นครอโยธยา (city, safe) → warp → ทุ่งนาข้าว (paddy, Lv 1-3) → path → ป่าลึก
(deep_forest, Lv 2-5) → path → วัดร้าง (wat_rang, Lv 4-7) → (dungeon under the
ruined temple, later).

Every zone below gives its gameplay purpose, level band, safe area, farming
area, landmark, elite/boss slot and the way on. Geography is intentional: the
farther from the city, the wilder, darker and stronger it gets.

## Maps

| id | Name | Band | Walk area | Safe | Levels | Who / why |
| --- | --- | --- | --- | --- | --- | --- |
| `city` | นครอโยธยา | `z ≥ -112` (`SEAM_Z`) | x ±122, z -108.5 … 266 (inside the walls, port, river bank) | yes | — | everyone: trade, equipment, quests, class halls, training dummy |
| `paddy` | ทุ่งนาข้าว | `-296 ≤ z < -112` | x ±122, z -293 … -113.5 | no | 1-3 | new characters: first hunts in the orchards, farmers' village shop, gathering in the paddies |
| `deep_forest` | ป่าลึก | `-445 ≤ z < -296` (`FOREST_SEAM_Z`) | x ±122, z -442 … -298.5 | no | 2-5 | mid levels: forest spirits by day and night, the ruined chedi, the log bridge |
| `wat_rang` | วัดร้าง | `z < -445` (`WAT_SEAM_Z`) | x ±122, z -592 … -447 | no | 4-7 | strongest characters, mostly evening and night: the wandering dead, the cemetery, the temple ruins and the boss |

The seams follow the scenery: the paddy map ends in the grassland just past the
banyan (z -284) before the forest gate (z -305); the forest map runs across the
stream and log bridge into the deep forest and ends before the abandoned
shrine (z -478). Walk areas stop 4.5-5.5 m short of each seam, so maps never
touch; each map's `view` builds the neighbouring land as backdrop.

### Portals

| Portal | Style | Map | Trigger (x, z, r) | Arrives at | NPC exit node | Label |
| --- | --- | --- | --- | --- | --- | --- |
| `warp_to_paddy` | warp | city | 0, -107, 2.2 (in the gate passage) | paddy 0, -130, facing north | `gate_in` | ประตูวาป → ทุ่งนาข้าว |
| `warp_to_city` | warp | paddy | 0, -122.5, 2.2 (outside the gate) | city 0, -99, facing south | `gate_out` | ประตูวาป → นครอโยธยา |
| `path_to_forest` | path | paddy | -0.9, -290, 2.4 (north road past the banyan) | deep_forest 0, -311, facing north | `n6` | ทางเข้าป่า → ป่าลึก |
| `path_to_paddy` | path | deep_forest | 0, -301, 2.4 (outside the forest gate rope) | paddy -1.6, -282, facing south | `fe` | ทางออกสู่ทุ่ง → ทุ่งนาข้าว |
| `path_to_wat` | path | deep_forest | 8.5, -439, 2.4 (trail beyond the log bridge) | wat_rang -1.5, -459, facing north | `f5` | ทางสู่วัดร้าง → วัดร้าง |
| `path_to_deep_forest` | path | wat_rang | 3, -450, 2.4 (trail head) | deep_forest 10.5, -429, facing south | `f6` | ทางกลับป่าลึก → ป่าลึก |

The city warp pair is magic (the gate is closed). Between the wild maps the
trail itself leads on: chevrons on the ground and a signpost beside the trail.

From the city spawn (port, 4, 151) the warp is reached along the main avenue:
port → fish market → market → bridge → ศาลหลักเมือง → avenue → gate.

Old saves on the retired `fields` map load on the zone map that owns the saved
position; a position in a gap between walk areas moves to that map's nearest
arrival point (`resolveLocation`).

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

## The zone maps

Phases: morning, day, evening, night (`DAYLIGHT` = morning/day/evening). Spawn
areas: `src/data/spawns.js`; no area reaches a portal arrival point.

### ทุ่งนาข้าว (`paddy`) — Lv 1-3, not safe

Who: new characters fresh from the city. Why: the first hunts, restocking at
ยายเพียร's shop, farmers' stories, gathering in the paddies (later). Safe
ground: the warp yard (gate guards) and the farmers' village.

| Zone | Where | Level | Day | Night | Landmark |
| --- | --- | --- | --- | --- | --- |
| Warp yard / farmers' village | 0, -130 / -62, -132 | — | safe ground, gate guards, herbalist (morning), ยายเพียร's shop | quiet | `outer_warp`, `farm_village` |
| ทุ่งนาหลวง rice fields (west) | x -118 … -13, z -150 … -255 | — | gathering, no monsters | quiet | `rice_fields` |
| สวนผลไม้ orchards (east) | `orchard_boars` 56, -172 r13; `orchard_monkeys` 86, -214 r14 | 1-2 | boar ×4, monkey ×4 | empty (beasts sleep) | `orchards` |
| ทุ่งหญ้าชายป่า grassland | `grassland` -40, -268 r16 | 1-3 | boar ×3, monkey ×1 | ผีป่า ×2 | `banyan` (12, -280) |

Way on: the north road past the banyan → `path_to_forest`. Death respawns at
the warp yard (0, -130), or the farmers' village if that is blocked.

### ป่าลึก (`deep_forest`) — Lv 2-5, not safe

Who: characters past their first levels. Why: forest spirits for loot, the
ruined chedi, the crossing into the deep forest. Safe ground: just inside the
forest gate, where หมอแสง sells medicine day and night.

| Zone | Where | Level | Day | Night | Landmark |
| --- | --- | --- | --- | --- | --- |
| ศาลปากป่า forest gate | arrival 0, -311 | — | หมอแสง (supplier) | หมอแสง | `forest_gate` (4, -310) |
| ชายป่า forest edge | `forest_edge` 26, -336 r15 | 2-4 | monkey ×3 | ผีป่า ×3, ผีพราย ×1 | — |
| ป่าทึบ dense forest | `dense_forest` -28, -372 r18 | 2-4 | monkey ×2, ผีป่า ×2 | ผีป่า ×2, ผีพราย ×3 | `ruined_chedi` (-48, -368) |
| ลำธาร stream / log bridge | bridge -4, -397 … -414 | — | crossing (choke point) | crossing | `log_bridge` (-4, -404) |
| ไพรลึกเหนือลำธาร deep forest | `deep_forest` 48, -423 r12; `deep_west` -52, -428 r13 | 3-5 | ผีพราย ×3; ผีป่า ×1 + ผีพราย ×2 | ผีพราย ×2 + วิญญาณ ×3; ผีพราย ×2 + วิญญาณ ×1 | — |

Elite slot (not placed): เสือสมิง (tiger) in the deep forest at night.
Way on: the trail beyond the log bridge → `path_to_wat`. Death respawns inside
the forest gate (0, -311).

### วัดร้าง (`wat_rang`) — Lv 4-7, not safe, mostly evening and night

Who: the strongest characters. Why: the wandering dead and their loot, the
hidden shrine and cemetery, and (later) the boss in the ruined temple. Safe
ground: the trail head, where ตาฤๅษีพรหม sits day and night selling medicine.

| Zone | Where | Level | Day | Night | Landmark |
| --- | --- | --- | --- | --- | --- |
| Trail head | arrival -1.5, -459 | — | ตาฤๅษีพรหม (supplier) | ตาฤๅษีพรหม | — |
| ดงวัดร้าง woods around the ruins | `wat_grove` 46, -480 r16 | 4-5 | ผีพราย ×3 | วิญญาณ ×3 | — |
| ศาลร้างกลางไพร | `abandoned_shrine` -36, -470 r9 | 5 | — | วิญญาณ ×2 (evening, night) | `forest_shrine` (hidden) |
| ป่าช้า cemetery path and graves | `cemetery_path` 4, -492 r11; `cemetery_graves` 14, -548 r10 | 5-7 | empty, eerie | วิญญาณ ×3 (evening, night); ผีตายโหง ×2 + วิญญาณ ×1 | `cemetery_gate` (0, -500), `cemetery` (hidden; reveals the region name) |
| วัดร้าง temple ruins (reserved, not built) | site 48 … 104 × -572 … -508 | 5-7 | — | suggested: ผีตายโหง, วิญญาณ (evening, night) | — |

Elite / boss slots, not placed yet (content-designer decides when): กระสือ
(krasue, rare) among the stupas of the temple site at night (`WAT_RANG.spots.rare`,
70, -562), ปอบ (pop, boss) in the ruined ordination hall of the temple site
(`WAT_RANG.spots.boss`, 90, -540). Until the site is built, the small ruined
ubosot inside the cemetery (0, -568) is the fallback boss spot.

Death respawns at the trail head (-1.5, -459).

#### Reserved site: วัดร้าง temple complex (`src/data/sites.js`, `WAT_RANG`)

East of the cemetery, facing west toward it: rectangle centre 76, -540,
frontage `w` 64 (along z, -572 … -508), depth `d` 56 (along x, 48 … 104),
`facing` -π/2. Main gate at 46.5, -540, 12 m east of the cemetery wall; the
approach trail starts at the cemetery's east path `cem_e` (18, -546). Suggested
parts: crumbling outer wall (inset 1.5), laterite courtyard (66, -540), the
broken main chedi (64, -540, r 6), the ruined ordination hall at the back
(88, -540, 12 × 22, facing west, the boss arena), a collapsed sala (62, -518)
and three bone stupas. Spots: boss (90, -540), rare (70, -562), gate NPC
(44.5, -536), yard NPC (60, -522), hunters' camp (40, -548). Today the ground is
random deep forest; the builder reserves it (a `rect` PLAZAS entry, like the
hall yards) and adds the approach road after the last `ROADS` entry.

Next zone: a dungeon below the ruined ordination hall.
## Gateway and hunting navigation update (October 2026)

The implemented registry contains five maps: city → paddy → deep_forest →
wat_rang → klong. All eight existing connections now have walk-through Thai
fantasy gateway frames. Destination and trigger coordinates are unchanged;
`path` remains the route classification for the wild connections.

Gate materials follow the map: sandstone/brass in the city, wood in the paddies,
moss stone in the forest, muted violet stone in the ruins and teal stone by the
marsh. Gentle ground inscriptions and wisps use unlit effects without point lights.
Nearby labels show destination level bands or the city's safe status.
Vegetation stays back around the gateways so their silhouettes remain visible.
The shared pillar anchors are baked into server collision with a clear centre.

Two new hunting signs per outdoor map show names and monster level bands. Gold
crossed-sword markers appear on both maps; clicking a marker on the full map
walks to its clear approach point. The city has no hunting spawns.

## Expedition geography through level 100

Current registry: 13 maps and 24 directed portal connections. Eight expedition
maps continue the existing chain after klong; IDs and palettes live in
`src/world/expeditions.js`. Each has a 240 m ownership band starting at z=-820,
then -1060, -1300, -1540, -1780, -2020, -2260 and -2500. Walk rectangles are
x=-112…112, top-236…top-4. Built views include a margin and remain inside the
server's 3000 m coordinate bound. Original city geography is not stretched.

`ExpeditionWorld.js` builds the expedition scene independently, with shared
sampled terrain for client/server, three loop trails, theme props, Thai rest
pavilion, supplier and gateway anchors. Rest clearings avoid monster aggro but
are not a new PK-protected subzone. Expedition ownership is resolved by the same
map registry as saves, server rooms, parties, social labels and minimap routes.

The first gate from klong is (0,-795), arriving at bamboo_grave (0,-844).
Returning arrives at (18,-782), outside existing marsh aggro areas. Subsequent
gates are at x=0, top-232 (forward) and top-8 (back), with arrivals top-24 and
previous top-216. The final map has the return gate only. Every connection has a
standable centre, colliding pillars and a reachable approach.

The initial scenes use procedural scenery and need further art polish. No new
water traversal or underwater breathing system is implied by นครบาดาล.
