# Rice-field creature study 01 — Meshy

Eight textured Meshy creatures with species-specific Blender rigs and five game
clips: boar and fowl (Lv.1), crab, cobra and macaque (Lv.2), dhole and forest spirit (Lv.3), and buffalo (Lv.4).
The animated files in `public/models/monsters/` are used in the game's **3D monster mode**.
Static geometry candidates remain here for provenance and rig reconstruction.
Production now advances one complete map at a time, starting with **paddy**:
environment, its existing creatures, primary boss, portals, anatomy/motion review,
and gameplay-camera QA. **Paddy's seven creature identities, including the Lv.4
buffalo boss, now have reviewed animated Meshy models.** Next is deep forest;
retain shared approved models and complete its missing identities together.
Dhole belongs to deep forest.
`map-queue.json` groups actual runtime membership and boss assignments (shared
creatures appear on every inhabited map). Rebuild it with
`node tools/monster-models/meshy/map-queue.mjs`. This is an authoring manifest;
it does not submit generation jobs. Current map layout and evidence:
`docs/art/maps/paddy/REVIEW.md`; interactive plan: `/tools/paddy-map-review.html`.
Buffalo anatomy, motion and gameplay evidence: `docs/art/monsters/meshy-paddy-boss/REVIEW.md`;
interactive model: `/tools/monster-models/meshy/motion.html?set=4`.
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

## Lv.3 dhole and forest spirit batch

Open `motion.html?set=3` or `review.html?set=3`. The dhole comparison is an export
of its original procedural `CombatView` fallback, not an earlier external GLB.
The spirit comparison is the exact previous runtime file. Screenshots, recordings,
measurements and limitations: `docs/art/monsters/meshy-motion-03/REVIEW.md`.
Exact prompts are in `prompts-set-03.json`; two successful Meshy tasks used 70 credits.

Use a fresh managed session/output root with the usual approved asset directories.
For this run the existing session's approved root also covers its `level3` child.

```powershell
$env:MESHY_RIG_OUTPUT='artifacts/meshy-rig-02/level3'
node tools/monster-models/meshy/unpack.mjs dhole phibpa
python tools/monster-models/meshy/rig_level3.py dhole v5
python tools/monster-models/meshy/rig_level3.py phibpa v1
node tools/monster-models/prepare.mjs artifacts/meshy-rig-02/level3/dhole-rig-v5.glb artifacts/meshy-rig-02/level3/dhole-animated.glb
node tools/monster-models/prepare.mjs artifacts/meshy-rig-02/level3/phibpa-rig-v1.glb artifacts/meshy-rig-02/level3/phibpa-animated.glb
node tools/monster-models/meshy/publish.mjs dhole v5
node tools/monster-models/meshy/publish.mjs phibpa v1
```

The canine rig retains four feet and two hind pastern segments. Connected limb
bones prevent the contact constraint from separating joints. Rest-plane pole
angles and complete distal rotations are in `pole-angles-level3.json`; optional
`poles_level3.mjs` re-derives them from the local initial v1 export. It converts
world bases to Blender coordinates and accounts for Blender's XYZ Euler order.
The spirit uses two segmented arms, rigid open hands, a rigid mask/crown and
three root clusters. Hovering has positive vertical displacement; there is no
human lower-body retarget or separately bent finger animation.

## Deep Forest — complete existing roster

`motion.html?set=5` and `review.html?set=5` show Kongkoi, water monitor,
Pray, Khamot, Winyan and the Takian boss. Together with the shared macaque,
dhole and forest spirit, these cover all **nine runtime identities**. The
legacy tiger entry is filtered out of this map's actual combat spawns.
Environment art is a separate queued pass. See
`docs/art/monsters/meshy-deep-forest/REVIEW.md` for final evidence and limits.

Seven successful Image-to-3D tasks cost 245 credits, including two rejected
two-legged Kongkoi reconstructions. The selected second reconstruction was
repaired locally with `correct_kongkoi.mjs`: one rear leg removed, the newly
cut boundary capped and the retained leg centered. Cloth hems were preserved.
The corrected static candidate is committed, so ordinary rebuilds do not need
the raw Meshy downloads or another paid generation.

