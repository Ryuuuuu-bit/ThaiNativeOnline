# HUD jade/brass and server-confirmed PK QA

## Findings

The final user-requested smaller PK control uses24px CSS height on desktop (28.8px at automatic1.2 scale,43.2px at1.8) and measures32px on touch. Touch profile/chat gaps are1px at390/844 and5px at320; no intersection. No unresolved product blocker found in the bounded checks. Two visual issues found during review were corrected by the UI owner: the long profile name touched the class/job label, and collapsed touch-landscape chat stretched across the playfield. Final desktop name/class gaps measure 12px at normal scale and 18px at enlarged scale. Final collapsed touch chat measures 260px at 844x390, 218px at390x844, and148px at320x640; expanded composer remains420px wide at844x390.

## Scope and changes

QA owns this report, screenshots in `docs/art/reviews/hud-theme-pk/`, and ignored scripts/results in `artifacts/hud-theme-qa/`. Reviewed `server/pvp.js`, `server/index.js`, `src/net/PvpPanel.js`, `src/net/PkMode.js`, `src/ui/DynamicHUD.js`, `src/ui/hud-theme.css`, final CSS import and regression tests. Existing KARMA.freeLevel20 and target vulnerability are retained. The new switch controls attacker intent; OFF does not protect an eligible victim.

## Validation

- Final full `npm test`:1054 tests,1052 passed,0 failed,2 skipped,0 cancelled;43338.7691ms. Log `artifacts/hud-theme-qa/npm-test.log`.
- Final `npm run build`: passed,334 modules,501ms. Log `artifacts/hud-theme-qa/build-class-final.log`. The final name-hover change subscription and CSS-only gap/chat refinements followed the full suite; final build/browser checks cover these changes.
- The suite actually ran `pk-mode-online.integration.test.js` against isolated MemoryStore signed accounts and a real local WebSocket server. It verifies rejected low-level/safe-map/Guest enabling, OFF attacker hit rejection, server acknowledgement, OFF victim still taking a hit, enabling self-defense during combat, disabling combat lock, map reset, reconnect reset and OFF-mode duels. Pure PK tests cover party/protection and request validation. No existing accounts or production saves were used.
- Separate browser client-event fixture exercises the actual PvpPanel: offline OFF disabled; request pending OFF disabled; refusal stays OFF; confirmed ON sets aria-pressed true; disconnect returns OFF disabled. Below20 is hidden after the normal render interval. These event injections are UI checks, not an authenticated live browser session.
- Baseline UAT self name/title12/10px; final real self and RemotePlayers module name/title16/13px in both skins. NPC plate stays12px. Remote model/plate fixture is synthetic, using the actual module and local GLB, not a second network player.
- Both modern/classic:1920x1080 normal/enlarged HUD,390x844 and844x390 real touch context (`hasTouch`, mobile), plus320x640. Zero uncaught page errors in final desktop/touch/client fixtures. Offline API/WS traffic was intentionally blocked.
- Focused MainMenu keyboard S movement passes with input processed through game frames:46,57 to47.4196,59.0821. Hotbar editor focused-slot S movement passes:46,57 to47.5379,59.2556. Assign skill plus potion into two slots keeps editor open, with persisted character bindings updated.

## Screenshots and fixture corrections

Before desktop, both skin desktop/scaled/touch shots, editor-multiassign, PK offline/pending/on, and expanded touch chat are retained in the review directory. Art review records the visual verdict separately. Actual world rendering is required; final captures replace early resize shots that showed blank terrain because the QA harness froze rendering and passed draw=false. Initial RemotePlayers calls used the wrong argument and camera property, then stale camera projection; corrected to update(dt, game.view.camera, host) after resize. An early frozen-loop keyboard check produced no movement; manual input frames proved movement. Initial below-threshold snapshot preceded the periodic PK render; additional-result.json verifies hidden after update. These are harness errors, not silently discarded game failures.

## Limits

No physical phone, production authentication, signed browser PK click-to-server round trip, account creation flow, server load, or player crowding avoidance was certified. Shader software rendering gives no meaningful performance benchmark. World nameplate projection/crowding behavior remains unchanged; closely standing players may overlap. No broad map/pathing replay or existing user data mutation was performed. Collision/path/world regressions are covered by the passing full test suite.



