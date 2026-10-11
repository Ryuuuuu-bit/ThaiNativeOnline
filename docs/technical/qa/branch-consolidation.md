# Branch consolidation QA

No unresolved blocker found in the bounded integrated checks. The combined source adds authoritative class/status adapters, one1.2 outgoing player damage modifier, card collection/compendium and boss socket abilities, and the newcomer journey while retaining current loading, painted HUD/profile/title art, GM access and FX rendering guards.

## Findings corrected before release

**Medium — generic damage-over-time cleanse compatibility.** Director review found ordinary generic `dot` buffs absent from the harmful-field classifier. A local/server snapshot could retain this effect without cleanse removing it consistently. Owner corrected the classifier in `d575707` and added a meaningful snapshot/cleanse regression. QA's post-freeze targeted run passes. No unresolved finding remains.

**Low — buff-duration preview omitted cooldown reduction.** Director review found the preview adapter did not forward `cooldownCut` to the live self/party effect helpers, so displayed duration could differ from the actual buff. Owner corrected both adapter calls in `1e0096c` and added comparisons against the live helpers. QA's post-freeze targeted run passes.

## Scope and files

Reviewed integrated conflict resolutions and representative modules: `Character`, `Combat`, `KitCaster`, `kitCombat`, class status effects/tether, server combatants/monsters, network combat snapshots, outgoing damage and skill preview rules, card collection/socket effects, card compendium, newcomer quest data/journey/UI, plus the consolidation override ledger. The outgoing modifier is applied once after damage calculation and before final rounding; monster damage, healing and derived stats remain separate, as covered by regression tests. Strongest defense, hit budgets and authority adapters are included in test coverage.

QA changed only this report, six native screenshots and ignored scripts/results under `artifacts/branch-consolidation/qa/`. Integration ownership, ancestry and branch operations belong to the integration engineer/root; their separate proof records105 snapshot refs/58 distinct tips as ancestors. QA did not delete branches, edit gameplay or deploy.

## Exact validation

- One full `npm test` on the initial consolidation freeze:1256 total,1254 passed,0 failed,2 skipped,0 cancelled,44284.2353ms. Log `artifacts/branch-consolidation/qa/npm-test.log`. This run precedes the two small Director corrections above; it is not described as a full-suite run of their new tests.
- QA then ran `node --test tests/combat-state-client.test.js tests/skill-preview-damage-tuning.test.js` on final corrected source:10 total,10 passed,0 failed/skipped,398.1696ms. Log `post-freeze-targeted.log`. No redundant full-suite rerun was performed for those narrowly covered changes.
- Final `npm run build` after both corrections: passed,349 modules,529ms. Log `build-final.log`. Existing large-chunk advisory remains; no build failure.
- The full suite actually executes real local WebSocket/HTTP tests for class effects, newcomer acceptance/claim/save/rejoin and GM authorization; pure tests cover outgoing1.2 player-only scaling/rounding/preview, mob opt-out, unchanged healing, status/tether/cleanse/undying, hit budgets, all-slot equipment drops/affixes, card history/socket effects, rank/GM behavior, loading retries and FX viewport/shader guards. These test results do not imply all those mechanics were manually replayed in the browser.

## Actual browser checks

Isolated local Guest, API/WS intentionally blocked, fresh Vite5340. Actual game loaded its avatar/city/HUD and settled loading. Five primary checks passed with zero uncaught page errors:

1. Lv1 newcomer first quest was offered by its actual NPC; clicking the dialogue accept button made it active. Journal displayed the reward preview.
2. Newcomer journal bag action opened the real character bag, then closed it.
3. Actual CardCompendiumPanel showed67 catalog rows and0/67 discovered for a fresh Guest. First card selection displayed a painted detail illustration; the player guide opened separately.
4. Real private `gmAccess` client handler still made41 titles available; profile displayed level100 and Sovereign art after the isolated fixture changed level/equipped title.
5. Actual learned/forced-level Shaman `mage_akom` cast was accepted at the city dummy, with a visible local projectile and no blocking loading/gameplay modal or opaque dim overlay.

After the final preview correction, restarted the QA-owned Vite and repeated only a bounded cast/profile check. The final accepted `mage_akom` frame was captured. A fresh actual-touch390×844,DPR2 context selected the card before waiting for its visible detail illustration; `complete` and `naturalWidth>0` passed and a native touch detail screenshot was captured. Both final contexts had zero page errors. Painted title/profile requests recorded200. Other assets are demonstrated by the screenshots and selected-image decode check, not a complete network inventory in this browser probe.

## Screenshots

Six native captures in `docs/art/reviews/branch-consolidation/`: `newcomer-journal.png`, `card-detail.png`, `player-guide.png`, `profile-world.png`, `shaman-cast.png`, `touch-card-detail.png`. Art reviews the integrated UI separately. The profile-world snapshot documents HUD framing; use the final cast frame for actual visible avatar/nameplate evidence. No screenshot pixels were edited.

## Harness corrections and limits

An early image-readiness snapshot ran before lazy images decoded and included hidden/offscreen rows, producing false flags. The first mobile detail wait occurred in catalog view where detail is intentionally hidden, and the next attempt duplicated a list click after the list was hidden by detail view. Corrected to one real card selection followed by visible-detail decode wait; the final touch check passed. These fixture failures are preserved in ignored logs and are not asserted product regressions.

No production accounts/saves were used. Local MemoryStore protocol tests are distinct from synthetic private-message browser GM checks. Physical devices, hardware-GPU flicker, performance, full authentication/character-creation flow, all maps/classes/boss battles, all67 cards and every socket ability were not manually certified. The Shaman cast used `?skill=5` to ensure a learned representative skill; no claim of a full combat balance playthrough is made. Existing narrow-screen world-label/HUD overlap limits remain. Collision/pathing coverage comes from the passing suite rather than a new manual map sweep. Deployment and live UAT verification remain a separate follow-up after the parent's success gate.
