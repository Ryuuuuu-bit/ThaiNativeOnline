# Mobile HUD layout

The approved jade/brass concept now maps to the existing gameplay controls.
Touch screens use physical CSS pixels so nested desktop HUD scaling cannot push
panels into one another. HP/SP and chat occupy separate upper-left bands; the
compact minimap and menu occupy the upper right. The location is a small caption.
Chat is collapsed until tapped. Party details remain available through Social.

Touch skills show learned abilities only, five per page, with previous/next
buttons and horizontal swipes. Original controller indices, keyboard bindings,
AUTO order, cooldowns, MP and cast behavior are retained. A swipe suppresses the
resulting click. Empty kits explain where to learn skills. The two potion slots
and AUTO sit above the skill tray; the joystick and attack/target/talk buttons
have a separate lower band. EXP is a thin strip above the bottom safe area.

Return-to-city, PK, follow/warp and zoom controls move into the main menu without
replacing their listeners or server rules. Opening menus/chat hides the combat
controls and resets the joystick. The main menu button remains available to
close its own panel. Desktop layout is unaffected.

## Files

- src/ui/mobile-hud.css: touch layout and safe-area rules.
- src/ui/ActionBar.js and SkillPager.js: learned-skill paging, swipe handling.
- src/ui/TouchControls.js: move EXP outside the tray; menu/chat control gating.
- src/ui/DynamicHUD.js: move touch utilities into the menu, skip desktop anchoring.
- src/main.js: load mobile overrides last.
- tests/skill-pager.test.js: filtering and original-index preservation.

## Validation

304 tests pass; production build and diff checks pass. Browser QA used an
isolated local HTTP/WS server, a real account and touch emulation at 390x844,
844x390 and 320x640. It checked no overlap between HP/chat, skills/touch buttons
or skills/potions; no horizontal overflow; opening and closing the menu; hiding
controls while the menu opens; and casting controller index 5 from page two.
The non-touch desktop at 1440x900 retained its normal layout. No page errors.

Local screenshots: artifacts/mobile-hud-portrait.png (actual starter character),
mobile-hud-skills.png, mobile-hud-landscape.png, mobile-hud-small.png,
mobile-hud-menu.png and mobile-hud-desktop.png. The multi-page screenshots use a
temporary client-side learned-level stub to exercise all ten slots; actual
character progress is unchanged. Results: artifacts/mobile-hud-results.json.

Local art review: consistent jade/brass hierarchy, less map occlusion and clear
thumb-control separation. Independent art review, physical iPhone/Android tests
and on-device keyboard/notch behavior remain pending. The existing large bundle
warning remains. This task does not deploy the change.
