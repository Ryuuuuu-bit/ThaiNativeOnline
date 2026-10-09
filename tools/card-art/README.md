# Model-based card illustrations

The user requested individual card artwork matching the monsters already
designed in the game, then limited new art to **production GLB models only**.
`spec.json` therefore contains 31 prompts. Procedural fallback creatures retain
their current item icons or journal emblems; they must not enter this registry.
All 65 gameplay card definitions remain in the journal.

Use the built-in imagegen tool for generation. Each image takes its own actual
model capture as identity reference and the approved boar painting as style
reference. Keep the model's body form, costume colors and existing props; a name
is not permission to invent a new creature. Review joints, limbs and weapon
grip against the reference. Do not replace original 3D models in this workflow.

## Local workflow

With Vite running at port 5186 and an installed Edge, capture references:

```powershell
node tools/card-model-reference-capture.mjs
```

The capture uses one isolated headless browser and one page, disposes each
model, verifies GLB bytes and closes in `finally`. Raw reference PNGs and jobs
live under ignored `artifacts/`; regeneration must use current references.

Save selected built-in output paths and exact prompts as a job array:

```json
[{ "id": "boar", "source": "absolute/path/to/generated.png", "prompt": "exact submitted prompt" }]
```

Package selected artwork without cropping its composition, then publish only
after all 31 model-based images pass review:

```powershell
node tools/card-art/normalize.mjs artifacts/card-art/selected-jobs.json
node tools/card-art/publish.mjs
node tools/card-art/review-sheets.mjs
```

`normalize.mjs` rejects fallback references and creates 384×480 WebP portraits,
96×120 thumbnails and individual generation/provenance receipts. `publish.mjs`
checks scope, current model hashes, asset hashes, distinct images and byte
budgets before writing `card-illustrations.js` and `reference-manifest.json`.
Review sheets place **MODEL / CARD / ICON** beside one another.

`TNO_PLAYWRIGHT_DIR` and `TNO_SHARP_DIR` may point to installed local packages.
The tools default to the current Codex bundled runtime and do not install a
browser or packages. `TNO_QA_URL` overrides the local Vite URL.

## Checks

```powershell
node --test --test-concurrency=2 tests/card-illustrations.test.js tests/card-compendium.test.js
node tools/card-compendium-qa.mjs
node --test --test-concurrency=2 "tests/**/*.test.js"
npm run build
```

The journal lazily uses thumbnails for list rows and loads one portrait for
the selected detail. Inventory icons preserve the 4:5 illustration instead of
cropping the old pixel-art border. Existing PNG assets remain untouched.
Changes to production monster models require a new reference and targeted art
review; matching hashes cannot replace a visual/anatomical review.
