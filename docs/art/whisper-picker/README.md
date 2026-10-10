# Area chat and whisper recipient picker

Adds World, Area, Party, Whisper and System tabs. Area reaches only the same authoritative map and channel. Whisper offers searchable local players, the last 12 conversation targets, Reply and clickable sender names. Incoming messages never silently replace the draft recipient. Contacts are session-only.

## Changed files
- `src/net/ChatBox.js`: channel UI, recipient picker, structured whisper sends, safe text rendering.
- `src/net/Multiplayer.js`: area scope and roster updates after remote player changes.
- `src/net/Social.js`: structured whisper transport and shortcut integration.
- `src/net/chat-tabs.css`: jade/brass/paper controls, scrollable contacts and touch layout.
- `server/index.js`: authoritative map+CH routing; invalid scopes rejected; legacy World retained.
- `tests/chat-scope.integration.test.js`: real WebSocket routing, spoofing and throttling coverage.
- `tools/whisper-picker-qa.mjs`: picker, drafts, reply, spaced names, slash body and viewport QA.
- `tools/chat-channel-panel-qa.mjs`: updated existing drawer regression fixture for Area and structured whispers.

## Validation
- Server scope integration: 7/7 passed.
- Full suite: 931 tests, 929 passed, 2 skipped, 0 failed.
- Production build: passed (309 modules); existing large bundle warning.
- Headless Edge UI fixture: 1366x768 PC, 390x844 portrait and 844x390 landscape. Fake contacts and stubbed outgoing messages; no real player messages sent.
- Screenshots: `desktop-picker.png`, `desktop-area.png`, `touch-390.png`, `touch-844.png`; measured bounds in `verification.json`.

## Limits
Local player suggestions are same map+CH, not a server-wide online directory. Recent contacts are not an online-presence claim. UI checks use seeded data; physical mobile keyboards and live production accounts were not exercised. Explicit `/w name text` remains a legacy command for one-token names; picker and Social buttons support names with spaces through structured transport. No deployment is part of this change.

Existing drawer regression passed: modern/classic PC skins, HUD scaling, short PC, portrait/landscape, offline drafts, party send, whisper, emoji, scroll retention and GM drawer. Art review approved (style9/readability8/Thai8/usability8).
