# Map boss icons — independent Art review

Reviewed 2026-10-09 on `codex/boss-motion-polish`, against [ART_BIBLE.md](../ART_BIBLE.md). This review is separate from the [boss body/motion review](ART_REVIEW.md).

**Final bounded verdict: desktop and touch PASS. Style 8.5/10, Readability 8.5/10, Technical Usability 8/10. No current P1/P2 blocker in the inspected scope.** The final content-sized selected sidebar resolves the earlier Walk clipping defect. The original 7.5/HOLD verdict remains preserved in [INITIAL_MAP_ART_REVIEW.md](INITIAL_MAP_ART_REVIEW.md) with its [original touch captures](maps/initial/mobile-wat_rang-selected.png). This current verdict supersedes that historical candidate after inspection of all nine replacement touch PNGs and the final containment/hit-test receipt.

## Inspected evidence

Thirteen current production-client images were visually inspected directly: the three unchanged Paddy images below, unchanged [desktop Klong atlas](maps/desktop-klong-atlas.png), and the nine final replacement atlas/selected/minimap images for touch Klong, Wat Rang and Demon Rift. All nine replacement touch images were independently re-inspected after the parent declared the final capture frozen. Desktop is 1440×900; touch is 390×844. This is a representative visual review, not inspection of every desktop map image.

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
| [mobile-klong-atlas.png](maps/mobile-klong-atlas.png) | `78ffd98187184a29980a70b19454f0611610e782f56d8c22ce02feeb7ba0caea` |
| [mobile-klong-selected.png](maps/mobile-klong-selected.png) | `ffbe2cb5ae2f7dea0df75100b55822e0ca57b71df954d805a2b8db756fd6d28a` |
| [mobile-klong-minimap.png](maps/mobile-klong-minimap.png) | `3894c987a11b131ddabbaa8bbd2504c773616ca65a13fe2ade8f64d5ad37864b` |
| [mobile-wat_rang-atlas.png](maps/mobile-wat_rang-atlas.png) | `4d2ac2df4f62f3bc3dbaff9fefd08e8382a491c2b82b51ffe0d6f3f9fbc5e02e` |
| [mobile-wat_rang-selected.png](maps/mobile-wat_rang-selected.png) | `4ecbdb7c07f0368a55f5856b8c7b7e4df17d8a37ba6bcc5879c6edc40a5947e1` |
| [mobile-wat_rang-minimap.png](maps/mobile-wat_rang-minimap.png) | `98017d2ecbb944725f7bebf1ee08d1038d9ae4b226a6271a7c1e644878cd23d8` |
| [mobile-demon_rift-atlas.png](maps/mobile-demon_rift-atlas.png) | `6ec1f2e8cf7de78f749858eaff13ba3fd3ae37b8c75d8b27308c1caa0f07f9cc` |
| [mobile-demon_rift-selected.png](maps/mobile-demon_rift-selected.png) | `35481e9d7a4d649e58e1f673f248a5a039814fb1d980ef44ec31bc66ac1e5580` |
| [mobile-demon_rift-minimap.png](maps/mobile-demon_rift-minimap.png) | `9ea93f1a15b1acfaa5f9967d907d8cda108094b21550c323560a3f39cb67aab3` |

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
| Technical usability | 8/10 — PASS | All three final selected cards fit inside the clipping sidebar. Every Walk button is fully visible at 44px height with lower padding; all supplied top/centre/bottom hit tests succeed. Selection remains separate from walking. |

Klong presents Tani's night-only availability alongside Chalawan's all-phase lair. Wat Rang keeps the nearby Krasue and Pu Som badges/name boxes separate, while the list distinguishes night-only Krasue. These are useful rare-lair witnesses; neither implies that a monster is currently alive. The selected state adds a visible highlight and repeats the identity before the explicit Walk action.

The tiny mobile minimap crops retain recognizable crown, player and portal silhouettes. Names are not reliably legible at this compact size; identity is carried by the expanded atlas/list. This is a known compact-view limitation, not a claim of mobile minimap text readability equal to desktop.

## Closed historical P2 — complete touch Walk target restored

The archived initial Wat Rang/Rift images clipped the button bottom: its rectangle ended at y=812, the sidebar at y=810, and the card at y=823. That was a real defect; neither the original score nor the original evidence is discarded. The original viewport-only checks did not measure clipping ancestors.

