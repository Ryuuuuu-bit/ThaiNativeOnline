# Admin commands in System chat

## Summary
The System tab previously hid the composer for everyone, including authenticated admins. It now displays the existing paper input and Run button when the server supplies the private GM catalogue. Enter sends `/gm` commands; plain text is rejected locally. GM help opens and prefills the System tab without executing the selected command.

Server authorization and private command replies are unchanged. Non-admin System chat remains read-only. Removing the catalogue immediately hides the composer and removes GM history.

## Changed files
- `src/net/ChatBox.js`: role-aware System composer, command validation, help routing and revocation repaint.
- `tools/system-admin-chat-qa.mjs`: browser fixture exercising real ChatBox with a stubbed transport.
- This report, three viewport screenshots and `verification.json`.

## Validation
- Tech review: no concrete findings.
- Focused GM integration checks: 9/9 passed, zero failures/skips.
- `npm run build`: passed, 314 modules; existing large-chunk warning.
- Headless Edge: regular read-only view, grant while System is selected, Enter submit, plain-text rejection, help prefill without execution, offline draft, revocation, and bounds at 1366x768, 390x844 and 844x390. Zero page errors.
- Art review: approved, style 9/10, readability/Thai identity/usability 8/10.

## Screenshots
- `system-1366.png`: PC command composer.
- `system-390.png`: portrait touch.
- `system-844.png`: landscape touch.

## Limits
Browser commands are captured by a stub; no live admin gameplay command was executed. Authority and private replies are covered by the existing real-server GM integration checks. Physical mobile keyboards were not exercised. This branch has not been deployed.
