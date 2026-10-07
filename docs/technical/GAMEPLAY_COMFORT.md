# Session, carry and combat comfort

## Behavior

- Sessions persist across tabs/browser restarts using localStorage, migrating
  older tab sessions. Server tokens are still validated and expire under the
  existing 30-day policy. Both logout screens clear saved session state.
- Basic attacks approach only within `max(5, class range + 3)` world units;
  pending approaches cancel after six seconds or if the target escapes the
  permitted radius. In-range automatic swings remain available.
- Natural recovery is absolute rather than a percentage of maximum resources.
  HP/second = `min(8, 1 + VIT × 0.1)`; SP (MP internally)/second =
  `min(4, 0.5 + VIT × 0.05)`. Combat multiplies capped rates by 0.25.
  Sitting doubles them, still limited to 8 HP and 4 SP per second. Fractional
  elapsed time is retained; death and the existing 70% heavy cutoff still apply.
- Capacity is `5000 + STR × 30`. All six live material types weigh 0.1 each;
  HP/MP supplies weigh zero. Tenths are calculated as integer units at the
  weight boundary to avoid floating-point pickup failures. Equipment follows
  the lighter table in `docs/design/ITEM_WEIGHTS.md`.
- Boxer/warrior lunges and hunter/shaman retreat steps now sweep their movement
  in at most 0.15-unit increments, stopping or sliding on blocked geometry.
  Trees, water and walls keep their collision. This prevents newly landing
  inside obstacles rather than allowing unrestricted walking through scenery.

## Changed files

`src/account/session.js`, `src/account/index.js`,
`src/character/Character.js`, `src/character/data/{items,progression}.js`,
`src/combat/Combat.js`, `src/classes/fx/skillMovement.js`, the boxer/warrior/
hunter/shaman skill runners, `src/training/TrainingGround.js`, and tests
`gameplay-comfort.test.js` / `weight.test.js`.

## Validation and limits

275 tests and production build pass. Regression coverage includes session
migration/new tabs/logout, tenths at the weight boundary, pickup and shop rules,
recovery caps/combat/time accumulation, distant attacks/timeouts, thin-obstacle
sweeps and sliding. Browser guest-session checks resume character selection in
a fresh tab and clear persisted state on logout without page exceptions.
The existing JavaScript bundle warning remains.

No UI layout changes require screenshots. Real signed-in browser restart and
multiplayer soak tests, all skill/terrain combinations and physical mobile
devices remain unverified. A character already saved inside geometry is not
automatically teleported by this change. Recovery and collision tuning need
playtesting. This branch is not yet deployed.
