# Quest HUD and navigation

The normal HUD shows one pinned objective, at most two lines, progress, destination/status and Map / Walk (or Stop) / Journal actions. Desktop docks below the minimap; touch uses physical 44px actions on the right, outside chat/profile and the combat tray. Detailed newcomer instructions live in the registered QuestJournal window under “เส้นทาง Lv 1–20”; the independent floating launcher is removed. Both existing skins share jade/brass variables.

Walk is an explicit user action. It uses Game.walkTo and the existing collision grid, waypoint route and minimap goal/route drawing. It does not teleport, attack, choose a combat target, accept quests or hand in rewards. Enabled AUTO refuses navigation with a visible instruction. Manual input (including an already held key/joystick), Escape after foreground windows, death, service modal/settings, logout/disconnect, map transition, untrack and materially changed objective/availability cancel rather than resume navigation.

NPC destinations follow live outdoor positions or the current phase schedule. A home/indoor contact is unavailable; masters do not incorrectly route at night. Kill camps and ordinary supply sources derive from exact Bestiary spawn/drop data, filtered by phase, night-only maps and portal connectivity. Supplies avoid boss/elite alternatives when ordinary sources exist. Cross-map objectives lead to the next gate; after crossing the user presses Walk again. Practice/combo instructions do not fabricate a training coordinate or count dummy practice. Unsupported coordinates keep the ordinary map directory available. Completed objectives point to manual hand-in and never claim rewards.

Pinning and locomotion state are transient per session; no character saves, skill rules, authority, PK state or quest reward data change. Mobile AUTO now has an actual viewport-bounded scroll container and reachable sticky close header. Fresh QA cleared Skills/Settings sizing, so no speculative overrides were added.

## Verification

`tests/quest-navigation.test.js` covers live/scheduled indoor contacts, readonly progress, objective progression, manual hand-in, cross-map gates, exact ordinary drops, locked supplies, unsupported objectives, explicit walking, path failure, lifecycle cancellation, stale target availability and arrival. Browser evidence and the final full-suite/build result belong in `docs/technical/qa/quest-hud-navigation.md` and `docs/technical/VERIFY.md` after QA.

Known limits: destination geography is public spawn data, not a promise that a particular monster is currently alive. The path planner can reject dynamic obstruction, prompting manual detour. Practice/combo objectives currently provide instructions without automated camp routing. Pinning is not persisted across sessions.
