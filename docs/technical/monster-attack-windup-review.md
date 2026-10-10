# Ordinary monster attack timing review

Game Director review approved the Tani and Phong windup implementation on
2026-10-10. Their approved animation contact times are 13/24 seconds and
0.5 seconds. Offline combat and the server queue a strike, validate its target
while pending, and release damage once. Other ordinary monsters retain their
existing immediate attack timing; boss skill timing is separate.

Reviewed files: `src/combat/monsterAttackTiming.js`, `Combat.js`,
`CombatView.js`, `MonsterModels.js`, `src/net/NetCombat.js`, `src/core/Game.js`,
`server/monsters.js`, and `server/index.js`.

The review covered cancellation on death, stun, invalid target and map cleanup;
spawn generations and attack serials; duplicate releases; missed start packets;
trade freeze; and preservation of attack cadence. A missed start still accepts
the authoritative damage release without fabricating an animation gather.

Independent QA reported 872 tests: 870 passed, zero failed, two skipped. The
build passed with 298 modules. Fresh browser QA continuously played the real
CombatView attacks and observed unchanged HP before contact, then one hit at
contact. Server simulation fixtures released Tani at 0.6 seconds and Phong at
0.5 seconds. Tani's 58.3 ms delay is within one 10 Hz server tick.

Screenshots and results are retained locally in
`artifacts/all-monster-models/runtime-qa/`, named `tani-windup-*` and
`phong-windup-*`. Exact body hashes and screenshot hashes are recorded in their
individual QA approvals under `docs/art/monsters/meshy-roster-20261010/`.

Limits: genuine multiplayer WebSocket latency, reconnect and trade sessions
were not exercised by this browser check; server and route fixtures cover
those code paths. SwiftShader screenshots do not establish production frame
rate or online soak behavior. This review does not establish completion of the
67-model roster or deployment to UAT.
