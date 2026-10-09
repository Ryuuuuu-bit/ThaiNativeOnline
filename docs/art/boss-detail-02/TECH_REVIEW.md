# Meshy bosses Lv50–100 — independent technical review

2026-10-09 · branch `codex/meshy-bosses-level-50-100` · authority:
[GAME_VISION](../../GAME_VISION.md), [ART_BIBLE](../ART_BIBLE.md),
[ARCHITECTURE](../../technical/ARCHITECTURE.md) and this batch's director brief.

**Current all-six batch Technical: 8.5/10 — PASS within the reviewed scope.**
All six final deliveries pass five-clip native skin, sampled limb, flat-floor and
applicable attachment checks. The Giant/Garuda numerical holds, Rift arm-coverage
finding and Naga export-recovery finding are closed. The fresh audit binds its
results to the exact public bytes and frozen rig reports. The packed editable
source verifies against its completed export receipt and read-only reopen.
**No remaining demonstrated technical P1/P2 blocker was found in this scope.**

This assessment covers implementation, durable numerical evidence, resource
ownership and source delivery. Parent/Descartes separately report the current
all-six Art gate >=8 and 30 fresh compression closeups accepted as coherent
creases with stated occlusion limits. That visual judgment is attributed to their
review; it was not repeated here. The limits below do not claim every live cast,
terrain placement or physical device was tested.

## Final evidence and identity

The durable [aggregate runtime audit](runtime-qa.json) contains six rows, no
errors and no failures. Its SHA-256 at this review is
`a3c572c225093ff1a943f259dbb4d8b287579610eb59ca8f0da1a0b96f44230e`.
The per-type rows match their individual durable files. Audit timestamps span
2026-10-09 11:58:56–11:59:26 UTC.

| Delivery / durable audit | Final public GLB SHA-256 | Triangles / bones | Packed bytes | Five clips |
|---|---|---:|---:|---|
| [Naga: sunken_city_3](sunken_city_3-runtime-qa.json) | `4fa20542ebb027ee11295de31a39892c332a4b1811e9460e2d628af84c965bea` | 12,548 / 6 | 1,559,336 | PASS |
| [Dusk: dusk_fort_3](dusk_fort_3-runtime-qa.json) | `e570992477ed5a48f59382f333b6739f6b01dc0c1c82ddc29697b79b1ca9a36a` | 12,495 / 16 | 1,581,120 | PASS |
| [Giant: giant_valley_3](giant_valley_3-runtime-qa.json) | `bbbb0fc757216a69b1fcfff649e300010e8bf4b007c9f85b6338a7d81d546915` | 12,489 / 17 | 1,437,052 | PASS |
| [Garuda: himmapan_3](himmapan_3-runtime-qa.json) | `87187a592ed037f2e3a394db3f8fe7fc484d8b0388eb2dd273ccffd3d80ffd45` | 12,528 / 18 | 1,578,368 | PASS |
| [Fallen: fallen_city_3](fallen_city_3-runtime-qa.json) | `6fc4a6fad3cb82d4ebfd85ac0e71e99f22598b4fb8e49355c3f748e2fb3c8e0e` | 12,465 / 17 | 1,484,852 | PASS |
| [Rift: demon_rift_3](demon_rift_3-runtime-qa.json) | `5f622db6ac315aa0632e5ddc8f2a35a944daff830236fbc8872bb39a3316371a` | 12,504 / 16 | 1,496,980 | PASS |

[qa_boss.js](../../../tools/monster-models/meshy/qa_boss.js) hashes the exact
fetched ArrayBuffer passed to `parseAsync`.
[qa-runtime.cjs](../../../tools/monster-models/meshy/qa-runtime.cjs) records the
frozen rig-report hash, audited GLB hash, native loaded network-response hash and
local-file hash, checking the local file before and after each audit. Independent
offline verification confirms all six `asset.sha256`,
`provenance.localGlbSha256` and `provenance.nativeLoadedGlbSha256` fields match
the current public GLB bytes; each `provenance.rigReportSha256` matches the frozen
report. This closes the earlier provenance concern. The maintained runner is
environment-configurable and contains no private authentication requirement.

