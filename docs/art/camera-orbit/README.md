# Right mouse camera orbit

Hold the right mouse button and drag horizontally to rotate around the player. Camera height and orbit radius remain fixed, preserving the game's orthographic 2.5D framing. Shift + right drag retains the previous ground pan; R and the reset button restore the initial heading, recenter and reset zoom.

Heading updates the movement basis and canopy fade direction. Ground picking and the minimap viewport use the rotated camera. Walking recenters a panned view while retaining the chosen heading.

## Changed files

- `src/core/CameraController.js`: yaw orbit, basis/fade updates, heading reset.
- `src/core/InputManager.js`: drag ownership, pointer capture, cancellation and Shift mode.
- `src/core/Game.js`: orbit/pan routing and shared reset action.
- `index.html`: updated controls hints.
- `tests/camera-orbit.test.js`, `tools/camera-orbit-qa.mjs`: geometry and browser regression checks.
- This directory: before/rotated screenshots and browser receipt.

## Validation

- Three focused tests pass: pitch/radius, movement basis, fade direction, ground center picking, finite minimap footprint, recenter and reset, HUD scaling.
- `npm run build` passes (existing bundle-size warning).
- One headless Edge instance, closed after QA; local guest fixture with network sockets blocked.
- Actual mouse right drag changes heading without moving the player or emitting a walk click. Release stops orbit. Shift-pan preserves heading. R restores heading and pan, including while holding either drag mode. Blur and lost capture cancel dragging. HUD right drag does not rotate the world. No browser page errors.
- Specialist Art/Tech review identified the held-drag reset issue; cancellation was added before reset.

## Limitations

Desktop mouse behavior is tested at 1366×768. Touch rotation is not introduced. Extreme cursor speeds, every canopy position and live multiplayer gameplay have not been separately exercised. This branch has not been deployed.
