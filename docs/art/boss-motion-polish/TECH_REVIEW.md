# Boss motion polish — technical review

Reviewed 2026-10-09 against [DIRECTOR_BRIEF.md](DIRECTOR_BRIEF.md), the [Art Bible](../ART_BIBLE.md) and [boss encounter authority](../../technical/BOSS_ENCOUNTERS.md).

**Technical: 8.5/10, bounded PASS. No remaining P1/P2 blocker found in the reviewed code or final audited asset bytes.** The earlier Mine/Giant/Rift numerical hold is closed by matching final asset and production-controller audits. This verdict includes map-lair data/selection and the repaired map-return lifecycle. Final map browser captures and the parent's full-suite/build run remain separate acceptance evidence.

## Authority and controller behavior

- [BossMotion.js](../../../src/combat/BossMotion.js) provides distinct bounded idle/walk cadence and .20–.40 preparation fractions for all twelve primary bosses. Prediction stops at the hold pose; only an authoritative impact releases toward the .56–.64 peak. Recovery lasts 1.1 seconds. Basic attacks retain the approved body attack clip.
- Serial guards reject stale/duplicate terminal events. Cancel returns to locomotion, death overrides other playback, and impact without windup supports late observers. Clearing requires a fresh active snapshot before resuming a cleared serial. These paths do not change server damage, timers, collision, footprints, spawning or progression.
- [CombatView.js](../../../src/combat/CombatView.js) checks monster-instance membership, replaces reused IDs, bridges authoritative events and clears map/disconnect presentation. The final lifecycle fix checks [isCombatModelDisposed](../../../src/combat/CombatResources.js) before reusing a view: returning to an offline map with the same Monster rebuilds its retired model and creates a fresh BossMotion, seeded only from its current cast snapshot.
- [MonsterModels.js](../../../src/combat/MonsterModels.js) loads body and optional library independently. Failed optional loads warn once through the cache and fall back; pending optional loading does not delay body readiness. A late body seeks the current phase; a late library cannot replace an in-progress cast. Fresh remaining samples avoid double-counting the frame, while unchanged snapshots permit bounded prediction. Per-instance frame state is reused.
- Root retirement runs once before resource release, stops/uncaches animation and prevents late body/library completion from attaching to a disposed group. Cache-owned geometry/textures survive; owned materials, instance buffers and skeletons are released. Regressions cover both immediate same-Monster recreation and a shared body request resolving after replacement.

Eight biped libraries supply idle/cast/ritual/slash variants. Rings choose ritual; circles and unarmed cones choose cast. Only Giant and Commander weapon cones choose slash; Mine and Dusk use cast. Buffalo, Takian, Pu Som and Naga retain their species-specific body clips.

## Transfer and final byte evidence

[retarget_motion.mjs](../../../tools/monster-models/meshy/retarget_motion.mjs) is offline/import-safe and rejects wrong species, protected-joint overrides, ambiguous actions and invalid gains/caps. Transfer uses first-key-relative rotations through measured rest frames, bounded additive deltas and an endpoint envelope. Only Body, Head and upper/lower arms change. Protected tracks retain decoded components, times and interpolation, including Root/Pelvis/legs, hands, tails and rigid prop/wing detail. No donor root displacement or replacement geometry, materials, textures, skin or weights is introduced. The original five body clips remain intact.

The [sanitized donor manifest](../../../tools/monster-models/meshy/motions/meshy-boss-actions-manifest.json) records real Meshy actions 0/125/126/219 and 12 credits. Donor SHA256: `a1dc3dd947907f1d3b14fa905eedda60cd67fcbc83dd14497a607f10fbcb807b`. No live account query, generation or Blender call was made for this review.

All eight current public body/motion pairs were independently hashed and matched the [delivery manifest](delivery-manifest.json), [asset audit](asset-qa.json) and [production-controller audit](controller-qa.json). Both audits report stable hashes and zero failing candidates:

| Evidence | Coverage | Result |
| --- | --- | --- |
| Asset audit | Eight libraries, 5,192 samples; exported keys and 24 Hz samples | PASS; zero nonfinite vertices or eligible edge violations |
| Production controller | Eight bodies, both actual skills each, 1,599 samples; 24 Hz plus phase boundaries | PASS; zero edge/protocol violations; windup, sustained hold, release, recovery and return-to-idle blends |

The controller helper uses actual makeMonsterModel loading, mixers and blending, inverting only fixed model placement to compare against approved source metres. It does not manually force mixer weights. Limits remain eligible indexed edges at least 5 mm, failing when ratio exceeds 2 **and** extension exceeds 1 cm; arm error 5 mm; foot drift 1.5 mm; floor -10 mm; rigid error .0001; protected transform error 1e-6. Aggregate maximum ratios/extensions alone do not identify an eligible failing edge. No tolerance was weakened.

