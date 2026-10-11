# Navigation, equipment and authenticated online UX QA

Final authenticated persistence audit and combined QA gate on `cbe2a37`, including the navigation touch fix `0f3bad3`. QA owns the independent test harness, receipts and this report, with no application edits or production writes.

## Confirmed finding

Severity: minor/P2 (saved-location regression).
Environment: unpatched local `server/index.js`, dedicated loopback PostgreSQL18.6 database with `qa_nav_equipment_` prefix, real HTTP authentication and WebSockets.
Steps to reproduce: create two synthetic authenticated characters; temporary role-granted setup supplies points/gold/items/locations, then revoke roles before normal operations. Complete a normal trade at city(-6,52), which durably saves its authoritative position. Submit an older slot-data snapshot through authenticated PUT while the character remains online.
Expected: stale browser data cannot replace the online server position saved by the completed trade.
Actual: gold/inventory stay authoritative, but `tno.location.v1` changes city(-6,52)→city(15,43).
Evidence: ignored `confirmed-location-rollback.json` and `.log`; real PgStore audit reaches51 passing assertions before this failing regression assertion.
Suspected area: live PUT slot reconciliation in `server/index.js`/`server/accounts.js`; application owner is root/director-designated engineer. QA does not alter application code.
Resolution: `cbe2a37` captures trusted live location and strips client location versions during reconciliation. The strict real PostgreSQL retest now preserves city(-6,52) before and after the stale PUT, and after rejoin/server restart. Original failed evidence remains preserved.

Severity: minor/P2 (touch action obstruction).
Environment: headless Edge, isolated Guest, 320px touch layout, both skins.
Steps to reproduce: track newcomer supplies; inspect the idle/orbit objective chip beside AUTO settings.
Expected: navigation chip avoids actionable touch controls.
Actual: the chip overlapped AUTO settings by16×15 CSS pixels.
Evidence: initial UI receipt and native before capture, linked in [independent UI report](navigation-equipment-ui.md).
Suspected area: quest HUD protected rectangles; root added the separate `.touch-side` row in `0f3bad3`. Final40 touch states have zero protected intersections. This QA owner reviewed the UI owner's receipts; it did not duplicate the browser runs.

## Actual authenticated audit coverage

`tests/postgres-auth-persistence.integration.test.js` launches the real app against the private dedicated database. It verifies `store=postgres`; real HTTP registration/login/slot creation; allocation consuming3 points; actual generated flask IID and normal item-lock metadata; face-to-face acceptance/talk/hand-in of newcomer supplies; reward paid once and replay rejected; actual service map change/return; shop exactly2potion purchase and20gold deduction; two-player party join/leave/disconnect; completed trade durable balances and conservation; stale HTTP data cannot undo trade gold; rejoin and graceful server restart preserve allocation/points/quests/gold/inventory metadata/stable character UID and saved location.

Channel coverage opens the real second paddy channel with32 ephemeral loopback Guest sockets under the unchanged crowd rule, then switches the ordinary signed participant toCH2 and checks private non-GM metadata/stable UID. No channel thresholds are patched.

Only a separate protected setup account appears permanently in `ADMIN_IDS`. Participants receive supported transient role grants for explicit GM setup commands (stat/gold/item/map), then a real private `gmAccess.admin=false` withdrawal is awaited before normal operations. Rejoin/restart welcomes are explicitly non-GM. Quest progress is produced by real talk/complete handlers; no fabricated counters, PgStore overrides, prototype patches or MemoryStore substitutes.

On Windows the process wrapper accepts stdin `shutdown` and emitsSIGTERM, invoking the app's actual existing graceful shutdown handler, which drains saves and exits0. This transparently tests handler behavior rather than claiming Windows `child.kill()` is graceful. Rejoin reads stored location through the actual slots API as the client does; sending arbitrary default hello coordinates is not location-restoration evidence.

## Harness history and current results

Initial exploratory failures were corrected harness assumptions: successful ordinary ops do not always push a full sync (explicit supported `resync` now reads state), a cross-map GM presentation warp alone does not mutate authoritative room, and a party of2 dissolves onleave rather than keeping1member. These are not product findings. Prior permanent-GM participant evidence is superseded by the separate setup-root / revoked-participant audit. Available failed receipts are retained in ignored artifacts, with confirmed location evidence preserved separately.

Historical independent test:1 test,0 pass,1 fail,0 skip,26195.1076ms; failure was the stale live HTTP location assertion after51 successful checks. No failing assertion is hidden.

The final executed audit extends the ordinary trade with a second generated, unlocked mana flask. Its distinct UUID and unchanged charges, sole recipient ownership, source removal, stale-save duplication prevention, both players' rejoin/restart ownership, and conservation of both gold balances passed. The original locked HP flask remains a separate metadata-persistence fixture.

## Exact final validation

| Check | Result |
| --- | --- |
| Explicit real PostgreSQL integration | **1 test,1 pass,0 fail,0 skip;16942.0023ms** |
| Recorded audit checks | **67 successful checks**, plus exact equality assertions for flask metadata; one server restart and two successful graceful shutdowns |
| Fixture cleanup | Exactly3 current synthetic accounts deleted after teardown from the guarded task database |
| `npm test` on final source | **1298 total,1295 pass,0 fail,3 skip;43813.0689ms** |
| `npm run build` | Passed, **1.10s**; existing large-chunk warning remains |
| Final UI retake, independent browser owner | **40 touch states,0 protected intersections,0 uncaught page errors**;20 hidden-chip fallback states and1/1 explicit journal fallback |
| UI behavior | **18/18 navigation/equipment checks plus2/2 actual pointer/focus checks passed** |

The full suite deliberately omits `TNO_QA_PG_CONFIG`, so its third skip is this env-gated local-database audit; the explicit executed1/1 PostgreSQL result above supplies that evidence without repeating the same run. The other two skips remain visible in the full log. Logs/receipts are ignored `artifacts/navigation-equipment-online-ux/{postgres-test.log,postgres-receipt.json,npm-test-final.log,build-final.log}`. Receipt field `restarts:2` counts completed shutdown helper calls; the tested lifecycle is **one restart and two shutdowns**.

## UI evidence and changed files

The separate [browser QA report](navigation-equipment-ui.md) records48 initial layout samples, the confirmed narrow touch defect,40 final touch samples, actual route movement/cancellation/AUTO refusal, camera-relative arrow checks, real equipment comparison against disposable `Character.equip`, and focus/tooltip scrolling checks. It links eight unedited native screenshots under `docs/art/reviews/navigation-equipment-online-ux/`, including desktop walking navigation, fixed320px placement, enlarged390px HUD, comparison tables, scrolled actions, and journal fallback. Art verdict is a separate review; no physical-device or universal overlap-free certification is implied.

This audit owner's changed files are `tests/postgres-auth-persistence.integration.test.js` and this report. Application fixes are owned by the implementation specialists/root. UI owner maintains `navigation-equipment-ui.md` and the eight native captures.

## Safety and limits

The test reads private config without printing connection strings/passwords and guards loopback host plus explicit database name/prefix before any write. Synthetic accounts are created only within this dedicated database; current fixture cleanup deletes only the exact generated account IDs after server teardown. Root owns PostgreSQL cluster lifecycle. No UAT database/accounts/saves are touched. This is actual local authenticated PostgreSQL durability evidence, not production capacity, arbitrary rank progression, all rewards/shops or physical-phone certification.
