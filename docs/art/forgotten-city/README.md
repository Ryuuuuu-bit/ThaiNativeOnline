# Forgotten city naming

The playable safe city is now **นครที่ถูกลืมเลือน**. Updated names cover the map registry, region subtitles, minimap/atlas and browser title, loading screen, character selection, warp service, NPC dialogue, landmarks (including the associated old cemetery), and displayed music mood titles. Current world docs and review-page labels use the same name.

Changed files: root `README.md`, `index.html`; `src/world/maps.js`, city/world comments and README; `src/data/regions.js`, `landmarks.js`, `npcs.js`, `warpServices.js`, `calmMusic.js`, halls/spawns comments; `src/ui/Brand.js`, `HUD.js`, `WarpPanel.js`; `src/account/screens.js`; `src/core/Game.js`; `docs/world/WORLD_MAP.md`; relevant location/paddy/NPC preview labels.

The map key remains `city`, so existing save positions, portals and server map/channel identities continue to resolve. Historical architectural references and original legacy data provenance are unchanged.

Validation and screenshots: see `verification.json` in this directory for isolated UI checks. 48/48 focused tests passed; production build passed (324 modules, existing bundle-size advisory). Six browser checks passed at 1366×768 and 390×844 with zero errors, including full text bounds in HUD/minimap, atlas and loading. No model, texture or map geometry change. No production deployment in this task.
