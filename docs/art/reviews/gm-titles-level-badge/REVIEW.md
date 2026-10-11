# GM title access and profile level badge

Status: APPROVED for PR. This checkpoint has not been deployed.

## Summary

Authenticated GM characters can select all 41 existing titles, including dynamic rank titles, through a transient capability. Earned titles and achievement/ranking records remain separate. Revocation/logout remove access and an unearned worn title; genuinely earned titles remain available. Fresh authorization and post-await identity/token/role-epoch checks prevent delayed selection from restoring revoked access.

The profile's level badge was partly covered by the painted portrait frame. It is now centered below the portrait with reserved column space and higher stacking than ornaments. The three-digit level 100 is readable in both skins, at enlarged HUD scale and narrow touch viewports. No new artwork or ImageGen generation was required.

## Changed files

- `src/data/titleAccess.js`, `src/data/titles.js`, `src/character/Character.js`: session capability, title validation and persistence boundaries.
- `server/index.js`, `server/combatants.js`: fresh authenticated grants/revocations, public worn-title updates and live sync.
- `src/net/Multiplayer.js`, `src/net/NetProgress.js`, `src/net/SocialPanes.js`: trusted access lifecycle, stale-title filtering and all-title selection UI.
- `src/ui/hud-theme.css`: level badge positioning and reserved space.
- `tests/gm-title-access.test.js`, `tests/gm-titles.integration.test.js`: title availability, storage isolation, forged flags/IDs, rank loss and authorization races.
- GM, Character, network and agent hook documentation; QA report and screenshots.

## Gates

Game Director technical review: APPROVED. Capability is not read from saves, constructor options or packet flags. Saved JSON contains genuinely earned titles only, while live sync may carry the GM-selected cosmetic title. Existing rank scores and holder counts remain based on actual records.

Art review: APPROVED; no required visual changes.

| Criterion | Score |
|---|---:|
| Style match | 9/10 |
| Readability | 9/10 |
| Thai identity | 9/10 |
| Technical usability | 8.5/10 |

Full frozen-source suite: 1,066 tests, 1,064 passed, zero failed, two skipped, 46,458.7146ms. Final build passed in 552ms. Specialist targeted checks passed 10/10, including actual HTTP/WebSocket delayed role-revocation and logout races. QA sampled 42 level-badge text-range cases across seven profile themes, both skins and desktop/390/320 viewports; all fitted the badge and profile. Actual isolated Game fixtures exercise the Multiplayer access handler and Social title controls. Exact scope and lifecycle results: [QA report](../../../technical/qa/gm-titles-level-badge.md).

## Screenshots

- [Desktop badge](desktop-badge.png)
- [Enlarged desktop badge](desktop-enlarged-badge.png)
- [Touch 320 badge](touch320-badge.png)
- [Touch 390 badge](touch390-badge.png)
- [GM all titles](gm-all-titles.png)
- [Ordinary locked titles](ordinary-locked-titles.png)

## Known limitations

GM-only worn selections are deliberately not saved and must be selected again after reconnect; authenticated GM access itself is restored. Existing narrow-screen chat/title overlap is outside this badge fix. Browser visual fixtures inject private access messages into the real handler with network writes blocked; local real HTTP/WebSocket tests establish authority separately. No production account changes, live PostgreSQL role changes, physical-phone validation or performance benchmark were performed.
