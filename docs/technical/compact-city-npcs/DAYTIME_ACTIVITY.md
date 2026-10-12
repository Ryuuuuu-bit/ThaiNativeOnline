# Compact city daytime activity and contact audit

The existing 60 city residents remain the only population. Nineteen ambient
residents receive daytime routines; service vendors retain phase contact plans.
NPCManager selects these plans through `presentationActivityFor`; no Game hook,
new model, server operation, stock or quest edit is required.

## Contact audit

Routine owners: cargo_merchant, kid_port, trader_a, trader_b, fish_vendor_e,
shopper_a, shopper_b, shopper_c, pillar_devotee, sweeper, gossip_a, gossip_b,
kid_a, kid_b, monk_young, temple_visitor, traveler, boat_fixer, boatwright.

All 19 are absent from every QUESTS giver, turnIn and talk objective, and from
CLASS_MASTERS. None has shopType, trainer, warpService, storageService or faction.
The merchant-named ambient actors have no shop catalog or purchase operation.
`NetProgress` sends talk only for an active quest talk objective; ordinary
ambient dialogue is local. Server progress/class-quest contact checks continue
to use authoritative schedules, and no distance authorization is widened.

The renderer derives protected quest IDs from canonical quest data. If any
routine owner later becomes a giver, turn-in, talk target, class master or
service/faction actor, it keeps its authoritative plan automatically.
The regression tests exercise every current owner against all three synthetic
quest contact roles and all service/faction flags, and verify every real quest
contact's unchanged plans in all four phases.

## Measured activity

DOM-free production NPC simulation, 120 seconds at 10 Hz, midpoint pauses:

| Metric | Before | After |
| --- | ---: | ---: |
| City residents | 60 | 60 |
| Residents moving | 16 | 28 |
| Plaza / temple / port movers | 12 / 1 / 5 | 15 / 6 / 10 |
| Mean residents walking | 13.98 | 20.02 |
| Unsafe / indoor daytime samples | 0 / 0 | 0 / 0 |

Spawn-radius count (35m from 0,8) at 0/10/15 seconds: before 19/19/19;
after 26/25/26. West-awning residents: before 2/2/2, after 4/3/3.
East-awning residents: before 1/1/1, after 5/4/4. Square resting/conversation
group: before 1, after 3. At 15 seconds, 11 nearby residents have moved;
shopper_a travels 14.91m and shopper_c 13.30m between occupied market edges.
trader_a travels 4m between stocking poses and returns to its starting point.

Focused tests also sample minimum/midpoint/maximum pause durations, require
occupied awnings at 0/10/15 seconds, check facing, fountain stopping clearance,
collision-clear graph edges and stationary work/prayer/conversation poses.

These are position/animation measurements, not rendered visibility or frame
rate. Separate production Game screenshots and 12-second fixed-step motion
sequences are in `docs/art/compact-city-atmosphere/`. The population helper itself
does not launch a browser.

## Validation on the shared branch

Focused activity tests: 7 passed. Final `npm test`: 1,399 tests, **1,397 passed,
0 failed, 2 skipped**. Collision export is current and recall/party warp tests
assert the canonical city spawn. NPC contact authorization is unchanged.
`npm run build` passed, 374 modules transformed, with the existing chunk-size warning.
