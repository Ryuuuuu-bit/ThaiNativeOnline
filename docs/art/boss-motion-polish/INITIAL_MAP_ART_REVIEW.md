# Map boss icons — independent Art review

Reviewed 2026-10-09 on `codex/boss-motion-polish`, against [ART_BIBLE.md](../ART_BIBLE.md). This review is separate from the [boss body/motion review](ART_REVIEW.md).

**Final bounded verdict: desktop PASS; touch Style/Readability PASS, Technical Usability HOLD for one confirmed P2.** The current desktop and touch art is coherent and the boss identities read clearly. Wat Rang and Demon Rift touch selected cards clip the bottom of the Walk button; the existing viewport checks do not close this ancestor-containment defect. No P1 was found. No further captures or input are awaited for this verdict.

## Inspected evidence

Thirteen actual production-client images were visually inspected directly: the three Paddy images below, [desktop Klong atlas](maps/desktop-klong-atlas.png), and atlas/selected/minimap images for each of touch Klong, Wat Rang and Demon Rift. Desktop is 1440×900; touch is 390×844. This is a representative visual review, not inspection of every desktop map image.

| Image | Scope | File modification time, UTC | SHA-256 |
| --- | --- | --- | --- |
| [desktop-paddy-selected.png](maps/desktop-paddy-selected.png) | 1440×900 desktop; boss filter and selected card | 2026-10-09T15:56:10.1418537Z | `0c7e193e5b53b5b6bdaa1157992a353c9ddb881e1d9c1edf7a23b8dc7ced670f` |
| [desktop-paddy-atlas.png](maps/desktop-paddy-atlas.png) | Desktop atlas before selection | 2026-10-09T15:56:08.3432593Z | `f95c8a36b6d60fde25e75b28432adf1fd264ed2a6c4c7c8ba8ab0ea5aae9f2f9` |
| [desktop-paddy-minimap.png](maps/desktop-paddy-minimap.png) | Cropped production minimap | 2026-10-09T15:56:11.3876342Z | `62c71ba0f12bd1d64eda1a4d872f04995a0d1ef98084810baf6cc623e5026caf` |

These are file times, not an independently established server encounter timestamp. The inspected capture helper uses a guest fixture, disconnects the game network and traverses maps locally. The CH1 text is an eligibility explanation; these screenshots do not prove an online boss is alive, a natural clock phase or a successful walk.

Additional inspected PNG pins, rechecked against the frozen files:

| Image | SHA-256 |
| --- | --- |
| [desktop-klong-atlas.png](maps/desktop-klong-atlas.png) | `a01c89d8229c7ea9272e2b4a8c620fc3f81931fd9296ff2c34ffcbb3fcdcc9ca` |
| [mobile-klong-atlas.png](maps/initial/mobile-klong-atlas.png) | `876ea7ba87cfde02a15c2f38d6a62d1986ddc3ffa5882d83247eb8d31384aab4` |
| [mobile-klong-selected.png](maps/initial/mobile-klong-selected.png) | `aa9501546fff924c1f64ab1f1fecb86f8f1cdcfb55ea14ee9a4fb6d96aff49ce` |
| [mobile-klong-minimap.png](maps/initial/mobile-klong-minimap.png) | `542d11e0096060e54626ccebfd2a8b98c08e6f57e6a74d2d89ba16e3d5f01a24` |
| [mobile-wat_rang-atlas.png](maps/initial/mobile-wat_rang-atlas.png) | `abf043796d042674fed8eae31d8a91c2b0e153963f456dcc893d97cc0e5e0a59` |
| [mobile-wat_rang-selected.png](maps/initial/mobile-wat_rang-selected.png) | `1566fc6545876a29c6e2614bd57911185a5d113ee3b2c6873bf143222d17fed5` |
| [mobile-wat_rang-minimap.png](maps/initial/mobile-wat_rang-minimap.png) | `f430e35e33371a90c2a1a96549591d644e6e7928f9fb2aab542242b565df6f85` |
| [mobile-demon_rift-atlas.png](maps/initial/mobile-demon_rift-atlas.png) | `904861732f1b33bd196b83922e495cd5fe5512827390901f0a8fd3845e6beaf4` |
| [mobile-demon_rift-selected.png](maps/initial/mobile-demon_rift-selected.png) | `73f3850e9b46d8094844004dafd74313241d536d7a39551ac319eff728cd485f` |
| [mobile-demon_rift-minimap.png](maps/initial/mobile-demon_rift-minimap.png) | `af3ea51418f754357295bc2a90b04dd1941fc224d20ff29d9c72e05a091ed8fe` |

## Desktop grades and findings

| Criterion | Score | Basis |
| --- | --- | --- |
| Style | 8.5/10 | Jade panel, restrained brass/gold borders and parchment geography remain coherent. The pointed crown adds a readable fantasy hierarchy without covering the map in decoration. |
| Readability | 8.5/10 | Red/gold boss badge separates from ordinary red monster dots and gold route signs. `ควายป่า · Lv 4` remains readable in both atlas and minimap. The selected card repeats identity, phase availability, CH1 restriction and the explicit spawn-status caveat. |
| Technical usability, visible/source scope | 8/10 | Panel, label, list and selected card fit the inspected desktop frames. Clear and Walk occupy separate space; the gold Walk action visibly has room for its label. Source and the supplied browser receipt separate selecting a place from invoking walking. |

