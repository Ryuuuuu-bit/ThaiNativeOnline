# Reference equipment panel review

The functional panel follows the user reference: cape/head/amulet across the top,
tall weapon/armor beside stacked ring slots, gloves/belt/shoes below, and Q/E
flasks at the bottom. Decorative jade/gold plate is independent of live controls.
Actual item artwork, character identity, sockets, refinement and charges vary
with the character; this is a faithful layout rather than a static pixel copy.

Art review APPROVED: style 9, readability 8, Thai identity 9, technical usability 8.
Final deep-jade interiors, chamfered gold frames, Thai serif labels, corner
ornaments and mobile header passed. Fine gold details are less distinct on mobile.
Technical review approved fingerprint-validated drag, existing network useAt,
separate lock controls, focus preservation, UID copying and flask navigation.

Changed implementation files:

- src/character/ui/CharacterUI.js
- src/character/ui/InventoryWorkspace.js
- src/character/ui/equipment-reference.css
- src/core/Game.js (flask chooser window navigation registration)
- tests/inventory-workspace.test.js
- tools/export-equipment-panel.mjs
- public/ui/equipment/reference-panel-v1.webp
- docs/art/ui/equipment-reference/ (reference, master, prompt, export receipt, review)

Validation: npm test 998 total, 996 passed, zero failed, two existing skips.
Latest build passed with 324 modules. Actual headless Edge desktop/mobile WebGL
checks passed: all ten slots, empty/populated states, locks, refinement, sockets,
UID clipboard, focus across redraws, flask chooser Escape, Q/E meters, valid,
wrong-slot and stale-instance drops, unchanged bag, stats and vertical scrolling.
No horizontal mobile overflow or page errors.

Local ignored screenshots/evidence: artifacts/equipment-reference-qa/REPORT.md,
reference-isolated-1024.png (1024x1536 actual DOM), reference-desktop.png,
reference-empty-desktop.png, reference-flask-chooser.png, reference-bag-desktop.png,
reference-mobile-top.png, reference-mobile-stats.png, reference-bag-mobile.png.

Existing charm destination rules remain authoritative: drag cannot arbitrarily
replace the second ring when the equip API selects another destination.
Small-screen long names and UIDs use ellipsis; UID copying retains the full value.
QA uses local guest fixtures, makes no authenticated account writes and does not
establish GPU performance. Production smoke is recorded separately after release.
