# Online logic hardening: isolated PostgreSQL addendum

Verified 11 October 2026 (Asia/Bangkok), worktree `artifacts/loading-worktree`,
branch `codex/online-logic-hardening`. This addendum covers the existing optional
real PostgreSQL audit; the [main QA report](online-logic-hardening.md) owns the
full `npm test`, `npm run build`, browser and other regression results.

## Finding, corrected test fixture

Severity: minor (test fixture; no new application bug confirmed)

Environment: Node 24.16.0, official portable PostgreSQL 18.6, real application
HTTP/WebSocket endpoints on loopback, fresh task database. No UAT requests.

Steps to Reproduce: Run `tests/postgres-auth-persistence.integration.test.js`
with its original live world clock, reach the ordinary city general-store buy
from the existing `(-6,52)` fixture, and assert a two-potion purchase.

Expected: A deterministic open-shop fixture spends 20 gold and grants two
potions. The production rule correctly refuses buying from an indoor/off-duty
NPC.

Actual: The first audit failed `normal shop gold conservation`: gold remained
540 instead of 520 and the potion count remained 8. The preceding 22 recorded
checks passed. First run: **1 test, 0 passed, 1 failed, 0 skipped**; subtest
5253.8932 ms, total 5314.802 ms. The live-clock fixture is consistent with the new
night/home contact restriction; no clock-packet receipt was captured, so the
exact first-run phase is an inference, not a measured value.

Evidence: ignored `artifacts/online-logic-hardening/postgres-qa-final/test.log`,
`postgres-receipt.json` and `result.json` preserve the failed run.

Suspected Area: test startup in
`tests/postgres-auth-persistence.integration.test.js:20`, owning root/QA.

Correction: Root added the existing supported Node argument delimiter and server
CLI option, `-- --hour=10`, to `start()` for both initial launch and restart.
Database safety guards, ordinary operations and assertions were retained; no
production timing policy was weakened.

## Passing rerun

Command: `node --test tests/postgres-auth-persistence.integration.test.js`, with
`TNO_QA_PG_CONFIG` pointing to a temporary private config for a fresh, expressly
named loopback task database.

- **1 test, 1 passed, 0 failed, 0 skipped, 0 cancelled**.
- Subtest: **16729.198 ms**; Node total: **16790.6693 ms**; runner wall time:
  16847 ms; process exit 0.
- **67/67 recorded checks passed**. These are checks within one integration
  test, not 67 independent tests.
- Real HTTP registrations and slot creation, ordinary authenticated welcome,
  stable Character UID, allocation/points, locked instance metadata, quest
  accept/talk/turn-in and replay rejection, shop spending/granting, party lifecycle,
  channel transition, and exact flask IID/charges and conserved trade balances.
- Stale HTTP snapshots did not undo trade or roll back live saved position.
- Rejoin and one actual application restart retained allocation, quest state,
  UID, inventory metadata, recipient/source ownership and balances. Final saved
  position: city `(-6,52)`, facing `Math.PI`.
- **Two actual graceful application shutdown-handler drains**, zero recorded
  save errors, and **three fixture accounts removed**. Receipt field `restarts`
  counts the two stops; it does not mean two application restarts.

Passing evidence is ignored under
`artifacts/online-logic-hardening/postgres-qa-confirmed/`: `test.log`,
`test-error.log`, `postgres-receipt.json`, `result.json`, `postgres.log`,
`pg-stop.log`, `pg-final-status.log`.

## Isolation and cleanup

Used a fresh owned cluster/database, listening only on `127.0.0.1:54883`, with
trust authentication restricted to the local disposable cluster. The prior
historical audit cluster was not modified. Official existing portable binaries
were reused; no service, PATH, installed PostgreSQL, hosting configuration or
remote account data changed.

PostgreSQL shut down with `pg_ctl stop -m fast -w` (exit 0); final `pg_ctl status`
was exit 3, `no server running`. Independently checked: no task PostgreSQL
process, no application shutdown-wrapper process, and no listener on port 54883.
The temporary private config was removed. The optional test's hardcoded historical
receipt was backed up and restored with identical SHA; task receipts remain in
their own ignored folders. Earlier helper setup attempts were stopped too.

Only this new report was added by this QA agent. Root owns the one-line fixture
correction. No screenshots were taken: this audit exercises server persistence
and has no visible changes. The full suite and build were assigned elsewhere and
are not claimed as executed by this audit.

Limits: isolated local PostgreSQL and application, not production concurrency,
UAT database migration, browser sign-in, or physical-device testing. The audit
does not independently cover forged hello coordinates or all night contacts;
those checks belong to the login/contact regression suites in the main report.
