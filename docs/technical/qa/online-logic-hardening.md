# Online logic hardening — independent QA

Branch `codex/online-logic-hardening`, worktree `artifacts/loading-worktree`, base `ccb3747567db042b40e94a0c610369cb5100dc34`. QA worked against shared uncommitted specialist/root freezes; no deployment or application edits by QA. Skill: game-playtest; checks follow `docs/technical/VERIFY.md`.

## Findings, resolved

Severity: major (test regression / synthetic-state compatibility)
Environment: Node test runner, `tests/trade-durability.test.js`.
Steps to Reproduce: inject the existing thin transaction fixture into Combatants, finish the pending-trade boss-percent-damage test and kill its character.
Expected: death clears casts even when that synthetic fixture has no casting Map.
Actual: initial sweep threw `TypeError` in `clearCasts` because the fixture lacked `casting`.
Evidence: `artifacts/online-logic-hardening-full-qa.log`, initial 6-failure sweep; final full sweep passes the test and new death/respawn regression.
Suspected Area: `server/combatants.js`, timing engineer. Resolution: owner used optional casting-Map cleanup while always clearing cast records; QA did not edit production code or bypass timing limits.

Severity: minor (resolved mobile failure feedback)
Environment: local Vite, fresh headless Edge, actual CSS viewport 390×844, classic skin, DPR2, mocked DELETE409.
Steps to Reproduce: delete a populated character; return `{ok:false,code:'in_play'}` with HTTP409.
Expected: retained character and failure reason visible in current viewport, with controls usable again.
Actual: before amendment, message box top913/bottom949 exceeded viewport844 while focus returned to delete. Desktop message also reached bottom768.796875 in viewport768. The live region existed, but the mobile player had to scroll to read it.
Evidence: ignored `selection-before-error-reveal-result.json`, `390-classic-delete-409-unscrolled.png`; final native `390-classic-delete-409.png`.
Suspected Area: `src/account/screens.js`, account engineer. Resolution: after restoring delete focus, scroll the connected nonempty error into view. Final actual error box top808/bottom844 on touch, top749.796875/bottom767.796875 on desktop. No QA scroll was used for final captures.

No unresolved blocker found in the bounded checks below. Independent TECH found additional pending-login mutation/final-save guards; root fixed them, and the final targeted test receipt exercises those real handlers. This report does not claim QA originally discovered those TECH findings.

## QA-owned fixture changes

The initial full sweep also failed five integration tests because they selected initial authenticated positions only through the hello packet. New login authority correctly ignores that packet. QA changed only legitimate initial saved-location fixtures, preserving production validation, reconnect behavior and golden save assertions:

- `tests/online-server.integration.test.js`: initial new-slot import now includes intended paddy coordinates for each character.
- `tests/party-board-server.integration.test.js`: account fixture accepts initial map and imports its canonical spawn; the member starts in paddy.
- `tests/pk-mode-online.integration.test.js`: existing server-side MemoryStore character fixtures include intended map/coordinates for PK participants and city control.
- `tests/service-warp-online.integration.test.js`: new-slot imports save their steward locations; field partner saves field coordinates.
- `tests/stash-online.integration.test.js`: each new-slot import saves its corresponding vault counter location.

No handler monkey patch, login-guard bypass, or expectation weakening was added. The five corrected production HTTP/WS tests passed **5/5**, no failures/skips, **15803.894ms**.

## Exact automated results and provenance

| Run | Result | Provenance |
| --- | --- | --- |
| Initial login-state + login-position integration | 5 total / 5 pass / 0 fail / 0 skip; 579.4011ms | Root first login freeze |
| Initial `npm test` | 1349 total / 1340 pass / 6 fail / 3 skip; 42756.1774ms | Preserved failures, before fixture/timing repairs and explicit account status regression additions |
| Corrected five HTTP/WS integration fixtures | 5 total / 5 pass / 0 fail / 0 skip; 15803.894ms | Canonical saved initial positions |
| Final `npm test` | **1352 total / 1349 pass / 0 fail / 3 skip; 42549.0929ms** | After timing/account-status repair and fixture changes, before final TECH login-tail and mobile error-reveal amendment |
| Final tail targeted tests | **20 total / 20 pass / 0 fail / 0 skip; 15830.5232ms** | After TECH guards: login-state, login-position-online.integration, accounts-server, character-names-online.integration, online-server.integration |
| Final `npm run build` | **Passed: 356 modules, 529ms** | After both TECH login-tail and mobile reveal freezes; assets main-B0JCwU9u.js / main-BpoUiNRN.css |

The final build retains the existing >500kB chunk warning. An earlier pre-tail build also passed (356 modules, 527ms). The full suite was not repeated after the narrow final login/UI tail; those changes have the separately identified targeted test, native browser and final build receipts.

Final targeted login integration includes forged hello position refusal; coherent saved character/quests/location/incarnation; same-slot login serialization and old live-movement save; IPC-held stored-row read refusing DELETE and rename with409; failed final-save write refusing replacement login while retaining the previous authoritative row. It also verifies real HTTP/WS name handling and online duel/recall/party warp/graceful shutdown.

