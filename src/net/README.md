# Realtime UI hooks

- `Multiplayer` handles private `welcome`/`gmAccess` metadata from the server.
  Only `admin: true` plus the server command catalog enables `ChatBox.setGmCatalog`.
  Disconnect, logout, revoked rights or a nonadmin welcome remove the help UI and
  private GM history. Local development controls are separate from GM authority.
- `ChatBox` renders catalog text safely, scrolls help, and clicking a command
  only fills the composer. Submission keeps Social's existing command routing.
- Authorization is exclusively server-side; see `docs/technical/SERVER_GM.md`.
