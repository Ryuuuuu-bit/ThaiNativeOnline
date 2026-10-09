# Public atlas and city service QoL

## Summary

The full map now reveals every authored place, including formerly hidden locations,
without granting discovery quest progress. The atlas uses parchment geography with
jade/brass controls, a complete searchable directory, purpose filters, selectable
marker clusters, pan/zoom, player/fitted views and an explicit Walk action.
World routes list all 13 maps in ascending level order and select the next real exit;
they do not teleport the player. The city directory contains 22 public destinations.

City equipment is consolidated at ลุงดำ. The three redundant weapon/armor/charm
vendors are removed; the cargo merchant and eastern fish seller remain ambient but
lose duplicate shop roles. Shop roles fall from 16 to 11. All 28 previously purchasable
city item IDs remain available; the equipment counter has the full 17-item union.
Prices, selling rules, refinement and the single enhancement NPC are retained.
Server service sites are deduplicated; legacy shop IDs remain restricted aliases of
the surviving counters. Navigation uses actual customer approaches rather than
walking into the shopkeeper/building. Geometry and saved player coordinates remain
unchanged. Future services are explicitly labelled and excluded from active shops.

## Changed files

- `index.html`, `src/main.js`, `src/core/Game.js`: atlas shell, styling and game integration.
- `src/ui/WorldMapPanel.js`, `src/ui/mapDirectory.js`, `src/ui/world-map.css`: searchable destination UI, public directory and responsive layout.
- `src/ui/Minimap.js`, `src/ui/minimap/mapStyle.js`, `src/ui/minimap/mapLayout.js`: revealed markers, clustering, label placement and shared pan/zoom transforms.
- `src/data/npcs.js`, `src/data/shops.js`, `src/data/shopSites.js`, `src/data/landmarks.js`, `server/progress.js`: consolidated services, explicit landmark links, customer approaches and matching server availability/proximity.
- `tests/minimap.test.js`, `tests/world-map.test.js`, `tests/city-services.test.js`, `tests/browser/minimap-probe.html`: discovery isolation, map coverage, route graph, dense labels, clusters, camera bounds, stock/prices, authorization and real builder approaches.
- `docs/world/WORLD_MAP.md`: public atlas and service-hub behavior.
- This directory: actual-game screenshots, browser QA receipt and review report.

## Validation and review

- Full automated suite: **474 passed, 0 failed**.
- Production build: **PASS, 237 modules**. Existing large-bundle advisory remains.
- Browser QA: actual game, sequential short-lived headless Edge contexts; desktop
  1440×900, touch portrait 390×844, touch landscape 844×390 and 667×375. Full panel
  bounds and fully visible 44px Walk actions verified at every size.
- Real pointer pan and native touch pinch change the atlas without starting a walk.
  Selecting a destination/world route likewise does not move or teleport the player.
- Search finds exactly one enhancement destination. All 13 world entries are present;
  no unknown-place markers remain. The discovery set stays unchanged throughout atlas
  browsing, searching, selecting and gestures. Quest turn-in `?` symbols retain their
  separate meaning.
- Walk starts the real three-waypoint path toward the forge customer approach
  `(-29.6, 68.4)`, closes the atlas and moves the player. Pure geometry checks verify
  that each service approach is standable, connected and within NPC talk/server range.
- No uncaught browser errors. [QA receipt](browser-qa.json).
- Independent Tech review: **PASS**, no P1/P2 blockers.
- Independent Art review of all 12 final screenshots: **PASS** at every viewport;
  Style 8.5/10, Readability 8/10, Visual Technical Usability 8.5/10.

## Screenshots

| View | Overview | Selection | World route |
| --- | --- | --- | --- |
| Desktop | [Overview](desktop.png) | [Selection](desktop-selected.png) | [World](desktop-world.png) |
| Portrait | [Overview](mobile.png) | [Selection](mobile-selected.png) | [World](mobile-world.png) |
| Landscape | [Overview](landscape.png) | [Selection](landscape-selected.png) | [World](landscape-world.png) |
| Small landscape | [Overview](small-landscape.png) | [Selection](small-landscape-selected.png) | [World](small-landscape-world.png) |

## Known limitations

- This pass consolidates services, not city geometry. The physical city remains the
  same size. Short landscape initially frames the service hub; Fit/pan reaches the
  broader geography. Long destination/world lists scroll.
- Distances are straight-line estimates; walking follows the collision-aware route.
  Merchant schedules still apply, and selection indicates absent shopkeepers.
- Hidden-area discovery quests still require visits. Reading the public atlas gives
  location knowledge only. Nearby monster markers retain their existing range limit.
- Responsive/touch QA uses browser emulation and native touch events, not physical
  iPhone hardware. Screenshots are actual-game captures; this task changes no 3D assets
  and makes no paid generation calls. Review workers are closed after QA.
