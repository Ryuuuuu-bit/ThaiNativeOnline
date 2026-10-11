# Skill screen obstruction QA

Date: 2026-10-11. Branch: `codex/fix-skill-screen-obstruction`. QA changed only this report and captured screenshots/artifacts. Runtime fixes belong to the technical artist; root owns release.

## Findings

Severity: major — fixed
Environment: deployed UAT baseline `main-DLQ_4hEJ.js`, isolated offline Guest Shaman, 1600x900 Edge/SwiftShader, city training dummy, high-quality PostFX.
Steps to Reproduce: cast `mage_akom`, freeze the same active effect frame, render the same camera/scene through full-size and 0.6-size compositor targets.
Expected: lowering rendering resolution does not enlarge particles in world/screen space.
Actual: baseline point projection grows from 48.3622 to 80.6037 display pixels (+66.6667%); direct rendering remains 48.3622. The particle uniform still uses full canvas height while the compositor target is only 540 instead of 900 pixels.
Evidence: `artifacts/skill-obstruction-qa/scale-result.json`; `baseline-cast-high1.png`, `baseline-cast-high06.png`, `baseline-cast-direct.png`. Technical artist's independent actual GPU raster probe reports 62→103.33 pixels at 0.6 scale (`artifacts/skill-obstruction/gpu-projection.json`).
Suspected Area: shared FX Points projection in `src/classes/fx/engine.js`, technical artist. Final fix uses the active render viewport in `onBeforeRender`; real-game same-frame candidate projection is 51.5614 pixels in high1, high0.6 and direct (ratio exactly 1). Particle randomness differs between independent baseline/candidate sessions, so compare mode ratios within each frozen frame rather than absolute cross-session particle sizes.

Severity: minor — fixed portability defect; exact user symptom unconfirmed
Environment: shared FX/decal, Boxer impact and fullscreen PostFX grade GLSL.
Steps to Reproduce: inspect shader fade expressions and the shock-ring zero-radius startup path; evaluate the updated shader regression tests.
Expected: ascending smoothstep edges and finite ring calculations across renderers/drivers.
Actual: prior reversed smoothstep edges are undefined by GLSL, and zero-radius shock input admits a degenerate calculation. SwiftShader did not reproduce an opaque whole-screen corruption during the sampled live casts; a device-specific manifestation was not verified.
Evidence: technical artist regression tests and `docs/technical/SKILL_FX_RENDERING.md`; final full suite below. QA also found the additional fullscreen PostFX grade expression `smoothstep(0.85,0.25,...)`; owner replaced it with the equivalent ascending inverse fade and refreshed the collision source hash.
Suspected Area: `src/classes/fx/engine.js`, `src/classes/fx/boxer-skills.js`, `src/world/PostFX.js`; technical artist. The fixes preserve the intended fade curve and shader appearance on this tested renderer.

## Actual gameplay rendering probes

The game-playtest workflow was used. Fresh headless Edge profiles, isolated Guest storage, WebSocket blocked; baseline assets served by UAT, final candidate by freshly restarted no-HMR Vite `127.0.0.1:5335`. No existing accounts or production saves were used. This task exercised real `KitCaster.cast`, production skill runners, actual map/dummy/model, core frame updates and renderer; it was not a static avatar/loading check.

Baseline: six accepted casts across Shaman (`mage_akom`, `mage_kalp`, `mage_storm`) and Warrior (`sword_twin`, `sword_pikat`, `sword_whirl`), 42 raw rendered frame captures. Dummy hit totals grew from 0→5 and 0→11. No newly visible fullscreen opaque DOM panel appeared; the cinematic dim node remains detached. Existing full-screen DOM containers are transparent HUD/label/vignette layers. No non-finite sampled live particle size or uncaught page error was observed. Raw evidence is `deployed-before-result.json` and frame PNGs in `artifacts/skill-obstruction-qa`.

Final candidate after shader/PostFX/collision source freeze: eight accepted casts, including repeated akom/twin. Per-cast final dummy hit totals:

| Class | Cast sequence | Cumulative hits |
| --- | --- | --- |
| Shaman | akom → kalp → storm → akom | 3 → 5 → 7 → 10 |
| Warrior | twin → pikat → whirl → twin | 6 → 8 → 11 → 15 |

