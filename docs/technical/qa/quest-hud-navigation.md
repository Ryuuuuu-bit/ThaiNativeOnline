# Quest HUD/navigation and player-facing UX audit

Initial checkpoint and final validation are recorded separately below. QA made no application edits. This is a broad entry-point audit with explicit coverage limits, not an assertion that every UI or gameplay flow passed.

## Initial findings (P2 / minor usability defects)

**P2 — newcomer toggle overlaps chat in ordinary touch gameplay.**

Severity: minor. Environment: local Vite5341, isolated Guest, headless Edge/SwiftShader, actual touch DPR2. Steps to reproduce: active newcomer quest, Lv5 Guest, modern/classic touch320/390 portrait or640/844 landscape; leave journal closed. The toggle occupies y145–189 while collapsed chat occupies y104–158, intersecting13 CSS px. Expected independent touch targets. Owner: gameplay/UI layout. Receipts `baseline-result.json` and native before390 normal screenshot.

**P2 — normal touch has no visible tracked objective; expanding guidance dominates the playfield.**

Severity: minor. Environment: same isolated browser fixture. Steps to reproduce: same active quest on touch; `#quest-tracker` has no rendered box. The only newcomer entry opens the large exploration/guide surface overlapping profile/chat and most central world; the320 guide requires scrolling before the tracked objective. Expected compact current objective/navigation with optional full journal. Owner: quest UI/gameplay engineer. The expanded surface intentionally blocks movement; this is a usability/layout gap, not an authority failure.

**P2 — Auto sheet extends below a fresh short touch viewport.**

Severity: minor. Environment: local Vite5341, isolated Guest, headless Edge/SwiftShader, actual touch DPR2. Steps to reproduce: fresh actual-touch640×360 context, open Auto. Panel is x6/y6,w628,h502.28,bottom508.28, exceeding viewport bottom148.28px while the page itself does not scroll. Native image visibly shows only the first settings block. Expected viewport-bounded sheet with reachable internal scrolling. Owner: Auto/UI layout. After maximum internal scroll (scrollTop551, scrollHeight1053, clientHeight502), the last Reset button remains y454.75–491.75, outside the360px viewport. The lower action is therefore unreachable in this measured layout. Receipt: `auto-reach-result.json`; zero page errors.

Provisional desktop Skills/Settings clipping measurements after resize were rejected: fresh1366 contexts show both windows fit and close controls visible. Earlier rectangles were sampled before layout settled, not confirmed product bugs.

## Entry-point coverage at the initial checkpoint

| Surface | Evidence actually obtained | Limit |
|---|---|---|
| Boot/loading | Fresh Guest enters rendered city in desktop/touch contexts | No slow/failure-route replay yet |
| Login | Actual fresh1366/390 login, no horizontal overflow | No credentials/auth request submitted |
| Character select | Actual Guest button → empty-slot selector, no horizontal overflow | No signed account/slot data |
| Character creation | Actual empty slot → creation preview,19 buttons, viewport fits | No creation confirm/save |
| Profile/PK/vitals | Actual rendered profile/vitals; Lv5 hides protected PK control | No PK network round trip |
| Minimap/clock | Actual visible bounds in all six sizes/both skins | No map/channel migration replay |
| Hotbar/touch controls | Native normal captures show real controls | No exhaustive rebinding/input replay yet |
| Hotbar editor | Actual editor.open and readable390 native capture | Initial selector matched a hidden flask editor; its null rectangle is not an absent-window claim |
| Chat | Actual collapsed bounds/quest-toggle collision | Expanded composer/whisper typing not replayed yet |
| Quest tracker | Actual active quest; desktop visible, ordinary touch hidden | No all-quest progression replay |
| Newcomer guidance | Actual closed/expanded native captures and scrolling bounds | Large expansion is current baseline behavior |
| Quest journal | Actual show/close and panel bounds across layouts | Each row/action not exhaustively clicked |
| Full map/atlas | Actual toggle and visible panel bounds | Routing/navigation final implementation pending |
| Main menu | Actual open, both skins/group layout and scroll metadata | Focused movement final retest pending |
| Character sheet/equipment | Source reviewed; inventory workspace actual opening | Not each equipment tooltip/mutation |
| Skills | Actual open across layouts; fresh1366 native capture fits | No reset/purchase/evolution mutation |
| Inventory/bag | Actual workspace open/close across layouts | No item consumption/drop/trade |
| Loadouts | Actual panel open/close/layout | No loadout apply/save |
| Card compendium | Actual panel open/close/layout | Full card catalog mechanics covered by prior release, not replayed here |
| Player guide | Source entry reviewed; shared compendium panel | Final guide/navigation integration pending |
| Bestiary | Actual show/close/layout | No all-monster detail/path replay |
| Social window | Actual titles tab open/layout | Server-backed social states not injected yet |
| Titles | Actual ordinary titles tab layout | No GM grant/rank fixture in this initial audit |
| Ranking | Source tab/handler reviewed | Offline Guest cannot certify server response |
| Party/recruitment | Source tabs/handler reviewed | No real second player/authenticated party |
| Trade | Source modal/keyboard guard reviewed | No real counterpart or trade commit |
| Settings | Actual open/close; fresh1366 native image, touch bounds | Not every setting change |
| Auto | Actual open/bounds; confirmed fresh640 clipping | Maximum scroll leaves Reset below the360px screen; confirmed unreachable |
| NPC dialogue/services | Source service entry/quest handler reviewed | No shop/forge/storage purchases or transactions |
| Recall | Source menu/5s cast/cancel presentation reviewed | Offline initial fixture cannot certify server recall |
| Notifications | Source feed/announcement layers reviewed, region notice visible | No exhaustive notification combinations |

