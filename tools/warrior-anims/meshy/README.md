# Meshy warrior review candidate

The user supplied `reference.png` as the visual authority for this candidate.
It replaces the earlier generated concept as the input to Meshy. Red/black/gold
Thai fantasy cloth and armour, youthful anime proportions and a straight head
are the intended appearance. The image was uploaded to Meshy through its
Image-to-3D API as a PNG data URI; no public image hosting was required.

`generation-parameters.json` records the request without image data or secrets.
`provenance.json` records task IDs, credits and the balance at completion.

- `warrior-meshy-rigged.glb`: original Meshy rigged output, unchanged, 14,628,060 bytes.
- `warrior-meshy-preview.glb`: packed review candidate, 1,590,608 bytes, 20,391 triangles,
  one material/skin, 24 bones, `idle`, `walk`, `run` clips and 1024px textures.
- `prepare.mjs`: retains the new rig and transfers Meshy's own native locomotion
  by matching node names. The idle clip holds its neutral pose.

## Rebuild

Use the same isolated build-time dependencies as `tools/class-models/README.md`.
Retrieve the rigging task through the [Rigging API](https://docs.meshy.ai/en/api/rigging)
using a locally configured `MESHY_API_KEY` in the Authorization header. Save
`result.basic_animations.walking_glb_url` and `running_glb_url` downloads to
`artifacts/meshy-warrior/walking.glb` and `running.glb`. Do not commit API keys or
signed download URLs. Create the output directory before running these commands:

```sh
node tools/warrior-anims/meshy/prepare.mjs tools/warrior-anims/meshy/warrior-meshy-rigged.glb artifacts/meshy-warrior/walking.glb artifacts/meshy-warrior/running.glb artifacts/meshy-warrior/warrior-review-unpacked.glb
python tools/models/shrink-glb-textures.py artifacts/meshy-warrior/warrior-review-unpacked.glb --max 1024 --quality 90
npx --no-install gltfpack -i artifacts/meshy-warrior/warrior-review-unpacked.glb -o tools/warrior-anims/meshy/warrior-meshy-preview.glb -cc -kn -ke
```

Stop on any failed command. Keep the original rigged output unchanged. The
generation request used `pose_mode: t-pose`, but the delivered rig's neutral pose
has lowered arms; the saved GLB is the actual result, not a promised exact T-pose.

This is a review asset, not the active `public/models/warrior.glb`. Meshy's rig has
24 bones with different spine names/order and no finger bones, while the current
class uses a 65-bone Mixamo skeleton. Sword combat motions, hand grips and weapon
attachments require a separate adaptation. Do not feed it directly to the
current Mixamo retarget tool or replace the live model without that work.

See `docs/art/reviews/MESHY_WARRIOR.md` for screenshots, measurements and limits.
