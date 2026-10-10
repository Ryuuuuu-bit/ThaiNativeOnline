# UID UI review

Twelve fresh headless Edge captures cover desktop (1440×900) and mobile emulation (390×844), each with server UID and guest/unavailable states on three surfaces.

- Selection uses the actual `showCharacterSelect` component with empty local fixture slots.
- Character sheet uses the actual `CharacterUI` and inventory workspace with a fixture character.
- Settings uses the shared production `UidRow` inside a local settings-styled fixture; this is not a full Game settings integration capture.

All 12 cases pass selectable/wrapped text, viewport bounds, server-only copy controls and zero JavaScript errors. Six server-UID cases test both successful copying and denied-clipboard visible fallback; clipboard outcomes are controlled browser mocks, not a physical device clipboard. Screenshot text is selected because it captures the fallback state. Guest captures show unavailable and no copy button. Fixtures do not authenticate or connect to the server; HTTP/WS ownership/privacy and lifecycle are verified independently in integration tests.

`checks.json` records the receipts. Capture runner: `tools/uid-capture.cjs`; fixture: `tools/uid-review.html`. Physical mobile keyboards and the complete in-world HUD were not exercised here.