Asset-audit SHA256: `09c7442491b3cd316f0a4392f1ea4bac21d8221bb938b2995f3610c6554396f1`. Controller-audit SHA256: `478a220dd6909aa5a223ca10507fe262677d8a8fbe12551ba0a6b9e10e17471b`; its source-QA pin matches the durable asset audit exactly. Reports were read and their published asset pins checked; these numerical audits were not rerun by this reviewer.

The rejected candidates remain historical evidence in [INITIAL_QA.json](INITIAL_QA.json). The manifest's retained pendingDeformationQA list describes that earlier staging state; the matching final passing audits close those entries. It is not evidence of a current failed asset.

## Public boss-lair map scope

[mapDirectory.js](../../../src/ui/mapDirectory.js) adds category `bosses` and **14 lairs across the twelve field maps, zero in city**. Current-map flagged SPAWNS sites join the exported combatSpawns zones and combat monster definitions. Effective phases follow the server's roster override `entry.active ?? area.active`, rather than intersecting schedules. Elite/boss entries explicitly say online CH1, matching server MonsterWorld creation. Short titles show name/level; details state lair, active phases and that current life/availability is not confirmed.

[Minimap.js](../../../src/ui/Minimap.js) renders static red/gold crown badges even with an empty/dead monster list or undiscovered locations. Border clusters limit distant-marker clutter; badge placement reserves compass, player and portal footprints. Mixed atlas clusters retain destination IDs and boss name/level. Search and filtering remain map-scoped. Selecting an entry focuses it without walking; the existing Walk action and navigation flow are retained. Live dots are suppressed only where the same type overlaps a displayed lair; moved bosses and filtered-out lairs retain their live markers.

## Fresh focused validation and limits

**84/84 focused tests passed:** 48 controller/combat/resource/feedback tests, 14 retarget tests and 22 boss-map/world-map/minimap tests. These include real AnimationMixer held-pose/impact continuity, cancellation/death priority, missing clips, stale serials, asynchronous retirement, same-Monster map return, instance isolation, protected tracks, all thirteen map scopes, effective phases, red/gold glyphs, overlap placement, stable selection and no automatic walking.

Command: `node --test tests/boss-map.test.js tests/world-map.test.js tests/minimap.test.js tests/boss-motion.test.js tests/boss-skills.test.js tests/boss-art.test.js tests/monster-feedback.test.js tests/meshy-motion-retarget.test.js`.

The prior build passed at 251 modules with the existing large-chunk warning. A new build and full-suite run are owned by the parent; none was launched here during the final capture freeze. The independent [Art review](ART_REVIEW.md) records bounded 8–8.5 PASS for all twelve bosses, with [capture evidence](capture.json) and isolated desktop/touch images. Those visual scores belong to that reviewer; this technical review did not re-inspect all images.

The exact-body controller numerical report covers complete skill cycles, not every cancel/death/late-load crossfade; those interruption paths have focused synthetic/controller regression coverage. Natural online encounters, packet jitter, terrain slopes, continuous visual contact/volume, physical-device FPS and the final boss-map mobile screenshots are outside this bounded verdict. No live FPS or universal all-frame anatomy claim is made.

Final review refresh changed only this document; the specialist's preceding map implementation is frozen for parent browser QA. Rawls owns the reviewed CombatResources/CombatView lifecycle patch.

## Final touch-card P2 closure

**P2 closed for the recorded touch layouts; Technical remains 8.5/10, bounded PASS.** The eight-line portrait rule in [world-map.css](../../../src/ui/world-map.css) sizes the selected sidebar from its content, hides the destination list and gives the map the remaining space. It applies only to selected layouts at width <=700px and height >=521px, leaving the existing landscape rules in place. No new blocker was found in this bounded CSS review.

The final [touch receipt](maps/touch-qa.json), recorded at 2026-10-09T16:06:50.817Z, covers Klong, Wat Rang and Demon Rift at 390×844 with coarse-pointer touch emulation: zero errors/overflow, complete card and Walk containment within sidebar/panel, and a 44px-high Walk target passing top/centre/bottom hit tests in all three cases. Selection still reports no navigation destination. Final screenshot witnesses are [Klong](maps/mobile-klong-selected.png), [Wat Rang](maps/mobile-wat_rang-selected.png) and [Rift](maps/mobile-demon_rift-selected.png); the rejected layout remains in [INITIAL_MAP_ART_REVIEW.md](INITIAL_MAP_ART_REVIEW.md) and maps/initial. The receipt was read; these screenshots were not independently re-scored here.

Parent reports the final CSS build PASS at 251 modules and 648/648 full tests before the CSS-only change. No tests/build were rerun for this closure. This supersedes the earlier pending touch-card/build notes for that evidence; other viewport sizes, physical-device performance and natural online encounter limits remain unverified. Only this review document was edited.
