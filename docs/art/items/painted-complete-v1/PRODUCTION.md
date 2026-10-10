# Complete painted inventory art

## Scope and ownership

Replace the active inventory icon library with the approved soft hand-painted Thai fantasy family. The audited baseline contains 516 active item IDs and six retired items. `backlog.json` lists every active ID exactly once in 348 semantic groups: 15 approved V2 masters and 333 new, individually generated images. Generation is ongoing; the preview manifest reports completed exports and must not be treated as release approval.

Hunt and extended equipment may share the same physical base only within the exact region, level tier and equipment slot across three stat profiles. Named legacy equipment, expedition weapon kinds, each monster card and each boss/kind/tier flask combination have separate masters. This does not change item stats or inventory instance identity.

## Art brief

Use selective Thai kanok and prajam-yam ornament, aged brass, jade, leather, cloth and the material appropriate to each item. Starter equipment remains simple. Later tiers can be more elaborate without losing silhouettes at 32, 48 and 64 pixels. Buddhist amulets are part of the necklace family. Tiger spirit imagery is humanoid and half tiger. Item graphics have true transparent backgrounds, safe margins and no baked interface labels, rarity frames, socket counters or charge indicators. A monster card's physical border is part of the object itself.

## Generation and preservation

Each new semantic group has one built-in ImageGen request with `transparent_background: true`. The approved images are style references rather than substitutes for the new subjects. Do not create new tiers by recoloring or duplicating another object's art. Do not generate sprite sheets and slice them into purported independent assets.

The original generated PNG is copied unchanged to `masters/<representativeID>.png`. Per-image `provenance/<representativeID>.json` records the exact prompt, original path, source and copied-master SHA-256 hashes, export dimensions, transparency checks and WebP hash. `tools/export-painted-item-job.mjs` exports a contained 256 x 256 WebP with Sharp quality 90 and alpha quality 100. Sharp is an offline build tool, not a game dependency. Production clients load WebP files; the PNG masters stay outside `public`.

## Resume and assembly

Resume missing representative IDs from the audited backlog and existing provenance receipts. Do not repeat successful generations. Each assigned artist persists its own progress and prompts in the ignored `artifacts/item-assets-completion` directory.

Run `node tools/assemble-painted-items.mjs` to refresh the incremental gallery. `--finalize` is reserved for the completed, reviewed library and refuses incomplete coverage. The resulting generated ID mapping must replace only visual fields (`img` and `imageArt`). Retired definitions, levels, prices, bonuses, socket limits, drops, flask charges and refinement remain unchanged.

## Release gates

- All 333 requested new semantic masters have original PNGs and verified production exports.
- All 516 active item IDs resolve to approved graphics; retired items keep their existing graphics.
- Art review checks subjects, materials, tier progression, distinct monster species and readability at real icon sizes on light and dark backgrounds.
- Technical validation checks source hashes, output hashes, true alpha, dimensions, completeness and unchanged gameplay definitions.
- QA checks the equipment panel, bag, shops, tooltip and hotbar presentation; `npm test` and `npm run build` pass.
- Release through the task branch and reviewed PR, then verify live asset paths and deployment health.

Screenshots, review results, completion counts and any limitations will be recorded when these gates are complete.
