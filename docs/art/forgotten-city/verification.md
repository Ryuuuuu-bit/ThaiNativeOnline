# Forgotten city name — isolated HUD QA

**No findings in the requested label/layout scope.** Final `node tools/city-name-qa.mjs`: exit **0**, **6 grouped checks passed, 0 failed, 0 browser console/page errors**. Tested headless Edge at **1366×768** and **390×844** using city name **นครที่ถูกลืมเลือน**.

The fixture serves the actual `index.html` with its boot script removed. It imports the real HUD styles (including `net.css` for CH 1), `HUD.setRegion`, `WorldMapPanel.setMap`, `MAPS.city`, and `loadingMarkup`. It never imports the account flow, Game or a WebGL renderer. The atlas directory/player callbacks are lightweight stubs; its header is populated by the real component. Empty map canvases and the index character placeholder are fixture limitations, not gameplay captures. One browser/page is reused; browser and dedicated Vite server close in `finally`. HMR/watch are disabled, and the Vite client is limited to CSS insertion to avoid development-websocket noise.

## Verified

- Map data, document title and location heading use the exact new name.
- At 1366×768 the minimap name is fully visible alongside CH 1, with no overlap, clipping or viewport overflow. No wrapping/layout fix is required at this viewport.
- At 390×844 existing touch CSS intentionally hides `#mini-name`; the full city name appears in the location pill below the minimap without ellipsis/clipping. No production CSS override was applied to force a mobile minimap label.
- The atlas heading contains the renamed title and breadcrumb at both sizes; the title does not overlap the close button. The atlas window stays within the viewport.
- Real `loadingMarkup()` shows the exact new name at both sizes. Its heading and content panel fit the viewport, and no legacy city name appears in the loading text.
- DOM text ranges, scroll/client widths and container/viewport rectangles are checked rather than relying only on screenshots. All detailed measurements are in [verification.json](verification.json).

## Screenshots

| State | Desktop 1366×768 | Mobile 390×844 |
| --- | --- | --- |
| HUD/location/minimap | [Desktop HUD](hud-1366x768.png) | [Mobile HUD](hud-390x844.png) |
| Atlas header | [Desktop atlas](atlas-1366x768.png) | [Mobile atlas](atlas-390x844.png) |
| Loading | [Desktop loading](loading-1366x768.png) | [Mobile loading](loading-390x844.png) |

## Changes and limits

QA owns only `tools/city-name-qa.mjs` and this evidence directory (six screenshots, JSON receipt and this report). No production files were edited or reverted. The parent owns runtime/document rename changes; the Art Director owns visual approval.

`npm test`: **not run**, as explicitly requested for this text task. `npm run build`: **not run by QA**; the capacity/build specialist Singer owns that check. No build success is claimed here. `git diff --check` on QA deliverables passed. No login, character creation, city traversal, combat, training dummy, collision/pathing gameplay, physical-device rendering or performance was exercised because this task requires an isolated HUD fixture without accounts/WebGL.
