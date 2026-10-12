# Compact city — production layout

The `city` map is **นครที่ถูกลืมเลือน**. This layout replaces the former city,
not a second destination or a preview. Source: `src/world/compact-city.js`.
Its playable envelope is 144 × 128 units (x ±72, z ±64), with spawn at (0,3).
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
- `compact-city-neighborhoods.js`: 16 infill lots and 12 solid garden beds,
  shared by the renderer, client navigation and server collision export.
- `CompactCityWorld.js` / `compact-city-render/buildCityArt.js`: production
  geometry, local resources, Thai roofs, shop props, planting and river scenery.
- `compact-city-streets.js` / `compact-city-render/buildCityStreets.js`: shared
  pavement coverage and its batched surface renderer, also used by the atlas.
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

Four central services have different working structures: an open smithy with
brick chimney/hearth and anvil; an L-shaped green-roof pharmacy with a shaded
herb-drying veranda; a two-storey timber shop with upper living quarters; and
a high-door storehouse with a lower loading porch and cargo. Their rooflines,
volumes and frontages differ, rather than only their roof colours.

The residential compound pairs a raised timber house, steep roof and asymmetric
stairs with a lower plaster home, crosswise thatch roof and shaded sitting porch.
Water jars, baskets, seating, timber braces, windows and planted pots are grouped
around domestic entrances. Doors and interiors are visual dressing; the existing
building reservations remain solid.

Sixteen additional lots create eight domestic/trade types: woodworker, potter,
tea house, weaver, merchant, bakery, inn and fisher. The town now has 33 building
lots rather than 17. Differences include floor height, roof direction, lower
annexes, working porches, framed side/rear windows, laundry and household wares.
Low courtyard edges connect the original compounds without closing their
service-facing entrances. These infill homes are scenery, not duplicate shops.

Twelve garden beds add layered canopy, shrubs and flowers, while grouped trees
beyond the walls form a backdrop. High foliage may overhang; trunks, roots and
low solid planting remain in reservations. A painted ground wash and softer
city-specific daylight fill replace the uniformly bare ground treatment.
Other maps retain their existing lighting response and collision layout.
The civic reservation contains a low Thai lotus fountain; inward-facing market
canopies and its warm light frame the first view. The arrival moves from (0,8)
to (0,3) so the entire fountain fits at the existing default zoom 2, without
overriding the player's camera preferences. Central respawn shares that anchor.

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

## Street hierarchy

The main north/south and east/west streets use grey stone, distinct from the warm
brick lanes, lighter sidewalks, flat drainage bands and central ceremonial plaza.
Forty-seven connected street/approach segments cover the original seven roads,
market frontages, residential lane, school/temple approaches, service arrivals
and quay. Intersections share one surface classification instead of stacking
rectangles. Individual buildings have front courts rather than repeated square
paving pads. Four Thai street-name signs stand inside existing shop footprints.

Fifty-four canonical POI, shop approach/contact, warp, spawn, respawn and portal
arrival records have collision-valid paved routes from the plaza. This does not
force roaming residents to remain on paving. All 16 new front courts also have
collision-valid paved routes. Surface detailing itself is flat; the infill and
gardens add 28 solid reservations, making 47 exported city shapes including the
two portal pillars. Revision 2 is retained because this replacement has not
deployed; current saves obstructed by a new lot use the existing safe fallback.
The player remains free to cross unreserved open ground.

## Harbor and residential boundaries

Home lots use visible timber/slat and capped plaster edges with front openings.
They remain inside the existing solid reservations; no private interiors or
new navigation barriers are introduced. Perimeter masonry now has a stronger
plinth and pilasters, still outside the town boundary.

The trading harbor uses an open quay, timber berths, a Thai pavilion and grouped
cargo dressing inspired by the spatial clarity of Ragnarok's Alberta. Boatman
contact and resident routines remain unchanged. Offshore berths are scenic and
their entry rail marks the walk limit; this revision does not extend the
playable envelope into the river. See [harbor examples and validation](../art/compact-city-harbor/README.md).

## Review and validation

- Interactive production view: `/tools/compact-city-production.html`.
- Real account-entry/game QA: `tools/compact-city-production-qa.mjs`.
- [QA results](../technical/qa/compact-city-production.md).
- [Art review](../art/compact-city-production/ART_REVIEW.md).

The environment reuses and adapts the existing architectural kit; no paid
Meshy generation was started. Existing Meshy NPC models remain in use.
