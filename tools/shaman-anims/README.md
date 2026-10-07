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

## Unarmed spellcasting revision

The generated `public/models/shaman.glb` has no staff. The source GLB is preserved;
`compose.mjs` strips the staff from its output after composing the new clips.
All ten spells use two-handed seals followed by palm, ward, ground-curse or summoning
releases at the existing effect timings. Index/middle fingers straighten while the
other fingers curl. Walk/run retain their retargeted arm swing with relaxed hands.
FX originate at the midpoint of the real hand bones, not a weapon socket.

The character mesh and 512px texture remain the supplied model; this revision changes
weapon presence and animation, not facial topology or costume texture quality.
