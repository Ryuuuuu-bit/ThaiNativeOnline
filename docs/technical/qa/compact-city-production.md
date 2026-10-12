# Compact production city QA

Branch: `codex/compact-city-production`. Scope: city fixtures, compact-city
regression tests, real server integration and production-page automation.

## Final validation after lamp/paving/LOD source freeze

`npm test`: exit 0, **1376 tests, 1374 passed, 0 failed, 0 cancelled, 2 skipped, 0 todo**, 44983.3246 ms. Includes deterministic daytime fixtures and final collision source hash check. No QA test was disabled or weakened to obtain this result.

`npm run build`: exit 0, Vite 8.3.2, 362 modules transformed, built in 2.11s. Main JS 2549.01 kB / gzip 766.14 kB; CSS 364.55 kB / gzip 73.62 kB. Existing >500 kB chunk warning remains.

QA independently compared `JSON.stringify(mapObject)` for every non-city map in the final export against `git show HEAD:server/data/collision.json`, HEAD `6cf7a8b34da824455d82d5d5be37d4bc7e66a93f`. All 13 are byte-identical: paddy, deep_forest, wat_rang, klong, ruen_ho, bamboo_grave, sealed_mine, sunken_city, dusk_fort, giant_valley, himmapan, fallen_city, demon_rift. Final export has 14 maps and 19 city shapes, source hash `b92e9ae631a6a3d67002d2787e0e8debbf987b53e9e3de9945526797c949a121`. Evidence: `artifacts/compact-city-production-qa/collision-comparison.json`.

Latest QA real-production runner: exit 0, `passed: true`, zero console/page errors, 22 screenshots. Escape closed the real atlas; movement, dummy combat, save/reload, actual six masters/four dummies, all phase contact reachability and sampled server/client collision parity passed. Browser/page closed. QA screenshots precede the subsequent lamp-cap/paving/LOD polish; main owns fresh night/art/actual-atlas captures after that fix. Main reported daytime architecture approval 8/8/8/8; this is main/art review, not QA's independent visual verdict. Final tests/build/collision comparison above were rerun after the polish and export.

## Atomic persistence finding — fixed and focused verification passed

Severity: minor
Environment: Node, `tests/compact-city-production-migration.test.js`, MemoryStore + Accounts + real StashService/commitTrade; no browser/live account.
Steps to Reproduce: Seed current-revision city saves; deposit one owned ore through StashService at the depot, or exchange gold through commitTrade; read the account row before a periodic/final socket save; resolve it for reconnect.
Expected: Atomic storage/trade persistence retains `layoutRevision: 2`, position and facing, so reconnect keeps the current city location.
Actual: Successful stash deposit writes `{map:'city',x:17,z:12,facing:.7}` without the revision; successful trade also drops it from both players' locations. The city resolver consequently resets these saves to spawn.
Evidence: `node --test tests/compact-city-production*.test.js tests/compact-city-npcs.test.js tests/npc-contact-phase.test.js`: exit 1, 30 tests, 29 passed, 1 failed, no skips; assertion `atomic stash persistence must not drop the city layout revision`.
Evidence: Additional `node --test tests/compact-city-production-migration.test.js`: exit 1, 6 tests, 4 passed, 2 failed, no skips; both atomic stash and trade revision regressions fail.
Suspected Area: `server/stash.js:35` and `server/trade-service.js:17`, transaction snapshot `capture.location`; main/gameplay owner.

Resolution: Main added shared `server/player-location.js` `snapshotLocation` and adopted it in durable save paths. QA reran `node --test tests/compact-city-production-migration.test.js`: exit 0, 6 tests, 6 passed, 0 failed/cancelled/skipped/todo, 158.2115 ms. Both real atomic stash/trade regressions now retain revision, position and facing for reconnect. Old/unversioned reset, valid current-revision persistence and wilderness/instance preservation also pass. These also passed in the final full suite above.

## Confirmed findings fixed by owners

