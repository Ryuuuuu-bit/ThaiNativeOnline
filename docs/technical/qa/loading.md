# Critical assets loading QA

Date: 2026-10-11. Branch: `codex/critical-assets-loading`. QA owns this report and screenshots only; runtime implementation belongs to the loading engineer and root UI owner.

## Findings

No unresolved crash or gameplay blocker confirmed in the bounded loading cases below. Two defects found during review were corrected by their owners and covered by regression tests: pending/rejected map model caches needed explicit invalidation for immediate Retry; landscape flex shrinking collapsed the progress track. Final landscape captures show the retained track and reachable error controls.

## Browser evidence

Fresh headless Edge / SwiftShader contexts, `http://127.0.0.1:5333/?ui=1`, isolated memory server `8792`; source watching/HMR disabled and Vite restarted after source freezes. Guest slot 0 is seeded for setup; final startup replay only seeds missing storage, so Retry does not recreate the session or character.

Seven startup checks passed in `artifacts/loading-qa/browser-result.json`:

- Hold Shaman GLB indefinitely: actual avatar stage remains loading at 40%, preceding map/character stages complete, interface/render stages pending, no published playable `window.game`. Keyboard W and 1 were sent while blocked; the eventual ready position remains the city spawn (0,52).
- Inject HTTP500 into all three Shaman GLB attempts: Thai error retained at 40%, Retry visible, overlay remains and no playable game is published.
- Restore route and click Retry: page reload succeeds, Guest ID/slot 0 and `LoadingQa` character persist, all five stages finish at 100%, overlay is hidden.
- Ready state has actual `player.model`, visible group and a loaded mesh; HUD exists before reveal.
- Open MainMenu after ready: movement guard is false and keyboard movement still changes position; loading guard does not regress the recent menu walking fix.
- Warrior Guest enters with API and WebSocket connections blocked. Warrior has an authored kit in this codebase, so it is not the model-only case.
- Assassin fallback exercises model-only readiness: actual avatar exists, `training.kit` absent, startup finishes without a network readiness barrier.

Four map checks passed in `artifacts/loading-qa/map-result.json`:

- Install monster-body HTTP500 interception before startup to prevent healthy optional preload caches masking the injected fault. Final morning-phase paddy boar body fails; existing city and position (0,52) remain, loading error and keyboard movement guard remain active.
- Hold S during map error: position unchanged.
- Back button dismisses the failed destination screen and restores old city walking (~0.44 m in the final probe).
- Reproduce failure, restore route, immediately click the overlay Retry button: seven new body requests with retry revision URLs succeed, paddy commits and overlay clears in 4,399 ms. No 15-second cache-expiry wait was used.

Desktop 1600x900, portrait 390x844, landscape 844x390, and reduced-motion emulation were captured. Landscape error controls were scrolled into view and clicked in the actual browser. No physical-device timing or FPS claim is made.

## Final dormant-model guard

After the final constructor guard, a new fresh Shaman startup passes (`artifacts/loading-qa/dormant-result.json`): city has 1,030 dormant monster records, **zero monster model network requests and zero monster views**, while the actual visible player model and HUD are ready. No uncaught page errors. This is bounded cold-start evidence for skipping off-map model loading, not a production bandwidth/performance benchmark. `desktop-ready.png` was refreshed from this final source.

The four map checks were also repeated successfully after this guard. Final attempt observes morning phase, 21 failed destination requests before the first handled error, seven fresh requests on immediate successful Retry, 4,399 ms. Earlier night-phase cache-freeze map evidence remains in `artifacts/loading-qa/map-cache-freeze-result.json` (four Retry requests / 4,647 ms). Final source has 12 passed explicit browser assertions across startup, map and dormant-body probes; the two invalid setup timeouts below are excluded from that count.

## Harness failures and expected console output

The initial server URL failed because Vite bound localhost/IPv6; restarting with explicit 127.0.0.1 resolved it. Two map attempts placed HTTP interception after startup, when the current renderer had already cached off-map model bodies; their 100-second error waits timed out. These attempts remain in `browser.log` and `browser-final.log` and are not counted as passed map cases. The corrected pre-start interception probe is the valid map evidence.

Final startup replay logged no uncaught page errors. Expected console errors are the injected critical HTTP500/startup failure, deliberately aborted offline API calls, and a local resource 404. Corrected map probe console errors are the injected HTTP500 and handled map-transition failure. Such injected errors are test evidence, not hidden runtime success.

## Automated checks

Final source freeze including dormant-body guard: `npm test`: **1,044 total, 1,042 passed, 0 failed, 2 skipped, 0 cancelled, 0 todo, 53,297.0659 ms**. `npm run build`: **passed, 332 modules, 508 ms**. Logs: `artifacts/loading-qa/npm-test-release.log` and `build-release.log`. Build retains the existing main chunk >500 kB advisory; no failing build diagnostic. The preceding cache/CSS run also passed 1,043 total / 1,041 pass / 0 fail / 2 skip in 53,995.7872 ms, build 539 ms.

Historical runs are not the release result: the initial pre-regeneration collision-hash run reported 1,038 total / 1,035 pass / 1 fail / 2 skip (parent supplied evidence); QA baseline after regeneration reported 1,039 / 1,037 / 0 / 2, and a later input-guard rerun also passed. Final results take precedence without concealing the earlier hash failure.

## Screenshots

All in `docs/art/reviews/loading/`:

- `desktop-loading.png`, `portrait-loading.png`, `landscape-loading.png`, `landscape-reduced-motion.png`
- `desktop-error.png`, `portrait-error.png`, `landscape-error.png`
- `desktop-ready.png`, `warrior-offline-ready.png`
- `map-error.png`, `map-landscape-error.png`, `map-dismissed.png`, `map-retry-ready.png`

Art Director review is approved in `docs/art/reviews/loading/REVIEW.md`, scores 9 / 9 / 9 / 8.5. Images are real browser captures of the game or loading overlay, not concept art.

## Scope and limits

Read the runtime diff against the readiness claim: startup publishes gameplay only after local map/NPC, character/HUD, avatar, visible images/fonts and first render; map preparation stages off scene and rolls back before presenting an error. Final full-suite checks cover map/gridpath/world and collision source freshness, not physical pathfinding in every map.

No authenticated login/creation/server authority, PostgreSQL save, live deployment, production network, all-class/all-map campaign, multiplayer combat/training-dummy damage or physical mobile performance was certified by this task. Guest fixtures intentionally bypass account creation. Map travel uses the public manager API in the isolated Guest browser; destination server authorization is outside this validation. Startup keyboard blocking evidence is no early game publication / unchanged spawn plus readiness guard regression tests, not a live renderer object sampled during the unpublished startup interval. No source changes, commits or deployment were made by QA.

