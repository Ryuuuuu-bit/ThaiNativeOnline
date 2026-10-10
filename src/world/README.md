# World public interface

Owned by world-designer (maps, MapManager, portals, collision), environment-artist (buildings, vegetation, terrain, districts) and technical-artist (shaders, materials, lighting); see CLAUDE.md. Other systems may rely only on what
this page lists; changes to it must be documented here and in the PR.

## Maps (`maps.js`)

The game has four maps, built one at a time (each will become one server room),
Ragnarok-style: the city inside the walls and three zone maps north of it, one
loaded at a time and linked by portals. The North City Gate (ประตูเมืองทิศเหนือ)
stays closed and the walk areas end on either side of the wall; a pair of
warps (ประตูวาป) links the city with the paddies. The wild maps are joined by
path exits on the trail. Layout, purposes and level bands:
`docs/world/WORLD_MAP.md`.

| id | Name | Band (`owns`) | Walk | Theme | Levels | Contains |
| --- | --- | --- | --- | --- | --- | --- |
| `city` | นครอโยธยา | z ≥ -112 | x ±122, z -108.5 … 266 | `city` | — | River and port, market, shops, temple, residential streets, the class training halls (ย่านสำนักครู), the closed north gate with the warp in its passage. Safe zone, no monsters |
| `paddy` | ทุ่งนาข้าว | -296 ≤ z < -112 | x ±122, z -293 … -113.5 | `paddy` | 1-3 | Rice fields, farmers' village (ยายเพียร's shop), orchards, grassland, the banyan |
| `deep_forest` | ป่าลึก | -445 ≤ z < -296 | x ±122, z -442 … -298.5 | `forest` | 2-5 | Forest gate, dense forest and the ruined chedi, the stream and log bridge, the deep forest beyond it |
| `wat_rang` | วัดร้าง | z < -445 | x ±122, z -592 … -447 | `wat` | 4-7 | Woods around the ruins, the abandoned shrine, the old cemetery, the reserved temple site (`src/data/sites.js`) |

Seams: `SEAM_Z` (-112), `FOREST_SEAM_Z` (-296), `WAT_SEAM_Z` (-445). Neighbouring
walk areas stay at least 4 m apart.

| Portal | Style | On | Trigger `at` | `arrive` | `node` |
| --- | --- | --- | --- | --- | --- |
| `warp_to_paddy` | warp | city | 0, -107, r 2.2 (gate passage) | paddy 0, -130, facing π | `gate_in` |
| `warp_to_city` | warp | paddy | 0, -122.5, r 2.2 (outside the gate) | city 0, -99, facing 0 | `gate_out` |
| `path_to_forest` | path | paddy | -0.9, -290, r 2.4 (north road past the banyan) | deep_forest 0, -311, facing π | `n6` |
| `path_to_paddy` | path | deep_forest | 0, -301, r 2.4 (outside the forest gate rope) | paddy -1.6, -282, facing 0 | `fe` |
| `path_to_wat` | path | deep_forest | 8.5, -439, r 2.4 (trail beyond the log bridge) | wat_rang -1.5, -459, facing π | `f5` |
| `path_to_deep_forest` | path | wat_rang | 3, -450, r 2.4 (trail head) | deep_forest 10.5, -429, facing 0 | `f6` |

Coordinates stay in world space (the same as `CityMap.js`), so landmarks,
quests, spawns and NPC data need no conversion. Each `MAPS[id]` entry is data:

