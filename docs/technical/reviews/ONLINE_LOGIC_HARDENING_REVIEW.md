# Online logic hardening technical review

Scope: user-approved audit items2–5 on `codex/online-logic-hardening`, based on main `ccb3747567db042b40e94a0c610369cb5100dc34`. Guest policy is outside this change. Game Director approved strengthening existing authority and acknowledgement paths without stat, drop, economy, damage, cooldown or content tuning.

Decision: **TECH APPROVED**. Final targeted QA/build and native account-screen Art gates are recorded in `docs/technical/qa/online-logic-hardening.md` and `docs/art/reviews/online-logic-hardening/ART_REVIEW.md`. Director performed source/test review, not test execution.

## Contracts reviewed

- Authenticated hello uses one stored character/quest/location/UID/revision row. Separate per-account/slot login reservations permit the old session's ordinary final save FIFO to complete before a new read/adoption. Repeated hello cannot move an established socket; invalid/blocked positions use spawn; retired-map migration and closed-night-map eviction remain. Reservation keys do not hold the save queue while awaiting a final flush.
- DELETE and rename refuse pending login reservations. A failed final flush leaves the old entry dirty and refuses replacement login before adopting stale data. Actual HTTP/WS regression fixtures delay the join-state read and inject a false write acknowledgement without bypassing production handlers.
- Canonical skill hit schedules enforce earliest release with100ms tolerance and bounded cast windows/counts. Invalid-range, early and transaction-blocked requests consume no hit. Kits bind their first accepted primary/spawn; server-selected splash/chain remain separate. Same-skill replacement, death and revival invalidate old budgets. Damage formulas and authored schedules are preserved.
- NPC/shop contacts use the server clock phase and current outdoor anchors. Home refuses contact; exact class-hall coordinates and individual night schedules remain. Buy/sell/refill/refine/card removal and quest interactions share this phase contract. Packet-supplied phase does not grant availability.
- Account deletion clears local character/UID only after HTTP2xx plus body ok:true and captured identity guards. Pending selection prevents duplicate actions; refusal preserves the slot and appears in a live region. Save sync is single-flight, acknowledges only its captured successful bundle, retries failures with bounded backoff, guards token/epoch/slot/UID changes and removes lifecycle listeners when stopped.

## Resolved review blockers

The first review identified two login tails: DELETE/rename could race an awaited snapshot before a Combatant existed, and flushEntry could resolve after a failed write while marking the old entry dirty. Both source paths now fail closed. The final review approved these tails and the deterministic regression implementation. QA subsequently executed the amended login/related tests separately from its preceding full-suite freeze.

## Changed implementation files and validation

Login: `server/index.js`, `server/accounts.js`, `server/login-state.js`. Skill timing: `server/combatants.js`, `server/skill-hit-timing.js`. Current NPC contact: `src/data/npcContact.js`, `src/data/shopSites.js`, `server/progress.js`, `server/class-quests.js`. Account acknowledgements: `src/account/ServerAccounts.js`, `src/account/screens.js`.

New regression files cover login state/real online login, skill-hit timing, NPC phases and account network acknowledgements. Existing combat and online integration fixtures now advance authored hit time or supply canonical initial saved positions. The optional PostgreSQL fixture uses the supported daytime startup clock for normal-shop checks. Module READMEs, AGENTS hooks, online safety and class quest docs describe the contracts.

QA recorded 1349 full-suite passes with three conditional skips before the narrow final login/UI tails; final related tests passed20/20, native browser checks12/12, and the final build passed. A separate real PostgreSQL rerun subsequently passed1/1 with67checks and actual restart/shutdown durability. Reports preserve the initial fixture failures and exact freeze provenance. Art approved the six unedited account-selection screenshots. No changes are deployed by this task.

## Deliberate limits

Existing new-slot/local-import saved-location policy remains; this is not a redesign of imports or Guest authority. The blow wire has no per-hit/cast receipt identity: a duplicate arriving when another hit is due can consume that due slot, but cannot exceed its schedule/target/count budget. Contact uses registered current-phase route anchors within12m, not synchronized exact wandering positions; client schedule changes may lag the server. Final keepalive cannot guarantee delivery after abrupt tab/process termination. Native checks and the optional PostgreSQL audit belong to QA reports, not this reviewer's executed claims.
