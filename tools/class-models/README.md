# Retarget supplied warrior and ranger models

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

All original clip names and 30fps timing remain available to the game. There are
15 warrior clips and 14 hunter clips. The unchanged class model URLs are shared
by character selection, the local player and remote players. Portraits were
rendered from the packed runtime models at 256px using the game loader.

Run `npm test` and `npm run build`, then review idle, locomotion and skill poses
in the game on desktop and mobile. See
`docs/art/reviews/WARRIOR_RANGER_MODEL_REFRESH.md` for evidence and limitations.