## Initial method and receipts

Isolated local Guest storage, API/WS blocked, Vite5341; no production accounts/saves. Baseline120 attempted states: normal/expanded/menu/bag/editor/journal/cards/social/settings/Auto × six viewports × both skins. Corrected nonquest surface sweep132 states opens inventory workspace, skills, loadouts, editor, journal, cards, social, settings, Auto, map and bestiary. These are opening/layout samples, not120/132 complete interaction certifications. Six fresh entry-flow samples cover desktop1366 and touch390 login/select/creation without confirmation. Zero page errors in these runs.

Viewport sizes: desktop1920×1080/1366×768; actual-touch390×844/320×640 and844×390/640×360, withDPR2 in game touch fixtures. Representative native before images and JSON remain ignored under `artifacts/quest-hud-navigation/`; final representative images will go in the review directory after source freeze. Initial wrong editor selector/workspace cleanup and unsettled resize rectangles are disclosed rather than turned into product findings.

## Pre-freeze validation checkpoint

At this initial checkpoint no full `npm test` or `npm run build` had been run; final results are recorded below. Final report will record exact results, navigation behavior, overlap/input/focus/scroll retests and visual review. Physical devices, production authentication, all bosses and every economy transaction remain outside this bounded UX audit.



## Candidate checkpoint (before touch follow-up)

Fresh Vite5341 was restarted after source freeze. Sixty settled samples cover normal objective HUD, journal, atlas, Auto and editor across all six viewport sizes and both skins; zero page errors. Seven browser assertions passed: AUTO refusal; collision-planned route starts; Escape/manual key/modal cancellation; journal/card exclusivity; menu movement guard remains open. These checks do not certify portal arrival, every quest or server-authoritative progress.

Auto is resolved in this checkpoint: maximum scroll exposes Reset in every sampled size/skin, including640×360 (bottom331.59px). Original guide/chat toggle is removed. A new touch overlap requires follow-up:320 objective HUD x150/y172,w158,h168.31,bottom340.31 intersects potion/Auto controls and skill buttons; native `320-normal.png` shows actions covered. Art also observed844 Talk/action overlap. These screenshots are intermediate evidence, not final approval.

First full suite:1266 tests,1258 pass,6 fail,2 skip,42573.6582ms. All six journal tests fail because the existing fake DOM has no `tabs.setAttribute`; implementation owner is updating the harness while preserving regression coverage. Build passed,349 modules,525ms. No failing tests are hidden or excluded. Final test result will supersede this checkpoint after correction.

## Final frozen candidate validation

Final retake: `npm test` passed1269 tests total,1267 pass,0 fail,2 skip,44479.4353ms. `npm run build` passed349 modules in525ms. Logs: ignored `artifacts/quest-hud-navigation/npm-test-retake.log` and `build-retake.log`. The previous six failures are retained above; the owner repaired the fake DOM and added three meaningful journal regressions. Existing gridpath/maps/world coverage runs within the complete suite.

After the touch follow-up, the sixty-sample matrix was rerun against a freshly restarted Vite5341. Zero page errors; both skins, desktop1920/1366, actual-touch390/320 and844/640 landscape. The final touch HUD is a138×50 chip, with a136×48px hit target, immediately below the mini. The old obstructing action rows are gone: details and walking actions are in the journal. Sampled bottoms186.59 at320 and198.59 at390/844/640 leave the potion/skill area clear. Auto now fits each screen; its opaque sticky header and maximum scroll expose Reset in all twelve size/skin combinations. The newcomer guide now lives in the journal rather than a large ordinary-play expansion.

