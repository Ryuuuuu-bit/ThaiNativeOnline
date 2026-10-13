# City residents

## Hooks

`NPCManager` prepares the authoritative schedule without changing its contact
phases, then selects the visible plan through `presentationActivityFor`.
Only existing ambient city residents may use `def.daytimeRoutine`, authored in
`data/compactCityNpcs.js`. This override applies in the day phase and never to
shops, trainers, warp/storage keepers, faction guards, home activities or wilderness residents. Quest
and server contact code continues to call `NPCSchedule.activityFor` directly.
The renderer also derives a protected ID set from every quest giver, turn-in,
talk objective and class master. These IDs always retain the original plan,
even if content attaches a routine later. Ambient dialogue sends no server talk
operation unless that NPC is an active quest talk objective (`NetProgress`).
Day route order rotates by stable resident ID to spread initial activity;
later phases retain their original plans and normal walking transitions.

`NavGraph.fromCompactCity` retains collision-aware links between districts and
adds short, clear local links between nearby anchors. It uses the loaded
World's `canStand` predicate, including buildings, gardens and portal pillars.
Port cargo and temple circuits can follow local paths instead of crossing the
plaza between every pair of stops. Global legacy J and wilderness roads stay
unchanged.

## Animation and verification

Skinned city NPCs carry retargeted ActionForge motion (CC0, recipe in
`tools/npc-models/retarget-gait.mjs`): a mocap walk whose clock follows the
distance walked (`walkStride`), a standing `idle` loop and a `talk` loop. A
profile's `mocapClips` lets those clips drive standing and talking: the adapter
keeps the clip's body (relaxed arms, breathing, weight shifts, gestures) and adds
only the authored head look and lean. Work, prayer and sitting still start from
the measured idle stance, which their authored limb angles are measured against.
`gate_supplier` keeps its native clips: its Meshy skeleton does not follow the
body, so retargeted motion folds its limbs. Talking pauses the runtime plan
through the existing NPC interaction contract.

`tests/compact-city-life.test.js` checks presentation isolation, safe targets,
local graph clearance, real NPC planning/movement and stationary animation.
The DOM-free population helper builds production collision (including portal
pillars) and runs NPCs for 120 seconds at 10 Hz with midpoint pause durations.
It does not measure frame rate or verify the browser's final appearance.
