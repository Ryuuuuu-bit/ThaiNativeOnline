# Player services and everyday QoL

The services use the existing Thai fantasy jade/brass visual language. They reuse
current NPC art and the six class halls rather than adding duplicate sellers.

## Travel and storage

`src/data/warpServices.js` defines six city counters and one keeper in each of the
twelve adventure maps. Keepers remain at their authored positions all day. The
atlas lists their locations under travel. A keeper offers the six city stops and
all twelve adventure maps, ordered by level; selecting a row never moves anyone.
The player explicitly confirms free travel. A warning appears when the player is
below the recommended level. This does not gate destinations by discovery.

`service_warp` accepts an NPC ID and destination ID. The server resolves both
through its own registry, verifies source map, range (5 world units), line of
sight, walkable arrival, combat/trade/duel state, cooldown (3 seconds) and room
capacity. A teleport clears pending movement/casts/PvP/sitting, updates presence
and room rosters, sends an authoritative correction and saves location.

All six city counters also open the same **120-slot account warehouse**. Fields
offer travel only. Warehouse use requires a signed-in, living character within
the source counter's range and line of sight, outside combat/trade/duel. Equipment
occupies separate slots; matching ordinary stacks merge. Individual transfers
preserve cards, refinement and lock metadata. Deposit-all takes only unlocked
materials. Withdrawal checks total bag slots and weight before committing.

Warehouse and character inventory commit together with a durable request receipt.
Postgres serializes account operations in a transaction; MemoryStore uses the
same account serialization contract. Character inventory revisions prevent older
queued/browser saves from restoring transferred items. `stashBusy` blocks other
economy/movement operations during a transfer and flushes wait for it. The client
waits for result, warehouse and authoritative character synchronization; an
uncertain request retries the same UUID rather than creating another transfer.
Guests receive no warehouse mutation API. Warehouses persist in Postgres; local
MemoryStore data disappears on server restart, as before.

## Locks and loadouts

Item locks are per-instance metadata in the bag and per-slot while equipped.
They prevent selling, exchange, destructive refinement and card removal. Wearing
or storing a locked item retains the lock. Deposit-all skips locked materials.

Three named presets save real equipped item references (ID, cards, refinement)
and the order of learned hotbar skills. Applying a preset checks ownership,
class compatibility, bag capacity and combat/busy state, then swaps atomically.
Missing gear rejects the whole swap. A preset does not create gear, change
allocated stats, grant skill points or learn skills. New learned skills remain
available after the saved order. Online application waits for the server result.

## Class schools, party board and bestiary

The six existing class masters offer class-specific lessons and a bounded,
permanent advanced school reward. Requirements, targets, material consumption
and authoritative quest hooks are documented in `docs/world/CLASS_QUESTS.md`.
No existing learned skill is removed or retroactively locked behind a quest.

The social window's recruitment tab supports singleton party creation, map and
level filtering, leader publication and join requests. Leader approval creates
the existing party invitation; applicant consent remains necessary. Listings
use the live roster/leader/location and disappear when full or invalid. Server
checks signed-in identity, capacity, lifecycle, throttles and sanitized text.
Recruitment listings are deliberately temporary and clear after a restart.

The monster journal derives species, base stats, actual map/spawn locations,
active phases, respawn timing, boss warnings and independent loot/card chances
from the gameplay tables. Filters include map, type, level ±5 and dropped item.
The route button selects a hunting site or the next real portal in the atlas;
the player still chooses whether to walk. It neither teleports nor awards loot.

## Refinement

The cumulative step weights for +0 through +10 are
`[0,1,2,3,5,7,10,14,19,25,33]`. Weapon ATK/MATK bonuses scale with native item
power and rarity; armor DEF scales with native defense. Card bonuses are not
compounded. For example, iron_dap gains ATK +15/+42/+99 at +4/+7/+10, up from
+12/+21/+30. The forge shows before/after item power, next gain, +4/+7/+10
milestones, actual fees and destruction odds before confirmation, and confirmed
success/destruction feedback. Safe +4, existing chances, ore costs and gold fees
are retained. Existing saves calculate the new bonuses without changing item
IDs, cards or refinement levels. Economy tuning still requires live playtesting.

## Verification

See `docs/art/warp-forge-qol/` for actual browser screenshots and QA receipts.
The feature tests exercise authoritative travel, transfer conservation and
retry/reconnect/concurrency, locked item economy, preset rollback, class lessons,
party membership consent and exact bestiary data. Final full-suite/build and
release results belong in the task report; no helper-only result is described as
production database or physical-phone verification.