Seven main browser assertions pass: AUTO refuses quest walking; a real collision-planned path starts; Escape cancels; manual key input cancels; opening the modal journal cancels; journal and card book are mutually exclusive; main-menu movement guard remains unblocked. Additional sixteen samples cover modern/classic typing chat, HUD size1.8, normal HUD and newcomer journey in1366 desktop/320 touch. Center hit-tests find all visible quest buttons reachable; touch chip hides during chat typing and modal journal. Actual path displacement is4.20 world units over twenty50ms simulation frames (4,150 →3.9266,145.8006), with no progress/teleport mutation. Focused menu and editor keyboard movement pass; typing `wasd` into the journal search leaves the player stationary.

Navigation unit tests additionally cover phase eligibility, live/indoors NPC schedules, changed objectives, map/death/logout/modal cancellation, locked supplies, unknown/practice objectives without invented coordinates, and arrival that does not complete a quest or automatically continue through a portal. These are unit-level assertions; browser QA did not walk every map or complete every quest. There is no independent minimap-collapse control in the current product: the tested states are compact touch mini and expanded atlas.

## Final screenshot evidence

Native Edge screenshots in `docs/art/reviews/quest-hud-navigation/`: `1366-normal.png`, `1366-map.png`, `390-normal.png`, `320-normal.png`, `844-normal.png`, `390-journal.png`, `390-editor.png`, `640-auto.png`, `desktop-modern-journey.png`, `desktop-classic-large.png`, `touch-classic-normal.png`, `touch-modern-typing.png`, `touch-modern-journey.png`, `touch-classic-large.png`. Final touch files replace the obstructing intermediate candidates. Draw was explicitly enabled after viewport and font/layout settlement. Original before-images remain ignored under the artifact directory.

## Scope and remaining limits

QA changes only this report and native review screenshots; fixture scripts/results are ignored artifacts. Application changes remain owned by the gameplay engineer. The coverage table is the detailed entry-point audit, with final navigation/chat/HUD-size/focus evidence extending its initial rows. It is not blanket certification of all UI. No account was created, no production authentication or save was used, and API/WebSocket traffic was blocked in browser fixtures. Party/trade/ranking/recall authority, shop/forge/storage purchases and all boss/quest transactions remain untested in this task. Physical phones/GPU performance and every simultaneous world-label/announcement overlap are not certified. SwiftShader frame timing is not a performance result.


Final actual-touch320 action probe also passes: click the idle chip opens the journal; click its selected quest Walk action closes the journal and starts navigation; click the active chip stops the route and clears destination. One fresh sample, zero page errors. Receipt: ignored `mobile-actions-result.json`. Total final browser evidence is77 layout samples and14 behavior assertions, all passing within the stated scope.

## Enlarged desktop HUD follow-up (approval held)

Art subsequently identified a concrete overlap in `desktop-classic-large.png`: at1366×768 with HUD preference1.8, the objective card extends into the hotbar. A fresh DOM probe confirmed AUTO intersection38.81×80.11px and gear43×80.11px; attack and slots8–10 did not intersect in that precise fixture. Previous center hit-tests proved quest buttons reachable only; they did not prove underlying gameplay controls unobstructed. This was a minor/P2 layout defect owned by the gameplay/UI engineer. Approval was held pending the geometry fallback and bounded targeted/build/browser retests. The passing complete suite remains reported above; no blanket overlap-free claim is made.

## Final enlarged-HUD correction

The narrow placement tail at `c1b415b` resolves the enlarged desktop blocker. Fresh1366×768 modern/classic with HUD1.8 uses a240×34px chip at y454.75–488.75. Hotbar top is505 modern /499 classic, leaving16.25 /10.25px gaps and zero rectangle intersection. The chip's238×32px center hit target is reachable. Returning preference1.8→1.0 in the same desktop context restores the240×169.47px full objective card. Ordinary desktop and320 touch placement remain unchanged; eight fresh ordinary/large samples have zero page errors, and the four actual displacement/focus/typing assertions still pass.

Validation for this tail:22/22 targeted quest navigation/journal/geometry tests,0 fail/skip,149.8236ms; build349 modules passed518ms. The complete1269-test/1267-pass suite was run at the earlier final chip checkpoint `54681a5`; it was not repeated for this narrow layout tail. Extreme insufficient-gap hiding with journal fallback is covered by the pure geometry test, not an actual browser dimension probe. Exact receipt: `placement-final-result.json`; final enlarged native captures supersede the obstructing versions. Additional `desktop-modern-large.png` and `touch-modern-large.png` show both skins' bounded fallback.

This supersedes the earlier approval hold for enlarged desktop. Final QA report and native images are frozen. Art approved final source `c1b415b` after reviewing the refreshed captures (see `docs/art/reviews/quest-hud-navigation/ART_REVIEW.md`); the technical source gate is also approved. No further implementation changes are claimed.