## Final class-label adjustment

After the final CSS-only class-label increase, rebuilt once (334 modules,501ms), without repeating the unchanged gameplay suite. Refreshed eight actual-world canonical screenshots: both skins desktop normal/enlarged and real-touch390 portrait/844 landscape. Both self and RemotePlayers class/level lines compute12px; desktop profile class/job11px. Names16px, titles13px and NPC12px remain unchanged. Desktop name/class gaps12px normal and18px enlarged; zero page errors in both new fixtures. Results: class-desktop-result.json and class-touch-result.json under ignored QA artifacts. Narrow320, PK-state, editor and expanded-chat captures document the preceding interaction/layout checkpoint; they precede this class-font-only adjustment and are not claimed as the final font evidence.


## Superseded CSS-only title checkpoint (presentation only)

The core suite above remains the actual full-suite result before this presentation extension. New `title-appearance.test.js` ran separately:4 tests,4 passed,0 failed/skipped,65.3915ms, all catalog coverage/tier priority/fallback/literal rendering. Build after extension:335 modules,493ms, passed (`build-title-final.log`). Reviewed new `titleAppearance.js`, `titleTag.js` markup and scoped HUD CSS; no unlock thresholds, saved title IDs or rank ownership changes.

Actual world fixtures verify20 desktop cases (five tiers × two skins × day/night) and12 real-touch cases (rare/legendary/sovereign × two skins × day/night), each with both self and actual RemotePlayers module labels. All32 cases pass correcttier attributes and animation:none;0 page errors. At this superseded checkpoint, original semantic title colors and literal texts remained intact; CSS glyph ornaments were used. Those glyph ornaments are replaced by ImageGen frame art in the current implementation. Reduced-motion sovereign remains static on desktop/touch. The initial13px tier-font override and user-reported muddy outlined glyphs were corrected by the UI owner. Computed self/remote titlefonts at this CSS-only checkpoint: common14px, rare/epic15px, legendary/sovereign16px. IBM Thai font, no stroke, compact jade backplate and crisp shadow replace glyph glow; steady prestige halo is on the backplate.

Example `title-examples.png` captures actual titleHtml/CSS five tiers in day/night preview at1440x900 (10 tags). Desktop `title-{skin}-{tier}.png` and touch `title-touch-{skin}-{tier}.png` are real rendered-game evidence; synthetic earned titles use isolated Guest records and do not prove server rank ownership. This extension does not certify glow performance on physical GPUs; steady CSS shadow does not use PostFX or animations.

The superseded CSS-only readability preview was actual1× (not enlarged1.45×). All32 final desktop/touch cases preserve tier attributes, literal title text and static animation:none, with0 page errors. Touch remote fixture was moved slightly in front of the player for complete labels in390px screenshots; this is a test arrangement, not a change to game nameplate positioning or crowd avoidance.


Additional bounded bright-terrain receipt `title-daylight.png` uses actual clock12:00, phase day, envNight0, with30 drawn settling frames and epic self/remote labels. Zero page errors. Retained world evidence includes seven representative final tier/lighting frames plus example and reduced-motion shots; duplicate tier screenshots are ignored artifacts.


## Screenshot retention for the final PR

The earlier CSS-only and intermediate font/tier/world screenshots described above are historical checkpoints, moved to ignored `artifacts/hud-theme-qa/redundant-screens/`. They are not final ImageGen visual evidence and are not shipped in the review directory. The final directory retains the baseline and selected interaction-state evidence, then the new paired ImageGen gallery/world/long-text/fallback images once the graphical text-safe-area gate passes. This avoids shipping obsolete screenshots.

## ImageGen paired frames — current implementation

The CSS-only tag ornaments above are superseded. The current title and profile use14 local WebPs: five tier pairs plus killer/guardian pairs,382250 bytes total. Live text is fully transparent over the original painted field, with14/15/16px text; no extra rectangle or CSS crown glyph. ImageGen title/profile selection follows the equipped title's tier and explicit theme metadata, not class, PK toggle or new achievement rules.