Severity: minor (test reliability)
Environment: Real isolated HTTP/WS servers in shop-online, inventory-capacity and class-quests-online integration tests.
Steps to Reproduce: Run successful city shop/master fixtures while the shared wall-clock phase is night.
Expected: Successful-interaction fixtures explicitly select an eligible phase; real server still enforces NPC contact eligibility.
Actual: Default wall time hides the general merchant/masters, so operations acknowledge but leave gold unchanged (20000 vs 68996, 20 vs 2020, 20 vs 370).
Evidence: Shop-only rerun reproduced the failure without concurrent tests. After fixture-only `--hour=12`, all three focused tests passed.
Suspected Area: Test bootstrap phase assumptions; no production clock defect.

Resolution: QA set daytime through the existing server CLI flag before import in the three fixtures. All original assertions remain. Reviewed other city-interaction integration fixtures: newcomer contacts and warp/stash stewards use all-phase schedules; flask persistence does not perform shop contact; dedicated PostgreSQL fixture already selects a server hour.

Severity: minor
Environment: Node, `tests/maps.test.js` and `tests/compact-city-production-navigation.test.js`
Steps to Reproduce: Resolve `npcHome` for `guard_gate_w`/`guard_gate_e` after city migration.
Expected: Both guards' home anchors stay on their resident map, `paddy`.
Actual: Home resolves to compact `gate_in` (0,-59), outside paddy.
Evidence: focused test failure: `guard_gate_w home 0,-59 is not walkable on paddy`.
Suspected Area: `src/data/compactCityNpcs.js`, Hooke/content owner; main integrating.

Resolution: Main preserved both guards' paddy home literals. Existing home-map assertions and the new explicit regression now pass.

Severity: minor
Environment: Node, `tests/maps.test.js` and `tests/compact-city-production-navigation.test.js`
Steps to Reproduce: Compare compact hall footprint corners against each hall's declared yard.
Expected: Reserved yard contains its entire footprint and exterior door.
Actual: Muaythai footprint north edge falls outside the shifted yard; warrior and other yards require the same audit.
Evidence: focused test failure: `hall_muaythai footprint leaves its yard`.
Suspected Area: `src/data/halls.js`, Hooke/content owner; main integrating.

Resolution: Main enlarged yard half-extents by the centre displacement. Full footprint/door containment, yard separation, bounds and road clearance assertions now pass.

## Earlier validation history

After the final green run, environment's concurrent polish suite reported four failures: stale collision source hash plus unchanged rewards in class-quests-online, inventory-capacity and shop-online. QA reproduced shop-online alone: 1 test, 0 passed, 1 failed (`20000 !== 68996`), excluding concurrency as the cause. The three isolated child servers were following Thai wall time into night, when the real general merchant and class masters are indoors. QA added `process.argv.push('--hour=12')` before importing the server in these three bootstrap fixtures. Production clock/contact authorization and every reward, inventory, range and forgery assertion remain unchanged. Focused rerun `node --test tests/shop-online.integration.test.js tests/inventory-capacity.integration.test.js tests/class-quests-online.integration.test.js`: exit 0, 3 tests, 3 passed, 0 failed/cancelled/skipped/todo, 613.4421 ms. Collision hash refresh remains main's pending final export; no full-suite rerun was performed for this triage.

Initial `npm test`: exit 1, 1370 tests, 1341 passed, 27 failed, 0 cancelled, 2 skipped, 0 todo. Stale baked collision and intentional city fixture failures are being corrected; no tests were disabled.

Initial `npm run build`: exit 0; Vite 8.3.2, 361 modules transformed, built in 1.39s. Main JS 2537.04 kB / gzip 763.08 kB. Bundle size warning (>500 kB).

Second `npm test`: exit 1, 1372 tests, 1363 passed, 7 failed, 0 cancelled, 2 skipped, 0 todo. Four failures are the explicit and existing guard-home/yard regressions; remaining failures are collision source hash, `wat_grove` hunting-sign approach and paddy `first-hunt segment 2`. Export was changing during this run. No wilderness assertions have been altered; main is fixing legacy reservation RNG drift and re-exporting.

