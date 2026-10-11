# Painted skill icon rollout QA

No unresolved application defects confirmed after final fixes.

Severity: minor (fixed)
Environment: preserved ImageGen provenance files
Steps to Reproduce: Read docs/art/skills/painted-complete-v1/heal_khwan.prompt.txt before correction.
Expected: Exact original ImageGen prompt preserved for the approved v2 reuse.
Actual: File contained literal undefined, because the v2 receipt stored its prompt separately.
Evidence: Independent audit rejected the 10-byte prompt; final audit passes all 65 meaningful prompts against receipts. New regression test passes.
Suspected Area: Artist export reuse script; fixed by root copying the original v2 prompt unchanged and recording it in the reuse receipt.

## Final validation

- Independent asset audit: all 65 skills covered, 61 newly generated masters and 4 unchanged approved v2 reuses. All 65 originals have distinct SHA-256 hashes. Each preserved PNG matches its original ImageGen output byte-for-byte; each production hash matches its receipt. Exact meaningful prompts preserved. Actual extracted alpha bytes are 255 throughout all masters and WebPs, as intended for painted backgrounds. Every output is 256 x 256 WebP. Combined production payload: 1,655,810 bytes.
- Final build contains all 65 WebPs, each byte-for-byte identical to current public output, including the corrected boxer_ngouy.
- Gallery: desktop 1440 x 1100 and mobile 390 x 844; all five tabs show 13 skills and 52 loaded image elements each. Ten class/viewport checks; no horizontal overflow, JavaScript/console errors or HTTP failures. Desktop shows authored 32/48/64 previews; mobile hides the 64-pixel comparison to fit two columns.
- Actual application widgets imported into a fresh isolated browser fixture: all five SkillPanel trees (13 nodes each), ActionBar hotbars, HotbarEditor skill choices and actual assignment, AutoPanel, and CharacterUI buff markup. Forty checks across desktop/mobile. Painted URLs decode at 256 x 256 with smooth contain rendering and unchanged source margins. Lock, cooldown, MP dim and active state overlays remain above art. heal_zone resolves directly to its WebP instead of the legacy canvas helper. Both waikru and regen buff art resolve to painted assets. No console errors or failed requests in final fixture run.
- Initial desktop AUTO screenshot was invalid due to concurrent fixture CSS imports letting old theme width override layout width. Corrected fixture to load component modules before global styles, then import global styles sequentially in application order. Recaptured all runtime screenshots. Final desktop AUTO is 1,220 pixels wide; five width/no-horizontal-overflow assertions pass. No source fix needed for this fixture issue.
- Source diff reviewed: changes are icon routing, common framing in chooser, class kit image selection and tests. Gameplay definitions, skill FX and rule data unchanged. Resolver preserves remote/data/unknown URLs, base paths and cache suffixes; regression tests pass.

npm test: 1,011 total; 1,009 pass; 0 fail; 0 cancelled; 2 skipped; 0 todo. Duration 42,340.4297 ms. This full run followed the final source/test changes. Subsequent change was one corrected artwork only.

Final targeted regression after corrected artwork: node --test tests/painted-skill-icons.test.js — 4 tests, 4 pass, 0 fail, 0 skipped (96.5566 ms).

Final npm run build: passed in 552 ms. Existing warning: main minified JS chunk exceeds 500 kB.

## Screenshots and files

- gallery-{warrior,muaythai,hunter,shaman,herbalist}-{desktop,mobile}.png: all 65 skill illustrations, 10 screenshots.
- runtime-{class}-{desktop,mobile}.png: real skill tree/hotbar/buff widgets, 10 screenshots.
- chooser-{class}-{desktop,mobile}.png: actual hotbar chooser, 10 screenshots.
- auto-{class}-{desktop,mobile}.png: actual AUTO panel, 10 screenshots.
- result.json: independent assets and gallery audit.
- widgets-result.json: runtime widget assertions and errors.
- npm-test.log, npm-build.log, final-regression.log: exact command outputs.

Changed by QA: only ignored artifacts/skill-icons-rollout-qa scripts, reports, logs and screenshots. No application source, gameplay data or git mutation by QA.

## Limits

Runtime evidence uses actual application UI classes in a controlled standalone browser fixture, with simulated controller cooldown/MP/lock states and a Character instance. It is not an end-to-end login, city movement, live combat, training dummy or multiplayer/network test. No 3D skill effects, physical-device FPS, production deployment or full account flow was tested for this artwork rollout. Mobile screenshots use emulated Edge viewport, not a physical phone. Visual style and semantics are independently reviewed by art-director.
