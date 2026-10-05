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