Full-suite phase coverage includes all **11** `npc-contact-phase.test.js` cases: city shops close at home; travelling herbalist current phase/map only; all-night suppliers/occult/warp services stay available; invalid phases/prototype IDs/positions fail closed; no old-route phase union; master night schedules; quest/shop packet phase spoofing cannot override trusted `here.phase`; city flask/refinement scheduling. The shop/quest/refill/refine checks call production server handlers with trusted phase, not a separately authenticated browser session. The full suite also passed gridpath/maps/world tests and the admitted-skill scheduled-hit/timing checks.

Three unchanged conditional skips: local NPC packing requires `NPC_MODEL_DEPS`; actual NPC candidate reports gate; dedicated PostgreSQL integration requires its explicit environment. QA did not run dedicated PostgreSQL or claim real-database persistence in this task.

## Native selection browser smoke

Fresh isolated local Vite on5371 with HMR/watch disabled. Real `showCharacterSelect` and `ServerAccountStore` modules and existing styling/models were loaded by a disposable HTML harness. HTTP DELETE is mocked locally; all other `/api/**` requests aborted. No UAT accounts, tokens or saves were touched.

Actual viewports: desktop modern **1366×768 DPR1**, touch classic **390×844 DPR2**. Six assertions per context, **12/12 pass**, **0 uncaught page errors**:

1. Pending DELETE sets aria-busy, disables every screen button, displays “กำลังลบ…”, keeps character and UID and leaves selection unresolved.
2. Keyboard Tab/Enter cannot leave or issue duplicate DELETE while pending; exactly one request.
3. HTTP409 shows the automatically revealed error within the viewport, restores controls/delete focus and retains character/UID/rename metadata.
4. HTTP200 success removes the slot only after acknowledgement, renders an empty slot and removes UID/rename/location metadata.
5. Guest deletion makes no HTTP request, preserves Guest slot1 and another account's local character.
6. Native selection of remaining Guest resolves slot1 with `tno.guest.1/`, `fresh:false`.

Desktop uses ordinary locator clicks; touch uses native touchscreen taps at measured button centers after normal scroll-to-control. Native confirmations were accepted in the disposable fixture. Final error capture required no harness scroll. Mobile harness initially lacked viewport metadata; that receipt is preserved separately and excluded from final responsive proof. A later stale Vite transform-cache receipt was preserved, then Vite restarted after the source freeze before final capture.

Native PNGs in `docs/art/reviews/online-logic-hardening/`:

- `1366-modern-pending-delete.png`, `1366-modern-delete-409.png`, `1366-modern-delete-success.png` (1366×768).
- `390-classic-pending-delete.png`, `390-classic-delete-409.png`, `390-classic-delete-success.png` (780×1688).

These are fresh browser screenshots; no image editing/resizing. Independent Art review **APPROVED** these six states; see `docs/art/reviews/online-logic-hardening/ART_REVIEW.md` for scores and limits.

## Separate PostgreSQL verification addendum

After the main QA freeze, a separate PostgreSQL QA agent ran the optional real-database integration. Its first run failed at the normal shop assertion while using the live clock, consistent with the new night/home contact gate. No clock packet was captured in that run, so its exact phase is inferred. Root set the test's supported server startup CLI to `--hour=10` for both initial and restart runs, retaining all production guards and assertions. This is the sixth integration-fixture adjustment; the five position fixtures above remain as reported.

The fresh PostgreSQL18.6 rerun passed **1/1 test, 0 failures, 0 skips**, with **67/67 receipt checks**, one actual application restart and two graceful shutdown save drains. Test duration **16729.198ms**, total **16790.6693ms**. Allocation, quests, stable UID, gold, exact flask instance metadata and location persisted. Stale HTTP snapshots could not undo trade or saved position. Dedicated local fixtures and services were cleaned up; no UAT database or accounts were used.

See `docs/technical/qa/online-logic-hardening-postgres.md` for the independently attributed evidence, failure history and limits. The earlier full-suite's three conditional skips remain historical results; PostgreSQL was subsequently executed separately. This addendum does not turn the original full-suite receipt into a later rerun.

## Receipts and limits

Ignored receipts: `artifacts/online-logic-hardening/ui-qa/final-full-test.log`, `final-tail-tests.log`, `final-tail-build.log`, `selection-result.json`, `selection.log`, `selection.html`, `selection.mjs`. Initial login/full/location logs remain directly under `artifacts/` with `online-logic-hardening-*-qa.log` names. `git diff --check` passed (only existing line-ending conversion notices).

This is a bounded account-selection and online-logic gate. It does not verify physical-device tapping or rendering performance, a full login→creation→city browser journey, all in-world combat/NPC interactions visually, the entire HUD matrix, or live UAT/PostgreSQL save durability. Existing full-suite tests cover those logic areas only to their written assertions. The selection fixture calls the actual screen/store with mocked HTTP and does not establish remote server response timing. No commits, pushes or deployment by QA.
