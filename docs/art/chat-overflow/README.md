# Tabbed chat containment fix

The dynamic HUD capped the whole chat at 180px (105px on short screens), although the tabbed layout adds a header, tabs and composer. The log painted past the panel background; legacy rules also disabled scrolling or hid history on short desktop screens.

The tabbed component now owns its height: the panel grows around its children while the message log remains capped at 140px/24dvh and scrolls. Long unbroken messages wrap, and keyboard focus is drawn inside the log. The collapsed mobile body remains hidden. Existing message delivery, unread counts and channel selection are unchanged.

## Changed files

- `src/net/chat-tabs.css`: scoped layout, scroll and focus rules.
- `tools/chat-overflow-qa.mjs`: isolated browser reproduction and regression checks.
- This directory: before/after screenshots and measured browser results.

## Validation

- `npm run build`: passed; existing large bundle warning remains.
- Feed/chat and monster feedback tests: 8 passed.
- One headless Edge instance, closed on completion; network sockets blocked and local guest fixture only.
- Modern 1366×768, classic 1920×1080 with HUD 1.3, short desktop 960×540: 71 injected messages, per-channel 30-message limit, long Thai/Latin strings, panel containment, bounded scrolling, preserving history reading position, following latest messages, composer containment.
- Touch layout 390×844: collapsed body, expanded composer and panel inside viewport.
- Specialist read-only Art/Tech review: no blockers after correcting compact-screen selector specificity.

Before at 1366×768, log bottom was 686px versus panel bottom 676px. After, log bottom is 667px with panel bottom 676px. See `before.json` and `verification.json` for other measurements.

## Limitations

Live multiplayer delivery and an actual phone keyboard were not exercised. Browser touch layout is simulated; channel unread/scroll policy was not redesigned. This branch has not been deployed.
