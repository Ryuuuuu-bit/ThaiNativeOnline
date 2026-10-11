# Readiness loading

Startup waits for five readiness stages: current map and approved NPC/body sources, character/HUD, selected class avatar, visible interface images and fonts, and shader compilation plus the first usable render. The displayed percentage is completed stages, not downloaded bytes. Readiness tasks have finite timeouts. Optional online connection and audio do not block Guest entry.

Dormant monsters do not create a CombatView or request a model at startup. A live spawn creates its view; destination preparation warms only the current phase's body types. Optional boss animation packs keep their existing on-demand loading.

Startup failure keeps the overlay visible and offers Retry by reloading the page, preserving the saved character. Map travel uses a separate two-stage overlay, retains the previous world until render succeeds, and offers Retry or Back on failure. Pending/rejected destination cache entries are invalidated for explicit Retry; fulfilled sources remain shared. Attempt-scoped UI handles ignore late completions and stale hide timers.

Implementation: src/core/AssetReadiness.js, src/ui/LoadingScreen.js, src/core/Game.js, src/world/MapManager.js, src/world/MapTransition.js and src/world/MapCommit.js. Loading input gates remain separate from menu/action gates so menu walking is preserved.

Validation and screenshots: docs/technical/qa/loading.md and docs/art/reviews/loading/. Generated server collision source hash was refreshed because world modules changed; the geometry of all 14 maps is unchanged (local receipt artifacts/loading-collision-refresh.json).

This improves entry behavior and defers unused client model requests. It does not establish a measured server memory reduction or preload the entire game. Optional network/reconnect behavior, production Railway deployment and physical devices require separate checks.
