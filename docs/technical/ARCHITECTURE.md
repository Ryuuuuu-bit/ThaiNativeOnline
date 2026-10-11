# Architecture Direction

Current stack: Three.js + Vite.

Recommended growth:
`src/core`
`src/world`
`src/player`
`src/entities`
`src/rendering`
`src/systems`
`src/ui`

Keep rendering, gameplay state, data, and UI concerns separated.
Do not hardcode large content tables inside rendering code.
Prefer data-driven definitions for future classes, mobs, items, and maps.

Legacy ThaiNative server logic may be studied later, but should not be copied blindly into the new client architecture.

Main Menu and the hotbar editor allow keyboard/ground walking while open. `Game.movementModalOpen` gates movement; `gameplayActionsBlocked` also protects editing from combat/action shortcuts. `src/ui/nonmodalKeys.js` passes only movement keys from non-text controls. True service dialogs retain their movement guards. Hotbar assignments and clearing keep the editor open and persist through Character saves; see `docs/technical/qa/menu-hotbar-edit.md`.
