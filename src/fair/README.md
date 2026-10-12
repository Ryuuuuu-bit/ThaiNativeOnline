# Temple fair

Three city stalls use the same `FAIR_SITES` records for rendered reservations,
map destinations, F interaction and server proximity checks. `fairRules.js`
defines opening hours using the world clock: evening/night, 16:30–05:00.

`TempleFairPanel` renders rules, targets and confirmations. `Game` owns modal
movement/camera gating and preparation; `Multiplayer` connects its transport.
`NetFair` predicts only target presentation. It never changes character gold.
Only authenticated online characters may play for the existing in-game currency.

`server/temple-fair.js` validates the live identity, city position, clear contact
line, combat/trade state, stake, round ID, shot cadence and server receipt time.
The five-shot skill games start free and charge their net fee only on completion;
interrupted rounds cost nothing. Their maximum refund equals the chosen stake.
Stakes are any whole 20–1,000,000 ตำลึง (`isFairStake`); the panel adds quick picks,
half, all-in and a second press from 100,000.
Dice resolve three independent server CSPRNG symbols with published payouts.

Settlement reuses `Accounts.trade` with one participant: an immutable snapshot,
durable receipt and inventory revision commit together through the save FIFO.
`tradeBusy`/`tradeTask` protect accepted settlement from other mutations, logout
and shutdown; queued combat rewards drain after commit. There is no client gold
operation or new save field. In-memory development storage is not durable.

Unfinished skill rounds belong to the current live character state: reconnect
discards them for free. A settled request does not: its outcome is stored with
the durable trade receipt (key `fair:<characterUid>:<request>`), so replaying
that request ID after a reconnect returns the same result and receipt — from the
service's settled index, or after a restart from the store's receipt — with no
second debit or dice roll. The client must still wait for authoritative balance
sync and never invent a new request ID for an uncertain paid action. There is no
player-facing history. A saturated per-session request cache requires reconnecting.

Validation: `fair-rules`, `fair-sites`, `temple-fair`, `temple-fair-integration`
and client transport tests, plus visual QA. The design and explicit interrupted
round tradeoff are in `docs/design/TEMPLE_FAIR.md`.