Use a fresh approved managed Harness session and output directory, configured
as above. Unpack all six static candidates. Both planted creatures require a
`rest` rig, terminal export receipts, extraction with `TYPE:rest`, then
`poles_forest.mjs TYPE`. Calibrations retain exact distal rotations, pole
angles and bone-local vertical offsets. The other four need no IK calibration.

```powershell
$env:MESHY_RIG_OUTPUT='artifacts/meshy-rig-03/deep-forest'
node tools/monster-models/meshy/unpack.mjs kongkoi monitor pray khamot winyan takian
python tools/monster-models/meshy/rig_forest.py kongkoi v3
python tools/monster-models/meshy/rig_forest.py monitor v4
python tools/monster-models/meshy/rig_forest.py pray v4
python tools/monster-models/meshy/rig_forest.py khamot v1
python tools/monster-models/meshy/rig_forest.py winyan v4
python tools/monster-models/meshy/rig_forest.py takian v4
python tools/monster-models/meshy/collect_forest.py pray
node tools/monster-models/meshy/extract_batch.mjs artifacts/meshy-rig-03/deep-forest/jobs/job_pray_v4_glb/artifact.glb artifacts/meshy-rig-03/deep-forest pray:v4
node tools/monster-models/prepare.mjs artifacts/meshy-rig-03/deep-forest/pray-rig-production.glb artifacts/meshy-rig-03/deep-forest/pray-animated.glb
node tools/monster-models/meshy/publish.mjs pray v4
```

Repeat collection/extraction/preparation/publication for each creature. A
nonzero collector exit means exports are still pending; do not pack a stale
file. Export delivery uses the registered **L3 snapshot-bound `job.submit`
EXPORT** route, never the bridge's L1 `export.file`. Export jobs retain hidden
authoring objects; extraction keeps only the requested rig subtree and baked
action. If exporting all six in one snapshot, all six must be visible so their
actions bake correctly. Use fresh job IDs/version names for subsequent runs.

Humanoid skin weights use merged UV-seam surface connectivity, geodesic bone
labels, diffusion, anatomical admissibility and conserved influence transfers.
Top-four selection and quantization are checked on the compressed public GLBs
with `tests/meshy-forest-skin.test.js`, across every clip/key and a 24Hz grid.
Bone-length/contact checks alone are insufficient to catch torn sleeves/hands.
Hands retain the generated digits without individual finger bending.

## Wat Rang — seven Thai monster models

`motion.html?set=6` and `review.html?set=6` show Headless, Pret, Krahang,
Krasue, Phitaihong, Soldier and Pusom (levels 6–10). Pray/Winyan reuse the
reviewed forest models, completing nine existing identities. Environment art
remains a separate pass. Evidence is in `docs/art/monsters/meshy-wat-rang/`.

Krasue's selected third reconstruction has a volumetric woman's head with
stylized heart, lungs and intestine. The silk-ribbon concept and flat frontal
reconstruction are rejected. Nine Meshy tasks cost 315 credits; seven selected
models account for 245. No paid generation is required to rebuild these rigs.

Use a fresh approved managed Harness with this directory as an asset root.
Keep original bind topology: `bind-inputs/krasue.glb` and `soldier.glb` precede
registered contour/guard edits. Their refined static review files have different
geometry and must not replace these weight-patch inputs. The override is
explicit; species without an override still use their prepared review file.

```powershell
$env:MESHY_RIG_OUTPUT='artifacts/wat-rang-rebuild'
$env:MESHY_BIND_INPUTS='tools/monster-models/meshy/bind-inputs'
$watTypes=@('headless','pret','krahang','krasue','phitaihong','soldier','pusom')
node tools/monster-models/meshy/unpack.mjs @watTypes
New-Item -ItemType Directory -Path tools/monster-models/meshy/.authoring -Force
foreach ($watType in $watTypes) {
  Copy-Item -LiteralPath "$env:MESHY_RIG_OUTPUT/input/$watType.glb" -Destination "tools/monster-models/meshy/.authoring/$watType.glb"
  python tools/monster-models/meshy/rig_wat.py bind $watType
}
python tools/monster-models/meshy/rig_wat.py export rest
python tools/monster-models/meshy/rig_wat.py collect rest
node tools/monster-models/meshy/calibrate_wat.mjs
foreach ($watType in $watTypes) { python tools/monster-models/meshy/rig_wat.py animate $watType }
python tools/monster-models/meshy/rig_wat.py export before-refinement
python tools/monster-models/meshy/rig_wat.py collect before-refinement
node tools/monster-models/meshy/extract_wat.mjs before-refinement
```

