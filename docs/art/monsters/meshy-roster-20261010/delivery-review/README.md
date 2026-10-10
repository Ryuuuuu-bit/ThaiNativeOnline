# Nangram V4 and Tiger V6 delivery evidence

This pack covers only the two accepted bodies. The registry contains **35**
models: the immutable **33** previous approvals plus Nangram and Tiger. **32**
gameplay IDs remain pending. Recorded source-generation spending is **920** of
the authorized **930** credits; source success is not production approval.

| Body | Public GLB SHA256 | Bytes | Placement |
| --- | --- | ---: | --- |
| Nangram V4 | `d2acc98d0bd7c84bc3a2fbc02f1cb690d3291f9e852ff4293e781552ec81a285` | 1,663,708 | spec height 1.9 × gameplay size 1 = 1.9 m |
| Tiger V6 | `bd32b1bbc15978fbbe1531f84b8f27ba81a311d05a8f6b6b901c511294d5a1ca` | 1,909,436 | spec height 1.52 × unchanged gameplay size 1.25 = 1.9 m |

The six separate original hash-bound approval files remain unchanged:
[Nangram Art](../approved-nangram-v4-art.json),
[Nangram Technical](../approved-nangram-v4-technical.json),
[Nangram QA](../approved-nangram-v4-qa.json),
[Tiger Art](../approved-tiger-v6-art.json),
[Tiger Technical](../approved-tiger-v6-technical.json), and
[Tiger QA](../approved-tiger-v6-qa.json).
`production-roster.json` binds their exact file hashes. [evidence-index.json](evidence-index.json)
records the original local paths, sizes and SHA256 of the copies in this pack,
plus the unchanged approval-file hashes. No signed download URLs or tokens were
found in the copied reports. Runtime reports retain public Google Fonts URLs
that were blocked in the test environment.

## Actual game runtime

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

After both production admissions, focused asset/admission tests recorded
**40 passed, 0 failed, 0 skipped**. `npm run build` passed with **297 modules**;
the existing large-bundle warning remains. Prior parent full-suite validation
recorded **835 passed, 0 failed, 2 skipped** before these asset admissions;
that full suite was not rerun as part of this bounded delivery.

Browser checks used headless Edge with SwiftShader. They establish bounded
animation, picking, state and disposal behavior, not hardware FPS, multiplayer
authoritative-server correctness, or a long-running memory soak. Google Fonts
requests were blocked and a console404 occurred without model fallback.

Detailed source GLBs, measured vertex topology, explicit weights, rest
calibration, pose plans, original/rejected exports and Harness receipts remain
in local ignored artifacts. The copied final reports and screenshots are
durable review evidence, but this pack does not claim that a fresh checkout can
regenerate the exact bodies without those retained authoring inputs and runtime.
The full-roster completion CLI intentionally remains incomplete while32IDs are
pending; focused admission passing does not establish that milestone.
