# หมอผี (shaman) model and animations

`shaman-tripo.glb` is the owner's Tripo shaman (low-poly, ≈ 4.7 k triangles, textures 512²)
rigged by the owner in Tripo with Mixamo bone names, plus the skull staff:

1. the staff (Tripo, 1.9 M → 5 k triangles, textures 1024²) is scaled to 0.72 (≈ 1.3 m on the 1.8 m shaman)
   with the grip centre (on the shaft, under the skull ornaments) as origin, and is parented to
   `mixamorig:RightHand`: grip through the fist, skull end out of the thumb side (T-pose:
   forward), the skull's face toward the knuckles;
2. exported (JPEG textures) without clips.

```sh
npm i --no-save @gltf-transform/core@4 @gltf-transform/functions@4
node tools/shaman-anims/compose.mjs tools/shaman-anims/shaman-tripo.glb public/models/shaman.glb
```

`compose.mjs` is the warrior's procedural pose builder (`fighter()`: hinge limbs, leg and arm
IK, palm roll, a hand given a `blade` direction for the staff), which works in world space and
so drives this rig as it is. Its rest pose differs from the fighter's (hips lower, bone rolls
turned), so `walk` and `run` are the fighter's clips retargeted: every bone takes the fighter
bone's world-space turn from rest on top of its own rest, the hips move scaled by hip height,
and the right arm is re-posed from the stance so the staff stays upright. The staff node is
keyed too (it turns in the grip to point where it is asked: `DBG=1` lists any key still off by
more than 15°). Clip list and timings: `docs/art/classes/shaman/ANIMATIONS.md`.
Portrait (`public/ui/portraits/shaman.png`): Eevee render of the full-resolution model.
Skill icons: PixelLab 48×48 art in `tools/icons/source/shaman/`, framed by `tools/icons/normalize.py`.

## Supplied model refresh — 2026-10-08

The default source is now `wizzard-tripo.glb`, an unchanged copy of the user's
`wizzard.glb` (SHA-256 `e753d883064a88c67aa70f96b09d9c8effcf1bb369c5ed378b0d4ecb4502b944`).
It has a Mixamo skin but no animations. `compose.mjs` generates the existing 15
clips directly on this new skeleton. The older source is retained for recovery.

Rebuild with `node tools/shaman-anims/compose.mjs`, then shrink embedded textures
to 1024px/quality 90 with `tools/models/shrink-glb-textures.py` and pack only
`public/models/shaman.glb` with gltfpack (`-cc -kn -ke`). The runtime asset is
1,414,356 bytes; the source mesh is not decimated. Updated portrait and browser
review images are documented in `docs/art/reviews/CLASS_MODEL_REFRESH.md`.

### Anime ready stance — 2026-10-08

The ready pose is asymmetric: staggered planted feet, a small hip/chest turn,
relaxed left arm and a raised right-hand two-finger seal. Breathing only affects
the upper torso/head. All spell start/end keys share this pose, including finger
curl; effect release times are unchanged.

The optional fourth CLI argument selects the locomotion donor. This revision used
`tools/muaythai-anims/fighter-tripo.glb` from commit `533ba9b` so that decoded walk/run
body tracks remain identical to the previous runtime model; finger rotations now
use the corrected palm-facing hinges. Extract that historical
file to a temporary path before rebuilding, and pass it explicitly:

```sh
node tools/shaman-anims/compose.mjs tools/shaman-anims/wizzard-tripo.glb artifacts/shaman-idle.glb artifacts/shaman-original-donor.glb
```

Then shrink textures and pack as above. Do not replace the current fighter source
with the historical donor. Review: `docs/art/reviews/SHAMAN_IDLE.md`.

The supplied rig has three joints per finger, without the donor's fourth tip nodes.
The shared fist helper assumes those tip nodes exist, so it must not be used for
this source: a missing tip resolves to the origin and can choose backwards flexion.
`curlHand()` derives local flexion axes from the rest palm plane and real segments,
limits MCP/PIP/DIP rotation, and handles thumb opposition separately. This applies
to spell, idle and locomotion fingers. Regression checks sample all clips at 30 fps
for positive flexion, bounded angles and no sideways finger twist.

### Previous unarmed animation implementation

The generated `public/models/shaman.glb` has no staff. The source GLB is preserved;
`compose.mjs` strips the staff from its output after composing the new clips.
All ten spells use two-handed seals followed by palm, ward, ground-curse or summoning
releases at the existing effect timings. Index/middle fingers straighten while the
other fingers curl. Walk/run retain their retargeted arm swing with relaxed hands.
FX originate at the midpoint of the real hand bones, not a weapon socket.

The character mesh and 512px texture remain the supplied model; this revision changes
weapon presence and animation, not facial topology or costume texture quality.

### Remove held right-hand bell — 2026-10-10

The composer automatically removes the bell before texture shrinking/packing.
For an existing packed model, run `node tools/shaman-anims/remove-bell.mjs` after shrinking textures
and packing the runtime asset. Optional arguments are input and output GLB paths.
The supplied `wizzard-tripo.glb` remains untouched.

The bell is fused into the skinned character mesh. The cleanup selects only the
right-hand hanging bell below its contact with the fingers in the source rest pose:
all triangle vertices have x between -0.31 and -0.26, y between 0.65 and 0.75,
and at least one vertex has y below 0.744. This removes 110 triangles, reducing
10,003 to 9,893. The fingers, wrist wrap, costume and other charms remain.

The script decodes positions/indices for selection but leaves existing GLB binary
bytes intact. It appends one replacement uncompressed index view, preserving the
15 animation clips, skin, textures and quantized vertex attributes. Runtime size:
1,472,856 bytes (58,500 bytes larger; preserving exact clips avoids a full repack).
Review images: `docs/art/classes/shaman/review/remove-bell-before.png`,
`remove-bell-after.png` and `remove-bell-hand.png`. No generation prompts, Tripo
jobs or credits were used. Reapplying to a cleaned asset fails with a clear error
rather than silently selecting a different region.


### Both-hand correction — 2026-10-10

The supplied source contains two mirrored hanging hand bells, each 110 triangles.
The first cleanup removed the raised right-hand bell only. Cleanup now checks
both rest-pose regions (right x -0.31..-0.26; left x 0.263..0.314), with the same
y bounds and contact cutoff described above. Both dangling stems and bell heads
are removed. Red wrist wraps and the separate round waist gourd remain intact.

Current runtime: 9,783 triangles, 1,531,624 bytes. Original source: 10,003 triangles;
full regeneration removes 220 triangles. On the previously cleaned runtime, only
110 left-hand triangles remain to remove. Each side must contain exactly 0 or 110
selected triangles; a different count fails before writing. An already-clean file
is unchanged, allowing repeated pipeline runs. The composer automatically runs
this cleanup, so regeneration cannot restore either bell.

Both-hand, front, back and side before/after evidence is in
`docs/art/classes/shaman/review/complete/`. All 15 clips retain their original
animation bytes; indexed triangles are absent from both bell regions throughout
playback. No Tripo generation, prompts or credits were used.
