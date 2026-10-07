# Dynamic HUD — October 2026

## Result

The gameplay HUD uses dark jade glass, warm brass edges and clearer resource
bars, preserving the Thai fantasy direction in `ART_BIBLE.md`. The player frame
shows HP, SP, a live activity state and the character's actual gold. Damage leaves
a short delayed trail; level gains light the portrait. The action tray responds
to hover/casts and briefly highlights a skill when its real cooldown finishes.

Party travel options open through a small disclosure button. Return-to-city and
PK remain directly available. The toolbar follows the minimap's measured size;
the quest tracker sits below it. Party frames clear the player footer on compact
screens. Mobile chat collapses to its header and opens for reading/typing.

Motion is driven by gameplay changes rather than continuous decorative loops.
The operating system's reduced-motion preference disables animation and
transitions. Keyboard focus is visible; resource bars have accessible values.
Modern and classic skins remain available.

## Changed files

- `src/ui/DynamicHUD.js`: resource effects, live status, cooldown completion,
  accessible values and responsive anchoring.
- `src/ui/dynamic-hud.css`: HUD appearance, interaction states and compact layouts.
- `src/net/Multiplayer.js`: creates and updates the presentation component.
- `src/main.js`: loads the HUD stylesheet after the existing skins.
- This review records visual and technical validation.

## Validation

- `npm run build`: passes; the existing Vite bundle-size warning remains.
- `npm test`: 297 pass, no failures. Gameplay rules and server files are unchanged.
- Browser QA with a real local server: connects, accepts a party invitation,
  opens party options and responds to combat state without page errors.
- Presentation damage and a cooldown transition were simulated in the browser
  to check the HP trail, combat badge and ready animation. These are visual
  checks, not new combat mechanics; the cooldown controller was restored.
- Inspected screenshots: desktop 1440×900, landscape 844×390, portrait 390×844
  and classic skin. No horizontal overflow; reduced-motion transitions are 0s.
- Screenshots and browser results are local ignored artifacts in
  `artifacts/dynamic-hud/`: `desktop.png`, `party.png`, `combat.png`, `mobile.png`,
  `portrait.png`, `classic.png`, `results.json`.

Local Art/Tech review: restrained Thai-fantasy styling, visible status/controls,
clear gameplay centre and compatibility with the existing modular HUD.
Self-assessed against the Art Bible gate: style 8/10, readability 8/10,
technical usability 8/10.

## Limitations

Mobile checks use browser viewports, not a physical touch device. HP/SP and state
effects sample the current game state at up to 10 Hz. Mobile chat history is
visible when its header is opened. No push or hosted deployment is included.
