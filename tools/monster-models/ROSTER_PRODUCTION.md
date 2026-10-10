# Budgeted monster production

The runtime roster contains 67 gameplay IDs. `roster-inventory.json` freezes the
33 previously approved GLB hashes and placement specifications. New provider
outputs remain candidates until their exact exported body passes art,
technical and actual-game QA. A thumbnail, recipe or provider success is not
shipping approval.

## Current bounded delivery

Nangram V4 and the half-human tiger ghost V6 are admitted with separate embedded
GLBs and five authored clips each. The runtime registry now contains 35 models;
32 gameplay IDs remain pending. Their art, technical and runtime approvals are in
`docs/art/monsters/meshy-roster-20261010/`. The remaining work stays explicitly
pending in `production-roster.json`. This delivery does not assert that every
monster model is finished.

The approved provider ceiling is 930 credits; recorded spending is 920. That
includes the rejected full-animal tiger and the user-approved half-human ghost
replacement. The remaining 10 credits are reserved for the held spider's
texture stage, after its anatomy is corrected and reviewed. Do not submit
retries or extra paid stages automatically. Local source repair, rigging and
QA do not consume provider credits.

## Reproducible stages

The stages below describe the retained local authoring workspace. The bounded
delivery commits runtime assets and admission gates; source inputs, authoring
experiments and Blender receipts remain local. A fresh checkout can verify the
delivered bodies but cannot regenerate them from these notes alone.

1. `meshy-roster-plan.json` records the authoritative identities and prompts.
   `meshy-roster-runner.mjs` uses Meshy CLI 0.4.0, reserves costs and task IDs
   atomically, and preserves uncertain submissions for recovery. Its local
   journal is ignored and must not be committed with signed asset URLs.
2. `meshy/roster-source.mjs` inspects and admits isolated textured geometry.
   It retains source topology/UV provenance and measures the prepared source.
   Static source selection is separate from rigged runtime approval.
3. Measured anatomy and explicit topology-bound weights go into isolated
   `artifacts/all-monster-models/rig/input`. `meshy/roster_rig.py` handles
   observed bipeds; `meshy/roster_ghost_rig.py` handles observed legless robes.
   No rig may invent hidden knees, elbows or species anatomy.
4. Registered Blender Harness operations bind, author and export the body.
   The caller provides its local `BLENDER_SESSION_DESCRIPTOR` and explicit
   `MESHY_HARNESS_OUTPUT_ROOT`. Live mutations must remain serialized. Retain
   immutable job receipts, original sources and rejected attempts locally.
5. `meshy/extract_roster.mjs` keeps the selected surfaces and their exact skin;
   `meshy/package_roster.mjs` splits the authored 24 Hz timeline into idle,
   walk, attack, hurt and die. `prepare.mjs` is not a substitute for this rigged
   source pipeline.
6. Review actual exported geometry and every relevant animation from the game
   camera. The art gate requires style, readability and technical usability
   scores of at least 8. Probe all relevant mesh edges, not just a wrist capsule.
   Record which region policy applies; a narrow passing probe cannot establish
   whole-body approval. Verify loops, finite bounds, floor contact, material
   winding, cloth intersections and attached details.
7. Actual `CombatView.ensure -> makeMonsterModel` browser QA checks selection
   of all five clips, damage/death, picking, collision rejection, map release
   and fresh controllers. A SwiftShader smoke check does not establish FPS,
   online soak or long-running leak behavior.
8. Admit only that exact approved GLB into `public/models/monsters`, add its
   specification to `MONSTER_MODELS`, and move its ID from pending to accepted.
   Every approval must bind the body SHA; the manifest also hashes the approval
   files. Preserve the immutable baseline and all other pending IDs.

## Verification

Run the focused asset and admission checks after admitting a model:

```text
node --test tests/monster-roster-models.test.js tests/monster-model-assets.test.js
npm run build
```

`node tools/monster-models/check-roster-complete.mjs` is a separate full-roster
milestone check. It intentionally fails until all 67 models are accepted.
Passing bounded CI must not be presented as passing that completion milestone.
