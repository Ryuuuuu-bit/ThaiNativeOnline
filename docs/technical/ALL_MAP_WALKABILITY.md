# Shared walkability and rendered water

The earlier forest-trail fix was deliberately local. The subsequent report
of blocked ground in multiple maps requires a shared semantic correction:
dry terrain must not be rejected solely because its height is below a
global water plane. The old inset deep/shallow masks are also insufficient
to identify the full visible shoreline.

## Ownership and scope

The world designer audits all fourteen loaded World implementations, authored
roads, portal arrivals, hunt approaches and service locations. The gameplay
engineer owns the shared water geometry/query and client/server navigation
integration. The director reviews scope and provenance; root integrates,
exports collision data and prepares the PR. No monster levels, loot, map
boundaries or production deployment are part of this change.

The audit also found a separate placement problem in expedition maps:
decoration exclusion followed the central spine and camp circles, while the
painted rounded-loop trails extended beyond those areas. The world designer
owns a narrow placement-clearance correction using the actual trail geometry.
Props remain solid elsewhere, and rejected decoration consumes the same random
sequence so unrelated placement does not shift.
The reserved band includes the stronger painted understroke, player body and
largest visual canopy rather than only a sampled centerline. Fixed camp pillars
move slightly inward to preserve that same usable width.
The final decoration reserve is 7m from the authored path; lantern pillars use
camp offsets ±13.5m and −8m to clear the rounded loop corners. Their collision
remains solid. The usable band is verified at ±2.2m with player-body padding.

## Semantics

The pure water-surface module shares the renderer's original vertex/index
generation, including ribbon corners, polygonal pond rims and varying stream
heights. Querying the same triangles with barycentric interpolation avoids
approximate footprint drift. Float32 coordinates match BufferGeometry;
overlapping triangles select the highest surface. Spatial buckets bound
lookups to nearby triangles, suitable for navigation hot paths.
The implementation uses 8m buckets and a sixteen-view cache; the fourteen
authored maps fit without eviction. Polygon edges and ribbon endpoints are
queried as triangles rather than ideal ellipses or capsules.

Client World and authoritative navigation retain bounds and static collision
checks, bridge/deck precedence and the existing deep-water exclusion. The
wading-depth threshold applies only where an actual rendered water triangle
covers the point. Low dry ground outside that footprint remains traversable.
The earlier forest-only exception becomes unnecessary. Expedition builders
without these water meshes retain their existing dry-ground semantics.

Canonical water height is the generated still surface, not instantaneous
shader ripple displacement. This preserves the previous depth convention;
oscillating waves do not toggle standing permission each frame. Deep/shallow
classification still describes intended water behavior rather than serving
as an approximation for mesh coverage.

## Required evidence

Seal original and final water position/index hashes per loaded map to prove
unchanged visual footprint. Audit actual World road points, portal and hunt
approaches, services and path reachability before/after, separating dry-height
false rejections from genuine water, walls and occupied structures. Probe
rendered river, stream, pond, canal, paddy and marsh fringes, deep water and
decks; verify client/server agreement and bounded query work.

The final release evidence must include screenshots and actual Game input
checks as well as pure tests, full suite, production build and fresh collision
provenance. Fixed-step controller checks must be labeled as such; they do not
establish natural movement timing or physical-device performance.

## Sealed world audit

All fourteen actual loaded maps were audited. Thirty sampled dry-ground height
false rejections (deep forest 2, abandoned temple 28) fall to zero. All eight
expedition painted loop, spine and connector centerlines are clear; the wider
±2.2m band with body padding passes 293,296 of 293,296 probes. Portal arrival
and cemetery approach regressions are standable and path-reachable.
The authored-road audit covers 16,982 points; all 186 portal, arrival and hunt
approach probes are reachable.

Original and final water position, index and shoreline SHA256 hashes match
exactly. All static collision in the six original maps is retained. Retained
seeded expedition colliders keep their exact positions; the only layout changes
remove reserved trail decoration and relocate 192 fixed lantern pillars.
Occupied bridal-bed arena points are not painted roads. The temple altar stays
solid because a 1m usable band remains within its 2.2m trail.

Art/technical review approves the preserved Thai palette and soft low-poly
style (8/10), continuous readable expedition corridors (8.5/10), and shared
geometry plus collision/visual parity (8.5/10). Review includes fourteen
top-down map captures, the matched forest Game view and two representative
expedition side-loop views, rather than spawn-clearing images alone.

## Actual Game controller checks

Genuine before screenshots use the deployed pre-fix bundle, with isolated guest
state and network writes blocked. Fresh local after screenshots use the frozen
candidate source at the same forest portal-arrival and temple cemetery coordinates.
Both before points reject standing; both after points permit it. Actual Game
click walking reaches each goal within 0.2m in 70 and 99 fixed 1/60s steps.
Trusted W+D input advances 1.4m over twenty fixed Game steps in each map, ending
on standable ground. Browser JavaScript errors: zero. These fixed-step checks
verify input/controller behavior; they do not measure wall-clock frame rate.

Audit NPC staff centers separately from public customer approaches: occupied
counter/keeper cells are not valid player destinations. The 186 reachable
portal/arrival/hunt probes do not imply every staff cell is walkable.
Of 59 service probes, 54 public/direct approaches are reachable. The remaining
five records are duplicate staff anchors for three NPCs, whose actual customer
approaches all pass standing, pathfinding and clear-line checks within the
production interaction radius: forge (−29.6,68.4), herbalist (7.1,65), occult
keeper (6.8,86). Raw 259-POI totals therefore contain 257 standable points and
five unreachable staff-anchor records, not five inaccessible services.

## Final validation and limits

Final frozen-source full suite, after browser audits closed: 849 tests,
847 passed, zero failed and two existing optional tests skipped (48.09s).
An earlier concurrent run had 846 passes and one unrelated world-boss join
day-window timing failure (`dawn` versus `closed`); its immediate isolated
rerun passed 2/2 before the final clean full run. No product or test code changed
between these runs. Walking, water, layout, service and collision-provenance
checks passed. Production build passed with 304 modules and the existing large-chunk
warning. Collision source hash matches the final source; whitespace check is
clean. Focused water/layout checks passed 11/11 and world/gridpath/layout 20/20.

Standing staff cells, deliberately solid beds/counters/altars, deep water and
map boundaries remain blocked. Service purchase flows and every NPC schedule
state were not tested. Shader waves and shallow movement speed are unchanged.
The valid temple screenshot captures scenery and the selection marker while
the hero asset is not visible; fixed-step telemetry establishes movement.
No production deployment is included in this task.
