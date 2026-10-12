# Forgotten City — architecture and living atmosphere

This is implemented production scenery for **นครที่ถูกลืมเลือน**, extending the
compact town on `codex/compact-city-production`. It is not an AI concept render.

## Changes

- Temple: three roof tiers, gilded gables and swept ornaments, colonnades,
  lacquered doors, naga stairs and a lower ceremonial entrance. The 17.1 m
  temple and 14.8 m bell-shaped chedi remain in the existing solid reservations.
- Nature: coherent slow crown sway and lighter leaf/awning motion, with matching
  shadow deformation. Warm sun and cooler ambient fill separate shaded porches.
- Waterfront: one opaque animated water draw, shore and mooring ripples, gentle
  rocking of two existing craft. The working sampan now sits beside the pier.
  The central lotus fountain shares the animated water controller.
- Residents: keep 60 people and all functional NPC identities. Nineteen ambient
  residents gain daytime shopping, carrying, conversation, prayer and upkeep
  routines. Local collision-clear links avoid unnecessary trips via the plaza.
- Music: original soft-key, flute, string and wooden-bar arrangement with a
  32-bar call/response structure for four town moods. Quiet shore wash, market
  ticks and a temple bell respond to player location through the ambience bus.

## Ownership and cost

No paid generation jobs or new third-party asset downloads were used. Geometry,
shader additions and synthesized music are authored in the project; architecture
reuses its existing materials. Blender is a free option for later hand-modeling,
but this revision is implemented directly in Three.js. No Stardew Valley music
or Ragnarok Origin assets are included.

## Main files

- `src/world/compact-city-render/buildCityTemple.js`, `buildCityWater.js`,
  `cityFoliageWind.js`: new modular geometry/material controllers.
- `buildCityArt.js`, `buildCityMarket.js`, `buildCityLandscape.js` and
  `src/world/Environment.js`: integration, ownership, boats, light and foliage.
- `src/data/compactCityNpcs.js`, `src/npc/NPCPresentationActivity.js`,
  `NPCManager.js`, `NavGraph.js`: resident plans and local paths.
- `src/audio/CozyVoices.js`, `CalmMusic.js`, `citySoundscape.js`,
  `src/data/calmMusic.js`, `src/core/AudioAmbience.js`, `Game.js`: music/ambience.

## Evidence and limits

### Production images and motion

- [Temple quarter](temple-complex.jpg), [market square](plaza.jpg),
  [waterfront](waterfront.jpg) and [whole town](overview.jpg): production geometry
  in the review camera, without the gameplay HUD.
- Actual Game at the normal zoom: [day](production-day.png),
  [night](production-night.png), [temple entrance](production-temple.png) and
  [waterfront](production-waterfront.png).
- Twelve-second animated examples: [market](market-motion.webp),
  [temple](temple-motion.webp) and [waterfront](waterfront-motion.webp).
- Forty-second music excerpts: [warm town theme](calm_river-preview.wav) and
  [market theme](calm_market-preview.wav).

### Validation

- Final full test suite: **1,397 passed, 0 failed, 2 existing skips** (1,399 total).
  `npm run build` passed with 374 modules; the existing large-bundle warning remains.
- Actual guest/Game smoke passed creation, movement, dummy combat, save/reload,
  atlas open/close and service contacts, with 24 captures and no browser errors.
  Client/server collision agreed at 19,257 sampled positions.
- Three final motion sequences produced 144 frames without browser errors.
  Location ambience weights resolve to market 0.8, temple 1 and river 0.9167 at
  the respective capture points. Movement counts include nearby residents and
  are not an on-screen population count. See [game report](game-review.json) and
  [motion report](motion-review.json).
- Fresh collision export matches the source hash. All 14 map objects, including
  the city's 47 shapes, remain identical to the pre-atmosphere commit `21e1b64`.
  See [collision comparison](collision-review.json).
- Ten production music profiles rendered and played without clipping or browser
  errors; mute and stop worked. The four cozy profiles use the new 32-bar score.
  See [audio measurements](audio-review.json).
- Final art review: approved; style 8/10, readability 8/10, Thai identity 9/10,
  technical usability 8/10. See [review scope and limitations](ART_REVIEW.md).

### Limits

The preview WAVs are 40-second faded mono excerpts rendered from the production score;
runtime music is stereo and continuously scheduled. Numeric audio validation
checks clipping, continuity, mute and replacement, not subjective listening.

Motion sequences use actual Game updates in fixed 1/60-second simulation steps.
They demonstrate deformation, resident movement and moored craft motion; their
encoded frame rate is not a hardware performance measurement. Water uses
analytic shading, not a fluid simulation or screen-space reflections. Existing
navigation and collision continue to use static geometry. No live deployment
is part of this revision.
