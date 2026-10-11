# Runtime asset cleanup — implementation verification

The inactive monster pixel renderer and obsolete demo assets were removed from the runtime package. Production artwork and gameplay data retain their original bytes. This is a packaging cleanup; no balance, rendering style or active model was changed.

## File changes

- Deleted 66 inactive files under `public/sprites/monsters/` (33 sprite PNGs and 33 sidecar JSONs, 9,400,656 bytes).
- Deleted unimported `src/combat/MonsterSprites.js`, `src/classes/fx/hotbar.js` and `src/ui/worldRoute.js`. `src/ui/SkillPager.js` remains because its dedicated test still imports it; tests and `src/rules/` remain intact.
- Archived four ImageGen sample folders and three completed-gallery metadata files, 42 files / 38,473,908 bytes, using the migration table below.
- Updated item manifests, eight skill export receipts, relevant README/gallery links, and the item assembly/review tools. The historical pixel-authoring tool comment now states that its sheets are not used by the 3D runtime.

| Former runtime location | Authoring archive location |
| --- | --- |
| `public/ui/items/imagegen-sample-v1/*` | `docs/art/items/imagegen-sample-v1/assets/*` |
| `public/ui/items/imagegen-sample-v2/*` | `docs/art/items/imagegen-sample-v2/assets/*` |
| `public/ui/skills/imagegen-sample-v1/*` | `docs/art/skills/imagegen-sample-v1/assets/*` |
| `public/ui/skills/imagegen-sample-v2/*` | `docs/art/skills/imagegen-sample-v2/assets/*` |
| `public/ui/items/painted-complete-v1/preview.html` | `docs/art/items/painted-complete-v1/preview/preview.html` |
| `public/ui/items/painted-complete-v1/preview-manifest.json` | `docs/art/items/painted-complete-v1/preview/preview-manifest.json` |
| `public/ui/skills/painted-complete-v1/preview.html` | `docs/art/skills/painted-complete-v1/preview/preview.html` |

Archives can be opened through the local Vite server at `/docs/art/...`. The completed skill gallery loads production artwork through `/ui/skills/painted-complete-v1/<id>.webp`; the completed item gallery retains its absolute production image paths. The sample-v2 item gallery links to the relocated sample-v1 gallery.

Original PNG masters were moved without processing. All 75 original `.prompt.txt` / `prompts.md` files remain byte-identical; paths within historical prompt records intentionally remain as originally written. The table supplies their current location. JSON prompt values and all SHA256 fields remain unchanged; only current path metadata was migrated.

## Package size

Measurements are raw on-disk bytes, not compressed transfer estimates.

| Directory | Before | After | Saved |
| --- | ---: | ---: | ---: |
| `public/` | 130,593,316 bytes / 769 files | 82,718,752 bytes / 661 files | 47,874,564 bytes |
| fresh `dist/` | 133,321,830 bytes / 772 files | 85,447,266 bytes / 664 files | 47,874,564 bytes |

The public and build output each shrink by **45.6567 MiB**. Archived source artwork remains in Git and local authoring folders.

## Validation

- `npm test`: **1,028 total; 1,026 passed; 0 failed; 2 existing skips** (43.86 seconds).
- `npm run build`: passed (511 ms); existing large-chunk advisory remains.
- Every one of the 661 remaining public files has the same SHA256 as before cleanup, including all production icons, GLBs, fonts and license files.
- All **413** runtime item/skill WebP files remain.
- All **70** GLBs remain byte-identical. Parsed their embedded glTF JSON: **zero external buffer/image URIs**.
- All preserved/moved masters match baseline hashes; changed gallery links are the only edited archived asset content.
- Existing painted-icon receipt tests pass with migrated source paths and unchanged source/output checksums.
- `node tools/assemble-painted-items.mjs` writes to the authoring preview folder and reports 333/333 new masters, 15 reused masters, 516/516 mapped IDs and zero pending masters. The original moved preview manifest was retained byte-for-byte after this smoke check.
- Resolved absolute source and destination paths were checked inside this task worktree before each `git rm` / `git mv` operation.

Detailed local evidence: `artifacts/runtime-cleanup-baseline.json`, `runtime-cleanup-audit.json`, `runtime-cleanup-tests.txt`, `runtime-cleanup-build.txt`.

## Limits

This implementation report does not claim production deployment or a real-browser visual verification. Assigned QA and packaging checks provide their own screenshot, static-serving and server smoke evidence. No gameplay visual change was intended; those checks must confirm the active game continues to load its existing assets.

## Technical review and runtime fixture

Independent read-only technical review passed: 661 retained public hashes, 42 relocated files and 36 receipt source/output hash checks were verified; no findings in gallery paths, tool outputs or runtime/build allowlists. The multi-stage Dockerfile excludes authoring docs/tools, tests, Git history and local artifacts. Before cleanup, tracked docs/tools alone totaled 1,553,354,022 bytes (~1.447 GiB); this is excluded source content, not a measured Docker image saving.

