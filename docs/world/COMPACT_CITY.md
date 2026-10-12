# Compact city — production layout

The `city` map is **นครที่ถูกลืมเลือน**. This layout replaces the former city,
not a second destination or a preview. Source: `src/world/compact-city.js`.
Its playable envelope is 144 × 128 units (x ±72, z ±64), with spawn at (0,8).
The old envelope was 244 × 374.5; this measures bounds, not navigable land.

## Districts and services

The central plaza joins four daily services: equipment/refinement to the
northwest, medicine northeast, general goods southwest, and storage southeast.
ลุงดำ sells equipment at (-17,-13); หมื่นเพชรศาสตรา refines it at (-17,-17).
They share one forge building while retaining separate interactions. Existing
inventories, prices, proximity checks, dialogue and quest IDs are unchanged.

| Destination | Exterior contact (x,z) |
| --- | --- |
| General goods | -17,12 |
| Medicine | 17,-17 |
| Storage | 17,12 |
| Occult supplies | -42,17 |
| Main warp keeper / storage | 17,12 |
| Temple / abbot | -52,-31 |
| Muay Thai master | -16,-39 |
| Warrior master | 15,-39 |
| Hunter master | 41,-43 |
| Herbalist master | 43,-15 |
| Shaman master | -42,12 |
| Assassin master | 43,35 |
| Port / boatman | 0,55 |
| Paddy portal | 0,-59 |

All six class halls remain. Four training dummies stand on the northern
practice ground at z=-35 (x=-6,-2,2,6). The temple occupies the northwest,
the shaman house the west, homes and warehouses the south, and the river the
southern backdrop. Six city warp keepers retain their original destination IDs.
The paddy portal still arrives at (0,-130); returning enters city at (0,-53),
outside the exit trigger. City remains safe and has no monster spawns.

## Shared contracts

- `compact-city.js`: buildings, roads, bounds, spawn and layout revision 2.
- `CompactCityWorld.js` / `compact-city-render/buildCityArt.js`: production
  geometry, local resources, Thai roofs, shop props, planting and river scenery.
- `compactCityNpcs.js`: mapped legacy aliases and explicit service contacts.
  Both the rendered NPC schedules and server contact registry use this data.
- `halls.js`, `warpServices.js`, `landmarks.js`, `training.js`: shared gameplay
  destinations. NPC IDs and discovery IDs remain stable.
- `NavGraph.fromCompactCity`: collision-aware connectors, including literal
  schedule stops, so NPC routes do not cut through buildings.

Building footprint reservations are solid. Portal pillars are added to both
runtime and baked server collision. Terrain is flat at y=0, with paving within
a small step of it; water starts outside the southern playable boundary.
Decoration does not introduce unregistered upright obstacles in the roads.

`CityMap.js` remains the frozen global backdrop and wilderness generator.
`legacy-city-halls.js` and `legacy-city-sites.js` preserve its original
reservations and random sequence. They are **not current city destinations**.
Do not substitute current service coordinates into those legacy builders:
that changes procedural trees and collision on other maps.

## Save migration

The map key stays `city`. Local and server-authoritative saves include
`layoutRevision: 2` for city positions. Unversioned, old, unknown or malformed
revision city saves move once to the new spawn, even if the old coordinates
would numerically fit. Valid revision-2 positions resume normally; blocked
or out-of-bounds positions fall back safely. This only relocates position:
character level, items, class, currency, quests and discovery remain intact.
Other maps keep their original coordinates and save format.

Regular saves, HTTP saves, vault transfers and player trades all capture
positions through `server/player-location.js`. Atomic inventory transactions
therefore keep the city revision even if the server stops before its next save.

## Architectural treatment

The six schools have different structures: an open Muay Thai pavilion, a tall
sword hall with two lower wings, a raised thatched hunting lodge, a herbal
veranda with planted side bays, a layered ceremonial shaman porch, and a
staggered-roof timber assassin house. Existing class emblems reinforce the
silhouettes. Timber braces, framed windows, boarded galleries and substantial
gable/eave details use the shared Thai architectural kit.

Tile, thatch and yantra maps are cloned locally; wood grain, masonry joints
and plaza slabs use small repeating textures. The temple and chedi have lower
detail distant meshes. Repeated details are instanced or merged spatially.
Night lanterns expose their glowing bodies between separate metal end caps.
All new solid details stay within canonical building reservations or outside
the playable bounds; the central paths remain clear.

## Review and validation

- Interactive production view: `/tools/compact-city-production.html`.
- Real account-entry/game QA: `tools/compact-city-production-qa.mjs`.
- [QA results](../technical/qa/compact-city-production.md).
- [Art review](../art/compact-city-production/ART_REVIEW.md).

The environment reuses and adapts the existing architectural kit; no paid
Meshy generation was started. Existing Meshy NPC models remain in use.