The Git byte-portability finding is also resolved: scoped `-text` rules in
[.gitattributes](../../../.gitattributes) preserve frozen rig JSON and durable
audit JSON bytes against `core.autocrlf` normalization. Offline checks confirm
all six staged rig-report blobs equal their working files and the audit-pinned
`rigReportSha256` values. No model or numerical criterion changed.

Each public delivery retains one skinned draw, fewer than 15,000 triangles and
less than 3 MB. Reports include decoded base-colour 1024² and normal 512² textures,
normalized weights and at most four influence slots. These structural budgets
do not establish physical-device FPS or memory use.

## Numerical gate and closed findings

Indexed edge sampling retains the unchanged rule: a rest edge at least 5 mm fails
only when stretch ratio exceeds 2 **and** extension exceeds 1 cm. Sampling includes
exported clip keys and 24 Hz poses; native controller floor sampling is separate.
All five bipeds cover eight upper/lower arm and leg segments. The largest sampled
limb-length error is approximately **0.0224 mm**, below the unchanged 5 mm limit.
The worst native flat-floor penetration is approximately **0.552 mm**, below
10 mm. Naga has no biped limbs; its 7,820 supporting GroundCoil vertices retain
zero measured drift in all five clips.

Giant and Garuda's final death edge maxima are **1.949622** and **1.579033**,
with zero edge failures. Their earlier 25/12 failures are resolved by continuous
source-topology weight fields around hanging cloth and the waist. Source geometry,
bone arrays, reaction motions, Club/wing masks, hands and soles were preserved.

| Frozen corrective recipe | SHA-256 | Durable proof |
|---|---|---|
| [Giant anatomy](../../../tools/monster-models/meshy/rigs/giant_valley_3-anatomy.json) | `e4277c501a4688f287867f6ed8b68b89d8d2480f5de8fadcb7900e458b149dc7` | [weights fix](giant_valley_3-weights-fix-proof.json) |
| [Garuda anatomy](../../../tools/monster-models/meshy/rigs/himmapan_3-anatomy.json) | `599a90bb381488fbc4bfb41fb9511ebff5d97d845bc6afcf703d5cb934942179` | [reaction weights fix](himmapan_3-reaction-weights-fix-proof.json) |

The proofs reproduce the predecessor failures and eliminate them with the same
timelines, exact weights and rounded weight encodings. Fresh native final reports
now provide the delivery closure; the offline proofs are supporting evidence.
Frozen anatomy hashes match their rig reports and calibrations in
[rigs](../../../tools/monster-models/meshy/rigs/).

Rift's current report includes ArmLUpper, ArmLLower, ArmRUpper and ArmRLower as
well as all four leg segments. The older missing-arm finding is closed.

Applicable rigid attachment matrix checks pass all five clips: Giant Club/HandR
maximum approximately 1.13e-7; Fallen Sword/HandR 1.07e-7; Garuda wings/Body
5.56e-7, below the unchanged 1e-4 limit. Rift/Dusk have no corresponding prop or
wing attachment. Matrix equivalence establishes common deformation, not physical
palm contact or a surface-distance measurement.

## Editable source and export recovery

The delivered [map-bosses-50-100.blend](../../../tools/monster-models/meshy/scenes/map-bosses-50-100.blend)
is **12,140,638 bytes**, SHA-256
`1b5ddd1dd2b3a948f2a1349b343b0b614c286cc1f63ce6be53cf1dea3593c310`.
Its bytes/hash match [source-export.json](source-export.json) and
[source-reopen.json](source-reopen.json). The sanitized receipt's six rig-report
hashes match the current frozen files.

Read-only reopen succeeded with all six expected named armatures and surfaces,
**16 authored action records**, frame ranges 1–155, and no missing assets or
reported warnings. The actions comprise five biped rig actions, ten leg-target
actions and one Naga rig action. These are source authoring actions; the six
public models each separately deliver idle/walk/attack/hurt/die clips.

Parent reports `rig.inspect` was rejected by the read-only policy, with no
workaround. The durable reopen proves object/action presence and resolvable asset
references; it does not independently inventory every modifier, bound weight or
packed-image flag. Delivered skin and clip usability are independently covered
by the public native audits.

