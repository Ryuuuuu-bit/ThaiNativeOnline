# World public interface

Owned by the World Agent (`src/world/**`). Other systems may rely only on what
this page lists; changes to it must be documented here and in the PR.

## `buildWorld(scene, progress?) → Promise<world>` (`World.js`)

Builds terrain, water, districts, vegetation, atmosphere, boats and animals into
`scene`. `progress(text)` receives loading messages.

| Member | Meaning |
| --- | --- |
| `heightAt(x, z) → number` | Walkable surface height: terrain, or a deck (pier, bridge) where one exists |
| `canStand(x, z) → boolean` | Inside the map, not blocked by static collision, not in deep water unless on a deck |
| `speedAt(x, z) → number` | Movement multiplier: `0.62` in paddies and channels, otherwise `1` |
| `update(t, dt, focus, env)` | Per-frame animation (wind, grass, atmosphere, boats, animals) |
| `spots` | NPC anchors `{ id: { x, z, face, link } }`; `link` is a road junction or another spot |
| `footprints`, `market` | Placed building footprints and market stalls (minimap, NPC data) |
| `terrain`, `collision`, `ground`, `water`, `grass`, `atmosphere`, `boats`, `animals` | Subsystems, for debugging and tooling |
| `stats` | Build counts and timings (developer overlay) |

Coordinates: metres-like units, `+x` east, `-z` north, river to the south (`+z`).
Faces are yaw angles where `0` looks toward `+z`.

## `CityMap.js`

Pure geography with no Three.js, safe to import from Node and from tests:
`BOUNDS`, `WALL`, `J` (named road junctions), `ROADS`, `PLAZAS`, `PADDIES`,
`CANAL`, `STREAM`, `POND`, `CEMETERY`, and the functions `terrainHeight`,
`waterAt` (`0` dry, `1` shallow, `2` deep), `riverBank`, `wildness`,
`cemeteryFactor`, `insideWalls`, `paddyAt`.

Junction ids in `J` are referenced by NPC routes (`src/data/npcs.js`) and by
`NavGraph`. Renaming or removing one is an interface change.

## `Environment.update(hour, focus) → state` (`Environment.js`)

Returns `{ hour, night, lantern, wild, cemetery }`, each `0..1` except `hour`.
Other systems may read these to match mood (for example monster strength or music).

## Checks

`npm test` runs `tests/world.test.js` in Node. It checks road and bridge
placement against water, paddy generation, nav-graph connectivity, collision
and deck behaviour, clock phases, region names, and that monster spawns stay
out of the city.
