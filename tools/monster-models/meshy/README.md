# Rice-field creature study 01 — Meshy

Three **static textured geometry candidates**, generated from separate built-in
imagegen concepts: boar (Lv.1), fowl (Lv.1), crab (Lv.2). They are not registered
in the live monster model mapping and do not replace the existing animated assets.
The next level-ordered candidates are cobra, monkey, dhole and phibpa.
`queue.json` contains all 65 current monster identities through level 100; planned
entries have not been generated. Regenerate it with `node tools/monster-models/meshy/queue.mjs`.

## Review

Run the project's Vite development server and open
`/tools/monster-models/meshy/review.html`. It uses the actual game GLTF loader,
camera direction `(15,23,22)`, daylight intensity, tone mapping and existing
monster heights. Select a creature, front/side/back/top, turntable or old-model
comparison. Narrow screens default to a single creature with `?type=boar`.
The page is a development tool, excluded from the production entry point.

Screenshots and anatomy/art/technical review:
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

## Before runtime replacement

These quadruped, avian and crustacean bodies need species-specific rigs, skin
weights, planted-foot locomotion and idle/walk/attack/hurt/die clips. Meshy's
[humanoid auto-rig API](https://docs.meshy.ai/en/api/rigging) is unsuitable for
these animals. Do not assign a human rig or relabel an unanimated model as ready.
Review joint bend direction, four boar hoof contacts, two bird foot contacts,
crab limb/claw motion, attack facing and readable telegraphs before registering
new URLs. Mobile crowd profiling remains a separate acceptance step.
