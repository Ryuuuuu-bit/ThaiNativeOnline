# Complete painted inventory library QA

## Findings

No confirmed runtime regression or blocker was found in the reviewed change. The runtime diff changes the item artwork mapping and preserves the original 15 approved icon paths; item stats, drop data, prices, flask charges, affixes, sockets and refinement data match the captured gameplay baseline.

An initial mobile assertion ran before the renderer processed a resize from 1600 to 390 pixels. The old 1600-pixel canvas temporarily affected document width. Waiting for the actual canvas resize resolved the harness timing issue: the final equipment and bag checks both measured document width 390 pixels and no workspace horizontal overflow. No game code was changed for this diagnostic.

## Validation

- `npm test`: **PASS**, 1,007 tests; 1,005 passed, 0 failed, 2 skipped, 0 cancelled, 0 todo. Duration 63,827.8399 ms. Includes grid path, maps/world, inventory, cards, flasks and refinement coverage.
- `npm run build`: **PASS**, Vite 8.3.2, 326 modules transformed, built in 1.44 seconds. Main JavaScript chunk 2,374.36 kB / gzip 714.19 kB. The existing warning about chunks above 500 kB remains; this is not a measured device performance result.
- Independent decoded library validation with `--runtime` and the pre-change gameplay baseline: **PASS**. All 516 active IDs map to 348 semantic masters, comprising 333 distinct new originals and 15 approved reused masters. Zero missing masters; production icon bytes total 7,112,102.
- Every new original PNG and production WebP matches its receipt SHA-256. Real alpha is independently decoded, not inferred from a red-channel statistic. All production exports are transparent 256 × 256 WebPs below the individual 100,000-byte limit. Original alpha allows the documented nearly opaque 254 maximum in one preserved source.
- The previous 15 approved sources and exports retain their exact recorded hashes. Six retired definitions keep their old icons. All 522 gameplay definitions match the baseline after omitting only `img` and `imageArt`.
- No new source PNG masters are present in `dist/ui/items/painted-complete-v1/`, and `dist/docs/art/items/painted-complete-v1/masters` does not exist.
- Final gallery: all 348 masters loaded at desktop 1440 × 1000 and mobile 390 × 844. Categories: 184 equipment, 88 flasks, 3 consumables, 6 materials, 67 cards. No page errors, failed requests or horizontal overflow.
- Actual local game at `http://127.0.0.1:5314/`: login → guest character select → creation → city passed. A separate curated saved guest character exercised ten equipment slots with one weapon, health flask chooser, bag, new wood-sword tooltip, the existing city general merchant and the item/Q/E hotbar.
- The curated bag explicitly contained all item types: 10 equipment, 16 flasks, 3 consumables, 6 materials and 2 cards, rather than exceeding the 500-slot capacity with all 516 IDs. Desktop 1600 × 1000 and mobile 390 × 844 views loaded their actual painted artwork with `object-fit: contain` and smooth rendering. No page errors or failed HTTP requests occurred.

Source routing inspection confirms equipment, inventory, tooltip, flask chooser, hotbar, shop, storage and bestiary use central `ITEMS` definitions through `iconHtml`. Visual approval is recorded separately in [ART_REVIEW.md](ART_REVIEW.md).

## Screenshots and evidence

Actual browser captures: [equipment desktop](qa/equipment-desktop.png), [bag desktop](qa/bag-desktop.png), [wood-sword tooltip](qa/wood-sword-tooltip.png), [flask chooser](qa/flasks-desktop.png), [city shop](qa/shop-desktop.png), [equipment mobile](qa/sheet-mobile.png), [bag mobile](qa/bag-mobile.png), [gallery desktop](qa/gallery-1440.png), [gallery mobile](qa/gallery-390.png). Login, character selection and creation captures are also retained with the QA artifacts.

Raw logs, decoded validation JSON and browser results: `artifacts/item-assets-completion/qa/npm-test.log`, `npm-build.log`, `library-validation.json`, `browser-result.json`, `initial-flow-result.json` and `gallery-qa.json`. The initial failed resize assertion is preserved in the diagnostic evidence rather than hidden.

## Limits

Headless Edge uses SwiftShader. Physical-device FPS, real touch interaction, production concurrency and real authenticated account saves were not measured. Combat and collision regression suites passed; this icon-only change was not subjected to a new manual fight or portal tour. Browser guest data is local, with no authenticated player account mutation.
