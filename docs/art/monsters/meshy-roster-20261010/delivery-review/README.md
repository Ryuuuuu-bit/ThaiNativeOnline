# Four approved monster models: delivery evidence

This pack covers only the four accepted bodies. The registry contains **37**
models: the immutable **33** previous approvals plus Nangram, Tiger, Tani and Phong. **30**
gameplay IDs remain pending. Recorded source-generation spending is **920** of
the authorized **930** credits; source success is not production approval.

| Body | Public GLB SHA256 | Bytes | Placement |
| --- | --- | ---: | --- |
| Nangram V4 | `d2acc98d0bd7c84bc3a2fbc02f1cb690d3291f9e852ff4293e781552ec81a285` | 1,663,708 | spec height 1.9 × gameplay size 1 = 1.9 m |
| Tiger V6 | `bd32b1bbc15978fbbe1531f84b8f27ba81a311d05a8f6b6b901c511294d5a1ca` | 1,909,436 | spec height 1.52 × unchanged gameplay size 1.25 = 1.9 m |
| Tani arm V8 | `87c340de1798aa82d5f816ec35105a879df0978721367b3b6007dc7b3a39d8d1` | 1,466,376 | spec height 1.5714285714285716 × unchanged size 1.4 = 2.2 m |
| Phong target V5 | `36455b5787785641fca1ae3604ece2925b47a5aaf129a0699e38603bb08a4a78` | 1,652,860 | spec height 1.9 × unchanged size 1 = 1.9 m |

The twelve separate hash-bound approval files are preserved:
[Nangram Art](../approved-nangram-v4-art.json),
[Nangram Technical](../approved-nangram-v4-technical.json),
[Nangram QA](../approved-nangram-v4-qa.json),
[Tiger Art](../approved-tiger-v6-art.json),
[Tiger Technical](../approved-tiger-v6-technical.json), and
[Tiger QA](../approved-tiger-v6-qa.json),
[Tani Art](../approved-tani-arm-v8-art.json),
[Tani Technical](../approved-tani-arm-v8-technical.json),
[Tani QA](../approved-tani-arm-v8-qa.json),
[Phong Art](../approved-phong-target-v5-art.json),
[Phong Technical](../approved-phong-target-v5-technical.json), and
[Phong QA](../approved-phong-target-v5-qa.json).
`production-roster.json` binds their exact file hashes. [evidence-index.json](evidence-index.json)
records the original local paths, sizes and SHA256 of the copies in this pack,
plus the unchanged approval-file hashes. No signed download URLs or tokens were
found in the copied reports. Runtime reports retain public Google Fonts URLs
that were blocked in the test environment.

## Actual game runtime

The newer [Tani production result](tani-production-windup-result.json) and
[Phong production result](phong-production-windup-result.json) observed registry37
in a fresh browser using registered public URLs, with no registry injection.
Each result includes gather, prepress, press and recovery screenshots copied here.
HP remained unchanged before press, then decreased exactly once: Tani at13/24 s,
Phong at0.5 s. The actual continuous CombatView animation matched those timings;
frames were advanced normally rather than seeking to the poses. Hurt, held death,
map/death cancellation, collision rejection, picking and disposal/rebuild passed.
Candidate QA approvals retain their original local source evidence references;
these separate production results prove the registered URL after admission.

[Tani full-mesh proof](tani-arm-v8-fullmesh-proof.json) samples138 actual exported
mesh frames. [Phong actual proof](phong-target-v5-actual-proof.json) samples135.
Their technical approvals define distinct edge policies and limitations.

[Nangram production screenshot](nangram-v4-production-game.png) and
[Tiger production screenshot](tiger-v6-production-game.png) were captured in the
actual game, in fresh browser contexts against the registered public URLs.
The source registry was not injected for these production checks. Results are
in [Nangram runtime JSON](nangram-v4-production-result.json) and
[Tiger runtime JSON](tiger-v6-production-result.json). Browser-served hashes
match the public GLBs above. Nangram's check observed registry34 after its own
admission; Tiger's later check observed registry35 after the second admission.

Both checks exercise `CombatView.ensure -> makeMonsterModel`, all five clip
selections, damage and lethal death, picking and invalid spawn collision,
map release, fresh controller rebuild, and removal of ephemeral view references.
Tiger's die action remains stopped at its one-second endpoint after seven
seconds of samples, with no idle return or looping; the corpse becomes hidden
and noninteractive. Each runtime check recorded zero page exceptions.

## Source animation and mesh evidence

- Nangram: [attack impact](nangram-v4-attack-impact-game.png),
  [death endpoint](nangram-v4-die-last-game.png),
  [full mesh report](nangram-v4-fullmesh-proof.json).
- Tiger: [attack midpoint/impact sample](tiger-v6-attack-mid-game.png),
  [death endpoint](tiger-v6-die-last-game.png),
  [actual mesh edge report](tiger-v6-actual-boss-proof.json).

The Tiger screenshot keeps its original `attack-mid` name rather than relabeling
it as a different captured frame. Its report records `proposedWeightsSha256`
and `sourcePositionsSha256` as null and `tailDeathCurl` as zero. The inherited
method string contains a counterfactual suffix; these disabled parameters and
the actual body hash establish that this report sampled the exported V6 body,
not an alternate weight or motion candidate. The technical approval specifies
the applied boss edge policy. Nangram uses its explicitly recorded robe edge
and floor policy; their thresholds are different and should not be conflated.

## Validation and limits

After all four admissions, focused asset/admission/timing tests recorded
**75 passed, 0 failed, 0 skipped**. `npm run build` passed with **298 modules**;
the existing large-bundle warning remains. Independent full-suite windup validation
recorded **870 passed, 0 failed, 2 skipped** before the two latest registry additions.
Documentation/evidence packaging did not require repeating these checks.

Browser checks used headless Edge with SwiftShader. They establish bounded
animation, picking, state and disposal behavior, not hardware FPS, multiplayer
authoritative-server correctness, or a long-running memory soak. Google Fonts
requests were blocked and a console404 occurred without model fallback.
Actual MonsterWorld10Hz fixtures released Tani at0.6 s (58.3ms after press) and
Phong at0.5 s, within100ms tolerance. Generation, lost-start and trade-freeze
validation uses automated fixtures; a genuine multiplayer WebSocket latency
session was not exercised by these browser checks.

Detailed source GLBs, measured vertex topology, explicit weights, rest
calibration, pose plans, original/rejected exports and Harness receipts remain
in local ignored artifacts. The copied final reports and screenshots are
durable review evidence, but this pack does not claim that a fresh checkout can
regenerate the exact bodies without those retained authoring inputs and runtime.
The full-roster completion CLI intentionally remains incomplete while30IDs are
pending; focused admission passing does not establish that milestone.
