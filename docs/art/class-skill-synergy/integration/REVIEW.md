# Integration QA after latest main merges

Validated HEAD `077242a` on 2026-10-10. This includes the new A/B choice UX from main and the Thai BGM merge. No game files changed during this QA.

## Validation

- `npm test`: 815 total, 813 passed, 0 failed, 2 skipped, 0 cancelled (43.1 seconds).
- Optional skips: `NPC complete local packing reloads actual skin and fails changed limb/idle anatomy` requires `NPC_MODEL_DEPS`; `NPC actual candidate reports revalidate immutable bodies, packed hashes and all skin frames` requires optional candidate environment.
- `npm run build`: passed, 296 modules. Existing bundle-size warning remains.
- Production SkillPanel imports `skill-choice.css`; merged utility preview and effective A/B type/description remain present.

## Browser evidence

The existing native `tools/skill-choice-capture.mjs` regression passed at 1366 x 768, 1920 x 1080 and 390 x 844. It expands all 65 skill previews and checks horizontal bounds, free initial selection, paid switching, cancellation, current choice, focus retention, skill switching and combat restrictions. All checks passed with no page errors; [receipt](choice/receipt.json).

| Evidence | Desktop | Portrait |
|---|---|---|
| Native choice confirmation | [1366](choice/confirm-1366.png), [1920](choice/confirm-1920.png) | [390](choice/confirm-390.png) |
| Guard A to B pending confirmation | [Desktop](desktop-guard-switch-confirm.png) | [Portrait](mobile-guard-switch-confirm.png) |
| Guard B after actual confirmation | [Desktop](desktop-guard-switched-B.png) | [Portrait](mobile-guard-switched-B.png) |

The actual guard-switch check starts with a valid seven-point guard build and 2,500 gold. Clicking B leaves A effective until confirmation, then switches to B and spends 500 gold. The selected heading reads self buff, and the actual utility block omits party effects. Desktop and portrait both pass; [result](guard-switch-result.json).

| Selected utility preview | Desktop 1600 x 1000 | Portrait 390 x 844 | Landscape 844 x 390 |
|---|---|---|---|
| Guard A party protection | [A](desktop-sword_guard@A.png) | [A](mobile-sword_guard@A.png) | [A](landscape-sword_guard@A.png) |
| Guard B self protection | [B](desktop-sword_guard@B.png) | [B](mobile-sword_guard@B.png) | [B](landscape-sword_guard@B.png) |
| Pikat named conditions and 15% payoff | [Payoff](desktop-sword_pikat.png) | [Payoff](mobile-sword_pikat.png) | [Payoff](landscape-sword_pikat.png) |

Utility captures use production Character/SkillPanel, native CSS including touch styles, fresh Edge profile, actual A/B metadata and valid builds within the 49-point budget. Compact views scroll to the direct selected utility block, rather than hidden A/B disclosures. Final [console](browser-console.json) contains only Vite connection debug output; no resource errors or exceptions. [Telemetry](browser-result.json) records native text and dimensions.

The root reviewer accepted integrated Guard B readability: self buff, 12 defense, 20% attack speed and 2.5-second taunt. A/B action buttons, disclosure and inline confirmation coexist with the synergy utility preview.

## Limitations

Evidence covers isolated native panels and automated server/local combat tests. It does not claim live multiplayer balance, world FPS, audio listening evaluation or world/lighting art approval. New artifacts are confined to this integration directory; prior review evidence remains historical.