The map's Lv 1–3 range and the individual boss's Lv 4 label remain distinct. The 142 วา list distance is clarified as straight-line distance in the selected card. The crown/name do not obscure the visible player arrow, nearby route sign or the Paddy roads. The minimap crop retains the complete badge and name with space around them.

The selected Paddy card says the lair is available every phase, online only in CH1, and does not confirm a currently spawned boss. This prevents a persistent lair marker from implying a live target.

## Touch grades and findings

| Criterion | Score | Basis |
| --- | --- | --- |
| Style | 8.5/10 | The portrait layout retains the jade, parchment and restrained red/gold hierarchy. The crown remains distinct from ordinary monster dots and gold portals. |
| Readability | 8.5/10 | Tani/Chalawan and Krasue/Pu Som have separate, legible names and levels. Rift's long Lv 100 name fits. Supporting text correctly wraps and preserves the CH1/live-status caveat. |
| Technical usability | 7.5/10 — HOLD | Klong's selected card and complete 44px Walk action fit. Wat Rang and Rift clip the lower edge of Walk inside the sidebar; see the single P2 below. |

Klong presents Tani's night-only availability alongside Chalawan's all-phase lair. Wat Rang keeps the nearby Krasue and Pu Som badges/name boxes separate, while the list distinguishes night-only Krasue. These are useful rare-lair witnesses; neither implies that a monster is currently alive. The selected state adds a visible highlight and repeats the identity before the explicit Walk action.

The tiny mobile minimap crops retain recognizable crown, player and portal silhouettes. Names are not reliably legible at this compact size; identity is carried by the expanded atlas/list. This is a known compact-view limitation, not a claim of mobile minimap text readability equal to desktop.

## Confirmed P2 — touch selected card clips Walk

In [mobile Wat Rang selected](maps/initial/mobile-wat_rang-selected.png) and [mobile Rift selected](maps/initial/mobile-demon_rift-selected.png), the long detail wraps to two lines. The sidebar's visible lower boundary is approximately y=810; the Walk rectangle extends from y=768 to y=812. Its lower border is visibly cut off. The receipt records each card extending to y=823, beyond that sidebar boundary, while Klong's button ends at y=799 and remains fully visible.

[world-map.css:22](../../../src/ui/world-map.css:22) clips the sidebar with `overflow:hidden`. The [portrait grid](../../../src/ui/world-map.css:75) allocates a fixed share of the body to that sidebar, while the [selected card](../../../src/ui/world-map.css:79) must fit its wrapped text and 44px action. The supplied assertions check the button's nominal height and containment in the viewport; they do not check intersection with this clipping ancestor. Thus zero document overflow and nominal height 44 do not prove the entire touch target is exposed.

Concrete fix: allocate enough selected-sidebar height for the complete card, reducing the map row slightly when necessary, or adjust the selected grid spacing while retaining the complete text and 44px button. Validate the card/button against the clipping sidebar, including its bottom padding, rather than only against the viewport. This finding needs no model, boss, spawn or navigation change.

## Bounded source and validation

- [mapDirectory.js](../../../src/ui/mapDirectory.js:18) derives lairs from boss-area data; [lines 30–36](../../../src/ui/mapDirectory.js:30) build phase/channel information and the spawn-status caveat.
- [WorldMapPanel.js](../../../src/ui/WorldMapPanel.js:20) invokes walking from the explicit Walk button; [selection](../../../src/ui/WorldMapPanel.js:33) focuses and refreshes the card without invoking that action.
- [glyphs.js](../../../src/ui/minimap/glyphs.js:17) defines the pointed crown; [badge styling](../../../src/ui/minimap/glyphs.js:50) supplies red/gold contrast. The [legend](../../../src/ui/minimap/mapStyle.js:208) describes a lair rather than a spawn-status indicator.
- [Final browser receipt](maps/browser-qa.json), timestamp `2026-10-09T15:58:06.862Z`, SHA-256 `41747c8e6f9b1ed97e25eea9ba741995aae4eb9445e076ae7669d26581e30993`, contains 16 rows: all thirteen maps on desktop plus touch Klong/Wat Rang/Rift. It reports zero errors, no document overflow, coarse-pointer/touch emulation, 44px nominal Walk height, and selection without player movement or a destination. Desktop directory totals fourteen current-map lairs, including Tani and Krasue; safe city has zero. These are supplied browser results, not a reviewer rerun.
- The capture helper draws minimap lairs using an empty live-monster array and a synthetic nearby minimap position. That validates persistent icon presentation without claiming natural player proximity or server availability. The rare/boss distinction follows the spawn-area roster rather than only the primary boss registry.
- Reviewer previously ran `npm run build`: PASS, 251 modules, existing large-chunk warning. Parent reports the final full suite 648/648 with no skips and build PASS. No additional test or build was run for this finalization.

## Limits and handoff

Desktop Paddy/Klong and the three supplied touch maps are visually reviewed; all thirteen desktop map loads are covered by the supplied receipt. No live CH1 encounter, successful walking route, collision safety, natural clock, landscape touch layout, keyboard/screen-reader audit or physical-device FPS is certified here. No blocker is inferred for those untested scopes. The only current acceptance blocker is the concrete P2 above.

Changed file: `MAP_ART_REVIEW.md` only for this final request. No UI, gameplay, model or capture files changed. The accepted body-review receipt fixes remain untouched. No browser or Blender session was launched.
