# Quest touch placement stability technical review

Reviewed source: `0ecb6a2af8a301e7e2ff0302308e1325d854b51b` on
`codex/quest-touch-stability`, based on deployed main `1555dc75`.

Decision: **TECH APPROVED**, subject to the candidate's native event-target,
protected-layout, build and Art gates. No source blocker found. Director changed
only this review document; gameplay engineering owns application source and
tests, QA owns native input/geometry evidence, and Art owns visual acceptance.

## Bounded correction

Readability and stable input targets align with the orthographic game vision.
The existing 138px touch objective/Stop chip now keeps its last visible anchor
while the complete 138×50 CSS-pixel box is finite, inside the viewport's
12px margins and at least 4px clear of every currently measured valid obstacle.
An invaded or invalid anchor immediately uses the existing safe edge search;
no safe gap hides the chip and retains journal access. The same safety predicate
also applies to fresh candidate anchors.

The DOM-free cache stores only top/right, keyed by viewport width, height and
touch mode. A dimension/mode change clears it before placement. Explicit hidden
results, covered/untracked UI, missing minimap and absent objectives clear the
transient anchor. Each remembered result is revalidated against current geometry
before reuse. No persistent save state or coordinate lock is introduced.
This avoids moving a clear tap target merely to choose a nearer gap; it does not
guarantee that the same coordinates remain available when an obstacle invades.

Desktop ignores the prior touch anchor and retains its existing full/compact
logic. The change has no navigation, path, quest, combat, server authority, rules,
reward or asset-design modifications. Unsafe placement remains allowed to move
or hide; stability must never pin a button over controls or painted world labels.

## Evidence and release gate

The deployed live smoke had 24 passing checks, but an extra delayed touch probe
landed on CANVAS after a prior hit check and canceled navigation through world
input. A subsequent actual tap hit a Stop descendant and succeeded. The exact
chip geometry at the failed event was not captured, so source inspection does
not establish the miss's cause or prove that this correction removes every miss.

Gameplay engineer reports **14 passed, 0 failed** targeted geometry/cache tests.
Review inspected safe-anchor retention under moving clear obstacles, invasion
and 4px clearance, invalid/out-of-bounds anchors, fully blocked fallback,
desktop independence, resize/mode reset and visible-only cache behavior.
Director ran no tests or build and claims no independent runtime result.

QA's candidate gate must record actual pointer/touch targets on the chip or its
descendants, confirm the explicit Stop action canceled the route, and reject
CANVAS/manual-input cancellation as equivalent evidence. Delayed taps, orbit,
zoom and resize must also preserve current protected-rectangle clearance.
Native screenshots/event traces and exact targeted/build counts are recorded
in the independent QA report. A full suite is not required for this
small isolated geometry/cache change unless those checks reveal a broader
concern. No deployment is claimed by this review.

Root recorded the completed independent gates after source freeze: **37 targeted
tests passed, 0 failed, 0 skipped**; 355-module build passed in **542 ms**.
Four fresh portrait touch contexts passed **8/8 native Stop event deliveries**
to the button/descendants with action `stop`, **40 walking position samples**
with no recorded jump, **8/8 orbit/zoom clearance**, **4/4 resize checks** and
**6/6 journal availability**. No page errors were observed. Art approved style
9, readability 8.5 and technical usability 8.5 from the four fresh captures.
See [QA](../qa/quest-touch-stability.md) and
[Art](../../art/reviews/quest-touch-stability/ART_REVIEW.md). These bounded results
do not identify the precise earlier miss cause or guarantee all future taps.

Known limits: a currently safe anchor can become obstructed and must relocate or
hide. Recorded browser contexts are not certification of every dynamic frame,
physical handset, thumb gesture or future viewport/control combination.