The portable runtime fixture installed 16 production packages, confirmed Vite and development/authoring directories absent, loaded all 14 collision maps, HEAD-checked all 664 dist files and byte-compared 10 file extensions. Health endpoints, guest WebSocket welcome and missing-model 404 passed. Temporary fixture was removed. Docker execution/Linux permissions, live Railway and PostgreSQL were not tested because no Docker CLI is available. See `docs/technical/RUNTIME_PACKAGE.md` and `tools/qa/runtime-package-smoke.mjs`.

## Independent browser QA

QA used the freshly built `dist/` through the real local server at `http://127.0.0.1:8791/` (memory store). No Vite/source-module imports were used by the browser. Fresh headless Microsoft Edge/SwiftShader contexts seeded isolated Guest characters; production accounts were not accessed.

### Findings and limits

No missing production asset, broken visible item/skill image or JavaScript exception was found in the six-class asset-loading smoke.

Severity: minor — gameplay observation requiring separate follow-up; not established as a cleanup regression
Environment: built local Guest, Shaman, paddy, `?at=56,-172&map=paddy&t=10&ui=1`
Steps to Reproduce: Load the field online, wait for model loads, inspect both the authoritative combat array and CombatView graph.
Expected: A live encounter verification would require an authoritative live monster record alongside its view.
Actual: `combat.remote` was true and `combat.monsters` was empty, while CombatView retained visible models near the player. Production GLB requests succeeded and the models rendered normally, but authoritative monster combat was not verified.
Evidence: `artifacts/runtime-browser-qa/encounter-result.json` records the exact array, view records, player coordinates and successful asset responses; `desktop-monsters.png` shows the rendered textured models.
Suspected Area: online combat/view lifecycle (`src/net/NetCombat.js`, `src/combat/CombatView.js`), gameplay owner. The relevant runtime code/model bytes were not changed by this asset cleanup. No combat impact or baseline regression is claimed without a separate reproduction.

The first field screenshot at `0,-165` was on the gate road, outside a populated spawn. A later grassland smoke failed an extra `nearby.length > 0` assertion on the combat array. This failed attempt was not a missing-model error and was not hidden: the final bounded follow-up captures the actual view graph at valid orchard coordinates `56,-172`, confirms nearby rendered models and records the empty combat array explicitly. This QA certifies asset loading/rendering, not successful attacks on those monsters.

### Final checks and evidence

- Inspected the implementation worker's final `artifacts/runtime-cleanup-tests.txt`: **1,028 tests; 1,026 pass; 0 fail; 0 cancelled; 2 existing skips; 0 todo**, **43,859.2013 ms**. QA did not duplicate the already completed full run after source freeze.
- Inspected `artifacts/runtime-cleanup-build.txt`: **Vite build passed, 511 ms**; existing large-chunk advisory remains.
- Actual built-browser smoke passed for **muaythai, herbalist, hunter, warrior, shaman and assassin**. Each loaded its runtime player model, HUD and skill images without broken visible images. Assassin uses the existing muaythai avatar fallback; no new assassin model is implied.
- Actual inventory window loaded its visible production item images; no broken visible image was found. The Skills panel and skill hotbar also rendered the existing artwork.
- Captured and visually inspected textured paddy monster models; **88 monster-model responses** in the bounded follow-up were successful. No JavaScript exception or missing asset was observed.
- Main six-class smoke recorded **490 successful model/UI asset responses**, with zero non-favicon HTTP failures. Evidence: `artifacts/runtime-browser-qa/result.json` and `encounter-result.json`.
- Retired sprite `boar.png` / `boar.json`, all four ImageGen sample `preview.html` URLs and all three moved completed-gallery metadata URLs returned **404, `text/plain`**, rather than a false-success game page.
- An extensionless retired sample directory still returns the normal **200 `text/html` SPA fallback** containing the hashed game bundle. It does not serve the archived sample gallery. This distinction was checked by response content, not status alone.
- Actual production painted skill WebP and player/monster GLB URLs continued to return 200 and load in the browser. Static-serving evidence: `retired-extra-result.json` plus the asset-response list in `result.json`.

Screenshots under `docs/art/reviews/runtime-cleanup/`:

- `desktop-inventory.png` — Thai equipment frame and existing item icons.
- `desktop-skills.png` — Shaman HUD, avatar and skill hotbar.
- `desktop-skill-panel.png` — actual Skills window.
- `desktop-monsters.png` — textured monster view models around the orchard.

See the Art Director's `REVIEW.md` in the same directory. No visual redesign was intended. Runtime package measurements remain **82,718,752 bytes / 661 public files** and **85,447,266 bytes / 664 dist files**, saving **47,874,564 bytes** in each versus the recorded baseline. Hash preservation and all-file HTTP checks are the independent worker/packaging proofs described above, rather than a claim that every asset was rendered on-screen.

QA changed only this appended report and evidence screenshots/artifacts. No deployment was performed. Physical-device performance, live Railway/Postgres, an actual Docker container and authoritative monster combat were not verified. The portable production fixture passed as reported above; it does not replace a Docker/Linux run.
