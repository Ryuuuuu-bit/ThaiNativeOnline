# Painted item runtime review

The approved 15-item set is integrated into the game. Technical review approved
the exact-ID mapping, isolated art overrides, export receipts and selective smooth
contain rendering. No gameplay or save fields changed across 522 item definitions.

Art review: APPROVED. Style 9/10, readability 8/10, Thai identity 9/10,
technical usability 9/10. Desktop and mobile paperdoll, inventory and Q/E HUD
show no visible clipping, alpha halos or pixelated sampling. Gold pendant remains
identifiable; necklace cord and Buddha relief lose detail at small slot sizes.

QA: npm test 996 total, 994 passed, zero failed, two existing skips. Build passed
with 323 modules. All 15 alpha WebP files and source/export/dist hashes checked;
PNG masters unchanged. Production texture total is 274,168 bytes.

Actual Edge WebGL screenshots and evidence are stored as local ignored artifacts
in `artifacts/item-icons-live-qa/`: `painted-equipment-desktop.png`,
`painted-equipment-mobile.png`, `painted-inventory-desktop.png`,
`painted-inventory-mobile.png`, `painted-hud-desktop.png`,
`painted-hud-mobile.png`, `painted-shop-desktop.png`,
`painted-shop-mobile.png`, `painted-picked-bia-kae.png` and `REPORT.md`.

Screenshots use a local seeded Lv100 guest, not an authenticated account. Shop
captures show existing tier1 artwork; direct selected tier6 shop imagery was not
part of final art approval. Shared renderer and runtime paths were inspected.
SwiftShader captures establish visual correctness, not GPU performance.
Only these 15 items use the new art; remaining equipment keeps its existing icons.
