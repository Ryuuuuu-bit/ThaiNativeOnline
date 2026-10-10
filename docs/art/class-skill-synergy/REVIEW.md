# Class skill synergy technical and panel review

Reviewed 2026-10-10 on `codex/class-skill-synergy-main`.

## Summary

Technical review accepts reuse of existing class FX. Guard and bone shield remain support skills with no canonical damage schedule. Shared local/server calculations consume live armor break, weakening and bounded conditional damage bonuses. Thai status labels travel through the existing HUD. No new models, materials, shaders, lighting, animation clips or particle effects were introduced.

Removed misleading guard/shield healing popups and obsolete guard attack, shield defense/duration and berserk movement promises. Generic protection labels avoid displaying base values on evolved skills; detailed values come from effective rules in SkillPanel.

## Changed files owned by technical review

- `src/classes/fx/warrior-skills.js`: guard label and berserk movement label corrections.
- `src/classes/fx/shaman-skills.js`: bone shield label correction.
- `docs/art/class-skill-synergy/`: this report, nine PNGs and browser telemetry.

Rules, server combat, class descriptions and SkillPanel changes belong to their respective implementation owners and were inspected for compatibility.

## Validation

Final `npm test` passed: 808 tests, 806 passed, 0 failed, 2 skipped, 0 cancelled. The skips are `NPC complete local packing reloads actual skin and fails changed limb/idle anatomy` (requires `NPC_MODEL_DEPS`) and `NPC actual candidate reports revalidate immutable bodies, packed hashes and all skin frames` (optional candidate environment).

`npm run build` passed: 291 modules transformed. Vite retains its warning about bundles larger than 500 kB; this task adds no GPU resources.

Earlier full suite passed 799 of 801 tests, with zero failures and two optional NPC environment skips. An independent `node --test tests/world-boss-join.integration.test.js` rerun passed both tests. An earlier implementation-owner run saw the day-world-boss assertion consume queued `dawn` initialization before the requested `closed` response; it was not hidden or skipped. The technical-review full run did not reproduce that failure.

Browser console contains only Vite connection debug messages, no exceptions or console errors. Body width equals each captured viewport, with no horizontal page overflow.

## Screenshots

| Viewport | Guard A (party) | Guard B (self) | Pikat conditional damage |
|---|---|---|---|
| Desktop 1600 x 1000 | [A](desktop-sword_guard@A.png) | [B](desktop-sword_guard@B.png) | [Payoff](desktop-sword_pikat.png) |
| Portrait 390 x 844 | [A](mobile-sword_guard@A.png) | [B](mobile-sword_guard@B.png) | [Payoff](mobile-sword_pikat.png) |
| Landscape 844 x 390 | [A](landscape-sword_guard@A.png) | [B](landscape-sword_guard@B.png) | [Payoff](landscape-sword_pikat.png) |

The isolated probe instantiates production Character and SkillPanel, with native character, theme, layout, classic skin and touch CSS. It uses a viewport meta tag, clean Edge profile, and native `ui-touch` class for compact captures. Guard builds spend seven points (`sword_twin:2`, `sword_guard:5`) and use actual A/B evolution selection. Pikat spends fifteen points (`sword_twin:2`, `sword_wind:3`, `sword_whirl:5`, `sword_pikat:5`), within the existing 49-point budget. Compact captures scroll the real panel to taunt or payoff rows.

The root reviewer inspected desktop/portrait Guard A, portrait Guard B and landscape Pikat and accepted readable party/self distinctions, taunt limits, named setup conditions and the 15% payoff. Guard B shows self buff and omits party effect rows. All nine captures supersede incomplete early harness captures, which were removed.

## Limitations

Browser evidence covers the native skill panel, not a live multiplayer battle or rendered world. Automated combat tests validate server/local rule behavior. No live balance playtest, world FPS profile or new world/lighting art verdict is claimed. Prerequisites and point budgets are preserved; screenshot builds do not spend every skill to maximum.
