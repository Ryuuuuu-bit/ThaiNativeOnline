# Hunter dog gameplay QA preparation

Status: preparation completed and gameplay capture **passed in final-3** after
the parent's explicit release. See [the final handoff](final-3/REVIEW.md) and
[the machine receipt](final-3/report.json). One Edge instance/page was closed
after capture. The two earlier failed receipts are preserved.

```powershell
node tools/hunter-dog/gameplay-qa.mjs --published-sha256 <OWNER_RELEASED_SHA256> --label final-1
```

Defaults to the existing Vite at `http://127.0.0.1:5191`. `TNO_QA_URL` and
`TNO_PLAYWRIGHT_DIR` use the same conventions as the existing dog capture helper.
An incorrect public GLB hash fails before browser launch. The run uses one
headless Edge instance and one page, closes it in `finally`, preserves existing
receipts by requiring a fresh label, and saves screenshots plus `report.json`
under `docs/art/reviews/hunter-dog/gameplay/<label>/`.

The actual `tools/vfx-review.html?class=hunter` scene/model/renderer is used.
The idle original FX root is detached only within the temporary page. Actual
`Character`, `Combat`, `CombatView`, `createFx`, `createDummy`, and the wrapped
`CLASS_KITS.hunter.createSkills` build the instrumented scene. `CombatView`
creates the nontransient `makeDog()` follower at its production scale `.8`;
`Combat.updatePet` controls heeling. The helper observes existing APIs rather
than copying dog pose or skill-order code.

Cases: world follow; repeated actual pet cooldown strikes at baseline and
`aspd +.35`; `arch_poison`; `arch_garuda`; `arch_rain`; `arch_snipe`;
`arch_meteor`; repeated poison; late poison callbacks after a quick-arrow cast;
and replacing the borrowed dog's orders with a howl.

Checks include follower registration/identity/scale, hiding and `away` during
borrowing, GLB-skinned copies, return and transient retirement, unchanged
original skill callback ownership, raw preview hit sequence and actual dummy
`onHit` order, spirit copies/glow, busy-cast rejection, and idle pose reset.
World cooldown reset passes `.55` to the real animation callback; recovery and
the next native cooldown reset are captured. Poison captures native airborne
preparation and its actual leap `onLand` damage frame. In the current actor,
landing is `u=1`, and that same frame uses `bite=u*.55`. The separate bite-order
`onSnap` gate is `.55`; poison uses `onLand` and hold ticks instead.

Limits: component integration in the review scene, not full Game/KitCaster,
account/profile, terrain or authoritative server testing. The rules-damage hook
is logged without synthetic rolls; damage remains the real FX-preview fallback
and the dummy's seeded spread. Existing preview `near()` compares elevated hit
positions to a ground point: poison's arrow at `1.55 > 1.5`, and snipe's arrow
at `1.70 > 1.6`, do not contribute in this unchanged fixture. Their dog callbacks
are asserted separately (poison `150,70,70`; snipe `120`). This source-derived
limitation is not a new-model failure or a runtime correction.

Finite geometry checks sample actual skinned vertices/transforms at 10 Hz and
all screenshots; they do not approve strain, every-frame anatomy, IK or ground
contacts. The generated mouth is closed and has no automatically animated jaw.
Before/after source hashes and exact loaded GLB network bytes pin each run;
concurrent source changes/HMR invalidate its evidence.

Preparation validation: Node syntax check and help-only execution passed.
Released-candidate validation: 11 component-integration cases and 51 screenshots
passed; the loaded GLB hash matched the explicit release. No build, full suite,
server/API actions or commit were run.
