# Temple fair: bounded director and economy contract

Status: approved design and pure helper contract, version 1. This document does
not claim backend durability, UI, stalls, CSPRNG integration, or playable games
are implemented. Those remain integration-owner work. User scope: fictional game
gold only; no paid tools, new dependencies, browser work, or commits in this task.

## Direction and ownership

Approved: three small temple-fair activities inside the existing city. Thai
balloon darts, moving toy-doll shooting, and น้ำเต้า ปู ปลา reinforce cultural
identity and peaceful town life. Preserve orthographic/near-orthographic 2.5D,
clear silhouettes, bright enough evening lighting, readable aims and walkways.
Develop the existing region instead of adding maps. The Art Bible remains the
visual authority; a fair board must not turn the game into a first-person shooter.

Rejected: hidden odds changes, aim-reactive cheating, adaptive payout suppression,
gold prizes above the skill entry tier, jackpots, premium-currency stakes, cash
conversion, stat/EXP/loot prizes, autonomous opponent AI systems, and extra regions.
Challenge comes from published target motion, timing and accuracy. Deterministic
bots can be perfect; the fee model remains safe even then. High scores are an
optional non-economic presentation goal, with persistence/rankings deferred.

The current root AGENTS.md contains no ownership table. The following uses the
local `.codex/agents` role definitions plus the user's explicit assignment; it
does not invent an AGENTS.md ownership entry.

| Piece | Owner | Files / dependencies |
| --- | --- | --- |
| This delivery: pure math, geometry, tests, decision | Game Director | `src/fair/fairRules.js`, `tests/fair-rules.test.js`, this document; reads shared `src/core/WorldClock.js` |
| Backend durability and integration | Main (explicit user assignment), Gameplay Engineer for gameplay hooks | Future `server/fair.js`, existing Accounts transaction interface, `server/index.js`, `src/net/**`, `src/core/Game.js`; depends on frozen helper contract and world contact anchors |
| Board/input/fee/odds presentation | Gameplay Engineer, UI workstream | Future fair UI module and `src/ui/**`; depends on authoritative round/result messages and helper geometry |
| Stall locations and access | World Designer, coordinated by main | `src/world/compact-city.js` and contact/navigation records; chooses coordinates later, preserves service access, updates collision exports if geometry changes |
| Fair props and illumination | Environment Artist / Technical Artist | City assembly/props and lighting hooks as needed; depends on approved stall footprints |
| Visual and technical acceptance | Art Director / Technical Artist | Future review evidence; checks camera readability, Thai identity, batching and lighting |
| Integrated verification | QA | Future transaction/network tests and browser evidence after integration; pure rules tests are included here |

No stall coordinates are owned or defined here. No edits to `server/index.js`,
`Game.js`, legacy balance tables, save formats, or world geometry are part of this
delivery. New fair values are explained below; existing rules economy values are
not changed.

## Opening and limits

`isFairOpen(hour)` calls shared `phaseOf` and accepts only `evening` or `night`:
**16:30 inclusive to 05:00 exclusive**, spanning midnight. Evening starts 16.5;
night starts 19.5; morning starts 5. Finite numeric hours must lie in `[0,24)`;
invalid hours fail closed. Server world time authorizes play; client clock/URL
overrides only affect presentation. Do not use the representative `PHASE_HOURS`
values as phase boundaries.

Stakes (rules version 2, 2026-10-12, owner decision): **any whole number of gold
from 20 to 1,000,000** (existing balance field `gold`, display currency ตำลึง).
Version 1 fixed 20/50/100; some players now hold millions, so the range lets them
play for meaningful sums and turns the dice sink (17/216 of every stake) into a
real brake on their surplus. The panel offers a number field, quick picks
(20, 100, 1K, 10K, 100K, 1M), half and all-in (both capped at 1,000,000); a stake
of 100,000 or more needs a second press. Default 20; the maximum fee or full dice
stake is shown before starting and must be affordable. No multipliers from luck,
level, buffs, blessings, gear or gold bonuses. All results use integer gold.

