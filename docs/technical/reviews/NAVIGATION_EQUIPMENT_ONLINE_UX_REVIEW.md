# Navigation, equipment and online UX technical review

Application source reviewed: `cbe2a377471ebd42603991179d5e99d0f970f56a` on
`codex/navigation-equipment-online-ux`, including equipment `24a2c99`,
navigation `f660272`, touch-side clearance `0f3bad3` and the final bounded
location-authority correction `cbe2a37`.

Decision: **APPROVED for application semantics and authority preservation**.
The independent ordinary-account PostgreSQL audit, full suite, production build
and bounded native browser behavior checks passed. Later classic CSS contrast
and Art gates passed independently at `689e3da`; this source review does not
claim exhaustive UX, production capacity or physical-device certification.

## Scope and ownership

The change supports the vision's orthographic readability and Thai identity
within the existing region. Gameplay engineering owns the quest guidance,
measured HUD placement and equipment comparison. QA owns authenticated HTTP/WS
and PostgreSQL tests; Art owns visual readability. This Director review changes
only this document. There are no new quests, balance changes, dependencies,
automatic combat, automatic portal transfers or asset redesigns.

## Navigation and HUD

`questGuidance` consumes the current objective, player position, current map and
camera basis. Active guidance points toward the next remaining collision-path
waypoint and sums the remaining route segments. Idle guidance explicitly labels
direct distance. A cross-map target measures the current portal rather than
coordinates in another map. Unavailable contacts suppress direction and distance;
blocked-route messages retain precedence. Arrival remains an instruction to act
manually and does not claim arrival while an active detour remains.

Game supplies only the active quest route; unrelated manual/combat paths are
excluded. The change neither initiates movement nor alters QuestNavigator's
existing cancellation, AUTO refusal, modal/manual input, map change, death or
disconnect contracts. Quest progress and rewards remain server authoritative.

Touch placement measures full `.location`, including its subtitle and safety
indicator, the player's full painted title/name plate, minimap/profile/chat and
gameplay controls, including the separately appended `.touch-side` potions/AUTO
row. A 138px chip searches two edge columns with a safety gap and
falls back to the existing registered journal when no safe space exists.
Desktop full-card/compact fallback remains intact. The mobile status line and
distance line are separate; accessible labels retain the complete objective and
status. Independent browser retake recorded 40 touch states with zero protected
intersections; Art remains the readability gate.

## Equipment comparison

`previewEquipment` reads existing Character getters through an isolated
`Object.create(character)` view with copied equipment, cards, refinement and
validated roll maps. It invokes no Character constructor, equip operation,
events, RNG, save or network operation. The candidate replaces the same slot as
Character.equip: use a free second accessory when appropriate; replace the first
when both are occupied. Existing class, level and death restrictions are
preserved; item locking continues to permit wearing equipment.

The before/after table includes currently exposed numeric getters, active buffs,
passives, night effects and existing caps. Lower MP consumption has the correct
benefit direction, and ratio deltas use percentage points. Native values,
refinement, affixes and cards remain separately labelled. Conditional card
abilities are described separately rather than projected as fixed damage.
Approximate class score wording no longer claims that every stat improves.

Updates replace only the comparison subsection, retaining action buttons during
HP ticks. Explicit equipment actions still use the existing Character and
NetProgress paths. This is a current-state comparison, not expected DPS, future
buff state, resource refill or target-specific damage prediction.

## Isolated online audit methodology

The candidate QA test uses real account registration, authenticated HTTP slot
APIs, real WebSocket operations, the production server and PgStore. Database
guards require a loopback host and a task-specific `qa_nav_equipment_` database;
configuration and credentials remain outside tracked source. It must never use
UAT users or UAT storage.

Only a separate setup account is a protected bootstrap GM. Temporary fixture
roles are removed before ordinary operations, with private `gmAccess:false`
acknowledgements; ordinary welcomes also assert `admin:false`. Fixtures provide
resources and position through real commands rather than inserted quest
progress or monkeypatched protocol/storage. The audit exercises allocation,
flask instance metadata/lock, ordinary quest acceptance/talk/hand-in and replay
refusal, service travel, shop conservation, party leave/disconnect, durable trade,
stale HTTP snapshot protection, authenticated rejoin and graceful server restart
against the same database. Exact mana-flask IID/charges move once to the recipient
and survive both participants' rejoin/restart. The actual second paddy channel
opens under the unchanged crowd rule using 32 ephemeral local Guest sockets;
the ordinary participant's channel transition retains private non-GM metadata.

