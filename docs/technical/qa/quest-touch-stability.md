# Touch quest placement stability QA

## Finding and candidate resolution

Severity: minor

Environment: first PR102 deployment on UAT, isolated Guest at `?ui=1&at=4,150&t=12`, headless Microsoft Edge, touch 320×640 CSS pixels, DPR2/software WebGL.

Steps to Reproduce: start navigation; take the live center of the Stop chip, verify it is the topmost hit target, then perform a native touch tap while the camera/nameplate changes.

Expected: the actual pointer/click reaches the Stop button and clears navigation.

Actual: one original deployed trace returned a pre-tap button hit-test at CSS81,343, but the actual pointerdown/up/click reached CANVAS. The eventual route cancellation came from world input, so an inactive state alone did not establish Stop delivery. A second original tap reached SMALL inside the Stop button. Ten earlier short-window position samples had maxJump0; they did not prove that the later event arrived at the same geometry. No actual-event box was recorded for that original miss, and no after-box is inferred.

Evidence: preserved ignored `artifacts/navigation-equipment-online-ux/deploy-uat/tap-events-result.json` and `REPORT.md`. Original button samples x13/y319,136×48, from7793.8–9220.4ms; first pointerdown CANVAS9748.7ms, up9751.5, click9752.5. Second pointerdown SMALL12723.6ms with `navAction=stop`, up12723.7, click12724.6.

Suspected Area: `QuestUI.layout` / `questHudPlacement` placement decisions as live protected rectangles change; HUD owner.

Candidate resolution: source **`0ecb6a2af8a301e7e2ff0302308e1325d854b51b`** retains the previous touch anchor while it remains in bounds and clear of current protected rectangles. Unsafe placements still relocate or hide; viewport/mode changes and hidden or absent objectives clear the remembered anchor. Desktop behavior remains on its existing path. This report verifies the candidate locally; deployment of this correction is root's separate responsibility.

## Exact executed validation

| Check | Result |
| --- | --- |
| Fresh touch contexts | **4**:320×640 and390×844, modern and classic, DPR2 |
| Actual event-target Stop taps | **8/8 passed**, two ordinary native touchscreen taps per context; each pointerdown/up/click reached a child of the Stop button with `navAction=stop`, then active navigation and destination cleared |
| Short walking motion | **40 samples**,10 per context, approximately150ms intervals; max recorded button position jump **0 CSS pixels in all four contexts** while the player moved |
| Orbit / game zoom safety | **8/8 passed**, yaw1.4 and game zoom1.8 per context; zero current protected-rectangle intersections |
| Actual resize safety | **4/4 passed**,320→390→320 in both skins; clear edge geometry recomputed correctly, no protected intersections |
| Journal availability | **6/6 passed** across initial and resize contexts; objective actions remained available through the existing journal |
| Uncaught page errors | **0** in candidate and resize probes |
| Targeted tests | `node --test tests/quest-hud-layout.test.js tests/quest-guidance.test.js tests/quest-navigation.test.js tests/quest-journal.test.js`: **37 total,37 pass,0 fail,0 skip;158.2988ms** |
| `npm run build` | **Passed:355 modules,542ms**; existing >500kB chunk warning remains |
| Full `npm test` | Not rerun for this bounded presentation/layout tail. The preceding main behavior/server freeze has independent1298 total/1295 pass/0 fail/3 skip evidence in `navigation-equipment-online-ux.md`; it is not a full-suite result for this candidate. |

The primary eight taps use **actual event targets**, not just cancellation state. Each event record also includes the chip's box at event time and the viewport dimensions/DPR. All eight delivered pointer/click targets are inside the Stop button; none reached CANVAS. No forced click, DOM click, paused game loop or production account was used. Short-window stability is bounded to these recorded views, not every possible world nameplate trajectory.

Receipts and scripts are ignored under `artifacts/navigation-equipment-online-ux/deploy-uat/`: `stability-candidate.mjs`, `stability-candidate-result.json`, `stability-resize.mjs`, `stability-resize-result.json`, `stability-targeted.log`, `stability-build.log`. Fresh Vite port5370 had HMR/file watching disabled to hold the source freeze. Browser API and WebSocket requests were blocked.

## Changed files and native screenshots

Application/test changes are owned by implementation/root: `src/ui/QuestUI.js`, `src/ui/questHudLayout.js`, `src/quest/README.md`, `tests/quest-hud-layout.test.js`. This QA owner changed only this report, four native PNGs, and ignored probe/receipt files. No source code was edited or committed by QA.

- [320px modern walking](../../art/reviews/quest-touch-stability/320-modern-walking.png)
- [320px classic walking](../../art/reviews/quest-touch-stability/320-classic-walking.png)
- [390px modern walking](../../art/reviews/quest-touch-stability/390-modern-walking.png)
- [390px classic walking](../../art/reviews/quest-touch-stability/390-classic-walking.png)

Captures are native browser screenshots, unedited, at touch DPR2. Art verdict is independently owned by Art Director.

## Limits

This is local candidate QA, not live proof of the correction until the new deployed bundle is inspected. The sample covers portrait320/390, both skins, orbit, zoom and resize; no new landscape, desktop, all-map, physical-device, frame-rate or arbitrary-title certification is claimed. Existing desktop behavior is checked by the targeted geometry tests rather than a repeated browser matrix. No online persistence/party/trade/shop audit was duplicated, and no UAT save/account/database was modified. The original deployed transient miss remains preserved; earlier cancellation-only primary assertions were explicitly qualified rather than relabeled as real Stop delivery.
