# House boundaries and the Thai trading harbor

This revision builds on the production compact city at `87c9638`. The brief is
to make home fences visible and improve the harbor using Ragnarok as a visual
reference, while preserving **นครที่ถูกลืมเลือน** and its Thai architecture.

## Direction and references

- [Alberta concept art](https://www.fouinar-connexion.fr/fouinaragnarok/villesalberta.php):
  broad stone quays, short finger piers, grouped cargo, cranes and a large ship
  set to one side of the main approach.
- [Ragnarok Origin Alberta city showcase](https://www.taptap.cn/moment/473560951153495209):
  readable streets, capped boundary walls and vegetation around private lots.

References inform spatial composition; their models, textures and images are
not game assets in this revision. Existing Thai roofs, materials and locally
authored geometry provide the actual environment.

## Implementation

- Visible timber, bamboo-style and capped plaster boundaries distinguish homes.
  Eighteen lots now have 77 boundary spans and 38 gateposts. Front openings and
  corner returns frame the existing house entrances. The two-house compound has
  a 6.6 m central plaster span and separate gates aligned with both stair mouths.
- The outer city wall gains a dark plinth and repeated plaster pilasters.
- The harbor replaces primitive decks and hulls with a stone revetment, timber
  berths, a Thai waiting pavilion, cargo-handling props and moored trading craft.
- Existing boat motion and water shading remain integrated with the city clock.

`buildCityNeighborhoods.js` owns home boundaries; `buildCityHarbor.js` owns the
harbor geometry; `buildCityArt.js` owns integration, batching, motion and disposal.

## Navigation and limits

All upright additions stay inside existing reserved lots or outside the town's
playable envelope. The boatman remains at (0,55), the waterfront approach remains
at (0,62), and the southern walk limit remains z=64. Offshore berths are scenery;
their entry rail marks the end of the playable quay. Home yards and interiors
retain their existing solid building reservations.

This revision does not deploy the game or claim a measured hardware frame rate.

## Screenshots

- [Harbor overview](harbor-overview.jpg), [waterfront](waterfront.jpg) and
  [evening harbor](harbor-evening.jpg).
- [Two-house compound](home-boundaries.jpg), [eastern home boundaries](east-boundaries.jpg),
  [city gate and wall](city-gate.jpg), [whole town](overview.jpg).
- Before this revision: [waterfront](before-waterfront.jpg), [homes](before-homes.jpg).
- Actual Game at normal zoom: [home approach](production-homes.png),
  [waterfront](production-waterfront.png), [boatman approach](production-warehouse-port.png).

These are production geometry and gameplay captures, not generated target art.
The overview camera is wider than normal gameplay so the harbor composition is
visible together. The close gameplay capture demonstrates the playable approach.

## Review and validation

- Final full suite: **1,404 passed, 0 failed, 2 existing skips** (1,406 total).
  Build passed with 375 modules; the existing large-bundle warning remains.
- Final art review approved: style 8/10, readability 8/10, Thai identity 9/10 and
  technical usability 8/10. The compound initially had too little front boundary;
  its added central span resolves that blocker. No further art changes requested.
- Seven new focused tests cover fence containment and orientations, actual fence
  AABBs against both stair mouths, outward hull/bow/stern normals, offshore boat
  motion bounds, tracked allocations and cleanup after failed boat assembly.
- Fresh [collision export comparison](collision-review.json) preserves all 14
  map objects relative to `87c9638`; city still has 47 collision shapes.
- [Art harness evidence](art-review-data.json): seven views, zero browser errors,
  every canonical POI reachable, 1,271 geometries/143 materials/18 textures
  released, idempotent second disposal releases zero, successful rebuild.
- [Actual Game QA](game-review.json) records creation, movement, dummy combat,
  save/reload, atlas closing, shop contacts, all phase contact routes and 19,257
  client/server collision comparisons. It also walks from the boatman approach
  at (0,55) to the waterfront at (0,62).
  The final run has 24 captures, zero browser errors and zero collision mismatches.

Full-suite and final build results are recorded in `docs/technical/VERIFY.md`.
