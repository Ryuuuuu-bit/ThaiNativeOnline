# Navigation and equipment UI browser QA

## Finding, resolved

Severity: minor  
Environment: `/ ?ui=1&at=4,150&t=12` (without the space), isolated local Guest; headless Microsoft Edge/Playwright, touch DPR 2, 320 × 640 CSS pixels, both modern and classic skins; initial UI source `f660272fad5493845b16d8f4241932e8dbde40e6`.  
Steps to Reproduce: track `newcomer_supplies`; leave the quest idle, with the player near the southern city route; inspect the objective chip and the separate potions/AUTO row. Orbiting the camera also reproduces the overlap.  
Expected: objective HUD avoids all actionable combat/utility controls.  
Actual: the chip intersects AUTO settings by 16 × 15 CSS pixels. `TouchControls` appends `.touch-side` outside `.touch-combat-dock`, while the placement obstacle list included only the dock.  
Evidence: initial `artifacts/navigation-equipment-online-ux/ui-qa/result.json`; native before image `artifacts/navigation-equipment-online-ux/ui-qa/exploratory/320-normal-navigation.png`.  
Suspected Area: `src/ui/QuestUI.js`, HUD/layout owner.  
Resolution: root added `.touch-side` to protected rectangles in `0f3bad3628867a5330b3d4ee3665578183c7399a`; final browser retake found zero intersections in 40 touch layout states. Root separately reports 9/9 geometry regression tests; this browser owner did not run those tests.

Severity: cosmetic  
Environment: classic skin selected equipment detail, desktop 1366×768 and touch 390×844; parchment background.  
Steps to Reproduce: select refined armor or an accessory with mixed stat changes; scroll the selected item into its current → after comparison and inspect refinement, replacement/card text and notes.  
Expected: selected-detail text remains readable on the parchment, with text contrast at least 4.5:1.  
Actual: Art scored classic readability 7; the new light captions/labels/deltas inherited a dark-UI palette on pale parchment. During the first ink fix, computed replacement/card text still inherited `#6c5434` (2.62–2.92:1 against the conservative darkest sampled parchment) and `#49331d` notes reached only 4.37:1 in the desktop sample. Existing green item bonus text was 4.264:1 even against the plain base parchment before shading.  
Evidence: ignored `ui-qa/classic-before-note-tail.json`, before native `ui-qa/exploratory/touch-equipment-1-actions-before-classic-fix.png`; Art review and final captures linked below.  
Suspected Area: `src/character/ui/inventory-workspace.css`, equipment presentation owner/root.  
Resolution: classic selected-details only now use dark ink (`#332414` captions, labels, metadata and notes; `#123c1c` beneficial/item bonuses; `#5c1b0b` adverse/refinement). Final CSS source **`689e3da75b1531699fe3f222f2e860388236cbc9`** passed all four contrast fixture sets, minimum **4.7607:1**. Modern and classic dark hover tooltip computed colors remain identical. No further confirmed bug in the bounded checks below. This is not certification of every menu, authenticated transaction, map, or physical device.

## Summary and files

Read-only browser QA, plus this report and nine native PNG evidence files under `docs/art/reviews/navigation-equipment-online-ux/`. No application code, account, UAT save, balance, or server configuration was modified by this QA owner. Root/specialist own the resolved layout and scoped contrast fixes.

The equipment behavior source is the combined branch through `f660272`; final navigation placement is `0f3bad3`, with scoped classic CSS reviewed at `689e3da`. Vite used fresh isolated ports 5365/5366 and 5367/5368 after CSS freezes with HMR/file watching disabled. All `/api/**` requests and `/ws*` connections were blocked. Guest data lived in fresh browser contexts. The first attempted port 5357 was rejected by Windows with EACCES; the fallback ports started successfully.

## Exact bounded results

| Check | Result |
| --- | --- |
| Initial layout matrix | 48 settled states: 1920×1080 / 1366×768 desktop and 320×640 / 390×844 / 844×390 / 640×360 touch, both skins, idle / walking / HUD scale 1.8 / camera orbit |
| Initial confirmed intersections | 4 states, all the same 320px `.touch-side` / AUTO settings defect; fixed above |
| Final touch layout retake | 40 states: four touch sizes × two skins × idle / walking / HUD scale 1.8 / camera orbit / game zoom 1.8; **zero protected intersections** |
| Final fallback | 20 of those states hid the chip when space was unavailable; 1/1 explicit journal fallback check passed |
| Navigation and equipment behavior | **18/18 passed** |
| Real pointer scrolling and focused world-key guard | **2/2 passed** |
| Uncaught page errors | **0** across the final layout/behavior/capture runs |
| Classic final contrast fixtures | **4/4 passed**: armor/accessory × desktop/touch; minimum 4.8896:1 desktop and **4.7607:1 touch**, across actual 65,536 generated texture pixels composited with the darkest gradient endpoint |
| Classic action and tooltip probes | **6/6 passed**: four scrolled action hit-tests, exact modern/classic dark-tooltip palette equality, actual classic pointer/wheel hover scrolling |
| `npm test` | Independent authenticated-audit QA executed **1298 total, 1295 pass, 0 fail, 3 skip; 43813.0689ms** on behavior/server freeze. Not run by this UI owner; see `navigation-equipment-online-ux.md`. No repeat suite for the CSS-only tail. |
| `npm run build` after final CSS `689e3da` | **Passed: 355 modules, 547ms**. Executed by this UI owner; existing >500kB chunk warning remains. Ignored receipt `ui-qa/build-classic-final.log`. |