First focused regression run: 48 tests, 44 passed, 4 failed, no skips. New migration and reachability tests passed; server/client collision parity passed after the first collision export. Remaining failures: test canvas shim, guard home, moved shaman region fixture, hall yard containment. Canvas shim and region fixture subsequently corrected.

Service/integration fixture run: 23 tests, 21 passed, 2 failed. Passing: production shop anchors/customer approaches, class quest persistence, newcomer quest flow, shop bulk quantities, full bag selling, vault transfers, service travel and saved location. Two remaining stale expectations (guest revival location and portal arrival) subsequently corrected; rerun pending.

After owner fixes: `node --test tests/compact-city-production*.test.js tests/maps.test.js`: exit 0, 27 tests, 27 passed, 0 failed/cancelled/skipped/todo, 564.0268 ms. The second full run already passed the corrected guest-revival and portal-arrival expectations.

## Coverage and fixture changes

- New migration tests: unversioned and old/future/wrong-type city revision reset even when old coordinates fit the new envelope; invalid current city positions reset; valid revision keeps facing/position through account reads; wilderness and instance locations unchanged.
- New navigation tests: every outdoor phase contact; six class NPCs; four distinct dummies; shop approaches and warp contacts/arrivals; clear spawn routes; every compact NPC graph edge; body-pad collision parity including building edges and portal pillars; explicit guard-home and yard regressions.
- Depot regression verifies both stash/warp POIs target the existing `warp_city_market` keeper, exactly one NPC exists, live storage capability and phase contact sites match, arrival remains in range, and real `stashWhy` authorizes the depot/exact range boundary while refusing outside-range and wrong-map access. Updated only the two stale `city_market` coordinate fixtures to (17,12).
- Existing tests now use compact map nodes and real production `buildWorld` service anchors. All inventory, reward, phase authorization, distance, persistence, forgery, map-room and path safety assertions remain active.
- Legacy water buffer test now exercises its original frozen city view; wilderness buffers still use their current production map view and original byte hashes. New city water/rendering is browser scope.
- New `tools/compact-city-production-qa.mjs` uses one disposable Playwright page, real guest login/select/create/Game, blocks account APIs and WebSockets, captures day/night/rotation/atlas/training, and closes page/browser in `finally`.
- Runner extended for 1600×900 production bookmarks: forge (-12,-13) and temple (-52,-31), each default and rotated; all six canonical hall-master contacts; pharmacy/general/occult customer counters; warehouse/port (0,55). It records per-capture position, phase, camera, draw calls, triangles, GPU resource counts, NPC counts and dummy count, plus service stock-row counts and daytime contact authorization. Bookmarks use real `MapManager.place` and camera, explicitly separate from the movement test. Art-director review of these full-resolution captures remains required.
- Extended runner `node --check tools/compact-city-production-qa.mjs`: exit 0.
- Actual `Minimap.prototype.resetFull` regression covers compact playable bounds, available-height fit and whole-map base extent, with real map camera math. `node --test tests/world-map.test.js`: exit 0, 8 tests, 8 passed, no failures/cancellations/skips/todo, 79.7374 ms.

## Screenshots and limitations

PR-review evidence is saved under `docs/art/compact-city-production/`: [actual Game day](../../art/compact-city-production/production-day.png), [actual Game night](../../art/compact-city-production/production-night.png), [actual atlas](../../art/compact-city-production/production-atlas.png), [temple](../../art/compact-city-production/temple.jpg), [northern halls](../../art/compact-city-production/north-halls.jpg), [hunter](../../art/compact-city-production/hunter.jpg), [herbalist](../../art/compact-city-production/herbalist.jpg), [shaman](../../art/compact-city-production/shaman.jpg), [assassin](../../art/compact-city-production/assassin.jpg), [port](../../art/compact-city-production/port.jpg), and [warehouse façade, zoom 1.25](../../art/compact-city-production/warehouse-facade.png). The warehouse façade predates only the final lamp/paving polish. [ART_REVIEW.md](../../art/compact-city-production/ART_REVIEW.md) records architecture approval (8/10 for all four criteria), final polish inspection, remaining overview/plaza/night-plaza evidence and technical review.

