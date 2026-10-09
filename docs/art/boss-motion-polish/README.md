# Boss gestures and map lairs

Bosses now prepare and hold a readable pose during the ground warning, release
on the server's impact event, and recover before returning to locomotion. All
twelve primary bosses have individual timing profiles. Eight humanoid bosses
use restrained, real Meshy Idle, Charged Spell Cast, Charged Spell Cast 1 and
Right-hand Sword Slash motions; Buffalo, Takian, Pu Som and limbless Naga retain
their appropriate species clips. Ordinary attacks keep the approved body clip.

The atlas and minimap add distinct boss-lair badges. Atlas entries expose names,
levels and spawn conditions and can be searched or filtered by boss. The lair
continues to appear while a boss is absent. Selection opens details; the existing
navigation button starts walking. This does not reveal a global live respawn
timer or grant teleportation.

## Files

- `src/combat/BossMotion.js`, `MonsterModels.js`, `CombatView.js`,
  `CombatResources.js`: presentation, independent optional clip loading,
  serial/lifecycle guards and disposal.
- `public/models/monsters/motions/*.glb`: eight separate animation-only assets.
  Approved bodies, painted textures, rig weights and original clips are unchanged.
- `tools/monster-models/meshy/fetch_motion.py`, `retarget_motion.mjs`, `motions/`:
  recoverable Meshy requests, bounded transfer, skeleton-only donor and sanitized
  provenance. Meshy animation task used twelve credits.
- `src/ui/mapDirectory.js`, `Minimap.js`, `minimap/glyphs.js`,
  `minimap/mapStyle.js`: map-local public boss information and marker rendering.
- `src/ui/world-map.css`: selected portrait cards size from wrapped content,
  keeping the complete navigation action inside the clipping sidebar.
- `tools/boss-review.html`, `boss-review.js`: single-page production-controller
  studio with selectable phases and angles.
- `tests/boss-motion.test.js`, `meshy-motion-retarget.test.js`,
  `boss-meshy-motion-assets.test.js`, map tests: authority, fallback, lifecycle,
  data preservation, actual skin and map scope checks.

## Validation evidence

[Asset QA](asset-qa.json) passed 5,192 actual-body samples across all 32 optional
clips. [Controller QA](controller-qa.json) passed 1,599 samples across the two real
skill cycles of all eight humanoid bosses. Gates for indexed skin edges, arm
length, feet, floor, finite coordinates, protected bones and rigid props were
kept unchanged. Maximum controller arm-length error is 0.0128 mm; planted-foot
drift is 0.3605 mm. Preparation never predicts an impact.

The [initial rejected audit](INITIAL_QA.json) is retained. Mine, Giant and Rift
failed specific transfer clips; reducing only those action gains cleared the
same gates. The [delivery manifest](delivery-manifest.json) binds each published
optional file to the final accepted bytes and unchanged body hashes.

[Visual captures](capture.json) record 312 production-model/controller screenshots
covering front, side, back, top, real 2.5D, complete skill footprints and touch
emulation. [Eight-boss overview](eight-bosses.png),
[Commander release](fallen_city_3-0-impact-front.png) and
[Garuda release](himmapan_3-0-impact-front.png) provide compact witnesses.
Separate Art, Tech and map-browser evidence accompany the final acceptance.

Final full-suite validation passed **648/648 tests, zero skips** via the project's
complete test glob with two concurrent workers (78.1 seconds). `npm run build`
passed at 251 modules; the existing large-bundle warning remains. A regression
also verifies that returning to a map rebuilds a retired view for the same
Monster instead of reusing its stopped animator.

[Map browser QA](maps/browser-qa.json) passed all thirteen loaded desktop maps
and three genuine touch-emulated maps at 390×844: fourteen lairs across twelve
unsafe maps, none in town, no page errors, preserved no-walk selection and
visible 44px navigation actions. Screenshots:
[desktop lairs](maps/desktop-klong-atlas.png),
[touch selection](maps/mobile-klong-selected.png),
[touch minimap](maps/mobile-klong-minimap.png).

An independent visual review caught a clipped button border on long Wat/Rift
touch cards despite the original viewport-only assertions. The portrait grid
now sizes the selected sidebar from its content. [Final touch QA](maps/touch-qa.json)
adds complete card containment in the clipping ancestor and top/centre/bottom
hit tests on the Walk action. The original browser receipt is retained as
historical evidence; the mobile PNGs correspond to the final touch receipt.

## Limits

Meshy motion is a conservative upper-body contribution over the approved rig,
not a full-body replacement. Feet, fingers, tail, rigid weapons and wing ownership
retain their source animation; failed transfer directions deliberately remain
subtle. The numerical actual-skin controller audit covers normal cast cycles;
cancel, death and late-load behavior are covered by controller/mixer tests,
not equivalent actual-skin blend sweeps.

Rendering uses a software desktop browser and real coarse-pointer touch
emulation in an isolated local scene. It does not certify physical-device FPS,
live multiplayer encounter balance, finger-to-prop surface pressure or every
possible interrupted blend. One Blender process and one visible review tab are
kept; no new geometry or Blender rig edits were needed.
