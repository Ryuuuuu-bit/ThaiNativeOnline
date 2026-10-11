# Quest HUD/navigation technical review

Decision: **APPROVED for the technical gate**, subject to the independent QA and Art gates. Final tail review covers committed source `c1b415bec89fe9f6de48d6321b1b197ccc4f3f92` on `codex/quest-hud-navigation`, based on `d379557f8f3bea74646b234a574686855b7ca929`. This approval does not authorize or certify deployment.

## Scope and ownership

Game Director reviewed the implementation and existing world/quest contracts; gameplay engineer owns the application, tests and integration documentation. QA owns browser interaction, geometry and the full test/build receipts. Art owns readability and visual consistency. Director changed only this review document.

The compact objective and existing jade/brass skins support the readability and Thai identity pillars, while navigation reuses existing maps and collision/path systems. No new region, quest, balance change, dependency, automatic combat, reward claim or teleportation is introduced.

Reviewed modules: `src/quest/questNavigation.js`, `QuestNavigator.js`, `src/core/Game.js`, `src/ui/QuestUI.js`, `QuestJournal.js`, `WorldMapPanel.js`, `questHudLayout.js`, associated quest/mobile styles, and the lifecycle changes in `src/net/Multiplayer.js`.

## Authority and geography

- Resolver and navigator read quest state; they do not accept, complete, grant rewards or write saved progress. No diff touches `QuestSystem`, quest definitions, server handlers or `src/rules`.
- The admitted catalog has 18 quests: 17 talk, 16 kill, 14 collect, 6 practice, 6 combo and 0 discover objectives. Collection uses only `hide`, `ash` and `croc_scale`; all have ordinary monster sources. Existing `objectiveProgress` counts unlocked supplies, preserving the authoritative material contract.
- NPC targets use current live outdoor positions. Absent contacts use the current phase schedule, checking home status before hall fallback. Masters with night home schedules are unavailable; shaman/assassin masters that stay remain available.
- Hunt targets derive from actual Bestiary spawn geography and drops, filtering phase, night-only destinations and portal connectivity. Supply targets exclude bosses and elites. This does not promise a currently alive monster or a risk-free route.
- Cross-map guidance chooses a real next portal. Normal map transition clears locomotion; the player presses Walk again afterward. Unsupported practice/combo geography provides instructions instead of invented coordinates or city dummy practice.

## Runtime and input

- Walk is explicit and uses the existing standability predicate, collision grid and waypoint planner. Existing bounded stall/replan behavior remains; minimap route drawing uses the actual planned route.
- Navigation cancels on manual movement, including held keys/stick before any route step; death, map departure, disconnect/identity loss, untrack, changed objective and materially changed destination/availability also cancel. No cancellation resumes walking automatically.
- Enabled AUTO refuses navigation with an explanation. Opening a registered modal cancels navigation without extending global movement locks. MainMenu and hotbar editor remain `nonModal`, retaining their existing keyboard movement behavior.
- Escape first closes foreground windows, then cancels navigation. HUD control keys do not leak combat shortcuts, while movement and Escape remain available.
- Journey details are inside the existing registered QuestJournal rather than a body-class overlay. Journal/card compendium prepare hooks prevent competing focus traps. Journal refresh restores focus to the new pin/map/walk action buttons.
- New map objectives are temporary directory entries, preserving ordinary atlas search and navigation when a quest has no available coordinates.
- Multiplayer changes add lifecycle cancellation only; private GM/identity authorization and progress synchronization remain intact.

## Review corrections confirmed

Initial review found hall lookup bypassing night availability and unchanged objective keys retaining unavailable walks. Both were corrected. Final review also required Escape/manual-state cancellation, modal-open cancellation, action-focus restoration and HUD keyboard containment; the frozen source contains these fixes.

The final mobile design supersedes the earlier 158px three-button card: touch displays one 138px objective/progress chip, with a 48px minimum-height button (approximately 50px including its container), six pixels below the minimap and twelve pixels from the right edge. Idle activation opens the journal; active navigation changes the same control to Stop with a matching accessible label. Map, Walk and Untrack are inside the journal. Untrack does not first pin the currently selected quest. The touch chip has no external close control or three-button row that can collide with the minimap. Desktop actions remain unchanged. AUTO has a viewport-bounded scrolling body, an opaque sticky header and zero outer padding so content cannot show through the title. Fresh geometry and scrolling screenshots remain an Art/QA gate.

The final desktop geometry tail (`c1b415b`) handles enlarged saved HUD scales without covering AUTO/gear controls. Its pure helper measures the actual minimap, hotbar and full tracker height. If the full desktop card cannot fit in the available horizontal column, it uses a 32px button plus container borders; if even that 34px height has no safe gap, it hides the tracker while retaining the menu journal. Ordinary desktop and touch layouts keep their established behavior. The helper uses measured viewport bounds rather than multiplying a presumed HUD scale. Actual gap/hit probes and fresh screenshots remain required for this tail.

Both tails leave `Game`, navigation/resolver logic, Multiplayer, quest progression, server code and rules unchanged. The prior authority/path/input approval therefore remains valid.

## Verification and limits

Gameplay engineer reports the final combined quest journal/navigation tests passed (17 pass, 0 fail: 9 journal and 8 navigation). Journal coverage includes three added behavior checks for journey tabs, action-focus replacement and pin/map/walk/untrack sequencing. The earlier full run of 1,266 tests had six journal failures caused by the incomplete fake-DOM fixture; those failures were not waived. The fixture now represents the actual new tabs/containers.

QA receipts at `54681a5`: full suite **1,269 total, 1,267 pass, 0 fail, 2 skip**, duration **44,479.4353ms**; production build **349 modules**, **525ms**, passed. Browser checks report **60 fresh layout states, 0 page errors**, **7 behavior checks passed**, and **16 additional samples, 0 errors**. Actual route walking moved **4.20 world units in one second**; focused main-menu and hotbar-editor movement and journal typing checks passed.

At `c1b415b`, the bounded geometry tail passed **22 targeted tests, 0 fail** (the previous 17 plus 5 geometry regressions), and the production build passed in **522ms**. The five cases cover enlarged HUD fit, ordinary full-card fit, a nonoverlapping hotbar column, an extreme gap with no safe chip room, and unchanged touch placement. The full suite was not rerun for this narrow layout-only tail; its exact full-suite result above belongs to `54681a5`, not `c1b415b`. Director inspected source/tests but did not run a duplicate suite or browser session. Screenshots and detailed receipts belong to `docs/technical/qa/quest-hud-navigation.md`. Fresh final gap/hit probes, screenshots and Art acceptance remain pending at this checkpoint.

Known limits: pin state is transient, practice/combo provide manual instructions without automatic camp routing, spawn metadata does not certify live availability, and dynamic obstruction may require manual detour. No claim is made that every authenticated social/economy transaction or physical mobile device has been tested.

## Independent gate completion

Root recorded the subsequent QA and Art results without changing application source. Fresh enlarged-HUD browser probes at `c1b415b` confirm zero hotbar intersection, 10.25px classic and 16.25px modern clearance, ordinary-card restoration, unchanged touch placement, eight samples without page errors and four passing route/focus/typing checks. QA independently passed22 targeted tests and the349-module build (518ms). Art approved the refreshed native captures with scores9 style /8 readability /9 Thai identity /8.5 technical usability; no required change remains for its bounded gate. Full test-suite provenance and remaining coverage limits stay in the QA report. This records the completed review gates; it does not certify deployment.
