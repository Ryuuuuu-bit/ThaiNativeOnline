# Quests

QuestSystem owns accepted progress and rewards; slotStorage is supplied by Game. Journal and navigation do not accept, complete or fabricate progress.

## Hooks

- `questNavigation.questObjective(quests, pinnedId, context)` reads the first unfinished objective, current map/phase, live NPCs and exact Bestiary drops. It resolves a reachable camp/NPC or the next portal; practice/combo stay honest manual instructions.
- `QuestNavigator` is transient. Game supplies collision-aware `walkTo`/`stopWalk`; manual input, death, service windows, AUTO, changed objective/availability, map transition and Multiplayer disconnect/logout cancel it. Cross-map arrival never continues automatically.
- QuestUI renders one compact objective HUD; QuestJournal hosts the detailed Lv1–20 journey and journal actions. WorldMapPanel adds a temporary quest entry while preserving its ordinary directory when no coordinates exist.

See `docs/design/QUEST_HUD_NAVIGATION.md` for interaction and verification contracts.
