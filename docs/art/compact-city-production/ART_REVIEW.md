# Forgotten City — environment review

Scope: compact production replacement for **นครที่ถูกลืมเลือน**, followed by
the requested denser Thai town and softer fantasy atmosphere. Date: 2026-10-12.

Status: **APPROVED** after independent Art Director review of the final real
Game day/night captures at default zoom 2 and spawn (0,3).

| Criterion | Final score |
| --- | --- |
| Style match | 8/10 |
| Readability | 8/10 |
| Thai identity | 8/10 |
| Technical usability | 8/10 |

No blocking changes remain for the reviewed town revision. The scores are art
and usability judgments, not a claim of hardware performance or fidelity to
Ragnarok Origin's shipped assets.

## Implemented design

- 33 building lots, including 16 infill homes/workshops in eight structural
  types; six class schools, temple, daily services and working waterfront.
- Four distinct service structures: open smithy, L-shaped apothecary,
  two-storey timber general store and high-door storage/loading frontage.
- Linked working aprons, verandas, framed shutters, lower annexes, courtyard
  edges, household wares and visible river-hut approaches.
- 47 composed street/approach segments with one surface classification per
  location, smaller worn paving stones and a painted ground wash.
- Twelve garden/focal reservations, layered foliage, low planting and flowers;
  temple and school rooflines remain distinct. Night lanterns and lit windows
  mark occupied frontages, with three unshadowed warm lights at civic/market
  thresholds. The city daylight has more ambient fill than the wilderness.

The [generated target concept](TARGET_CONCEPT.md) guides atmosphere and spatial
relationships. It is not a game screenshot or proof of implementation.

## Review findings addressed

The first density pass remained a collection of separated compounds. The Art
Director requested stronger framing at spawn, joined working/domestic aprons
and a warm inhabited focal point at night. Large smooth tree lobes were also
replaced with irregular branch fans, smaller foliage tufts and small blossoms.
The market/fountain revision was assessed in the actual Game at default zoom.
Arrival moved from (0,8) to (0,3), bringing the entire lotus fountain below the
HUD/top edge. Reduced civic illumination retains petal/basin detail at night.
The reviewer confirmed visible player, trainer and approaches, joined aprons
and side framing from the inward awnings; no further changes were required.

## Actual game and architecture evidence

![Actual production town, wide architectural view](overview.jpg)

These images are rendered from the production scene. Wide architectural
captures use zoom 1, shop studies 1.4 and overview 0.2. Real Game captures use
the normal zoom 2 and HUD; the warehouse facade is explicitly zoom 1.25.
Camera state, counters, checks and source-hash provenance are recorded in
[capture-manifest.json](capture-manifest.json).

| Area | Evidence |
| --- | --- |
| First playable view | [Day](production-day.png), [Night](production-night.png) |
| Civic/market composition | [Plaza](plaza.jpg), [Evening](night-plaza.jpg) |
| Daily services | [Smithy](forge.jpg), [Pharmacy](pharmacy.jpg), [General shop](general.jpg), [Depot](depot.jpg) |
| Service approaches | [Forge](production-forge.png), [Rotated forge](production-forge-rotated.png), [Pharmacy](production-counter-pharmacy.png), [General](production-counter-general.png), [Storage](production-counter-depot.png) |
| Neighborhoods | [Wide residential view](residential.jpg), [Playable view](production-homes.png) |
| Temple and schools | [Temple](temple.jpg), [Northern halls](north-halls.jpg), [Hunter](hunter.jpg), [Herbalist](herbalist.jpg), [Shaman](shaman.jpg), [Assassin](assassin.jpg) |
| Waterfront | [Port](port.jpg), [Warehouse facade](warehouse-facade.png) |
| Navigation atlas | [Actual atlas panel](production-atlas.png) |

## Technical acceptance

All 16 canonical destinations and all NPC phase contacts retain collision-valid
routes. Street checks cover 54 public destination records plus all 16 infill
front courts. Six class masters, four training dummies and the existing NPC
identities remain in the production Game. New scenery adds no duplicate shop
interactions.

Building/garden reservations and portal pillars produce 47 city collision
shapes. The other 13 maps retain byte-identical exported map objects. Real
client/server collision is compared at 19,257 sampled positions. Blocked
current-revision saves fall back safely; valid positions remain intact.

Geometry, materials and generated textures are owned locally and disposed on
failure/departure. Source kit maps are cloned; geometry is merged or instanced.
Focused ownership probes and browser build/dispose/rebuild verify these paths.
See the [QA report](../../technical/qa/compact-city-production.md) for exact
test, build and gameplay evidence and any validation chronology.

## Known limitations

- Exterior buildings have solid reservations; there are no traversable rooms.
- This is original Thai procedural architecture inspired by the requested
  atmosphere, not Ragnarok Origin's assets or a one-to-one recreation.
- Hardware GPU frame time and physical-device FPS have not been measured.
  SwiftShader counters and dynamic-resolution captures are diagnostic only.
- No paid Meshy generation was started; existing Meshy NPC models are retained.
- The task branch and PR do not deploy the change.