Final evidence: `candidate-final-result.json`; 56 sampled frame records; 42 unique raw PNGs are retained because the repeated akom/twin image filenames replace their earlier same-skill captures. The probe clears only fixture cooldowns between cases and advances core frame time deterministically; it does not certify legal rapid recasting or production FPS. The storm case may walk into range before releasing, as normal KitCaster target handling does.

Final mode/zoom/remote probe: `scale-final-result.json`.

- Actual HUD-visible Shaman cast at high scale 1, high scale 0.6 and direct rendering; projection remains 51.5614 display pixels in all modes. `uScale` tracks 64.7041 at 900 target pixels and 38.8225 at 540, restoring constant apparent size.
- Real zoom minimum 1 and maximum 3 were applied and captured. Both actual values are recorded; no claim is made from the superseded clamped requests 50/100.
- Broad kalp/storm effects were captured at active AoE stages with target, terrain, HUD and damage feedback visible. Storm glyphs are intentionally broad/translucent at close zoom; Art Director judges readability separately.
- Simulated remote client FX event (`attachRemoteSkills` + isolated cloned model + `mage_storm`) is accepted. After settling local tasks and resetting fixture screen fields, shake/stop/punch/mood remain exactly 0 before and after. This tests the real remote FX client path, not a live multiplayer/server relay.
- Final rendering probes report no uncaught page errors. Critical loading/static startup checks from earlier tasks are not substituted for the actual casts above.

## Automated validation

Final `npm test`: **1,049 total, 1,047 passed, 0 failed, 2 skipped, 0 cancelled, 0 todo**, **56,682.391 ms**. Final `npm run build`: **passed, 332 modules, 516 ms**. Logs: `artifacts/skill-obstruction-qa/npm-test-final.log` and `build-final.log`. Existing >500 kB main chunk advisory remains; it is not a new failing diagnostic.

Final source hash: `5779d544420125bce8eada1525c18ff3cf6c81dd98e04550c9e0934a1a06b3fa`; collision refresh covers 14 maps with unchanged geometry per owner receipt, and final freshness tests pass. QA did not physically traverse every map.

Historical QA run before the final fullscreen-grade fix also passed 1,048 total / 1,046 pass / 0 fail / 2 skip in 55,024.7021 ms, build 536 ms. It is not the final release gate.

## Screenshots

Eleven representative real browser captures in `docs/art/reviews/skill-screen-obstruction/`:

- `baseline-cast-high1.png`, `baseline-cast-high06.png`, `baseline-cast-direct.png`
- `candidate-cast-high1.png`, `candidate-cast-high06.png`, `candidate-cast-direct.png`
- `candidate-zoom-1.png`, `candidate-zoom-3.png`
- `candidate-aoe-4.png`, `candidate-aoe-9.png`, `candidate-remote-cast.png`

Full raw before/after frame sets remain ignored QA artifacts. Art Director approved in `docs/art/reviews/skill-screen-obstruction/REVIEW.md`, scores **8.5 / 8 / 8 / 8.5**. Broad AoE density is unchanged and accepted within the documented readability limit; approval does not certify the user GPU symptom.

## Harness history and limits

The first local baseline probe rendered every simulated frame and was stopped after collecting one valid akom case; the definitive before matrix was then run against unchanged deployed UAT to avoid source provenance ambiguity during candidate edits. A draft shader-signature substring counter did not establish GLSL portability and is not used as proof. Initial zoom requests 50/100 both clamped to 3 and were superseded by actual 1/3 captures. Initial remote probe retained a pending local FX task, so its stop change 0→0.067 was not attributed to remote FX; the clean settled probe preserves all fields at zero. Superseded images were moved into ignored artifacts, not presented as final near/far or remote evidence.

The measured +67% particle growth is reproduced and fixed. **The user's exact whole-screen flicker/occlusion was not reproduced on SwiftShader and cannot be certified completely resolved on their GPU from these probes.** Undefined shader fades were corrected defensively with regression coverage. No physical GPU/driver matrix, live server combat authority, party session, mobile hardware performance, authenticated account/save or production deployment was certified by QA. Browser screenshot/render time under SwiftShader is not a performance benchmark. QA made no source fixes, commits or deployment.
