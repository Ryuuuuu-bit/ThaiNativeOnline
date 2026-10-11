# ImageGen title and profile frames

Generated for Thai Native Online by the built-in ImageGen tool, with separate images for the common, rare, epic, legendary and sovereign presentation tiers, plus killer and guardian banner/profile pairs for earned PK/sin and merit/red-hunt titles. These fourteen display assets total 382,250 bytes (373.3 KiB); tier eligibility remains in `src/ui/titleAppearance.js` and does not change achievement rules.

The banners have a quiet dark-jade text field, gold Thai ornaments, and an emblem at the left. The profile images are decorative rings with an actually transparent aperture. Use the existing character portrait behind the ring; no generated portrait replaces the player's character.

## Packaging

- Runtime banners: `{tier}.webp`, `killer.webp` and `guardian.webp`, 768 pixels wide.
- Runtime profile rings: `profile-{tier}.webp`, `profile-killer.webp` and `profile-guardian.webp`, 256 × 256 pixels, contained rather than stretched.
- Matching `.json` receipts record source dimensions, alpha measurements, mechanical crop, byte size and SHA-256 digests.
- Full-resolution originals are archived under ignored `artifacts/hud-theme-qa/title-source-originals/`, outside the runtime package.
- Mechanical normalization uses Sharp: crop to the alpha ≥ 4 bounding box with an 8 source-pixel guard, then resize and encode WebP with quality 85 and alpha quality 100. This removes distant alpha 1–3 speckles outside the art; interior alpha is preserved. No image redraw or background removal is performed.

Keep banner end ornaments at fixed proportions when the title text grows. A horizontal three-slice or nine-slice layout is preferred to stretching the entire banner. Preserve the full vertical extent of tall emblems, and keep readable Thai text as live DOM content above the jade field.

The five banners total 152,622 bytes and the five profile rings total 106,388 bytes: **259,010 bytes / 252.9 KiB** for all ten runtime assets. All output hashes were verified against their receipts. Every profile's source and decoded output center alpha is zero.

Profile aperture measurements use the connected transparent component at the decoded WebP center (alpha < 4). The sovereign aperture centroid is `(127.11, 141.01)` in its 256 × 256 canvas, 5.08% below the vertical center. Translate that frame upward by approximately 5.1% of its own rendered height to align the opening with the existing portrait. Do not warp the circular art. With a frame at 120% of an 80px portrait, the correction is about 4.9px. Inspect the final eyes and face at actual HUD size.

No animated shader, bloom, particles or per-frame image processing is required. Decode and reuse the selected tier's static assets through browser caching.

## Source integration

The generation prompts are recorded in the adjacent `PROMPTS.md` and the tier visual direction in `docs/design/TITLE_APPEARANCE.md` by the integration owner. These documentation receipts identify the exact generated PNGs that produced the runtime files; only WebPs are shipped in `public/ui/titles/imagegen-v1/`.