Calculate Soldier targets from the original bind input/current export with
`guard_wat.mjs`, apply `refine_wat.py soldier` and `refine_wat.py krasue` through
registered L3 commands, then export with a fresh tag, collect, extract and
package each creature using the shared `prepare.mjs` and `publish.mjs TYPE v1`.
These recipes honor `MESHY_RIG_OUTPUT`. Do not replay refinement over an
already-refined snapshot. All seven rigs/surfaces must be visible for the
snapshot-bound export. Never resubmit an unknown job result; recover its
recorded job ID.

Six sparse weight patches retain conserved local repairs and guard topology
hashes. Soldier uses a stricter precompression repair margin (1.85 ratio/9 mm),
while the unchanged delivered surface gate remains 2x/10 mm across every clip,
authored key and a 24 Hz grid. Browser grip checks also require physical surface
contact: HandR/Shield share an unanimated rigid transform, so a weight-group
name alone cannot identify the Soldier palm. Explicit source palm samples and
UV provenance are documented in the final validation report. No individual
finger retargeting, terrain foot IK or per-skill clips are supplied.

## Klong — Croc first

`motion.html?set=7` and `review.html?set=7` display the level 13 marsh crocodile.
This is the first of ten existing Klong identities. Other monsters and the
environment remain queued; no combat stats, spawns or boss summons change.
The world art height is 0.60m, normalized by the existing 1.30 outer scale.
Evidence and the complete roster are in `docs/art/monsters/meshy-klong/`.

Two Meshy tasks cost 70 credits. The first generated six foot ends and was
rejected before binding. The selected `croc-anatomy-v2.png` reconstruction has
four unbranched limb chains. Its prepared static file is committed, so rig or
motion revisions require no additional paid generation.

Use a fresh approved managed Harness, with the output directory and this
candidate directory as authorized asset roots. Rebuild in order; stop on every
nonzero exit. Do not replay bind over an existing rig or reuse an old export tag
after changing weights/motion.

```powershell
$ErrorActionPreference='Stop'
$PSNativeCommandUseErrorActionPreference=$true
$env:MESHY_RIG_OUTPUT='artifacts/croc-rebuild'
node tools/monster-models/meshy/unpack.mjs croc
python tools/monster-models/meshy/rig_croc.py bind
python tools/monster-models/meshy/rig_croc.py export rest
node tools/monster-models/meshy/calibrate_croc.mjs
python tools/monster-models/meshy/rig_croc.py animate
python tools/monster-models/meshy/rig_croc.py export rebuilt-v1
node tools/monster-models/meshy/extract_croc.mjs artifacts/croc-rebuild/jobs/job_croc_rebuilt-v1_glb/artifact.glb artifacts/croc-rebuild/croc-rig-production.glb
node tools/monster-models/prepare.mjs artifacts/croc-rebuild/croc-rig-production.glb artifacts/croc-rebuild/croc-animated.glb
node tools/monster-models/meshy/publish.mjs croc rebuilt-v1
```

Twenty bones retain body, neck, head, jaw, three tail segments and four
Upper/Lower/Foot chains. Each leg's pole and full foot rotation derive from the
exported rest basis. Geodesic weights preserve UV copies and normalize at most
four influences. Semantic torso and sole ownership prevent belly/heel sinking.
Feet stay planted in idle; walk uses diagonal steps. Death keeps the long tail
clear while settling the chest. Jaw direction is checked against its actual
local basis. No humanoid retargeting or individual toe animation is used.

`rig_croc.py export TAG` records durable L3 job IDs before dispatch, verifies
artifact/source hashes and acknowledges each terminal job once. An uncertain
response recovers the recorded job without resubmission; an unfinished export
stops packaging. Recover it with the same tag. Never silently package a stale
GLB. The packed editable Blender export is retained locally beside the job
receipts and is reopened separately for source verification.
