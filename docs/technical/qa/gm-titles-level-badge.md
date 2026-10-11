# GM titles and profile level badge QA

No blocker found in the bounded checks. The GM entitlement is transient and authenticated by the server; it does not add earned achievements, stats or rank ownership. Level100 is readable below the portrait ornament in the reviewed layouts.

## Changes reviewed

Reviewed `server/index.js`, `server/combatants.js`, `src/data/titleAccess.js`, `src/data/titles.js`, `src/character/Character.js`, `src/net/Multiplayer.js`, `src/net/NetProgress.js`, `src/net/SocialPanes.js`, `src/ui/hud-theme.css` and new regression tests. Server title changes recheck live authorization and session/role epoch after asynchronous reads. The WeakSet capability is never restored from constructor options or save JSON. Unearned GM-selected titles are omitted from persisted selection, while live packets carry the active selection. Badge CSS places a jade/brass pill below the portrait, above ornament stacking, with reserved profile space.

QA changed only this report, six screenshots and ignored scripts/results under `artifacts/gm-titles-qa/`; no implementation fixes, commits or production writes.

## Validation

- Full `npm test`:1066 total,1064 passed,0 failed,2 skipped,0 cancelled,46458.7146ms. Log `artifacts/gm-titles-qa/npm-test.log`.
- Final `npm run build`: passed,336 modules,552ms. Log `artifacts/gm-titles-qa/build.log`. Existing large-chunk advisory remains; no build failure.
- The full suite ran six `gm-title-access.test.js` unit cases and isolated `gm-titles.integration.test.js` HTTP/real-WebSocket coverage. They verify all41 catalog selections, unchanged genuine records/titles, unknown/forged flags and save JSON rejection, nonpersisted capability, rank-loss retention only while entitled, earned-title preservation on revoke, stale sync rejection, role withdrawal, logout, reconnect and delayed authorization race cancellation. Existing GM authority/chat and ranking tests also passed.
- Actual browser UI used isolated local Guest storage and the real `game.net.net.emit` routes, with API/WS intentionally blocked. `gmAccess` grants41 enabled cards/41 total,41/41 counter, rank category and GM note in desktop and touch. Clicking rank category, `cp_top1` card and wear action equips the title. Changing the rank record and calling `checkTitles()` keeps the GM selection while its ID is absent from genuine earned titles and capability is absent from JSON.
- A separate real-client-handler fixture exercises private `welcome` grant/title hydration, `status:false` disconnect revoke, `gmAccess` regrant and explicit revoke. Dynamic selections clear on disconnect/revoke. The ordinary All category returns8 genuine enabled cards,28 locked cards,36 non-rank cards,8/36 counter and no GM note; genuine earned titles are unchanged. Grant/lifecycle title events contain zero newly-earned IDs, so no41-title notification flood is produced. These injected messages test client behavior, not authenticated browser authority.
- Level100 badge tested across seven frames (common,rare,epic,legendary,sovereign,killer,guardian), modern/classic skins, desktop1920×1080 and real-touch390×844/320×640 contexts,DPR2 on touch:42 glyph-Range cases. Every text Range fits its badge, and each badge fits inside the profile HUD. Native world screenshots visibly show100 clear of the painted portrait frame. Desktop1.8HUD preference is covered by a representative enlarged classic screenshot. Badge size is40×22 CSS px desktop and34×20 touch; z-index5 is above ornament3.
- Zero uncaught page errors in both final browser fixtures. Loading settled into a rendered avatar/city/HUD.

## Screenshots

Six native browser captures in `docs/art/reviews/gm-titles-level-badge/`: `gm-all-titles.png`, `ordinary-locked-titles.png`, `desktop-badge.png`, `desktop-enlarged-badge.png`, `touch390-badge.png`, `touch320-badge.png`. Art review approved the badge and GM presentation separately. No image pixels were edited.

## Harness corrections and limits

The first browser wait referenced `game` before the global existed; corrected to `window.game` and reran. The initial revoke check remained in the previously selected rank category, now empty; the bounded follow-up clicked All and measured ordinary locked cards correctly. These were fixture errors, not hidden product failures.

No existing account or production save was touched. Server authorization used isolated local MemoryStore fixtures; visual tests used synthetic private messages and local Guest data. Production authentication, a signed browser click-to-server round trip, physical-phone GPUs, performance and broad map traversal are not certified. Disconnect/reconnect intentionally clears a transient unearned selection rather than persisting GM privileges. Existing touch320 chat/title and screen-space HUD overlaps remain outside this profile-badge change; an overlap-free whole HUD is not claimed. Collision/pathing coverage is from the passing full suite, not a new manual map sweep. No deployment was performed.