The completed receipt includes all restart inventory/location assertions and
the final clean shutdown/error check. It records one application restart, two
graceful shutdowns (its `restarts` counter counts shutdowns), and removal of the
three exact fixture accounts. A normal suite skip without private configuration
does not certify PostgreSQL. This gate does not certify abrupt process-loss
recovery, every channel/party permutation, production capacity or physical-device
performance.

## Location regression and correction

Real PostgreSQL QA exposed a stale authenticated PUT that preserved trade
gold/inventory but replaced saved city(-6,52) with older client city(15,43).
The correction captures the matching live Presence entry synchronously after
request-body, busy and Character UID guards, using server map/x/z/facing. Accounts
clones the trusted snapshot before enqueueing. Inside the existing slot FIFO,
existing saves strip all incoming versioned location keys and restore the
captured live position, or the latest stored location after earlier queued
trade/flush writes. A legacy existing slot without location retains the normal
spawn fallback; genuinely new imports retain their previous behavior.

SaveQueue barriers/coalescing, inventory revisions, Character UID matching and
create-only behavior are unchanged. Regressions cover immutable snapshots,
queued fallback/order, stale version keys, missing legacy location and an old
Character UID after slot recreation. Final PgStore evidence preserves
city(-6,52) before and after the stale snapshot and through API-based rejoin and
restart. Login's existing coordinate protocol is outside this bounded save fix;
the audit reads the actual saved position rather than supplying a convenient
hardcoded hello position.

## Verification receipts

- Navigation specialist reported **22 passed, 0 failed** targeted guidance,
  navigation and geometry tests at the application freeze.
- Equipment specialist reported **8 passed, 0 failed** targeted comparison tests.
  Review inspected getter/equip equivalence, mutation protection, true accessory
  destination, restrictions, caps, conditional cards and percentage wording.
- Touch-side geometry correction: root reported **9 passed, 0 failed** targeted
  placement tests. Server location correction: specialist reported **27 passed,
  0 failed** targeted account and online-safety tests.
- Dedicated ordinary-account PostgreSQL audit: QA reported **1 passed, 0 failed,
  0 skipped**, **67 passing receipt checks**, 16.942 seconds. Review inspected
  the actual completed ignored `postgres-receipt.json` and test source; no UAT
  account/storage writes were made.
- Native browser report: final **40 touch layout states, 0 protected
  intersections**, **18/18 behavior checks**, **2/2 pointer/focused-key checks**,
  **1/1 journal fallback**, and **0 uncaught page errors**. Native screenshots and
  scope are recorded in [UI QA](../qa/navigation-equipment-ui.md).
- Director performed read-only source/diff/test-contract review; no additional
  test run is claimed here.
- Final independent QA at behavior/server freeze: **1,298 total / 1,295 passed / 0 failed / 3 skipped**,
  43.813 seconds. The optional PostgreSQL test is one of these skips and passed
  separately above; it is not certified by a default-suite skip. Production
  build passed with 355 modules in 1.10 seconds, retaining the existing large
  chunk warning. Root verified the preserved QA logs after this source review.
  Later CSS-only correction at `689e3da` passed four contrast fixture sets,
  six classic interaction checks and a fresh 355-module build in 547 ms.
  Art independently approved style 9, readability 8.5 and technical usability
  8.5; see the [Art review](../../art/reviews/navigation-equipment-online-ux/ART_REVIEW.md).
  Screenshots belong to the UI QA report; this source inspection did not
  generate them.

Known limitations: unavailable moving NPCs remain subject to existing schedule
and live resolver availability; hidden cramped-screen objectives remain
accessible through the journal. Read-only guidance cannot guarantee a live
monster or item drop at a public hunting area. No save format change has been
introduced; existing location authority is enforced by the bounded server fix.
