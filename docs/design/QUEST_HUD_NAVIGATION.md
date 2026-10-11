# Quest HUD and navigation

The normal HUD shows one pinned objective, at most two lines, progress, destination/status and Map / Walk (or Stop) / Journal actions. Desktop docks below the minimap; touch uses one 48px objective/progress chip to the right below the minimap, outside chat and the combat tray. The chip opens the registered journal for Map/Walk/Untrack; while walking it becomes Stop. Detailed newcomer instructions live in the registered QuestJournal window under “เส้นทาง Lv 1–20”; the independent floating launcher is removed. Both existing skins share jade/brass variables.

Walk is an explicit user action. It uses Game.walkTo and the existing collision grid, waypoint route and minimap goal/route drawing. It does not teleport, attack, choose a combat target, accept quests or hand in rewards. Enabled AUTO refuses navigation with a visible instruction. Manual input (including an already held key/joystick), Escape after foreground windows, death, service modal/settings, logout/disconnect, map transition, untrack and materially changed objective/availability cancel rather than resume navigation.

NPC destinations follow live outdoor positions or the current phase schedule. A home/indoor contact is unavailable; masters do not incorrectly route at night. Kill camps and ordinary supply sources derive from exact Bestiary spawn/drop data, filtered by phase, night-only maps and portal connectivity. Supplies avoid boss/elite alternatives when ordinary sources exist. Cross-map objectives lead to the next gate; after crossing the user presses Walk again. Practice/combo instructions do not fabricate a training coordinate or count dummy practice. Unsupported coordinates keep the ordinary map directory available. Completed objectives point to manual hand-in and never claim rewards.

Pinning and locomotion state are transient per session; no character saves, skill rules, authority, PK state or quest reward data change. Mobile AUTO now has an actual viewport-bounded scroll container and reachable sticky close header. Fresh QA cleared Skills/Settings sizing, so no speculative overrides were added.

## Verification

`tests/quest-navigation.test.js` covers live/scheduled indoor contacts, readonly progress, objective progression, manual hand-in, cross-map gates, exact ordinary drops, locked supplies, unsupported objectives, explicit walking, path failure, lifecycle cancellation, stale target availability and arrival. Browser evidence and the final full-suite/build result belong in `docs/technical/qa/quest-hud-navigation.md` and `docs/technical/VERIFY.md` after QA.

Known limits: destination geography is public spawn data, not a promise that a particular monster is currently alive. The path planner can reject dynamic obstruction, prompting manual detour. Practice/combo objectives currently provide instructions without automated camp routing. Pinning is not persisted across sessions.

## Enlarged desktop HUD

The tracker measures the real minimap and hotbar rectangles. If the full card cannot fit, desktop uses a single 32px objective/progress chip with journal/Stop behavior. This includes saved HUD zoom1.8 at1366×768. An extreme viewport/zoom combination with less than34px plus safe spacing hides the floating tracker; the same objective and actions remain in the main-menu QuestJournal. Touch retains its approved138px-wide48px chip. `tests/quest-hud-layout.test.js` verifies these geometry boundaries without DOM assumptions.

## Direction, distance and safe touch placement

`questGuidance` is a read-only presentation model. During explicit quest walking, the arrow points toward the next actual collision-path waypoint. “ตามทาง” sums the remaining waypoint segments to the planned standable destination; while idle, “ระยะตรง” measures the direct distance to the current real step, not a route estimate. Cross-map objectives always measure the current next portal, never coordinates in a different map. The camera's forward/right basis and pitch project the arrow into the current screen orientation. Camera pan/zoom does not alter world distance.

Unavailable contacts suppress distance/arrow; blocked-path and AUTO-refusal messages stay visible. Arrival uses the objective's approach radius and remains a manual action. A nearby direct target does not claim arrival while a detour remains. Cross-map arrival explains continuing after the gate. These values neither mutate objectives nor initiate movement, combat, travel or rewards.

Touch placement measures the region pill, player's full painted title/name plate, profile/chat/minimap and gameplay-control rectangles. The chip searches clear right/left edge gaps with spacing; if neither fits, it hides instead of covering title or controls. QuestJournal/map actions remain accessible in the menu. Title and zone art are not resized or moved. Desktop full/compact behavior and both skins retain existing rules. `tests/quest-guidance.test.js` and expanded geometry tests verify rotated/pitched cameras, remaining path sums, portal targets, unavailable/arrival status and protected mobile rectangles. Final native browser captures are a separate QA/Art gate.
