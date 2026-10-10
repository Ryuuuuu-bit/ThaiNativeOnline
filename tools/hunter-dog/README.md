# Hunter companion model and attacks

The production companion uses the user-approved Meshy body with a locally fitted
38-joint canine rig. The dhole enemy is unchanged. One preview and one refine
cost **30 credits**; no paid rigging or custom animation stage was submitted.
Task IDs and source hashes are recorded in meshy-provenance.json.

public/models/hunter-dog.glb has 6,255 triangles, 8,915 vertices, one opaque
material, a 1024 JPEG and 38 joints, totaling 831,080 bytes. Its canonical
shoulder height is .45 m; builder scale 1.25 and follower scale .8 combine
to .45 m in gameplay. Original 2k Meshy source and former canine rig are
retained in source/ as authoring inputs.

Region-constrained barycentric weight transfer excludes opposite limbs.
Welded seams share weights; adjacency smoothing and equivalent-joint
consolidation preserve tail continuity. Fitted inverse binds are recomputed.
The local binder validates the actual controller over 305 poses and rejects
nonfinite geometry or excessive edge extension. Native topology/UVs remain.
Rebuild a candidate without replacing production:

    node tools/hunter-dog/bind.mjs

src/classes/dog.js adds bounded anticipation, neck/head strike, leg reach and
recovery. The scripted strike aligns with bite phase .55. CombatView reacts to
the pet cooldown reset and starts impact/recovery at .55, avoiding a world-clock
loop that missed fast attacks. Existing damage and skill rules remain unchanged.
The revisioned model URL prevents loading the cached former body.

With Vite running at http://127.0.0.1:5191:

    node tools/hunter-dog/capture.mjs final
    node tools/hunter-dog/gameplay-qa.mjs --published-sha256 341c647c886e302e4485511481042df5abde243a66a8b2ff8ac8668e29caa541 --label new-review

TNO_QA_URL and TNO_PLAYWRIGHT_DIR override review URL/package. Both helpers use
one headless Edge page and close the browser in finally.

Validation: final capture passed 57 screenshots and 128 motion frames with
matching served/local hashes. Gameplay final-3 passed 11 cases and 51 images:
following, normal/fast attacks, borrowed skill dogs, spirit copies, recasts
and returning the same follower. npm test passed 664 tests; npm run build
passed with the existing bundle warning. Baseline receipts retain old hashes.

The mouth has no separate animated jaw; bites read through head/neck snap,
lunge and effects. The inherited gait has no planted-foot IK/terrain adaptation;
sampled paws can descend about 4.6 cm below origin. Isolated checks do not
establish authoritative server combat or live terrain correctness.
See docs/art/reviews/HUNTER_DOG.md and gameplay/final-3/REVIEW.md for evidence.
