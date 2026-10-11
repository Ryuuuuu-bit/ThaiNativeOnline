# Branch consolidation technical review

Decision: **APPROVED for PR, subject to the separate QA and Art gates.**

Reviewed committed integration history through `1e0096c`, based on production
main `5023e31`. The implementation owner integrated all 40 distinct tips that
were outside main's ancestry. Branch deletion remains a separate operation:
prove every recorded tip is an ancestor of merged main and preserve dirty
worktrees before deleting any ref.

## Direction and ownership

The integration retains the orthographic game, Thai art direction, readable
current HUD and existing playable region. It adds the previously pending class
effects, card collection and beginner journey rather than introducing a new
region or new rendering architecture.

The gameplay engineer owns integration and the conflict ledger; the Director
approved the rules decisions and reviewed authority boundaries; QA owns runtime
checks and the Art Director owns fresh visual acceptance. Root owns the final
PR, ancestry proof, branch cleanup and deployment.

## Rules decisions

- Import the authored `PLAYER_DAMAGE_MULT = 1.2` once, after armor and critical
  scaling, before final rounding. Monster rolls with `atk.mob` opt out. This
  also affects player PvP rolls; it is not restricted to PvE. Derived stats and
  healing remain outside this modifier. The rules README records the rationale.
- Damage previews use the same multiplier and rounding order; training already
  calls the shared damage function and receives no second modifier.
- Preserve current party defense policy: strongest positive proportional and
  flat bonuses, with the flat bonus added after the proportional calculation.
  Live negative values combine separately, the ratio is bounded to -1 through
  0.6, and resulting defense cannot fall below zero. Expired/nonfinite statuses
  do not contribute. Older additive-defense assertions were superseded by the
  existing documented party-synergy policy.
- Preserve expanded level-appropriate equipment pools, affix instance metadata
  and reusable flasks. Older loot tuning supplements legacy tables rather than
  replacing the current all-slot shared loot runner.

## Authority and persistence

Compared with base main, the GM authority module, title entitlement module,
stat-operation handler, authoritative progress, trade service and stash source
retain their current security implementation. The title command still checks
the current socket, presence, Character state, session token and role epoch
after awaiting authorization. A fresh denial cannot use transient entitlement
to select an unearned title. GM-only selected titles stay out of stored JSON;
live sync retains the selected title. Logout and revocation clear entitlement.

Card history comes from actual holdings or the authoritative server book.
Client synchronization replaces local history rather than unioning claims.
Special card effects read valid sockets on eligible, currently equipped gear;
matching special IDs do not stack, damage/reduction caps remain bounded, and
proc cooldowns are transient. Kill procs consume genuine owner-bound reward
objects. New tether healing pauses during trade transactions and cannot bypass
party, map, range or live-character checks.

Beginner quests use the existing authoritative quest operation path. Objective
records, NPC proximity, prerequisites and rewards remain server-controlled for
signed-in characters. The journey UI does not itself grant progress.

## Superseded implementations

Keep the current painted equipment/skill libraries and the approved runtime
cleanup. Retired public sample previews and heavyweight masters were not
restored merely to retain their branch history. Their original commits remain
reachable through normal merge ancestry. Keep the clock behavior from PR #93,
including the current touch behavior, rather than the older clock branch's
override. Preserve current loading, skill-particle sizing, custom hotbar,
five-second recall, chat controls and authenticated GM metadata.

An admitted-tree scan found **31 card paintings and 31 matching icons: 62 WebP
files**. The previous verbal count of 32 pairs was incorrect; the 31-model
scope matches `CARD_COLLECTION.md` and the illustration registry.

## Findings resolved

1. The incoming harmful-status list omitted generic `dot`, weakening the
   previous cleanse contract. Commit `d575707` restores it and covers ordinary
   guest snapshots plus local/server cleansing.
2. Buff-duration previews omitted cooldown reduction after the new uptime cap
   was integrated. For example, Lv.10 boxer waikru at 30% cooldown reduction
   reported 13.64 seconds instead of 9.548. Commit `1e0096c` forwards the same
   reduction to self/party adapters and adds a regression check.

No unresolved authority or rules blocker was found in the committed review.

## Validation evidence and limits

Counts supplied by the implementation/QA owners:

- Full suite before the two final narrow fixes: **1,256 total; 1,254 passed;
  0 failed; 2 existing skips**, 44,284 ms.
- Generic DOT fix: **25/25 targeted checks passed**.
- Damage/buff preview fix: **2/2 targeted checks passed**.
- Latest build: **349 modules**, passed in **564 ms**.

These are separate runs; this report does not claim the full suite was rerun
after the two narrow fixes. The reviewer performed read-only committed-source
inspection and a bounded formula probe, and did not independently repeat the
suite. Browser and final Art acceptance were still in progress when this report
was written and must pass before merge. Historical branch screenshots are not
fresh evidence of the consolidated build. Live production accounts, physical
phones, crowded-party performance and long-term economy balance were not
validated by this technical review.