| Field | Meaning |
| --- | --- |
| `name`, `sub`, `safe` | Display name, subtitle (the fade overlay shows both), whether the map is a safe zone |
| `theme` | Display key for the HUD and minimap: `'city'` \| `'paddy'` \| `'forest'` \| `'wat'` (pick a palette per key; the map data holds no colours) |
| `levels` | `[min, max]` monster level band on the map, `null` on safe maps (every placed monster's level lies inside it; tested) |
| `owns` | `{ minZ, maxZ }` band the map is responsible for (see the seams above); every landmark, spawn area and NPC home lies in exactly one band (`mapOf()` is null only outside the world) |
| `walk` | Rectangles the player may stand in (union). Leaving them is only possible through a portal |
| `view` | Built extent: terrain, ground paint and scenery. Wider than `walk` (at least 17 m past each seam) so the camera never sees an edge; near a seam it shows the neighbouring map as non-interactive backdrop |
| `spawn`, `respawn` | Default arrival `{ x, z, facing }`; candidate respawn points after death |
| `entities` | Optional scenery systems to build (`boats`, `animals`) |
| `regions` | Region ids (`src/data/regions.js`) that occur on the map |
| `portals` | `{ id, style, at: { x, z, radius }, to, arrive: { x, z, facing }, node, name, marker }`. Walking into `at` moves the player to map `to` at `arrive` (never inside a trigger there). `node` is the junction visiting NPCs walk to when they leave (`portals[0]` is the exit visitors use). `name` is the label's title; the label adds `→ <destination name>`. `style`: `'warp'` (default) draws the ประตูวาป at `marker` (ground ring, turning yantra ring, light veil, label); `'path'` draws chevrons on the ground at `at`, pointing out of the map, and a wooden signpost with a board label at `marker` (beside the trail) |
| `visitors` | NPC ids from another map whose schedule also brings them here |

`LEGACY_MAPS` lists retired map ids and the maps that replaced them (`fields` →
`paddy`, `deep_forest`, `wat_rang`).

Helpers: `mapOf(x, z)` (owning map), `walkable(map, x, z)`, `inView(map, x, z)`,
`walkBounds(map)`, `portalAt(map, x, z)`, `arrivalsOn(id)` (arrival points of
the portals leading to a map), `resolveLocation(saved)` (a saved location made
valid: a retired or unknown map id becomes the map owning the position, and a
position between two walk areas moves to that map's nearest arrival point;
`null` if nothing fits), `landmarksOf(id, list)`, `spawnsOf(id, list)`,
`npcHome(def)`, `npcMap(def)` (an NPC may declare `map`, otherwise it is
inferred from `home.near` or its first schedule junction) and
`npcsForMap(defs, id, has)`, which returns a map's residents plus visitors with
activities at spots that are not on the map turned into "home".

Facing angles are yaws where `0` looks toward `+z` (south) and `π` looks north.

### Data the minimap can read

Per map: `name`, `sub`, `theme`, `levels`, `walkBounds(map)` / `walk`, `view`,
`portals` (`at`, `marker`, `style`, `to`, `name`), `regions`. Per loaded map
from `MapManager`: `landmarks` (with `hidden`, `icon`, `purpose`),
`spawnAreas` (`SPAWNS` entries: `x, z, radius, monster, active`), `npcs`
(the `NPCManager`) and `world.footprints`. Reserved sites for later structures
come from `src/data/sites.js` (`SITES`, each with a `map`).

## `MapManager` (`MapManager.js`)

Keeps exactly one map in the scene and moves the player between maps.

```js
const maps = new MapManager({ scene, clock, player, progress, onChange, onLeave });
await maps.start(MapManager.startLocation(params)); // ?at=x,z[&map=id] (the map follows from z if omitted), saved location (through resolveLocation), or city spawn
maps.attachCombat(rpg);   // after createGame(): hides monsters of maps that are not loaded
maps.update(dt, elapsed); // every frame after the player moves: portals, autosave
maps.busy                 // true while maps swap (skip movement and world updates)
maps.map, maps.world, maps.npcs           // the loaded map entry, buildWorld() result, NPCManager
maps.landmarks, maps.spawnAreas           // this map's LANDMARKS and SPAWNS
maps.zones                // combat spawn zones for createGame({ spawns }); only the loaded map's are active
maps.respawn              // { x, z } for createGame({ respawnPoint }); updated per map
maps.travel(portal)       // what update() calls when the player walks into a portal
```

A transition fades a DOM overlay in (`#map-fade`), calls `onLeave`, despawns the
old map's monsters and releases their GPU buffers, disposes the old NPCs and
the whole map (geometries, materials, textures, instanced meshes), builds the
new map (terrain, collision, nav graph, NPCs, portals), places the player at
`arrive`, calls `onChange({ map, world, npcs, from })` (Game rebuilds the
minimap and debug overlay there) and fades out. The clock, character, combat
state, inventory and quests live outside the map and are untouched.

The current map and position are saved in the character's save slot
(`slotStorage`, `src/core/SaveSlot.js`) under `tno.location.v1`
(`{ map, x, z, facing }`) every 3 s, after each transition and on unload, so a
reload returns to the same map. Saves of the retired `fields` map load on the
zone map that owns their position (`resolveLocation`).

Transitions prepare the destination under a detached group before unloading the
current map. If preparation fails, partial resources and NPC subscriptions are
released, the old map and position remain usable, and the fade/busy state clears.
The portal is disarmed until the player walks outside its trigger. No `onChange`
or multiplayer room change is emitted for a failed preparation.
`lastTravelError` retains the error for diagnostics; `travel()` resolves `false`
on failure and `true` on success. Expedition resource disposal is idempotent and
also releases each `InstancedMesh` instance buffer.

## `buildWorld(scene, progress?, map?) → Promise<world>` (`World.js`)

Builds one map (`map` is an id or a `MAPS` entry, default `city`) under its own
root group: terrain, water, districts, vegetation, atmosphere, portals and, if
listed, boats and animals. `progress(text)` receives loading messages. Every
district runs for every map with the same random sequence and a world-wide
occupancy grid, so layouts are identical on both sides of the seam; whatever
lies outside `map.view` is dropped before it is batched.

| Member | Meaning |
| --- | --- |
| `map`, `root` | The `MAPS` entry and the group holding everything built |
| `heightAt(x, z) → number` | Walkable surface height: terrain, or a deck (pier, bridge) where one exists |
| `canStand(x, z) → boolean` | Inside the map's `walk` area, not blocked by static collision, not in deep water unless on a deck |
| `contains(x, z) → boolean` | Inside the map's `walk` area (nav graph and NPC spots use it) |
| `speedAt(x, z) → number` | Movement multiplier: `0.62` in paddies and channels, otherwise `1` |
| `update(t, dt, focus, env)` | Per-frame animation (wind, grass, atmosphere, boats, animals) |
| `dispose()` | Remove the map from the scene and free its GPU resources |
| `spots` | NPC anchors `{ id: { x, z, face, link } }` on the walkable area; `link` is a road junction or another spot |
| `footprints`, `market` | Placed building footprints and market stalls (minimap, NPC data) |
| `terrain`, `collision`, `ground`, `water`, `grass`, `atmosphere`, `boats`, `animals` | Subsystems, for debugging and tooling (`boats`/`animals` may be `null`) |
| `stats` | Build counts and timings (developer overlay) |

Coordinates: metres-like units, `+x` east, `-z` north, river to the south (`+z`).

## `CityMap.js`

Pure geography with no Three.js, safe to import from Node and from tests:
`BOUNDS`, `WALL`, `J` (named road junctions), `ROADS`, `PLAZAS`, `PADDIES`,
`CANAL`, `STREAM`, `POND`, `CEMETERY`, and the functions `terrainHeight`,
`waterAt` (`0` dry, `1` shallow, `2` deep), `riverBank`, `wildness`,
`cemeteryFactor`, `insideWalls`, `paddyAt`.

Junction ids in `J` are referenced by NPC routes (`src/data/npcs.js`) and by
`NavGraph`. Renaming or removing one is an interface change.

`PLAZAS` entries with `rect: true` reserve their whole rectangle in the
occupancy grid (`seedOccupancy`); the training-hall yards are such rects
(`hall: <hall id>`), generated from `src/data/halls.js`. The quarter's lane
(`e3 → hq_n → hq_1 → hq_2 → hq_3 → hq_s`) is the last entry of `ROADS` and of
kind `plaza`, so no houses or street trees are placed along it and the random
layout of every other road is unchanged. Keep new roads after it, or expect the
house layout to change.

## Training halls (`src/data/halls.js`)

`HALLS`: one record per class `{ id, classId, name, text, x, z, w, d, facing,
door: {x,z}, master: {x,z,face}, junction, yard: {x,z,rx,rz}, spots }`.
`facing` is the yaw the front door faces and the rotation to pass to
`ctx.place()` (a structure's local `+z` side is its front). `hallOf(classId)`
finds a class's hall; `hallSpots()` lists the NPC anchors the builder registers
with `ctx.spot(id, x, z, face, link)`: `<id>_master → <id>_door → junction`.
Each hall has a landmark with the same id (purpose `skills`).
The buildings are built by `districts/Halls.js` (`buildHalls(ctx)`, run after
the temple and before the spot links and houses); it also registers the spots.
`world.stats.halls` reports `{ count, triangles, props }`.

## วัดร้าง temple ruins (`src/data/sites.js` `WAT_RANG`)

Built by `districts/WatRang.js` (`buildWatRang(ctx)`, run after `buildWilds` and
before the spot links) on the `wat_rang` map: ruined ordination hall (the boss
arena; walkable deck, intact weathered seated Buddha on the dais), leaning
main chedi, three bone stupas, half-fallen sala, bodhi tree growing out of a
broken wall, low broken boundary wall with the ruined west gate, hunters' camp,
spirit houses and cold `spirit-night` ghost lights. It draws only from its own
random sequences (`createRng`, `veg.isolated(seed, fn)`), so the shared sequence
and every later layout are unchanged. `world.stats.watRang` reports
`{ triangles, props, glows }`.

- `CityMap.js` (world-designer data, environment-artist hook): `PLAZAS` entry of
  kind `'ruin'` over the whole site (`rect`, `site`, `yard` = the courtyard
  ellipse); junctions `wat_cw` (the breach in the cemetery wall) and `wat_g`
  (before the gate); the approach trail `cem_e → wat_cw → wat_g` is the last
  `ROADS` entry and carries `site: 'wat_rang'`.
- `Terrain.js`: kind `'ruin'` reserves the rectangle, paints weathered ground
  with broken paving in the yard and lets thin grass through (mask, not bare).
- `districts/Wilds.js`: roads with a `site` break the cemetery wall and clear
  graves off their line without changing the random sequence.
- Spots (`ctx.spot`, ids `wat_rang_<name>`): `boss` (90, -540) → `door` → `court_n`
  → `yard_npc` (60, -522) → `court_w` → `gate` (46.5, -540) → `wat_g`;
  `rare` (70, -562) → `court_s` → `court_w`; `gate_npc` (44.5, -536) and
  `camp` (40, -548) → `wat_g`. Links go round the chedi, never through it.

## `Environment.update(hour, focus) → state` (`Environment.js`)

Returns `{ hour, night, lantern, wild, cemetery }`, each `0..1` except `hour`.
Other systems may read these to match mood (for example monster strength or music).

## Hooks in shared folders

The map split needed small hooks outside `src/world`:

- `src/core/Game.js`: builds through `MapManager`; `world`/`npcs` are getters;
  `leaveMap()`/`enterMap()` close dialogue and shop, rebuild the minimap and
  debug overlay, reapply particle/quality settings; landmark discovery uses
  the loaded map's landmarks; combat queries the loaded world.
- `src/core/WorldClock.js`: `onPhase()` returns an unsubscribe function.
- `src/npc/NPCManager.js`: nav graph limited to `world.contains`; `dispose()`.
- `src/npc/NPCRenderer.js`: `dispose()`.
- `src/npc/NavGraph.js`: `fromRoads(keep?)` keeps only junctions where `keep(x, z)`.
- `src/entities/Animals.js`: field buffalo and egrets only where `ctx.keep(x, z)`.
- `src/ui/Minimap.js`: optional `{ bounds, landmarks, portals, discovered }`.
- `src/data/npcs.js`: NPCs homed at a district spot declare `map: 'city'`.
- `src/core/Game.js`: `enterMap()` (and once the character exists) calls
  `game.hud.setSafe(map.safe)`, so the fight tips (and Tab / Space) work only on maps with
  monsters; the action bar itself is the same on every map.
- `maps.js` `intro: { title, text }` (gameplay-engineer): the journal panel's heading and
  lines for each map, set by `Game.updateJournal()` → `HUD.setJournal()`.
- `src/world/Terrain.js` `seedOccupancy()`: `PLAZAS` with `rect: true` are marked as rectangles.

Combat (`src/combat`) is not modified. Its spawn zones carry a `map` tag and
the map manager sets each zone's `active` list to `[]` while its map is not
loaded; on a transition it despawns live monsters through
`combat.updateMonster(m, 0, playerPos)` and frees their view meshes on the
GPU. A `rpg.setActiveZones()` API in combat would make this bridge unnecessary.

## Checks

`npm test` runs `tests/world.test.js`, `tests/maps.test.js` and
`tests/two-maps-qa.test.js` in Node. They check road and bridge placement
against water, paddy generation, nav-graph connectivity, collision and deck
behaviour, clock phases, region names, and for the maps: exactly `city`,
`paddy`, `deep_forest` and `wat_rang`; ownership partitions the world at the
three seams; neighbouring walk areas stay 4 m apart and never overlap;
portals (warp pair city↔paddy, path exits paddy↔deep_forest↔wat_rang) arrive
on standable ground outside any trigger, lead back with the same style and sit
on the crossing road; every landmark/spawn area/NPC home lies on one map;
monster areas only on the zone maps, inside their walk area, with levels inside
each map's `levels` band and rising map by map; no monster reaches a portal
arrival; every unsafe map has a potion seller (the forest and wat suppliers
stand by the entrance, day and night); every zone map has at least three
landmarks; old `fields` saves resolve onto the right map; the วัดร้าง site stays
clear of the cemetery, roads, spawns and landmarks; each map's regions and nav
graph; and the training halls (one per class, inside the walls, reserved yards
that do not overlap roads, water or each other, spots chained to the lane).

Browser: `tests/browser/zones-probe.html` (see `docs/technical/VERIFY.md`)
walks city → paddy → deep_forest → wat_rang and back through every trigger.
