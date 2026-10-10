# North forest trail and ordinary progression

The reported blockage north of สะพานขอนไม้ was a dry-ground height check,
not tree collision. The authored trail runs from `sb_n` (-4, -414) to `f5`
(11, -434), then the wat path gateway (8.5, -439). Its dry surface dips below
the old global wading cutoff; all 101 sampled centreline positions failed
the former client `World.canStand` even though no tree collider was nearby.

`forestTrailDryGround` reserves only this existing three-metre trail. It
rejects actual water and the rendered stream shore ribbon, whose footprint
is wider than the inset deep-water mask. `World.canStand` still applies map
bounds, static collision, bridge/deck and deep-water checks first; the dry
trail exception is restricted to `deep_forest`. Existing height restrictions
elsewhere remain intact. No foliage, terrain heights or collider footprints
are removed. A global shallow-water bypass was rejected because it could
make submerged shore fringes walkable.

The updated collision export has identical collider/map payloads for all
fourteen maps. Only its source provenance hash changes after the client
World source update; authoritative navigation already accepted the dry trail.

Ordinary species use primary progression bands 1–4, 5–9, 10–14 and 15–20.
Displayed map bounds remain truthful about transitional wildlife and the
unchanged level-22 marsh dancer: 1–5, 3–9, 5–14 and 15–22. Hunting signs derive
actual roster bounds after night coverage. Twenty-one ordinary species are
adjusted, while 43 boss, elite or above-20 records are byte-equivalent to the
baseline. Species IDs, behavior and loot stay compatible with existing
quests; level-1 prey and level-5 class-introduction targets remain available.
The rationale and bounded basic-attack estimates are in
`docs/world/LEVEL_PROGRESSION.md` and `src/rules/README.md`.

Regression coverage includes route samples, corridor edges, water/decks,
outside-route collision, real World pathfinding in both directions, complete
ordinary level 1–20 coverage, protected-roster provenance, truthful hunt signs,
quest targets and beginner pocket/night availability. Browser walking evidence
must distinguish simulated frames from wall time: software WebGL rendering
can run slowly in a headless browser. A screenshot alone does not prove that
the controller reaches the gateway.

Actual loaded-Game walking checks passed with zero JavaScript errors. The
click-walk controller advanced 600 actual `Game.frame` calls at 1/60 second
with drawing disabled, arriving at (10.91, -433.88), within 0.15 metres of
the trail goal; the destination cleared and the player stayed alive at
218 HP. Separately, trusted Playwright W+D keydown followed by twenty actual
1/60-second frames moved the player 1.4000 metres from the bridge landing
onto standable trail ground. These are fixed-step controller checks, not a
claim that headless wall-time movement runs at 60 FPS. Real World pathfinding
and clear-line probes pass forward and reverse; an off-trail tree, stream
and visible water fringe remain blocked, while the bridge deck stays usable.

Final verification: 841 tests total, 839 passed, zero failed and two existing
optional skips. The production build passed with 302 modules and the existing
bundle-size warning. The initial full run's only failure was a stale collision
source hash after map metadata changed; re-export and a clean full rerun
resolved it. Final visual review approved style 8.5, readability 8 and
technical 8.5. Camera-matched captures and walking receipts are committed in
`docs/art/route-level-progression/review/`.

Known limits: other low dry depressions are outside this targeted exception.
Combat estimates omit special attacks, skills, travel and party competition;
they are not a measured natural leveling curve. This task does not change
boss balance, add scenery or deploy production automatically.