Skill rounds have five shots, a **500 ms minimum interval** between accepted
shots, and a **20,000 ms exclusive deadline** measured from server round start.
The first shot may occur at elapsed zero. A valid miss consumes a shot. Invalid
requests consume neither shot nor gold and require transport rate limiting.
One active round per authenticated account across slots/connections; a **3,000 ms
cooldown** follows completion or interruption. These are backend requirements,
not state maintained by the pure helpers.

At 05:00 reject new play and skill shots; unfinished skill rounds are interrupted
for zero charge. UI shows remaining time as the minimum of the round deadline and
time to fair closing. Leaving, disconnecting, timing out or server restart also
interrupts unfinished skill rounds for zero charge. Dice settle immediately at
acceptance; their optional **1,500 ms reveal animation** never delays a transaction
or changes a committed outcome, including across dawn or disconnect.

## Skill games: balloons and dolls

Start is free. A tier is the maximum possible **completion fee**, not an upfront
debit. The server owns round ID, account/session/character identity, rules version,
game ID, tier, uint32 seed, start/deadline, next shot index and accumulated hits.
Seed is public after issuance and only varies the published target pattern.

Each shot has one target, with index 0–4. Balloon targets gently bob; dolls move
sideways with fixed seeded periods and a small vertical oscillation. Motions
depend only on game, issued seed, current shot index and elapsed round time, never
the player's aim, past losses or balance. Target changes after each accepted shot.
Rendering must preserve the square board's aspect ratio and draw the exact hit
circle (or a clear ring) within the visible toy silhouette. No invisible smaller
hit region. Render prediction is cosmetic; server receipt time decides hits.

Director tuning (2026-10-12): doll horizontal periods are **5,000–6,500 ms**,
amplitude **0.38** board units, and the visible circular hit radius is **0.075**.
This replaces the draft 2,500–3,500 ms / 0.055-radius tuning, which was too fast
for ordinary network delay. Vertical bob remains amplitude 0.025 with a 1,800 ms
period. The maximum combined speed is bounded by
`hypot(0.38*2*pi/5, 0.025*2*pi/1.8) < 0.486` board units/second.
Over 150 ms, total displacement is therefore below **0.073**, inside the visible
0.075 radius. This is a conservative aim-to-server-receipt delay allowance through
published geometry, not a claim that RTT equals one-way delay. A perfect center
aim from up to 150 ms earlier still hits while that same target/round is active;
edge aims, clock/render errors and greater delay have no guarantee. Motion and
five-shot timing retain the challenge. The UI draws exactly this radius.

| Confirmed hits out of five | Displayed refund rate | Fee at 20 | Fee at 50 | Fee at 100 |
| --- | --- | --- | --- | --- |
| 0 or 1 | 0% | 20 | 50 | 100 |
| 2 | 25% | 15 | 38 | 75 |
| 3 | 50% | 10 | 25 | 50 |
| 4 | 75% | 5 | 13 | 25 |
| 5 | 100% | 0 | 0 | 0 |

`grossRefund = floor(stake * refundPercent / 100)`;
`completionFee = stake - grossRefund`. The refund is a calculation/display value,
**never a separate gold credit**. Only completion after five accepted shots may
debit the fee, once, atomically with its durable receipt. Thus each settled skill
round has balance delta in `[-stake,0]`, including perfect bots. No system mint
is possible through the intended skill payout. Interrupted rounds have zero delta.

Required UI copy: **“Fee charged after five shots; interrupted rounds are free.”**
Show the chosen maximum fee, current hits, shots left, timer, refund schedule and
the projected completion fee. A zero-fee perfect result says so without implying
a prize credit. A durable completion remains charged if its acknowledgement is
lost; reconnect retrieves the same receipt. “Interrupted” means not committed.

