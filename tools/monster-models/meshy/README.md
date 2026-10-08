# Rice-field creature study 01 — Meshy

Five textured Meshy creatures with species-specific Blender rigs and five game
clips: boar (Lv.1), fowl (Lv.1), crab, cobra and macaque (Lv.2). The animated files replace the existing
`public/models/monsters/{boar,fowl,crab,cobra,monkey}.glb` assets in the game's **3D monster mode**.
Static geometry candidates remain here for provenance and rig reconstruction.
The next level-ordered candidates are dhole and phibpa (Lv.3).
`queue.json` contains all 65 current monster identities through level 100; planned
entries have not been generated. Regenerate it with `node tools/monster-models/meshy/queue.mjs`.

## Review

Run the project's Vite development server and open
`/tools/monster-models/meshy/motion.html`. It uses the actual game model controller,
camera direction `(15,23,22)`, daylight intensity, tone mapping and existing
monster heights. Select a creature, front/side/back/top, turntable or old-model
comparison, plus idle/walk/attack/hurt/die. Narrow screens default to a single
creature with `?type=boar`. `review.html` preserves the static geometry study.
The page is a development tool, excluded from the production entry point.

Current screenshots, walking/attack recordings and anatomy/art/technical review:
`docs/art/monsters/meshy-motion-01/REVIEW.md`. The original generation review is
`docs/art/monsters/meshy-set-01/REVIEW.md`.

## Generate and recover without duplicate charges

Supply `MESHY_API_KEY` in the process environment; never put keys in source files.
`references/*.png` are the exact selected inputs. `prompts.json` records concept
prompts; the crab reference was corrected before its sole 3D generation.

```powershell
python tools/monster-models/meshy/generate.py boar --submit
python tools/monster-models/meshy/generate.py boar --collect
```

Submit one named creature once. The intent is saved before POST, then the task
ID is persisted before collection. Repeat `--collect` later if still pending;
it does not generate another task. If a POST has an unknown outcome, locate the
task using Meshy's API task history and recover `task.json` before proceeding.
The intent guard deliberately refuses a blind retry. No credits are purchased.

Original GLBs remain locally in ignored `artifacts/meshy-monsters/<id>/original.glb`.
Provenance records task IDs, parameters, costs and SHA-256, without signed URLs or
credentials. Source originals are **not included in the Git branch**; keep those
local files to rebuild exactly rather than paying to regenerate a different mesh.

## Prepare

```powershell
npm ci --prefix tools/monster-models
node tools/monster-models/meshy/prepare.mjs boar
node tools/monster-models/meshy/prepare.mjs fowl
node tools/monster-models/meshy/prepare.mjs crab
```

Preparation preserves geometry and UVs, centres the ground pivot, sets organic
materials to nonmetal with broad roughness, and softens normals. Base colour is
1024px JPEG quality 92 with 4:4:4 chroma; normals are 512px lossless PNG. Unused
alpha channels and metallic/roughness maps are removed. gltfpack 1.3.0 supplies
meshopt compression supported by `src/core/gltf.js`. Reports record exact final
hashes and dimensions. Budgets: under 15,000 triangles, one material draw,
under 1.8MB per prepared candidate. Run `npm test` and `npm run build` at the root.

## Rebuild the animal rigs and runtime clips

No new Meshy call or API key is needed. Start a managed Blender Harness with
`artifacts/meshy-rig-01` as its approved output root and this folder plus that
output directory as approved asset roots. Set `BLENDER_DESIGN_ROOT` to the
installed Blender Design plugin root and `BLENDER_SESSION_DESCRIPTOR` to the
managed session descriptor. `harness_client.py` uses the descriptor privately;
never commit it. Only registered Harness commands mutate Blender.

```powershell
node tools/monster-models/meshy/unpack.mjs
python tools/monster-models/meshy/rig.py boar v5
node tools/monster-models/prepare.mjs artifacts/meshy-rig-01/boar-rig-v5.glb artifacts/meshy-rig-01/boar-animated.glb
node tools/monster-models/meshy/publish.mjs boar
```

Repeat the final three commands for `fowl` and `crab`. Use a fresh managed scene
and output directory for an exact rebuild; existing Blender export destinations
are not silently overwritten. `unpack.mjs` reads the committed static candidates,
decodes Meshopt and bakes transforms. The rig script verifies imported vertex
order, assigns explicit normalized skin influences, authors IK targets/poles and
bakes five clips. No human rig or automatic weighting is used. The general
preparer splits the timeline at 24fps; the publisher removes authoring controls,
preserves texture quality and compresses the final GLB with the game decoder.

`rigs/*.json` records bones, foot targets, limb-length/idle-contact results and
snapshot identities; `*-animated.json` records exact runtime hashes and budgets.
Editable `.blend` sources and raw export receipts remain locally in ignored
`artifacts/meshy-rig-01`. The tracked recipes and static candidates support a
fresh rebuild without regenerating geometry.

Idle feet stay planted, and animation vertices remain above the checked ground
tolerance. Walk clips are authored in place, without world-speed matching or
terrain-slope foot IK. Death uses a grounded crouch/settle; claw gaps are preserved
without individual finger articulation. Physical-phone crowd profiling and
online combat acceptance remain separate checks. See the current review for
evidence and limits; deployment verification is recorded separately.

## Lv.2 cobra and macaque batch

Open `motion.html?set=2` or `review.html?set=2`. Narrow screens select the first
creature in the chosen batch; `?set=2&type=monkey` selects the macaque explicitly.
Evidence and limitations: `docs/art/monsters/meshy-motion-02/REVIEW.md`.
Exact concept prompts, selected references and provenance are retained; two
successful Meshy tasks used 70 credits total.

Use a fresh managed Harness/output root approved for this batch. The committed
macaque candidate already includes the neutral head correction, so it needs no
further correction during an ordinary rig rebuild. Set the Harness descriptor
and plugin-root variables as above, then:

```powershell
$env:MESHY_RIG_OUTPUT='artifacts/meshy-rig-02'
node tools/monster-models/meshy/unpack.mjs cobra monkey
python tools/monster-models/meshy/rig_level2.py cobra v3
python tools/monster-models/meshy/rig_level2.py monkey v2
node tools/monster-models/prepare.mjs artifacts/meshy-rig-02/cobra-rig-v3.glb artifacts/meshy-rig-02/cobra-animated.glb
node tools/monster-models/prepare.mjs artifacts/meshy-rig-02/monkey-rig-v2.glb artifacts/meshy-rig-02/monkey-animated.glb
node tools/monster-models/meshy/publish.mjs cobra v3
node tools/monster-models/meshy/publish.mjs monkey v2
```

`pole-angles-level2.json` retains the measured macaque rest-plane angles. Optional
`poles_level2.mjs` re-derives them from the initial v1 export, not a posed mesh.
The snake uses planar ground joints and smooth lower-neck weights, with no feet
or human retargeting. `rigs/{cobra,monkey}.json` records the final bone layouts.

For source reconstruction from the ignored Meshy original, prepare/unpack the
monkey first, run `correct_monkey.py v4`, then prepare using its fresh
`monkey-neutral-corrected-v4.glb` as the third argument and unpack again. The
temporary correction rotates the complete head through -1.25 radians with a
smooth lower-neck transition; its modifier is baked before the final rig.
Keep existing editable snapshots and use a new authorized output directory for
rebuilds rather than overwriting previous Blender exports.
