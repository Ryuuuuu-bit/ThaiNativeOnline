# Unified entrance identity and loading

All entry pages use `src/ui/Brand.js` for the existing lotus/flame crest and the
same THAI NATIVE / ONLINE wordmark: login/register, character selection, creation,
game header (where the current HUD skin shows it), startup loading and map travel.
Sizes adapt by context; the identity and typography remain consistent.

Loading reuses the shipped royal-dawn illustration with jade glass, brass lines,
a restrained scene drift and an indeterminate indicator. It preserves actual
world progress messages and map names; it does not invent completion percentages.
Account screens hide the underlying loader to avoid text bleeding through their
translucent panels. WebGL error messages remain visible. Reduced-motion mode
disables the decorative animation and loader transitions.

Changed files: Brand.js, brand.css, main.js, index.html, account/screens.js,
character/ui/CreationScreen.js and world/MapManager.js. The world source hash
changed, so server/data/collision.json was regenerated with unchanged geometry.

Validation: 303 tests pass; production build and diff checks pass. Browser QA
covered desktop 1440x900 and mobile 390x844, guest login to select to creation,
startup loading, map loading text and reduced motion. No page errors or horizontal
overflow were observed. Local screenshots are in artifacts/brand-*.png.

Local art review: consistent crest and typography, readable mobile loading panel,
existing Thai fantasy illustration and no new raster assets or dependencies.
Physical-device QA and independent Art Director review remain pending. The
existing production bundle-size warning remains. No deployment in this task.
