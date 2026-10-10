# City NPC asset workflow

This task uses Meshy bodies for 17 important NPC families, selected by explicit
gameplay IDs. Ambient citizens remain instanced. It does not change services,
quests, schedules, shop stock or authored map positions.

The art direction is in `docs/art/npcs/NPC_MODEL_BRIEFS.json` and
`docs/art/npcs/THAI_TEXTILE_DIRECTION.md`. Body preparation and final textile
appearance are separate acceptance steps. Provider task success is not an
anatomy or gameplay approval.

## Generation and provenance

`meshy-jobs.mjs` invokes the authenticated Meshy CLI only. It stores submission
IDs before waiting, locks project/state mutations, and downloads existing jobs
without submitting new jobs. Raw provider receipts, signed download metadata
and original source files belong in ignored `artifacts/city-npc-models`.
Never commit authentication files or raw signed responses.

The sanitized `docs/art/npcs/GENERATION_PROVENANCE.json` retains all selected
and rejected paid task IDs: 26 previews, 19 refinements and 19 rigs, **805 NPC
credits** in total. The approved cap is exhausted. Local preparation and Thai
textile work use no further Meshy credits. Re-running generation requires a
separate approved scope and budget.

## Prepare each actual body

`batch-prepare.mjs` reads selected task lineage and individually measures each
body, palm plane, joints, source hashes and garment region. It does not reuse
another character's fitted quaternions. A failed body must be corrected before
staging; unknown measurements are not zero errors.

The preparation dependencies are the existing `tools/monster-models` tool
package. Set `NPC_MODEL_DEPS` to its absolute directory. Inspect and calibrate
with `prepare.mjs`, then run its preparation mode. Exact invocation options are
reported by the script's help/usage output.

Each family produces a prepared GLB, editable uncompressed GLB, per-body
calibration/adapter contract and full indexed-edge/anatomy audit. Native walk
and run motion is reduced where needed for cloth clearance. A numeric pass
still requires visual motion/contact review.

## Textile and isolated runtime QA

`thai-textiles.mjs prepared.glb inspected-profile.json` paints only inspected
garment regions. Every output uses a fresh immutable revision. It accounts for
quantized UVs and `KHR_texture_transform`, keeps seam repeats periodic, excludes
ambiguous shared pixels, and replaces the single embedded 1024 colour map.
Non-texture geometry, rig and animation bytes and their semantic JSON are
verified unchanged. Monastic profiles use plain tonal edge treatment.

`stage.mjs family textile-revision` requires the matching successful body
audit and texture integrity receipt. It stages an asset and editable source
for review. Its temporary candidate catalog is imported only by the review
page; it **does not approve the production catalog**.

`capture.mjs` renders actual raw or registered models; `gameplay-qa.mjs`
exercises the existing city schedule/navigation and renderer lifecycle.
Use one headless browser/page, dispose it afterward, and keep failed witnesses
alongside the corrected revision. Inspect front, back, hand contacts, garment
clearance and the actual 2.5D camera. No account/shop/warp transactions are part
of these visual fixtures.

Only bodies with recorded Art and runtime acceptance enter the final
`src/npc/model-profiles/<family>.json`. Those bundled contracts pin each final GLB hash and
its own measured Meshy24 calibration. Missing/malformed profiles use the
existing procedural fallback. Important models use near-distance LOD;
ambient crowds continue to use instancing.

## Release verification

`promote.mjs` requires recorded acceptance for all 17 families and their exact
registered camera receipts before writing bundled production profiles.
`verify-release.mjs` checks the final shipping hashes, editable sources, model
budgets, native clips and 34 mapped identities. Run the final tests and build
after promotion, then deliver through a task PR into canonical `main`.

After Railway reports a successful deployment of that exact main commit,
`verify-uat.mjs --commit <40-character-main-sha> --deployment <deployment-id>`
checks public health, every NPC and companion model, the page and built bundles
against the local release build. It only reads public endpoints and stores its
receipt under ignored `artifacts/city-npc-models/deployment`; it does not deploy
or modify accounts. Confirm Railway's commit/status separately and record both
the deployment receipt and live byte verification in the release report.

## Delivery limits

Release visual policy: continuous-robed sit activities use an explicitly reviewed
standing presentation. The underlying schedule and service remain unchanged.
Monks bow their heads and chant with relaxed hands; the rejected forced wai is
not enabled. Unsupported bowls and misfitting family-specific headwear are
explicitly suppressed only on active models. Selected tools are sheathed,
belt/back stowed, or ground parked; this does not certify a finger grasp, rowing,
hammer impact, bow draw or sword strike. The prepared rig has no finger joints.

`curate-release.mjs` requires an explicit parent Art verdict and copies selected,
hash-verified actual PNGs into `docs/art/npcs/reviews/release`. All research and
rejected witnesses remain ignored locally. A portable report records the full
archive hash and image count without claiming that all research images ship.

The Meshy humanoid skeleton has no individual finger bones. Prepared native
motion and fitted runtime poses are not full cloth simulation or terrain IK.
Editable delivery is the prepared uncompressed textured GLB, not a claim of
an authored Blender control rig. Preserve ignored original provider files
before archiving the worktree. Shipping targets remain one opaque colour
material, 1024 texture, at most 16k triangles and under 800,000 bytes per family.