Main ran the fresh post-polish `--atlas-only` check; QA read `artifacts/compact-city-production-qa/polish-final/result.json`, which records `passed: true`, zero errors, actual guest login/select/create, six masters/four dummies, phase reachability, 19,257-position collision parity and Escape closure. Its actual day/night/atlas captures are the saved PR-review links above. Main also reported a fresh production `buildWorld` dispose/rebuild capture passing with zero errors. These are attributed main-run checks; QA did not launch another browser. All browsers are closed.

`node tools/compact-city-production-qa.mjs`: exit 0, result `passed: true`, zero console/page errors. Real guest login → select → creation → production city passed. Real collision-aware movement from (0,8) to (0,3), Space damage against a selected dummy, and guest save/reload retaining the current-revision training position passed. The actual World root is `map:compact-city`; all six masters were present and four dummies loaded. Every phase contact was reachable, and sampled production-client collision matched exported server collision (19,257 integer-grid points). All recorded counter approaches were standable and authorized by the actual shop predicate, with stock counts recorded. The browser/page closed in `finally`.

22 full-resolution 1600×900 captures and counters are in `artifacts/compact-city-production-qa/result.json`: day, rotated day, night, atlas, training arrival/combat; forge and temple each default/rotated; six hall masters; pharmacy/general/occult/depot counters; warehouse/port; extra warehouse façade at (-28,52), explicitly labelled zoom 1.25. Default bookmarks retain zoom 2. Example captures: [day](../../../artifacts/compact-city-production-qa/production-day.png), [night](../../../artifacts/compact-city-production-qa/production-night.png), [temple](../../../artifacts/compact-city-production-qa/production-temple.png), [forge](../../../artifacts/compact-city-production-qa/production-forge.png), [warehouse façade, zoom 1.25](../../../artifacts/compact-city-production-qa/production-warehouse-facade-zoom-1.25.png). Manifest paths are absolute. Counters include 60 registered NPCs and four dummies; render counts vary by position/camera and are diagnostic only.

After main fixed atlas fitting, an earlier `--atlas-only` run also passed. The final full runner subsequently refreshed [production atlas](../../../artifacts/compact-city-production-qa/production-atlas.png) from frozen source and verified Escape closure again. All QA browser sessions are closed.

The first automation attempt timed out on a long walk under SwiftShader while the character was progressing, and generated Vite HMR connection errors because the harness blocked WebSockets. The corrected harness disables HMR, tests a shorter real walk and captures long-distance visual fixtures separately. The completed run did not reproduce a movement or Escape blocker. `production-failure.png` is historical failed-harness evidence, not a current passing capture.

Visual bookmarks use real production placement; they do not claim manual traversal to each bookmark. Visuals are handed to main/art-director for art review. No live accounts were used: authenticated account APIs and game WebSockets were blocked. Guest save/reload is browser-verified; authenticated reconnect and atomic service persistence are covered by Node tests. Two existing suite skips remain: NPC candidate-artifact validation and dedicated PostgreSQL restart integration; these are not verified by this run.

Main's initial export comparison was subsequently independently confirmed by QA as recorded above. Later art-only changes require refreshing the source hash; they do not establish a new geometry comparison by themselves.

No live accounts or physical-device FPS measured. Art direction belongs to art-director. Headless SwiftShader timings are not production performance evidence.

Final staging removed only trailing blank lines from `compact-city.js`. Main re-exported collision, confirmed all 13 non-city objects unchanged, reran all 14 online-safety checks (passed), and rebuilt (passed, 362 modules). The screenshots remain representative; no runtime geometry changed.
