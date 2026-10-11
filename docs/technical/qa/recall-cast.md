# Recall menu and five-second cast — QA

Validated 2026-10-11 on branch `codex/menu-recall-five-second-cast` in `artifacts/recall-cast-worktree`.

## Findings

No remaining blocker or major regression found in the changed recall flow.

Severity: cosmetic (existing local development asset)
Environment: fresh headless Microsoft Edge, Vite http://127.0.0.1:5331/, normal HUD
Steps to Reproduce: Open the game, create a Guest character, navigate/reload.
Expected: Browser favicon request resolves.
Actual: `/favicon.ico` returns 404; game scripts and recall continue normally.
Evidence: `artifacts/recall-cast-qa/browser-result.json` records three console resource errors with the same favicon URL. No JavaScript exceptions.
Suspected Area: page favicon/static asset, gameplay UI owner. Outside this change.

Resolved review finding: empty `.online-actions` left a small outlined dot below the minimap after removing the recall button. The final browser run asserts this empty shell is hidden and the idle screenshots show it removed. Party/duel/karma context selectors remain available; actual signed-in party warp is covered by the full integration suite.

The first full test run caught the existing online-server integration test's two-second wait becoming shorter than the new five-second cast. The server owner updated the scenario to wait for the authoritative five-second result and added cancellation/duplicate checks. The final full run below passes; the initial failure was not hidden or skipped.

## Validation

- `npm test`: **1,025 tests; 1,023 pass; 0 fail; 0 cancelled; 2 existing skips; 0 todo**, 53,326.0684 ms. Exact final output: `artifacts/recall-cast-qa/npm-test-final.log`.
- `npm run build`: **pass**, Vite 8.3.2, 561 ms. Existing bundle-size warning remains. Output: `artifacts/recall-cast-qa/build-final.log`.
- The full suite includes gridpath, map/world and signed-in real HTTP/WebSocket integration scenarios. The signed-in recall → city → immediate party warp scenario passes.
- Read the changed server, client, menu and DynamicHUD diff against the requested behavior.

### Real local WebSockets

Fresh memory server on port 8789, no production account or data:

- Ordinary recall did not warp before five seconds; observed authoritative city position after **5,044.9975 ms**.
- Duplicate request after one second returned 3.9830104 seconds remaining, preserving the original deadline.
- Forged client timing (`duration:0`, `remaining:0`) did not shorten the server cast.
- Explicit cancel, accepted movement and skill intent interrupt the pending recall. Retrying after cancellation starts a fresh cast without consuming recall cooldown.
- Accepted portal map change cancels the cast; retry in the city is correctly refused as already in city.
- Disconnect during the cast closes the socket; the manager's state cleanup/restart requirement is also covered by regression tests.
- Opened CH 2 with 33 temporary local Guest sockets, then switched CH 1 → CH 2 during a cast. Server cancels with `moved`; immediate recall retry succeeds.
- A fresh Guest beside an active forest monster started recall and received a real monster attack (`ma`, monster 96, power 1.2); server cancelled the cast with `busy`.

Evidence: `artifacts/recall-cast-qa/ws-result.json` and `ws-extra-result.json`.

### Actual browser flow

Fresh headless Edge context using SwiftShader, Vite 5331 proxying memory server 8789. Restarted Vite after final UI edits; normal HUD (`ui=1`).

- Guest login → empty character selection → character creation → city succeeds.
- No `.online-actions [data-recall]` floating button exists. Idle cast panel is hidden.
- Main menu Adventure group exposes the recall tile. Selecting it closes the menu. Recall from city is safely refused.
- Keyboard B starts the server-authorized cast. The temporary countdown and Cancel appear only while casting; cancellation hides them.
- Desktop 1600×900, portrait 390×844 and landscape 844×390: menu recall is reachable, temporary countdown/cancel stays on-screen. Landscape screenshot scrolls the menu to the Adventure group.
- Full B cast preserves the field position during its countdown, receives the authoritative city warp and hides the cast panel afterward.
- Default desktop HUD is noncompact. The exploration panel is hidden for this fresh character, so its visible quest placement was not claimed as a browser verification. The DynamicHUD fallback uses the minimap bottom when the contextual shell is hidden.

Evidence: `artifacts/recall-cast-qa/browser-result.json`; no JavaScript exceptions. Resource errors are solely the favicon finding above.

## Screenshots

Saved under `docs/art/reviews/recall-cast/`:

- `desktop-clear.png`: idle normal HUD, floating recall and empty shell absent.
- `desktop-menu.png`: recall in Adventure menu.
- `desktop-cast.png`: temporary countdown and Cancel.
- `desktop-recalled.png`: city after successful cast; countdown gone.
- `portrait-clear.png`, `portrait-menu.png`, `portrait-cast.png`.
- `landscape-clear.png`, `landscape-menu.png`, `landscape-cast.png`.

Art review: see `REVIEW.md` in the same directory.

## Scope and limitations

QA changed only this report and evidence artifacts/screenshots. Implementation files belong to the UI/server engineers and are listed in the PR diff.

No deployment or production account was changed. Physical mobile devices, production latency/load and an authenticated browser login were not tested. Authenticated party behavior was exercised by the real HTTP/WebSocket integration suite. Manual training-dummy combat was not rerun in the browser; movement/combat interruptions were checked over actual sockets and the full regression suite. SwiftShader timings are not device-performance measurements.
