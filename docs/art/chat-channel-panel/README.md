# Thai fantasy channel drawer

The old MMO reference supplies the interaction structure: a foldable chat panel, vertical channels on the left, message history on the right and a stable bottom composer. Jade lacquer, restrained brass edges and warm paper input fit Thai Native Online's art direction.

Implemented only existing channels: World, Party, Whisper and System. World is the renamed existing server-wide General channel. Guild and proximity channels are not invented. System is read-only with combat/loot history. The drawer starts folded, preserves the selected channel when toggled and shows unread badges. Enter opens typing; Escape folds. Up/Down/Home/End navigate channels. Sending retains the composer and supports emoji and existing command parsing. Clicking outside on desktop returns keyboard control to the game while leaving the panel readable; touch folds to protect the playfield.

## Changed files

- `src/net/ChatBox.js`: drawer state, keyboard navigation, system hint and stable composer.
- `src/net/chat-tabs.css`: channel rail and themed responsive panel.
- `tools/chat-channel-panel-qa.mjs`: isolated browser regression checks.
- This folder: screenshots and measured verification receipt.

## Validation

- `npm run build` passed; existing bundle-size warning remains.
- Feed/chat tests: 2 passed. GM support/integration tests: 4 passed.
- One headless Edge instance, closed after completion. Modern 1366×768, classic 1920×1080 at enlarged HUD, short desktop 960×540, simulated touch 390×844 and 844×390 (world/whisper composer and GM help containment).
- Verified initial folding, vertical channel keyboard navigation, offline draft preservation, Party/Whisper command routing, invalid whisper recipient, continued typing after send, emoji, System read-only state, selected channel retention after folding, 30-message retention, history reading position, GM help and Escape.
- Screenshots and bounds establish channel placement left of the log and panel/composer containment. No browser page errors.

## Limits

Browser delivery uses a stubbed filter and sends no real chat messages. Live multi-user delivery and actual mobile keyboards were not exercised. Existing draggable saved positions and unread policy remain; no server channels were added. Not deployed yet.
