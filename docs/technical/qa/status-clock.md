# Status persistence and minimap clock QA

Environment: branch `codex/fix-status-save-minimap-clock`; fresh headless Edge with SwiftShader; Vite `http://127.0.0.1:5330/`; local authenticated WebSocket server on port 8788 using its memory store. Test account and character were created locally, with GM commands supplying Lv.100 stat points. No production account was touched.

## Resolved finding

Severity: major
Environment: signed-in stat allocation; build-plan allocation at Lv.100
Steps to Reproduce: allocate more than 40 points as individual operations in one burst, then reload or log out and log in.
Expected: confirmed allocations and remaining points survive the new session; rejected predictions are restored visibly.
Actual: the previous per-point implementation exceeded the 40-message/s limiter and left a locally predicted build that the authoritative save did not contain. The change sends a build as one atomic operation and reconciles rejected rapid individual operations.
Evidence: `tests/stat-persistence.test.js`; authenticated browser round trips below.
Suspected Area: CharacterUI build-plan handler, NetProgress operation wrapping, server rate limiting. Owner: gameplay engineer.

## Executed checks

- Real authenticated browser/socket: start with 297 unallocated points; atomic spend returned true, allocating STR 10, AGI 7, VIT 30, INT 150, DEX 90, LUK 10, with zero remaining. Immediate browser reload and explicit logout/login preserved the exact allocation and point balance.
- Disconnected authenticated allocation calls returned false without changing the sheet. Initial-sync, reconnect and reset guards were also exercised by the regression suite.
- Real authenticated burst of 100 separate allocations: prediction changed INT 189 to 289 and points 161 to 61. Server correction accepted 40, returning INT 229 and points 121, and emitted one `stat-refused` feedback event. No JavaScript exceptions occurred.
- Guest atomic allocation of 100 points, STR 60 and VIT 40, survived immediate reload.
- Guest actual stat UI: clicked the STR + button; points changed 2 to 1 and STR 0 to 1. Immediately read localStorage before unloading: it already held points 1 / STR 1. Reload preserved both values.
- Direct DOM screenshots at 1600x900, 390x844 and 844x390: the unique clock element is inside the minimap and below its map frame in all three. It remains visible in short landscape and occupies a separate row from safety/coordinates. Art review passes.
- Diff review confirms stat budgets, dead-character validation, server authority and slot separation are retained; no map, collision or pathing changes.

`npm test`: exit 0; 1,017 tests, 1,015 passed, 0 failed, 2 existing skipped, 0 cancelled, 0 todo; duration 66,180.3549 ms.

`npm run build`: exit 0; Vite completed in 581 ms. Existing bundle-size warning remains.

Screenshots: [desktop](../../art/reviews/status-clock/desktop.png), [portrait](../../art/reviews/status-clock/portrait.png), [landscape](../../art/reviews/status-clock/landscape.png). Browser JSON and full command logs are local scratch artifacts under `artifacts/status-clock-qa/`.

## Limits

This validates a local memory-store account across browser sessions, not Postgres or server-restart durability. The browser was seeded through real account APIs, so the visual login/character-creation forms were not traversed. Movement, combat and training-dummy interactions were not manually retested; their automated coverage remained green. Captures show daytime, not a separate night capture. Viewports are emulated, not physical mobile devices; SwiftShader timings are not performance measurements. Asset-fetch cancellation warnings occur while navigating away from the game and are not JavaScript crashes. A disabled-watcher Vite cache was restarted before the focused final feedback check so that it loaded the final modules.

