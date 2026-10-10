# Hunter dog gameplay handoff

PASS: `final-3` completed 11 cases, 51 screenshots and 657 geometry sample
snapshots in the actual hunter VFX review scene. One headless Edge instance and
one page were used and closed. The browser capture slot is free. The helper and
outputs are frozen for the parent's final review.

The loaded production GLB returned HTTP 200 with 831,080 bytes and SHA-256
`341c647c886e302e4485511481042df5abde243a66a8b2ff8ac8668e29caa541`, matching
the published release, local file and file after capture. All pinned source
hashes remained unchanged. The [machine receipt](report.json.gz) has no failures,
page errors or failed requests. It records one console resource-404 warning
without a URL; its cause was not established, and the required dog load passed.

Run from the hunter-dog worktree, using a fresh output label:

```powershell
node tools/hunter-dog/gameplay-qa.mjs --published-sha256 341c647c886e302e4485511481042df5abde243a66a8b2ff8ac8668e29caa541 --label <fresh-label>
```

## Follower and attacks

Actual `Character`, `Combat`, `CombatView`, production `makeDog()` and the
wrapped hunter skill runner were exercised. `CombatView` created the real
nontransient follower at scale `.8`, with one skinned mesh, 8,915 vertices and
38 bones. `followerDog()` resolved that same instance throughout the run.
Native `Combat.updatePet` moved and settled it at the heeling position.

Both normal and `aspd +.35` autoattack cases observed actual cooldown resets
starting the production animation at bite phase `.55`, advancing recovery,
clearing after `.25` seconds, and aligning the next attack again. The expected
cooldowns were 1.2766 seconds and .8216 seconds; observed reset spacings were
1.291667 and .825 seconds, within the two-frame tolerance. Actual pet-bite
events recorded damage `7` in the baseline case and `8,6` with haste. No world
autoattack borrowed or duplicated the follower.

All borrowed-dog cases hid the world follower while `away`, then returned the
same visible follower with both away flags cleared. Transient actors retired;
no actors remained at case completion. Every case restored its exact sampled
local idle bone pose. Busy casts were rejected without replacing the active
skill. Recasting a dog command while away reused its existing transient actor.
Poison hold callbacks retained their original skill ID after a quick-arrow
cast unlocked.

## Observed skill damage

These are the actual production FX-preview callback values and the seeded
dummy's resulting `onHit` values, not authoritative character/server damage.
`*` marks a raw callback with its critical flag set.

| Case | Raw preview damage | Actual dummy damage | Maximum skill dogs |
| --- | --- | --- | --- |
| `arch_poison` | 150*, 70, 70 | 165, 73, 76 | 1 |
| `arch_garuda` | 90 | 84 | 1 |
| `arch_rain` | 110, 110, 110* | 106, 120, 117 | 3 |
| `arch_snipe` | 120 | 128 | 1 |
| `arch_meteor` | 120 x5, 260* | 114, 111, 122, 125, 122, 255 | 3 |
| Repeated poison | 150*, 70, 70 | 148, 76, 74 | 1 |
| Late callback ownership | poison 150*, quick 95, poison 70, 70 | 162, 91, 76, 69 | 1 |
| Borrowed command recast | garuda 90 | 89 | 1 |

Callback, `dummy.hurt` and `onHit` counts, order, ownership and frame pairing
passed. Rain and meteor each witnessed two additional real skinned glowing
spirit dogs alongside the borrowed dog.

Poison currently deals its first dog hit through the leap's existing `onLand`
callback, followed by hold ticks. The captured landing frame coincides with
`bite=u*.55` at `u=1`; no damage timing was changed. The separate bite-order
`onSnap` path was not directly exercised. Its `.55` entry in `attackContract`
records the inspected source contract, not an additional executed test.

## Images inspected

The following 12 actual captures were inspected for follower presence,
attack/recovery, skill copies, hide/return and gross visual integrity:

- [World follow](world-follow-trot.png)
- [Normal bite phase .55](world-autoattack-impact-055.png)
- [Normal recovery](world-autoattack-recovery.png)
- [Repeated normal bite](world-autoattack-repeat-impact-055.png)
- [Poison airborne preparation](arch_poison-airborne-preparation.png)
- [Poison landing and damage](arch_poison-landing-bite-055.png)
- [Howl](arch_garuda-action.png)
- [Spirit pack](arch_rain-action.png)
- [Snipe dog action](arch_snipe-action.png)
- [Meteor and spirit copies](arch_meteor-action.png)
- [Repeated poison return](arch_poison-repeat-returned.png)
- [Command recast return](borrowed-command-recast-returned.png)

The published hound remained recognizable in the checked frames and returned
without a duplicate world follower. Large existing skill effects partly
occlude dogs; these overview captures are integration evidence, not a close
anatomy or art-quality gate.

## Preserved failures and scope

`final-1/report.json` is preserved: no cases completed because the helper's
unversioned dog import created a second module registry beside Vite's served
timestamped import. Only the helper changed to import that same served URL.
`final-2/report.json` and its 19 captures are preserved: four cases completed
before a transient Windows receipt-write error. Only helper receipt writing
changed to temporary-file/rename with bounded retries. Neither fix changed
production behavior or acceptance gates.

Owned changes are `tools/hunter-dog/gameplay-qa.mjs` and this gameplay review
output tree, including `PREPARATION.md`, the three receipts and captures.
No runtime, fixture page, asset, other tests or shared files were edited.
No build, full suite, commit, model API or server action was performed.

Limitations: this is component integration in the existing review scene, not
full Game/KitCaster/server, account/profile, live terrain or full-app guest
follow verification. The existing 3D `near()` preview check misses poison's
arrow at height 1.55/radius 1.5 and snipe's arrow at height 1.70/radius 1.6;
their dog callbacks passed separately. No authoritative balance claim follows.
Actual skinned vertices/transforms were checked for finiteness at 10 Hz and
capture frames; this does not establish all-frame strain/anatomy/contact/IK
approval. The closed generated mouth has no automatic jaw animation.
