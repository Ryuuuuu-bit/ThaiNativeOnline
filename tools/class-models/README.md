# Male and female class bodies (2026-10-13)

Every class now has two bodies, `public/models/classes/<class>-male.glb` and
`<class>-female.glb`, picked by the character's gender (`avatarFor(classId, gender)` in
`src/data/training.js`). They were made in Tripo Studio from the turnaround art in
`ThaiNativeOnline-Character-Art/class-turnaround-40/<job>/<gender>/{front,left,right,back}.png`
(multi-view, H3.1, 30k triangles, 2K PBR), auto-rigged with the Mixamo preset and exported as
GLB with the skeleton (Downloads/<job>-<gender>.glb; not committed, ~4.5 MB each).

The clips and weapons come from the class's original model, which stays in `public/models/<class>.glb`
as the donor (job → donor: swordman → warrior `sword_L sword_R`, archer → hunter `hunter_bow`,
boxer → muay-thai-fighter, healer → herbalist, mage → shaman):

```sh
node tools/class-models/unpack.mjs public/models/warrior.glb artifacts/warrior-donor.glb   # meshopt → plain (three's meshopt_decoder + dequantize)
node tools/class-models/retarget.mjs Downloads/swordman-female.glb artifacts/warrior-donor.glb artifacts/warrior-female.glb sword_L sword_R
python tools/models/shrink-glb-textures.py artifacts/warrior-female.glb --max 1024 --quality 90
npx gltfpack -i artifacts/warrior-female.glb -o public/models/classes/warrior-female.glb -cc -kn -ke -vpf   # -vpf for the weapon classes
```

retarget.mjs also corrects what the donor's bones cannot carry over (2026-10-13 anatomy pass):
fingers are rebuilt on the new hand (each curled as far as, and toward the same palm side as, the
donor's; full grip on the swords; the archer's drawing hand hooks the string in bow moves), the
a loose hand takes a relaxed hand's soft curl with the fingers held together instead of the
T-pose fan, fingers are scaled to 0.86 from the knuckle (the generated hands run long), the
hips are lifted or lowered so idle soles stand on the ground, and a sword or bow that would pass
through the head (key frames and the in-betweens) swings clear: the upper arm turns out first,
then the weapon about the hand, eased over ±7 frames. The log lists every clip it touched.

The archer bodies also carry `aim_pose`, the full-draw stance the entry screens show
(`AVATARS.hunter.previewClip`): `node tools/class-models/archer-pose.mjs body.glb body.glb` after
the retarget, before packing. IK from hunter_shot's full draw: wide stance with bent knees, bow arm
straight at the target, the string hand at the jaw with a straight wrist and the elbow back, the
head down the arrow, the bow turned upright.

Swordsman, archer and shaman idles are Tripo Studio text-to-motion stances (Animate tab, 20
credits each, exported with "stay in place" on the male bodies; Downloads/<job>-male-idles.glb):
twin-sword guard, alert hunter with the bow held low, spirit caster cradling an orb.
`tools/class-models/add-idle.mjs` puts one on the male body as `idle` (weapon hands keep their
grip, the bow hangs upright, every frame's lower foot stands on the ground, the end eases into the
start); that body is then the donor for retarget.mjs onto both genders, so the new idle gets the
same finger, ground and weapon-clearance pass as every other clip.

Portraits (`public/ui/portraits/<class>.png`, `<class>-female.png`) are 256px renders of the
packed bodies' idle pose in the game loader. If a Tripo export comes back with its bones at
identity and the skeleton turned 90° from the mesh (it happened once), export it again: the
second export was a normal rig. `tests/class-gender-models.test.js` checks every body keeps
the donor's clips, timings, skeleton, weapons and download budget.

---

# Retarget supplied warrior and ranger models

The warrior replacement is now inactive: the user requested the original Tripo
warrior again. Its runtime file and portrait were restored from `6ac984c`.
The warrior commands below document the historical replacement workflow;
do not run them against the current public warrior. See `tools/warrior-anims/README.md`.
The hunter replacement remains active.

The unchanged user files are `tools/warrior-anims/warrior-user.glb` (Downloads/warrior.glb)
and `tools/hunter-anims/rangers-user.glb` (Downloads/rangers.glb). They contain
Mixamo skins but no animations or separate weapons. The legacy prepared models
remain animation/weapon donors, not the runtime bodies.

Install build-only dependencies in a disposable checkout or an isolated tools
directory that mirrors this tree (do not modify the application's lockfile):

```sh
npm install --no-save --package-lock=false @gltf-transform/core@4 @gltf-transform/functions@4 gltfpack
```

From the repository root, with an existing `artifacts` output directory:

```sh
node tools/warrior-anims/compose.mjs tools/warrior-anims/warrior-tripo.glb artifacts/warrior-donor.glb
node tools/hunter-anims/compose.mjs tools/hunter-anims/hunter-tripo.glb artifacts/hunter-donor.glb
node tools/class-models/retarget.mjs tools/warrior-anims/warrior-user.glb artifacts/warrior-donor.glb artifacts/warrior-new.glb sword_L sword_R
node tools/class-models/retarget.mjs tools/hunter-anims/rangers-user.glb artifacts/hunter-donor.glb artifacts/hunter-new.glb hunter_bow
python tools/models/shrink-glb-textures.py artifacts/warrior-new.glb --max 1024 --quality 90
python tools/models/shrink-glb-textures.py artifacts/hunter-new.glb --max 1024 --quality 90
npx --no-install gltfpack -i artifacts/warrior-new.glb -o public/models/warrior.glb -cc -kn -ke
npx --no-install gltfpack -i artifacts/hunter-new.glb -o public/models/hunter.glb -cc -kn -ke
```

Stop on any failed command. Texture shrinking must happen before meshopt packing.
The old composers alone still produce the old bodies; run the retarget stage to
build the replacements. Source weights and bind poses are preserved. World-space
bone rotation deltas are transferred parent-first, hips translation is rescaled,
and walk/run horizontal travel is removed. Weapon orientation and hand-relative
grip are transferred independently to account for different bone rolls.

Twin-sword rigs additionally align anatomical bone/child and palm/sole axes,
rebuild finger curls on the supplied hand, and seat swords at the new finger
centres. Head/neck pitch and roll are restrained for combat and locomotion;
authored yaw and hurt/death poses are retained. These corrections are selected
by the `sword_L sword_R` prop pair; the hunter's existing transfer is unchanged.

All original clip names and 30fps timing remain available to the game. There are
15 warrior clips and 14 hunter clips. The unchanged class model URLs are shared
by character selection, the local player and remote players. Portraits were
rendered from the packed runtime models at 256px using the game loader.

Run `npm test` and `npm run build`, then review idle, locomotion and skill poses
in the game on desktop and mobile. See
`docs/art/reviews/WARRIOR_RANGER_MODEL_REFRESH.md` for evidence and limitations.