- Focused final helper/theme tests:5 passed,0 failed/skipped,66.9476ms. The previously reported full core suite1054/1052/0/2 was not repeated for these presentation changes.
- Build after source/comment freeze passed:335 modules,534ms (`build-imagegen-final.log`). The owner then moved Sovereign text2 CSS pixels down and reported a passing495ms build. QA restarted its own Vite and rechecked only Sovereign against the final computed12px offset.
- All41 real catalog titles at320/390/1440 viewport,DPR2:123 horizontal glyph-Range samples fit the inner text area, all single-line at current sizes. This is not a claim that outer element bounds prove painted rail clearance. Exact changed-ink vs original-frame native screenshot analysis found23 bright accent pixels touching Sovereign's upper rail and1 antialias pixel beside the rare crest; the former was sent to the owner and reduced to5 physical pixels on a single antialias edge row after the2px adjustment. Rare remains a minor1-pixel edge contact, so zero painted-rail contact is not claimed for every title.
- Actual world four cases: modern day/ classic night desktopDPR1; modern320 and classic390 actual-touchDPR2. No page errors, all requested frame assets200. The initial equipped common title requests only common.webp/profile-common.webp, rather than all tiers. Both contexts verify rare/killer/guardian equip changes, unequip→common and dynamic rank loss→common immediately.
- Missing-frame fixture aborts all frame WebPs intentionally: game still enters with original portrait base/HP ring and literal readable title text; label has no extra background. This fixture's asset failures are intentional, not production failures.
- Final world captures use isolated Guest city4,150 away from the dummy. Real camera pan on touch isolates frame geometry with the normal HUD retained. Existing screen-space overlays may still cross self name/class or a title: touch320 potion/Auto and night location/phase notice were observed. No overlap-free nameplate claim is made and these unrelated layout behaviors were not changed.

The earlier final run was interrupted when local Vite5337 exited: dynamic RemotePlayers import failed, followed by connection refused. Restarted a fresh QA-owned server and reran only the bounded world/fallback cases; this was harness availability, not an asserted game bug. Existing accounts and production saves were not touched.

Final review retains12 PNGs: baseline, historical editor interaction, paired gallery, four current world examples, catalog-longest title sheet, missing-asset fallback, and three native high-tier crops. Earlier PK-state and CSS-only images are in ignored artifacts, with their behavioral assertions retained in JSON/report. The gallery is also served by the parent's persistent local preview5338. Glyph/rail detail receipts are ignored `ink-rail-result.json`/`ink-gold-overlap.json` and native before/transparent-text captures; no images were edited to create the proof.

## Final bounded Sovereign clearance receipt

The refreshed source computes `--text-offset:12px` and label `translateY(12px)`. At390px viewport,DPR2, the native Sovereign frame measures528×128 physical pixels. Actual changed-ink bounds are114,60–440,99; central upper gold rail is57–60 and lower rail109–110/112–113. Bright text intersecting original gold fell from23 pixels across4 rows to5 pixels on only row60 (x416–420), an antialias boundary contact of2.5×0.5 CSS pixels. The substantive accent intrusion is removed; a mathematically zero intersection is not asserted. Legendary preceding probe had0 intersecting pixels; rare had1 accepted antialias pixel. Art reviews the final native crops separately.

The first final probe against the parent preview5338 returned the identical old23-pixel result because its compiled CSS was stale. Restarting the QA-owned5337 server and reading computed12px offset produced the fresh5-pixel result. This is disclosed as source-freshness harness correction. Receipts: ignored `ink-gold-overlap-final.json`, `ink-rail-final.json`, `ink-probe-final.mjs` and native ink/frame pairs. No screenshot pixels were edited.

Final validation scope remains the actual full-core1054/1052/0/2 result above, the focused5/5 presentation tests, the335-module534ms QA build before the offset-only change, and the owner's reported495ms final build. No core suite or123-case catalogue sweep was repeated for the2px CSS offset. The final gallery/native Sovereign crop were refreshed by the UI owner;12 representative screenshots remain in the review directory. Known physical-phone, authenticated-browser PK, performance and positional-overlay limits remain as stated above.
