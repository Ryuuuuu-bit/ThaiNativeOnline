# Shared NPC contact sites

## Hooks

City life presentation: `compactCityNpc` may attach a `daytimeRoutine` to an
existing ambient resident. `NPCManager` uses `presentationActivityFor` only for
the visible city daytime plan. `NPCSchedule.activityFor` and the original
`schedule` remain the server/quest contact truth. Shop, trainer, warp/storage roles,
faction guards and all quest giver/turn-in/talk/class-master IDs,
home phases and wilderness NPCs bypass this presentation override. No new
vendor, stock or quest contact is introduced. Routine points use the same
collision-tested `COMPACT_CITY_SPOTS` registry; optional idle/work/talk/prayer
pauses reuse the existing procedural poses and measured idle/walk GLB clips.

`compactCityNpcs.js` exports `COMPACT_CITY_SPOTS`, an object keyed by retained
city schedule/home/road aliases with `{ x, z, face, link }` records. World merges
these already-compact coordinates directly into its spots; `shopSites.js`
derives city `SPOT_SITES` overrides from the same records. Global `CityMap.J`
remains legacy wilderness/background data. City NPC navigation uses a separate
city graph; mapped residents declare `map: 'city'` and `home.near: { x, z }`.
The World/NPCManager hook accepts this explicit home selection point.
Legacy-authored city schedule literals pass through `compactCityNpc` once;
generated warp schedules and explicit field NPCs bypass that transform.
`herb_gather` remains a paddy anchor, and outside gate guards remain paddy NPCs.
Six HALLS derive geometry/doors/yards from canonical buildings and exterior
master contacts from their POIs. No stock, quest identity or schedule phase is
added or removed. Compact positions do not change server phase/range checks.

`shopSites.js` supplies `nearShop(shop, map, x, z, phase)`,
`nearNpc(id, map, x, z, phase)` and `nearAnyShop(map, x, z, phase)` to
authoritative shop, selling, refinement, card-removal, flask-refill and quest
operations. `server/index.js` passes the current server clock in the accepted
player context; `Combatants.op`, `applyQuestOp` and generic progress replay use
that context, never a phase sent in an operation packet.

`npcContact.js` uses the renderer's `NPCSchedule.activityFor` day fallback and
selects only the current activity's outdoor stay/route anchors. Home activities
have no contact sites. Explicit unknown phases fail closed; omitted phase means
day for offline callers/tests. `npcOutdoors` lets class-quest contacts apply the
same schedule gate while retaining their exact static `HALLS` positions.

`SHOP_SITES`, `SHOP_MAPS` and `shopSpot` retain their deduplicated union for
catalog metadata, map availability and fixtures. They are not time-of-day
authorization. Legacy shop IDs use the surviving host's current schedule.
Named anchors retain their registered map, so the city herbalist's morning
paddy site cannot authorize purchases/refills at the city counter.

## Limits

The server does not simulate the browser's random NPC route movement. Contact
is within the existing 12m range of a registered current-activity anchor, not a
proof of the NPC's exact instantaneous position. Unknown road-node/district
anchors remain unavailable as before. Client phase reactions are staggered by
up to 10 seconds and transitions use walking animations; authoritative contacts
switch immediately with the server clock. A newly closed contact can therefore
reject a request while the NPC is briefly still visible. NPC content, stock,
prices, walking speed and interaction radius are unchanged. City route anchors
now follow the compact layout; wilderness anchors retain their existing routes.
