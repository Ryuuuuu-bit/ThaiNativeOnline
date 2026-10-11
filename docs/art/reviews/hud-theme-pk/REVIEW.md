# HUD, PK intent and title frames review

Status: APPROVED for PR. Deployment and merge are not part of this checkpoint.

## Result

Unified the in-game HUD in jade and brass, retained both skin preferences, made the PK intent control compact and server-confirmed, and increased player name/class readability. Added five prestige title/profile frame pairs and special killer/guardian pairs using ImageGen. All original title IDs, unlocks and ranking rules remain intact. Removed the extra title background rectangle: live Thai text now sits on the original painted frame field. The Sovereign text was moved two pixels down to remove substantive accent intrusion into the upper rail.

## Changed files

- `src/ui/hud-theme.css`, `src/main.js`, `src/ui/DynamicHUD.js`: shared HUD styling, profile framing and name/class presentation.
- `src/ui/titleAppearance.js`, `src/ui/titleTag.js`: title tier/theme metadata and live text markup.
- `src/net/PkMode.js`, `src/net/PvpPanel.js`, `server/pvp.js`, `server/index.js`: server-confirmed PK intent and compact control.
- `public/ui/titles/imagegen-v1/`: fourteen runtime WebPs, 382,250 bytes total (373.3 KiB).
- `tests/pk-mode*.test.js`, `tests/online-safety.test.js`, `tests/title-appearance.test.js`: behavioral and metadata coverage.
- Design, safety, network, asset provenance and QA documentation.

## Art gate

| Criterion | Score |
|---|---:|
| Style match | 9/10 |
| Readability | 8/10 |
| Thai identity | 9/10 |
| Technical usability | 8/10 |

Art review approved the final native crops and gameplay captures: intact painted frames, readable contained titles and clear portrait faces. No required asset changes remain. Sovereign retains five antialiased pixels on one upper-rail boundary row; this is visually unobtrusive, and absolute zero contact is not claimed.

## Validation and screenshots

Full core suite: 1,054 tests, 1,052 passed, zero failed, two skipped. Focused title presentation tests: 5/5 passed. Final source build passed with 335 modules in 495 ms. The full suite preceded the presentation extension and was not repeated for cosmetic changes. QA sampled all 41 catalog titles at three viewport widths (123 horizontal text-fit cases), actual rendered game fixtures, selected-asset loading, title/profile changes, missing-asset fallback and server PK protocol behavior. The last two-pixel offset received a bounded fresh-source native-pixel probe.

See [QA report](../../../technical/qa/hud-theme-pk.md) for exact scope, harness corrections and limitations. See [asset provenance](../../title-frame-assets/README.md) and [ImageGen prompts](../../title-frame-assets/PROMPTS.md).

Representative evidence:

- [Paired title/profile gallery](title-examples.png)
- [Day gameplay](imagegen-desktop-day.png), [night gameplay](imagegen-desktop-night.png)
- [Touch 320](imagegen-touch320.png), [touch 390](imagegen-touch390.png)
- [Sovereign native crop](title-sovereign-actual.png), [legendary native crop](title-legendary-actual.png), [killer native crop](title-killer-actual.png)
- [Long catalog titles](imagegen-longest-titles.png), [missing-asset fallback](imagegen-fallback.png)
- [Before](before-desktop.png), [editor interaction](editor-multiassign.png)

## Known limitations

Existing potion/Auto controls can overlap the self name/class at 320px, and the night phase announcement can temporarily overlap the self title. Dense combat, physical phones and performance benchmarks were not verified. Browser fixtures use isolated Guest records; they do not certify production account title ownership or authenticated browser PK clicks. Real WebSocket server tests cover PK behavior separately. No production saves were changed.
