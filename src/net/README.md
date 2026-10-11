# Realtime UI hooks

- `Multiplayer` handles private `welcome`/`gmAccess` metadata from the server.
  Only `admin: true` plus the server command catalog enables `ChatBox.setGmCatalog`.
  Disconnect, logout, revoked rights or a nonadmin welcome remove the help UI and
  private GM history. Local development controls are separate from GM authority.
- `ChatBox` renders catalog text safely, scrolls help, and clicking a command
  only fills the composer. Submission keeps Social's existing command routing.
- Authorization is exclusively server-side; see `docs/technical/SERVER_GM.md`.

## Hooks for stat persistence

Multiplayer passes `{ authenticated: !!session().token }` to attachNetProgress. Signed-in allocation/reset waits for the accepted server sync and an online connection; guests retain local allocation. Receiving a server sync also marks the link authoritative. Character emits `stat-connection` when a prediction cannot be sent. Build plans send one `alloc_batch`; server/statOps acknowledges rate-limited stat operations without granting points, and server/index coalesces one authoritative correction per burst. An accepted correction emits `stat-refused` for CharacterUI feedback. The 40-message budget and server-owned save remain unchanged.
