# Newcomer journey verification

Final code: `npm test` **764 tests / 762 passed / 0 failed / 2 optional skips**.
`npm run build`: **282 modules**, passed; existing bundle-size advisory remains.

Final screenshots:
- `desktop-desktop.png`: 1600 × 900.
- `portrait-portrait.png`: 390 × 844, touch enabled.
- `landscape-landscape.png`: 844 × 390, touch enabled.

Each matching `*-result.json` records 17 passing checks plus completion, with no
page errors. Real headless Edge checks night keeper availability and dialogue
acceptance, initial collapsed guide, reward previews, bag/map/status/skills/bestiary
buttons, route selection toward the quest destination, scroll bounds, 44 px touch
targets and a close control within the journal. SwiftShader console warnings
are retained in `*-console.json`; they are not production GPU measurements.

`tests/newcomer-online.integration.test.js` starts production HTTP/WS handlers
with an isolated MemoryStore. Nearby acceptance, remote-talk forgery rejection,
keeper warp, acknowledged talk and claim, duplicate payout prevention, forged API
save correction and persisted rejoin run over real sockets. Fixtures seed initial
locations and completed prerequisite quests; client counts/rewards are rejected.

`tests/newcomer-journey.test.js` checks all six shared quests offline, material
consumption, accepted kill/talk counting, reward idempotence, reload, six-class
acceptance, server kill rewards and references to real targets and all-day NPCs.

Reproduce screenshots with a dev server on 5196:

```
node tools/newcomer-browser-check.mjs http://127.0.0.1:5196/tests/browser/newcomer-probe.html desktop 300000 <absolute-output-directory>
```

Add `?mobile=portrait` or `?mobile=landscape`, using distinct output prefixes.
The runner uses a fresh browser profile and captures the actual DOM and game
canvas together. Browser action verification changes the fixture level to expose
different milestone buttons. It does not claim a naturally played Lv 1 → 20 run,
physical-device performance, live-party balance or production database coverage.

Art Director approved the final modal at 8/10 across all four criteria. The guide
opens only on request; the existing compact quest tracker remains available.
