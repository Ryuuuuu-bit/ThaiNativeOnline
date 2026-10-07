# Blender monster assets

Original Blender-designed assets, without Tripo or external model downloads.
`source/boar.blend`, `source/pray.blend`, and `source/krasue.blend` retain editable
parts, explicit bone weights and the authored timeline. Earlier creatures are
retained hidden in the later source scenes. Only the intended creature is visible.

## Export and prepare

Export the visible/renderable creature to a new GLB from its source scene,
excluding studio cameras, lights and the hidden default cube. Apply mesh
modifiers, include animations, and keep the skin's named action. The preparation
tool rejects transforms/skins that cannot safely be consolidated.

```powershell
npm ci --prefix tools/monster-models
node tools/monster-models/prepare.mjs artifacts/monster-boar/boar.glb public/models/monsters/boar.glb
node tools/monster-models/prepare.mjs artifacts/monster-boar/pray.glb public/models/monsters/pray.glb
node tools/monster-models/prepare.mjs artifacts/monster-boar/krasue.glb public/models/monsters/krasue.glb
```

The source scenes use 24 fps. Frames: idle 1–49, walk 51–75, attack 81–105,
hurt 111–121, die 131–155. The preparation step selects the action matching the
skin name, splits it into five clips, closes idle/walk loop seams, consolidates
identity mesh nodes sharing a skin by material, and prunes unused export data.
No runtime compression decoder is required.

Open `/tools/monster-models/review.html` on the Vite dev server for the 2.5D review
stage using the actual game loader. It is a development page, excluded from the
production build. Run `npm test` and `npm run build` in the repository root.

## Paddy expansion

`build_paddy.py` authors fowl, cobra, crab, buffalo, monkey and phibpa through
registered Blender Harness commands. Set `BLENDER_DESIGN_ROOT` to the plugin
root, `BLENDER_SESSION_DESCRIPTOR` to a managed session descriptor, and
`MONSTER_OUTPUT_ROOT` to a new directory within the approved output root.
Run `python tools/monster-models/build_paddy.py <type>` and prepare the resulting
GLB with `prepare.mjs` as above. Use a fresh managed session per creature:
exporting buffalo after several unrelated rigs caused Blender 5.2.2 to exit;
the same recipe exported successfully in an isolated scene. Source files are
saved before export, and no existing output is overwritten by the generator.

Open `/tools/monster-models/review.html?set=paddy` for the seven-creature gallery.
See `docs/art/monsters/PADDY_SET.md` for budgets, screenshots and limitations.

These are first-pass stylized, faceted models. They use rigid section weights,
overlapping solids and some open curve ends; they are not watertight print meshes.
The walk is FK, without planted-foot IK. Fine face/hair/cloth work and mobile FPS
profiling remain outstanding. See `docs/art/monsters/FIRST_SET.md`.