[naga_rig.py](../../../tools/monster-models/meshy/naga_rig.py) now delegates
export/collect to the shared guarded snapshot exporter after asserting
`sunken_city_3`, serpent taxon and empty legs/arms. Export-only species allowance
does not admit Naga into the biped bind/pose path. Prepared jobs retain reserved
identities, unknown submit responses recover through that same identity, and
changed external scene/report snapshots are rejected rather than silently
rebased. Own completed operations advance the journal revision sequentially.

Offline fake-client regressions cover prepared same-ID resume, unresolved
response recovery, stale scene/report rejection and invalid species/preparation
before transport. Parent then verified both reserved final-source-pack GLB and
BLEND jobs complete without duplicates; their artifact/snapshot hashes were
checked offline. The former transient exception and unattempted old individual
BLEND reservation are not blockers for this verified fresh packed source.

## Runtime implementation assessment

- BossMaterial applies scoped fog attenuation after material cloning, preserving
  native linear/Exp2 fog and an appropriate program-cache key. Cached source
  materials remain untouched; no new runtime lights or global fog were added.
- Feedback restores baseline emissive colour, intensity and map, handles material
  arrays and uses `max(1, baseline)` for broad untextured hit/status feedback.
  Death dim owns RGB separately. Tests cover .35 fill, zero/default glow, arrays
  and clone isolation.
- Cached geometry ownership follows the geometry object, so independent clones
  remain owned. Release deduplicates owned geometry/material/skeleton disposal,
  releases InstancedMesh buffers and preserves shared cached geometry/textures.
- VFX consumes authoritative windup/impact/cancel events. Expiring a predicted
  warning does not synthesize an impact or damage. Serial checks, death/despawn/
  map-clear paths and disposal are present. Existing tests cover locked aim,
  ring safe holes, terrain footprints, cancellation and both skill paths.
- No server/stat/spawn or boss skill-data edits were found in the reviewed batch.
  Presentation changes include scoped fog/fill, anchor/facing and action-state
  reporting in addition to the six model specifications.
- Biped tools reject serpent/ordinary species before source authoring, preserve
  explicitly authored rigid regions and remain side-effect-free on import.
  Calibration is bound to anatomy/rest hashes. Queries use registered transaction
  handling and the `{items}` job-list contract.
- Naga retains its measured six-bone serpent skeleton and fixed GroundCoil source
  mask; hood vertices belong to neck/head. Species extraction produces exactly
  five delivered clips. No biped retargeting, automatic weights or procedural
  replacement bodies are claimed.

## Limits of this PASS

Physical 1 cm rigidity / 8 cm palm-contact limits are not established by matrix
equivalence alone. Detailed grasp plausibility belongs to the separate visual/
contact review. Garuda's rigid Body-child wings represent the authored folded
shape, without claiming independent wing-fold animation.

Idle foot-origin sampling is not an all-clip surface sole/sliding or slope-IK
test. Actual-game capture receipts establish loading/presentation for their
listed hashes and conditions; this review does not claim every live cast,
player-adjacent combat, terrain slope or device performance was exercised.

The earlier Giant waist triangle 8114 at 0.76666671 s and Garuda triangle 5576 at
0.90000004 s had area ratios 0.003322 and 0.020155. No new area threshold is
invented and a small ratio alone is not a visible-collapse finding. Parent/
Descartes report the fresh 30 compression closeups accepted; that closes their
visual gate. This technical review accepts the unchanged numerical gates and
does not independently repeat those exact-camera judgments.

## Validation and handoff

Independent focused validation: **39/39 Node tests PASS**, including 23 embedded
Python checks. Motion-boundary tests preserve the original three full 155-frame
pose hashes, legacy .025/.012 hurt defaults, explicit zero/partial override
preference and calibrated arm bases; they exercise .20/.12 caps and reject
out-of-range, nonfinite, boolean and nonnumeric values. Export recovery uses
offline fake clients.

Parent reports **461/461 full tests PASS** and **build PASS, 233 modules**.
Independent focused work also completed the 233-module build; its existing
large-chunk warning remains. The later provenance-only QA changes were followed
by the parent's fresh six-model audit and another passing build.

The final refresh changes only this document. No new live/API/Blender calls,
windows, paid calls, geometry/motion edits, tolerance changes, staging or commits
were made. There is no remaining technical hold from this review; parent owns
the final combined Art/QA release decision.