Receipts and repeatable ignored scripts: `artifacts/navigation-equipment-online-ux/ui-qa/{browser.mjs,result.json,capture.mjs,capture-result.json,retake.mjs,retake-result.json,classic.mjs,classic-result.json}`. A first arrow projection probe used the wrong sign for normalized screen Y; corrected independent projection matches the camera, so this was a probe error, not an application finding. A 300ms wheel check initially read before the asynchronous scroll settled; the final probe waits for the actual scroll and passed with tooltip `scrollTop=223`. The first classic texture probe raised `EncodingError` because it sliced the observed `url(data:...)` as if quoted; corrected extraction decodes the actual CSS inline PNG and samples it in canvas. The failed harness log is retained as `classic-url-error.log`; this was not a product console error.

### What was exercised

- The guidance arrow matched the **real camera projection of the current next path waypoint**, independently at camera yaw 0, 0.8 and 1.6 radians (absolute angular error 0 at recorded precision). Remaining route distance decreased from 249.21 to 242.71 world units during actual frames of movement. Manual W movement cancels, Stop clears the route, and AUTO-on refuses quest navigation.
- Placement rectangles included actual `.plate.is-self`, `.location`, profile, minimap, chat, main-menu button, combat dock, the separate touch side row, AUTO/settings, potion buttons, joystick/touch zones and utilities. Movement, orbit, normal/enlarged HUD and game zoom were sampled. If no safe edge position exists, the journal remains accessible.
- Armor with refinement, random affixes and a card, plus an accessory replacing **the actual first occupied charm slot**, were inspected on desktop and touch. The 10 changed armor rows and 8 changed accessory rows matched the formatted DOM current/after columns and the getters of a disposable `Character` after actual `equip`. Live character JSON was unchanged by preview. Both examples included beneficial and adverse deltas, with conditional card disclosure rather than invented flat damage.
- Item decomposition visibly separates base stats, refinement, random affixes and card bonuses. Selected-item actions were reachable by scrolling on desktop and touch. Hover content is viewport bounded; an actual pointer transfer into the tooltip followed by a mouse wheel scroll kept it open. Escape closes the tooltip before the inventory. Focused equipment actions consume Space/skill keys; quest-search typing `wasd` did not move the player.

## Native screenshots

These are direct browser captures; no repainting, image editing, or resizing was used. Touch PNGs retain DPR 2.

1. [Desktop active navigator](../../art/reviews/navigation-equipment-online-ux/1366-walking-navigation.png)
2. [320px final navigation placement](../../art/reviews/navigation-equipment-online-ux/320-normal-navigation-fixed.png)
3. [Touch enlarged HUD](../../art/reviews/navigation-equipment-online-ux/390-large-navigation-fixed.png)
4. [Desktop comparison table](../../art/reviews/navigation-equipment-online-ux/desktop-modern-comparison-table.png)
5. [Desktop pointer-scrolled hover](../../art/reviews/navigation-equipment-online-ux/desktop-modern-hover-scroll.png)
6. [Touch comparison table](../../art/reviews/navigation-equipment-online-ux/touch-modern-comparison-table.png)
7. [Touch scrolled actions](../../art/reviews/navigation-equipment-online-ux/touch-equipment-1-actions.png)
8. [Touch journal fallback](../../art/reviews/navigation-equipment-online-ux/touch-journal-fallback.png)
9. [Final classic comparison table](../../art/reviews/navigation-equipment-online-ux/desktop-classic-comparison-table.png)

Exploratory and pre-fix captures were moved into the ignored `ui-qa/exploratory/` directory to preserve evidence without shipping redundant PNGs. Art review is owned by Art Director, not this report.

## Known limits

Authenticated persistence/party/trade/shop/portal tests are the separate PostgreSQL audit owner's responsibility. This probe intentionally cannot validate server authentication or online transactions because its API and WebSocket traffic is blocked. Skill casts, every class/item combination, every map and all other menus were not re-audited. No UAT account/save was touched. Headless Edge uses software WebGL; timing and FPS are not physical-device performance measurements. The journal fallback was opened through the existing game action, not a physical thumb tap. Fixed samples cannot prove that arbitrary dynamic world nameplates never intersect at every possible frame; they cover the recorded viewpoints and movement states.