Current [world-map.css:90](../../../src/ui/world-map.css:90) sizes the selected portrait sidebar from its content and gives the map the remaining space. The adjacent rules remove the unused place list and place the card directly after the tabs. Reviewer observed final CSS SHA-256 `46c24cb50dbfd1c406a7b859a593145a1f8a519c46631e918009efe8e30a189b`; this is a current file pin, not an embedded CSS hash in the capture receipt.

The final images visibly retain both lines of the longer detail, the distance hint and the entire gold Walk rectangle. The [final touch receipt](maps/touch-qa.json) records:

| Map | Sidebar y range | Card y range | Walk y range / height | Top / centre / bottom hits |
| --- | --- | --- | --- | --- |
| Klong | 586.8125–810 | 634.8125–810 | 755–799 / 44px | true / true / true |
| Wat Rang | 571–810 | 619–810 | 755–799 / 44px | true / true / true |
| Demon Rift | 571–810 | 619–810 | 755–799 / 44px | true / true / true |

All cards and buttons also remain horizontally within their sidebars. Each Walk button ends 11px above the clipping edge. The supplied `elementFromPoint` checks establish exposed top/centre/bottom action samples, supplementing the visible complete border and rectangle containment. This closes the specific P2 without reducing the 44px target or removing the status caveat.

## Bounded source and validation

- [mapDirectory.js](../../../src/ui/mapDirectory.js:18) derives lairs from boss-area data; [lines 30–36](../../../src/ui/mapDirectory.js:30) build phase/channel information and the spawn-status caveat.
- [WorldMapPanel.js](../../../src/ui/WorldMapPanel.js:20) invokes walking from the explicit Walk button; [selection](../../../src/ui/WorldMapPanel.js:33) focuses and refreshes the card without invoking that action.
- [glyphs.js](../../../src/ui/minimap/glyphs.js:17) defines the pointed crown; [badge styling](../../../src/ui/minimap/glyphs.js:50) supplies red/gold contrast. The [legend](../../../src/ui/minimap/mapStyle.js:208) describes a lair rather than a spawn-status indicator.
- [Original browser receipt](maps/browser-qa.json), timestamp `2026-10-09T15:58:06.862Z`, SHA-256 `41747c8e6f9b1ed97e25eea9ba741995aae4eb9445e076ae7669d26581e30993`, retains all thirteen desktop map loads and the initial touch rows. Desktop directory totals fourteen current-map lairs, including Tani and Krasue; safe city has zero. It reports zero errors, no document overflow and selection without player movement or a destination. Its initial touch layout findings are historical and superseded by the next receipt.
- [Final touch receipt](maps/touch-qa.json), timestamp `2026-10-09T16:06:50.817Z`, SHA-256 `73e315fa310bdf46bdd0fccae49dfca8f50064c70b52394699edd751b5c70bc6`, covers all three final touch maps. It reports coarse-pointer/touch emulation, zero errors, no document overflow, unchanged player position/no destination on selection, sidebar/card containment and all nine action hit-test samples passing. These are supplied browser results, not a reviewer rerun.
- The capture helper draws minimap lairs using an empty live-monster array and a synthetic nearby minimap position. That validates persistent icon presentation without claiming natural player proximity or server availability. The rare/boss distinction follows the spawn-area roster rather than only the primary boss registry.
- Reviewer previously ran `npm run build`: PASS, 251 modules, existing large-chunk warning. Parent reports the full suite 648/648 with no skips and a final post-CSS build PASS, 251 modules. No additional test, build or capture was run by the reviewer for this closure.

## Limits and handoff

Desktop Paddy/Klong and the three final touch maps are visually reviewed; all thirteen desktop map loads are covered by the supplied receipt. No live CH1 encounter, successful walking route, collision safety, natural clock, landscape touch layout, keyboard/screen-reader audit or physical-device FPS is certified here. No blocker is inferred for those untested scopes. No current acceptance blocker remains within this bounded map presentation review.

Changed file: `MAP_ART_REVIEW.md` only for this final request. No UI, gameplay, model or capture files changed. The accepted body-review receipt fixes remain untouched. No browser or Blender session was launched.