Known tradeoff: deliberate four-shot abandonment can avoid fees and reduce the
sink. This is accepted by the user's free-interruption durability model; do not
silently add cancellation penalties. It still cannot mint gold. Server validates
affordability on start and again in the completion transaction, never allowing
negative balances. If completion cannot commit, it yields no paid result or
reward and must not acknowledge a successful fee debit. Main owns exact failure
and retry handling, including concurrent spending, and must test it.

## Dice: published fair odds

Choose exactly one of `gourd`, `crab`, `fish`, `rooster`, `shrimp`, `tiger` and one
tier before acceptance. These string IDs are authoritative in requests, outcomes
and receipts; indexes 0–5 are not accepted symbol IDs. The canonical dart game ID
is `balloons` (plural); there is no singular alias. Three independent uniform six-sided dice use **server
CSPRNG** (for example Node's built-in `crypto.randomInt(6)`). No `Math.random`,
client-supplied faces, seeded skill-motion RNG, biased modulo reduction, rerolls,
or account-dependent probabilities. Persist the accepted choice and sampled
outcome with the settlement receipt; do not disclose the result before commit.

| Matches | Ordered outcomes out of 216 | Probability | Gross returned | Net change |
| --- | --- | --- | --- | --- |
| 0 | 125 | 57.870370% | 0 | -stake |
| 1 | 75 | 34.722222% | 2 × stake | +stake |
| 2 | 15 | 6.944444% | 3 × stake | +2 × stake |
| 3 | 1 | 0.462963% | 4 × stake | +3 × stake |

The gross includes the returned stake: when matches >= 1 it is
`stake + stake * matches`. Exact expected gross is
`(75*2 + 15*3 + 1*4)/216 = 199/216 = 92.129629...%`.
Expected net sink is `17/216 = 7.870370...%` of the stake. Display these odds and
gross-versus-net meanings before acceptance. Dice can pay more gold than charged
on individual rounds; the sink is an expectation, not a guarantee in a short
session. Maximum gross is 4,000,000 and maximum net gain is 3,000,000 at the
1,000,000 cap (one 0.46% triple). The range is a deliberate owner tradeoff:
lucky streaks can mint large sums, the long-run expectation still sinks.

Main settles dice immediately through **one-participant `accounts.trade`** with
atomic debit-plus-gross and a durable receipt. No start-time fee, pending paid
animation, or separate payout action. Check balance >= full stake even if the
sampled outcome would win. Only acknowledge success after durable commit. Bind
request IDs to the authenticated account/character, request payload and rules
version; retry returns the existing outcome/receipt without another debit,
credit or reroll. Unknown commit outcomes must be resolved by receipt lookup,
not fresh random draws. Main owns transaction compatibility and recovery tests.

## Pure API contract

All exports are in `src/fair/fairRules.js`; no DOM, three.js, IO, clock reads,
random draws or balance mutations. The only import is the shared phase helper.

```js
FAIR_RULES_VERSION // 2
FAIR_STAKE_MIN     // 20
FAIR_STAKE_MAX     // 1,000,000
FAIR_GAME_IDS      // ['balloons', 'dolls', 'dice']
FAIR_GAMES         // frozen metadata by ID: { nameTh, kind }
FAIR_STAKES        // quick picks [20, 100, 1e3, 1e4, 1e5, 1e6]
FAIR_LIMITS        // { shots: 5, roundMs: 20000, shotIntervalMs: 500,
                   //   diceRevealMs: 1500, roundCooldownMs: 3000 }
DICE_SYMBOLS      // ['gourd', 'crab', 'fish', 'rooster', 'shrimp', 'tiger']
DICE_SYMBOL_NAMES // Thai display labels by symbol ID
DICE_ODDS         // exact counts, multipliers, denominator and EV numerators
SKILL_REFUND_PERCENT // [0, 0, 25, 50, 75, 100], indexed by confirmed hits

isFairOpen(hour)                         // boolean, rejects invalid [0,24) hours
isFairStake(stake)                       // safe integer in [20, 1e6], no coercion
dicePayout(stake, symbol, faces)          // integer gross, faces = 3 symbol IDs
skillPayout(stake, hits)                  // integer displayed gross refund
skillFee(stake, hits)                     // integer debit at five-shot completion
targetAt(gameId, seed, shotIndex, elapsedMs)
// { id: shotIndex, x, y, radius }; null at elapsedMs >= 20000
judgeFairShot({ gameId, seed, shotIndex, elapsedMs, x, y })
// { valid, hit, targetId: number|null, reason: string|null }
```

Payout helpers throw `RangeError` for invalid tiers, hit counts, symbol IDs or
face arrays; they never clamp forged scores. `targetAt` accepts only skill game
IDs, integer uint32 seeds, integer shot indexes 0–4, and finite nonnegative
elapsed milliseconds. Invalid arguments throw `RangeError`. Elapsed time is
since **round start**, not target spawn or last shot. The seed and elapsed time
have no defaults; callers must supply them.

`judgeFairShot` fails closed with reason `game`, `seed`, `shot_index`, `elapsed`,
`aim` or `expired`; successful judgments have `reason: null`. Valid aim coordinates
are finite numbers in `[0,1]` on a square board, origin top-left. Hit means distance
to the target center <= radius. A valid miss has `hit: false, targetId: null`.
The helper does not check opening, shot count history, cadence, identity or replay;
it is geometry, not a secure standalone round controller.

Integration envelope (design proposal; main owns exact transport message names):

- Start request carries game ID and tier; dice also carry chosen symbol and
  idempotency key. No caller may select the skill seed or dice result.
- Skill start response supplies round ID, rules version, game ID, tier, seed,
  server start/deadline and clock synchronization data. There is no debit.
- Shot request carries round ID, sequence 0–4 and normalized `x,y`. Backend looks
  up its round and calls the judge with its own game/seed/index and elapsed time
  at receipt. Never spread an untrusted request over authoritative helper inputs.
- Backend checks account/session ownership, current open phase, deadline,
  sequence, remaining shots and 500 ms cadence before accepting each shot. Each
  accepted hit or miss advances exactly once; duplicate requests return the
  cached response. Rejected early/out-of-order shots cannot advance the round.
- Shot response reports accepted sequence, hit/miss, total hits, remaining shots
  and server time. Shot five triggers the atomic completion-fee transaction;
  freeze that result during persistence so retries cannot replay or replace it.
- Completed skill/dice response reports a stable receipt ID, authoritative
  balance and fee or gross/net respectively. No separate client score claim or
  reward-claim endpoint. Ledger idempotency survives reconnect and process restart.

No latency rewind or hidden hit grace is authorized in version 1. The published
doll motion/radius above accommodates up to 150 ms of center-aim delay using the
same receipt-time geometry for everyone. UI should interpolate using server
synchronization and show pending shot feedback until acknowledgment. Physical-
device/network playtests still need to validate rendering, clock synchronization,
aim precision and higher latency. Do not trust a client clock as an unreviewed
latency workaround.

## Required verification and release risks

Pure tests enumerate all 216 dice results for all six choices at every quick-pick stake
(7,776 settlements), prove exact integer EV, cover all 32 five-shot binary result
sequences at each tier, phase boundaries, invalid input, deterministic bounded
targets, both-axis 50/100/150 ms delayed center aims, receipt-time geometry and
deadlines. `npm test` and `npm run build` are
required by `docs/technical/VERIFY.md`; executed results belong in the task report.

Before release, main/QA must verify one-time fees and dice settlement through
concurrent requests, replay, insufficient funds, session/slot switches, reconnect,
crash before/after commit and lost acknowledgments; dawn, cadence, forged score,
client timestamp and seed attacks; transaction receipt retention and recovery.
Art/Tech review must validate stall routes, aim visibility, square board scaling
and night lighting. Browser/screenshots, server RNG quality, durable transactions,
network fairness and human difficulty are not established by this pure contract.
