# Shared NPC contact sites

## Hooks

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
reject a request while the NPC is briefly still visible. NPC content, route
layout, stock, prices, walking speed and interaction radius are unchanged.
