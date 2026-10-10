# Online safety, PvP and party travel

## Player controls

- **B / กลับเมือง** recalls to the city market. **I** opens the bag. Recall has a
  30-second cooldown and is refused while dead, fighting, duelling or trading.
- A party member can enable **เดินตามหัวหน้า**. It routes through the existing
  path finder, stops about two metres behind the leader and stops on manual
  movement, a combat target, a cast, death, disconnection or a map/channel change.
- **วาร์ปไปแผนที่หัวหน้า** moves a signed-in party member to that map's spawn and
  the leader's channel. It shares recall's cooldown, checks both players' combat
  state and refuses a full channel. It does not teleport onto the leader.
- Click a player's nameplate for **ท้าดวล** or **เลือกเป้าหมาย PK**. Attack the
  selected player using the opponent panel. The attack is manual; it does not
  chase distant players.

## Authority and consent

The server checks swept movement against the same circles, oriented boxes,
capsules, decks, deep water and walk boundaries used by the rendered maps.
Rejected movement sends an authoritative position correction. Monsters spawn on
valid ground and cannot step through obstacles. Direct attacks check a clear
path too. Monster movement currently slides along obstacles; it has no global
path finder and can remain behind a fence.

Collision data lives in `server/data/collision.json` (five maps). To update it,
start Vite and run `node tools/export-collision.cjs`, with Playwright available.
`PLAYWRIGHT_MODULE` can point to a local package and `COLLISION_EXPORT_URL` to
the Vite export page. The authoring tool defaults to port 5182. The test suite
checks the source hash and refuses stale collision data after world changes.

Duels require a fresh explicit acceptance within 30 seconds, nearby signed-in
players in the same map/channel, and no existing fight/trade/duel. The city is
safe. Duels last up to three minutes and end on departure, death, separation,
forfeit or victory. Duel damage leaves the loser at 1 HP; neither side receives
EXP, loot or gold. No death penalty is applied to a duel knockout.

PK starts disabled. Both players must enable it outside the city, in the same
room. Party members cannot PK each other. Disabling PK, recall, trade and portal
escape are blocked for ten seconds after a PvP hit. Changing rooms resets PK.
PK deaths use the normal respawn rules and produce no kill rewards.

This first PvP implementation supports **basic attacks**, with 50% damage and
the same basic-attack rate bucket as PvE. Skill damage, control effects and
class-specific PvP balance need a separate implementation and balance pass.

## Saving and shutdown

`SaveQueue` serializes writes by account and character slot. A failed head write
stays queued and retries with exponential backoff (0.5–10 seconds). Other slots
continue independently. Consecutive waiting server snapshots coalesce, but never
cross an API save/delete barrier. Snapshots capture their data before enqueueing.
API saves preserve the server's character progress. Deleting an active or pending
slot is refused. Rejoining waits for that slot's pending writes.

Disconnect captures the final character, quests and authoritative location before
dropping the live entry. Natural regeneration marks a character dirty too.
SIGINT/SIGTERM freeze gameplay and new requests, notify clients, enqueue final
snapshots including location, drain pending writes and then close sockets and the
database pool. Repeated signals share one shutdown. The total grace deadline is
20 seconds; failure logs the pending count and exits with status 1.

The retry queue is in memory. A hard kill, host loss or a database outage exceeding
the shutdown grace period cannot guarantee the last queued changes are saved.
MemoryStore is for local testing; durable hosting requires PostgreSQL.

## Atomic player trade

`server/trade-service.js` freezes both live characters with `tradeBusy` while
`Accounts.trade` reserves both slot queues through `SaveQueue.runMany`. Earlier
saves finish before capture; later saves cannot overtake the transaction.
`Store.transferTrade` checks both inventory revisions and writes both character
snapshots plus a UUID receipt in one transaction. PostgreSQL locks account rows
in sorted order. A lost commit response retries the same captured snapshots and
receipt, without transferring twice. Old queued inventory snapshots fail their
revision checks after a successful trade.

Success is sent only after durable completion. Live inventory and gold are then
adopted and revisions advanced. Pending trades refuse gameplay mutations, API
saves and GM target changes; monster-hit packets are suppressed. Kill rewards
are deferred until adoption and retain the normal reward notifications.
Disconnect retains the captured state until adoption and final saving; rejoining
waits on slot barriers. Shutdown drains the same queues. During a database outage,
the characters stay frozen until retries resolve; the existing shutdown deadline
and hard-kill limitation still apply. MemoryStore provides atomic local behavior
but cannot persist receipts across process restarts.

## Validation and changed files

- 297 tests pass, including a real isolated HTTP/WebSocket server test covering
  duel consent, fabricated damage rejection, recall lockout, party map warp,
  safe-city PK, active-slot deletion and the actual shutdown signal handler.
- Retry, ordering, snapshot coalescing, shutdown deadlines, obstacle tunnelling,
  monster movement, PvP consent and follow cancellation have dedicated tests.
- Production build passes; Vite reports the existing large bundle warning.
- Browser QA: party invitation/acceptance, follow start, manual stop and B recall
  pass with no page errors. Screenshots reviewed at 1440×900 and 844×390:
  `artifacts/online-safety/desktop.png` and `artifacts/online-safety/mobile.png`.
  These local QA artifacts are ignored by Git.
- Server: `accounts.js`, `combatants.js`, `index.js`, `monsters.js`, `presence.js`,
  `navigation.js`, `pvp.js`, `recall.js`, `save-queue.js`, `shutdown.js`, collision data.
- Client: `CharacterUI.js`, `Multiplayer.js`, `Social.js`, `PartyFollow.js`,
  `PvpPanel.js`, `pvp.css`. Tests and collision authoring tools accompany them.

Implementation follows the game's safe-town/social-gameplay direction and the
existing dark-glass/gold UI. Tech/Art review and QA were performed locally.
No hosted deployment was performed for this change.
