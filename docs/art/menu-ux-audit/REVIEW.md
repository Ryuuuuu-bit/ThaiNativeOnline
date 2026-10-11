# PC MMORPG menu suitability audit

Date: 2026-10-10. Baseline: `origin/main` at `c65073e`. Review branch: `codex/menu-ux-audit`.

## Decision

Keep the compact main menu, Thai fantasy visual language, combined equipment/inventory workspace, and contextual NPC services. Prioritize navigation consistency and keyboard behavior before adding more HUD icons. This is an audit and proposed design, not an implemented redesign.

The Game Vision and Art Bible favor gameplay readability and restrained Thai details. MMO references below inform information architecture and interaction; they do not override our visual authority.

## References and applicable principles

| Official reference | Observed principle | Application proposed for Thai Native Online |
|---|---|---|
| [FFXIV game manual](https://na.finalfantasyxiv.com/game_manual/view/) | Main menu separates Character, Logs, Travel, Party, Social, and System; quest objectives connect journal and map; HUD layout has dedicated configuration. | Make progression, quest review, party finding, and system settings easy to distinguish. A future HUD editor is useful, but optional after navigation defects are fixed. |
| [Ragnarok shortcut guide](https://ro.gnjoy.asia/gameguide/?gg=3) | Equipment, inventory, skills, party, and friends have explicit keyboard access. | Keep C/I/K/M/P shortcuts; display the real action for each key. Give party and friends direct menu destinations without needing to copy RO's exact key combinations. |
| [Guild Wars 2 wallet redesign](https://www.guildwars2.com/en/news/updating-your-wallet/) | This historical design case moved related currency information into inventory and used filtering to reduce unnecessary navigation. | Keep equipment and bag together; retain category filters, search, gold, and weight. Improve filter availability during long scrolling rather than splitting the workspace into more windows. |

These recommendations are our design assessment, not claims that the reference games implement identical systems or that every proposed feature exists here.

## Findings ordered by priority

P1 = address before expanding menus; P2 = usability improvement. Priorities express UX impact, not security severity.

| Priority | Current behavior / evidence | Recommended change |
|---|---|---|
| P1 | Social consumes key events without processing Esc (`src/net/Social.js:333`). Runtime: focusing its friend-name input and pressing Esc leaves the window visible. Other window handlers also suppress keys or use a fixed close priority. | Introduce one active-window close owner. Esc closes the foremost window, including from inputs; restore focus to its opener. Test overlapping windows separately. |
| P1 | AUTO menu tile shows G but opens configuration; G toggles automation (`index.html:100`, `src/core/Game.js:223`, `src/ui/ActionBar.js:153`). Settings tile shows Esc, although Esc closes windows rather than opening Settings. | Rename tile **ตั้งค่า AUTO**, remove its G badge. Keep G on the actual AUTO toggle. Remove Esc badge from Settings launch tile. |
| P1 | Quest tracker takes only three entries (`src/ui/QuestUI.js:40`). All active quests exist in `QuestSystem`, but there is no general quest menu action; details currently depend on NPC dialogue. | Add **สมุดเควสต์** with all accepted quests, objectives, rewards, turn-in NPC and map location. This requires new UI, not merely exposing a hidden existing panel. |
| P2 | A single Social tile conceals Party, Recruitment, Friends, Titles and Ranking (`src/net/Social.js:243`). Personal titles are hard to associate with character progression. | Expose direct Party / Recruitment / Friends destinations using existing `social.toggle(to)`. Move the title entry into Character, while reusing the existing title tab initially. |
| P2 | Map already filters shops, teachers, travel, hunting and bosses (`src/ui/mapDirectory.js:12`). Main menu calls it only **แผนที่**. Some directory shops explicitly describe future/unavailable services. | Label **แผนที่และสถานที่**; add useful directory shortcuts. Distinguish unavailable services, omit them from actionable shop searches. Preserve proximity and NPC requirements. |
| P2 | Character and Bag already open a combined workspace; Loadouts label **ชุดอุปกรณ์ / สกิล** can imply saving learned skill allocations. Its empty guidance references **วิชา**, unlike the Skills tile (`src/character/ui/CharacterUI.js:323`). | Keep both C/I entry points, make shared workspace obvious, rename presets **ชุดอุปกรณ์และแถบสกิล**, and consistently use **สกิล**. |
| P2 | Main menu opens without transferring focus (`src/ui/MainMenu.js:49`); keyboard containment does not establish a complete focus-navigation policy. | Focus the first available tile when opened by keyboard; support predictable Tab/arrows and return focus on close. Verify keyboard-only flow after implementation. |
| P2 | Skills prominently shows a second-class chip labelled unavailable (`src/character/ui/SkillPanel.js:195`). | Reduce future advancement to a secondary note; prioritize available skills and implemented paths. Do not invent second-class functionality. |
| P2 | Bag search and filters share the scrolling panel. A small inventory is readable; many items can separate controls from the visible items. | Keep search/category controls reachable, preserve scroll and selection when acting on items, and show selection count for batch actions. This audit did not repeat the prior high-count inventory stress test. |

## Proposed structure

| Group | Entries |
|---|---|
| ตัวละคร | อุปกรณ์ / สถานะ (C), กระเป๋า (I), สกิล (K), ชุดอุปกรณ์และแถบสกิล, ฉายา |
| ผจญภัย | แผนที่และสถานที่ (M), สมุดมอนสเตอร์, สมุดเควสต์ **[new UI required]** |
| สังคม | ปาร์ตี้, หาปาร์ตี้, เพื่อน, อันดับ; reuse existing social tabs and P |
| ระบบ | ตั้งค่า AUTO, ชมวิว (H), ตั้งค่า; account switching/logout clearly separated inside Settings |

Keep trade/duel actions on the selected player and shop/refinement/storage/warp on their NPC interactions. Directory shortcuts should find those services, not remotely execute them. A dedicated Cards entry needs a separate inventory/collection-system audit before promising a card-album feature.

For PC, expose only frequent entry points beside the menu (e.g. bag, skills, map, party); leave secondary actions inside the menu. Do not copy a reference's dense screen-wide icon field. Preserve the central combat view, muted green panels, readable gold accents and restrained ornament.

## What already works

- Four main categories limit persistent HUD clutter; all desktop categories are expanded.
- Equipment/inventory share a workspace, with search, category counts, weight, gold and item details.
- Bestiary menu naming accurately matches its current window; level/map/type filters, boss warnings, drops and location links support preparation.
- Map directory and boss filters support navigation without adding more floating windows.
- Shop actions are context-sensitive and require appropriate NPC services; retain sale/refinement review and confirmation.
- Settings already contains account switching/logout and conditional Google linking. Gameplay is **not an empty tab**: `src/net/CombatMeters.js:24` injects player nameplate controls at runtime. Local screenshots additionally expose developer controls; these are not evidence of the public production menu.

## Validation and screenshots

Workflow: director scope and source-of-truth review → independent read-only specialist audit → parent source/art/technical assessment → browser QA → audit PR.

- One isolated headless Edge instance, reused page; closed after capture. Local guest fixture only, account server and websocket disabled. No production account writes or additional visible tabs.
- Inspected at 1366×768 and 1920×1080; Modern skin, default HUD scale. Runtime observations are in `runtime-observations.json`.
- Reproduced Social Esc issue from focused input; recorded real main-menu labels and Bestiary title.
- `npm run build`: passed. Existing warning: main bundle exceeds the 500 kB advisory threshold.
- No game code changed. No deployment. Unit tests were not rerun for documentation-only changes.

| Capture | Purpose |
|---|---|
| [Main menu 1366×768](menu-pc.png) | Category density, labels, badge mismatch and screen placement |
| [Main menu 1920×1080](menu-wide-pc.png) | Larger PC viewport |
| [Equipment / inventory](inventory-pc.png) | Combined workflow and persistent summary |
| [Social](social-pc.png) | Tab discoverability |
| [Bestiary](bestiary-pc.png) | Preparation and hunting guide |
| [Gameplay settings](settings-play-pc.png) | Runtime nameplate settings; localhost developer controls also visible |

## Limitations / acceptance for implementation

This is a source and browser review, not a timed user study. Screenshots show the present implementation, not redesigned mockups. Online party joining, trading, sales, class advancement, and live server persistence were not exercised. Mobile, large HUD scale and all overlapping-window permutations were not tested here. Aside from Social, keyboard findings are source-derived and require targeted runtime reproduction.

Next implementation should prove: every visible shortcut matches its action; Esc closes exactly one foremost window from inputs and returns focus; all active quests are reviewable; direct social links open the intended tab; future content cannot look like a live shop; keyboard navigation remains inside the active modal; search/selection survive inventory actions. Retest at 1366×768 and 1920×1080 with larger HUD settings before merging.
