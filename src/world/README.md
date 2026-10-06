# World public interface

Owned by world-designer (maps, MapManager, portals, collision), environment-artist (buildings, vegetation, terrain, districts) and technical-artist (shaders, materials, lighting); see CLAUDE.md. Other systems may rely only on what
this page lists; changes to it must be documented here and in the PR.

## Maps (`maps.js`)

The game has two maps, built one at a time (each will become one server room).
The North City Gate (ประตูเมืองทิศเหนือ) stays closed and the walk areas end on
either side of the wall; a pair of warps (ประตูวาป) links the maps. Layout,
purposes and level bands: `docs/world/WORLD_MAP.md`.

| id | Name | Contains |
| --- | --- | --- |
| `city` | นครอโยธยา | River and port, market, shops, temple, residential streets, the class training halls (ย่านสำนักครู), the closed north gate with the warp in its passage. Safe zone, no monsters |
| `fields` | ทุ่งนอกเมือง | Rice fields, farmers' village, orchards, grassland, forest, deep forest, abandoned shrine and the old cemetery. Not safe: every monster area is here |

| Warp | On | Trigger `at` | `arrive` | `node` |
| --- | --- | --- | --- | --- |
| `warp_to_fields` | city | 0, -107, r 2.2 (gate passage) | fields 0, -130, facing π | `gate_in` |
| `warp_to_city` | fields | 0, -122.5, r 2.2 (outside the gate) | city 0, -99, facing 0 | `gate_out` |

Coordinates stay in world space (the same as `CityMap.js`), so landmarks,
quests, spawns and NPC data need no conversion. Each `MAPS[id]` entry is data:

| Field | Meaning |
| --- | --- |
| `name`, `sub`, `safe` | Display name, subtitle, whether the map is a safe zone |
| `owns` | `{ minZ, maxZ }` band the map is responsible for. The city owns everything south of `SEAM_Z` (-112, just outside the wall), `fields` everything north of it; every landmark, spawn area and NPC home lies in exactly one band (`mapOf()` is null only outside the world) |
| `walk` | Rectangles the player may stand in (union). Leaving them is only possible through a portal |
| `view` | Built extent: terrain, ground paint and scenery. Wider than `walk` so the camera never sees an edge; near the seam it shows the neighbouring map as non-interactive backdrop |
| `spawn`, `respawn` | Default arrival `{ x, z, facing }`; candidate respawn points after death |
| `entities` | Optional scenery systems to build (`boats`, `animals`) |
| `regions` | Region ids (`src/data/regions.js`) that occur on the map |
| `portals` | `{ id, at: { x, z, radius }, to, arrive: { x, z, facing }, node, name, marker }`. Walking into `at` moves the player to map `to` at `arrive` (never inside a trigger there). `node` is the junction visiting NPCs walk to when they leave; `marker` is where the warp (`Portals.js`: ground ring, turning yantra ring, light veil, label) is drawn |
| `visitors` | NPC ids from another map whose schedule also brings them here |

Helpers: `mapOf(x, z)` (owning map), `walkable(map, x, z)`, `inView(map, x, z)`,
`walkBounds(map)`, `portalAt(map, x, z)`, `landmarksOf(id, list)`,
`spawnsOf(id, list)`, `npcHome(def)`, `npcMap(def)` (an NPC may declare `map`,
otherwise it is inferred from `home.near` or its first schedule junction) and
`npcsForMap(defs, id, has)`, which returns a map's residents plus visitors with
activities at spots that are not on the map turned into "home".

Facing angles are yaws where `0` looks toward `+z` (south) and `π` looks north.

## `MapManager` (`MapManager.js`)

Keeps exactly one map in the scene and moves the player between maps.

```js
const maps = new MapManager({ scene, clock, player, progress, onChange, onLeave });
await maps.start(MapManager.startLocation(params)); // ?at=x,z[&map=id] (the map follows from z if omitted), saved location, or city spawn
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
reload returns to the same map.

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
  `game.hud.setSafe(map.safe)`, so the combat skill bar shows only on maps with monsters.
- `src/world/Terrain.js` `seedOccupancy()`: `PLAZAS` with `rect: true` are marked as rectangles.

Combat (`src/combat`) is not modified. Its spawn zones carry a `map` tag and
the map manager sets each zone's `active` list to `[]` while its map is not
loaded; on a transition it despawns live monsters through
`combat.updateMonster(m, 0, playerPos)` and frees their view meshes on the
GPU. A `rpg.setActiveZones()` API in combat would make this bridge unnecessary.

## Checks

`npm test` runs `tests/world.test.js` and `tests/maps.test.js` in Node. They
check road and bridge placement against water, paddy generation, nav-graph
connectivity, collision and deck behaviour, clock phases, region names, and for
the maps: exactly `city` and `fields`, ownership partitions the world at the
seam, the walk areas never touch, warps arrive on standable ground outside any
trigger and lead back, every landmark/spawn area/NPC home lies on one map,
monster areas are on the fields only with levels rising away from the warp,
visitors leave through the warp, each map's regions and nav graph, and the
training halls (one per class, inside the walls, reserved yards that do not
overlap roads, water or each other, spots chained to the lane).
