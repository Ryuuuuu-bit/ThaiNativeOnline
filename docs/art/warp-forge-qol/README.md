# Player QoL services — 2026-10-09

## Result

Eight connected features on `codex/player-qol-services`, based on main
`2a2a9efdc8e8812f38ab26233b0bc19f0ec27c44`:

- Eighteen warp keepers across thirteen maps, including six city stops. Free,
  explicit destination confirmation, low-level warning, public atlas entries.
- Account-shared warehouse: 120 slots, six city counters, deposit all unlocked
  materials, per-instance cards/refinement/locks preserved, durable retry receipts.
- Item locks protecting sale, exchange, refinement and card removal.
- Three named equipment/learned-hotbar-order presets; missing gear rejects the
  whole swap, no skill points or free equipment granted.
- Twelve lessons through six existing class masters: actual combat drills,
  two-skill combos, bounded permanent class rewards, authoritative completion.
- Party recruitment board with map/level/role filtering and two-sided consent.
- Monster journal from actual spawning and loot tables, boss skills and route
  selection in the atlas.
- Stronger refinement scaling and before/after bonuses, +4/+7/+10 milestones,
  explicit destruction risk, confirmed result feedback and reconnect recovery.

QA found and fixed card-return space/weight accounting, stale warehouse
acknowledgements, recovery after reload/sign-in, and intermediate inventory
notifications that could sort the bag midway through refinement. Mobile panels
retain their real button sizes instead of inheriting HUD scaling.

## Changed files

Shared rules: `src/data/{warpServices,stash,bestiary,quests,npcs}.js`,
`src/character/itemState.js`, `src/character/data/{refine,masteries}.js`.

Server: `server/{index,accounts,store,stash,service-warp,progress,combatants,
class-quests,parties,party-board,trades}.js`.

Client: `src/core/Game.js`, `src/character/{Character,bag}.js`,
`src/character/ui/{CharacterUI.js,character.css}`, `src/quest/{QuestSystem,
questPresentation}.js`, `src/net/{Multiplayer,NetProgress,PvpPanel,Social,
SocialPanes}.js`, `src/net/social.css`, `src/npc/NPCData.js`, `index.html`.

Panels and navigation: `src/ui/{WarpPanel,StoragePanel,BestiaryPanel,QuestUI,
ShopPanel,ActionBar,HUD,TouchControls,Minimap,mapDirectory}.js`,
`src/ui/{warp,storage,player-guide,quests,shop}.css`,
`src/ui/minimap/{glyphs,mapStyle}.js`.

Tests: new bestiary, class quests, item-lock/loadouts, party-board, refinement,
service-warp, stash and storage UI tests, including production HTTP/WebSocket
integration; updated `tests/{refine,world-map}.test.js`.
Contracts: `docs/technical/PLAYER_QOL.md`, `docs/world/CLASS_QUESTS.md`.

## Validation

- Full `npm test`: **577 passed, 0 failed, 0 skipped**.
- `npm run build`: **passed, 250 modules**. Existing large-bundle warning remains.
- Final read-only Tech review: no remaining P1/P2 in the reviewed changes.
- `browser-qa.json`: eight responsive warp/atlas screenshots, two actual server
  travel receipts, all thirteen real maps loaded, eighteen NPC/arrival checks,
  no browser errors.
- `feature-qa.json`: **21 checks, no browser errors**. Real signed-in UI exercised
  deposit-all/withdrawal with locks, preset server application, bestiary routing,
  class-quest acceptance. Desktop 1440×900, portrait 390×844 and short landscape
  667×375; actions measured in rendered CSS pixels, panel bounds checked.
- One headless Edge browser and one page reused sequentially. No additional
  user browser tabs or Blender sessions created for this work.

## Art review

All categories meet the Art Bible's minimum of 8/10 in the reviewed states.
The specialist inspected all eighteen final feature captures plus the previously
reviewed warp/atlas captures; no confirmed P1/P2 remains.

| Panel | Style | Readability | Technical usability |
|---|---:|---:|---:|
| Warp / atlas | 9 | 8.5 | 8.5 |
| Warehouse | 8.5 | 8.5 | 8.5 |
| Monster journal | 8.5 | 8.5 | 8.5 |
| Presets | 8 | 8 | 8.5 |
| Party recruitment | 8 | 8 | 8.5 |
| Forge | 8.5 | 8.5 | 8.5 |
| Class lessons | 8 | 8 | 8 |

Short screens scroll for secondary details, rewards/actions and additional
presets. These captures do not establish populated-board or assistive-technology
behavior, nor certify runtime performance.

## Screenshots

| Feature | Desktop | Portrait mobile | Short landscape |
|---|---|---|---|
| Warp | [View](desktop-warp.png) | [View](mobile-warp.png) | [View](small-landscape-warp.png) |
| Public atlas | [View](desktop-world.png) | [View](mobile-world.png) | [View](small-landscape-world.png) |
| Warehouse | [View](desktop-storage.png) | [View](mobile-storage.png) | [View](small-landscape-storage.png) |
| Monster journal | [View](desktop-bestiary.png) | [View](mobile-bestiary.png) | [View](small-landscape-bestiary.png) |
| Equipment presets | [View](desktop-loadouts.png) | [View](mobile-loadouts.png) | [View](small-landscape-loadouts.png) |
| Party recruitment | [View](desktop-party.png) | [View](mobile-party.png) | [View](small-landscape-party.png) |
| Forge | [View](desktop-forge.png) | [View](mobile-forge.png) | [View](small-landscape-forge.png) |
| Class lessons | [View](desktop-class-quests.png) | [View](mobile-class-quests.png) | [View](small-landscape-class-quests.png) |

Landscape 844×390 warp/atlas captures are also included. These are actual game
captures using the low graphics setting and SwiftShader, not concept art.

## Known limits

Postgres transaction locking/commit/rollback have fake-client test coverage;
live database concurrency and restart recovery were not part of local QA.
Browser sizing is not physical-phone performance or touch testing. Recruitment
listings clear on restart. The warehouse requires a signed-in account. Pending
transfer recovery survives same-tab reload when sessionStorage is available;
closing the tab or clearing/denying that storage loses the client retry UUID.
Class integration verifies authentic server hits and seeded legitimate hand-ins,
not a complete natural playthrough for every class. Anonymous connected guests
lack the skill provenance needed for advanced combo proof; signed-in characters
and local offline guest drills use their respective verified paths.
Refinement economy still needs live playtesting.
