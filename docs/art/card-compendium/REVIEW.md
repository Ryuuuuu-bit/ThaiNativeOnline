# Card journal and model-based card art — 10 October 2026

## Scope and source

New card illustrations cover **31 designed production GLB monsters only**.
The 34 procedural fallback creatures keep their existing icon/emblem treatment,
following the user's final scope instruction. The journal still lists all 65
gameplay cards and distinguishes the two entries without active hunting sources.

The 31 identity references use the game's actual monster builders and model
bytes. Captures were made in one isolated headless Edge browser and one page,
with resources released per monster and the browser closed. Every GLB body and
motion source matched the local production bytes: 39 unique sources. The source
capture records three browser warnings (one generic 404 and two WebGL capability
notices); all required model requests succeeded and all 65 discovery captures
completed. Only the 31 designed models enter the art pipeline and registry.

Every illustration was generated separately with **built-in imagegen**, using
its own captured model for identity and the approved boar painting for style.
Exact prompts and generation/reference/output hashes are saved in
`tools/card-art/spec.json`, `reference-manifest.json` and `receipts/*.json`.
Normalization retains the complete composition; no card labels or borders are
baked into the image. Original 3D models and existing card PNGs were not changed.

The selected portraits total **2,203,680 bytes** and their thumbnails total
**174,366 bytes**. Portraits are 384×480; thumbnails are 96×120. Every individual
file fits the 90 KB / 9 KB budget. The list lazily loads small thumbnails and
only selected details use a portrait. Bag icons retain the complete 4:5 art.

## Independent Art/Tech review

All 31 MODEL / CARD / ICON pairs and four refreshed viewport screenshots passed
independent review without confirmed P1/P2 findings. Visible identity scored
9/10 and anatomy 8.5/10. Clothing colors, species/body form, horns, wings, tails,
and existing weapon/shield grips remain recognizable from the actual models.

| Surface | Style | Readability | Technical usability |
| --- | --- | --- | --- |
| 31 individual artworks and icons | 8.5 | 8.5 | 8.5 |
| Actual game, desktop | 8.5 | 9 | 8.5 |
| Actual game, portrait mobile | 8.5 | 8.5 | 8.5 |
| Landscape | 8.5 | 8 | 8.5 |
| Small mobile | 8.5 | 8 | 8.5 |

The technical review confirmed the 31-only registry, source/receipt hashes,
62 outputs and size budgets, thumbnail/detail mapping and uncropped icon CSS.
Fine fingers, ornaments and Takian's root details lose definition at icon size;
short screens scroll within the journal. These are illustrations, not exact
pixel copies of a rendered model or new 3D geometry.

## Browser QA and screenshots

Six scenarios pass with ten UI screenshots and no page errors. Four fixture
sizes are 1440×900, 390×844, 844×390 and 320×568. The actual game is also tested
at desktop and mobile size in a disposable offline guest context. QA never
connects that guest to the running multiplayer server or changes real saves.

Checks include catalog/active-source counts, boss/guardian filters, search,
collection reactivity, correct portrait/thumbnail dimensions, guide navigation,
focus return and containment, Escape/close, and camera shortcuts blocked under
the journal. Details and receipts are in `browser-qa.json`.

- `game-desktop-card.png`, `game-mobile-card.png`: integrated live-game menu.
- `desktop-card.png`, `mobile-card.png`, `landscape-card.png`, `small-mobile-card.png`: responsive component detail.
- Matching `*-guide.png` files: player guide layouts.
- `model-card-pairs-1.jpg` through `-4.jpg`: all 31 reference/art/icon comparisons.

Core/save/combat checks and limitations are documented in
`docs/technical/CARD_COLLECTION.md`. Physical-device performance, live PostgreSQL
migration and long-term drop/build economy balance remain unverified. The wider
HUD consolidation is still the staged proposal in `docs/art/HUD_SYSTEM_AUDIT.md`.
