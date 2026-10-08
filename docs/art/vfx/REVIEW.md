# Class VFX detail pass

The approved concept guides additional detail on the five playable kits. Existing
models, animation clips, hit times, targeting, skill ranges and damage rules remain
the basis. Assassin is still a future class, with no new playable kit in this pass.

## Art changes

- Muay Thai: copper secondary cuts, fine slash filaments and compact spark accents.
- Warrior: gold crossing cuts, ivory/gold impact flecks; elemental blue and red buff
  cues remain distinguishable.
- Hunter: textured leaf ornaments, jade wind filament and small leaf impact motes.
- Shaman: orbiting parchment talismans, violet soul palette, amber hellfire, spiral
  and lotus ritual marks with transparent centres. Spell origins remain the hands.
- Herbalist: veined leaves, a green flow ribbon and restrained green highlights
  around the existing animated book. Existing healing and poison shapes remain.

Primary shared particles, slash ribbons, decals and pillars compress excessive
additive brightness to retain their colour. Decals now preserve their authored
opacity throughout their fade. No new dynamic lights or particle draw calls are
introduced by the detail layer.

## Technical findings

The particle shader assumed a perspective camera, giving invalid point sizes with
the game's orthographic camera. Orthographic projection now uses viewport height,
view span and zoom, without depth attenuation; perspective previews retain depth
attenuation. Zoom changes update the scale even without a resize.

Quantised cloned character skins needed a world-matrix refresh before bounding-box
sampling. Without it, several models were displaced from their cast origins in
the isolated reviewer. Refreshing before normalisation aligns all five models.
No model files or clips were replaced.

The detail budget is shared across local and remote class runners: at most 16
active detail groups in high quality, 6 on coarse-pointer devices or low quality;
4 versus 2 ornaments per cast, and at most 12 versus 5 extra motes per impact.
Decorations expire and release the budget. Preview cancellation resets it too.
This bounds the **new detail layer**, not all pre-existing skill geometry/particles.

## Validation and screenshots

Full suite: 311 tests passed. After adding all-class cleanup coverage, all 6 focused
VFX tests passed (312 distinct tests covered overall). Production build passes;
the existing large-bundle warning remains. Browser QA cast all 50 skills, checked
finite particle projection, shared-detail cleanup, model origin alignment, shader
and page errors; all passed. A 390x844 low-quality view also passed. The city capture
uses a local HTTP/WS account, real training dummies and the production build.

Use `npm run dev`, then `/tools/vfx-review.html?class=shaman` to inspect actual
models and effects interactively. Buttons play the original skills. Other class
IDs are muaythai, warrior, hunter and herbalist. The tool is local review tooling,
not a new player-facing screen. The isolated floor is deliberately simple.

- [Muay Thai](vfx-muaythai.png)
- [Warrior](vfx-warrior.png)
- [Hunter](vfx-hunter.png)
- [Shaman](vfx-shaman.png)
- [Herbalist](vfx-herbalist.png)
- [Mobile detail](vfx-shaman-mobile.png)
- [Actual city](vfx-shaman-city.png)
- [Browser results](vfx-results.json)

## Changed files and limits

`src/classes/fx/class-detail.js`, `particle-projection.js`, `engine.js`,
`shaman-skills.js`, `herbalist-skills.js`, `src/classes/index.js`,
`src/classes/model.js`, both new VFX test files, `tools/vfx-review.html`, and this
review with captures. Gameplay formulas, cooldowns and server messages are unchanged.

This is a procedural detail pass, not a literal recreation of the generated concept
illustration. Physical-phone FPS, first-cast shader compilation and crowded-party
overdraw need hardware profiling. Independent art review remains pending. No deploy
is included in this task.
